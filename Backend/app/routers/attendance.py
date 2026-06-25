import csv
import io
from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload

from app.admins import get_admin_actor_label
from app.attendance import (
    build_attendance_export_filename,
    build_attendance_verification_details,
    get_attendance_or_404,
    get_filtered_attendance_records,
    serialize_attendance,
    validate_attendance_capture_hold,
    validate_attendance_geofence,
)
from app.attendance_reviews import (
    add_attendance_review_entry,
    serialize_attendance_review_entry,
)
from app.audit import add_session_audit_log
from app.dependencies import (
    authorize_student_access,
    get_authenticated_session,
    get_db,
    require_admin,
    require_student_session,
)
from app.face_profiles import ensure_student_face_profiles, get_sorted_face_profiles
from app.face_utils import (
    FACE_MATCH_THRESHOLD,
    compare_faces,
    generate_face_encoding,
    is_current_face_encoding,
)
from app.fallback_requests import (
    build_storage_datetime_for_local_date,
    get_attendance_fallback_request_or_404,
    serialize_attendance_fallback_request,
)
from app.models import (
    AttendanceFallbackRequest,
    AttendanceRecord,
    AttendanceReviewTrail,
    Student,
)
from app.storage import remove_file, save_temp_face_image
from app.students import get_public_student_id, get_student_actor_label
from app.time_utils import convert_storage_datetime_to_local, get_day_bounds, get_local_now, serialize_local_datetime
from app.validation import (
    normalize_optional_text,
    parse_iso_date,
    validate_attendance_fallback_issue_type,
    validate_attendance_fallback_status,
    validate_attendance_status,
    validate_fallback_reason,
    validate_requested_attendance_status,
    validate_review_note,
)

router = APIRouter(tags=["Attendance"])


@router.post("/attendance/mark", summary="Mark attendance")
def mark_attendance(
    face_image: UploadFile = File(...),
    latitude: float | None = Form(None),
    longitude: float | None = Form(None),
    accuracy_meters: float | None = Form(None),
    capture_started_at: str | None = Form(None),
    capture_completed_at: str | None = Form(None),
    db: Session = Depends(get_db),
    student_session: dict = Depends(require_student_session),
):
    hold_seconds = None
    geofence_distance_meters = None

    try:
        hold_seconds = validate_attendance_capture_hold(capture_started_at, capture_completed_at)
        geofence_distance_meters = validate_attendance_geofence(
            latitude=latitude,
            longitude=longitude,
            accuracy_meters=accuracy_meters,
        )
    except HTTPException as exc:
        add_session_audit_log(
            db=db,
            authenticated_session=student_session,
            action="attendance_verification_failed",
            target_type="attendance_record",
            target_label="Attendance capture",
            details=(
                f"{exc.detail}. "
                + build_attendance_verification_details(
                    hold_seconds=hold_seconds,
                    accuracy_meters=accuracy_meters,
                    geofence_distance_meters=geofence_distance_meters,
                )
            ).strip(),
        )
        db.commit()
        raise

    relative_temp_path, temp_file_path = save_temp_face_image(face_image)

    try:
        new_encoding = generate_face_encoding(temp_file_path)
    except ValueError as exc:
        remove_file(relative_temp_path)
        add_session_audit_log(
            db=db,
            authenticated_session=student_session,
            action="attendance_capture_failed",
            target_type="attendance_record",
            target_label="Attendance capture",
            details=str(exc),
        )
        db.commit()
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    students = db.query(Student).options(joinedload(Student.face_profiles)).all()

    best_match = None
    best_match_score = float("-inf")
    best_match_pose = None
    refreshed_student_face_profiles = False

    for student in students:
        try:
            refreshed_student_face_profiles = (
                ensure_student_face_profiles(student) or refreshed_student_face_profiles
            )
        except ValueError:
            continue

        for face_profile in get_sorted_face_profiles(student):
            if not is_current_face_encoding(face_profile.face_encoding):
                continue

            try:
                similarity_score = compare_faces(face_profile.face_encoding, new_encoding)
            except ValueError:
                continue

            if similarity_score > best_match_score:
                best_match_score = similarity_score
                best_match = student
                best_match_pose = face_profile.pose

    remove_file(relative_temp_path)

    if refreshed_student_face_profiles:
        db.commit()

    if best_match and best_match_score >= FACE_MATCH_THRESHOLD:
        authenticated_student = student_session["student"]

        if best_match.id != authenticated_student.id:
            add_session_audit_log(
                db=db,
                authenticated_session=student_session,
                action="attendance_face_mismatch",
                target_type="student",
                target_id=get_public_student_id(best_match),
                target_label=get_student_actor_label(best_match),
                details=(
                    f"Matched another student with pose {best_match_pose or 'unknown'} "
                    f"at confidence {best_match_score:.3f}. "
                    + build_attendance_verification_details(
                        hold_seconds=hold_seconds,
                        accuracy_meters=accuracy_meters,
                        geofence_distance_meters=geofence_distance_meters,
                    )
                ),
            )
            db.commit()
            raise HTTPException(
                status_code=403,
                detail="The captured face does not match the authenticated student account.",
            )

        local_today = datetime.now().astimezone().date()
        today_start, tomorrow_start = get_day_bounds(local_today)
        existing_attendance = (
            db.query(AttendanceRecord)
            .filter(
                AttendanceRecord.student_id == best_match.id,
                AttendanceRecord.status == "present",
                AttendanceRecord.marked_at >= today_start,
                AttendanceRecord.marked_at < tomorrow_start,
            )
            .order_by(AttendanceRecord.marked_at.desc())
            .first()
        )

        if existing_attendance:
            add_session_audit_log(
                db=db,
                authenticated_session=student_session,
                action="attendance_duplicate",
                target_type="attendance_record",
                target_id=str(existing_attendance.id),
                target_label=get_student_actor_label(best_match),
                details=(
                    "Attendance was already marked present for the current local day. "
                    + build_attendance_verification_details(
                        hold_seconds=hold_seconds,
                        accuracy_meters=accuracy_meters,
                        geofence_distance_meters=geofence_distance_meters,
                    )
                ).strip(),
            )
            db.commit()
            return {
                "status": "duplicate",
                "message": f"{best_match.full_name} has already been marked present today.",
                "student": best_match.full_name,
                "student_id": get_public_student_id(best_match),
                "marked_at": serialize_local_datetime(existing_attendance.marked_at),
                "live_hold_seconds": None if hold_seconds is None else float(hold_seconds),
                "location_accuracy_meters": None if accuracy_meters is None else float(accuracy_meters),
                "distance_from_geofence_meters": (
                    None if geofence_distance_meters is None else float(geofence_distance_meters)
                ),
            }

        attendance = AttendanceRecord(student_id=best_match.id, status="present")

        db.add(attendance)
        db.commit()
        db.refresh(attendance)

        add_session_audit_log(
            db=db,
            authenticated_session=student_session,
            action="attendance_marked",
            target_type="attendance_record",
            target_id=str(attendance.id),
            target_label=get_student_actor_label(best_match),
            details=(
                f"Marked attendance using the {best_match_pose or 'unknown'} pose "
                f"at confidence {best_match_score:.3f}. "
                + build_attendance_verification_details(
                    hold_seconds=hold_seconds,
                    accuracy_meters=accuracy_meters,
                    geofence_distance_meters=geofence_distance_meters,
                )
            ),
        )
        db.commit()

        return {
            "status": "present",
            "student": best_match.full_name,
            "student_id": get_public_student_id(best_match),
            "matched_pose": best_match_pose,
            "confidence": float(best_match_score),
            "marked_at": serialize_local_datetime(attendance.marked_at),
            "live_hold_seconds": None if hold_seconds is None else float(hold_seconds),
            "location_accuracy_meters": None if accuracy_meters is None else float(accuracy_meters),
            "distance_from_geofence_meters": (
                None if geofence_distance_meters is None else float(geofence_distance_meters)
            ),
        }

    add_session_audit_log(
        db=db,
        authenticated_session=student_session,
        action="attendance_unknown",
        target_type="attendance_record",
        target_label="Attendance capture",
        details=(
            "No matching student found."
            if best_match_score == float("-inf")
            else (
                f"No matching student found. Best confidence was {best_match_score:.3f}. "
                + build_attendance_verification_details(
                    hold_seconds=hold_seconds,
                    accuracy_meters=accuracy_meters,
                    geofence_distance_meters=geofence_distance_meters,
                )
            )
        ),
    )
    db.commit()

    return {
        "status": "unknown",
        "message": "No matching student found",
        "confidence": None if best_match_score == float("-inf") else float(best_match_score),
        "live_hold_seconds": None if hold_seconds is None else float(hold_seconds),
        "location_accuracy_meters": None if accuracy_meters is None else float(accuracy_meters),
        "distance_from_geofence_meters": (
            None if geofence_distance_meters is None else float(geofence_distance_meters)
        ),
    }


@router.post("/attendance/fallback-requests", summary="Create fallback attendance request")
def create_attendance_fallback_request(
    issue_type: str = Form(...),
    reason: str = Form(...),
    requested_status: str | None = Form("present"),
    attendance_date: str | None = Form(None),
    failure_context: str | None = Form(None),
    db: Session = Depends(get_db),
    student_session: dict = Depends(require_student_session),
):
    student = student_session["student"]
    target_date = (
        parse_iso_date(attendance_date, "attendance date")
        if normalize_optional_text(attendance_date)
        else get_local_now().date()
    )
    validated_issue_type = validate_attendance_fallback_issue_type(issue_type)
    validated_reason = validate_fallback_reason(reason)
    validated_requested_status = validate_requested_attendance_status(requested_status)
    normalized_failure_context = normalize_optional_text(failure_context)

    existing_pending_request = (
        db.query(AttendanceFallbackRequest)
        .filter(
            AttendanceFallbackRequest.student_id == student.id,
            AttendanceFallbackRequest.attendance_date == target_date,
            AttendanceFallbackRequest.status == "pending",
        )
        .first()
    )

    if existing_pending_request:
        raise HTTPException(
            status_code=400,
            detail="A pending fallback attendance request already exists for that date.",
        )

    day_start, next_day_start = get_day_bounds(target_date)
    existing_attendance = (
        db.query(AttendanceRecord)
        .filter(
            AttendanceRecord.student_id == student.id,
            AttendanceRecord.marked_at >= day_start,
            AttendanceRecord.marked_at < next_day_start,
        )
        .first()
    )

    if existing_attendance:
        raise HTTPException(
            status_code=400,
            detail="Attendance already exists for that date. Ask the admin to review the existing record instead.",
        )

    fallback_request = AttendanceFallbackRequest(
        student_id=student.id,
        attendance_date=target_date,
        requested_status=validated_requested_status,
        issue_type=validated_issue_type,
        reason=validated_reason,
        failure_context=normalized_failure_context,
        status="pending",
    )
    db.add(fallback_request)
    db.commit()
    db.refresh(fallback_request)

    add_session_audit_log(
        db=db,
        authenticated_session=student_session,
        action="attendance_fallback_requested",
        target_type="attendance_fallback_request",
        target_id=str(fallback_request.id),
        target_label=get_student_actor_label(student),
        details=(
            f"Submitted a {validated_issue_type} fallback request for {target_date.isoformat()} "
            f"with requested status {validated_requested_status}."
        ),
    )
    db.commit()

    return {
        "message": "Fallback attendance request submitted successfully.",
        "fallback_request": serialize_attendance_fallback_request(fallback_request),
    }


@router.get("/attendance/fallback-requests", summary="List fallback attendance requests")
def get_attendance_fallback_requests(
    db: Session = Depends(get_db),
    _admin_session: dict = Depends(require_admin),
):
    fallback_requests = (
        db.query(AttendanceFallbackRequest)
        .options(joinedload(AttendanceFallbackRequest.student))
        .order_by(AttendanceFallbackRequest.created_at.desc(), AttendanceFallbackRequest.id.desc())
        .all()
    )
    return [serialize_attendance_fallback_request(fallback_request) for fallback_request in fallback_requests]


@router.get(
    "/attendance/fallback-requests/student/{student_id}",
    summary="Get fallback attendance requests for one student",
)
def get_student_attendance_fallback_requests(
    student_id: str,
    db: Session = Depends(get_db),
    authenticated_session: dict = Depends(get_authenticated_session),
):
    student = authorize_student_access(student_id, authenticated_session, db)
    fallback_requests = (
        db.query(AttendanceFallbackRequest)
        .options(joinedload(AttendanceFallbackRequest.student))
        .filter(AttendanceFallbackRequest.student_id == student.id)
        .order_by(AttendanceFallbackRequest.created_at.desc(), AttendanceFallbackRequest.id.desc())
        .all()
    )
    return [serialize_attendance_fallback_request(fallback_request) for fallback_request in fallback_requests]


@router.put("/attendance/fallback-requests/{fallback_request_id}", summary="Review fallback attendance request")
def review_attendance_fallback_request(
    fallback_request_id: int,
    status: str = Form(...),
    review_note: str = Form(...),
    attendance_status: str | None = Form(None),
    db: Session = Depends(get_db),
    admin_session: dict = Depends(require_admin),
):
    fallback_request = get_attendance_fallback_request_or_404(fallback_request_id, db)
    validated_status = validate_attendance_fallback_status(status)
    validated_review_note = validate_review_note(review_note)

    if validated_status == "pending":
        raise HTTPException(status_code=400, detail="Select Approved or Rejected to review the request.")

    if fallback_request.status != "pending":
        raise HTTPException(
            status_code=400,
            detail="Only pending fallback attendance requests can be reviewed.",
        )

    admin_user = admin_session.get("admin")
    admin_actor_label = get_admin_actor_label(admin_user)
    student_public_id = get_public_student_id(fallback_request.student) or str(fallback_request.student_id)
    student_name = fallback_request.student.full_name if fallback_request.student else "Unknown Student"
    fallback_request.reviewed_at = datetime.utcnow()
    fallback_request.admin_note = validated_review_note

    if validated_status == "approved":
        resolved_attendance_status = validate_attendance_status(
            attendance_status or fallback_request.requested_status
        )
        day_start, next_day_start = get_day_bounds(fallback_request.attendance_date)
        existing_attendance = (
            db.query(AttendanceRecord)
            .filter(
                AttendanceRecord.student_id == fallback_request.student_id,
                AttendanceRecord.marked_at >= day_start,
                AttendanceRecord.marked_at < next_day_start,
            )
            .first()
        )

        if existing_attendance:
            raise HTTPException(
                status_code=400,
                detail="Attendance already exists for that date. Review the existing record instead.",
            )

        attendance_record = AttendanceRecord(
            student_id=fallback_request.student_id,
            status=resolved_attendance_status,
            marked_at=build_storage_datetime_for_local_date(fallback_request.attendance_date),
        )
        db.add(attendance_record)
        db.flush()

        fallback_request.status = "approved"
        fallback_request.approved_attendance_status = resolved_attendance_status

        add_attendance_review_entry(
            db=db,
            attendance_record=attendance_record,
            attendance_record_id=attendance_record.id,
            student_id=student_public_id,
            student_name=student_name,
            action="fallback_approved",
            review_note=validated_review_note,
            reviewed_by_admin_id=admin_user.id if admin_user else None,
            reviewed_by_admin_label=admin_actor_label,
            previous_status=None,
            next_status=resolved_attendance_status,
        )

        add_session_audit_log(
            db=db,
            authenticated_session=admin_session,
            action="attendance_fallback_approved",
            target_type="attendance_fallback_request",
            target_id=str(fallback_request.id),
            target_label=get_student_actor_label(fallback_request.student),
            details=(
                f"Approved fallback request for {fallback_request.attendance_date.isoformat()} "
                f"and created an attendance record with status {resolved_attendance_status}. "
                f"Review note: {validated_review_note}"
            ),
        )
        db.commit()
        db.refresh(fallback_request)
        db.refresh(attendance_record)

        return {
            "message": "Fallback request approved and attendance recorded successfully.",
            "fallback_request": serialize_attendance_fallback_request(fallback_request),
            "attendance": serialize_attendance(attendance_record),
        }

    fallback_request.status = "rejected"
    fallback_request.approved_attendance_status = None

    add_session_audit_log(
        db=db,
        authenticated_session=admin_session,
        action="attendance_fallback_rejected",
        target_type="attendance_fallback_request",
        target_id=str(fallback_request.id),
        target_label=get_student_actor_label(fallback_request.student),
        details=(
            f"Rejected fallback request for {fallback_request.attendance_date.isoformat()}. "
            f"Review note: {validated_review_note}"
        ),
    )
    db.commit()
    db.refresh(fallback_request)

    return {
        "message": "Fallback request rejected successfully.",
        "fallback_request": serialize_attendance_fallback_request(fallback_request),
    }


@router.get("/attendance", summary="List attendance records")
def get_attendance(
    db: Session = Depends(get_db),
    _admin_session: dict = Depends(require_admin),
):
    records = db.query(AttendanceRecord).order_by(AttendanceRecord.marked_at.desc()).all()
    return [serialize_attendance(record) for record in records]


@router.get("/attendance/review-trail", summary="List attendance review trail")
def get_attendance_review_trail(
    attendance_id: int | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    _admin_session: dict = Depends(require_admin),
):
    query = db.query(AttendanceReviewTrail)

    if attendance_id is not None:
        query = query.filter(AttendanceReviewTrail.attendance_record_id == attendance_id)

    review_entries = (
        query.order_by(AttendanceReviewTrail.created_at.desc(), AttendanceReviewTrail.id.desc())
        .limit(limit)
        .all()
    )
    return [serialize_attendance_review_entry(review_entry) for review_entry in review_entries]


@router.get("/attendance/export", summary="Export attendance CSV")
def export_attendance(
    search: str | None = Query(default=None),
    status: str | None = Query(default=None),
    student_id: str | None = Query(default=None),
    date: str | None = Query(default=None),
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
    sort_by: str | None = Query(default=None),
    sort_direction: str | None = Query(default=None),
    db: Session = Depends(get_db),
    admin_session: dict = Depends(require_admin),
):
    records = get_filtered_attendance_records(
        db=db,
        search=search,
        status=status,
        student_id=student_id,
        attendance_date=date,
        date_from=date_from,
        date_to=date_to,
        sort_by=sort_by,
        sort_direction=sort_direction,
    )

    csv_buffer = io.StringIO()
    writer = csv.writer(csv_buffer)

    writer.writerow(
        [
            "Record ID",
            "Student ID",
            "Student Name",
            "Status",
            "Marked Date (Local)",
            "Marked Time (Local)",
        ]
    )

    for record in records:
        if record.marked_at:
            local_marked_at = convert_storage_datetime_to_local(record.marked_at)
            marked_date = local_marked_at.strftime("%Y-%m-%d")
            marked_time = local_marked_at.strftime("%H:%M:%S")
        else:
            marked_date = ""
            marked_time = ""

        writer.writerow(
            [
                record.id,
                get_public_student_id(record.student) or str(record.student_id),
                record.student.full_name if record.student else "Unknown Student",
                record.status,
                marked_date,
                marked_time,
            ]
        )

    csv_content = "\ufeff" + csv_buffer.getvalue()
    file_name = build_attendance_export_filename(status, student_id, date, date_from, date_to)

    add_session_audit_log(
        db=db,
        authenticated_session=admin_session,
        action="attendance_exported",
        target_type="report",
        target_label=file_name,
        details=(
            f"Exported {len(records)} attendance records"
            f"{f' with status {status}' if status else ''}."
        ),
    )
    db.commit()

    return StreamingResponse(
        iter([csv_content]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{file_name}"'},
    )


@router.put("/attendance/{attendance_id}", summary="Update attendance")
def update_attendance(
    attendance_id: int,
    status: str = Form(...),
    review_note: str = Form(...),
    db: Session = Depends(get_db),
    admin_session: dict = Depends(require_admin),
):
    attendance = get_attendance_or_404(attendance_id, db)
    previous_status = attendance.status
    next_status = validate_attendance_status(status)
    validated_review_note = validate_review_note(review_note)
    admin_user = admin_session.get("admin")
    admin_actor_label = get_admin_actor_label(admin_user)
    student_public_id = get_public_student_id(attendance.student) or str(attendance.student_id)
    student_name = attendance.student.full_name if attendance.student else "Unknown Student"

    review_action = "review_confirmed"
    response_message = "Attendance review saved successfully."

    if next_status != previous_status:
        attendance.status = next_status
        review_action = "status_updated"
        response_message = "Attendance updated successfully."

    add_attendance_review_entry(
        db=db,
        attendance_record=attendance,
        attendance_record_id=attendance.id,
        student_id=student_public_id,
        student_name=student_name,
        action=review_action,
        review_note=validated_review_note,
        reviewed_by_admin_id=admin_user.id if admin_user else None,
        reviewed_by_admin_label=admin_actor_label,
        previous_status=previous_status,
        next_status=next_status,
    )

    add_session_audit_log(
        db=db,
        authenticated_session=admin_session,
        action="attendance_updated" if next_status != previous_status else "attendance_reviewed",
        target_type="attendance_record",
        target_id=str(attendance.id),
        target_label=student_name,
        details=(
            f"Changed attendance status from {previous_status} to {next_status}. "
            if next_status != previous_status
            else f"Confirmed attendance status remained {previous_status}. "
        )
        + f"Review note: {validated_review_note}",
    )

    db.commit()
    db.refresh(attendance)

    return {
        "message": response_message,
        "attendance": serialize_attendance(attendance),
    }


@router.delete("/attendance/{attendance_id}", summary="Delete attendance")
def delete_attendance(
    attendance_id: int,
    review_note: str = Form(...),
    db: Session = Depends(get_db),
    admin_session: dict = Depends(require_admin),
):
    attendance = get_attendance_or_404(attendance_id, db)
    validated_review_note = validate_review_note(review_note)
    admin_user = admin_session.get("admin")
    admin_actor_label = get_admin_actor_label(admin_user)
    attendance_target_label = attendance.student.full_name if attendance.student else "Unknown Student"
    student_public_id = get_public_student_id(attendance.student) or str(attendance.student_id)

    add_attendance_review_entry(
        db=db,
        attendance_record=attendance,
        attendance_record_id=attendance.id,
        student_id=student_public_id,
        student_name=attendance_target_label,
        action="record_deleted",
        review_note=validated_review_note,
        reviewed_by_admin_id=admin_user.id if admin_user else None,
        reviewed_by_admin_label=admin_actor_label,
        previous_status=attendance.status,
        next_status=None,
    )

    add_session_audit_log(
        db=db,
        authenticated_session=admin_session,
        action="attendance_deleted",
        target_type="attendance_record",
        target_id=str(attendance_id),
        target_label=attendance_target_label,
        details=f"Deleted an attendance record. Review note: {validated_review_note}",
    )

    db.delete(attendance)
    db.commit()

    return {"message": "Attendance deleted successfully"}


@router.get("/attendance/student/{student_id}", summary="Get attendance for one student")
def get_student_attendance(
    student_id: str,
    db: Session = Depends(get_db),
    authenticated_session: dict = Depends(get_authenticated_session),
):
    student = authorize_student_access(student_id, authenticated_session, db)
    records = (
        db.query(AttendanceRecord)
        .filter(AttendanceRecord.student_id == student.id)
        .order_by(AttendanceRecord.marked_at.desc())
        .all()
    )

    return [serialize_attendance(record) for record in records]

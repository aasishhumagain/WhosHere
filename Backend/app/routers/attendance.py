import csv
import io
from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload

from app.attendance import (
    build_attendance_export_filename,
    build_attendance_verification_details,
    get_attendance_or_404,
    get_filtered_attendance_records,
    serialize_attendance,
    validate_attendance_capture_hold,
    validate_attendance_geofence,
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
from app.models import AttendanceRecord, Student
from app.storage import remove_file, save_temp_face_image
from app.students import get_public_student_id, get_student_actor_label
from app.time_utils import convert_storage_datetime_to_local, get_day_bounds, serialize_local_datetime
from app.validation import validate_attendance_status

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


@router.get("/attendance", summary="List attendance records")
def get_attendance(
    db: Session = Depends(get_db),
    _admin_session: dict = Depends(require_admin),
):
    records = db.query(AttendanceRecord).order_by(AttendanceRecord.marked_at.desc()).all()
    return [serialize_attendance(record) for record in records]


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
    db: Session = Depends(get_db),
    admin_session: dict = Depends(require_admin),
):
    attendance = get_attendance_or_404(attendance_id, db)
    previous_status = attendance.status
    attendance.status = validate_attendance_status(status)

    db.commit()
    db.refresh(attendance)

    add_session_audit_log(
        db=db,
        authenticated_session=admin_session,
        action="attendance_updated",
        target_type="attendance_record",
        target_id=str(attendance.id),
        target_label=attendance.student.full_name if attendance.student else "Unknown Student",
        details=f"Changed attendance status from {previous_status} to {attendance.status}.",
    )
    db.commit()

    return {
        "message": "Attendance updated successfully",
        "attendance": serialize_attendance(attendance),
    }


@router.delete("/attendance/{attendance_id}", summary="Delete attendance")
def delete_attendance(
    attendance_id: int,
    db: Session = Depends(get_db),
    admin_session: dict = Depends(require_admin),
):
    attendance = get_attendance_or_404(attendance_id, db)
    attendance_target_label = attendance.student.full_name if attendance.student else "Unknown Student"

    db.delete(attendance)
    db.commit()

    add_session_audit_log(
        db=db,
        authenticated_session=admin_session,
        action="attendance_deleted",
        target_type="attendance_record",
        target_id=str(attendance_id),
        target_label=attendance_target_label,
        details="Deleted an attendance record.",
    )
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

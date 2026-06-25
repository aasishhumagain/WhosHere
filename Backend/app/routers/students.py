from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.audit import add_session_audit_log
from app.dependencies import (
    authorize_student_access,
    get_authenticated_session,
    get_db,
    require_admin,
    require_student_session,
)
from app.face_profiles import (
    apply_saved_face_images_to_student,
    collect_student_face_image_paths,
    get_face_profile_by_pose,
    get_uploaded_face_images,
    remove_saved_face_images,
    save_face_images_by_pose,
    sync_student_primary_face,
    validate_required_face_images,
)
from app.models import AttendanceFallbackRequest, AttendanceRecord, LeaveRequest, Student
from app.security import hash_password, verify_password
from app.storage import remove_file
from app.students import (
    assign_student_code,
    get_public_student_id,
    get_student_actor_label,
    get_student_with_profiles_or_404,
    serialize_student,
)
from app.validation import (
    normalize_optional_text,
    validate_full_name,
    validate_required_password,
    validate_review_note,
    validate_student_role,
)

router = APIRouter(tags=["Students"])


@router.post("/students/register", summary="Register a student")
def register_student(
    full_name: str = Form(...),
    password: str = Form(None),
    email: str = Form(None),
    phone_number: str = Form(None),
    role: str = Form("Student"),
    face_image_left: UploadFile | None = File(None),
    face_image_center: UploadFile | None = File(None),
    face_image_right: UploadFile | None = File(None),
    face_image: UploadFile | None = File(None),
    db: Session = Depends(get_db),
    admin_session: dict = Depends(require_admin),
):
    uploaded_face_images = get_uploaded_face_images(
        face_image_left=face_image_left,
        face_image_center=face_image_center,
        face_image_right=face_image_right,
        face_image=face_image,
    )
    validate_required_face_images(uploaded_face_images)
    saved_face_images = save_face_images_by_pose(uploaded_face_images, prefix_base="student")
    primary_saved_face = next(
        saved_face_image
        for saved_face_image in saved_face_images
        if saved_face_image["pose"] == "center"
    )
    custom_password = normalize_optional_text(password)

    student = Student(
        student_code=None,
        full_name=validate_full_name(full_name),
        password="",
        email=normalize_optional_text(email),
        phone_number=normalize_optional_text(phone_number),
        role=validate_student_role(role),
        face_image_path=primary_saved_face["image_path"],
        face_encoding=primary_saved_face["face_encoding"],
    )
    apply_saved_face_images_to_student(student, saved_face_images)
    assign_student_code(student, db)
    student.password = hash_password(
        validate_required_password(custom_password or get_public_student_id(student))
    )

    try:
        db.add(student)
        db.commit()
        db.refresh(student)
    except IntegrityError:
        db.rollback()
        remove_saved_face_images(saved_face_images)
        raise HTTPException(
            status_code=400,
            detail="Student with this email already exists.",
        )

    add_session_audit_log(
        db=db,
        authenticated_session=admin_session,
        action="student_registered",
        target_type="student",
        target_id=get_public_student_id(student),
        target_label=get_student_actor_label(student),
        details="Registered a new student account with face enrollment.",
    )
    db.commit()

    return {
        "message": "Student registered successfully",
        "uses_student_id_password": not bool(custom_password),
        "student": serialize_student(student),
    }


@router.get("/students", summary="List students")
def get_students(
    db: Session = Depends(get_db),
    _admin_session: dict = Depends(require_admin),
):
    students = (
        db.query(Student)
        .options(joinedload(Student.face_profiles))
        .order_by(Student.created_at.desc())
        .all()
    )
    return [serialize_student(student) for student in students]


@router.get("/students/{student_id}", summary="Get one student")
def get_student(
    student_id: str,
    db: Session = Depends(get_db),
    authenticated_session: dict = Depends(get_authenticated_session),
):
    authorized_student = authorize_student_access(student_id, authenticated_session, db)
    student = get_student_with_profiles_or_404(authorized_student.id, db)
    return serialize_student(student)


@router.post("/students/{student_id}/change-password", summary="Allow a student to change their own password")
def change_student_password(
    student_id: str,
    current_password: str = Form(...),
    new_password: str = Form(...),
    db: Session = Depends(get_db),
    student_session: dict = Depends(require_student_session),
):
    student = authorize_student_access(student_id, student_session, db)
    validated_current_password = validate_required_password(current_password)
    validated_new_password = validate_required_password(new_password)

    if not verify_password(validated_current_password, student.password):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")

    if verify_password(validated_new_password, student.password):
        raise HTTPException(
            status_code=400,
            detail="New password must be different from the current password.",
        )

    student.password = hash_password(validated_new_password)
    db.commit()

    add_session_audit_log(
        db=db,
        authenticated_session=student_session,
        action="student_password_changed",
        target_type="student",
        target_id=get_public_student_id(student),
        target_label=get_student_actor_label(student),
        details="Changed the student password.",
    )
    db.commit()

    return {"message": "Password changed successfully."}


@router.put("/students/{student_id}", summary="Update a student")
def update_student(
    student_id: str,
    full_name: str = Form(...),
    email: str = Form(None),
    phone_number: str = Form(None),
    role: str = Form("Student"),
    password: str = Form(None),
    face_image_left: UploadFile | None = File(None),
    face_image_center: UploadFile | None = File(None),
    face_image_right: UploadFile | None = File(None),
    face_image: UploadFile | None = File(None),
    db: Session = Depends(get_db),
    admin_session: dict = Depends(require_admin),
):
    student = get_student_with_profiles_or_404(student_id, db)
    uploaded_face_images = get_uploaded_face_images(
        face_image_left=face_image_left,
        face_image_center=face_image_center,
        face_image_right=face_image_right,
        face_image=face_image,
    )
    saved_face_images = (
        save_face_images_by_pose(uploaded_face_images, prefix_base=f"student_{student.id}")
        if uploaded_face_images
        else []
    )
    replaced_face_paths = []

    student.full_name = validate_full_name(full_name)
    student.email = normalize_optional_text(email)
    student.phone_number = normalize_optional_text(phone_number)
    student.role = validate_student_role(role)

    if password and password.strip():
        student.password = hash_password(password.strip())

    if saved_face_images:
        replaced_face_paths = apply_saved_face_images_to_student(student, saved_face_images)

    try:
        db.commit()
        db.refresh(student)
    except IntegrityError:
        db.rollback()
        remove_saved_face_images(saved_face_images)
        raise HTTPException(
            status_code=400,
            detail="Student with this email already exists.",
        )

    for replaced_face_path in sorted(set(replaced_face_paths)):
        remove_file(replaced_face_path)

    add_session_audit_log(
        db=db,
        authenticated_session=admin_session,
        action="student_updated",
        target_type="student",
        target_id=get_public_student_id(student),
        target_label=get_student_actor_label(student),
        details=(
            "Updated student details and face enrollment."
            if saved_face_images
            else "Updated student details."
        ),
    )
    db.commit()

    return {
        "message": "Student updated successfully",
        "student": serialize_student(student),
    }


@router.delete("/students/{student_id}", summary="Delete a student")
def delete_student(
    student_id: str,
    db: Session = Depends(get_db),
    admin_session: dict = Depends(require_admin),
):
    student = get_student_with_profiles_or_404(student_id, db)
    face_image_paths = collect_student_face_image_paths(student)
    deleted_student_id = get_public_student_id(student)
    deleted_student_label = get_student_actor_label(student)

    deleted_attendance_records = (
        db.query(AttendanceRecord)
        .filter(AttendanceRecord.student_id == student.id)
        .delete(synchronize_session=False)
    )
    deleted_leave_requests = (
        db.query(LeaveRequest)
        .filter(LeaveRequest.student_id == student.id)
        .delete(synchronize_session=False)
    )
    deleted_fallback_requests = (
        db.query(AttendanceFallbackRequest)
        .filter(AttendanceFallbackRequest.student_id == student.id)
        .delete(synchronize_session=False)
    )

    db.delete(student)
    db.commit()

    for face_image_path in face_image_paths:
        remove_file(face_image_path)

    add_session_audit_log(
        db=db,
        authenticated_session=admin_session,
        action="student_deleted",
        target_type="student",
        target_id=deleted_student_id,
        target_label=deleted_student_label,
        details=(
            f"Deleted student account along with {deleted_attendance_records} attendance "
            f"records, {deleted_leave_requests} leave requests, and "
            f"{deleted_fallback_requests} fallback attendance requests."
        ),
    )
    db.commit()

    return {
        "message": "Student deleted successfully",
        "attendance_records_deleted": deleted_attendance_records,
        "leave_requests_deleted": deleted_leave_requests,
        "fallback_requests_deleted": deleted_fallback_requests,
    }


@router.delete("/students/{student_id}/face-profiles/{pose}", summary="Delete one student face profile")
def delete_student_face_profile(
    student_id: str,
    pose: str,
    review_note: str = Form(...),
    db: Session = Depends(get_db),
    admin_session: dict = Depends(require_admin),
):
    student = get_student_with_profiles_or_404(student_id, db)
    face_profile = get_face_profile_by_pose(student, pose)

    if not face_profile:
        raise HTTPException(status_code=404, detail="Face profile not found for that pose.")

    if len(student.face_profiles or []) <= 1:
        raise HTTPException(
            status_code=400,
            detail="At least one stored face profile must remain for the student.",
        )

    removed_pose = face_profile.pose
    removed_image_path = face_profile.image_path
    validated_review_note = validate_review_note(review_note)

    student.face_profiles.remove(face_profile)
    db.delete(face_profile)
    sync_student_primary_face(student)
    db.commit()
    db.refresh(student)

    remove_file(removed_image_path)

    add_session_audit_log(
        db=db,
        authenticated_session=admin_session,
        action="student_face_profile_deleted",
        target_type="student",
        target_id=get_public_student_id(student),
        target_label=get_student_actor_label(student),
        details=(
            f"Removed the {removed_pose} face profile. "
            f"Review note: {validated_review_note}"
        ),
    )
    db.commit()

    return {
        "message": f"{removed_pose.title()} face profile removed successfully.",
        "student": serialize_student(student),
    }

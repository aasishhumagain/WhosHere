from datetime import datetime

from fastapi import HTTPException
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session, joinedload

from app.config import (
    FACE_POSES,
    LEGACY_STUDENT_CODE_YEAR_PREFIX_WIDTH,
    PRIMARY_FACE_POSE,
    STUDENT_CODE_SEQUENCE_WIDTH,
    STUDENT_CODE_YEAR_PREFIX_WIDTH,
)
from app.database import SessionLocal, engine
from app.face_profiles import get_student_face_profiles_payload
from app.models import Student
from app.storage import build_upload_url
from app.time_utils import get_local_now


def get_student_code_year_prefix(year: int):
    return f"0{year % 100:02d}"


def build_student_code_from_prefix(year_prefix: str, sequence: int):
    return f"{year_prefix}{sequence:0{STUDENT_CODE_SEQUENCE_WIDTH}d}"


def build_student_code(year: int, sequence: int):
    return build_student_code_from_prefix(get_student_code_year_prefix(year), sequence)


def get_student_code_year(student: Student):
    created_at = student.created_at or datetime.utcnow()
    return created_at.year


def is_valid_student_code(code: str | None, year: int | None = None):
    normalized_code = (code or "").strip()

    if not normalized_code.isdigit() or len(normalized_code) != STUDENT_CODE_YEAR_PREFIX_WIDTH + STUDENT_CODE_SEQUENCE_WIDTH:
        return False

    if year is None:
        return True

    return normalized_code.startswith(get_student_code_year_prefix(year))


def get_public_student_id(student: Student | None):
    if not student:
        return None

    if is_valid_student_code(student.student_code):
        return student.student_code

    return build_student_code(get_student_code_year(student), student.id)


def get_student_actor_label(student: Student | None):
    if not student:
        return "Unknown student"

    public_student_id = get_public_student_id(student)

    if public_student_id:
        return f"{student.full_name} ({public_student_id})"

    return student.full_name


def normalize_student_identifier(student_id: str | int):
    normalized = str(student_id).strip()

    if not normalized:
        raise HTTPException(status_code=400, detail="Student ID is required.")

    return normalized


def get_student_by_identifier(student_id: str | int, db: Session):
    normalized_student_id = normalize_student_identifier(student_id)
    student = db.query(Student).filter(Student.student_code == normalized_student_id).first()

    if student:
        return student

    if (
        normalized_student_id.isdigit()
        and len(normalized_student_id) == LEGACY_STUDENT_CODE_YEAR_PREFIX_WIDTH + STUDENT_CODE_SEQUENCE_WIDTH
    ):
        student = db.query(Student).filter(Student.student_code == f"0{normalized_student_id}").first()

        if student:
            return student

    if normalized_student_id.isdigit():
        return db.query(Student).filter(Student.id == int(normalized_student_id)).first()

    return None


def assign_student_code(student: Student, db: Session):
    registration_year = get_local_now().year
    year_prefix = get_student_code_year_prefix(registration_year)
    latest_student_code = (
        db.query(Student.student_code)
        .filter(Student.student_code.like(f"{year_prefix}%"))
        .order_by(Student.student_code.desc())
        .limit(1)
        .scalar()
    )

    next_sequence = 1

    if latest_student_code and is_valid_student_code(latest_student_code, registration_year):
        next_sequence = int(latest_student_code[-STUDENT_CODE_SEQUENCE_WIDTH:]) + 1

    student.student_code = build_student_code_from_prefix(year_prefix, next_sequence)


def ensure_student_schema():
    inspector = inspect(engine)
    student_columns = {column["name"] for column in inspector.get_columns("students")}

    with engine.begin() as connection:
        if "student_code" not in student_columns:
            connection.execute(text("ALTER TABLE students ADD COLUMN student_code VARCHAR"))
        if "phone_number" not in student_columns:
            connection.execute(text("ALTER TABLE students ADD COLUMN phone_number VARCHAR"))
        if "role" not in student_columns:
            connection.execute(text("ALTER TABLE students ADD COLUMN role VARCHAR"))

        if "grade" in student_columns:
            connection.execute(
                text(
                    """
                    UPDATE students
                    SET role = CASE
                        WHEN LOWER(
                            COALESCE(
                                NULLIF(BTRIM(COALESCE(role, '')), ''),
                                NULLIF(BTRIM(COALESCE(grade, '')), ''),
                                'student'
                            )
                        ) = 'staff' THEN 'Staff'
                        ELSE 'Student'
                    END
                    """
                )
            )
            connection.execute(text("ALTER TABLE students DROP COLUMN IF EXISTS grade"))
        else:
            connection.execute(
                text(
                    """
                    UPDATE students
                    SET role = CASE
                        WHEN LOWER(COALESCE(NULLIF(BTRIM(COALESCE(role, '')), ''), 'student')) = 'staff'
                            THEN 'Staff'
                        ELSE 'Student'
                    END
                    """
                )
            )

        connection.execute(text("ALTER TABLE students ALTER COLUMN role SET DEFAULT 'Student'"))
        connection.execute(text("ALTER TABLE students ALTER COLUMN role SET NOT NULL"))

        connection.execute(
            text("CREATE UNIQUE INDEX IF NOT EXISTS ix_students_student_code ON students (student_code)")
        )


def backfill_student_codes():
    db = SessionLocal()

    try:
        students = db.query(Student).order_by(Student.created_at.asc(), Student.id.asc()).all()
        next_sequence_by_prefix: dict[str, int] = {}
        assigned_codes = set()
        has_changes = False

        for student in students:
            registration_prefix = get_student_code_year_prefix(get_student_code_year(student))
            existing_code = (student.student_code or "").strip()

            if is_valid_student_code(existing_code) and existing_code not in assigned_codes:
                assigned_codes.add(existing_code)
                existing_prefix = existing_code[:2]
                next_sequence_by_prefix[existing_prefix] = max(
                    next_sequence_by_prefix.get(existing_prefix, 1),
                    int(existing_code[-STUDENT_CODE_SEQUENCE_WIDTH:]) + 1,
                )
                continue

            next_sequence = next_sequence_by_prefix.get(registration_prefix, 1)
            next_code = build_student_code_from_prefix(registration_prefix, next_sequence)

            while next_code in assigned_codes:
                next_sequence += 1
                next_code = build_student_code_from_prefix(registration_prefix, next_sequence)

            student.student_code = next_code
            assigned_codes.add(next_code)
            next_sequence_by_prefix[registration_prefix] = next_sequence + 1
            has_changes = True

        if has_changes:
            db.commit()
    finally:
        db.close()


def serialize_student(student: Student):
    face_profiles = get_student_face_profiles_payload(student)
    stored_face_poses = {profile["pose"] for profile in face_profiles if profile.get("pose")}
    missing_face_poses = [pose for pose in FACE_POSES if pose not in stored_face_poses]
    primary_face_profile = next(
        (profile for profile in face_profiles if profile["pose"] == PRIMARY_FACE_POSE),
        face_profiles[0] if face_profiles else None,
    )

    return {
        "student_id": get_public_student_id(student),
        "full_name": student.full_name,
        "email": student.email,
        "phone_number": student.phone_number,
        "role": student.role,
        "face_image_path": student.face_image_path,
        "face_image_url": primary_face_profile["image_url"] if primary_face_profile else build_upload_url(student.face_image_path),
        "face_images": face_profiles,
        "face_profile_count": len(stored_face_poses),
        "missing_face_poses": missing_face_poses,
        "has_complete_face_enrollment": len(missing_face_poses) == 0,
        "created_at": student.created_at,
    }


def get_student_or_404(student_id: str | int, db: Session):
    student = get_student_by_identifier(student_id, db)

    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    return student


def get_student_with_profiles_or_404(student_id: str | int, db: Session):
    student = get_student_or_404(student_id, db)

    return (
        db.query(Student)
        .options(joinedload(Student.face_profiles))
        .filter(Student.id == student.id)
        .first()
    )

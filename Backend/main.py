import csv
import base64
import hashlib
import hmac
import io
import json
import os
import secrets
import shutil
from datetime import date, datetime, timedelta, timezone
from uuid import uuid4

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import inspect, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.database import Base, SessionLocal, engine
from app.face_utils import (
    FACE_MATCH_THRESHOLD,
    compare_faces,
    generate_face_encoding,
    is_current_face_encoding,
)
from app.models import AttendanceRecord, LeaveRequest, Student

Base.metadata.create_all(bind=engine)

OPENAPI_TAGS = [
    {
        "name": "Authentication",
        "description": "Admin and student login/logout endpoints.",
    },
    {
        "name": "Students",
        "description": "Student registration, lookup, update, and deletion.",
    },
    {
        "name": "Attendance",
        "description": "Attendance marking, listing, updating, and deletion.",
    },
    {
        "name": "Leave Requests",
        "description": "Student leave submission and admin leave management.",
    },
]

app = FastAPI(
    title="WhosHere API",
    description="Face-recognition attendance system for student and admin workflows.",
    version="1.0.0",
    openapi_tags=OPENAPI_TAGS,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ATTENDANCE_STATUSES = {"present", "absent", "late", "excused"}
LEAVE_REQUEST_STATUSES = {"pending", "approved", "rejected"}
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_DIR = os.path.join(BACKEND_DIR, "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

SESSION_SECRET = os.getenv("SESSION_SECRET") or hashlib.sha256(
    f"{ADMIN_USERNAME}:{ADMIN_PASSWORD}:{BACKEND_DIR}".encode("utf-8")
).hexdigest()
ADMIN_SESSION_TTL_SECONDS = int(os.getenv("ADMIN_SESSION_TTL_SECONDS", "43200"))
STUDENT_SESSION_TTL_SECONDS = int(os.getenv("STUDENT_SESSION_TTL_SECONDS", "43200"))
REVOKED_SESSION_TOKENS = set()

STUDENT_CODE_SEQUENCE_WIDTH = 5
STUDENT_CODE_YEAR_PREFIX_WIDTH = 3
LEGACY_STUDENT_CODE_YEAR_PREFIX_WIDTH = 2


def get_local_now():
    return datetime.now().astimezone()


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


def ensure_student_code_schema():
    inspector = inspect(engine)
    student_columns = {column["name"] for column in inspector.get_columns("students")}

    with engine.begin() as connection:
        if "student_code" not in student_columns:
            connection.execute(text("ALTER TABLE students ADD COLUMN student_code VARCHAR"))

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


ensure_student_code_schema()
backfill_student_codes()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def encode_token_segment(value: bytes):
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("utf-8")


def decode_token_segment(value: str):
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(f"{value}{padding}")


def create_session_token(role: str, subject: str, ttl_seconds: int, extra_payload: dict | None = None):
    issued_at = int(get_local_now().timestamp())
    payload = {
        "role": role,
        "sub": str(subject),
        "iat": issued_at,
        "exp": issued_at + ttl_seconds,
        "jti": uuid4().hex,
    }

    if extra_payload:
        payload.update(extra_payload)

    payload_segment = encode_token_segment(
        json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    )
    signature_segment = encode_token_segment(
        hmac.new(
            SESSION_SECRET.encode("utf-8"),
            payload_segment.encode("utf-8"),
            hashlib.sha256,
        ).digest()
    )

    return f"{payload_segment}.{signature_segment}"


def extract_bearer_token(
    authorization: str | None,
    error_detail: str = "Authentication required.",
):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail=error_detail)

    return authorization.removeprefix("Bearer ").strip()


def verify_session_token(token: str):
    if token in REVOKED_SESSION_TOKENS:
        raise HTTPException(status_code=401, detail="Session is invalid or expired.")

    try:
        payload_segment, signature_segment = token.split(".", 1)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail="Session is invalid or expired.") from exc

    expected_signature = encode_token_segment(
        hmac.new(
            SESSION_SECRET.encode("utf-8"),
            payload_segment.encode("utf-8"),
            hashlib.sha256,
        ).digest()
    )

    if not hmac.compare_digest(expected_signature, signature_segment):
        raise HTTPException(status_code=401, detail="Session is invalid or expired.")

    try:
        payload = json.loads(decode_token_segment(payload_segment).decode("utf-8"))
    except (ValueError, json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise HTTPException(status_code=401, detail="Session is invalid or expired.") from exc

    expires_at = int(payload.get("exp", 0))

    if expires_at <= int(get_local_now().timestamp()):
        raise HTTPException(status_code=401, detail="Session is invalid or expired.")

    return payload


def get_authenticated_session(authorization: str | None = Header(default=None)):
    token = extract_bearer_token(authorization)
    payload = verify_session_token(token)
    payload["token"] = token
    return payload


def require_admin(authenticated_session: dict = Depends(get_authenticated_session)):
    if authenticated_session.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin authentication required.")

    return authenticated_session


def require_student_session(
    authenticated_session: dict = Depends(get_authenticated_session),
    db: Session = Depends(get_db),
):
    if authenticated_session.get("role") != "student":
        raise HTTPException(status_code=403, detail="Student authentication required.")

    student_internal_id = authenticated_session.get("sub")

    if not str(student_internal_id or "").isdigit():
        raise HTTPException(status_code=401, detail="Session is invalid or expired.")

    student = db.query(Student).filter(Student.id == int(student_internal_id)).first()

    if not student:
        raise HTTPException(status_code=401, detail="Session is invalid or expired.")

    authenticated_session["student"] = student
    return authenticated_session


def authorize_student_access(student_id: str | int, authenticated_session: dict, db: Session):
    student = get_student_or_404(student_id, db)

    if authenticated_session.get("role") == "admin":
        return student

    if (
        authenticated_session.get("role") == "student"
        and str(authenticated_session.get("sub")) == str(student.id)
    ):
        return student

    raise HTTPException(status_code=403, detail="You can only access your own student account.")


def normalize_optional_text(value: str | None):
    if value is None:
        return None

    value = value.strip()
    return value or None


def validate_full_name(full_name: str):
    cleaned_name = full_name.strip()

    if not cleaned_name:
        raise HTTPException(status_code=400, detail="Full name is required.")

    return cleaned_name


def validate_required_password(password: str):
    cleaned_password = password.strip()

    if not cleaned_password:
        raise HTTPException(status_code=400, detail="Password is required.")

    return cleaned_password


def validate_attendance_status(status: str):
    cleaned_status = status.strip().lower()

    if cleaned_status not in ATTENDANCE_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Attendance status must be one of: {', '.join(sorted(ATTENDANCE_STATUSES))}.",
        )

    return cleaned_status


def validate_leave_status(status: str):
    cleaned_status = status.strip().lower()

    if cleaned_status not in LEAVE_REQUEST_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Leave status must be one of: {', '.join(sorted(LEAVE_REQUEST_STATUSES))}.",
        )

    return cleaned_status


def validate_leave_reason(reason: str):
    cleaned_reason = reason.strip()

    if not cleaned_reason:
        raise HTTPException(status_code=400, detail="Leave reason is required.")

    return cleaned_reason


def parse_iso_date(value: str, field_name: str):
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid {field_name}. Use YYYY-MM-DD format.",
        ) from exc


def get_day_bounds(target_date: date):
    local_timezone = datetime.now().astimezone().tzinfo or timezone.utc
    day_start_local = datetime.combine(target_date, datetime.min.time(), tzinfo=local_timezone)
    next_day_start_local = day_start_local + timedelta(days=1)

    return (
        day_start_local.astimezone(timezone.utc).replace(tzinfo=None),
        next_day_start_local.astimezone(timezone.utc).replace(tzinfo=None),
    )


def convert_storage_datetime_to_local(value: datetime | None):
    if not value:
        return None

    local_timezone = datetime.now().astimezone().tzinfo or timezone.utc
    return value.replace(tzinfo=timezone.utc).astimezone(local_timezone)


def serialize_local_datetime(value: datetime | None):
    local_datetime = convert_storage_datetime_to_local(value)
    return local_datetime.isoformat(timespec="seconds") if local_datetime else None


def resolve_storage_path(file_path: str | None):
    if not file_path:
        return None

    if os.path.isabs(file_path):
        return file_path

    normalized = str(file_path).replace("\\", "/").lstrip("/")

    if normalized.startswith("uploads/"):
        return os.path.join(BACKEND_DIR, *normalized.split("/"))

    return os.path.join(UPLOAD_DIR, os.path.basename(normalized))


def build_upload_url(file_path: str | None):
    if not file_path:
        return None

    normalized = str(file_path).replace("\\", "/")

    if normalized.startswith("/uploads/"):
        return normalized

    if normalized.startswith("uploads/"):
        return f"/{normalized}"

    return f"/uploads/{os.path.basename(normalized)}"


def remove_file(file_path: str | None):
    storage_path = resolve_storage_path(file_path)

    if storage_path and os.path.exists(storage_path):
        os.remove(storage_path)


def save_uploaded_file(face_image: UploadFile, prefix: str):
    original_name = os.path.basename(face_image.filename or f"{prefix}.jpg")
    file_extension = os.path.splitext(original_name.replace(" ", "_"))[1] or ".jpg"
    file_name = f"{prefix}_{uuid4().hex}{file_extension}"
    relative_path = f"uploads/{file_name}"
    absolute_path = resolve_storage_path(relative_path)

    with open(absolute_path, "wb") as buffer:
        shutil.copyfileobj(face_image.file, buffer)

    return relative_path, absolute_path


def save_face_image(face_image: UploadFile, prefix: str = "student"):
    relative_path, absolute_path = save_uploaded_file(face_image, prefix)

    try:
        face_encoding = generate_face_encoding(absolute_path)
    except ValueError as exc:
        remove_file(relative_path)
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return relative_path, face_encoding


def save_temp_face_image(face_image: UploadFile):
    relative_path, absolute_path = save_uploaded_file(face_image, "temp")
    return relative_path, absolute_path


def hash_password(password: str):
    iterations = 100_000
    salt = secrets.token_hex(16)
    password_hash = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        iterations,
    ).hex()

    return f"pbkdf2_sha256${iterations}${salt}${password_hash}"


def verify_password(plain_password: str, stored_password: str):
    if not stored_password.startswith("pbkdf2_sha256$"):
        return hmac.compare_digest(stored_password, plain_password)

    try:
        _, iteration_count, salt, stored_hash = stored_password.split("$", 3)
    except ValueError:
        return False

    password_hash = hashlib.pbkdf2_hmac(
        "sha256",
        plain_password.encode("utf-8"),
        salt.encode("utf-8"),
        int(iteration_count),
    ).hex()

    return hmac.compare_digest(password_hash, stored_hash)


def verify_admin_password(plain_password: str):
    return verify_password(plain_password, ADMIN_PASSWORD)


def serialize_student(student: Student):
    return {
        "student_id": get_public_student_id(student),
        "full_name": student.full_name,
        "email": student.email,
        "face_image_path": student.face_image_path,
        "face_image_url": build_upload_url(student.face_image_path),
        "created_at": student.created_at,
    }


def serialize_attendance(record: AttendanceRecord):
    return {
        "id": record.id,
        "student_id": get_public_student_id(record.student) or str(record.student_id),
        "student_name": record.student.full_name if record.student else "Unknown Student",
        "status": record.status,
        "marked_at": serialize_local_datetime(record.marked_at),
    }


def serialize_leave_request(leave_request: LeaveRequest):
    return {
        "id": leave_request.id,
        "student_id": get_public_student_id(leave_request.student) or str(leave_request.student_id),
        "student_name": leave_request.student.full_name if leave_request.student else "Unknown Student",
        "start_date": leave_request.start_date,
        "end_date": leave_request.end_date,
        "reason": leave_request.reason,
        "status": leave_request.status,
        "created_at": leave_request.created_at,
        "days_requested": (leave_request.end_date - leave_request.start_date).days + 1,
    }


def get_student_or_404(student_id: str | int, db: Session):
    student = get_student_by_identifier(student_id, db)

    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    return student


def get_attendance_or_404(attendance_id: int, db: Session):
    attendance = db.query(AttendanceRecord).filter(AttendanceRecord.id == attendance_id).first()

    if not attendance:
        raise HTTPException(status_code=404, detail="Attendance record not found.")

    return attendance


def get_leave_request_or_404(leave_request_id: int, db: Session):
    leave_request = db.query(LeaveRequest).filter(LeaveRequest.id == leave_request_id).first()

    if not leave_request:
        raise HTTPException(status_code=404, detail="Leave request not found.")

    return leave_request


def refresh_student_face_encoding(student: Student):
    if is_current_face_encoding(student.face_encoding):
        return False

    face_image_path = resolve_storage_path(student.face_image_path)

    if not face_image_path or not os.path.exists(face_image_path):
        return False

    student.face_encoding = generate_face_encoding(face_image_path)
    return True


def get_filtered_attendance_records(
    db: Session,
    search: str | None = None,
    status: str | None = None,
    student_id: str | None = None,
    attendance_date: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    sort_by: str | None = None,
    sort_direction: str | None = None,
):
    query = db.query(AttendanceRecord).options(joinedload(AttendanceRecord.student))

    if status and status != "all":
        query = query.filter(AttendanceRecord.status == validate_attendance_status(status))

    if student_id is not None:
        student = get_student_by_identifier(student_id, db)

        if not student:
            return []

        query = query.filter(AttendanceRecord.student_id == student.id)

    if attendance_date:
        parsed_date = parse_iso_date(attendance_date, "date")
        day_start, next_day_start = get_day_bounds(parsed_date)
        query = query.filter(
            AttendanceRecord.marked_at >= day_start,
            AttendanceRecord.marked_at < next_day_start,
        )

    if date_from:
        parsed_date_from = parse_iso_date(date_from, "start date")
        day_start, _ = get_day_bounds(parsed_date_from)
        query = query.filter(AttendanceRecord.marked_at >= day_start)

    if date_to:
        parsed_date_to = parse_iso_date(date_to, "end date")
        _, next_day_start = get_day_bounds(parsed_date_to)
        query = query.filter(AttendanceRecord.marked_at < next_day_start)

    records = query.all()
    normalized_search = (search or "").strip().lower()

    if normalized_search:
        filtered_records = []

        for record in records:
            haystack = (
                f"{record.student.full_name if record.student else ''} "
                f"{get_public_student_id(record.student) or record.student_id} "
                f"{record.status}"
            ).lower()

            if normalized_search in haystack:
                filtered_records.append(record)

        records = filtered_records

    resolved_sort_by = sort_by or "marked_at"
    resolved_sort_direction = (sort_direction or "desc").lower()

    if resolved_sort_by == "student_name":
        records.sort(
            key=lambda record: (
                record.student.full_name.lower() if record.student else "",
                get_public_student_id(record.student) or str(record.student_id),
            ),
            reverse=resolved_sort_direction == "desc",
        )
    elif resolved_sort_by == "status":
        records.sort(
            key=lambda record: (
                record.status.lower(),
                get_public_student_id(record.student) or str(record.student_id),
            ),
            reverse=resolved_sort_direction == "desc",
        )
    elif resolved_sort_by == "student_id":
        records.sort(
            key=lambda record: get_public_student_id(record.student) or str(record.student_id),
            reverse=resolved_sort_direction == "desc",
        )
    else:
        records.sort(
            key=lambda record: record.marked_at or datetime.min,
            reverse=resolved_sort_direction != "asc",
        )

    return records


def build_attendance_export_filename(
    status: str | None,
    student_id: str | None,
    attendance_date: str | None,
    date_from: str | None,
    date_to: str | None,
):
    name_parts = ["attendance_report"]

    if attendance_date:
        name_parts.append(attendance_date)
    elif date_from and date_to:
        name_parts.append(f"{date_from}_to_{date_to}")
    elif date_from:
        name_parts.append(f"from_{date_from}")
    elif date_to:
        name_parts.append(f"until_{date_to}")
    else:
        name_parts.append("all_dates")

    if status and status != "all":
        name_parts.append(status)

    if student_id is not None:
        name_parts.append(f"student_{student_id}")

    return f"{'_'.join(name_parts)}.csv"


@app.get("/", include_in_schema=False)
def home():
    return {"message": "WhosHere backend is running"}


@app.post("/login/admin", tags=["Authentication"], summary="Admin login")
def admin_login(
    username: str = Form(...),
    password: str = Form(...),
):
    if username.strip() != ADMIN_USERNAME or not verify_admin_password(password):
        raise HTTPException(status_code=401, detail="Invalid admin credentials")

    token = create_session_token(
        role="admin",
        subject=ADMIN_USERNAME,
        ttl_seconds=ADMIN_SESSION_TTL_SECONDS,
        extra_payload={"username": ADMIN_USERNAME},
    )

    return {
        "message": "Admin login successful",
        "username": ADMIN_USERNAME,
        "token": token,
        "expires_in": ADMIN_SESSION_TTL_SECONDS,
    }


@app.post("/logout/admin", tags=["Authentication"], summary="Admin logout")
def admin_logout(admin_session: dict = Depends(require_admin)):
    REVOKED_SESSION_TOKENS.add(admin_session["token"])
    return {"message": "Admin logged out successfully"}


@app.post("/students/register", tags=["Students"], summary="Register a student")
def register_student(
    full_name: str = Form(...),
    password: str = Form(...),
    email: str = Form(None),
    face_image: UploadFile = File(...),
    db: Session = Depends(get_db),
    _admin_token: str = Depends(require_admin),
):
    file_path, face_encoding = save_face_image(face_image)

    student = Student(
        student_code=None,
        full_name=validate_full_name(full_name),
        password=hash_password(validate_required_password(password)),
        email=normalize_optional_text(email),
        face_image_path=file_path,
        face_encoding=face_encoding,
    )
    assign_student_code(student, db)

    try:
        db.add(student)
        db.commit()
        db.refresh(student)
    except IntegrityError:
        db.rollback()
        remove_file(file_path)
        raise HTTPException(
            status_code=400,
            detail="Student with this email already exists.",
        )

    return {
        "message": "Student registered successfully",
        "student": serialize_student(student),
    }


@app.get("/students", tags=["Students"], summary="List students")
def get_students(
    db: Session = Depends(get_db),
    _admin_token: str = Depends(require_admin),
):
    students = db.query(Student).order_by(Student.created_at.desc()).all()
    return [serialize_student(student) for student in students]


@app.get("/students/{student_id}", tags=["Students"], summary="Get one student")
def get_student(
    student_id: str,
    db: Session = Depends(get_db),
    authenticated_session: dict = Depends(get_authenticated_session),
):
    student = authorize_student_access(student_id, authenticated_session, db)
    return serialize_student(student)


@app.post(
    "/students/{student_id}/change-password",
    tags=["Students"],
    summary="Allow a student to change their own password",
)
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

    return {"message": "Password changed successfully."}


@app.put("/students/{student_id}", tags=["Students"], summary="Update a student")
def update_student(
    student_id: str,
    full_name: str = Form(...),
    email: str = Form(None),
    password: str = Form(None),
    face_image: UploadFile | None = File(None),
    db: Session = Depends(get_db),
    _admin_token: str = Depends(require_admin),
):
    student = get_student_or_404(student_id, db)
    previous_face_image_path = student.face_image_path
    new_face_image_path = None

    student.full_name = validate_full_name(full_name)
    student.email = normalize_optional_text(email)

    if password and password.strip():
        student.password = hash_password(password.strip())

    if face_image and face_image.filename:
        new_face_image_path, new_face_encoding = save_face_image(face_image)
        student.face_image_path = new_face_image_path
        student.face_encoding = new_face_encoding

    try:
        db.commit()
        db.refresh(student)
    except IntegrityError:
        db.rollback()
        remove_file(new_face_image_path)
        raise HTTPException(
            status_code=400,
            detail="Student with this email already exists.",
        )

    if new_face_image_path and previous_face_image_path != new_face_image_path:
        remove_file(previous_face_image_path)

    return {
        "message": "Student updated successfully",
        "student": serialize_student(student),
    }


@app.delete("/students/{student_id}", tags=["Students"], summary="Delete a student")
def delete_student(
    student_id: str,
    db: Session = Depends(get_db),
    _admin_token: str = Depends(require_admin),
):
    student = get_student_or_404(student_id, db)
    face_image_path = student.face_image_path

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

    db.delete(student)
    db.commit()
    remove_file(face_image_path)

    return {
        "message": "Student deleted successfully",
        "attendance_records_deleted": deleted_attendance_records,
        "leave_requests_deleted": deleted_leave_requests,
    }


@app.post("/login/student", tags=["Authentication"], summary="Student login")
def student_login(
    student_id: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db),
):
    student = get_student_by_identifier(student_id, db)

    if not student or not verify_password(password, student.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_session_token(
        role="student",
        subject=str(student.id),
        ttl_seconds=STUDENT_SESSION_TTL_SECONDS,
        extra_payload={
            "student_id": get_public_student_id(student),
            "full_name": student.full_name,
        },
    )

    return {
        "message": "Login successful",
        "student_id": get_public_student_id(student),
        "full_name": student.full_name,
        "email": student.email,
        "face_image_url": build_upload_url(student.face_image_path),
        "created_at": student.created_at,
        "token": token,
        "expires_in": STUDENT_SESSION_TTL_SECONDS,
    }


@app.post("/logout/student", tags=["Authentication"], summary="Student logout")
def student_logout(student_session: dict = Depends(require_student_session)):
    REVOKED_SESSION_TOKENS.add(student_session["token"])
    return {"message": "Student logged out successfully"}


@app.post("/attendance/mark", tags=["Attendance"], summary="Mark attendance")
def mark_attendance(
    face_image: UploadFile = File(...),
    db: Session = Depends(get_db),
    student_session: dict = Depends(require_student_session),
):
    relative_temp_path, temp_file_path = save_temp_face_image(face_image)

    try:
        new_encoding = generate_face_encoding(temp_file_path)
    except ValueError as exc:
        remove_file(relative_temp_path)
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    students = db.query(Student).all()

    best_match = None
    best_match_score = float("-inf")
    refreshed_student_encodings = False

    for student in students:
        if not student.face_encoding or not is_current_face_encoding(student.face_encoding):
            try:
                refreshed_student_encodings = refresh_student_face_encoding(student) or refreshed_student_encodings
            except ValueError:
                continue

        if student.face_encoding and is_current_face_encoding(student.face_encoding):
            try:
                similarity_score = compare_faces(student.face_encoding, new_encoding)
            except ValueError:
                continue

            if similarity_score > best_match_score:
                best_match_score = similarity_score
                best_match = student

    remove_file(relative_temp_path)

    if refreshed_student_encodings:
        db.commit()

    if best_match and best_match_score >= FACE_MATCH_THRESHOLD:
        authenticated_student = student_session["student"]

        if best_match.id != authenticated_student.id:
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
            return {
                "status": "duplicate",
                "message": f"{best_match.full_name} has already been marked present today.",
                "student": best_match.full_name,
                "student_id": get_public_student_id(best_match),
                "marked_at": serialize_local_datetime(existing_attendance.marked_at),
            }

        attendance = AttendanceRecord(student_id=best_match.id, status="present")

        db.add(attendance)
        db.commit()
        db.refresh(attendance)

        return {
            "status": "present",
            "student": best_match.full_name,
            "student_id": get_public_student_id(best_match),
            "confidence": float(best_match_score),
            "marked_at": serialize_local_datetime(attendance.marked_at),
        }

    return {
        "status": "unknown",
        "message": "No matching student found",
        "confidence": None if best_match_score == float("-inf") else float(best_match_score),
    }


@app.get("/attendance", tags=["Attendance"], summary="List attendance records")
def get_attendance(
    db: Session = Depends(get_db),
    _admin_token: str = Depends(require_admin),
):
    records = db.query(AttendanceRecord).order_by(AttendanceRecord.marked_at.desc()).all()
    return [serialize_attendance(record) for record in records]


@app.get("/attendance/export", tags=["Attendance"], summary="Export attendance CSV")
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
    _admin_token: str = Depends(require_admin),
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

    return StreamingResponse(
        iter([csv_content]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{file_name}"'},
    )


@app.put("/attendance/{attendance_id}", tags=["Attendance"], summary="Update attendance")
def update_attendance(
    attendance_id: int,
    status: str = Form(...),
    db: Session = Depends(get_db),
    _admin_token: str = Depends(require_admin),
):
    attendance = get_attendance_or_404(attendance_id, db)
    attendance.status = validate_attendance_status(status)

    db.commit()
    db.refresh(attendance)

    return {
        "message": "Attendance updated successfully",
        "attendance": serialize_attendance(attendance),
    }


@app.delete("/attendance/{attendance_id}", tags=["Attendance"], summary="Delete attendance")
def delete_attendance(
    attendance_id: int,
    db: Session = Depends(get_db),
    _admin_token: str = Depends(require_admin),
):
    attendance = get_attendance_or_404(attendance_id, db)

    db.delete(attendance)
    db.commit()

    return {"message": "Attendance deleted successfully"}


@app.get(
    "/attendance/student/{student_id}",
    tags=["Attendance"],
    summary="Get attendance for one student",
)
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


@app.post("/leave-requests", tags=["Leave Requests"], summary="Create leave request")
def create_leave_request(
    student_id: str = Form(...),
    start_date: str = Form(...),
    end_date: str = Form(...),
    reason: str = Form(...),
    db: Session = Depends(get_db),
    student_session: dict = Depends(require_student_session),
):
    student = get_student_or_404(student_id, db)

    if student.id != student_session["student"].id:
        raise HTTPException(status_code=403, detail="You can only create leave requests for your own account.")

    parsed_start_date = parse_iso_date(start_date, "start date")
    parsed_end_date = parse_iso_date(end_date, "end date")

    if parsed_end_date < parsed_start_date:
        raise HTTPException(status_code=400, detail="End date cannot be earlier than start date.")

    leave_request = LeaveRequest(
        student_id=student.id,
        start_date=parsed_start_date,
        end_date=parsed_end_date,
        reason=validate_leave_reason(reason),
        status="pending",
    )

    db.add(leave_request)
    db.commit()
    db.refresh(leave_request)

    return {
        "message": "Leave request submitted successfully",
        "leave_request": serialize_leave_request(leave_request),
    }


@app.get("/leave-requests", tags=["Leave Requests"], summary="List leave requests")
def get_leave_requests(
    db: Session = Depends(get_db),
    _admin_token: str = Depends(require_admin),
):
    leave_requests = db.query(LeaveRequest).order_by(LeaveRequest.created_at.desc()).all()
    return [serialize_leave_request(leave_request) for leave_request in leave_requests]


@app.get(
    "/leave-requests/student/{student_id}",
    tags=["Leave Requests"],
    summary="Get leave requests for one student",
)
def get_student_leave_requests(
    student_id: str,
    db: Session = Depends(get_db),
    authenticated_session: dict = Depends(get_authenticated_session),
):
    student = authorize_student_access(student_id, authenticated_session, db)
    leave_requests = (
        db.query(LeaveRequest)
        .filter(LeaveRequest.student_id == student.id)
        .order_by(LeaveRequest.created_at.desc())
        .all()
    )

    return [serialize_leave_request(leave_request) for leave_request in leave_requests]


@app.put(
    "/leave-requests/{leave_request_id}",
    tags=["Leave Requests"],
    summary="Update leave request status",
)
def update_leave_request_status(
    leave_request_id: int,
    status: str = Form(...),
    db: Session = Depends(get_db),
    _admin_token: str = Depends(require_admin),
):
    leave_request = get_leave_request_or_404(leave_request_id, db)
    leave_request.status = validate_leave_status(status)

    db.commit()
    db.refresh(leave_request)

    return {
        "message": "Leave request updated successfully",
        "leave_request": serialize_leave_request(leave_request),
    }


@app.delete(
    "/leave-requests/{leave_request_id}",
    tags=["Leave Requests"],
    summary="Delete leave request",
)
def delete_leave_request(
    leave_request_id: int,
    db: Session = Depends(get_db),
    _admin_token: str = Depends(require_admin),
):
    leave_request = get_leave_request_or_404(leave_request_id, db)

    db.delete(leave_request)
    db.commit()

    return {"message": "Leave request deleted successfully"}

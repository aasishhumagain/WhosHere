import csv
import hashlib
import hmac
import io
import os
import secrets
import shutil
from datetime import date, datetime, timedelta, timezone
from uuid import uuid4

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
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
ACTIVE_ADMIN_TOKENS = set()

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_DIR = os.path.join(BACKEND_DIR, "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def require_admin(authorization: str | None = Header(default=None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Admin authentication required.")

    token = authorization.removeprefix("Bearer ").strip()

    if token not in ACTIVE_ADMIN_TOKENS:
        raise HTTPException(status_code=401, detail="Admin session is invalid or expired.")

    return token


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
        "student_id": student.id,
        "full_name": student.full_name,
        "email": student.email,
        "face_image_path": student.face_image_path,
        "face_image_url": build_upload_url(student.face_image_path),
        "created_at": student.created_at,
    }


def serialize_attendance(record: AttendanceRecord):
    return {
        "id": record.id,
        "student_id": record.student_id,
        "student_name": record.student.full_name if record.student else "Unknown Student",
        "status": record.status,
        "marked_at": serialize_local_datetime(record.marked_at),
    }


def serialize_leave_request(leave_request: LeaveRequest):
    return {
        "id": leave_request.id,
        "student_id": leave_request.student_id,
        "student_name": leave_request.student.full_name if leave_request.student else "Unknown Student",
        "start_date": leave_request.start_date,
        "end_date": leave_request.end_date,
        "reason": leave_request.reason,
        "status": leave_request.status,
        "created_at": leave_request.created_at,
        "days_requested": (leave_request.end_date - leave_request.start_date).days + 1,
    }


def get_student_or_404(student_id: int, db: Session):
    student = db.query(Student).filter(Student.id == student_id).first()

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
    student_id: int | None = None,
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
        query = query.filter(AttendanceRecord.student_id == student_id)

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
                f"{record.student_id} "
                f"{record.status}"
            ).lower()

            if normalized_search in haystack:
                filtered_records.append(record)

        records = filtered_records

    resolved_sort_by = sort_by or "marked_at"
    resolved_sort_direction = (sort_direction or "desc").lower()

    if resolved_sort_by == "student_name":
        records.sort(
            key=lambda record: (record.student.full_name.lower() if record.student else "", record.student_id),
            reverse=resolved_sort_direction == "desc",
        )
    elif resolved_sort_by == "status":
        records.sort(
            key=lambda record: (record.status.lower(), record.student_id),
            reverse=resolved_sort_direction == "desc",
        )
    elif resolved_sort_by == "student_id":
        records.sort(
            key=lambda record: record.student_id,
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
    student_id: int | None,
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

    token = secrets.token_urlsafe(32)
    ACTIVE_ADMIN_TOKENS.add(token)

    return {
        "message": "Admin login successful",
        "username": ADMIN_USERNAME,
        "token": token,
    }


@app.post("/logout/admin", tags=["Authentication"], summary="Admin logout")
def admin_logout(admin_token: str = Depends(require_admin)):
    ACTIVE_ADMIN_TOKENS.discard(admin_token)
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
        full_name=validate_full_name(full_name),
        password=hash_password(validate_required_password(password)),
        email=normalize_optional_text(email),
        face_image_path=file_path,
        face_encoding=face_encoding,
    )

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
def get_student(student_id: int, db: Session = Depends(get_db)):
    student = get_student_or_404(student_id, db)
    return serialize_student(student)


@app.put("/students/{student_id}", tags=["Students"], summary="Update a student")
def update_student(
    student_id: int,
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
    student_id: int,
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
    student_id: int = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db),
):
    student = db.query(Student).filter(Student.id == student_id).first()

    if not student or not verify_password(password, student.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    return {
        "message": "Login successful",
        "student_id": student.id,
        "full_name": student.full_name,
        "email": student.email,
        "face_image_url": build_upload_url(student.face_image_path),
        "created_at": student.created_at,
    }


@app.post("/attendance/mark", tags=["Attendance"], summary="Mark attendance")
def mark_attendance(
    face_image: UploadFile = File(...),
    db: Session = Depends(get_db),
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
                "student_id": best_match.id,
                "marked_at": serialize_local_datetime(existing_attendance.marked_at),
            }

        attendance = AttendanceRecord(student_id=best_match.id, status="present")

        db.add(attendance)
        db.commit()
        db.refresh(attendance)

        return {
            "status": "present",
            "student": best_match.full_name,
            "student_id": best_match.id,
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
    student_id: int | None = Query(default=None),
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
                record.student_id,
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
def get_student_attendance(student_id: int, db: Session = Depends(get_db)):
    records = (
        db.query(AttendanceRecord)
        .filter(AttendanceRecord.student_id == student_id)
        .order_by(AttendanceRecord.marked_at.desc())
        .all()
    )

    return [serialize_attendance(record) for record in records]


@app.post("/leave-requests", tags=["Leave Requests"], summary="Create leave request")
def create_leave_request(
    student_id: int = Form(...),
    start_date: str = Form(...),
    end_date: str = Form(...),
    reason: str = Form(...),
    db: Session = Depends(get_db),
):
    student = get_student_or_404(student_id, db)
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
def get_student_leave_requests(student_id: int, db: Session = Depends(get_db)):
    leave_requests = (
        db.query(LeaveRequest)
        .filter(LeaveRequest.student_id == student_id)
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

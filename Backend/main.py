import hashlib
import hmac
import os
import secrets
import shutil
from uuid import uuid4

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import Base, SessionLocal, engine
from app.face_utils import compare_faces, generate_face_encoding
from app.models import AttendanceRecord, Student

Base.metadata.create_all(bind=engine)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


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


def remove_file(file_path: str | None):
    if file_path and os.path.exists(file_path):
        os.remove(file_path)


def save_face_image(face_image: UploadFile, prefix: str = "student"):
    original_name = os.path.basename(face_image.filename or "face.jpg")
    file_extension = os.path.splitext(original_name.replace(" ", "_"))[1] or ".jpg"
    file_name = f"{prefix}_{uuid4().hex}{file_extension}"
    file_path = os.path.join(UPLOAD_DIR, file_name)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(face_image.file, buffer)

    try:
        face_encoding = generate_face_encoding(file_path)
    except ValueError as exc:
        remove_file(file_path)
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return file_path, face_encoding


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


def serialize_student(student: Student):
    return {
        "student_id": student.id,
        "full_name": student.full_name,
        "email": student.email,
        "face_image_path": student.face_image_path,
        "created_at": student.created_at,
    }


def get_student_or_404(student_id: int, db: Session):
    student = db.query(Student).filter(Student.id == student_id).first()

    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    return student


@app.get("/")
def home():
    return {"message": "WhosHere backend is running"}


@app.post("/students/register")
def register_student(
    full_name: str = Form(...),
    password: str = Form(...),
    email: str = Form(None),
    face_image: UploadFile = File(...),
    db: Session = Depends(get_db),
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


@app.get("/students")
def get_students(db: Session = Depends(get_db)):
    students = db.query(Student).order_by(Student.created_at.desc()).all()
    return [serialize_student(student) for student in students]


@app.get("/students/{student_id}")
def get_student(student_id: int, db: Session = Depends(get_db)):
    student = get_student_or_404(student_id, db)
    return serialize_student(student)


@app.put("/students/{student_id}")
def update_student(
    student_id: int,
    full_name: str = Form(...),
    email: str = Form(None),
    password: str = Form(None),
    face_image: UploadFile | None = File(None),
    db: Session = Depends(get_db),
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


@app.delete("/students/{student_id}")
def delete_student(student_id: int, db: Session = Depends(get_db)):
    student = get_student_or_404(student_id, db)
    face_image_path = student.face_image_path

    deleted_attendance_records = (
        db.query(AttendanceRecord)
        .filter(AttendanceRecord.student_id == student.id)
        .delete(synchronize_session=False)
    )

    db.delete(student)
    db.commit()
    remove_file(face_image_path)

    return {
        "message": "Student deleted successfully",
        "attendance_records_deleted": deleted_attendance_records,
    }


@app.post("/login/student")
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
    }


@app.post("/attendance/mark")
def mark_attendance(
    face_image: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    safe_filename = face_image.filename.replace(" ", "_")
    file_path = f"{UPLOAD_DIR}/temp_{safe_filename}"

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(face_image.file, buffer)

    try:
        new_encoding = generate_face_encoding(file_path)
    except ValueError as exc:
        remove_file(file_path)
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    students = db.query(Student).all()

    best_match = None
    min_distance = float("inf")

    for student in students:
        if student.face_encoding:
            distance = compare_faces(student.face_encoding, new_encoding)

            if distance < min_distance:
                min_distance = distance
                best_match = student

    remove_file(file_path)

    if best_match and min_distance < 5:
        attendance = AttendanceRecord(student_id=best_match.id, status="present")

        db.add(attendance)
        db.commit()
        db.refresh(attendance)

        return {
            "status": "present",
            "student": best_match.full_name,
            "student_id": best_match.id,
            "confidence": float(min_distance),
            "marked_at": attendance.marked_at,
        }

    return {
        "status": "unknown",
        "message": "No matching student found",
    }


@app.get("/attendance")
def get_attendance(db: Session = Depends(get_db)):
    records = db.query(AttendanceRecord).order_by(AttendanceRecord.marked_at.desc()).all()

    return [
        {
            "id": record.id,
            "student_id": record.student_id,
            "student_name": record.student.full_name,
            "status": record.status,
            "marked_at": record.marked_at,
        }
        for record in records
    ]


@app.get("/attendance/student/{student_id}")
def get_student_attendance(student_id: int, db: Session = Depends(get_db)):
    records = (
        db.query(AttendanceRecord)
        .filter(AttendanceRecord.student_id == student_id)
        .order_by(AttendanceRecord.marked_at.desc())
        .all()
    )

    return [
        {
            "id": record.id,
            "student_id": record.student_id,
            "status": record.status,
            "marked_at": record.marked_at,
        }
        for record in records
    ]

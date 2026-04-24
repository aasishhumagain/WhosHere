from fastapi import FastAPI, UploadFile, File, Form, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from app.face_utils import generate_face_encoding
import shutil
import os

from app.database import engine, Base, SessionLocal
from app.models import Student

Base.metadata.create_all(bind=engine)

app = FastAPI()

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.get("/")
def home():
    return {"message": "Who’sHere backend is running"}


@app.post("/students/register")
def register_student(
    full_name: str = Form(...),
    roll_number: str = Form(...),
    email: str = Form(None),
    face_image: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    file_path = f"{UPLOAD_DIR}/{roll_number}_{face_image.filename}"

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(face_image.file, buffer)

    try:
        face_encoding = generate_face_encoding(file_path)
    except ValueError as e:
        os.remove(file_path)
        raise HTTPException(status_code=400, detail=str(e))

    student = Student(
        full_name=full_name,
        roll_number=roll_number,
        email=email,
        face_image_path=file_path,
        face_encoding=face_encoding
    )

    try:
        db.add(student)
        db.commit()
        db.refresh(student)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="Student with this roll number or email already exists."
        )

    return {
        "message": "Student registered successfully",
        "student": {
            "id": student.id,
            "full_name": student.full_name,
            "roll_number": student.roll_number,
            "email": student.email,
            "face_image_path": student.face_image_path
        }
    }


@app.get("/students")
def get_students(db: Session = Depends(get_db)):
    students = db.query(Student).all()
    return students

@app.post("/attendance/mark")
def mark_attendance(
    face_image: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    file_path = f"{UPLOAD_DIR}/temp_{face_image.filename}"

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(face_image.file, buffer)

    try:
        new_encoding = generate_face_encoding(file_path)
    except ValueError as e:
        os.remove(file_path)
        raise HTTPException(status_code=400, detail=str(e))

    students = db.query(Student).all()

    best_match = None
    min_distance = float("inf")

    from app.face_utils import compare_faces

    for student in students:
        if student.face_encoding:
            distance = compare_faces(student.face_encoding, new_encoding)

            if distance < min_distance:
                min_distance = distance
                best_match = student

    os.remove(file_path)

    if best_match and min_distance < 50:  # threshold (tune later)
        return {
            "status": "present",
            "student": best_match.full_name,
            "roll_number": best_match.roll_number,
            "confidence": float(min_distance)
        }

    return {
        "status": "unknown",
        "message": "No matching student found"
    }
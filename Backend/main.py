from fastapi import FastAPI, UploadFile, File, Form, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
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

    student = Student(
        full_name=full_name,
        roll_number=roll_number,
        email=email,
        face_image_path=file_path
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
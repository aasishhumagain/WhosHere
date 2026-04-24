from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class Student(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String, nullable=False)
    password = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=True)
    face_image_path = Column(String, nullable=True)
    face_encoding = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    attendance_records = relationship("AttendanceRecord", back_populates="student")


class AttendanceRecord(Base):
    __tablename__ = "attendance_records"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    status = Column(String, default="present")
    marked_at = Column(DateTime, default=datetime.utcnow)

    student = relationship("Student", back_populates="attendance_records")
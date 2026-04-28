from datetime import datetime

from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from app.database import Base


class AdminUser(Base):
    __tablename__ = "admin_users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    password = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    actor_type = Column(String, index=True, nullable=False)
    actor_id = Column(Integer, nullable=True)
    actor_label = Column(String, nullable=False)
    action = Column(String, index=True, nullable=False)
    target_type = Column(String, nullable=True)
    target_id = Column(String, nullable=True)
    target_label = Column(String, nullable=True)
    details = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class Student(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True)
    student_code = Column(String, unique=True, index=True, nullable=True)
    full_name = Column(String, nullable=False)
    password = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=True)
    phone_number = Column(String, nullable=True)
    role = Column(String, nullable=False, default="Student")
    face_image_path = Column(String, nullable=True)
    face_encoding = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    attendance_records = relationship(
        "AttendanceRecord",
        back_populates="student",
        cascade="all, delete-orphan",
    )
    leave_requests = relationship(
        "LeaveRequest",
        back_populates="student",
        cascade="all, delete-orphan",
    )
    face_profiles = relationship(
        "StudentFaceProfile",
        back_populates="student",
        cascade="all, delete-orphan",
    )


class StudentFaceProfile(Base):
    __tablename__ = "student_face_profiles"
    __table_args__ = (
        UniqueConstraint("student_id", "pose", name="uq_student_face_profiles_student_pose"),
    )

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    pose = Column(String, nullable=False)
    image_path = Column(String, nullable=False)
    face_encoding = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    student = relationship("Student", back_populates="face_profiles")


class AttendanceRecord(Base):
    __tablename__ = "attendance_records"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    status = Column(String, default="present")
    marked_at = Column(DateTime, default=datetime.utcnow)

    student = relationship("Student", back_populates="attendance_records")


class LeaveRequest(Base):
    __tablename__ = "leave_requests"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    reason = Column(Text, nullable=False)
    status = Column(String, default="pending")
    created_at = Column(DateTime, default=datetime.utcnow)

    student = relationship("Student", back_populates="leave_requests")

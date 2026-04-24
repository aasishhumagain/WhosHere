from sqlalchemy import Column, Integer, String, DateTime, Text
from datetime import datetime
from app.database import Base


class Student(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String, nullable=False)
    roll_number = Column(String, unique=True, nullable=False)
    email = Column(String, unique=True, nullable=True)
    face_image_path = Column(String, nullable=True)
    face_encoding = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
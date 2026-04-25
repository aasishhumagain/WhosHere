import argparse
import sys
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.orm import sessionmaker

BACKEND_DIR = Path(__file__).resolve().parents[1]

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.database import Base, build_engine, get_default_database_url, normalize_database_url
from app.models import AttendanceRecord, LeaveRequest, Student


def parse_args():
    parser = argparse.ArgumentParser(
        description="Copy WhosHere data from SQLite into PostgreSQL.",
    )
    parser.add_argument(
        "--source-url",
        default=get_default_database_url(),
        help="Source database URL. Defaults to the local SQLite file.",
    )
    parser.add_argument(
        "--target-url",
        required=True,
        help="Target PostgreSQL database URL.",
    )
    return parser.parse_args()


def ensure_postgres_url(database_url: str):
    normalized_url = normalize_database_url(database_url)

    if not normalized_url.startswith("postgresql://"):
        raise ValueError("The target database URL must use PostgreSQL.")

    return normalized_url


def copy_students(source_session, target_session):
    students = source_session.query(Student).order_by(Student.id.asc()).all()

    for student in students:
        target_session.merge(
            Student(
                id=student.id,
                full_name=student.full_name,
                password=student.password,
                email=student.email,
                face_image_path=student.face_image_path,
                face_encoding=student.face_encoding,
                created_at=student.created_at,
            )
        )

    return len(students)


def copy_attendance_records(source_session, target_session):
    attendance_records = (
        source_session.query(AttendanceRecord).order_by(AttendanceRecord.id.asc()).all()
    )

    for attendance_record in attendance_records:
        target_session.merge(
            AttendanceRecord(
                id=attendance_record.id,
                student_id=attendance_record.student_id,
                status=attendance_record.status,
                marked_at=attendance_record.marked_at,
            )
        )

    return len(attendance_records)


def copy_leave_requests(source_session, target_session):
    leave_requests = source_session.query(LeaveRequest).order_by(LeaveRequest.id.asc()).all()

    for leave_request in leave_requests:
        target_session.merge(
            LeaveRequest(
                id=leave_request.id,
                student_id=leave_request.student_id,
                start_date=leave_request.start_date,
                end_date=leave_request.end_date,
                reason=leave_request.reason,
                status=leave_request.status,
                created_at=leave_request.created_at,
            )
        )

    return len(leave_requests)


def reset_postgres_sequences(target_session):
    table_names = ["students", "attendance_records", "leave_requests"]

    for table_name in table_names:
        target_session.execute(
            text(
                f"""
                SELECT setval(
                    pg_get_serial_sequence('{table_name}', 'id'),
                    COALESCE((SELECT MAX(id) FROM {table_name}), 1),
                    EXISTS (SELECT 1 FROM {table_name})
                )
                """
            )
        )


def main():
    args = parse_args()
    source_url = normalize_database_url(args.source_url)
    target_url = ensure_postgres_url(args.target_url)

    source_engine = build_engine(source_url)
    target_engine = build_engine(target_url)
    SourceSession = sessionmaker(bind=source_engine, autoflush=False, autocommit=False)
    TargetSession = sessionmaker(bind=target_engine, autoflush=False, autocommit=False)

    Base.metadata.create_all(bind=target_engine)

    source_session = SourceSession()
    target_session = TargetSession()

    try:
        students_copied = copy_students(source_session, target_session)
        target_session.flush()
        attendance_copied = copy_attendance_records(source_session, target_session)
        target_session.flush()
        leave_requests_copied = copy_leave_requests(source_session, target_session)
        target_session.flush()
        reset_postgres_sequences(target_session)
        target_session.commit()
    except Exception:
        target_session.rollback()
        raise
    finally:
        source_session.close()
        target_session.close()

    print("SQLite to PostgreSQL migration completed successfully.")
    print(f"Students copied: {students_copied}")
    print(f"Attendance records copied: {attendance_copied}")
    print(f"Leave requests copied: {leave_requests_copied}")


if __name__ == "__main__":
    main()

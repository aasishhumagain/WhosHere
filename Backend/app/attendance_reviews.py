from sqlalchemy.orm import Session

from app.models import AttendanceRecord, AttendanceReviewTrail
from app.time_utils import serialize_local_datetime


def add_attendance_review_entry(
    db: Session,
    *,
    attendance_record: AttendanceRecord | None,
    attendance_record_id: int | None,
    student_id: str,
    student_name: str,
    action: str,
    review_note: str,
    reviewed_by_admin_id: int | None,
    reviewed_by_admin_label: str,
    previous_status: str | None = None,
    next_status: str | None = None,
):
    review_entry = AttendanceReviewTrail(
        attendance_record_id=attendance_record.id if attendance_record else attendance_record_id,
        student_id=str(student_id),
        student_name=student_name,
        action=action.strip().lower(),
        previous_status=previous_status,
        next_status=next_status,
        review_note=review_note.strip(),
        reviewed_by_admin_id=reviewed_by_admin_id,
        reviewed_by_admin_label=reviewed_by_admin_label.strip() or "Unknown admin",
        attendance_marked_at=attendance_record.marked_at if attendance_record else None,
    )
    db.add(review_entry)
    return review_entry


def serialize_attendance_review_entry(review_entry: AttendanceReviewTrail):
    return {
        "id": review_entry.id,
        "attendance_record_id": review_entry.attendance_record_id,
        "student_id": review_entry.student_id,
        "student_name": review_entry.student_name,
        "action": review_entry.action,
        "previous_status": review_entry.previous_status,
        "next_status": review_entry.next_status,
        "review_note": review_entry.review_note,
        "reviewed_by_admin_id": review_entry.reviewed_by_admin_id,
        "reviewed_by_admin_label": review_entry.reviewed_by_admin_label,
        "attendance_marked_at": serialize_local_datetime(review_entry.attendance_marked_at),
        "created_at": serialize_local_datetime(review_entry.created_at),
    }

from datetime import date, datetime, time, timezone

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import AttendanceFallbackRequest
from app.students import get_public_student_id
from app.time_utils import get_local_now, serialize_local_datetime


def build_storage_datetime_for_local_date(attendance_date: date):
    local_timezone = datetime.now().astimezone().tzinfo or timezone.utc

    if attendance_date == get_local_now().date():
        return get_local_now().astimezone(timezone.utc).replace(tzinfo=None)

    local_midday = datetime.combine(attendance_date, time(hour=12), tzinfo=local_timezone)
    return local_midday.astimezone(timezone.utc).replace(tzinfo=None)


def serialize_attendance_fallback_request(fallback_request: AttendanceFallbackRequest):
    return {
        "id": fallback_request.id,
        "student_id": get_public_student_id(fallback_request.student) or str(fallback_request.student_id),
        "student_name": fallback_request.student.full_name if fallback_request.student else "Unknown Student",
        "attendance_date": fallback_request.attendance_date.isoformat(),
        "requested_status": fallback_request.requested_status,
        "issue_type": fallback_request.issue_type,
        "reason": fallback_request.reason,
        "failure_context": fallback_request.failure_context,
        "status": fallback_request.status,
        "admin_note": fallback_request.admin_note,
        "approved_attendance_status": fallback_request.approved_attendance_status,
        "created_at": serialize_local_datetime(fallback_request.created_at),
        "reviewed_at": serialize_local_datetime(fallback_request.reviewed_at),
    }


def get_attendance_fallback_request_or_404(fallback_request_id: int, db: Session):
    fallback_request = (
        db.query(AttendanceFallbackRequest)
        .filter(AttendanceFallbackRequest.id == fallback_request_id)
        .first()
    )

    if not fallback_request:
        raise HTTPException(status_code=404, detail="Fallback attendance request not found.")

    return fallback_request

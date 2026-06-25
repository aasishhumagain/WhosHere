from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import LeaveRequest
from app.students import get_public_student_id


def serialize_leave_request(leave_request: LeaveRequest):
    return {
        "id": leave_request.id,
        "student_id": get_public_student_id(leave_request.student) or str(leave_request.student_id),
        "student_name": leave_request.student.full_name if leave_request.student else "Unknown Student",
        "start_date": leave_request.start_date,
        "end_date": leave_request.end_date,
        "reason": leave_request.reason,
        "status": leave_request.status,
        "created_at": leave_request.created_at,
        "days_requested": (leave_request.end_date - leave_request.start_date).days + 1,
    }


def get_leave_request_or_404(leave_request_id: int, db: Session):
    leave_request = db.query(LeaveRequest).filter(LeaveRequest.id == leave_request_id).first()

    if not leave_request:
        raise HTTPException(status_code=404, detail="Leave request not found.")

    return leave_request

from fastapi import APIRouter, Depends, Form, HTTPException
from sqlalchemy.orm import Session

from app.audit import add_session_audit_log
from app.dependencies import (
    authorize_student_access,
    get_authenticated_session,
    get_db,
    require_admin,
    require_student_session,
)
from app.leave_requests import get_leave_request_or_404, serialize_leave_request
from app.models import LeaveRequest
from app.students import get_student_actor_label, get_student_or_404
from app.validation import parse_iso_date, validate_leave_reason, validate_leave_status

router = APIRouter(tags=["Leave Requests"])


@router.post("/leave-requests", summary="Create leave request")
def create_leave_request(
    student_id: str = Form(...),
    start_date: str = Form(...),
    end_date: str = Form(...),
    reason: str = Form(...),
    db: Session = Depends(get_db),
    student_session: dict = Depends(require_student_session),
):
    student = get_student_or_404(student_id, db)

    if student.id != student_session["student"].id:
        raise HTTPException(status_code=403, detail="You can only create leave requests for your own account.")

    parsed_start_date = parse_iso_date(start_date, "start date")
    parsed_end_date = parse_iso_date(end_date, "end date")

    if parsed_end_date < parsed_start_date:
        raise HTTPException(status_code=400, detail="End date cannot be earlier than start date.")

    leave_request = LeaveRequest(
        student_id=student.id,
        start_date=parsed_start_date,
        end_date=parsed_end_date,
        reason=validate_leave_reason(reason),
        status="pending",
    )

    db.add(leave_request)
    db.commit()
    db.refresh(leave_request)

    add_session_audit_log(
        db=db,
        authenticated_session=student_session,
        action="leave_request_created",
        target_type="leave_request",
        target_id=str(leave_request.id),
        target_label=get_student_actor_label(student),
        details=(
            f"Submitted leave request from {leave_request.start_date.isoformat()} "
            f"to {leave_request.end_date.isoformat()}."
        ),
    )
    db.commit()

    return {
        "message": "Leave request submitted successfully",
        "leave_request": serialize_leave_request(leave_request),
    }


@router.get("/leave-requests", summary="List leave requests")
def get_leave_requests(
    db: Session = Depends(get_db),
    _admin_session: dict = Depends(require_admin),
):
    leave_requests = db.query(LeaveRequest).order_by(LeaveRequest.created_at.desc()).all()
    return [serialize_leave_request(leave_request) for leave_request in leave_requests]


@router.get("/leave-requests/student/{student_id}", summary="Get leave requests for one student")
def get_student_leave_requests(
    student_id: str,
    db: Session = Depends(get_db),
    authenticated_session: dict = Depends(get_authenticated_session),
):
    student = authorize_student_access(student_id, authenticated_session, db)
    leave_requests = (
        db.query(LeaveRequest)
        .filter(LeaveRequest.student_id == student.id)
        .order_by(LeaveRequest.created_at.desc())
        .all()
    )

    return [serialize_leave_request(leave_request) for leave_request in leave_requests]


@router.put("/leave-requests/{leave_request_id}", summary="Update leave request status")
def update_leave_request_status(
    leave_request_id: int,
    status: str = Form(...),
    db: Session = Depends(get_db),
    admin_session: dict = Depends(require_admin),
):
    leave_request = get_leave_request_or_404(leave_request_id, db)
    previous_status = leave_request.status
    leave_request.status = validate_leave_status(status)

    db.commit()
    db.refresh(leave_request)

    add_session_audit_log(
        db=db,
        authenticated_session=admin_session,
        action="leave_request_updated",
        target_type="leave_request",
        target_id=str(leave_request.id),
        target_label=leave_request.student.full_name if leave_request.student else "Unknown Student",
        details=f"Changed leave request status from {previous_status} to {leave_request.status}.",
    )
    db.commit()

    return {
        "message": "Leave request updated successfully",
        "leave_request": serialize_leave_request(leave_request),
    }


@router.delete("/leave-requests/{leave_request_id}", summary="Delete leave request")
def delete_leave_request(
    leave_request_id: int,
    db: Session = Depends(get_db),
    admin_session: dict = Depends(require_admin),
):
    leave_request = get_leave_request_or_404(leave_request_id, db)
    leave_target_label = leave_request.student.full_name if leave_request.student else "Unknown Student"

    db.delete(leave_request)
    db.commit()

    add_session_audit_log(
        db=db,
        authenticated_session=admin_session,
        action="leave_request_deleted",
        target_type="leave_request",
        target_id=str(leave_request_id),
        target_label=leave_target_label,
        details="Deleted a leave request.",
    )
    db.commit()

    return {"message": "Leave request deleted successfully"}

from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import AdminUser, Student
from app.security import extract_bearer_token, verify_session_token
from app.students import get_student_or_404


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_authenticated_session(authorization: str | None = Header(default=None)):
    token = extract_bearer_token(authorization)
    payload = verify_session_token(token)
    payload["token"] = token
    return payload


def require_admin(
    authenticated_session: dict = Depends(get_authenticated_session),
    db: Session = Depends(get_db),
):
    if authenticated_session.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin authentication required.")

    admin_internal_id = authenticated_session.get("sub")

    if not str(admin_internal_id or "").isdigit():
        raise HTTPException(status_code=401, detail="Session is invalid or expired.")

    admin_user = db.query(AdminUser).filter(AdminUser.id == int(admin_internal_id)).first()

    if not admin_user:
        raise HTTPException(status_code=401, detail="Session is invalid or expired.")

    authenticated_session["admin"] = admin_user
    return authenticated_session


def require_student_session(
    authenticated_session: dict = Depends(get_authenticated_session),
    db: Session = Depends(get_db),
):
    if authenticated_session.get("role") != "student":
        raise HTTPException(status_code=403, detail="Student authentication required.")

    student_internal_id = authenticated_session.get("sub")

    if not str(student_internal_id or "").isdigit():
        raise HTTPException(status_code=401, detail="Session is invalid or expired.")

    student = db.query(Student).filter(Student.id == int(student_internal_id)).first()

    if not student:
        raise HTTPException(status_code=401, detail="Session is invalid or expired.")

    authenticated_session["student"] = student
    return authenticated_session


def authorize_student_access(student_id: str | int, authenticated_session: dict, db: Session):
    student = get_student_or_404(student_id, db)

    if authenticated_session.get("role") == "admin":
        return student

    if (
        authenticated_session.get("role") == "student"
        and str(authenticated_session.get("sub")) == str(student.id)
    ):
        return student

    raise HTTPException(status_code=403, detail="You can only access your own student account.")

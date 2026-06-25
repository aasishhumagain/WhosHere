from fastapi import APIRouter, Depends, Form, HTTPException
from sqlalchemy.orm import Session

from app.admins import get_admin_actor_label, get_admin_user_by_username, validate_admin_username
from app.audit import add_audit_log, add_session_audit_log
from app.config import ADMIN_SESSION_TTL_SECONDS, REVOKED_SESSION_TOKENS, STUDENT_SESSION_TTL_SECONDS
from app.dependencies import get_db, require_admin, require_student_session
from app.security import create_session_token, verify_password
from app.storage import build_upload_url
from app.students import get_public_student_id, get_student_actor_label, get_student_by_identifier

router = APIRouter(tags=["Authentication"])


@router.post("/login/admin", summary="Admin login")
def admin_login(
    username: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db),
):
    admin_user = get_admin_user_by_username(username, db)

    if not admin_user or not verify_password(password, admin_user.password):
        add_audit_log(
            db=db,
            actor_type="admin",
            actor_label=validate_admin_username(username) if username and username.strip() else "Unknown admin",
            action="admin_login_failed",
            target_type="session",
            target_label="Admin login",
            details="Invalid admin credentials.",
        )
        db.commit()
        raise HTTPException(status_code=401, detail="Invalid admin credentials")

    token = create_session_token(
        role="admin",
        subject=str(admin_user.id),
        ttl_seconds=ADMIN_SESSION_TTL_SECONDS,
        extra_payload={"username": admin_user.username},
    )

    add_audit_log(
        db=db,
        actor_type="admin",
        actor_id=admin_user.id,
        actor_label=get_admin_actor_label(admin_user),
        action="admin_login",
        target_type="session",
        target_label="Admin login",
        details="Admin login successful.",
    )
    db.commit()

    return {
        "message": "Admin login successful",
        "username": admin_user.username,
        "token": token,
        "expires_in": ADMIN_SESSION_TTL_SECONDS,
    }


@router.post("/logout/admin", summary="Admin logout")
def admin_logout(
    db: Session = Depends(get_db),
    admin_session: dict = Depends(require_admin),
):
    add_session_audit_log(
        db=db,
        authenticated_session=admin_session,
        action="admin_logout",
        target_type="session",
        target_label="Admin logout",
        details="Admin logged out successfully.",
    )
    REVOKED_SESSION_TOKENS.add(admin_session["token"])
    db.commit()
    return {"message": "Admin logged out successfully"}


@router.post("/login/student", summary="Student login")
def student_login(
    student_id: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db),
):
    student = get_student_by_identifier(student_id, db)

    if not student or not verify_password(password, student.password):
        add_audit_log(
            db=db,
            actor_type="student",
            actor_label=(student_id or "").strip() or "Unknown student",
            action="student_login_failed",
            target_type="session",
            target_label="Student login",
            details="Invalid student credentials.",
        )
        db.commit()
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_session_token(
        role="student",
        subject=str(student.id),
        ttl_seconds=STUDENT_SESSION_TTL_SECONDS,
        extra_payload={
            "student_id": get_public_student_id(student),
            "full_name": student.full_name,
        },
    )

    add_audit_log(
        db=db,
        actor_type="student",
        actor_id=student.id,
        actor_label=get_student_actor_label(student),
        action="student_login",
        target_type="session",
        target_label="Student login",
        details="Student login successful.",
    )
    db.commit()

    return {
        "message": "Login successful",
        "student_id": get_public_student_id(student),
        "full_name": student.full_name,
        "email": student.email,
        "phone_number": student.phone_number,
        "role": student.role,
        "face_image_url": build_upload_url(student.face_image_path),
        "created_at": student.created_at,
        "token": token,
        "expires_in": STUDENT_SESSION_TTL_SECONDS,
    }


@router.post("/logout/student", summary="Student logout")
def student_logout(
    db: Session = Depends(get_db),
    student_session: dict = Depends(require_student_session),
):
    add_session_audit_log(
        db=db,
        authenticated_session=student_session,
        action="student_logout",
        target_type="session",
        target_label="Student logout",
        details="Student logged out successfully.",
    )
    REVOKED_SESSION_TOKENS.add(student_session["token"])
    db.commit()
    return {"message": "Student logged out successfully"}

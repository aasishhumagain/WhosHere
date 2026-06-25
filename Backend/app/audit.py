from sqlalchemy.orm import Session

from app.admins import get_admin_actor_label
from app.models import AdminUser, AuditLog, Student
from app.students import get_public_student_id, get_student_actor_label
from app.time_utils import serialize_local_datetime
from app.validation import normalize_optional_text


def get_session_actor_context(authenticated_session: dict, db: Session):
    role = authenticated_session.get("role")
    subject = authenticated_session.get("sub")

    if role == "admin":
        admin_user = authenticated_session.get("admin")

        if not admin_user and str(subject or "").isdigit():
            admin_user = db.query(AdminUser).filter(AdminUser.id == int(subject)).first()

        return {
            "actor_type": "admin",
            "actor_id": admin_user.id if admin_user else int(subject) if str(subject or "").isdigit() else None,
            "actor_label": (
                get_admin_actor_label(admin_user)
                if admin_user
                else authenticated_session.get("username") or "Unknown admin"
            ),
        }

    if role == "student":
        student = authenticated_session.get("student")

        if not student and str(subject or "").isdigit():
            student = db.query(Student).filter(Student.id == int(subject)).first()

        return {
            "actor_type": "student",
            "actor_id": student.id if student else int(subject) if str(subject or "").isdigit() else None,
            "actor_label": (
                get_student_actor_label(student)
                if student
                else authenticated_session.get("full_name")
                or authenticated_session.get("student_id")
                or "Unknown student"
            ),
        }

    return {
        "actor_type": "system",
        "actor_id": None,
        "actor_label": "System",
    }


def add_audit_log(
    db: Session,
    actor_type: str,
    actor_label: str,
    action: str,
    actor_id: int | None = None,
    target_type: str | None = None,
    target_id: str | None = None,
    target_label: str | None = None,
    details: str | None = None,
):
    audit_log = AuditLog(
        actor_type=(actor_type or "system").strip().lower(),
        actor_id=actor_id,
        actor_label=(actor_label or "Unknown actor").strip() or "Unknown actor",
        action=(action or "unknown_action").strip().lower(),
        target_type=normalize_optional_text(target_type),
        target_id=str(target_id).strip() if target_id is not None else None,
        target_label=normalize_optional_text(target_label),
        details=normalize_optional_text(details),
    )
    db.add(audit_log)
    return audit_log


def add_session_audit_log(
    db: Session,
    authenticated_session: dict,
    action: str,
    target_type: str | None = None,
    target_id: str | None = None,
    target_label: str | None = None,
    details: str | None = None,
):
    actor_context = get_session_actor_context(authenticated_session, db)
    return add_audit_log(
        db=db,
        actor_type=actor_context["actor_type"],
        actor_id=actor_context["actor_id"],
        actor_label=actor_context["actor_label"],
        action=action,
        target_type=target_type,
        target_id=target_id,
        target_label=target_label,
        details=details,
    )


def serialize_audit_log(audit_log: AuditLog):
    return {
        "id": audit_log.id,
        "actor_type": audit_log.actor_type,
        "actor_id": audit_log.actor_id,
        "actor_label": audit_log.actor_label,
        "action": audit_log.action,
        "target_type": audit_log.target_type,
        "target_id": audit_log.target_id,
        "target_label": audit_log.target_label,
        "details": audit_log.details,
        "created_at": serialize_local_datetime(audit_log.created_at),
    }

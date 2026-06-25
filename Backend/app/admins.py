from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.config import ADMIN_BOOTSTRAP_PASSWORD, ADMIN_BOOTSTRAP_USERNAME
from app.database import SessionLocal
from app.models import AdminUser
from app.security import hash_password
from app.validation import validate_required_password


def get_bootstrap_admin_password():
    if ADMIN_BOOTSTRAP_PASSWORD.startswith("pbkdf2_sha256$"):
        return ADMIN_BOOTSTRAP_PASSWORD

    return hash_password(validate_required_password(ADMIN_BOOTSTRAP_PASSWORD))


def get_admin_user_by_username(username: str, db: Session):
    normalized_username = (username or "").strip()

    if not normalized_username:
        return None

    return db.query(AdminUser).filter(AdminUser.username == normalized_username).first()


def validate_admin_username(username: str):
    cleaned_username = username.strip()

    if not cleaned_username:
        raise HTTPException(status_code=400, detail="Admin username is required.")

    return cleaned_username


def serialize_admin_user(admin_user: AdminUser):
    return {
        "id": admin_user.id,
        "username": admin_user.username,
        "created_at": admin_user.created_at,
    }


def is_primary_admin(admin_user: AdminUser | None):
    return bool(admin_user and admin_user.username == "admin")


def get_admin_actor_label(admin_user: AdminUser | None):
    if not admin_user:
        return "Unknown admin"

    return admin_user.username


def ensure_bootstrap_admin_user():
    db = SessionLocal()

    try:
        if db.query(AdminUser).count() > 0:
            return

        bootstrap_username = (ADMIN_BOOTSTRAP_USERNAME or "").strip() or "admin"
        bootstrap_admin = AdminUser(
            username=bootstrap_username,
            password=get_bootstrap_admin_password(),
        )
        db.add(bootstrap_admin)
        db.commit()
    finally:
        db.close()

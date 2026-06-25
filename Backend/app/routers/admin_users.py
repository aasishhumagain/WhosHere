from fastapi import APIRouter, Depends, Form, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.admins import (
    get_admin_user_by_username,
    is_primary_admin,
    serialize_admin_user,
    validate_admin_username,
)
from app.audit import add_session_audit_log
from app.dependencies import get_db, require_admin
from app.models import AdminUser
from app.security import hash_password, verify_password
from app.validation import normalize_optional_text, validate_required_password

router = APIRouter(tags=["Admin Users"])


@router.get("/admin-users", summary="List admin users")
def get_admin_users(
    db: Session = Depends(get_db),
    admin_session: dict = Depends(require_admin),
):
    admin_users = db.query(AdminUser).order_by(AdminUser.created_at.asc()).all()

    return {
        "admins": [serialize_admin_user(admin_user) for admin_user in admin_users],
        "current_admin_id": admin_session["admin"].id,
    }


@router.post("/admin-users", summary="Create an admin user")
def create_admin_user(
    username: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db),
    admin_session: dict = Depends(require_admin),
):
    admin_user = AdminUser(
        username=validate_admin_username(username),
        password=hash_password(validate_required_password(password)),
    )

    try:
        db.add(admin_user)
        db.commit()
        db.refresh(admin_user)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Admin username already exists.")

    add_session_audit_log(
        db=db,
        authenticated_session=admin_session,
        action="admin_user_created",
        target_type="admin_user",
        target_id=str(admin_user.id),
        target_label=admin_user.username,
        details="Created a new admin account.",
    )
    db.commit()

    return {
        "message": "Admin account created successfully.",
        "admin": serialize_admin_user(admin_user),
    }


@router.post("/admin-users/change-password", summary="Change the current admin password")
def change_admin_password(
    current_password: str = Form(...),
    new_password: str = Form(...),
    db: Session = Depends(get_db),
    admin_session: dict = Depends(require_admin),
):
    admin_user = admin_session["admin"]
    validated_current_password = validate_required_password(current_password)
    validated_new_password = validate_required_password(new_password)

    if not verify_password(validated_current_password, admin_user.password):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")

    if verify_password(validated_new_password, admin_user.password):
        raise HTTPException(
            status_code=400,
            detail="New password must be different from the current password.",
        )

    admin_user.password = hash_password(validated_new_password)
    db.commit()

    add_session_audit_log(
        db=db,
        authenticated_session=admin_session,
        action="admin_password_changed",
        target_type="admin_user",
        target_id=str(admin_user.id),
        target_label=admin_user.username,
        details="Changed the current admin password.",
    )
    db.commit()

    return {"message": "Admin password changed successfully."}


@router.put("/admin-users/{admin_user_id}", summary="Update an admin user")
def update_admin_user(
    admin_user_id: int,
    username: str = Form(...),
    password: str = Form(None),
    db: Session = Depends(get_db),
    admin_session: dict = Depends(require_admin),
):
    current_admin = admin_session["admin"]

    if not is_primary_admin(current_admin):
        raise HTTPException(
            status_code=403,
            detail="Only the admin account can edit other admin accounts.",
        )

    admin_user = db.query(AdminUser).filter(AdminUser.id == admin_user_id).first()

    if not admin_user:
        raise HTTPException(status_code=404, detail="Admin user not found.")

    if is_primary_admin(admin_user):
        raise HTTPException(
            status_code=403,
            detail="The protected admin username cannot be edited from this tool.",
        )

    admin_user.username = validate_admin_username(username)
    normalized_password = normalize_optional_text(password)

    if normalized_password:
        admin_user.password = hash_password(validate_required_password(normalized_password))

    try:
        db.commit()
        db.refresh(admin_user)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Admin username already exists.")

    add_session_audit_log(
        db=db,
        authenticated_session=admin_session,
        action="admin_user_updated",
        target_type="admin_user",
        target_id=str(admin_user.id),
        target_label=admin_user.username,
        details=(
            "Updated admin username and password."
            if normalized_password
            else "Updated admin username."
        ),
    )
    db.commit()

    return {
        "message": "Admin account updated successfully.",
        "admin": serialize_admin_user(admin_user),
    }


@router.delete("/admin-users/{admin_user_id}", summary="Delete an admin user")
def delete_admin_user(
    admin_user_id: int,
    db: Session = Depends(get_db),
    admin_session: dict = Depends(require_admin),
):
    current_admin = admin_session["admin"]

    if not is_primary_admin(current_admin):
        raise HTTPException(
            status_code=403,
            detail="Only the admin account can delete other admin accounts.",
        )

    admin_user = db.query(AdminUser).filter(AdminUser.id == admin_user_id).first()

    if not admin_user:
        raise HTTPException(status_code=404, detail="Admin user not found.")

    if is_primary_admin(admin_user):
        raise HTTPException(
            status_code=403,
            detail="The admin account cannot be deleted.",
        )

    deleted_admin = serialize_admin_user(admin_user)
    deleted_admin_username = admin_user.username
    db.delete(admin_user)
    db.commit()

    add_session_audit_log(
        db=db,
        authenticated_session=admin_session,
        action="admin_user_deleted",
        target_type="admin_user",
        target_id=str(deleted_admin["id"]),
        target_label=deleted_admin_username,
        details="Deleted an admin account.",
    )
    db.commit()

    return {
        "message": "Admin account deleted successfully.",
        "admin": deleted_admin,
    }

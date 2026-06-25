from datetime import date, datetime, timezone

from fastapi import HTTPException

from app.config import ATTENDANCE_STATUSES, LEAVE_REQUEST_STATUSES


def normalize_optional_text(value: str | None):
    if value is None:
        return None

    value = value.strip()
    return value or None


def validate_full_name(full_name: str):
    cleaned_name = full_name.strip()

    if not cleaned_name:
        raise HTTPException(status_code=400, detail="Full name is required.")

    return cleaned_name


def validate_student_role(role: str | None):
    normalized_role = normalize_optional_text(role)

    if not normalized_role:
        return "Student"

    lowered_role = normalized_role.lower()

    if lowered_role == "student":
        return "Student"

    if lowered_role == "staff":
        return "Staff"

    raise HTTPException(
        status_code=400,
        detail="Role must be either Student or Staff.",
    )


def validate_required_password(password: str):
    cleaned_password = password.strip()

    if not cleaned_password:
        raise HTTPException(status_code=400, detail="Password is required.")

    return cleaned_password


def validate_attendance_status(status: str):
    cleaned_status = status.strip().lower()

    if cleaned_status not in ATTENDANCE_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Attendance status must be one of: {', '.join(sorted(ATTENDANCE_STATUSES))}.",
        )

    return cleaned_status


def validate_leave_status(status: str):
    cleaned_status = status.strip().lower()

    if cleaned_status not in LEAVE_REQUEST_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Leave status must be one of: {', '.join(sorted(LEAVE_REQUEST_STATUSES))}.",
        )

    return cleaned_status


def validate_leave_reason(reason: str):
    cleaned_reason = reason.strip()

    if not cleaned_reason:
        raise HTTPException(status_code=400, detail="Leave reason is required.")

    return cleaned_reason


def parse_iso_date(value: str, field_name: str):
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid {field_name}. Use YYYY-MM-DD format.",
        ) from exc


def parse_iso_datetime(value: str, field_name: str):
    normalized_value = (value or "").strip()

    if not normalized_value:
        raise HTTPException(
            status_code=400,
            detail=f"{field_name} is required.",
        )

    try:
        parsed_value = datetime.fromisoformat(normalized_value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid {field_name}. Use ISO-8601 date-time format.",
        ) from exc

    if parsed_value.tzinfo is None:
        parsed_value = parsed_value.replace(tzinfo=timezone.utc)

    return parsed_value.astimezone(timezone.utc)

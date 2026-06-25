from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.audit import serialize_audit_log
from app.dependencies import get_db, require_admin
from app.models import AuditLog
from app.time_utils import get_day_bounds
from app.validation import normalize_optional_text, parse_iso_date

router = APIRouter(tags=["Audit Logs"])


@router.get("/audit-logs", summary="List audit logs")
def get_audit_logs(
    search: str | None = Query(default=None),
    actor_type: str | None = Query(default=None),
    action: str | None = Query(default=None),
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
    db: Session = Depends(get_db),
    _admin_session: dict = Depends(require_admin),
):
    query = db.query(AuditLog)

    normalized_actor_type = normalize_optional_text(actor_type)
    normalized_action = normalize_optional_text(action)

    if normalized_actor_type and normalized_actor_type.lower() != "all":
        query = query.filter(AuditLog.actor_type == normalized_actor_type.lower())

    if normalized_action and normalized_action.lower() != "all":
        query = query.filter(AuditLog.action == normalized_action.lower())

    if date_from:
        parsed_date_from = parse_iso_date(date_from, "start date")
        day_start, _ = get_day_bounds(parsed_date_from)
        query = query.filter(AuditLog.created_at >= day_start)

    if date_to:
        parsed_date_to = parse_iso_date(date_to, "end date")
        _, next_day_start = get_day_bounds(parsed_date_to)
        query = query.filter(AuditLog.created_at < next_day_start)

    logs = query.order_by(AuditLog.created_at.desc(), AuditLog.id.desc()).all()
    normalized_search = (search or "").strip().lower()

    if normalized_search:
        filtered_logs = []

        for audit_log in logs:
            haystack = " ".join(
                [
                    audit_log.actor_type or "",
                    audit_log.actor_label or "",
                    audit_log.action or "",
                    audit_log.target_type or "",
                    audit_log.target_id or "",
                    audit_log.target_label or "",
                    audit_log.details or "",
                ]
            ).lower()

            if normalized_search in haystack:
                filtered_logs.append(audit_log)

        logs = filtered_logs

    return [serialize_audit_log(audit_log) for audit_log in logs]

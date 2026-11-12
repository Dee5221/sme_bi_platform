"""Owner-only, append-only activity log. Records cannot be edited or deleted."""
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import require_permission
from app.models.user import User
from app.schemas.audit import AuditLogEntry, AuditLogListResponse
from app.services.audit import MUTATION_DETAIL, RETENTION_DAYS, list_audit_logs

router = APIRouter(prefix="/api/audit-logs", tags=["Audit"])

LOCKED_NOTE = (
    f"Events are tenant-scoped, append-only, and shown for the last {RETENTION_DAYS} days. "
    "Passwords, tokens, and credentials are never stored."
)


def _entry(event) -> AuditLogEntry:
    actor = event.actor
    return AuditLogEntry(
        id=event.id,
        action=event.action,
        entity=event.target_entity,
        entity_id=event.target_id,
        result=event.result,
        metadata=event.event_metadata,
        created_at=event.created_at,
        actor_name=actor.name if actor else "Unknown",
        actor_email=actor.email if actor else None,
    )


@router.get("/", response_model=AuditLogListResponse)
def get_audit_logs(
    search: Optional[str] = Query(default=None),
    action: Optional[str] = Query(default=None),
    entity: Optional[str] = Query(default=None),
    result: Optional[str] = Query(default=None),
    start_date: Optional[date] = Query(default=None),
    end_date: Optional[date] = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("audit.view")),
):
    payload = list_audit_logs(
        db,
        business_id=current_user.business_id,
        search=search,
        action=action,
        entity=entity,
        result=result,
        start_date=start_date,
        end_date=end_date,
        page=page,
        page_size=page_size,
    )
    return {
        "items": [_entry(event) for event in payload["items"]],
        "filters": payload["filters"],
        "pagination": payload["pagination"],
        "retention_days": payload["retention_days"],
        "note": LOCKED_NOTE,
    }


@router.put("/{event_id}")
@router.patch("/{event_id}")
@router.delete("/{event_id}")
def reject_audit_mutation(
    event_id: int,
    current_user: User = Depends(require_permission("audit.view")),
):
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=MUTATION_DETAIL)

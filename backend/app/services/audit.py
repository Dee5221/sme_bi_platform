"""Append-only audit events. Callers commit with the business transaction unless commit=True."""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from math import ceil
from typing import Optional

from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.core.security import sanitize_audit_metadata
from app.models.audit_log import AuditLog
from app.models.user import User

RETENTION_DAYS = 365
MUTATION_DETAIL = "Audit records cannot be modified or deleted"


def record_audit(
    db: Session,
    *,
    action: str,
    target_entity: str,
    result: str = "success",
    business_id: Optional[int] = None,
    actor_user_id: Optional[int] = None,
    target_id: Optional[str] = None,
    metadata: Optional[dict] = None,
    commit: bool = False,
) -> AuditLog:
    event = AuditLog(
        business_id=business_id,
        actor_user_id=actor_user_id,
        action=action,
        target_entity=target_entity,
        target_id=str(target_id) if target_id is not None else None,
        result=result,
        event_metadata=sanitize_audit_metadata(metadata),
    )
    db.add(event)
    if commit:
        db.commit()
        db.refresh(event)
    return event


def audit_actor(
    db: Session,
    actor,
    *,
    action: str,
    entity: str,
    target_id=None,
    result: str = "success",
    metadata: Optional[dict] = None,
    commit: bool = False,
) -> AuditLog:
    return record_audit(
        db,
        action=action,
        target_entity=entity,
        result=result,
        business_id=getattr(actor, "business_id", None),
        actor_user_id=getattr(actor, "id", None),
        target_id=target_id,
        metadata=metadata,
        commit=commit,
    )


def list_audit_logs(
    db: Session,
    *,
    business_id: int,
    search: Optional[str] = None,
    action: Optional[str] = None,
    entity: Optional[str] = None,
    result: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    page: int = 1,
    page_size: int = 20,
) -> dict:
    page = max(1, page)
    page_size = min(max(1, page_size), 100)

    query = (
        db.query(AuditLog)
        .options(joinedload(AuditLog.actor))
        .outerjoin(User, AuditLog.actor_user_id == User.id)
        .filter(AuditLog.business_id == business_id)
    )

    horizon = datetime.now(timezone.utc) - timedelta(days=RETENTION_DAYS)
    query = query.filter(AuditLog.created_at >= horizon)

    if search:
        like = f"%{search.strip()}%"
        query = query.filter(
            or_(
                AuditLog.action.ilike(like),
                AuditLog.target_entity.ilike(like),
                AuditLog.target_id.ilike(like),
                AuditLog.result.ilike(like),
                User.name.ilike(like),
                User.email.ilike(like),
            )
        )
    if action:
        query = query.filter(AuditLog.action == action)
    if entity:
        query = query.filter(AuditLog.target_entity == entity)
    if result:
        query = query.filter(AuditLog.result == result)
    if start_date:
        query = query.filter(AuditLog.created_at >= datetime.combine(start_date, datetime.min.time()))
    if end_date:
        query = query.filter(AuditLog.created_at <= datetime.combine(end_date, datetime.max.time()))

    total = query.order_by(None).count()
    rows = (
        query.order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    actions = sorted(
        value
        for (value,) in db.query(AuditLog.action)
        .filter(AuditLog.business_id == business_id, AuditLog.created_at >= horizon)
        .distinct()
        if value
    )
    entities = sorted(
        value
        for (value,) in db.query(AuditLog.target_entity)
        .filter(AuditLog.business_id == business_id, AuditLog.created_at >= horizon)
        .distinct()
        if value
    )

    return {
        "items": rows,
        "filters": {"actions": actions, "entities": entities},
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": max(1, ceil(total / page_size)) if total else 1,
        },
        "retention_days": RETENTION_DAYS,
    }

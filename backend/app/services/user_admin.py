"""Owner-only employee account operations. Tenant-scoped to the actor's business."""
from __future__ import annotations

from math import ceil
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from app.core.permissions import (
    ASSIGNABLE_EMPLOYEE_ROLES,
    ROLE_DESCRIPTIONS,
    canonical_role_name,
    get_user_role_name,
)
from app.core.security import get_password_hash
from app.core.token_store import bump_user_token_version
from app.models.audit_log import AuditLog
from app.models.role import Role
from app.models.user import User
from app.services.audit import record_audit

ALLOWED_STATUSES = frozenset({"active", "inactive", "suspended"})
LAST_OWNER_DETAIL = "The last active Business Owner cannot be removed or demoted"


def _role_name(role: Role | None) -> str | None:
    if role is None:
        return None
    return canonical_role_name(role.role_name)


def get_role_or_404(db: Session, role_id: int) -> Role:
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")
    return role


def require_assignable_employee_role(role: Role) -> str:
    role_name = _role_name(role)
    if role_name not in ASSIGNABLE_EMPLOYEE_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to assign this role",
        )
    return role_name or ""


def tenant_user_or_404(db: Session, business_id: int, user_id: int) -> User:
    user = (
        db.query(User)
        .options(joinedload(User.role))
        .filter(User.id == user_id, User.business_id == business_id)
        .first()
    )
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


def email_taken(db: Session, business_id: int, email: str, exclude_user_id: Optional[int] = None) -> bool:
    query = db.query(User).filter(
        User.business_id == business_id,
        func.lower(User.email) == email.lower(),
    )
    if exclude_user_id is not None:
        query = query.filter(User.id != exclude_user_id)
    return query.first() is not None


def active_owner_count(db: Session, business_id: int, exclude_user_id: Optional[int] = None) -> int:
    users = (
        db.query(User)
        .options(joinedload(User.role))
        .filter(User.business_id == business_id, User.status == "active")
    )
    if exclude_user_id is not None:
        users = users.filter(User.id != exclude_user_id)
    return sum(1 for user in users if get_user_role_name(user) == "Business Owner")


def prevent_last_owner_loss(db: Session, target: User, *, next_status: str, next_role: Role | None) -> None:
    if get_user_role_name(target) != "Business Owner":
        return
    losing_owner = next_status != "active" or (
        next_role is not None and _role_name(next_role) != "Business Owner"
    )
    if losing_owner and active_owner_count(db, target.business_id, exclude_user_id=target.id) < 1:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=LAST_OWNER_DETAIL)


def list_assignable_roles(db: Session) -> list[dict]:
    roles = db.query(Role).order_by(Role.id.asc()).all()
    items = []
    for role in roles:
        name = _role_name(role)
        if name not in ASSIGNABLE_EMPLOYEE_ROLES:
            continue
        items.append(
            {
                "id": role.id,
                "role_name": name,
                "description": ROLE_DESCRIPTIONS.get(name or "", None),
            }
        )
    return items


def list_users(
    db: Session,
    *,
    business_id: int,
    search: Optional[str] = None,
    status_filter: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
) -> dict:
    page = max(1, page)
    page_size = min(max(1, page_size), 100)

    query = (
        db.query(User)
        .options(joinedload(User.role))
        .filter(User.business_id == business_id)
    )
    if search:
        like = f"%{search.strip()}%"
        query = query.filter(or_(User.name.ilike(like), User.email.ilike(like)))
    if status_filter:
        normalized = status_filter.strip().lower()
        if normalized not in {"", "all"}:
            if normalized not in ALLOWED_STATUSES:
                raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid status filter")
            query = query.filter(User.status == normalized)

    total = query.order_by(None).count()
    items = (
        query.order_by(User.id.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    total_pages = max(1, ceil(total / page_size)) if total else 1
    return {
        "items": items,
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": total_pages,
        },
    }


def create_employee(
    db: Session,
    *,
    actor: User,
    name: str,
    email: str,
    password: str,
    role_id: int,
) -> User:
    if email_taken(db, actor.business_id, email):
        raise HTTPException(status_code=409, detail="Email already registered in this business")

    role = get_role_or_404(db, role_id)
    role_name = require_assignable_employee_role(role)

    user = User(
        business_id=actor.business_id,
        role_id=role.id,
        name=name.strip(),
        email=email.lower(),
        password_hash=get_password_hash(password),
        status="active",
    )
    db.add(user)
    db.flush()
    record_audit(
        db,
        business_id=actor.business_id,
        actor_user_id=actor.id,
        action="user.create",
        target_entity="user",
        target_id=str(user.id),
        metadata={"email": user.email, "role": role_name, "name": user.name},
    )
    db.commit()
    return (
        db.query(User)
        .options(joinedload(User.role))
        .filter(User.id == user.id)
        .one()
    )


def update_employee(
    db: Session,
    *,
    actor: User,
    target: User,
    name: Optional[str] = None,
    email: Optional[str] = None,
    role_id: Optional[int] = None,
    status_value: Optional[str] = None,
) -> User:
    changes: dict = {}
    next_role = target.role
    next_status = target.status

    if name is not None and name.strip() != target.name:
        changes["name"] = {"from": target.name, "to": name.strip()}
        target.name = name.strip()

    if email is not None and email.lower() != target.email.lower():
        if email_taken(db, actor.business_id, email, exclude_user_id=target.id):
            raise HTTPException(status_code=409, detail="Email already registered in this business")
        changes["email"] = {"from": target.email, "to": email.lower()}
        target.email = email.lower()

    if role_id is not None and role_id != target.role_id:
        next_role = get_role_or_404(db, role_id)
        new_role_name = require_assignable_employee_role(next_role)
        changes["role"] = {
            "from": get_user_role_name(target),
            "to": new_role_name,
        }

    if status_value is not None:
        normalized = status_value.strip().lower()
        if normalized not in ALLOWED_STATUSES:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid status")
        if target.id == actor.id and normalized != "active":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You cannot deactivate your own account",
            )
        if normalized != target.status:
            next_status = normalized
            changes["status"] = {"from": target.status, "to": normalized}

    if "role" in changes or "status" in changes:
        prevent_last_owner_loss(db, target, next_status=next_status, next_role=next_role)

    if "role" in changes and next_role is not None:
        target.role_id = next_role.id
    if "status" in changes:
        target.status = next_status
        if next_status != "active":
            bump_user_token_version(target.id)

    if changes:
        action = "user.update"
        if list(changes.keys()) == ["status"] and changes["status"]["to"] == "inactive":
            action = "user.deactivate"
        elif list(changes.keys()) == ["status"] and changes["status"]["to"] == "active":
            action = "user.activate"
        elif "role" in changes:
            action = "user.role_change" if list(changes.keys()) == ["role"] else "user.update"
        record_audit(
            db,
            business_id=actor.business_id,
            actor_user_id=actor.id,
            action=action,
            target_entity="user",
            target_id=str(target.id),
            metadata=changes,
        )

    db.commit()
    return tenant_user_or_404(db, actor.business_id, target.id)


def deactivate_employee(db: Session, *, actor: User, target: User) -> User:
    if target.id == actor.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot deactivate your own account",
        )
    if target.status != "active":
        return target
    prevent_last_owner_loss(db, target, next_status="inactive", next_role=target.role)
    target.status = "inactive"
    bump_user_token_version(target.id)
    record_audit(
        db,
        business_id=actor.business_id,
        actor_user_id=actor.id,
        action="user.deactivate",
        target_entity="user",
        target_id=str(target.id),
        metadata={"email": target.email},
    )
    db.commit()
    return tenant_user_or_404(db, actor.business_id, target.id)


def reset_employee_password(db: Session, *, actor: User, target: User, new_password: str) -> None:
    if target.id == actor.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Use profile settings to change your own password",
        )
    target.password_hash = get_password_hash(new_password)
    bump_user_token_version(target.id)
    record_audit(
        db,
        business_id=actor.business_id,
        actor_user_id=actor.id,
        action="user.password_reset",
        target_entity="user",
        target_id=str(target.id),
        metadata={"email": target.email},
    )
    db.commit()


def recent_user_activity(db: Session, *, business_id: int, user_id: int, limit: int = 20) -> list[AuditLog]:
    return (
        db.query(AuditLog)
        .options(joinedload(AuditLog.actor))
        .filter(
            AuditLog.business_id == business_id,
            AuditLog.target_entity == "user",
            AuditLog.target_id == str(user_id),
        )
        .order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
        .limit(limit)
        .all()
    )

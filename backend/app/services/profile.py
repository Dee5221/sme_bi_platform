"""Self-service profile updates for the signed-in user."""
from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.core.permissions import get_user_role_name, permissions_for_user
from app.core.security import create_access_token, get_password_hash, verify_password
from app.core.token_store import bump_user_token_version
from app.models.user import User
from app.schemas.user import RoleResponse
from app.services.audit import record_audit
from app.services.user_admin import email_taken


def split_name(name: str | None) -> tuple[str, str]:
    parts = (name or "").strip().split(None, 1)
    if not parts:
        return "", ""
    if len(parts) == 1:
        return parts[0], ""
    return parts[0], parts[1]


def compose_name(first_name: str, last_name: str) -> str:
    return " ".join(part for part in (first_name.strip(), last_name.strip()) if part)


def profile_payload(user: User) -> dict:
    first_name, last_name = split_name(user.name)
    role = RoleResponse.model_validate(user.role) if user.role else RoleResponse(id=0, role_name="")
    return {
        "id": user.id,
        "business_id": user.business_id,
        "name": user.name,
        "first_name": first_name,
        "last_name": last_name,
        "email": user.email,
        "status": user.status,
        "role": role,
        "roles": [role] if role.id else [],
        "permissions": permissions_for_user(user),
    }


def reload_user(db: Session, user_id: int) -> User:
    return (
        db.query(User)
        .options(joinedload(User.role))
        .filter(User.id == user_id)
        .one()
    )


def update_own_profile(
    db: Session,
    *,
    actor: User,
    first_name: str,
    last_name: str,
    email: str,
) -> User:
    name = compose_name(first_name, last_name)
    changes: dict = {}

    if name != actor.name:
        changes["name"] = {"from": actor.name, "to": name}
        actor.name = name

    if email.lower() != actor.email.lower():
        if email_taken(db, actor.business_id, email, exclude_user_id=actor.id):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already registered in this business",
            )
        changes["email"] = {"from": actor.email, "to": email.lower()}
        actor.email = email.lower()

    if changes:
        record_audit(
            db,
            business_id=actor.business_id,
            actor_user_id=actor.id,
            action="profile.update",
            target_entity="user",
            target_id=str(actor.id),
            metadata=changes,
        )

    db.commit()
    return reload_user(db, actor.id)


def change_own_password(
    db: Session,
    *,
    actor: User,
    current_password: str,
    new_password: str,
) -> str:
    if not verify_password(current_password, actor.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )
    if current_password == new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from the current password",
        )

    actor.password_hash = get_password_hash(new_password)
    bump_user_token_version(actor.id)
    record_audit(
        db,
        business_id=actor.business_id,
        actor_user_id=actor.id,
        action="profile.password_change",
        target_entity="user",
        target_id=str(actor.id),
        metadata={"email": actor.email},
    )
    db.commit()
    return create_access_token(data={"sub": str(actor.id)})

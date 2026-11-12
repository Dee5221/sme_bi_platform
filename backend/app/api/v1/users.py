from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import require_permission
from app.models.user import User
from app.schemas.user import (
    AssignableRoleResponse,
    PasswordResetRequest,
    UserActivityEntry,
    UserCreate,
    UserDetailResponse,
    UserListResponse,
    UserResponse,
    UserUpdate,
)
from app.services import user_admin

router = APIRouter(prefix="/api/users", tags=["Users"])


def _user_response(user: User) -> UserResponse:
    return UserResponse.model_validate(user)


@router.get("/roles", response_model=list[AssignableRoleResponse])
def list_assignable_roles(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("users.view")),
):
    return user_admin.list_assignable_roles(db)


@router.get("/", response_model=UserListResponse)
def list_users(
    search: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("users.view")),
):
    result = user_admin.list_users(
        db,
        business_id=current_user.business_id,
        search=search,
        status_filter=status_filter,
        page=page,
        page_size=page_size,
    )
    return {
        "items": [_user_response(item) for item in result["items"]],
        "pagination": result["pagination"],
    }


@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    user_in: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("users.manage")),
):
    return _user_response(
        user_admin.create_employee(
            db,
            actor=current_user,
            name=user_in.name,
            email=str(user_in.email),
            password=user_in.password,
            role_id=user_in.role_id,
        )
    )


@router.get("/{user_id}", response_model=UserDetailResponse)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("users.view")),
):
    target = user_admin.tenant_user_or_404(db, current_user.business_id, user_id)
    events = user_admin.recent_user_activity(
        db, business_id=current_user.business_id, user_id=target.id
    )
    activity = [
        UserActivityEntry(
            id=event.id,
            action=event.action,
            entity=event.target_entity,
            entity_id=event.target_id,
            result=event.result,
            created_at=event.created_at,
            actor_name=event.actor.name if event.actor else "Unknown",
            actor_email=event.actor.email if event.actor else None,
        )
        for event in events
    ]
    return UserDetailResponse(user=_user_response(target), recent_activity=activity)


@router.patch("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    user_in: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("users.manage")),
):
    target = user_admin.tenant_user_or_404(db, current_user.business_id, user_id)
    updated = user_admin.update_employee(
        db,
        actor=current_user,
        target=target,
        name=user_in.name,
        email=str(user_in.email) if user_in.email is not None else None,
        role_id=user_in.role_id,
        status_value=user_in.status,
    )
    return _user_response(updated)


@router.delete("/{user_id}", response_model=UserResponse)
def deactivate_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("users.manage")),
):
    target = user_admin.tenant_user_or_404(db, current_user.business_id, user_id)
    return _user_response(user_admin.deactivate_employee(db, actor=current_user, target=target))


@router.post("/{user_id}/reset-password")
def reset_password(
    user_id: int,
    payload: PasswordResetRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("users.manage")),
):
    target = user_admin.tenant_user_or_404(db, current_user.business_id, user_id)
    user_admin.reset_employee_password(
        db,
        actor=current_user,
        target=target,
        new_password=payload.new_password,
    )
    return {"message": "Password reset"}

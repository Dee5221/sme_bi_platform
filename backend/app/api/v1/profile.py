from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.api.v1.auth import set_auth_cookie
from app.core.database import get_db
from app.core.dependencies import require_permission
from app.models.user import User
from app.schemas.profile import (
    ProfileEnvelope,
    ProfilePasswordChangeRequest,
    ProfilePasswordChangeResponse,
    ProfileUpdateRequest,
    ProfileUserResponse,
)
from app.services import profile as profile_service

router = APIRouter(prefix="/api", tags=["Profile"])


def _envelope(user: User) -> ProfileEnvelope:
    return ProfileEnvelope(user=ProfileUserResponse.model_validate(profile_service.profile_payload(user)))


@router.get("/profile", response_model=ProfileEnvelope)
def get_profile(current_user: User = Depends(require_permission("profile.manage"))):
    return _envelope(current_user)


@router.put("/profile", response_model=ProfileEnvelope)
def update_profile(
    payload: ProfileUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("profile.manage")),
):
    updated = profile_service.update_own_profile(
        db,
        actor=current_user,
        first_name=payload.first_name,
        last_name=payload.last_name,
        email=payload.email,
    )
    return _envelope(updated)


@router.put("/profile/password", response_model=ProfilePasswordChangeResponse)
def change_password(
    payload: ProfilePasswordChangeRequest,
    response: Response,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("profile.manage")),
):
    token = profile_service.change_own_password(
        db,
        actor=current_user,
        current_password=payload.current_password,
        new_password=payload.new_password,
    )
    set_auth_cookie(response, token)
    return ProfilePasswordChangeResponse(password_changed=True, access_token=token)


@router.post("/profile/avatar")
def upload_avatar(current_user: User = Depends(require_permission("profile.manage"))):
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Profile photos are not stored in this version",
    )

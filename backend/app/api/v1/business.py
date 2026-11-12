"""Owner-only business profile used for receipts, reports, and workspace identity."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import require_permission
from app.models.business import Business
from app.models.user import User
from app.schemas.business import BusinessSettingsResponse, BusinessSettingsUpdate
from app.services.audit import audit_actor

router = APIRouter(prefix="/api", tags=["Business"])


def _current_business(db: Session, current_user: User) -> Business:
    business = db.query(Business).filter(Business.id == current_user.business_id).first()
    if not business:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")
    return business


@router.get("/business", response_model=BusinessSettingsResponse)
@router.get("/business/", response_model=BusinessSettingsResponse)
def get_business_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("business.settings.manage")),
):
    return _current_business(db, current_user)


@router.patch("/business", response_model=BusinessSettingsResponse)
@router.patch("/business/", response_model=BusinessSettingsResponse)
@router.put("/business", response_model=BusinessSettingsResponse)
@router.put("/business/", response_model=BusinessSettingsResponse)
def update_business_settings(
    payload: BusinessSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("business.settings.manage")),
):
    business = _current_business(db, current_user)
    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        return business

    changes: dict = {}
    for field, value in updates.items():
        previous = getattr(business, field)
        if str(previous or "") == str(value or ""):
            continue
        changes[field] = {"from": previous, "to": value}
        setattr(business, field, value)

    if changes:
        audit_actor(
            db,
            current_user,
            action="business.settings.update",
            entity="business",
            target_id=business.id,
            metadata={"changes": {key: {"from": item["from"], "to": item["to"]} for key, item in changes.items()}},
        )
        db.commit()
        db.refresh(business)
    return business

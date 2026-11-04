"""
F11 Decision Support & Recommendations — API endpoint.

GET /api/recommendations
Authenticated. Business-scoped. Advisory only.
"""
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.recommendations import RecommendationsResponse
from app.services.recommendations import generate_recommendations

router = APIRouter(prefix="/api/recommendations", tags=["Recommendations"])


@router.get("", response_model=RecommendationsResponse)
def get_recommendations(
    categories: Optional[str] = Query(
        None,
        description="Comma-separated category filter: inventory,sales,expenses",
    ),
    severity: Optional[str] = Query(
        None,
        description="Minimum severity: CRITICAL, HIGH, MEDIUM, LOW, INFO",
    ),
    months: int = Query(
        6,
        ge=3,
        le=12,
        description="Number of complete calendar months to analyse",
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Generate advisory decision-support recommendations.

    - Business isolation: derived from the authenticated user's business_id.
    - Role filtering: Staff receives inventory recommendations only.
    - Recommendations never modify business records.
    """
    business_id = current_user.business_id
    role_name = current_user.role.role_name if current_user.role else "Staff"

    category_list = None
    if categories:
        category_list = [c.strip().lower() for c in categories.split(",") if c.strip()]

    result = generate_recommendations(
        db=db,
        business_id=business_id,
        months=months,
        categories=category_list,
        severity_filter=severity,
        role_name=role_name,
    )

    return result
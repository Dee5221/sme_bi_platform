"""
Backend-driven PDF reports. Scoped to the authenticated business.
"""
from datetime import date
from io import BytesIO
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.v1.forecasting import get_forecasting
from app.core.database import get_db
from app.core.dependencies import FORBIDDEN_DETAIL, require_permission
from app.core.permissions import has_permission
from app.models.user import User
from app.services.pdf_reports import (
    business_summary_pdf,
    expenses_pdf,
    forecast_recommendations_pdf,
    gross_profit_pdf,
    inventory_pdf,
    product_performance_pdf,
    sales_pdf,
)
from app.services.audit import audit_actor
from app.services.recommendations import generate_recommendations
from app.services.report_data import (
    REPORT_TYPES,
    business_profile,
    expenses_dataset,
    gross_profit_dataset,
    inventory_dataset,
    product_performance_dataset,
    resolve_report_dates,
    sales_dataset,
)

router = APIRouter(prefix="/api/reports", tags=["Reports"])


def _slug(value: str) -> str:
    cleaned = "".join(ch.lower() if ch.isalnum() else "-" for ch in value)
    return "-".join(part for part in cleaned.split("-") if part)[:60] or "report"


def _pdf_response(content: bytes, filename: str) -> StreamingResponse:
    headers = {
        "Content-Disposition": f'attachment; filename="{filename}"',
        "Cache-Control": "no-store",
    }
    return StreamingResponse(BytesIO(content), media_type="application/pdf", headers=headers)


@router.get("/types")
def list_report_types(
    current_user: User = Depends(require_permission("reports.generate")),
):
    include_profit = has_permission(current_user, "products.costs.view")
    types = []
    for key, title in REPORT_TYPES.items():
        if key == "gross_profit" and not include_profit:
            continue
        types.append({"id": key, "title": title})
    return {"types": types}


@router.get("/{report_type}")
def generate_report(
    report_type: str,
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("reports.generate")),
):
    if report_type not in REPORT_TYPES:
        raise HTTPException(status_code=422, detail="Unknown report type")
    try:
        start, end = resolve_report_dates(start_date, end_date)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    include_costs = has_permission(current_user, "products.costs.view")
    if report_type == "gross_profit" and not include_costs:
        audit_actor(
            db,
            current_user,
            action="authz.denied",
            entity="report",
            target_id=report_type,
            result="denied",
            metadata={"permission": "products.costs.view", "report_type": report_type},
            commit=True,
        )
        raise HTTPException(status_code=403, detail=FORBIDDEN_DETAIL)

    business = business_profile(db, current_user.business_id)
    filename = f"{_slug(business['name'])}-{report_type}-{start.isoformat()}-to-{end.isoformat()}.pdf"

    if report_type == "sales":
        pdf = sales_pdf(business, start, end, sales_dataset(db, current_user.business_id, start, end))
    elif report_type == "product_performance":
        pdf = product_performance_pdf(
            business, start, end, product_performance_dataset(db, current_user.business_id, start, end)
        )
    elif report_type == "inventory":
        pdf = inventory_pdf(business, start, end, inventory_dataset(db, current_user.business_id, include_costs))
    elif report_type == "expenses":
        pdf = expenses_pdf(business, start, end, expenses_dataset(db, current_user.business_id, start, end))
    elif report_type == "gross_profit":
        pdf = gross_profit_pdf(
            business, start, end, gross_profit_dataset(db, current_user.business_id, start, end)
        )
    elif report_type == "forecast_recommendations":
        forecast_payload = _forecast_payload(db, current_user)
        recs = generate_recommendations(
            db=db,
            business_id=current_user.business_id,
            months=6,
            role_name=current_user.role.role_name if current_user.role else "Staff",
            include_profit=include_costs,
        )
        pdf = forecast_recommendations_pdf(business, start, end, forecast_payload, recs)
    else:
        pdf = business_summary_pdf(
            business,
            start,
            end,
            sales_dataset(db, current_user.business_id, start, end),
            expenses_dataset(db, current_user.business_id, start, end),
            inventory_dataset(db, current_user.business_id, include_costs),
            gross_profit_dataset(db, current_user.business_id, start, end)
            if include_costs
            else {"available": False, "reason": "Gross profit is hidden without cost visibility."},
        )

    audit_actor(
        db,
        current_user,
        action="report.generate",
        entity="report",
        target_id=report_type,
        metadata={
            "report_type": report_type,
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "filename": filename,
        },
        commit=True,
    )
    return _pdf_response(pdf, filename)


def _forecast_payload(db: Session, current_user: User) -> dict:
    if not has_permission(current_user, "forecasting.view"):
        return {"error": "Forecasting is not available for this account."}
    try:
        response = get_forecasting(
            months=6,
            horizon=3,
            demand_horizon=7,
            db=db,
            current_user=current_user,
        )
        return response.model_dump()
    except HTTPException as exc:
        detail = exc.detail
        if isinstance(detail, dict):
            return {"error": detail.get("message") or "Insufficient history to forecast."}
        return {"error": str(detail)}

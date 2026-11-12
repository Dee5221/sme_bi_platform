"""
Profit-aware and forecast-aware recommendation rules.

Gross-profit rules use snapshotted sale-item unit costs only.
They never apply current product cost_price to historical sales.
They never change stock quantities or product prices.
"""
from __future__ import annotations

from datetime import date, timedelta
from statistics import median
from typing import Any

from sqlalchemy.orm import Session

from app.services.product_insights import (
    PROFIT_UNAVAILABLE_REASON,
    REORDER_NOTE,
    product_performance,
    profitability,
)

OPERATIONAL_TYPES = frozenset(
    {
        "low_stock_alert",
        "stockout_risk",
        "no_recent_sales",
        "high_demand_low_margin",
        "declining_demand",
        "expense_increase",
    }
)

STRATEGIC_TYPES = frozenset(
    {
        "revenue_decline",
        "revenue_concentration",
        "expense_category_concentration",
        "strong_profit_moderate_volume",
        "high_demand_high_profit",
    }
)

TYPE_AUDIENCE = {
    **{key: "operational" for key in OPERATIONAL_TYPES},
    **{key: "strategic" for key in STRATEGIC_TYPES},
}

LOW_MARGIN_PCT = 20.0
DECLINE_RATIO = 0.70


def _percentile(values: list[float], pct: float) -> float:
    ordered = sorted(values)
    if not ordered:
        return 0.0
    index = int(round((pct / 100.0) * (len(ordered) - 1)))
    return ordered[max(0, min(index, len(ordered) - 1))]


def _rec(
    *,
    rec_id: str,
    category: str,
    rec_type: str,
    severity: str,
    title: str,
    explanation: str,
    suggested_action: str,
    entity: dict,
    metrics: dict,
    period: str,
    data_sufficient: bool,
    limitations: str,
    months_of_history: int | None = None,
    priority: int,
) -> dict[str, Any]:
    return {
        "id": rec_id,
        "category": category,
        "type": rec_type,
        "severity": severity,
        "title": title,
        "explanation": explanation,
        "reason": explanation,
        "suggested_action": suggested_action,
        "priority": priority,
        "period": period,
        "audience": TYPE_AUDIENCE.get(rec_type, "operational"),
        "affected_entity": entity,
        "metrics": metrics,
        "data_quality": {
            "months_of_history": months_of_history,
            "has_sufficient_data": data_sufficient,
            "limitations": limitations,
        },
    }


def forecast_stockout_recommendations(
    forecasts: list[dict],
    demand_horizon: int,
    period_label: str,
    limit: int = 12,
) -> list[dict]:
    recs: list[dict] = []
    for item in forecasts:
        days = item.get("estimatedDaysUntilStockout")
        urgency = item.get("urgency")
        daily = float(item.get("forecastDailyDemand") or 0)
        if daily <= 0:
            continue
        at_risk = urgency == "HIGH" or (days is not None and days <= demand_horizon)
        if not at_risk:
            continue
        name = item["productName"]
        sku = item.get("productSku") or ""
        sufficient = bool(item.get("dataSufficient"))
        days_text = f"{days} days" if days is not None else "the forecast period"
        recs.append(
            _rec(
                rec_id=f"stockout_risk_{item['productId']}",
                category="inventory",
                rec_type="stockout_risk",
                severity="CRITICAL" if days is not None and days <= 3 else "HIGH",
                title=f"{name} may run out within the forecast period",
                explanation=(
                    f"{name} ({sku}) may run out in about {days_text} with "
                    f"{item['currentQuantity']} on hand and a forecast of {daily} units/day "
                    f"over the next {demand_horizon} days."
                ),
                suggested_action="Check stock and restock this product.",
                entity={
                    "type": "product",
                    "id": item["productId"],
                    "name": name,
                    "sku": sku,
                },
                metrics={
                    "current_stock": item["currentQuantity"],
                    "forecast_daily_demand": daily,
                    "horizon_demand": item.get("horizonDemand"),
                    "days_until_stockout": days,
                    "cover_estimate": item.get("suggestedRestockQuantity"),
                    "reorder_reliable": False,
                },
                period=period_label,
                data_sufficient=sufficient,
                limitations=REORDER_NOTE,
                months_of_history=None,
                priority=1 if days is not None and days <= 3 else 2,
            )
        )
        if len(recs) >= limit:
            break
    return recs


def profit_aware_recommendations(
    performance_products: list[dict],
    profit_payload: dict,
    period_label: str,
    limit: int = 8,
) -> list[dict]:
    if not profit_payload.get("available"):
        return []

    profit_rows = [row for row in profit_payload.get("products") or [] if row["units_sold"] > 0]
    if not profit_rows:
        return []

    velocity_by_id = {row["product_id"]: row.get("sales_velocity") for row in performance_products}
    units_cut = median(row["units_sold"] for row in profit_rows)
    profits = [row["gross_profit"] for row in profit_rows]
    profit_cut = median(profits)
    strong_profit_cut = _percentile(profits, 75)

    recs: list[dict] = []
    limitations = (
        "Gross profit uses snapshotted sale-item unit cost only. Current product "
        "cost prices are not applied to historical sales. High sales volume is not "
        "treated as high profit."
    )

    high_demand_low_margin = []
    strong_profit_moderate = []
    high_demand_high_profit = []

    for profit in profit_rows:
        if profit.get("gross_margin_pct") is None:
            continue
        margin = profit["gross_margin_pct"]
        units = profit["units_sold"]
        name = profit["product_name"]
        sku = profit.get("sku") or ""
        entity = {"type": "product", "id": profit["product_id"], "name": name, "sku": sku}
        metrics = {
            "units_sold": units,
            "sales_velocity": velocity_by_id.get(profit["product_id"]),
            "revenue": profit["revenue"],
            "gross_profit": profit["gross_profit"],
            "gross_margin_pct": margin,
        }

        if units >= units_cut and margin < LOW_MARGIN_PCT:
            high_demand_low_margin.append(
                _rec(
                    rec_id=f"high_demand_low_margin_{profit['product_id']}",
                    category="profitability",
                    rec_type="high_demand_low_margin",
                    severity="MEDIUM",
                    title=f"{name} has high demand but a relatively low gross margin",
                    explanation=(
                        f"{name} sold {units} units in {period_label} (at or above median volume) "
                        f"but gross margin is {margin}%, below {LOW_MARGIN_PCT:.0f}%."
                    ),
                    suggested_action="Review selling price, supplier cost, or product mix.",
                    entity=entity,
                    metrics=metrics,
                    period=period_label,
                    data_sufficient=True,
                    limitations=limitations,
                    months_of_history=1,
                    priority=3,
                )
            )

        if profit["gross_profit"] >= strong_profit_cut and units <= units_cut:
            strong_profit_moderate.append(
                _rec(
                    rec_id=f"strong_profit_moderate_volume_{profit['product_id']}",
                    category="profitability",
                    rec_type="strong_profit_moderate_volume",
                    severity="INFO",
                    title=f"{name} contributes strongly to gross profit despite moderate sales volume",
                    explanation=(
                        f"{name} generated K{profit['gross_profit']:.2f} gross profit in {period_label} "
                        f"with {units} units sold, at or below median volume."
                    ),
                    suggested_action="Keep this product in stock; it contributes strongly to profit.",
                    entity=entity,
                    metrics=metrics,
                    period=period_label,
                    data_sufficient=True,
                    limitations=limitations,
                    months_of_history=1,
                    priority=5,
                )
            )

        if (
            units >= units_cut
            and profit["gross_profit"] >= profit_cut
            and margin >= LOW_MARGIN_PCT
        ):
            high_demand_high_profit.append(
                _rec(
                    rec_id=f"high_demand_high_profit_{profit['product_id']}",
                    category="profitability",
                    rec_type="high_demand_high_profit",
                    severity="INFO",
                    title=f"{name} has strong demand and gross profit contribution",
                    explanation=(
                        f"{name} is both a high-volume seller ({units} units) and a gross-profit "
                        f"contributor (K{profit['gross_profit']:.2f}, margin {margin}%) in {period_label}."
                    ),
                    suggested_action="Keep this product in stock; it is a core line.",
                    entity=entity,
                    metrics=metrics,
                    period=period_label,
                    data_sufficient=True,
                    limitations=limitations,
                    months_of_history=1,
                    priority=5,
                )
            )

    recs.extend(high_demand_low_margin[:limit])
    recs.extend(strong_profit_moderate[:limit])
    recs.extend(high_demand_high_profit[:limit])
    return recs


def declining_demand_recommendations(
    db: Session,
    business_id: int,
    limit: int = 8,
) -> list[dict]:
    today = date.today()
    recent_start, recent_end = today - timedelta(days=29), today
    prior_end = recent_start - timedelta(days=1)
    prior_start = prior_end - timedelta(days=29)

    recent = product_performance(db, business_id, recent_start, recent_end, limit=50)
    prior = product_performance(db, business_id, prior_start, prior_end, limit=50)

    if recent["observed_days"] < 3 or prior["observed_days"] < 3:
        return []

    prior_by_id = {row["product_id"]: row for row in prior["products"]}
    period_label = (
        f"{recent_start.isoformat()} to {recent_end.isoformat()} vs "
        f"{prior_start.isoformat()} to {prior_end.isoformat()}"
    )
    recs: list[dict] = []

    for row in recent["products"]:
        previous = prior_by_id.get(row["product_id"])
        if not previous:
            continue
        prior_velocity = previous.get("sales_velocity") or 0
        recent_velocity = row.get("sales_velocity") or 0
        if prior_velocity <= 0 or previous["units_sold"] < 2:
            continue
        if recent_velocity > prior_velocity * DECLINE_RATIO:
            continue

        drop_pct = (1 - (recent_velocity / prior_velocity)) * 100
        recs.append(
            _rec(
                rec_id=f"declining_demand_{row['product_id']}",
                category="sales",
                rec_type="declining_demand",
                severity="MEDIUM",
                title=f"{row['product_name']} has shown declining demand",
                explanation=(
                    f"{row['product_name']} ({row['sku']}) shop-open-day velocity fell "
                    f"{drop_pct:.1f}% from {prior_velocity} to {recent_velocity} units/open day."
                ),
                suggested_action="Review recent sales, stockouts, and product placement.",
                entity={
                    "type": "product",
                    "id": row["product_id"],
                    "name": row["product_name"],
                    "sku": row.get("sku") or "",
                },
                metrics={
                    "recent_velocity": recent_velocity,
                    "prior_velocity": prior_velocity,
                    "decline_percentage": round(drop_pct, 1),
                    "recent_units": row["units_sold"],
                    "prior_units": previous["units_sold"],
                },
                period=period_label,
                data_sufficient=True,
                limitations=(
                    "Velocity uses business-open days only. A short window can reflect "
                    "stockouts or one-off promotions rather than a lasting decline."
                ),
                months_of_history=2,
                priority=3,
            )
        )
        if len(recs) >= limit:
            break
    return recs


def profit_unavailable_limitation(profit_payload: dict | None) -> str | None:
    if profit_payload and profit_payload.get("available"):
        return (
            "Gross-profit recommendations use snapshotted sale-item unit costs only. "
            f"Coverage is {profit_payload.get('coverage_pct')}% of sale lines in the window."
        )
    return PROFIT_UNAVAILABLE_REASON

"""
F11 Decision Support & Recommendations — Rule Engine.

Pure, explainable, rule-based recommendation service.
No external AI APIs. No machine-learning models.
All recommendations are advisory and never modify business records.
"""
from datetime import date, datetime, timedelta
from typing import List, Optional, Dict, Any

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.product import Product
from app.models.inventory import Inventory
from app.models.sale import Sale, SaleItem
from app.models.expense import Expense
from app.services.product_insights import (
    inventory_demand_forecasts,
    product_performance,
    profitability,
    resolve_period,
)
from app.services.profit_recommendations import (
    TYPE_AUDIENCE,
    declining_demand_recommendations,
    forecast_stockout_recommendations,
    profit_aware_recommendations,
    profit_unavailable_limitation,
)

# Qualifying sale status for revenue calculations
COMPLETED_STATUS = "completed"

# Global limitations always included in the response
GLOBAL_LIMITATIONS = [
    "Recommendations are advisory only and do not automatically change stock quantities or product prices.",
    "Heuristic rules are explainable estimates, not statistically validated predictions.",
    "Supplier lead time is not recorded, so restock figures are cover estimates, not reliable reorder points.",
]

SEVERITY_PRIORITY = {
    "CRITICAL": 1,
    "HIGH": 2,
    "MEDIUM": 3,
    "LOW": 4,
    "INFO": 5,
}


# ---------------------------------------------------------------------------
# Helper: analysis period calculation
# ---------------------------------------------------------------------------

def get_analysis_period(months: int):
    """
    Return (start_date, end_date) covering the last N complete calendar months.
    The current calendar month is always treated as incomplete and excluded.
    """
    today = date.today()
    first_of_current = today.replace(day=1)
    end_date = first_of_current - timedelta(days=1)  # last day of previous month

    # Walk back `months` months
    year = end_date.year
    month = end_date.month - (months - 1)
    while month <= 0:
        month += 12
        year -= 1

    start_date = date(year, month, 1)
    return start_date, end_date


def _month_range(year: int, month: int):
    """Return (first_day, last_day) as date objects for a given month."""
    first = date(year, month, 1)
    if month == 12:
        last = date(year, 12, 31)
    else:
        last = date(year, month + 1, 1) - timedelta(days=1)
    return first, last


def _last_two_complete_months():
    """Return ((prev_start, prev_end), (curr_start, curr_end)) for the last two complete months."""
    today = date.today()
    first_of_current = today.replace(day=1)
    curr_end = first_of_current - timedelta(days=1)
    curr_start = date(curr_end.year, curr_end.month, 1)

    prev_end = curr_start - timedelta(days=1)
    prev_start = date(prev_end.year, prev_end.month, 1)

    return (prev_start, prev_end), (curr_start, curr_end)


# ---------------------------------------------------------------------------
# Phase 1 — Inventory Rules
# ---------------------------------------------------------------------------

def check_low_stock(db: Session, business_id: int) -> List[Dict[str, Any]]:
    """
    A. Low Stock Alert
    Rule: quantity_on_hand <= reorder_level AND reorder_level > 0
    Suppress: inactive product, reorder_level <= 0, missing inventory.
    """
    recommendations: List[Dict[str, Any]] = []

    rows = (
        db.query(
            Product.id,
            Product.name,
            Product.sku,
            Product.reorder_level,
            Inventory.quantity_on_hand,
        )
        .join(Inventory, Inventory.product_id == Product.id)
        .filter(
            Product.business_id == business_id,
            Product.status == "active",
            Product.reorder_level > 0,
            Inventory.quantity_on_hand <= Product.reorder_level,
        )
        .all()
    )

    for row in rows:
        qty = float(row.quantity_on_hand)
        reorder = float(row.reorder_level)
        severity = "HIGH" if qty <= reorder * 0.5 else "MEDIUM"

        recommendations.append({
            "id": f"low_stock_{row.id}",
            "category": "inventory",
            "type": "low_stock_alert",
            "severity": severity,
            "title": f"Low Stock: {row.name}",
            "explanation": (
                f"{row.name} ({row.sku}) has {qty:.0f} units in stock, "
                f"at or below the reorder level of {reorder:.0f}."
            ),
            "suggested_action": "Consider reviewing replenishment for this product.",
            "priority": SEVERITY_PRIORITY[severity],
            "affected_entity": {
                "type": "product",
                "id": row.id,
                "name": row.name,
                "sku": row.sku,
            },
            "metrics": {
                "current_stock": qty,
                "reorder_level": reorder,
            },
            "data_quality": {
                "months_of_history": None,
                "has_sufficient_data": True,
                "limitations": "Current stock level only; does not account for pending orders.",
            },
        })

    return recommendations


def check_stockout_risk(
    db: Session,
    business_id: int,
    analysis_start: date,
    analysis_end: date,
) -> List[Dict[str, Any]]:
    """
    B. Stockout Risk
    Heuristic: days_until_stockout = quantity_on_hand / avg_daily_demand.
    Requires >= 30 days of analysis period and at least 1 completed sale.
    Suppress: inactive product, zero inventory, insufficient history.
    """
    recommendations: List[Dict[str, Any]] = []
    total_days = (analysis_end - analysis_start).days + 1

    if total_days < 30:
        return recommendations  # analysis window too short

    # 1) products with stock
    products = (
        db.query(
            Product.id,
            Product.name,
            Product.sku,
            Inventory.quantity_on_hand,
        )
        .join(Inventory, Inventory.product_id == Product.id)
        .filter(
            Product.business_id == business_id,
            Product.status == "active",
            Inventory.quantity_on_hand > 0,
        )
        .all()
    )

    if not products:
        return recommendations

    product_ids = [p.id for p in products]

    # 2) aggregate sales quantity per product in one query
    start_dt = datetime.combine(analysis_start, datetime.min.time())
    end_dt = datetime.combine(analysis_end + timedelta(days=1), datetime.min.time())

    sales_rows = (
        db.query(
            SaleItem.product_id,
            func.sum(SaleItem.quantity).label("total_qty"),
        )
        .join(Sale, SaleItem.sale_id == Sale.id)
        .filter(
            SaleItem.product_id.in_(product_ids),
            Sale.business_id == business_id,
            Sale.status == COMPLETED_STATUS,
            Sale.sale_datetime >= start_dt,
            Sale.sale_datetime < end_dt,
        )
        .group_by(SaleItem.product_id)
        .all()
    )

    sales_map = {r.product_id: float(r.total_qty) for r in sales_rows}

    for p in products:
        if p.id not in sales_map or sales_map[p.id] <= 0:
            continue  # no valid demand history

        qty = float(p.quantity_on_hand)
        avg_daily = sales_map[p.id] / total_days
        if avg_daily <= 0:
            continue

        days_left = qty / avg_daily
        if days_left > 14:
            continue  # not at risk within the threshold window

        if days_left <= 3:
            severity = "CRITICAL"
        elif days_left <= 7:
            severity = "HIGH"
        else:
            severity = "MEDIUM"

        recommendations.append({
            "id": f"stockout_risk_{p.id}",
            "category": "inventory",
            "type": "stockout_risk",
            "severity": severity,
            "title": f"Stockout Risk: {p.name}",
            "explanation": (
                f"{p.name} ({p.sku}) is projected to run out of stock in "
                f"approximately {int(days_left)} days based on recent sales velocity "
                f"({avg_daily:.2f} units/day over {total_days} days)."
            ),
            "suggested_action": "Prioritize replenishment for this product.",
            "priority": SEVERITY_PRIORITY[severity],
            "affected_entity": {
                "type": "product",
                "id": p.id,
                "name": p.name,
                "sku": p.sku,
            },
            "metrics": {
                "current_stock": qty,
                "avg_daily_demand": round(avg_daily, 2),
                "days_until_stockout": int(days_left),
            },
            "data_quality": {
                "months_of_history": total_days // 30,
                "has_sufficient_data": True,
                "limitations": (
                    "Heuristic estimate based on historical sales velocity. "
                    "Does not account for seasonality, promotions, or demand changes."
                ),
            },
        })

    return recommendations


def check_no_recent_sales(db: Session, business_id: int) -> List[Dict[str, Any]]:
    """
    C. No Recent Sales
    Flag active products with stock > 0 and no completed sale in the last 30 days.
    Suppress: inactive product, zero inventory.
    Label as review opportunity, NOT confirmed dead stock.
    """
    recommendations: List[Dict[str, Any]] = []
    cutoff = datetime.utcnow() - timedelta(days=30)

    products = (
        db.query(
            Product.id,
            Product.name,
            Product.sku,
            Inventory.quantity_on_hand,
        )
        .join(Inventory, Inventory.product_id == Product.id)
        .filter(
            Product.business_id == business_id,
            Product.status == "active",
            Inventory.quantity_on_hand > 0,
        )
        .all()
    )

    if not products:
        return recommendations

    product_ids = [p.id for p in products]

    # products that DO have recent sales
    recent = (
        db.query(SaleItem.product_id)
        .join(Sale, SaleItem.sale_id == Sale.id)
        .filter(
            SaleItem.product_id.in_(product_ids),
            Sale.business_id == business_id,
            Sale.status == COMPLETED_STATUS,
            Sale.sale_datetime >= cutoff,
        )
        .distinct()
        .all()
    )
    has_recent = {r.product_id for r in recent}

    for p in products:
        if p.id in has_recent:
            continue

        recommendations.append({
            "id": f"no_recent_sales_{p.id}",
            "category": "inventory",
            "type": "no_recent_sales",
            "severity": "LOW",
            "title": f"No Recent Sales: {p.name}",
            "explanation": (
                f"{p.name} ({p.sku}) has not been sold in the last 30 days "
                f"but has {float(p.quantity_on_hand):.0f} units in stock."
            ),
            "suggested_action": "Review recent sales activity and product placement.",
            "priority": SEVERITY_PRIORITY["LOW"],
            "affected_entity": {
                "type": "product",
                "id": p.id,
                "name": p.name,
                "sku": p.sku,
            },
            "metrics": {
                "current_stock": float(p.quantity_on_hand),
                "days_without_sales": 30,
            },
            "data_quality": {
                "months_of_history": None,
                "has_sufficient_data": True,
                "limitations": (
                    "Review opportunity only. Does not confirm dead stock. "
                    "Product may be seasonal or newly listed."
                ),
            },
        })

    return recommendations


# ---------------------------------------------------------------------------
# Phase 2 — Sales Performance Rules
# ---------------------------------------------------------------------------

def check_revenue_decline(db: Session, business_id: int) -> List[Dict[str, Any]]:
    """
    D. Revenue Decline
    Compare the last two complete calendar months.
    MEDIUM when decline > 20 %, HIGH when decline > 30 %.
    Suppress when previous-period revenue is zero.
    """
    recommendations: List[Dict[str, Any]] = []
    (prev_start, prev_end), (curr_start, curr_end) = _last_two_complete_months()

    prev_start_dt = datetime.combine(prev_start, datetime.min.time())
    prev_end_dt = datetime.combine(prev_end + timedelta(days=1), datetime.min.time())
    curr_start_dt = datetime.combine(curr_start, datetime.min.time())
    curr_end_dt = datetime.combine(curr_end + timedelta(days=1), datetime.min.time())

    prev_rev = (
        db.query(func.coalesce(func.sum(Sale.total_amount), 0))
        .filter(
            Sale.business_id == business_id,
            Sale.status == COMPLETED_STATUS,
            Sale.sale_datetime >= prev_start_dt,
            Sale.sale_datetime < prev_end_dt,
        )
        .scalar()
    )

    curr_rev = (
        db.query(func.coalesce(func.sum(Sale.total_amount), 0))
        .filter(
            Sale.business_id == business_id,
            Sale.status == COMPLETED_STATUS,
            Sale.sale_datetime >= curr_start_dt,
            Sale.sale_datetime < curr_end_dt,
        )
        .scalar()
    )

    prev_rev = float(prev_rev)
    curr_rev = float(curr_rev)

    if prev_rev == 0:
        return recommendations  # cannot compute a meaningful percentage

    decline_pct = ((prev_rev - curr_rev) / prev_rev) * 100
    if decline_pct <= 20:
        return recommendations

    severity = "HIGH" if decline_pct > 30 else "MEDIUM"
    prev_label = prev_start.strftime("%B %Y")
    curr_label = curr_start.strftime("%B %Y")

    recommendations.append({
        "id": "revenue_decline",
        "category": "sales",
        "type": "revenue_decline",
        "severity": severity,
        "title": f"Revenue Decline: {decline_pct:.1f}%",
        "explanation": (
            f"Completed-sales revenue declined by {decline_pct:.1f}% "
            f"from {prev_label} (K{prev_rev:,.2f}) to {curr_label} (K{curr_rev:,.2f})."
        ),
        "suggested_action": "Review recent sales trends and investigate potential causes.",
        "priority": SEVERITY_PRIORITY[severity],
        "affected_entity": {"type": "business", "id": business_id, "name": None},
        "metrics": {
            "previous_revenue": prev_rev,
            "current_revenue": curr_rev,
            "decline_percentage": round(decline_pct, 1),
        },
        "data_quality": {
            "months_of_history": 2,
            "has_sufficient_data": True,
            "limitations": (
                "Comparison covers two calendar months. "
                "Short-term fluctuations may not indicate a long-term trend."
            ),
        },
    })

    return recommendations


def check_revenue_concentration(
    db: Session,
    business_id: int,
    analysis_start: date,
    analysis_end: date,
) -> List[Dict[str, Any]]:
    """
    E. Revenue Concentration
    Top product > 40 % or top-3 products > 70 % of total revenue.
    Requires >= 5 products with sales for meaningful analysis.
    """
    recommendations: List[Dict[str, Any]] = []
    start_dt = datetime.combine(analysis_start, datetime.min.time())
    end_dt = datetime.combine(analysis_end + timedelta(days=1), datetime.min.time())

    rows = (
        db.query(
            Product.id,
            Product.name,
            func.sum(SaleItem.subtotal).label("revenue"),
        )
        .join(SaleItem, SaleItem.product_id == Product.id)
        .join(Sale, SaleItem.sale_id == Sale.id)
        .filter(
            Product.business_id == business_id,
            Sale.status == COMPLETED_STATUS,
            Sale.sale_datetime >= start_dt,
            Sale.sale_datetime < end_dt,
        )
        .group_by(Product.id, Product.name)
        .order_by(func.sum(SaleItem.subtotal).desc())
        .all()
    )

    if len(rows) < 5:
        return recommendations

    total_rev = sum(float(r.revenue) for r in rows)
    if total_rev == 0:
        return recommendations

    top = rows[0]
    top_share = (float(top.revenue) / total_rev) * 100
    top3_rev = sum(float(r.revenue) for r in rows[:3])
    top3_share = (top3_rev / total_rev) * 100

    if top_share > 40:
        recommendations.append({
            "id": "revenue_concentration",
            "category": "sales",
            "type": "revenue_concentration",
            "severity": "MEDIUM",
            "title": f"High Revenue Concentration: {top.name}",
            "explanation": (
                f"{top.name} accounts for {top_share:.1f}% of total revenue. "
                f"The top 3 products account for {top3_share:.1f}%."
            ),
            "suggested_action": (
                "Consider diversifying your product range to reduce dependency on top-selling items."
            ),
            "priority": SEVERITY_PRIORITY["MEDIUM"],
            "affected_entity": {"type": "product", "id": top.id, "name": top.name},
            "metrics": {
                "top_product_share": round(top_share, 1),
                "top_3_share": round(top3_share, 1),
                "total_revenue": round(total_rev, 2),
            },
            "data_quality": {
                "months_of_history": (analysis_end - analysis_start).days // 30,
                "has_sufficient_data": True,
                "limitations": (
                    "Concentration is a descriptive observation. "
                    "High concentration may be appropriate for some business models."
                ),
            },
        })
    elif top3_share > 70:
        recommendations.append({
            "id": "revenue_concentration",
            "category": "sales",
            "type": "revenue_concentration",
            "severity": "LOW",
            "title": "Revenue Concentration in Top Products",
            "explanation": f"The top 3 products account for {top3_share:.1f}% of total revenue.",
            "suggested_action": "Monitor product performance to ensure balanced revenue streams.",
            "priority": SEVERITY_PRIORITY["LOW"],
            "affected_entity": {"type": "business", "id": business_id, "name": None},
            "metrics": {
                "top_3_share": round(top3_share, 1),
                "total_revenue": round(total_rev, 2),
            },
            "data_quality": {
                "months_of_history": (analysis_end - analysis_start).days // 30,
                "has_sufficient_data": True,
                "limitations": "Concentration is a descriptive observation.",
            },
        })

    return recommendations


# ---------------------------------------------------------------------------
# Phase 3 — Expense Rules
# ---------------------------------------------------------------------------

def check_expense_increase(db: Session, business_id: int) -> List[Dict[str, Any]]:
    """
    F. Expense Increase
    Compare the last two complete calendar months.
    MEDIUM when increase > 25 %, HIGH when increase > 40 %.
    Suppress when previous-period expenses are zero.
    """
    recommendations: List[Dict[str, Any]] = []
    (prev_start, prev_end), (curr_start, curr_end) = _last_two_complete_months()

    prev_exp = (
        db.query(func.coalesce(func.sum(Expense.amount), 0))
        .filter(
            Expense.business_id == business_id,
            Expense.date >= prev_start,
            Expense.date <= prev_end,
        )
        .scalar()
    )

    curr_exp = (
        db.query(func.coalesce(func.sum(Expense.amount), 0))
        .filter(
            Expense.business_id == business_id,
            Expense.date >= curr_start,
            Expense.date <= curr_end,
        )
        .scalar()
    )

    prev_exp = float(prev_exp)
    curr_exp = float(curr_exp)

    if prev_exp == 0:
        return recommendations

    increase_pct = ((curr_exp - prev_exp) / prev_exp) * 100
    if increase_pct <= 25:
        return recommendations

    severity = "HIGH" if increase_pct > 40 else "MEDIUM"
    prev_label = prev_start.strftime("%B %Y")
    curr_label = curr_start.strftime("%B %Y")

    recommendations.append({
        "id": "expense_increase",
        "category": "expenses",
        "type": "expense_increase",
        "severity": severity,
        "title": f"Expense Increase: {increase_pct:.1f}%",
        "explanation": (
            f"Recorded expenses increased by {increase_pct:.1f}% "
            f"from {prev_label} (K{prev_exp:,.2f}) to {curr_label} (K{curr_exp:,.2f})."
        ),
        "suggested_action": "Review recent expenses to identify the cause of the increase.",
        "priority": SEVERITY_PRIORITY[severity],
        "affected_entity": {"type": "business", "id": business_id, "name": None},
        "metrics": {
            "previous_expenses": prev_exp,
            "current_expenses": curr_exp,
            "increase_percentage": round(increase_pct, 1),
        },
        "data_quality": {
            "months_of_history": 2,
            "has_sufficient_data": True,
            "limitations": (
                "Comparison covers two calendar months. "
                "Does not distinguish recurring from one-off expenses."
            ),
        },
    })

    return recommendations


def check_expense_category_concentration(
    db: Session,
    business_id: int,
    analysis_start: date,
    analysis_end: date,
) -> List[Dict[str, Any]]:
    """
    G. Expense Category Concentration
    Flag a category exceeding 50 % of total recorded expenses.
    Requires >= 3 categories and positive total expenses.
    """
    recommendations: List[Dict[str, Any]] = []

    rows = (
        db.query(
            Expense.category,
            func.sum(Expense.amount).label("total_amount"),
        )
        .filter(
            Expense.business_id == business_id,
            Expense.date >= analysis_start,
            Expense.date <= analysis_end,
        )
        .group_by(Expense.category)
        .order_by(func.sum(Expense.amount).desc())
        .all()
    )

    if len(rows) < 3:
        return recommendations

    total_exp = sum(float(r.total_amount) for r in rows)
    if total_exp == 0:
        return recommendations

    top = rows[0]
    top_share = (float(top.total_amount) / total_exp) * 100

    if top_share > 50:
        recommendations.append({
            "id": "expense_category_concentration",
            "category": "expenses",
            "type": "expense_category_concentration",
            "severity": "LOW",
            "title": f"Expense Concentration: {top.category}",
            "explanation": (
                f'The "{top.category}" category accounts for {top_share:.1f}% of total '
                f"expenses (K{float(top.total_amount):,.2f} of K{total_exp:,.2f})."
            ),
            "suggested_action": (
                f'Review "{top.category}" expenses for potential cost-saving opportunities.'
            ),
            "priority": SEVERITY_PRIORITY["LOW"],
            "affected_entity": {"type": "expense_category", "id": None, "name": top.category},
            "metrics": {
                "category_share": round(top_share, 1),
                "category_total": float(top.total_amount),
                "total_expenses": round(total_exp, 2),
            },
            "data_quality": {
                "months_of_history": (analysis_end - analysis_start).days // 30,
                "has_sufficient_data": True,
                "limitations": (
                    "A dominant expense category may be normal for some businesses (e.g., rent). "
                    "This is an advisory observation."
                ),
            },
        })

    return recommendations


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------

def generate_recommendations(
    db: Session,
    business_id: int,
    months: int = 6,
    categories: Optional[List[str]] = None,
    severity_filter: Optional[str] = None,
    role_name: str = "Business Owner",
    include_profit: bool = True,
) -> Dict[str, Any]:
    """
    Main entry point. Generates all recommendations, applies role and
    severity filtering, and returns the complete response payload.

    Staff receive no recommendations. Managers receive operational items.
    Owners receive operational and strategic items. Nothing here writes
    stock or price changes.
    """
    analysis_start, analysis_end = get_analysis_period(months)
    recommendations: List[Dict[str, Any]] = []
    limitations: List[str] = list(GLOBAL_LIMITATIONS)
    period_label = f"{analysis_start.isoformat()} to {analysis_end.isoformat()}"
    demand_horizon = 14
    product_start, product_end = resolve_period(None, None, 30)
    product_period = f"{product_start.isoformat()} to {product_end.isoformat()}"
    forecast_period = f"next {demand_horizon} days"

    def _include(cat: str) -> bool:
        if role_name in ("Staff", "Sales Staff"):
            return False
        if categories and cat not in categories:
            return False
        return True

    # Phase 1 — Inventory
    if _include("inventory"):
        recommendations.extend(check_low_stock(db, business_id))
        forecasts = inventory_demand_forecasts(db, business_id, demand_horizon)
        recommendations.extend(
            forecast_stockout_recommendations(forecasts, demand_horizon, forecast_period)
        )
        recommendations.extend(check_no_recent_sales(db, business_id))

    # Phase 2 — Sales
    if _include("sales"):
        recommendations.extend(check_revenue_decline(db, business_id))
        recommendations.extend(check_revenue_concentration(db, business_id, analysis_start, analysis_end))
        recommendations.extend(declining_demand_recommendations(db, business_id))

    # Phase 3 — Expenses
    if _include("expenses"):
        recommendations.extend(check_expense_increase(db, business_id))
        recommendations.extend(check_expense_category_concentration(db, business_id, analysis_start, analysis_end))

    # Phase 4 — Profit-aware (snapshotted unit_cost only)
    profit_payload = None
    if include_profit and _include("profitability"):
        performance = product_performance(db, business_id, product_start, product_end, limit=50)
        profit_payload = profitability(db, business_id, product_start, product_end, limit=50)
        recommendations.extend(
            profit_aware_recommendations(
                performance["products"],
                profit_payload,
                product_period,
            )
        )
        extra = profit_unavailable_limitation(profit_payload)
        if extra and extra not in limitations:
            limitations.append(extra)

    # Severity filter
    if severity_filter and severity_filter.lower() != "all":
        target = severity_filter.upper()
        if target in SEVERITY_PRIORITY:
            max_priority = SEVERITY_PRIORITY[target]
            recommendations = [
                r for r in recommendations
                if SEVERITY_PRIORITY.get(r["severity"], 99) <= max_priority
            ]

    # De-duplicate by stable id (should already be unique, but guard)
    seen_ids: set = set()
    unique: List[Dict[str, Any]] = []
    for r in recommendations:
        r.setdefault("period", period_label)
        r.setdefault("reason", r.get("explanation"))
        r.setdefault("audience", TYPE_AUDIENCE.get(r["type"], "operational"))
        if role_name == "Manager" and r.get("audience") != "operational":
            continue
        if role_name in ("Staff", "Sales Staff"):
            continue
        if r["id"] not in seen_ids:
            seen_ids.add(r["id"])
            unique.append(r)
    recommendations = unique

    # Sort by priority
    recommendations.sort(key=lambda r: r["priority"])

    # Summary counts
    by_severity: Dict[str, int] = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0, "INFO": 0}
    by_category: Dict[str, int] = {}
    for r in recommendations:
        by_severity[r["severity"]] = by_severity.get(r["severity"], 0) + 1
        by_category[r["category"]] = by_category.get(r["category"], 0) + 1

    return {
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "analysis_period": {
            "start": analysis_start.isoformat(),
            "end": analysis_end.isoformat(),
            "months": months,
        },
        "total_recommendations": len(recommendations),
        "recommendations": recommendations,
        "summary": {
            "by_severity": by_severity,
            "by_category": by_category,
        },
        "limitations": limitations,
    }
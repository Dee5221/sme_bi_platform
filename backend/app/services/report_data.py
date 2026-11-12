"""
Business-scoped datasets for PDF reports.

Does not fabricate financial figures. Gross profit uses snapshotted
sale-item unit costs only. Inventory is the current on-hand position.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.business import Business
from app.models.customer import Customer
from app.models.expense import Expense
from app.models.inventory import Inventory
from app.models.product import Product
from app.models.sale import Sale, SaleItem
from app.services.product_insights import product_performance, profitability

COMPLETED_STATUS = "completed"
MAX_TABLE_ROWS = 250

REPORT_TYPES = {
    "sales": "Sales Report",
    "product_performance": "Product Performance Report",
    "inventory": "Inventory Status Report",
    "expenses": "Expense Report",
    "gross_profit": "Gross Profit Report",
    "forecast_recommendations": "Forecast and Recommendations Report",
    "business_summary": "Business Summary Report",
}


def resolve_report_dates(start_date: Optional[date], end_date: Optional[date]) -> tuple[date, date]:
    today = date.today()
    if start_date and end_date:
        if start_date > end_date:
            raise ValueError("start_date cannot be after end_date")
        return start_date, end_date
    if start_date:
        return start_date, today
    if end_date:
        return end_date.replace(day=1), end_date
    return today.replace(day=1), today


def _bounds(start: date, end: date) -> tuple[datetime, datetime]:
    return (
        datetime.combine(start, datetime.min.time()),
        datetime.combine(end + timedelta(days=1), datetime.min.time()),
    )


def business_profile(db: Session, business_id: int) -> dict:
    business = db.query(Business).filter(Business.id == business_id).first()
    if not business:
        raise ValueError("Business not found")
    return {
        "id": business.id,
        "name": business.name,
        "currency": business.currency or "ZMW",
        "address": business.address,
        "email": business.email,
        "phone": business.phone,
        "report_header": business.report_header,
        "receipt_footer": business.receipt_footer,
    }


def sales_dataset(db: Session, business_id: int, start: date, end: date) -> dict:
    start_dt, end_dt = _bounds(start, end)
    totals = (
        db.query(
            func.coalesce(func.sum(Sale.total_amount), 0),
            func.count(Sale.id),
        )
        .filter(
            Sale.business_id == business_id,
            Sale.status == COMPLETED_STATUS,
            Sale.sale_datetime >= start_dt,
            Sale.sale_datetime < end_dt,
        )
        .first()
    )
    revenue = float(totals[0] or 0)
    count = int(totals[1] or 0)

    rows = (
        db.query(
            Sale.id,
            Sale.sale_datetime,
            Sale.total_amount,
            Sale.payment_method,
            Customer.name,
            func.coalesce(func.sum(SaleItem.quantity), 0).label("units"),
        )
        .outerjoin(Customer, Customer.id == Sale.customer_id)
        .outerjoin(SaleItem, SaleItem.sale_id == Sale.id)
        .filter(
            Sale.business_id == business_id,
            Sale.status == COMPLETED_STATUS,
            Sale.sale_datetime >= start_dt,
            Sale.sale_datetime < end_dt,
        )
        .group_by(Sale.id, Sale.sale_datetime, Sale.total_amount, Sale.payment_method, Customer.name)
        .order_by(Sale.sale_datetime.desc())
        .limit(MAX_TABLE_ROWS)
        .all()
    )

    return {
        "revenue": round(revenue, 2),
        "count": count,
        "aov": round(revenue / count, 2) if count else 0.0,
        "truncated": count > MAX_TABLE_ROWS,
        "rows": [
            {
                "id": row.id,
                "sold_at": row.sale_datetime.strftime("%Y-%m-%d %H:%M") if row.sale_datetime else "",
                "customer": row.name or "Walk-in",
                "payment": row.payment_method,
                "units": float(row.units or 0),
                "total": round(float(row.total_amount), 2),
            }
            for row in rows
        ],
        "empty_message": "No completed sales in this period." if count == 0 else None,
    }


def expenses_dataset(db: Session, business_id: int, start: date, end: date) -> dict:
    total = (
        db.query(func.coalesce(func.sum(Expense.amount), 0), func.count(Expense.id))
        .filter(Expense.business_id == business_id, Expense.date >= start, Expense.date <= end)
        .first()
    )
    amount = float(total[0] or 0)
    count = int(total[1] or 0)

    by_category = (
        db.query(Expense.category, func.coalesce(func.sum(Expense.amount), 0))
        .filter(Expense.business_id == business_id, Expense.date >= start, Expense.date <= end)
        .group_by(Expense.category)
        .order_by(func.sum(Expense.amount).desc())
        .all()
    )
    rows = (
        db.query(Expense)
        .filter(Expense.business_id == business_id, Expense.date >= start, Expense.date <= end)
        .order_by(Expense.date.desc(), Expense.id.desc())
        .limit(MAX_TABLE_ROWS)
        .all()
    )
    return {
        "total": round(amount, 2),
        "count": count,
        "truncated": count > MAX_TABLE_ROWS,
        "by_category": [
            {"category": row[0], "amount": round(float(row[1]), 2)} for row in by_category
        ],
        "rows": [
            {
                "date": expense.date.isoformat(),
                "category": expense.category,
                "description": expense.description,
                "payment": expense.payment_method,
                "amount": round(float(expense.amount), 2),
            }
            for expense in rows
        ],
        "empty_message": "No expenses recorded in this period." if count == 0 else None,
    }


def inventory_dataset(db: Session, business_id: int, include_costs: bool) -> dict:
    rows = (
        db.query(
            Product.id,
            Product.name,
            Product.sku,
            Product.reorder_level,
            Product.cost_price,
            Product.selling_price,
            Inventory.quantity_on_hand,
        )
        .join(Inventory, Inventory.product_id == Product.id)
        .filter(Product.business_id == business_id)
        .order_by(Product.name)
        .all()
    )
    items = []
    low_stock = 0
    total_units = 0.0
    total_value = 0.0
    missing_cost = 0
    for row in rows:
        qty = float(row.quantity_on_hand or 0)
        reorder = float(row.reorder_level or 0)
        is_low = qty <= reorder
        if is_low:
            low_stock += 1
        total_units += qty
        cost = float(row.cost_price) if row.cost_price is not None else None
        if include_costs:
            if cost is None:
                missing_cost += 1
                value = None
            else:
                value = round(qty * cost, 2)
                total_value += value
        else:
            value = round(qty * float(row.selling_price or 0), 2)
            total_value += value
        items.append(
            {
                "name": row.name,
                "sku": row.sku,
                "on_hand": qty,
                "reorder_level": reorder,
                "is_low": is_low,
                "value": value,
            }
        )
    note = (
        "Inventory is the current on-hand position, not a historical snapshot for the reporting period."
    )
    if include_costs and missing_cost:
        note += f" Cost valuation omitted for {missing_cost} products without cost_price."
    elif not include_costs:
        note += " Values shown are selling-price extensions, not inventory cost."
    return {
        "count": len(items),
        "low_stock": low_stock,
        "total_units": round(total_units, 2),
        "total_value": round(total_value, 2) if items else 0.0,
        "include_costs": include_costs,
        "rows": items,
        "note": note,
        "empty_message": "No inventory records for this business." if not items else None,
    }


def product_performance_dataset(db: Session, business_id: int, start: date, end: date) -> dict:
    payload = product_performance(db, business_id, start, end, limit=MAX_TABLE_ROWS)
    return {
        **payload,
        "empty_message": (
            "No completed product sales in this period." if not payload["products"] else None
        ),
    }


def gross_profit_dataset(db: Session, business_id: int, start: date, end: date) -> dict:
    payload = profitability(db, business_id, start, end, limit=MAX_TABLE_ROWS)
    if not payload.get("available"):
        payload["empty_message"] = payload.get("reason")
    elif not payload.get("products"):
        payload["empty_message"] = "No costed sale lines in this period."
    else:
        payload["empty_message"] = None
    return payload

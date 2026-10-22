from datetime import date, datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, case, extract
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.sale import Sale, SaleItem
from app.models.product import Product
from app.models.category import Category
from app.models.inventory import Inventory
from app.models.expense import Expense
from app.schemas.analytics import (
    SummaryResponse,
    SalesTrendPoint,
    SalesByCategoryItem,
    InventoryHealthResponse,
)

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])

# Qualifying sale status for revenue calculations
COMPLETED_STATUS = "completed"


def _get_default_date_range():
    """Default to current calendar month if no dates provided."""
    today = date.today()
    start = today.replace(day=1)
    end = today
    return start, end


def _validate_dates(start_date: Optional[date], end_date: Optional[date]):
    """Validate and return date range with defaults."""
    if start_date and end_date:
        if start_date > end_date:
            raise HTTPException(
                status_code=422,
                detail="start_date cannot be after end_date"
            )
        return start_date, end_date
    elif start_date:
        return start_date, date.today()
    elif end_date:
        return end_date.replace(day=1), end_date
    else:
        return _get_default_date_range()


# =============================================================================
# Endpoint 1: Business Summary
# =============================================================================
@router.get("/summary", response_model=SummaryResponse)
def get_business_summary(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns KPI summary for the authenticated user's business.

    - total_revenue: Sum of completed sales within date range (based on sale_datetime)
    - total_expenses: Sum of expenses within date range (based on expense_date)
    - net_cash_flow: total_revenue - total_expenses (limited proxy, excludes COGS)
    - total_transactions: Count of completed sales within date range
    - aov: Average order value (revenue / transactions), 0 if no transactions
    - low_stock_count: Current inventory items at or below reorder_level (NOT period-specific)
    """
    start, end = _validate_dates(start_date, end_date)
    business_id = current_user.business_id

    # Revenue and transaction count from sales
    # Include the full end day by using < end + 1 day
    end_exclusive = datetime.combine(end + timedelta(days=1), datetime.min.time())
    start_inclusive = datetime.combine(start, datetime.min.time())

    sales_result = db.query(
        func.coalesce(func.sum(Sale.total_amount), 0).label("total_revenue"),
        func.count(Sale.id).label("total_transactions"),
    ).filter(
        Sale.business_id == business_id,
        Sale.status == COMPLETED_STATUS,
        Sale.sale_datetime >= start_inclusive,
        Sale.sale_datetime < end_exclusive,
    ).first()

    total_revenue = float(sales_result.total_revenue)
    total_transactions = sales_result.total_transactions

    # Expenses total
    expenses_result = db.query(
        func.coalesce(func.sum(Expense.amount), 0).label("total_expenses")
    ).filter(
        Expense.business_id == business_id,
        Expense.date >= start,
        Expense.date <= end,
    ).first()

    total_expenses = float(expenses_result.total_expenses)

    # AOV calculation (handle zero denominator)
    aov = total_revenue / total_transactions if total_transactions > 0 else 0.0

    # Net cash flow (limited proxy: revenue - expenses, excludes COGS)
    net_cash_flow = total_revenue - total_expenses

    # Low stock count (CURRENT inventory state, not period-specific)
    low_stock_count = db.query(
        func.count(Inventory.id)
    ).join(
        Product, Inventory.product_id == Product.id
    ).filter(
        Inventory.business_id == business_id,
        Product.reorder_level.isnot(None),
        Inventory.quantity_on_hand <= Product.reorder_level,
    ).scalar() or 0

    return SummaryResponse(
        total_revenue=round(total_revenue, 2),
        total_expenses=round(total_expenses, 2),
        net_cash_flow=round(net_cash_flow, 2),
        total_transactions=total_transactions,
        aov=round(aov, 2),
        low_stock_count=low_stock_count,
        period_start=start.isoformat(),
        period_end=end.isoformat(),
    )


# =============================================================================
# Endpoint 2: Sales Trend
# =============================================================================
@router.get("/sales/trend", response_model=list[SalesTrendPoint])
def get_sales_trend(
    group_by: str = Query("day", regex="^(day|month)$"),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns sales trend grouped by day or month.

    - period: The date period (YYYY-MM-DD for day, YYYY-MM-01 for month)
    - revenue: Sum of completed sales in that period
    - transactions: Count of completed sales in that period
    """
    start, end = _validate_dates(start_date, end_date)
    business_id = current_user.business_id

    end_exclusive = datetime.combine(end + timedelta(days=1), datetime.min.time())
    start_inclusive = datetime.combine(start, datetime.min.time())

    # Use date_trunc for PostgreSQL grouping
    if group_by == "month":
        period_expr = func.to_char(
            func.date_trunc("month", Sale.sale_datetime), "YYYY-MM-01"
        )
    else:
        period_expr = func.to_char(
            func.date_trunc("day", Sale.sale_datetime), "YYYY-MM-DD"
        )

    results = db.query(
        period_expr.label("period"),
        func.coalesce(func.sum(Sale.total_amount), 0).label("revenue"),
        func.count(Sale.id).label("transactions"),
    ).filter(
        Sale.business_id == business_id,
        Sale.status == COMPLETED_STATUS,
        Sale.sale_datetime >= start_inclusive,
        Sale.sale_datetime < end_exclusive,
    ).group_by(
        period_expr
    ).order_by(
        period_expr
    ).all()

    return [
        SalesTrendPoint(
            period=row.period,
            revenue=round(float(row.revenue), 2),
            transactions=row.transactions,
        )
        for row in results
    ]


# =============================================================================
# Endpoint 3: Sales by Category
# =============================================================================
@router.get("/sales/by-category", response_model=list[SalesByCategoryItem])
def get_sales_by_category(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns sales revenue and units sold grouped by product category.

    - category_name: Name of the category
    - revenue: Sum of SaleItem.subtotal for completed sales
    - units_sold: Sum of SaleItem.quantity
    """
    start, end = _validate_dates(start_date, end_date)
    business_id = current_user.business_id

    end_exclusive = datetime.combine(end + timedelta(days=1), datetime.min.time())
    start_inclusive = datetime.combine(start, datetime.min.time())

    results = db.query(
        Category.name.label("category_name"),
        func.coalesce(func.sum(SaleItem.subtotal), 0).label("revenue"),
        func.coalesce(func.sum(SaleItem.quantity), 0).label("units_sold"),
    ).join(
        SaleItem, SaleItem.product_id == Product.id
    ).join(
        Sale, SaleItem.sale_id == Sale.id
    ).join(
        Product, Product.id == SaleItem.product_id
    ).join(
        Category, Product.category_id == Category.id
    ).filter(
        Sale.business_id == business_id,
        Sale.status == COMPLETED_STATUS,
        Sale.sale_datetime >= start_inclusive,
        Sale.sale_datetime < end_exclusive,
    ).group_by(
        Category.name
    ).order_by(
        func.sum(SaleItem.subtotal).desc()
    ).all()

    return [
        SalesByCategoryItem(
            category_name=row.category_name,
            revenue=round(float(row.revenue), 2),
            units_sold=int(row.units_sold),
        )
        for row in results
    ]


# =============================================================================
# Endpoint 4: Inventory Health
# =============================================================================
@router.get("/inventory/health", response_model=InventoryHealthResponse)
def get_inventory_health(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns current inventory health metrics.

    - total_items: Total number of distinct products with inventory records
    - low_stock_items: Products at or below reorder_level
    - total_inventory_value: Sum of (quantity_on_hand * product.cost_price)
      Only included if cost_price data is available; null otherwise.
    """
    business_id = current_user.business_id

    # Total items
    total_items = db.query(
        func.count(Inventory.id)
    ).filter(
        Inventory.business_id == business_id
    ).scalar() or 0

    # Low stock items
    low_stock_items = db.query(
        func.count(Inventory.id)
    ).join(
        Product, Inventory.product_id == Product.id
    ).filter(
        Inventory.business_id == business_id,
        Product.reorder_level.isnot(None),
        Inventory.quantity_on_hand <= Product.reorder_level,
    ).scalar() or 0

    # Total inventory value (only if cost_price exists)
    value_result = db.query(
        func.sum(Inventory.quantity_on_hand * Product.cost_price).label("total_value"),
        func.count(case((Product.cost_price.is_(None), 1))).label("missing_cost_count"),
        func.count(Inventory.id).label("total_count"),
    ).join(
        Product, Inventory.product_id == Product.id
    ).filter(
        Inventory.business_id == business_id
    ).first()

    total_inventory_value = None
    note = None

    if value_result and value_result.total_count > 0:
        if value_result.missing_cost_count == value_result.total_count:
            # All products missing cost_price
            note = "Inventory value unavailable: cost_price data not populated"
        elif value_result.missing_cost_count > 0:
            # Partial cost data
            total_inventory_value = round(float(value_result.total_value or 0), 2)
            note = f"Partial valuation: {value_result.missing_cost_count}/{value_result.total_count} products missing cost_price"
        else:
            # Complete cost data
            total_inventory_value = round(float(value_result.total_value or 0), 2)

    return InventoryHealthResponse(
        total_items=total_items,
        low_stock_items=low_stock_items,
        total_inventory_value=total_inventory_value,
        note=note,
    )
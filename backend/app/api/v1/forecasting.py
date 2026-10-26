"""
Forecasting API endpoint for SME BI Platform.
Provides revenue, expense, and inventory demand forecasting.
"""
from datetime import date, datetime
from typing import Optional
import calendar

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, extract
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.sale import Sale
from app.models.expense import Expense
from app.models.inventory import Inventory
from app.models.product import Product
from app.services.forecasting import (
    moving_average_forecast,
    evaluate_forecast,
)
from app.schemas.forecasting import (
    ForecastingResponse,
    MonthlyDataPoint,
    InventoryForecastItem,
    ForecastingSummary,
    MethodologyInfo,
    PeriodInfo,
    DataQualityInfo,
    EvaluationMetrics,
)

router = APIRouter(prefix="/api/forecasting", tags=["Forecasting"])

COMPLETED_STATUS = "completed"
MIN_HISTORY_MONTHS = 3


def get_month_label(year: int, month: int) -> str:
    """Get human-readable month label like 'Apr 2026'."""
    month_abbr = calendar.month_abbr[month]
    return f"{month_abbr} {year}"


def get_month_key(year: int, month: int) -> str:
    """Get month key like '2026-04'."""
    return f"{year:04d}-{month:02d}"


@router.get("", response_model=ForecastingResponse)
def get_forecasting(
    months: int = Query(6, ge=3, le=24, description="Historical months to include"),
    horizon: int = Query(3, ge=1, le=12, description="Months to forecast"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Generate revenue, expense, and inventory demand forecasts.
    
    Uses 3-period moving average for forecasting with proper evaluation.
    All data is scoped to the authenticated user's business.
    """
    business_id = current_user.business_id
    
    # ==========================================================================
    # Step 1: Aggregate monthly revenue and expenses
    # ==========================================================================
    
    # Get monthly revenue
    revenue_query = db.query(
        extract('year', Sale.sale_datetime).label('year'),
        extract('month', Sale.sale_datetime).label('month'),
        func.coalesce(func.sum(Sale.total_amount), 0).label('revenue'),
        func.count(Sale.id).label('sales_count'),
    ).filter(
        Sale.business_id == business_id,
        Sale.status == COMPLETED_STATUS,
    ).group_by(
        extract('year', Sale.sale_datetime),
        extract('month', Sale.sale_datetime),
    ).order_by(
        extract('year', Sale.sale_datetime),
        extract('month', Sale.sale_datetime),
    ).all()
    
    # Get monthly expenses
    expense_query = db.query(
        extract('year', Expense.date).label('year'),
        extract('month', Expense.date).label('month'),
        func.coalesce(func.sum(Expense.amount), 0).label('expenses'),
    ).filter(
        Expense.business_id == business_id,
    ).group_by(
        extract('year', Expense.date),
        extract('month', Expense.date),
    ).order_by(
        extract('year', Expense.date),
        extract('month', Expense.date),
    ).all()
    
    # Build a dictionary of monthly data
    monthly_data = {}
    
    for row in revenue_query:
        year = int(row.year)
        month = int(row.month)
        key = get_month_key(year, month)
        monthly_data[key] = {
            'year': year,
            'month': month,
            'revenue': float(row.revenue),
            'expenses': 0.0,
            'sales_count': row.sales_count,
        }
    
    for row in expense_query:
        year = int(row.year)
        month = int(row.month)
        key = get_month_key(year, month)
        if key in monthly_data:
            monthly_data[key]['expenses'] = float(row.expenses)
        else:
            monthly_data[key] = {
                'year': year,
                'month': month,
                'revenue': 0.0,
                'expenses': float(row.expenses),
                'sales_count': 0,
            }
    
    # Sort by year and month
    sorted_months = sorted(
        monthly_data.values(),
        key=lambda x: (x['year'], x['month'])
    )
    
    months_with_sales = sum(1 for m in sorted_months if m['revenue'] > 0)
    months_with_expenses = sum(1 for m in sorted_months if m['expenses'] > 0)
    
    # Check if we have enough history
    if months_with_sales < MIN_HISTORY_MONTHS:
        raise HTTPException(
            status_code=422,
            detail={
                "error": "insufficient_history",
                "message": f"Need at least {MIN_HISTORY_MONTHS} months with sales data, "
                          f"currently have {months_with_sales}",
                "monthsWithSales": months_with_sales,
                "monthsWithExpenses": months_with_expenses,
                "requiredMonths": MIN_HISTORY_MONTHS,
            }
        )
    
    # Take the last N months for historical data
    historical_months = sorted_months[-months:] if len(sorted_months) >= months else sorted_months
    
    # ==========================================================================
    # Step 2: Generate forecasts
    # ==========================================================================
    
    revenue_series = [m['revenue'] for m in historical_months]
    expense_series = [m['expenses'] for m in historical_months]
    sales_count_series = [m['sales_count'] for m in historical_months]
    
    # Generate forecasts using 3-period moving average
    window = min(3, len(historical_months))
    
    revenue_forecasts = moving_average_forecast(
        revenue_series.copy(), window, horizon
    )
    expense_forecasts = moving_average_forecast(
        expense_series.copy(), window, horizon
    )
    sales_count_forecasts = moving_average_forecast(
        sales_count_series.copy(), window, horizon
    )
    
    # ==========================================================================
    # Step 3: Evaluate the forecast model
    # ==========================================================================
    
    evaluation = evaluate_forecast(revenue_series, train_ratio=0.67, window=window)
    
    # ==========================================================================
    # Step 4: Build forecast period labels
    # ==========================================================================
    
    # Determine the next month after the last historical month
    last_month = historical_months[-1]
    next_year = last_month['year']
    next_month = last_month['month'] + 1
    
    if next_month > 12:
        next_month = 1
        next_year += 1
    
    forecast_monthly = []
    current_year = next_year
    current_month = next_month
    
    for i in range(horizon):
        key = get_month_key(current_year, current_month)
        label = get_month_label(current_year, current_month)
        
        forecast_monthly.append(MonthlyDataPoint(
            key=key,
            label=label,
            revenue=round(revenue_forecasts[i], 2),
            expenses=round(expense_forecasts[i], 2),
            netResult=round(revenue_forecasts[i] - expense_forecasts[i], 2),
            salesCount=int(round(sales_count_forecasts[i])),
        ))
        
        # Move to next month
        current_month += 1
        if current_month > 12:
            current_month = 1
            current_year += 1
    
    # ==========================================================================
    # Step 5: Build historical monthly response
    # ==========================================================================
    
    historical_monthly = [
        MonthlyDataPoint(
            key=get_month_key(m['year'], m['month']),
            label=get_month_label(m['year'], m['month']),
            revenue=round(m['revenue'], 2),
            expenses=round(m['expenses'], 2),
            netResult=round(m['revenue'] - m['expenses'], 2),
            salesCount=m['sales_count'],
        )
        for m in historical_months
    ]
    
    # ==========================================================================
    # Step 6: Calculate summary statistics
    # ==========================================================================
    
    hist_avg_revenue = sum(m['revenue'] for m in historical_months) / len(historical_months)
    hist_avg_expenses = sum(m['expenses'] for m in historical_months) / len(historical_months)
    hist_avg_sales = sum(m['sales_count'] for m in historical_months) / len(historical_months)
    hist_avg_net = hist_avg_revenue - hist_avg_expenses
    
    projected_revenue = sum(f.revenue for f in forecast_monthly)
    projected_expenses = sum(f.expenses for f in forecast_monthly)
    projected_net = projected_revenue - projected_expenses
    projected_sales = sum(f.salesCount for f in forecast_monthly)
    
    summary = ForecastingSummary(
        historicalAvgRevenue=round(hist_avg_revenue, 2),
        historicalAvgExpenses=round(hist_avg_expenses, 2),
        historicalAvgSalesCount=round(hist_avg_sales, 2),
        historicalAvgNet=round(hist_avg_net, 2),
        projectedRevenueTotal=round(projected_revenue, 2),
        projectedExpensesTotal=round(projected_expenses, 2),
        projectedNetTotal=round(projected_net, 2),
        projectedSalesTotal=projected_sales,
    )
    
    # ==========================================================================
    # Step 7: Inventory demand forecasting
    # ==========================================================================
    
    # Get current inventory levels (joined through Product for business_id)
    inventory_items = db.query(
        Inventory.product_id,
        Inventory.quantity_on_hand,
        Product.name,
        Product.sku,
        Product.reorder_level,
    ).join(
        Product, Inventory.product_id == Product.id
    ).filter(
        Product.business_id == business_id,
    ).all()
    
    inventory_forecasts = []
    
    for inv in inventory_items:
        # Get historical demand for this product (sum of sale item quantities)
        from app.models.sale import SaleItem
        demand_query = db.query(
            func.coalesce(func.sum(SaleItem.quantity), 0).label('total_demand'),
            func.count(func.distinct(
                func.date_trunc('month', Sale.sale_datetime)
            )).label('months_with_sales'),
        ).select_from(SaleItem).join(
            Sale, Sale.id == SaleItem.sale_id
        ).filter(
            SaleItem.product_id == inv.product_id,
            Sale.status == COMPLETED_STATUS,
        ).first()
        
        total_demand = float(demand_query.total_demand) if demand_query else 0.0
        months_with_sales = demand_query.months_with_sales if demand_query else 0
        
        # Calculate average monthly demand
        if months_with_sales > 0:
            avg_monthly_demand = total_demand / len(historical_months)
        else:
            avg_monthly_demand = 0.0
        
        # Project next month's demand (simple: use average)
        projected_demand = avg_monthly_demand
        
        # Estimate days until stockout
        current_qty = float(inv.quantity_on_hand)
        if avg_monthly_demand > 0:
            # Assume 30 days per month
            days_until_stockout = int((current_qty / avg_monthly_demand) * 30)
        else:
            days_until_stockout = None
        
        # Suggest restock quantity (2 months of demand if below reorder level)
        reorder_level = float(inv.reorder_level) if inv.reorder_level else 0.0
        if current_qty <= reorder_level and avg_monthly_demand > 0:
            suggested_restock = int(avg_monthly_demand * 2)
        else:
            suggested_restock = 0
        
        # Determine urgency
        if days_until_stockout is None:
            urgency = 'NONE'
        elif days_until_stockout <= 7:
            urgency = 'HIGH'
        elif days_until_stockout <= 30:
            urgency = 'MEDIUM'
        else:
            urgency = 'LOW'
        
        inventory_forecasts.append(InventoryForecastItem(
            productId=inv.product_id,
            productName=inv.name,
            productSku=inv.sku or '',
            currentQuantity=current_qty,
            lowStockThreshold=reorder_level,
            averageMonthlyDemand=round(avg_monthly_demand, 2),
            projectedDemandNextMonth=round(projected_demand, 2),
            estimatedDaysUntilStockout=days_until_stockout,
            suggestedRestockQuantity=suggested_restock,
            urgency=urgency,
        ))
    
    # ==========================================================================
    # Step 8: Build complete response
    # ==========================================================================
    
    first_month = historical_months[0]
    last_month = historical_months[-1]
    
    methodology = MethodologyInfo(
        label="Moving Average Forecast",
        description=(
            "Uses a 3-period moving average to project future revenue and expenses "
            "based on recent historical trends. Evaluation compares against a naive "
            "baseline (last observed value) using MAE, RMSE, and MASE metrics."
        ),
        lookbackMonths=len(historical_months),
        forecastMonths=horizon,
    )
    
    lookback = PeriodInfo(
        label=f"{get_month_label(first_month['year'], first_month['month'])} – "
              f"{get_month_label(last_month['year'], last_month['month'])}",
        start=get_month_key(first_month['year'], first_month['month']),
        end=get_month_key(last_month['year'], last_month['month']),
    )
    
    forecast_period = PeriodInfo(
        label=f"{forecast_monthly[0].label} – {forecast_monthly[-1].label}",
        start=forecast_monthly[0].key,
        end=forecast_monthly[-1].key,
    )
    
    data_quality = DataQualityInfo(
        monthsWithSales=months_with_sales,
        monthsWithExpenses=months_with_expenses,
        hasEnoughHistory=months_with_sales >= 6,
    )
    
    eval_metrics = EvaluationMetrics(**evaluation)
    
    return ForecastingResponse(
        methodology=methodology,
        lookback=lookback,
        forecastPeriod=forecast_period,
        historicalMonthly=historical_monthly,
        forecastMonthly=forecast_monthly,
        summary=summary,
        inventoryForecasts=inventory_forecasts,
        dataQuality=data_quality,
        evaluation=eval_metrics,
    )
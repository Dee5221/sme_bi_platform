"""
Forecasting API endpoint for SME BI Platform.
Provides revenue, expense, and inventory demand forecasting.
"""
import calendar

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, extract
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import require_permission
from app.models.user import User
from app.models.sale import Sale
from app.models.expense import Expense
from app.core.permissions import has_permission
from app.services.forecasting import select_forecast_method
from app.services.product_insights import (
    inventory_demand_forecasts,
    product_performance,
    profitability,
    resolve_period,
    stockout_notes,
)
from app.schemas.analytics import ProductPerformanceItem, ProfitabilityResponse
from app.schemas.forecasting import (
    ForecastingResponse,
    MonthlyDataPoint,
    InventoryForecastItem,
    ForecastingSummary,
    MethodologyInfo,
    PeriodInfo,
    DataQualityInfo,
    EvaluationMetrics,
    ForecastInsightNote,
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
    demand_horizon: int = Query(7, description="Daily product demand horizon: 7, 14, or 30"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("forecasting.view")),
):
    """
    Generate revenue, expense, and inventory demand forecasts.

    Monthly series compare SMA, WMA, naive, and seasonal naive with rolling-origin
    MAE. Product demand uses shop-open days and a daily forecast path.
    """
    if demand_horizon not in (7, 14, 30):
        raise HTTPException(
            status_code=422,
            detail="demand_horizon must be 7, 14, or 30",
        )
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
    
    window = min(3, len(historical_months))
    season_length = 12 if len(revenue_series) >= 24 else None

    revenue_forecasts, evaluation = select_forecast_method(
        revenue_series,
        horizon=horizon,
        window=window,
        season_length=season_length,
    )
    expense_forecasts, _ = select_forecast_method(
        expense_series,
        horizon=horizon,
        window=window,
        season_length=season_length,
    )
    sales_count_forecasts, _ = select_forecast_method(
        [float(value) for value in sales_count_series],
        horizon=horizon,
        window=window,
        season_length=season_length,
    )
    
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
    # Step 7: Product demand, performance, and historical-cost profit
    # ==========================================================================

    inventory_forecasts = [
        InventoryForecastItem(**item)
        for item in inventory_demand_forecasts(db, business_id, demand_horizon)
    ]
    insights = [
        ForecastInsightNote(**note)
        for note in stockout_notes(
            [item.model_dump() for item in inventory_forecasts],
            demand_horizon,
        )
    ]

    perf_start, perf_end = resolve_period(None, None, 30)
    performance = product_performance(db, business_id, perf_start, perf_end, limit=8)
    product_rows = [ProductPerformanceItem(**item) for item in performance["products"]]

    profit_payload = None
    if has_permission(current_user, "products.costs.view"):
        profit_payload = ProfitabilityResponse(
            **profitability(db, business_id, perf_start, perf_end, limit=8)
        )
    
    # ==========================================================================
    # Step 8: Build complete response
    # ==========================================================================
    
    first_month = historical_months[0]
    last_month = historical_months[-1]
    selected_label = evaluation.get("selected_label") or "3-period simple moving average"
    
    methodology = MethodologyInfo(
        label=selected_label,
        description=(
            f"Monthly revenue uses {selected_label}, selected by rolling-origin "
            "one-step MAE against a 3-period simple moving average baseline, "
            "weighted moving average (0.50 / 0.30 / 0.20), naive last-value, "
            "and seasonal naive when two full years exist. Product demand is a "
            f"{demand_horizon}-day path on shop-open days only. Negative forecasts "
            "are clamped to zero. Supplier lead time is not recorded, so restock "
            "figures are cover estimates, not reliable reorder points."
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
        demandHorizonDays=demand_horizon,
        productPerformance=product_rows,
        profitability=profit_payload,
        insights=insights,
    )
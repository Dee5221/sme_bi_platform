"""
Pydantic schemas for forecasting API responses.
"""
from pydantic import BaseModel
from typing import Optional, List


class MonthlyDataPoint(BaseModel):
    """Monthly aggregated data point."""
    key: str  # e.g., "2026-04"
    label: str  # e.g., "Apr 2026"
    revenue: float
    expenses: float
    netResult: float
    salesCount: int


class InventoryForecastItem(BaseModel):
    """Inventory demand forecast for a single product."""
    productId: int
    productName: str
    productSku: str
    currentQuantity: float
    lowStockThreshold: float
    averageMonthlyDemand: float
    projectedDemandNextMonth: float
    estimatedDaysUntilStockout: Optional[int]
    suggestedRestockQuantity: int
    urgency: str  # HIGH, MEDIUM, LOW, NONE


class ForecastingSummary(BaseModel):
    """Summary statistics for forecasting."""
    historicalAvgRevenue: float
    historicalAvgExpenses: float
    historicalAvgSalesCount: float
    historicalAvgNet: float
    projectedRevenueTotal: float
    projectedExpensesTotal: float
    projectedNetTotal: float
    projectedSalesTotal: int


class MethodologyInfo(BaseModel):
    """Information about the forecasting methodology."""
    label: str
    description: str
    lookbackMonths: int
    forecastMonths: int


class PeriodInfo(BaseModel):
    """Information about a time period."""
    label: str
    start: str
    end: str


class DataQualityInfo(BaseModel):
    """Information about data quality."""
    monthsWithSales: int
    monthsWithExpenses: int
    hasEnoughHistory: bool


class EvaluationMetrics(BaseModel):
    """Evaluation metrics for the forecast model."""
    train_periods: int
    test_periods: int
    window: int
    mae: Optional[float]
    rmse: Optional[float]
    mase: Optional[float]
    naive_mae: Optional[float]
    beats_baseline: bool
    mase_note: Optional[str] = None


class ForecastingResponse(BaseModel):
    """Complete forecasting response matching frontend contract."""
    methodology: MethodologyInfo
    lookback: PeriodInfo
    forecastPeriod: PeriodInfo
    historicalMonthly: List[MonthlyDataPoint]
    forecastMonthly: List[MonthlyDataPoint]
    summary: ForecastingSummary
    inventoryForecasts: List[InventoryForecastItem]
    dataQuality: DataQualityInfo
    evaluation: EvaluationMetrics


class ForecastingErrorResponse(BaseModel):
    """Error response for insufficient data."""
    error: str
    message: str
    monthsWithSales: int
    monthsWithExpenses: int
    requiredMonths: int
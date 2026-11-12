"""
Pydantic schemas for forecasting API responses.
"""
from pydantic import BaseModel
from typing import Optional, List

from app.schemas.analytics import ProductPerformanceItem, ProfitabilityResponse


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
    forecastDailyDemand: Optional[float] = None
    horizonDemand: Optional[float] = None
    demandHorizonDays: Optional[int] = None
    selectedMethod: Optional[str] = None
    selectedMethodLabel: Optional[str] = None
    reorderReliable: bool = False
    reorderNote: Optional[str] = None
    safetyStock: Optional[float] = None
    forecastPath: List[float] = []
    openDaysUsed: Optional[int] = None
    dataSufficient: bool = True
    evaluationMae: Optional[float] = None
    expectedRevenue: Optional[float] = None
    fallback: bool = False


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


class MethodCandidate(BaseModel):
    method: str
    label: str
    eligible: bool
    mae: Optional[float] = None
    rmse: Optional[float] = None
    origins: int = 0
    note: Optional[str] = None


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
    selected_method: Optional[str] = None
    selected_label: Optional[str] = None
    fallback: bool = False
    candidates: List[MethodCandidate] = []


class ForecastInsightNote(BaseModel):
    productName: Optional[str] = None
    period: str
    metric: str
    reason: str
    suggestedAction: str
    dataSufficient: bool


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
    demandHorizonDays: int = 7
    productPerformance: List[ProductPerformanceItem] = []
    profitability: Optional[ProfitabilityResponse] = None
    insights: List[ForecastInsightNote] = []


class ForecastingErrorResponse(BaseModel):
    """Error response for insufficient data."""
    error: str
    message: str
    monthsWithSales: int
    monthsWithExpenses: int
    requiredMonths: int
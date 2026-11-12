from pydantic import BaseModel
from typing import List, Optional


class SummaryResponse(BaseModel):
    total_revenue: float
    total_expenses: float
    net_cash_flow: float
    total_transactions: int
    aov: float
    low_stock_count: int
    period_start: str
    period_end: str


class SalesTrendPoint(BaseModel):
    period: str
    revenue: float
    transactions: int


class SalesByCategoryItem(BaseModel):
    category_name: str
    revenue: float
    units_sold: int


class InventoryHealthResponse(BaseModel):
    total_items: int
    low_stock_items: int
    total_inventory_value: Optional[float] = None
    note: Optional[str] = None


class TopProductItem(BaseModel):
    product_id: int
    product_name: str
    sku: str
    units_sold: float
    revenue: float


class ProductPerformanceItem(BaseModel):
    product_id: int
    product_name: str
    sku: str
    units_sold: float
    revenue: float
    observed_days: int
    sales_velocity: float
    rank_units: Optional[int] = None
    rank_velocity: Optional[int] = None
    rank_revenue: Optional[int] = None


class ProductPerformanceResponse(BaseModel):
    start: str
    end: str
    observed_days: int
    note: str
    products: List[ProductPerformanceItem]
    top_by_units: List[ProductPerformanceItem]
    top_by_velocity: List[ProductPerformanceItem]
    top_by_revenue: List[ProductPerformanceItem]


class ProfitabilityProductItem(BaseModel):
    product_id: int
    product_name: str
    sku: str
    units_sold: float
    revenue: float
    cogs: float
    gross_profit: float
    gross_margin_pct: Optional[float] = None
    classification: str = "typical"


class ProfitabilityResponse(BaseModel):
    available: bool
    reason: Optional[str] = None
    start: str
    end: str
    line_count: int
    costed_line_count: int
    coverage_pct: float
    revenue_all: float
    revenue_costed: float
    cogs: float
    gross_profit: Optional[float] = None
    gross_margin_pct: Optional[float] = None
    products: List[ProfitabilityProductItem] = []
    top_by_gross_profit: List[ProfitabilityProductItem] = []
    top_by_margin: List[ProfitabilityProductItem] = []
    high_volume_low_margin: List[ProfitabilityProductItem] = []
    low_volume_high_margin: List[ProfitabilityProductItem] = []
    negative_margin: List[ProfitabilityProductItem] = []
    note: Optional[str] = None
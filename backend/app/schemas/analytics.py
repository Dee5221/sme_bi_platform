from pydantic import BaseModel
from typing import Optional


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
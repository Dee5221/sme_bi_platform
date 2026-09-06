from pydantic import BaseModel, Field
from typing import Optional
from decimal import Decimal
from datetime import datetime

class StockOperationRequest(BaseModel):
    quantity: Decimal = Field(..., gt=0, description="Quantity must be greater than 0")
    reference: Optional[str] = None
    reason: Optional[str] = None

class StockAdjustmentRequest(BaseModel):
    new_quantity: Decimal = Field(..., ge=0, description="New quantity must be 0 or greater")
    reason: Optional[str] = None

class InventoryResponse(BaseModel):
    product_id: int
    product_name: str
    sku: str
    category_name: str
    quantity_on_hand: Decimal
    reorder_level: Decimal
    stock_status: str  # 'sufficient', 'low_stock', 'out_of_stock'
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class StockMovementResponse(BaseModel):
    id: int
    product_id: int
    user_id: int
    movement_type: str
    quantity: Decimal
    reference: Optional[str] = None
    reason: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
from pydantic import BaseModel, Field
from typing import Optional
from decimal import Decimal
from datetime import datetime

class SaleItemRequest(BaseModel):
    product_id: int
    quantity: Decimal = Field(..., gt=0, description="Quantity must be greater than 0")

class SaleCreateRequest(BaseModel):
    customer_id: Optional[int] = None
    payment_method: str
    items: list[SaleItemRequest] = Field(..., min_items=1, description="At least one item required")

class SaleItemResponse(BaseModel):
    id: int
    product_id: int
    product_name: str
    sku: str
    quantity: Decimal
    unit_price: Decimal
    subtotal: Decimal

    class Config:
        from_attributes = True

class SaleResponse(BaseModel):
    id: int
    business_id: int
    user_id: int
    user_name: str
    customer_id: Optional[int] = None
    customer_name: Optional[str] = None
    sale_datetime: datetime
    total_amount: Decimal
    payment_method: str
    status: str
    items: list[SaleItemResponse]

    class Config:
        from_attributes = True

class SaleListResponse(BaseModel):
    id: int
    sale_datetime: datetime
    total_amount: Decimal
    payment_method: str
    status: str
    user_name: str
    customer_name: Optional[str] = None
    item_count: int

    class Config:
        from_attributes = True
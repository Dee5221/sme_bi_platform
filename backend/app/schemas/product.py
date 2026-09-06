from pydantic import BaseModel
from typing import Optional
from decimal import Decimal

class ProductBase(BaseModel):
    sku: str
    name: str
    cost_price: Decimal
    selling_price: Decimal
    reorder_level: Decimal = Decimal("0.00")
    status: str = "active"

class ProductCreate(ProductBase):
    category_id: int
    supplier_id: Optional[int] = None

class ProductUpdate(BaseModel):
    sku: Optional[str] = None
    name: Optional[str] = None
    cost_price: Optional[Decimal] = None
    selling_price: Optional[Decimal] = None
    reorder_level: Optional[Decimal] = None
    category_id: Optional[int] = None
    supplier_id: Optional[int] = None
    status: Optional[str] = None

class ProductResponse(ProductBase):
    id: int
    business_id: int
    category_id: int
    supplier_id: Optional[int] = None

    class Config:
        from_attributes = True
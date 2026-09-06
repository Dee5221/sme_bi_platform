from pydantic import BaseModel
from typing import Optional

class SupplierBase(BaseModel):
    name: str
    contact: str
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    status: str = "active"

class SupplierCreate(SupplierBase):
    pass

class SupplierUpdate(BaseModel):
    name: Optional[str] = None
    contact: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    status: Optional[str] = None

class SupplierResponse(SupplierBase):
    id: int
    business_id: int

    class Config:
        from_attributes = True
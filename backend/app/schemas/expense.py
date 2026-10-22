from pydantic import BaseModel, Field
from typing import Optional
from datetime import date


class ExpenseBase(BaseModel):
    date: date
    category: str = Field(..., max_length=100)
    description: str = Field(..., max_length=255)
    amount: float = Field(..., ge=0)
    payment_method: str = Field(..., max_length=50)
    notes: Optional[str] = Field(None, max_length=500)


class ExpenseCreate(ExpenseBase):
    pass


class ExpenseUpdate(BaseModel):
    date: Optional[date] = None
    category: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = Field(None, max_length=255)
    amount: Optional[float] = Field(None, ge=0)
    payment_method: Optional[str] = Field(None, max_length=50)
    notes: Optional[str] = Field(None, max_length=500)


class ExpenseResponse(ExpenseBase):
    id: int
    business_id: int
    user_id: int

    class Config:
        from_attributes = True
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator

ALLOWED_CURRENCIES = ("ZMW", "USD", "ZAR", "EUR", "GBP")


class BusinessSettingsResponse(BaseModel):
    id: int
    name: str
    type: str
    contact: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: str
    currency: str
    report_header: Optional[str] = None
    receipt_footer: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class BusinessSettingsUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=150)
    type: Optional[str] = Field(None, min_length=1, max_length=50)
    contact: Optional[str] = Field(None, min_length=1, max_length=100)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=50)
    address: Optional[str] = Field(None, min_length=1, max_length=255)
    currency: Optional[str] = Field(None, min_length=3, max_length=10)
    report_header: Optional[str] = Field(None, max_length=150)
    receipt_footer: Optional[str] = Field(None, max_length=255)

    @field_validator("name", "type", "contact", "address", mode="before")
    @classmethod
    def strip_required(cls, value):
        if isinstance(value, str):
            return value.strip()
        return value

    @field_validator("currency")
    @classmethod
    def currency_allowed(cls, value: str | None) -> str | None:
        if value is None:
            return value
        code = value.strip().upper()
        if code not in ALLOWED_CURRENCIES:
            raise ValueError(f"Currency must be one of: {', '.join(ALLOWED_CURRENCIES)}")
        return code

    @field_validator("email", mode="before")
    @classmethod
    def empty_email(cls, value):
        if isinstance(value, str) and value.strip() == "":
            return None
        return value

    @field_validator("phone", "report_header", "receipt_footer", mode="before")
    @classmethod
    def empty_optional(cls, value):
        if isinstance(value, str):
            value = value.strip()
            return value or None
        return value

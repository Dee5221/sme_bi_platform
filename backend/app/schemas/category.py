from pydantic import BaseModel
from typing import Optional

class CategoryBase(BaseModel):
    name: str
    status: str = "active"

class CategoryCreate(CategoryBase):
    pass

class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None

class CategoryResponse(CategoryBase):
    id: int
    business_id: int

    class Config:
        from_attributes = True
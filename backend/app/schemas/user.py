from pydantic import BaseModel, EmailStr
from typing import Optional

class RoleResponse(BaseModel):
    id: int
    role_name: str
    class Config:
        from_attributes = True

class UserResponse(BaseModel):
    id: int
    name: str
    email: EmailStr
    role: RoleResponse
    status: str
    business_id: int
    class Config:
        from_attributes = True

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role_id: int
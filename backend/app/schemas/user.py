from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.core.security import validate_password_policy


class RoleResponse(BaseModel):
    id: int
    role_name: str

    class Config:
        from_attributes = True


class AssignableRoleResponse(BaseModel):
    id: int
    role_name: str
    description: Optional[str] = None


class UserResponse(BaseModel):
    id: int
    name: str
    email: EmailStr
    role: RoleResponse
    status: str
    business_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class MeResponse(UserResponse):
    permissions: list[str] = []
    role_name: Optional[str] = None


class UserCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    role_id: int

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr) -> str:
        return str(value).lower()

    @field_validator("password")
    @classmethod
    def password_rules(cls, value: str) -> str:
        return validate_password_policy(value)


class UserUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    email: Optional[EmailStr] = None
    role_id: Optional[int] = None
    status: Optional[str] = None

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr | None) -> str | None:
        if value is None:
            return value
        return str(value).lower()


class PasswordResetRequest(BaseModel):
    new_password: str = Field(..., min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def password_rules(cls, value: str) -> str:
        return validate_password_policy(value)


class PaginationMeta(BaseModel):
    page: int
    page_size: int
    total: int
    total_pages: int


class UserListResponse(BaseModel):
    items: list[UserResponse]
    pagination: PaginationMeta


class UserActivityEntry(BaseModel):
    id: int
    action: str
    entity: str
    entity_id: Optional[str] = None
    result: str
    created_at: datetime
    actor_name: str
    actor_email: Optional[str] = None


class UserDetailResponse(BaseModel):
    user: UserResponse
    recent_activity: list[UserActivityEntry]

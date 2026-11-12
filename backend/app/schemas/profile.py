from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

from app.core.security import validate_password_policy
from app.schemas.user import RoleResponse


class ProfileUserResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: int
    business_id: int
    name: str
    first_name: str = Field(alias="firstName")
    last_name: str = Field(alias="lastName")
    email: EmailStr
    status: str
    role: RoleResponse
    roles: list[RoleResponse]
    permissions: list[str] = []


class ProfileEnvelope(BaseModel):
    user: ProfileUserResponse


class ProfileUpdateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    first_name: str = Field(..., alias="firstName", min_length=1, max_length=50)
    last_name: str = Field(..., alias="lastName", min_length=1, max_length=50)
    email: EmailStr

    @field_validator("first_name", "last_name")
    @classmethod
    def strip_name(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("This field is required")
        return cleaned

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr) -> str:
        return str(value).lower()


class ProfilePasswordChangeRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    current_password: str = Field(..., alias="currentPassword", min_length=1, max_length=128)
    new_password: str = Field(..., alias="newPassword", min_length=8, max_length=128)
    confirm_password: str = Field(..., alias="confirmPassword", min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def password_rules(cls, value: str) -> str:
        return validate_password_policy(value)

    @model_validator(mode="after")
    def passwords_match(self):
        if self.new_password != self.confirm_password:
            raise ValueError("New passwords do not match")
        return self


class ProfilePasswordChangeResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    password_changed: bool = Field(alias="passwordChanged")
    access_token: str
    token_type: str = "bearer"

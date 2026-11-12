from typing import Optional

from pydantic import BaseModel


class PermissionItem(BaseModel):
    key: str
    group: str
    description: str


class RoleMatrixItem(BaseModel):
    id: Optional[int] = None
    role_name: str
    display_name: str
    description: str
    assignable: bool
    permission_keys: list[str]
    member_count: int = 0


class RoleMember(BaseModel):
    id: int
    name: str
    email: str
    status: str
    role_id: int
    role_name: str
    display_name: str
    assignable: bool


class RolesMatrixResponse(BaseModel):
    roles: list[RoleMatrixItem]
    permissions: list[PermissionItem]
    members: list[RoleMember]
    locked: bool = True
    note: str

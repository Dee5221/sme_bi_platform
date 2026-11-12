"""Read-only role and permission matrix. Permission sets are not editable."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_permission
from app.core.permissions import (
    canonical_role_name,
    display_role_name,
    get_user_role_name,
    permission_catalog,
    predefined_roles,
)
from app.models.role import Role
from app.models.user import User
from app.schemas.role import (
    PermissionItem,
    RoleMatrixItem,
    RoleMember,
    RolesMatrixResponse,
)

router = APIRouter(prefix="/api/roles", tags=["Roles"])

LOCKED_DETAIL = "Permission definitions cannot be changed from the application"
LOCKED_NOTE = (
    "Permission sets are defined in the application and enforced by the backend. "
    "They cannot be edited here. Assign Manager or Sales Staff to employees instead."
)


@router.get("/", response_model=RolesMatrixResponse)
def get_roles_matrix(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("roles.view")),
):
    db_roles = db.query(Role).order_by(Role.id.asc()).all()
    roles_by_name = {canonical_role_name(role.role_name): role for role in db_roles}

    members = (
        db.query(User)
        .options(joinedload(User.role))
        .filter(User.business_id == current_user.business_id)
        .order_by(User.id.asc())
        .all()
    )
    counts: dict[str, int] = {}
    member_items: list[RoleMember] = []
    for user in members:
        role_name = get_user_role_name(user) or ""
        counts[role_name] = counts.get(role_name, 0) + 1
        member_items.append(
            RoleMember(
                id=user.id,
                name=user.name,
                email=user.email,
                status=user.status,
                role_id=user.role_id,
                role_name=role_name,
                display_name=display_role_name(role_name),
                assignable=role_name != "Business Owner",
            )
        )

    role_items = []
    for spec in predefined_roles():
        stored = roles_by_name.get(spec["role_name"])
        role_items.append(
            RoleMatrixItem(
                id=stored.id if stored else None,
                role_name=spec["role_name"],
                display_name=spec["display_name"],
                description=spec["description"],
                assignable=spec["assignable"],
                permission_keys=spec["permission_keys"],
                member_count=counts.get(spec["role_name"], 0),
            )
        )

    return RolesMatrixResponse(
        roles=role_items,
        permissions=[PermissionItem(**item) for item in permission_catalog()],
        members=member_items,
        locked=True,
        note=LOCKED_NOTE,
    )


@router.put("/{role_id}/permissions")
def reject_permission_mutation(
    role_id: int,
    current_user: User = Depends(get_current_user),
):
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=LOCKED_DETAIL)

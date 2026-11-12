"""
Central permission registry.

Role names stored in the database remain:
  - Business Owner
  - Manager
  - Staff

"Sales Staff" is accepted as an alias of Staff.
Unknown roles receive no permissions (default deny).
"""
from __future__ import annotations

from typing import Iterable

ALL_PERMISSIONS: tuple[str, ...] = (
    "sales.create",
    "sales.view_own",
    "sales.view_all",
    "products.view",
    "products.manage",
    "products.prices.manage",
    "products.costs.view",
    "inventory.view",
    "inventory.manage",
    "customers.view",
    "customers.create",
    "customers.manage",
    "suppliers.view",
    "suppliers.manage",
    "expenses.view",
    "expenses.manage",
    "analytics.view",
    "forecasting.view",
    "recommendations.view",
    "reports.generate",
    "users.view",
    "users.manage",
    "roles.view",
    "roles.manage",
    "audit.view",
    "business.settings.manage",
    "profile.manage",
)

# Roles that an Owner may assign when creating employees.
ASSIGNABLE_EMPLOYEE_ROLES: frozenset[str] = frozenset({"Manager", "Staff"})

ROLE_ORDER: tuple[str, ...] = ("Business Owner", "Manager", "Staff")

ROLE_DESCRIPTIONS: dict[str, str] = {
    "Business Owner": "Full control of the business, including user accounts and settings.",
    "Manager": "Day-to-day operations, expenses, analytics, and recommendations. Cannot manage user accounts.",
    "Staff": "Point of sale, own sales history, product lookup, and customer lookup.",
}

PERMISSION_DESCRIPTIONS: dict[str, str] = {
    "sales.create": "Create sales at the point of sale.",
    "sales.view_own": "View sales recorded by this user.",
    "sales.view_all": "View all sales for the business.",
    "products.view": "Look up products and selling prices.",
    "products.manage": "Create and update products and categories.",
    "products.prices.manage": "Change selling prices.",
    "products.costs.view": "View cost prices and gross profit.",
    "inventory.view": "View on-hand stock.",
    "inventory.manage": "Receive, adjust, and move stock.",
    "customers.view": "Look up customers.",
    "customers.create": "Add customers during a sale.",
    "customers.manage": "Update and manage customer records.",
    "suppliers.view": "View suppliers.",
    "suppliers.manage": "Create and update suppliers.",
    "expenses.view": "View recorded expenses.",
    "expenses.manage": "Record and update expenses.",
    "analytics.view": "View business analytics dashboards.",
    "forecasting.view": "View demand forecasts.",
    "recommendations.view": "View advisory recommendations.",
    "reports.generate": "Generate PDF business reports.",
    "users.view": "View employee accounts.",
    "users.manage": "Create, update, and deactivate employee accounts.",
    "roles.view": "Review role permission assignments.",
    "roles.manage": "Reserved. Permission sets cannot be edited in this version.",
    "audit.view": "View the business activity log.",
    "business.settings.manage": "Change business profile and settings.",
    "profile.manage": "Update own profile and password.",
}

_STAFF: tuple[str, ...] = (
    "sales.create",
    "sales.view_own",
    "products.view",
    "inventory.view",
    "customers.view",
    "customers.create",
    "profile.manage",
)

_MANAGER: tuple[str, ...] = (
    "sales.create",
    "sales.view_own",
    "sales.view_all",
    "products.view",
    "products.manage",
    "products.costs.view",
    "inventory.view",
    "inventory.manage",
    "customers.view",
    "customers.create",
    "customers.manage",
    "suppliers.view",
    "suppliers.manage",
    "expenses.view",
    "expenses.manage",
    "analytics.view",
    "forecasting.view",
    "recommendations.view",
    "reports.generate",
    "profile.manage",
)

_OWNER: tuple[str, ...] = ALL_PERMISSIONS

ROLE_PERMISSIONS: dict[str, frozenset[str]] = {
    "Business Owner": frozenset(_OWNER),
    "Manager": frozenset(_MANAGER),
    "Staff": frozenset(_STAFF),
}

_ROLE_ALIASES: dict[str, str] = {
    "sales staff": "Staff",
    "staff": "Staff",
    "manager": "Manager",
    "business owner": "Business Owner",
    "owner": "Business Owner",
}


def canonical_role_name(role_name: str | None) -> str | None:
    if not role_name:
        return None
    return _ROLE_ALIASES.get(role_name.strip().lower(), role_name.strip())


def get_user_role_name(user) -> str | None:
    role = getattr(user, "role", None)
    if role is None:
        return None
    raw = getattr(role, "role_name", None)
    if isinstance(raw, str):
        return canonical_role_name(raw)
    if isinstance(role, str):
        return canonical_role_name(role)
    return None


def permissions_for_role(role_name: str | None) -> frozenset[str]:
    canonical = canonical_role_name(role_name)
    if not canonical:
        return frozenset()
    return ROLE_PERMISSIONS.get(canonical, frozenset())


def permissions_for_user(user) -> list[str]:
    return sorted(permissions_for_role(get_user_role_name(user)))


def has_permission(user, permission: str) -> bool:
    if not permission:
        return False
    return permission in permissions_for_role(get_user_role_name(user))


def has_any_permission(user, permissions: Iterable[str]) -> bool:
    granted = permissions_for_role(get_user_role_name(user))
    return any(permission in granted for permission in permissions)


def display_role_name(role_name: str | None) -> str:
    canonical = canonical_role_name(role_name)
    if canonical == "Staff":
        return "Sales Staff"
    return canonical or ""


def permission_catalog() -> list[dict]:
    items = []
    for key in ALL_PERMISSIONS:
        group = key.split(".", 1)[0]
        items.append(
            {
                "key": key,
                "group": group,
                "description": PERMISSION_DESCRIPTIONS.get(key, ""),
            }
        )
    return items


def predefined_roles() -> list[dict]:
    roles = []
    for name in ROLE_ORDER:
        roles.append(
            {
                "role_name": name,
                "display_name": display_role_name(name),
                "description": ROLE_DESCRIPTIONS.get(name, ""),
                "assignable": name in ASSIGNABLE_EMPLOYEE_ROLES,
                "permission_keys": sorted(ROLE_PERMISSIONS.get(name, frozenset())),
            }
        )
    return roles

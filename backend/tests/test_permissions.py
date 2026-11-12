from app.core.permissions import (
    ALL_PERMISSIONS,
    has_permission,
    permissions_for_role,
)


class Role:
    def __init__(self, role_name: str):
        self.role_name = role_name


class FakeUser:
    def __init__(self, role_name: str | None):
        self.role = Role(role_name) if role_name else None


def test_unknown_role_is_denied():
    user = FakeUser("Intern")
    assert permissions_for_role("Intern") == frozenset()
    assert has_permission(user, "sales.create") is False


def test_missing_role_is_denied():
    user = FakeUser(None)
    assert has_permission(user, "profile.manage") is False


def test_staff_alias_maps_to_staff_permissions():
    assert permissions_for_role("Sales Staff") == permissions_for_role("Staff")


def test_staff_cannot_access_intelligence_or_admin():
    user = FakeUser("Staff")
    denied = [
        "analytics.view",
        "forecasting.view",
        "recommendations.view",
        "reports.generate",
        "expenses.view",
        "suppliers.view",
        "inventory.manage",
        "products.manage",
        "products.prices.manage",
        "products.costs.view",
        "users.view",
        "users.manage",
        "roles.view",
        "audit.view",
        "business.settings.manage",
        "sales.view_all",
    ]
    for permission in denied:
        assert has_permission(user, permission) is False, permission

    allowed = [
        "sales.create",
        "sales.view_own",
        "products.view",
        "inventory.view",
        "customers.view",
        "customers.create",
        "profile.manage",
    ]
    for permission in allowed:
        assert has_permission(user, permission) is True, permission


def test_manager_cannot_administer_users_or_change_prices():
    user = FakeUser("Manager")
    assert has_permission(user, "users.manage") is False
    assert has_permission(user, "users.view") is False
    assert has_permission(user, "roles.manage") is False
    assert has_permission(user, "audit.view") is False
    assert has_permission(user, "business.settings.manage") is False
    assert has_permission(user, "products.prices.manage") is False
    assert has_permission(user, "analytics.view") is True
    assert has_permission(user, "forecasting.view") is True
    assert has_permission(user, "inventory.manage") is True
    assert has_permission(user, "products.costs.view") is True


def test_owner_has_every_registered_permission():
    user = FakeUser("Business Owner")
    for permission in ALL_PERMISSIONS:
        assert has_permission(user, permission) is True, permission

from app.core.permissions import has_permission, permissions_for_role

from tests.helpers import MANAGER, OWNER, STAFF, client, login

STAFF_NAV = {
    "My Sales Overview",
    "New Sale",
    "My Sales History",
    "Product Lookup",
    "Customer Lookup",
}

MANAGER_NAV = {
    "Dashboard",
    "New Sale",
    "Sales History",
    "Products",
    "Categories",
    "Stock In",
    "Stock Out / Adjustments",
    "Stock Movements",
    "Customers",
    "Suppliers",
    "Expenses",
    "Business Analytics",
    "Sales Analytics",
    "Inventory Analytics",
    "Customer Analytics",
    "Forecasting",
    "Recommendations",
    "Reports",
}

OWNER_ONLY_NAV = {
    "User Management",
    "Roles & Permissions",
    "Activity Log",
    "Business Settings",
}


class _User:
    def __init__(self, role_name: str):
        self.role = type("Role", (), {"role_name": role_name})()


def _visible_labels(role_name: str) -> set[str]:
    user = _User(role_name)
    granted = permissions_for_role(role_name)
    labels = set()
    staff_mode = has_permission(user, "sales.create") and not has_permission(user, "analytics.view")
    catalog = STAFF_NAV if staff_mode else (MANAGER_NAV | OWNER_ONLY_NAV)
    required = {
        "My Sales Overview": None,
        "Dashboard": None,
        "New Sale": "sales.create",
        "My Sales History": "sales.view_own",
        "Sales History": "sales.view_own",
        "Product Lookup": "products.view",
        "Products": "products.view",
        "Customer Lookup": "customers.view",
        "Customers": "customers.view",
        "Categories": "products.manage",
        "Stock In": "inventory.manage",
        "Stock Out / Adjustments": "inventory.manage",
        "Stock Movements": "inventory.view",
        "Suppliers": "suppliers.view",
        "Expenses": "expenses.view",
        "Business Analytics": "analytics.view",
        "Sales Analytics": "analytics.view",
        "Inventory Analytics": "analytics.view",
        "Customer Analytics": "analytics.view",
        "Forecasting": "forecasting.view",
        "Recommendations": "recommendations.view",
        "Reports": "reports.generate",
        "User Management": "users.view",
        "Roles & Permissions": "roles.view",
        "Activity Log": "audit.view",
        "Business Settings": "business.settings.manage",
    }
    for label in catalog:
        permission = required[label]
        if permission is None or permission in granted:
            labels.add(label)
    return labels


def test_staff_sidebar_is_counter_only():
    labels = _visible_labels("Staff")
    assert labels == STAFF_NAV
    assert labels.isdisjoint(OWNER_ONLY_NAV)
    assert "Forecasting" not in labels
    assert "Reports" not in labels
    assert "Gross profit" not in labels


def test_manager_sidebar_hides_administration():
    labels = _visible_labels("Manager")
    assert MANAGER_NAV <= labels
    assert labels.isdisjoint(OWNER_ONLY_NAV)


def test_owner_sidebar_includes_administration():
    labels = _visible_labels("Business Owner")
    assert OWNER_ONLY_NAV <= labels
    assert MANAGER_NAV <= labels


def test_staff_session_cannot_load_owner_dashboard_apis():
    api = client()
    headers = login(api, STAFF)
    me = api.get("/api/auth/me", headers=headers)
    assert me.status_code == 200
    permissions = set(me.json()["permissions"])
    assert "sales.create" in permissions
    assert "forecasting.view" not in permissions
    assert "analytics.view" not in permissions
    assert "products.costs.view" not in permissions
    assert api.get("/api/analytics/summary", headers=headers).status_code == 403
    assert api.get("/api/forecasting", headers=headers).status_code == 403
    sales = api.get("/api/sales/", headers=headers)
    assert sales.status_code == 200


def test_owner_dashboard_summary_returns_business_kpis():
    api = client()
    headers = login(api, OWNER)
    response = api.get("/api/analytics/summary", headers=headers)
    assert response.status_code == 200, response.text
    body = response.json()
    for key in ("total_revenue", "total_expenses", "net_cash_flow", "total_transactions", "low_stock_count"):
        assert key in body


def test_manager_can_open_forecasting_but_not_users():
    api = client()
    headers = login(api, MANAGER)
    assert api.get("/api/forecasting", headers=headers).status_code in (200, 422)
    assert api.get("/api/users/", headers=headers).status_code == 403
    assert api.get("/api/audit-logs/", headers=headers).status_code == 403

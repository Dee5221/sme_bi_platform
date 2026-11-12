from unittest.mock import MagicMock

from fastapi.testclient import TestClient

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.main import app


class Role:
    def __init__(self, role_name: str, role_id: int = 1):
        self.role_name = role_name
        self.id = role_id


class FakeUser:
    def __init__(self, role_name: str, user_id: int = 1, business_id: int = 1):
        self.id = user_id
        self.business_id = business_id
        self.status = "active"
        self.email = f"{role_name.replace(' ', '').lower()}@test.local"
        self.name = role_name
        self.role = Role(role_name)


def _fake_db():
    yield MagicMock()


def _client_as(user: FakeUser) -> TestClient:
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_db] = _fake_db
    return TestClient(app)


def teardown_function():
    app.dependency_overrides.clear()


PROTECTED_FOR_STAFF = [
    ("GET", "/api/analytics/summary"),
    ("GET", "/api/analytics/sales/trend"),
    ("GET", "/api/analytics/sales/by-category"),
    ("GET", "/api/analytics/inventory/health"),
    ("GET", "/api/analytics/top-products"),
    ("GET", "/api/analytics/product-performance"),
    ("GET", "/api/analytics/profitability"),
    ("GET", "/api/forecasting"),
    ("GET", "/api/recommendations"),
    ("GET", "/api/reports/types"),
    ("GET", "/api/reports/sales"),
    ("GET", "/api/expenses/"),
    ("GET", "/api/suppliers/"),
    ("GET", "/api/users/"),
    ("GET", "/api/users/roles"),
    ("GET", "/api/roles/"),
    ("GET", "/api/audit-logs/"),
    ("GET", "/api/business"),
    ("PATCH", "/api/business"),
]


def test_unauthenticated_requests_are_rejected():
    app.dependency_overrides.clear()
    client = TestClient(app)
    response = client.get("/api/analytics/summary")
    assert response.status_code == 401


def test_staff_is_forbidden_from_restricted_endpoints():
    client = _client_as(FakeUser("Staff", user_id=3))
    for method, path in PROTECTED_FOR_STAFF:
        response = client.request(method, path)
        assert response.status_code == 403, f"{method} {path} -> {response.status_code}"
        assert response.json()["detail"] == "Not authorized to access this resource"

    write_calls = [
        ("POST", "/api/users/", {"name": "Pat", "email": "pat@test.local", "password": "Password1", "role_id": 3}),
        ("POST", "/api/inventory/1/stock-in", {"quantity": 1}),
        ("POST", "/api/inventory/1/adjust", {"new_quantity": 5}),
    ]
    for method, path, body in write_calls:
        response = client.request(method, path, json=body)
        assert response.status_code == 403, f"{method} {path} -> {response.status_code}"


def test_manager_cannot_create_users():
    client = _client_as(FakeUser("Manager", user_id=2))
    response = client.post(
        "/api/users/",
        json={
            "name": "New Staff",
            "email": "newstaff@test.local",
            "password": "Password1",
            "role_id": 3,
        },
    )
    assert response.status_code == 403


def test_manager_cannot_read_audit_or_settings_routes_if_added_later():
    client = _client_as(FakeUser("Manager", user_id=2))
    assert client.get("/api/expenses/").status_code != 401
    # expenses.view is allowed; the mock DB may 500 — permission must not 403
    assert client.get("/api/expenses/").status_code != 403
    assert client.get("/api/business").status_code == 403
    assert client.patch("/api/business", json={"name": "Hijacked"}).status_code == 403

from fastapi.testclient import TestClient

from app.main import app

OWNER = ("owner@lusakawholesale.zm", "OwnerPass123!")
MANAGER = ("manager@lusakawholesale.zm", "ManagerPass123!")
STAFF = ("staff@lusakawholesale.zm", "StaffPass123!")


def client() -> TestClient:
    return TestClient(app)


def login(api: TestClient, creds: tuple[str, str]) -> dict[str, str]:
    response = api.post("/api/auth/login", json={"email": creds[0], "password": creds[1]})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def stock_map(api: TestClient, headers: dict[str, str]) -> dict[int, dict]:
    response = api.get("/api/inventory/", headers=headers)
    assert response.status_code == 200, response.text
    return {item["product_id"]: item for item in response.json()}


def product_map(api: TestClient, headers: dict[str, str]) -> dict[int, dict]:
    response = api.get("/api/products/", headers=headers)
    assert response.status_code == 200, response.text
    return {item["id"]: item for item in response.json()}

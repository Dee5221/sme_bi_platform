from fastapi.testclient import TestClient

from app.main import app

STAFF = ("staff@lusakawholesale.zm", "StaffPass123!")
OWNER = ("owner@lusakawholesale.zm", "OwnerPass123!")


def _login(client: TestClient, email: str, password: str) -> dict[str, str]:
    response = client.post("/api/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _stock_map(client: TestClient, headers: dict[str, str]) -> dict[int, dict]:
    response = client.get("/api/inventory/", headers=headers)
    assert response.status_code == 200, response.text
    return {item["product_id"]: item for item in response.json()}


def _product_map(client: TestClient, headers: dict[str, str]) -> dict[int, dict]:
    response = client.get("/api/products/", headers=headers)
    assert response.status_code == 200, response.text
    return {item["id"]: item for item in response.json()}


def test_staff_cannot_read_forecasting_or_profitability():
    client = TestClient(app)
    headers = _login(client, *STAFF)
    assert client.get("/api/forecasting", headers=headers).status_code == 403
    assert client.get("/api/analytics/profitability", headers=headers).status_code == 403
    assert client.get("/api/analytics/product-performance", headers=headers).status_code == 403


def test_demand_horizon_must_be_7_14_or_30():
    client = TestClient(app)
    headers = _login(client, *OWNER)
    response = client.get("/api/forecasting?demand_horizon=15", headers=headers)
    assert response.status_code == 422


def test_profitability_uses_snapshotted_cost_not_current_price():
    client = TestClient(app)
    headers = _login(client, *OWNER)
    stock = _stock_map(client, headers)
    products = _product_map(client, headers)
    product = next(
        (
            item
            for item in stock.values()
            if float(item["quantity_on_hand"]) >= 1 and products.get(item["product_id"], {}).get("cost_price") is not None
        ),
        None,
    )
    assert product is not None
    product_id = product["product_id"]
    original_cost = float(products[product_id]["cost_price"])

    before = client.get("/api/analytics/profitability?period=7", headers=headers)
    assert before.status_code == 200, before.text
    before_body = before.json()
    before_cogs = float(before_body["cogs"]) if before_body.get("available") else 0.0

    sale = client.post(
        "/api/sales/",
        headers=headers,
        json={"payment_method": "Cash", "items": [{"product_id": product_id, "quantity": 1}]},
    )
    assert sale.status_code == 201, sale.text

    bumped = original_cost + 50
    patch = client.patch(
        f"/api/products/{product_id}",
        headers=headers,
        json={"cost_price": bumped},
    )
    assert patch.status_code == 200, patch.text

    try:
        after = client.get("/api/analytics/profitability?period=7", headers=headers)
        assert after.status_code == 200, after.text
        body = after.json()
        assert body["available"] is True
        delta_cogs = float(body["cogs"]) - before_cogs
        assert abs(delta_cogs - original_cost) < 0.05
        assert abs(delta_cogs - bumped) > 1
        assert "current product cost" in (body.get("note") or "").lower()
    finally:
        restore = client.patch(
            f"/api/products/{product_id}",
            headers=headers,
            json={"cost_price": original_cost},
        )
        assert restore.status_code == 200, restore.text


def test_forecasting_marks_reorder_as_unreliable_without_lead_time():
    client = TestClient(app)
    headers = _login(client, *OWNER)
    response = client.get("/api/forecasting?months=6&horizon=3&demand_horizon=7", headers=headers)
    assert response.status_code in (200, 422), response.text
    if response.status_code != 200:
        return
    payload = response.json()
    assert payload["evaluation"]["selected_method"]
    assert payload["demandHorizonDays"] == 7
    for item in payload["inventoryForecasts"]:
        assert item["reorderReliable"] is False
        path = item.get("forecastPath") or []
        assert len(path) == 7
        assert all(value >= 0 for value in path)

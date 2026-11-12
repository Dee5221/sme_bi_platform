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


def test_insufficient_stock_does_not_create_sale_or_change_inventory():
    client = TestClient(app)
    headers = _login(client, *STAFF)
    stock = _stock_map(client, headers)
    product = next((item for item in stock.values() if float(item["quantity_on_hand"]) >= 0), None)
    assert product is not None
    product_id = product["product_id"]
    before = float(product["quantity_on_hand"])

    response = client.post(
        "/api/sales/",
        headers=headers,
        json={
            "payment_method": "Cash",
            "items": [{"product_id": product_id, "quantity": before + 1}],
        },
    )
    assert response.status_code == 400
    assert "Insufficient stock" in response.json()["detail"]

    after = _stock_map(client, headers)[product_id]
    assert float(after["quantity_on_hand"]) == before


def test_completed_sale_snapshots_items_and_deducts_stock():
    client = TestClient(app)
    headers = _login(client, *STAFF)
    stock = _stock_map(client, headers)
    product = next((item for item in stock.values() if float(item["quantity_on_hand"]) >= 2), None)
    assert product is not None
    product_id = product["product_id"]
    before = float(product["quantity_on_hand"])

    response = client.post(
        "/api/sales/",
        headers=headers,
        json={
            "payment_method": "Cash",
            "items": [{"product_id": product_id, "quantity": 1}],
        },
    )
    assert response.status_code == 201, response.text
    sale = response.json()
    assert sale["status"] == "completed"
    assert len(sale["items"]) == 1
    line = sale["items"][0]
    assert line["product_id"] == product_id
    assert line["product_name"] == product["product_name"]
    assert line["sku"] == product["sku"]
    assert float(line["quantity"]) == 1
    assert "unit_cost" not in line

    after = _stock_map(client, headers)[product_id]
    assert float(after["quantity_on_hand"]) == before - 1

    detail = client.get(f"/api/sales/{sale['id']}", headers=headers)
    assert detail.status_code == 200
    assert detail.json()["items"][0]["product_name"] == product["product_name"]

    movements = client.get("/api/inventory/movements", headers=headers)
    assert movements.status_code == 200
    refs = [row.get("reference") for row in movements.json()]
    assert f"SALE-{sale['id']}" in refs


def test_staff_cannot_view_another_users_sale():
    client = TestClient(app)
    owner_headers = _login(client, *OWNER)
    staff_headers = _login(client, *STAFF)

    owner_sales = client.get("/api/sales/", headers=owner_headers)
    assert owner_sales.status_code == 200
    foreign = next(
        (sale for sale in owner_sales.json() if sale["user_name"] and "Chileshe" not in sale["user_name"]),
        None,
    )
    assert foreign is not None

    response = client.get(f"/api/sales/{foreign['id']}", headers=staff_headers)
    assert response.status_code == 404


def test_owner_sale_detail_includes_unit_cost_when_snapshotted():
    client = TestClient(app)
    headers = _login(client, *OWNER)
    stock = _stock_map(client, headers)
    product = next((item for item in stock.values() if float(item["quantity_on_hand"]) >= 1), None)
    assert product is not None

    created = client.post(
        "/api/sales/",
        headers=headers,
        json={
            "payment_method": "Cash",
            "items": [{"product_id": product["product_id"], "quantity": 1}],
        },
    )
    assert created.status_code == 201, created.text
    line = created.json()["items"][0]
    assert line["unit_cost"] is not None
    assert line["product_name"]

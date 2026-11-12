from concurrent.futures import ThreadPoolExecutor, as_completed
from decimal import Decimal

from tests.helpers import OWNER, STAFF, client, login, product_map, stock_map


def test_sale_total_matches_itemised_lines_and_current_selling_price():
    api = client()
    headers = login(api, STAFF)
    stock = stock_map(api, headers)
    products = product_map(api, headers)
    product = next(item for item in stock.values() if float(item["quantity_on_hand"]) >= 2)
    product_id = product["product_id"]
    unit_price = Decimal(str(products[product_id]["selling_price"]))

    response = api.post(
        "/api/sales/",
        headers=headers,
        json={
            "payment_method": "Cash",
            "items": [{"product_id": product_id, "quantity": 2}],
        },
    )
    assert response.status_code == 201, response.text
    sale = response.json()
    assert len(sale["items"]) == 1
    line = sale["items"][0]
    assert Decimal(str(line["unit_price"])) == unit_price
    assert Decimal(str(line["subtotal"])) == unit_price * 2
    assert Decimal(str(sale["total_amount"])) == unit_price * 2


def test_historical_unit_price_does_not_change_after_price_update():
    api = client()
    owner = login(api, OWNER)
    stock = stock_map(api, owner)
    products = product_map(api, owner)
    product = next(item for item in stock.values() if float(item["quantity_on_hand"]) >= 1)
    product_id = product["product_id"]
    original_price = float(products[product_id]["selling_price"])

    created = api.post(
        "/api/sales/",
        headers=owner,
        json={"payment_method": "Card", "items": [{"product_id": product_id, "quantity": 1}]},
    )
    assert created.status_code == 201, created.text
    sale_id = created.json()["id"]
    snapshotted = float(created.json()["items"][0]["unit_price"])
    assert snapshotted == original_price

    bumped = api.patch(
        f"/api/products/{product_id}",
        headers=owner,
        json={"selling_price": original_price + 25},
    )
    assert bumped.status_code == 200, bumped.text
    try:
        detail = api.get(f"/api/sales/{sale_id}", headers=owner)
        assert detail.status_code == 200
        assert float(detail.json()["items"][0]["unit_price"]) == snapshotted
        assert float(detail.json()["items"][0]["unit_price"]) != original_price + 25
    finally:
        restore = api.patch(
            f"/api/products/{product_id}",
            headers=owner,
            json={"selling_price": original_price},
        )
        assert restore.status_code == 200, restore.text


def test_staff_sales_list_contains_only_own_transactions():
    api = client()
    staff = login(api, STAFF)
    owner = login(api, OWNER)
    me = api.get("/api/auth/me", headers=staff).json()
    staff_list = api.get("/api/sales/", headers=staff)
    owner_list = api.get("/api/sales/", headers=owner)
    assert staff_list.status_code == 200
    assert owner_list.status_code == 200
    staff_ids = {row["id"] for row in staff_list.json()}
    owner_ids = {row["id"] for row in owner_list.json()}
    assert staff_ids <= owner_ids
    assert me["name"]
    for row in staff_list.json():
        assert row["user_name"] == me["name"]


def test_concurrent_sales_never_drive_stock_negative():
    api = client()
    owner = login(api, OWNER)
    stock = stock_map(api, owner)
    product = next(item for item in stock.values() if float(item["quantity_on_hand"]) >= 1)
    product_id = product["product_id"]
    before = float(product["quantity_on_hand"])
    if before > 1:
        adjusted = api.post(
            f"/api/inventory/{product_id}/adjust",
            headers=owner,
            json={"new_quantity": 1, "reason": "acceptance concurrent stock lock"},
        )
        assert adjusted.status_code == 200, adjusted.text

    payload = {"payment_method": "Cash", "items": [{"product_id": product_id, "quantity": 1}]}

    def buy():
        local = client()
        headers = login(local, OWNER)
        return local.post("/api/sales/", headers=headers, json=payload)

    try:
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = [future.result() for future in as_completed([pool.submit(buy), pool.submit(buy)])]
        statuses = sorted(response.status_code for response in results)
        assert 201 in statuses
        assert statuses.count(201) == 1
        assert 400 in statuses
        after = float(stock_map(api, owner)[product_id]["quantity_on_hand"])
        assert after == 0
    finally:
        restore = api.post(
            f"/api/inventory/{product_id}/adjust",
            headers=owner,
            json={"new_quantity": before, "reason": "restore after concurrent sale test"},
        )
        assert restore.status_code == 200, restore.text

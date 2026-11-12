from tests.helpers import MANAGER, OWNER, STAFF, client, login, product_map, stock_map


def test_staff_cannot_see_cost_or_change_selling_price():
    api = client()
    staff = login(api, STAFF)
    products = api.get("/api/products/", headers=staff)
    assert products.status_code == 200, products.text
    item = products.json()[0]
    assert item.get("cost_price") is None
    product_id = item["id"]
    forbidden = api.patch(
        f"/api/products/{product_id}",
        headers=staff,
        json={"selling_price": 9999},
    )
    assert forbidden.status_code == 403


def test_manager_cannot_change_selling_price():
    api = client()
    manager = login(api, MANAGER)
    products = product_map(api, manager)
    product_id = next(iter(products))
    original = products[product_id]["selling_price"]
    forbidden = api.patch(
        f"/api/products/{product_id}",
        headers=manager,
        json={"selling_price": float(original) + 10},
    )
    assert forbidden.status_code == 403
    reloaded = product_map(api, manager)[product_id]
    assert str(reloaded["selling_price"]) == str(original)


def test_owner_can_change_selling_price_and_restore_it():
    api = client()
    owner = login(api, OWNER)
    stock = stock_map(api, owner)
    product_id = next(iter(stock))
    products = product_map(api, owner)
    original = float(products[product_id]["selling_price"])
    try:
        updated = api.patch(
            f"/api/products/{product_id}",
            headers=owner,
            json={"selling_price": original + 1},
        )
        assert updated.status_code == 200, updated.text
        assert float(updated.json()["selling_price"]) == original + 1
    finally:
        restore = api.patch(
            f"/api/products/{product_id}",
            headers=owner,
            json={"selling_price": original},
        )
        assert restore.status_code == 200, restore.text

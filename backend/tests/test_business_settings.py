from fastapi.testclient import TestClient

from app.main import app

STAFF = ("staff@lusakawholesale.zm", "StaffPass123!")
OWNER = ("owner@lusakawholesale.zm", "OwnerPass123!")
MANAGER = ("manager@lusakawholesale.zm", "ManagerPass123!")

PROFILE_FIELDS = (
    "name",
    "type",
    "contact",
    "email",
    "phone",
    "address",
    "currency",
    "report_header",
    "receipt_footer",
)


def _login(client: TestClient, email: str, password: str) -> dict[str, str]:
    response = client.post("/api/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_staff_and_manager_cannot_view_or_change_settings():
    client = TestClient(app)
    for creds in (STAFF, MANAGER):
        headers = _login(client, *creds)
        assert client.get("/api/business", headers=headers).status_code == 403
        patched = client.patch(
            "/api/business",
            headers=headers,
            json={"name": "Should Not Save", "receipt_footer": "blocked"},
        )
        assert patched.status_code == 403


def test_invalid_currency_is_rejected():
    client = TestClient(app)
    headers = _login(client, *OWNER)
    response = client.patch("/api/business", headers=headers, json={"currency": "BTC"})
    assert response.status_code == 422


def test_owner_settings_persist_and_are_audited():
    client = TestClient(app)
    headers = _login(client, *OWNER)
    original = client.get("/api/business", headers=headers)
    assert original.status_code == 200, original.text
    snapshot = original.json()
    assert snapshot["id"] > 0
    assert "usdToZmwRate" not in snapshot
    assert "isActive" not in snapshot

    marker = "Stage 11 footer"
    header = "Stage 11 Header"
    try:
        updated = client.patch(
            "/api/business",
            headers=headers,
            json={
                "phone": "+260 977 111 222",
                "report_header": header,
                "receipt_footer": marker,
                "currency": "ZMW",
            },
        )
        assert updated.status_code == 200, updated.text
        body = updated.json()
        assert body["id"] == snapshot["id"]
        assert body["phone"] == "+260 977 111 222"
        assert body["report_header"] == header
        assert body["receipt_footer"] == marker
        assert body["currency"] == "ZMW"

        reloaded = client.get("/api/business", headers=headers)
        assert reloaded.status_code == 200
        assert reloaded.json()["receipt_footer"] == marker
        assert reloaded.json()["report_header"] == header

        sales = client.get("/api/reports/sales", headers=headers)
        assert sales.status_code == 200
        assert header.encode("latin-1") in sales.content
        assert marker.encode("latin-1") in sales.content

        logs = client.get("/api/audit-logs/?page_size=50", headers=headers)
        assert logs.status_code == 200
        actions = {item["action"] for item in logs.json()["items"]}
        assert "business.settings.update" in actions
        matching = [
            item
            for item in logs.json()["items"]
            if item["action"] == "business.settings.update"
        ]
        assert matching
        assert matching[0]["entity"] == "business"
        assert str(snapshot["id"]) in str(matching[0].get("entity_id"))
    finally:
        restore = {field: snapshot.get(field) for field in PROFILE_FIELDS}
        client.patch("/api/business", headers=headers, json=restore)

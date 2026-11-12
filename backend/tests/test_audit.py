from fastapi.testclient import TestClient

from app.main import app

STAFF = ("staff@lusakawholesale.zm", "StaffPass123!")
OWNER = ("owner@lusakawholesale.zm", "OwnerPass123!")
MANAGER = ("manager@lusakawholesale.zm", "ManagerPass123!")


def _login(client: TestClient, email: str, password: str) -> dict[str, str]:
    response = client.post("/api/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_staff_and_manager_cannot_view_audit_log():
    client = TestClient(app)
    for creds in (STAFF, MANAGER):
        headers = _login(client, *creds)
        assert client.get("/api/audit-logs/", headers=headers).status_code == 403


def test_owner_sees_login_and_admin_events_without_secrets():
    client = TestClient(app)
    client.post("/api/auth/login", json={"email": OWNER[0], "password": "WrongPass1"})
    headers = _login(client, *OWNER)
    response = client.get("/api/audit-logs/?page_size=50", headers=headers)
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["retention_days"] == 365
    assert payload["pagination"]["total"] >= 1
    actions = {item["action"] for item in payload["items"]}
    assert "auth.login" in actions
    blob = str(payload).lower()
    assert "wrongpass" not in blob
    assert "ownerpass" not in blob
    for item in payload["items"]:
        assert "id" in item
        assert "created_at" in item
        assert "entity" in item
        assert "result" in item
        meta = item.get("metadata") or {}
        lowered_keys = {str(key).lower() for key in meta.keys()}
        assert "password" not in lowered_keys
        assert "token" not in lowered_keys
        assert "access_token" not in lowered_keys


def test_audit_records_cannot_be_deleted():
    client = TestClient(app)
    headers = _login(client, *OWNER)
    listing = client.get("/api/audit-logs/", headers=headers)
    assert listing.status_code == 200
    event_id = listing.json()["items"][0]["id"]
    deleted = client.delete(f"/api/audit-logs/{event_id}", headers=headers)
    assert deleted.status_code == 403
    patched = client.patch(f"/api/audit-logs/{event_id}", headers=headers, json={"result": "tampered"})
    assert patched.status_code == 403


def test_denied_access_and_report_generation_are_logged():
    client = TestClient(app)
    staff_headers = _login(client, *STAFF)
    assert client.get("/api/reports/sales", headers=staff_headers).status_code == 403

    owner_headers = _login(client, *OWNER)
    report = client.get("/api/reports/sales", headers=owner_headers)
    assert report.status_code == 200

    logs = client.get("/api/audit-logs/?page_size=50", headers=owner_headers)
    assert logs.status_code == 200
    actions = {item["action"] for item in logs.json()["items"]}
    assert "authz.denied" in actions
    assert "report.generate" in actions

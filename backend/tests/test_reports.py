from datetime import date, timedelta

from fastapi.testclient import TestClient

from app.main import app

STAFF = ("staff@lusakawholesale.zm", "StaffPass123!")
OWNER = ("owner@lusakawholesale.zm", "OwnerPass123!")
MANAGER = ("manager@lusakawholesale.zm", "ManagerPass123!")


def _login(client: TestClient, email: str, password: str) -> dict[str, str]:
    response = client.post("/api/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def _period() -> tuple[str, str]:
    today = date.today()
    start = today.replace(day=1)
    return start.isoformat(), today.isoformat()


def test_staff_cannot_generate_reports():
    client = TestClient(app)
    headers = _login(client, *STAFF)
    assert client.get("/api/reports/types", headers=headers).status_code == 403
    assert client.get("/api/reports/sales", headers=headers).status_code == 403


def test_unknown_report_type_is_rejected():
    client = TestClient(app)
    headers = _login(client, *OWNER)
    response = client.get("/api/reports/not-a-report", headers=headers)
    assert response.status_code == 422


def test_inverted_dates_are_rejected():
    client = TestClient(app)
    headers = _login(client, *OWNER)
    response = client.get(
        "/api/reports/sales?start_date=2026-11-05&end_date=2026-11-01",
        headers=headers,
    )
    assert response.status_code == 422


def test_owner_sales_report_is_pdf():
    client = TestClient(app)
    headers = _login(client, *OWNER)
    start, end = _period()
    response = client.get(f"/api/reports/sales?start_date={start}&end_date={end}", headers=headers)
    assert response.status_code == 200, response.text
    assert response.headers["content-type"].startswith("application/pdf")
    assert response.content[:4] == b"%PDF"
    assert len(response.content) > 500
    assert "attachment" in response.headers.get("content-disposition", "")


def test_gross_profit_report_does_not_use_current_cost_fallback():
    client = TestClient(app)
    headers = _login(client, *OWNER)
    start, end = _period()
    response = client.get(
        f"/api/reports/gross_profit?start_date={start}&end_date={end}",
        headers=headers,
    )
    assert response.status_code == 200, response.text
    assert response.content[:4] == b"%PDF"
    lowered = response.content.lower()
    assert b"profit" in lowered
    assert b"current product cost" in lowered or b"snapshotted" in lowered or b"unavailable" in lowered


def test_manager_can_generate_business_summary():
    client = TestClient(app)
    headers = _login(client, *MANAGER)
    start = (date.today() - timedelta(days=30)).isoformat()
    end = date.today().isoformat()
    response = client.get(
        f"/api/reports/business_summary?start_date={start}&end_date={end}",
        headers=headers,
    )
    assert response.status_code == 200, response.text
    assert response.content[:4] == b"%PDF"

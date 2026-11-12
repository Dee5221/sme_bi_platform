from datetime import timedelta
from uuid import uuid4

from fastapi.testclient import TestClient
from jose import jwt

from app.core.config import settings
from app.core.security import create_access_token
from app.main import app

OWNER = ("owner@lusakawholesale.zm", "OwnerPass123!")
STAFF = ("staff@lusakawholesale.zm", "StaffPass123!")


def _login(client: TestClient, email: str, password: str) -> dict[str, str]:
    response = client.post("/api/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_unknown_and_wrong_password_use_the_same_message():
    client = TestClient(app)
    missing = client.post(
        "/api/auth/login",
        json={"email": f"nobody-{uuid4().hex[:8]}@lusakawholesale.zm", "password": "DoesNotMatter1"},
    )
    wrong = client.post("/api/auth/login", json={"email": OWNER[0], "password": "DefinitelyWrong1"})
    assert missing.status_code == 401
    assert wrong.status_code == 401
    assert missing.json()["detail"] == "Incorrect email or password"
    assert wrong.json()["detail"] == missing.json()["detail"]


def test_login_rate_limit_after_repeated_failures():
    client = TestClient(app)
    email = f"ratelimit-{uuid4().hex[:8]}@lusakawholesale.zm"
    last = None
    for _ in range(6):
        last = client.post("/api/auth/login", json={"email": email, "password": "WrongPass1"})
    assert last is not None
    assert last.status_code == 429
    assert "try again later" in last.json()["detail"].lower()


def test_access_token_contains_required_claims_and_is_signed():
    client = TestClient(app)
    response = client.post("/api/auth/login", json={"email": OWNER[0], "password": OWNER[1]})
    token = response.json()["access_token"]
    payload = jwt.decode(
        token,
        settings.SECRET_KEY,
        algorithms=[settings.ALGORITHM],
        issuer=settings.JWT_ISSUER,
    )
    assert payload["sub"]
    assert payload["jti"]
    assert payload["typ"] == "access"
    assert payload["iss"] == settings.JWT_ISSUER
    assert "exp" in payload
    assert "iat" in payload


def test_expired_and_tampered_tokens_are_rejected():
    client = TestClient(app)
    expired = create_access_token({"sub": "1"}, expires_delta=timedelta(seconds=-30))
    expired_response = client.get("/api/auth/me", headers={"Authorization": f"Bearer {expired}"})
    assert expired_response.status_code == 401

    headers = _login(client, *OWNER)
    token = headers["Authorization"].split(" ", 1)[1]
    tampered = token[:-5] + ("aaaaa" if token[-5:] != "aaaaa" else "bbbbb")
    tampered_response = client.get("/api/auth/me", headers={"Authorization": f"Bearer {tampered}"})
    assert tampered_response.status_code == 401


def test_logout_revokes_the_current_token():
    client = TestClient(app)
    headers = _login(client, *OWNER)
    assert client.get("/api/auth/me", headers=headers).status_code == 200
    logout = client.post("/api/auth/logout", headers=headers)
    assert logout.status_code == 200
    assert client.get("/api/auth/me", headers=headers).status_code == 401


def test_http_only_auth_cookie_can_restore_the_session():
    client = TestClient(app)
    login = client.post("/api/auth/login", json={"email": OWNER[0], "password": OWNER[1]})
    assert login.status_code == 200
    set_cookie = login.headers.get("set-cookie", "").lower()
    assert settings.AUTH_COOKIE_NAME in set_cookie
    assert "httponly" in set_cookie
    restored = client.get("/api/auth/me")
    assert restored.status_code == 200
    assert restored.json()["email"] == OWNER[0]


def test_security_headers_are_present():
    client = TestClient(app)
    response = client.get("/")
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-Frame-Options"] == "DENY"
    assert response.headers["Referrer-Policy"] == "strict-origin-when-cross-origin"
    assert "default-src 'none'" in response.headers["Content-Security-Policy"]


def test_cors_does_not_allow_unknown_origins():
    client = TestClient(app)
    response = client.get("/", headers={"Origin": "https://evil.example"})
    assert response.headers.get("access-control-allow-origin") != "https://evil.example"


def test_staff_cannot_read_another_users_sale_by_guessing_ids():
    client = TestClient(app)
    owner_headers = _login(client, *OWNER)
    staff_headers = _login(client, *STAFF)
    stock = client.get("/api/inventory/", headers=owner_headers)
    assert stock.status_code == 200, stock.text
    product = next((item for item in stock.json() if float(item["quantity_on_hand"]) >= 1), None)
    assert product is not None
    created = client.post(
        "/api/sales/",
        headers=owner_headers,
        json={"payment_method": "Cash", "items": [{"product_id": product["product_id"], "quantity": 1}]},
    )
    assert created.status_code == 201, created.text
    response = client.get(f"/api/sales/{created.json()['id']}", headers=staff_headers)
    assert response.status_code == 404


def test_idempotent_sale_does_not_double_stock_deduction():
    client = TestClient(app)
    headers = _login(client, *STAFF)
    stock = client.get("/api/inventory/", headers=headers)
    assert stock.status_code == 200, stock.text
    product = next((item for item in stock.json() if float(item["quantity_on_hand"]) >= 2), None)
    assert product is not None
    product_id = product["product_id"]
    before = float(product["quantity_on_hand"])
    key = f"test-{uuid4().hex}"
    payload = {"payment_method": "Cash", "items": [{"product_id": product_id, "quantity": 1}]}
    first = client.post("/api/sales/", headers={**headers, "Idempotency-Key": key}, json=payload)
    second = client.post("/api/sales/", headers={**headers, "Idempotency-Key": key}, json=payload)
    assert first.status_code == 201, first.text
    assert second.status_code == 201, second.text
    assert first.json()["id"] == second.json()["id"]
    after = client.get("/api/inventory/", headers=headers)
    on_hand = next(item for item in after.json() if item["product_id"] == product_id)
    assert float(on_hand["quantity_on_hand"]) == before - 1

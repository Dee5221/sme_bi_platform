import uuid

from fastapi.testclient import TestClient

from app.main import app

STAFF = ("staff@lusakawholesale.zm", "StaffPass123!")
OWNER = ("owner@lusakawholesale.zm", "OwnerPass123!")
MANAGER = ("manager@lusakawholesale.zm", "ManagerPass123!")


def _login(client: TestClient, email: str, password: str) -> dict[str, str]:
    response = client.post("/api/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def _unique_email(prefix: str = "employee") -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}@lusakawholesale.zm"


def _staff_role_id(client: TestClient, headers: dict[str, str]) -> int:
    roles = client.get("/api/users/roles", headers=headers)
    assert roles.status_code == 200, roles.text
    staff = next(role for role in roles.json() if role["role_name"] == "Staff")
    return staff["id"]


def test_staff_cannot_view_or_create_users():
    client = TestClient(app)
    headers = _login(client, *STAFF)
    assert client.get("/api/users/", headers=headers).status_code == 403
    assert client.get("/api/users/roles", headers=headers).status_code == 403
    response = client.post(
        "/api/users/",
        headers=headers,
        json={
            "name": "Pat",
            "email": _unique_email("pat"),
            "password": "Password1",
            "role_id": 3,
        },
    )
    assert response.status_code == 403


def test_manager_cannot_create_or_list_users():
    client = TestClient(app)
    headers = _login(client, *MANAGER)
    assert client.get("/api/users/", headers=headers).status_code == 403
    response = client.post(
        "/api/users/",
        headers=headers,
        json={
            "name": "New Manager",
            "email": _unique_email("mgr"),
            "password": "Password1",
            "role_id": 2,
        },
    )
    assert response.status_code == 403


def test_owner_lists_users_without_password_hashes():
    client = TestClient(app)
    headers = _login(client, *OWNER)
    response = client.get("/api/users/?status=all", headers=headers)
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["pagination"]["total"] >= 3
    for item in payload["items"]:
        assert "password" not in item
        assert "password_hash" not in item
        assert "email" in item
        assert "status" in item
        assert "role" in item


def test_owner_cannot_assign_owner_role():
    client = TestClient(app)
    headers = _login(client, *OWNER)
    roles = client.get("/api/users/roles", headers=headers)
    assert roles.status_code == 200
    names = {role["role_name"] for role in roles.json()}
    assert names == {"Manager", "Staff"}

    me = client.get("/api/auth/me", headers=headers)
    owner_role_id = me.json()["role"]["id"]
    response = client.post(
        "/api/users/",
        headers=headers,
        json={
            "name": "Escalated",
            "email": _unique_email("owner-try"),
            "password": "Password1",
            "role_id": owner_role_id,
        },
    )
    assert response.status_code == 403


def test_weak_password_is_rejected():
    client = TestClient(app)
    headers = _login(client, *OWNER)
    role_id = _staff_role_id(client, headers)
    response = client.post(
        "/api/users/",
        headers=headers,
        json={
            "name": "Weak Pass",
            "email": _unique_email("weak"),
            "password": "password",
            "role_id": role_id,
        },
    )
    assert response.status_code == 422


def test_duplicate_email_is_rejected():
    client = TestClient(app)
    headers = _login(client, *OWNER)
    role_id = _staff_role_id(client, headers)
    response = client.post(
        "/api/users/",
        headers=headers,
        json={
            "name": "Copy",
            "email": STAFF[0],
            "password": "Password1",
            "role_id": role_id,
        },
    )
    assert response.status_code == 409


def test_last_owner_cannot_be_deactivated():
    client = TestClient(app)
    headers = _login(client, *OWNER)
    me = client.get("/api/auth/me", headers=headers)
    owner_id = me.json()["id"]
    self_deactivate = client.delete(f"/api/users/{owner_id}", headers=headers)
    assert self_deactivate.status_code == 400

    # Even if another client called update, the last owner stays active.
    demote = client.patch(
        f"/api/users/{owner_id}",
        headers=headers,
        json={"status": "inactive"},
    )
    assert demote.status_code == 400


def test_owner_creates_updates_and_deactivates_employee():
    client = TestClient(app)
    headers = _login(client, *OWNER)
    role_id = _staff_role_id(client, headers)
    email = _unique_email("clerk")
    created = client.post(
        "/api/users/",
        headers=headers,
        json={
            "name": "Counter Clerk",
            "email": email,
            "password": "TempPass123",
            "role_id": role_id,
        },
    )
    assert created.status_code == 201, created.text
    user = created.json()
    assert user["email"] == email
    assert user["role"]["role_name"] == "Staff"
    assert "password_hash" not in user
    user_id = user["id"]

    login_ok = client.post("/api/auth/login", json={"email": email, "password": "TempPass123"})
    assert login_ok.status_code == 200
    employee_headers = {"Authorization": f"Bearer {login_ok.json()['access_token']}"}

    reset = client.post(
        f"/api/users/{user_id}/reset-password",
        headers=headers,
        json={"new_password": "NewPass123"},
    )
    assert reset.status_code == 200, reset.text
    assert client.get("/api/auth/me", headers=employee_headers).status_code == 401

    old_login = client.post("/api/auth/login", json={"email": email, "password": "TempPass123"})
    assert old_login.status_code == 401
    new_login = client.post("/api/auth/login", json={"email": email, "password": "NewPass123"})
    assert new_login.status_code == 200
    employee_headers = {"Authorization": f"Bearer {new_login.json()['access_token']}"}

    updated = client.patch(
        f"/api/users/{user_id}",
        headers=headers,
        json={"name": "Counter Clerk Updated"},
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "Counter Clerk Updated"

    detail = client.get(f"/api/users/{user_id}", headers=headers)
    assert detail.status_code == 200
    activity = detail.json()["recent_activity"]
    actions = {entry["action"] for entry in activity}
    assert "user.create" in actions
    assert "user.password_reset" in actions
    for entry in activity:
        blob = str(entry).lower()
        assert "password" not in blob or "password_reset" in entry["action"]
        assert "temppass" not in blob
        assert "newpass" not in blob

    deactivated = client.delete(f"/api/users/{user_id}", headers=headers)
    assert deactivated.status_code == 200
    assert deactivated.json()["status"] == "inactive"

    me_after = client.get("/api/auth/me", headers=employee_headers)
    assert me_after.status_code == 401
    relogin = client.post("/api/auth/login", json={"email": email, "password": "NewPass123"})
    assert relogin.status_code == 401

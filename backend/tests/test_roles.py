import uuid

from fastapi.testclient import TestClient

from app.core.permissions import ROLE_PERMISSIONS, permissions_for_role
from app.main import app

STAFF = ("staff@lusakawholesale.zm", "StaffPass123!")
OWNER = ("owner@lusakawholesale.zm", "OwnerPass123!")
MANAGER = ("manager@lusakawholesale.zm", "ManagerPass123!")


def _login(client: TestClient, email: str, password: str) -> dict[str, str]:
    response = client.post("/api/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_staff_and_manager_cannot_view_roles():
    client = TestClient(app)
    for creds in (STAFF, MANAGER):
        headers = _login(client, *creds)
        assert client.get("/api/roles/", headers=headers).status_code == 403


def test_owner_sees_predefined_matrix_from_registry():
    client = TestClient(app)
    headers = _login(client, *OWNER)
    response = client.get("/api/roles/", headers=headers)
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["locked"] is True
    names = [role["display_name"] for role in payload["roles"]]
    assert names == ["Business Owner", "Manager", "Sales Staff"]
    by_name = {role["role_name"]: role for role in payload["roles"]}
    assert set(by_name["Staff"]["permission_keys"]) == set(permissions_for_role("Staff"))
    assert set(by_name["Manager"]["permission_keys"]) == set(ROLE_PERMISSIONS["Manager"])
    assert "users.manage" in by_name["Business Owner"]["permission_keys"]
    assert "users.manage" not in by_name["Manager"]["permission_keys"]
    assert "users.manage" not in by_name["Staff"]["permission_keys"]
    keys = {item["key"] for item in payload["permissions"]}
    assert keys == set(ROLE_PERMISSIONS["Business Owner"])
    assert any(member["role_name"] == "Business Owner" for member in payload["members"])


def test_permission_definitions_cannot_be_changed():
    client = TestClient(app)
    headers = _login(client, *OWNER)
    matrix = client.get("/api/roles/", headers=headers).json()
    owner_role = next(role for role in matrix["roles"] if role["role_name"] == "Business Owner")
    response = client.put(
        f"/api/roles/{owner_role['id']}/permissions",
        headers=headers,
        json={"permission_keys": ["sales.create"]},
    )
    assert response.status_code == 403
    assert "cannot be changed" in response.json()["detail"].lower()

    after = client.get("/api/roles/", headers=headers).json()
    after_owner = next(role for role in after["roles"] if role["role_name"] == "Business Owner")
    assert set(after_owner["permission_keys"]) == set(owner_role["permission_keys"])


def test_owner_can_assign_manager_and_change_is_audited():
    client = TestClient(app)
    headers = _login(client, *OWNER)
    matrix = client.get("/api/roles/", headers=headers).json()
    staff_role = next(role for role in matrix["roles"] if role["role_name"] == "Staff")
    manager_role = next(role for role in matrix["roles"] if role["role_name"] == "Manager")
    email = f"role-assign-{uuid.uuid4().hex[:8]}@lusakawholesale.zm"
    created = client.post(
        "/api/users/",
        headers=headers,
        json={
            "name": "Role Assignee",
            "email": email,
            "password": "Password1",
            "role_id": staff_role["id"],
        },
    )
    assert created.status_code == 201, created.text
    user_id = created.json()["id"]

    updated = client.patch(
        f"/api/users/{user_id}",
        headers=headers,
        json={"role_id": manager_role["id"]},
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["role"]["role_name"] == "Manager"

    detail = client.get(f"/api/users/{user_id}", headers=headers).json()
    actions = {entry["action"] for entry in detail["recent_activity"]}
    assert "user.role_change" in actions or "user.update" in actions
    client.delete(f"/api/users/{user_id}", headers=headers)


def test_last_owner_cannot_be_demoted_via_role_assignment():
    client = TestClient(app)
    headers = _login(client, *OWNER)
    me = client.get("/api/auth/me", headers=headers).json()
    roles = client.get("/api/roles/", headers=headers).json()
    staff_role = next(role for role in roles["roles"] if role["role_name"] == "Staff")
    response = client.patch(
        f"/api/users/{me['id']}",
        headers=headers,
        json={"role_id": staff_role["id"]},
    )
    assert response.status_code in {400, 403}

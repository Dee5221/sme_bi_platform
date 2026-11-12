import uuid

from pathlib import Path

from fastapi.testclient import TestClient

from tests.helpers import OWNER, STAFF, client, login


def _unique_email(prefix: str = "profile") -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}@lusakawholesale.zm"


def _staff_role_id(api: TestClient, headers: dict[str, str]) -> int:
    roles = api.get("/api/users/roles", headers=headers)
    assert roles.status_code == 200, roles.text
    return next(role["id"] for role in roles.json() if role["role_name"] == "Staff")


def _create_staff(api: TestClient, password: str = "Password1") -> tuple[str, dict[str, str]]:
    owner_headers = login(api, OWNER)
    email = _unique_email()
    created = api.post(
        "/api/users/",
        headers=owner_headers,
        json={
            "name": "Profile Tester",
            "email": email,
            "password": password,
            "role_id": _staff_role_id(api, owner_headers),
        },
    )
    assert created.status_code == 201, created.text
    return email, login(api, (email, password))


def test_unauthenticated_profile_is_rejected():
    api = client()
    assert api.get("/api/profile").status_code == 401


def test_staff_can_read_and_update_own_profile():
    api = client()
    email, headers = _create_staff(api)

    response = api.get("/api/profile", headers=headers)
    assert response.status_code == 200, response.text
    user = response.json()["user"]
    assert user["email"] == email
    assert user["firstName"] == "Profile"
    assert user["lastName"] == "Tester"
    assert "password_hash" not in user
    assert "profile.manage" in user["permissions"]

    updated = api.put(
        "/api/profile",
        headers=headers,
        json={
            "firstName": "Chi",
            "lastName": "Mwale",
            "email": email,
        },
    )
    assert updated.status_code == 200, updated.text
    payload = updated.json()["user"]
    assert payload["name"] == "Chi Mwale"
    assert payload["firstName"] == "Chi"
    assert payload["lastName"] == "Mwale"

    me = api.get("/api/auth/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["name"] == "Chi Mwale"


def test_profile_email_cannot_collide_inside_tenant():
    api = client()
    _, headers = _create_staff(api)
    conflict = api.put(
        "/api/profile",
        headers=headers,
        json={
            "firstName": "Chi",
            "lastName": "Mwale",
            "email": STAFF[0],
        },
    )
    assert conflict.status_code == 409


def test_staff_can_change_own_password_and_old_token_is_revoked():
    api = client()
    email, headers = _create_staff(api, password="Password1")

    wrong = api.put(
        "/api/profile/password",
        headers=headers,
        json={
            "currentPassword": "WrongPass1",
            "newPassword": "Password2",
            "confirmPassword": "Password2",
        },
    )
    assert wrong.status_code == 400

    mismatch = api.put(
        "/api/profile/password",
        headers=headers,
        json={
            "currentPassword": "Password1",
            "newPassword": "Password2",
            "confirmPassword": "Password3",
        },
    )
    assert mismatch.status_code == 422

    changed = api.put(
        "/api/profile/password",
        headers=headers,
        json={
            "currentPassword": "Password1",
            "newPassword": "Password2",
            "confirmPassword": "Password2",
        },
    )
    assert changed.status_code == 200, changed.text
    body = changed.json()
    assert body["passwordChanged"] is True
    new_token = body["access_token"]
    assert new_token

    stale = api.get("/api/profile", headers=headers)
    assert stale.status_code == 401

    fresh = {"Authorization": f"Bearer {new_token}"}
    assert api.get("/api/profile", headers=fresh).status_code == 200

    old_login = api.post("/api/auth/login", json={"email": email, "password": "Password1"})
    assert old_login.status_code == 401
    new_login = api.post("/api/auth/login", json={"email": email, "password": "Password2"})
    assert new_login.status_code == 200


def test_avatar_upload_is_not_implemented():
    api = client()
    headers = login(api, STAFF)
    response = api.post("/api/profile/avatar", headers=headers)
    assert response.status_code == 501


def test_provision_script_matches_live_user_model():
    source = Path(__file__).resolve().parents[1].joinpath("scripts", "provision_business.py").read_text(
        encoding="utf-8"
    )
    assert "password_hash" in source
    assert "role_id" in source
    assert "get_password_hash" in source
    assert "hashed_password" not in source
    assert "first_name=" not in source
    assert "role=" not in source or 'role="Business Owner"' not in source

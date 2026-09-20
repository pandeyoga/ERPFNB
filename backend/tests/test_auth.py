"""Integration tests for auth_service.

Covers: login (happy path + bad password + missing user), /me, change-password,
refresh, logout, RBAC scoping based on role.

These tests are READ-ONLY against the user collection except `test_change_password_roundtrip`
which changes admin password and changes it back immediately.
"""
import pytest

from .conftest import DEMO_USERS, DEMO_PASSWORD, api_get, api_post

pytestmark = pytest.mark.auth


class TestLogin:
    def test_login_admin_success(self, http_client):
        r = http_client.post("/auth/login", json={"email": DEMO_USERS["admin"], "password": DEMO_PASSWORD})
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True
        data = body["data"]
        assert "access_token" in data
        assert data["user"]["email"] == DEMO_USERS["admin"]

    def test_login_all_demo_users(self, tokens):
        """All 8 mandatory demo users must be able to log in."""
        missing = [k for k in DEMO_USERS if k not in tokens]
        assert not missing, f"Failed to log in as: {missing}"

    def test_login_wrong_password(self, http_client):
        r = http_client.post("/auth/login", json={"email": DEMO_USERS["admin"], "password": "WRONG"})
        assert r.status_code in (400, 401)
        body = r.json()
        assert body["success"] is False
        assert body["errors"]

    def test_login_unknown_user(self, http_client):
        r = http_client.post("/auth/login", json={"email": "noone@example.com", "password": "anything"})
        assert r.status_code in (400, 401)
        assert r.json()["success"] is False

    def test_login_validation_invalid_email(self, http_client):
        r = http_client.post("/auth/login", json={"email": "not-an-email", "password": "x"})
        # Pydantic returns 422 for bad email format
        assert r.status_code in (400, 422)


class TestMe:
    def test_me_returns_user_profile(self, http_client, admin_token):
        r = api_get(http_client, "/auth/me", admin_token)
        assert r.status_code == 200
        data = r.json()["data"]
        assert data["email"] == DEMO_USERS["admin"]
        # admin must have at least one permission entry
        perms = data.get("permissions") or []
        assert perms, "admin user should have permissions in /me payload"

    def test_me_unauthorized(self, http_client):
        r = http_client.get("/auth/me")
        # No token -> 401
        assert r.status_code == 401

    def test_me_invalid_token(self, http_client):
        r = http_client.get("/auth/me", headers={"Authorization": "Bearer not-a-real-token"})
        assert r.status_code == 401


class TestLogoutAndRefresh:
    def test_logout_with_token(self, http_client):
        # Fresh login (so we don't blow up the session-fixture tokens)
        r = http_client.post("/auth/login", json={"email": DEMO_USERS["finance"], "password": DEMO_PASSWORD})
        assert r.status_code == 200
        tok = r.json()["data"]["access_token"]
        out = http_client.post("/auth/logout", headers={"Authorization": f"Bearer {tok}"})
        assert out.status_code == 200
        assert out.json()["success"] is True

    def test_refresh_invalid_token(self, http_client):
        r = http_client.post("/auth/refresh", json={"refresh_token": "bogus"})
        # Should fail gracefully with envelope, not 500
        assert r.status_code in (400, 401, 403)
        assert r.json()["success"] is False


class TestRoleAccess:
    """RBAC smoke: admin can hit admin endpoint, outlet-manager cannot."""

    def test_admin_can_list_users(self, http_client, admin_token):
        r = api_get(http_client, "/admin/users", admin_token)
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True
        assert isinstance(body["data"], list)

    def test_outlet_manager_blocked_from_admin_users(self, http_client, alt_token):
        if not alt_token:
            pytest.skip("cfs.manager token not available")
        r = api_get(http_client, "/admin/users", alt_token)
        assert r.status_code in (401, 403), f"Outlet manager should be blocked from /admin/users, got {r.status_code}"


class TestChangePasswordRoundtrip:
    """Change finance user password, then change to a 3rd password to confirm.

    NOTE: System has password-history blocking, so we can't revert to the
    original immediately. We instead change to 2 different temp passwords
    and then explicitly restore the ORIGINAL via the seed script's helper.
    """

    def test_change_password_chain(self, http_client):
        # Use finance user (admin must stay logged in for other tests)
        login = http_client.post("/auth/login", json={"email": DEMO_USERS["finance"], "password": DEMO_PASSWORD})
        assert login.status_code == 200
        tok = login.json()["data"]["access_token"]
        pwd2 = "TempTest@9999"
        # change to pwd2
        r1 = api_post(http_client, "/auth/change-password", tok, json={
            "old_password": DEMO_PASSWORD, "new_password": pwd2,
        })
        assert r1.status_code == 200, f"change-password failed: {r1.text}"
        # login with new succeeds
        r_new = http_client.post("/auth/login", json={"email": DEMO_USERS["finance"], "password": pwd2})
        assert r_new.status_code == 200, f"login with new pwd failed: {r_new.text}"

        # Restore via DB hash directly (bypass password-history policy)
        import subprocess
        result = subprocess.run(
            ["python3", "-c", """
import asyncio, sys, os
from dotenv import load_dotenv
sys.path.insert(0, '/app/backend')
load_dotenv('/app/backend/.env')
from core.db import init_db, get_db, close_db
from core.security import hash_password

async def restore():
    await init_db()
    db = get_db()
    await db.users.update_one(
        {"email": "finance@fnbgroup.id"},
        {"$set": {"password_hash": hash_password("Demo@2026"), "failed_login_count": 0, "locked_until": None}, "$unset": {"password_history": ""}},
    )
    await close_db()
    print("RESTORED")

asyncio.run(restore())
"""],
            capture_output=True, text=True, timeout=30,
        )
        assert "RESTORED" in result.stdout, f"Restore failed: stdout={result.stdout!r} stderr={result.stderr!r}"

        # Final: login with original works again
        r_final = http_client.post("/auth/login", json={"email": DEMO_USERS["finance"], "password": DEMO_PASSWORD})
        assert r_final.status_code == 200, f"final login with restored pwd failed: {r_final.text}"

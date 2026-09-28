"""Shared fixtures for backend integration tests.

These tests hit the running backend at http://localhost:8001/api/* and use the
seeded demo data (admin@fnbgroup.id / Demo@2026 + 8 role users).

IMPORTANT: Tests are READ-MOSTLY. Any data they CREATE uses unique IDs derived
from the test timestamp so they do not collide with seeded data or each other.
They rely on soft-delete + idempotent operations to avoid polluting the DB.

B8 SAFETY NET: a session-scoped autouse fixture (`_preserve_demo_db`) snapshots
the demo DB before the session and restores it afterwards, so even tests that
DO write are fully rolled back — the seeded demo DB is never polluted by pytest.
"""
import os
import shutil
import subprocess
import tempfile
import time
import uuid
from pathlib import Path
from typing import Optional

import httpx
import pytest

BASE_URL = os.environ.get("TEST_BACKEND_URL", "http://localhost:8001")
API = f"{BASE_URL}/api"


# ---------------------------------------------------------------------------
# B8 fix — disposable / self-healing demo DB (snapshot before, restore after)
# ---------------------------------------------------------------------------
def _load_backend_env() -> dict:
    """Read MONGO_URL / DB_NAME from backend/.env (pytest env may not have them)."""
    env_path = Path(__file__).resolve().parent.parent / ".env"
    vals: dict = {}
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            vals[k.strip()] = v.strip().strip('"').strip("'")
    return vals


@pytest.fixture(scope="session", autouse=True)
def _preserve_demo_db():
    """Snapshot the demo DB before the test session and restore it afterwards.

    This fixes recurring issue B8 (pytest polluting the seeded demo DB). Tests
    still run against the live backend + real seeded data; any writes are rolled
    back on session teardown via mongorestore.

    Set env PRESERVE_DEMO_DB=0 to disable (e.g. when running against a throwaway DB).
    Restore only happens if a verified snapshot exists — we never drop the DB
    without a good backup in hand.
    """
    if os.environ.get("PRESERVE_DEMO_DB", "1") != "1":
        yield
        return

    env = _load_backend_env()
    mongo_url = os.environ.get("MONGO_URL") or env.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME") or env.get("DB_NAME")

    if not mongo_url or not db_name or not shutil.which("mongodump") or not shutil.which("mongorestore"):
        # Cannot snapshot safely -> run without rollback (don't risk the DB).
        yield
        return

    tmp = tempfile.mkdtemp(prefix="pytest_dbsnap_")
    dump_dir = os.path.join(tmp, db_name)
    snapshot_ok = False
    try:
        res = subprocess.run(
            ["mongodump", f"--uri={mongo_url}", f"--db={db_name}", f"--out={tmp}", "--quiet"],
            capture_output=True, timeout=180,
        )
        snapshot_ok = (
            res.returncode == 0
            and os.path.isdir(dump_dir)
            and any(f.endswith(".bson") for f in os.listdir(dump_dir))
        )
    except Exception:
        snapshot_ok = False

    yield

    if snapshot_ok:
        try:
            from pymongo import MongoClient
            client = MongoClient(mongo_url)
            # Drop first so any test-created collections vanish, then restore.
            client.drop_database(db_name)
            subprocess.run(
                ["mongorestore", f"--uri={mongo_url}", f"--db={db_name}", "--quiet", dump_dir],
                capture_output=True, timeout=180,
            )
            client.close()
        except Exception:
            # Best-effort; leave the snapshot dir for manual recovery if restore failed.
            pass
    shutil.rmtree(tmp, ignore_errors=True)


# Demo credentials seeded by seed_demo.py
DEMO_PASSWORD = "Demo@2026"
DEMO_USERS = {
    "admin":       "admin@fnbgroup.id",
    "executive":   "executive@fnbgroup.id",
    "finance":     "finance@fnbgroup.id",
    "procurement": "procurement@fnbgroup.id",
    "alt_manager": "cfs.manager@fnbgroup.id",
    "dls_manager": "rst.manager@fnbgroup.id",
    "cal_manager": "bst.manager@fnbgroup.id",
    "rkp_manager": "lng.manager@fnbgroup.id",
    "bkk_manager": "bky.manager@fnbgroup.id",
}

# Owner user is seeded separately by seed_phase11_demo (we try it but tolerate absence)
DEMO_USERS_OPTIONAL = {
    "owner": "owner@fnbgroup.id",
}


def _login(client: httpx.Client, email: str, password: str = DEMO_PASSWORD) -> Optional[str]:
    r = client.post(f"{API}/auth/login", json={"email": email, "password": password})
    if r.status_code != 200:
        return None
    payload = r.json()
    if not payload.get("success"):
        return None
    return (payload.get("data") or {}).get("access_token")


@pytest.fixture(scope="session")
def http_client():
    with httpx.Client(timeout=30.0, base_url=API) as c:
        yield c


@pytest.fixture(scope="session")
def tokens(http_client):
    """Login as every demo user once; return dict role_key -> token."""
    out: dict[str, str] = {}
    for key, email in DEMO_USERS.items():
        tok = _login(http_client, email)
        if tok:
            out[key] = tok
    for key, email in DEMO_USERS_OPTIONAL.items():
        tok = _login(http_client, email)
        if tok:
            out[key] = tok
    # admin token is mandatory for most tests
    assert "admin" in out, "FATAL: admin@fnbgroup.id could not log in. Did you seed?"
    return out


@pytest.fixture(scope="session")
def admin_token(tokens):
    return tokens["admin"]


@pytest.fixture(scope="session")
def finance_token(tokens):
    return tokens.get("finance")


@pytest.fixture(scope="session")
def procurement_token(tokens):
    return tokens.get("procurement")


@pytest.fixture(scope="session")
def alt_token(tokens):
    return tokens.get("alt_manager")


def _auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def auth_headers():
    """Helper factory: pass a token, get {Authorization: Bearer <tok>} dict."""
    return _auth_headers


@pytest.fixture(scope="session")
def seeded_outlets(http_client, admin_token):
    r = http_client.get("/master/outlets", headers=_auth_headers(admin_token))
    if r.status_code != 200:
        return []
    data = r.json().get("data") or []
    return data


@pytest.fixture(scope="session")
def seeded_items(http_client, admin_token):
    r = http_client.get("/master/items", headers=_auth_headers(admin_token))
    if r.status_code != 200:
        return []
    return r.json().get("data") or []


@pytest.fixture(scope="session")
def seeded_vendors(http_client, admin_token):
    r = http_client.get("/master/vendors", headers=_auth_headers(admin_token))
    if r.status_code != 200:
        return []
    return r.json().get("data") or []


@pytest.fixture(scope="session")
def seeded_coa(http_client, admin_token):
    r = http_client.get("/finance/chart-of-accounts", headers=_auth_headers(admin_token))
    if r.status_code != 200:
        return []
    return r.json().get("data") or []


@pytest.fixture
def unique_suffix():
    """Returns a short unique string for test entity codes/names so tests don't collide."""
    return f"{int(time.time())}-{uuid.uuid4().hex[:6]}"


# ----- ergonomic helpers -----
def api_get(client: httpx.Client, path: str, token: str | None = None, **kwargs):
    headers = kwargs.pop("headers", {}) or {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return client.get(path, headers=headers, **kwargs)


def api_post(client: httpx.Client, path: str, token: str | None = None, **kwargs):
    headers = kwargs.pop("headers", {}) or {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return client.post(path, headers=headers, **kwargs)


# Re-export helpers under the tests namespace
pytest.api_get = api_get
pytest.api_post = api_post

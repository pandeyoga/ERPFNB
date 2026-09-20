"""Smoke tests iteration 10 - environment health check."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://fnb-system-rebuild.preview.emergentagent.com").rstrip("/")
PASSWORD = "Demo@2026"

USERS = [
    "admin@fnbgroup.id",
    "owner@fnbgroup.id",
    "executive@fnbgroup.id",
    "finance@fnbgroup.id",
    "procurement@fnbgroup.id",
    "cfs.manager@fnbgroup.id",
]


def _login(email, password=PASSWORD):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=30)
    return r


def test_health():
    r = requests.get(f"{BASE_URL}/api/health", timeout=15)
    assert r.status_code == 200


@pytest.mark.parametrize("email", USERS)
def test_login_all_demo_users(email):
    # small spacing to avoid rate limit
    time.sleep(0.6)
    r = _login(email)
    assert r.status_code == 200, f"{email} -> {r.status_code} {r.text[:200]}"
    body = r.json()
    assert body.get("success") is True
    data = body.get("data") or {}
    assert data.get("access_token"), f"no access_token for {email}"


@pytest.fixture(scope="module")
def admin_token():
    time.sleep(0.5)
    r = _login("admin@fnbgroup.id")
    assert r.status_code == 200
    return r.json()["data"]["access_token"]


def _auth_get(token, path):
    return requests.get(f"{BASE_URL}{path}", headers={"Authorization": f"Bearer {token}"}, timeout=30)


def test_master_outlets(admin_token):
    r = _auth_get(admin_token, "/api/master/outlets")
    assert r.status_code == 200, r.text[:300]
    body = r.json()
    # accept list or {data:[...]} envelope
    items = body.get("data", body) if isinstance(body, dict) else body
    if isinstance(items, dict):
        items = items.get("items") or items.get("outlets") or []
    assert isinstance(items, list)
    assert len(items) >= 5, f"expected 5+ outlets, got {len(items)}"
    codes = {(i.get("code") or "").upper() for i in items}
    expected = {"CFS", "RST", "BST", "LNG", "BKY"}
    assert expected.issubset(codes), f"missing outlet codes; got {codes}"


def test_master_brands(admin_token):
    r = _auth_get(admin_token, "/api/master/brands")
    assert r.status_code == 200, r.text[:300]


def test_master_bank_accounts(admin_token):
    r = _auth_get(admin_token, "/api/master/bank-accounts")
    assert r.status_code == 200, r.text[:300]


def test_journal_entries(admin_token):
    # Try a few common paths
    candidates = [
        "/api/finance/journal-entries",
        "/api/finance/journals",
        "/api/finance/journal_entries",
    ]
    last = None
    for p in candidates:
        r = _auth_get(admin_token, p)
        last = (p, r.status_code, r.text[:200])
        if r.status_code == 200:
            return
    pytest.fail(f"No journal list endpoint returned 200. Last: {last}")

"""Iteration 15 backend regression tests: RBAC, payroll doc_no, cash position,
cashflow/P&L, AR PPN, public reservation, journal doc_no."""
import os
import pytest
import requests
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://outlet-salary-mgmt.preview.emergentagent.com').rstrip('/')
PWD = "Demo@2026"


def _login(email: str) -> str:
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": PWD}, timeout=30)
    assert r.status_code == 200, f"login {email} failed: {r.status_code} {r.text[:200]}"
    body = r.json()
    tok = (body.get("data") or {}).get("access_token") or body.get("access_token")
    assert tok, f"no token for {email}: {body}"
    return tok


@pytest.fixture(scope="module")
def tokens():
    return {
        "admin": _login("admin@fnbgroup.id"),
        "exec": _login("executive@fnbgroup.id"),
        "cfs": _login("cfs.manager@fnbgroup.id"),
        "hr_officer": _login("hr.officer@fnbgroup.id"),
        "hr_manager": _login("hr.manager@fnbgroup.id"),
    }


def _h(tok): return {"Authorization": f"Bearer {tok}"}


# ---- Regression: login + basic pages -------------------------------------
def test_login_admin(tokens):
    assert tokens["admin"]


# ---- RBAC on executive + CRM admin analytics -----------------------------
def test_crm_analytics_admin(tokens):
    r = requests.get(f"{BASE_URL}/api/admin/crm/analytics/overview", headers=_h(tokens["admin"]), timeout=30)
    assert r.status_code == 200, r.text[:300]


def test_executive_home_admin(tokens):
    r = requests.get(f"{BASE_URL}/api/executive/home", headers=_h(tokens["admin"]), timeout=30)
    assert r.status_code == 200, r.text[:300]


def test_executive_home_executive(tokens):
    r = requests.get(f"{BASE_URL}/api/executive/home", headers=_h(tokens["exec"]), timeout=30)
    assert r.status_code == 200, r.text[:300]


def test_executive_home_outlet_manager_forbidden(tokens):
    r = requests.get(f"{BASE_URL}/api/executive/home", headers=_h(tokens["cfs"]), timeout=30)
    assert r.status_code == 403, f"expected 403 got {r.status_code}: {r.text[:200]}"


def test_executive_outlet_drilldown_forbidden_for_other_outlet(tokens):
    # find outlets
    r = requests.get(f"{BASE_URL}/api/master/outlets?per_page=50", headers=_h(tokens["admin"]), timeout=30)
    assert r.status_code == 200
    body = r.json()
    outlets = body.get("data") or []
    if isinstance(outlets, dict):
        outlets = outlets.get("items") or outlets.get("data") or []
    # pick an outlet whose code is NOT CFS
    other = next((o for o in outlets if (o.get("code") or "").upper() != "CFS"), None)
    assert other, "no non-CFS outlet found"
    oid = other.get("id") or other.get("_id")
    r2 = requests.get(f"{BASE_URL}/api/executive/outlet/{oid}/drilldown?period=2026-08",
                      headers=_h(tokens["cfs"]), timeout=30)
    assert r2.status_code == 403, f"expected 403, got {r2.status_code}: {r2.text[:200]}"


# ---- Payroll RBAC + doc_no prefix ----------------------------------------
def test_hr_payroll_list_hr_officer(tokens):
    r = requests.get(f"{BASE_URL}/api/hr/payroll", headers=_h(tokens["hr_officer"]), timeout=30)
    assert r.status_code == 200, r.text[:300]


def test_hr_payroll_create_doc_no_prefix(tokens):
    period = "2027-05"
    payload = {"period": period, "outlet_id": None}
    r = requests.post(f"{BASE_URL}/api/hr/payroll", json=payload,
                      headers=_h(tokens["hr_manager"]), timeout=60)
    if r.status_code == 403:
        # HR manager may not have create right; try admin
        r = requests.post(f"{BASE_URL}/api/hr/payroll", json=payload,
                          headers=_h(tokens["admin"]), timeout=60)
    assert r.status_code in (200, 201), f"create payroll: {r.status_code} {r.text[:400]}"
    body = r.json()
    data = body.get("data") or body
    doc = data.get("doc_no") or data.get("docNo") or ""
    pid = data.get("id") or data.get("_id")
    assert doc.startswith("PAYR-"), f"doc_no not PAYR- prefixed: {doc!r}"
    # cleanup
    if pid:
        rc = requests.post(f"{BASE_URL}/api/hr/payroll/{pid}/cancel",
                           json={"reason": "test cleanup"},
                           headers=_h(tokens["admin"]), timeout=30)
        assert rc.status_code in (200, 204), f"cancel failed: {rc.status_code} {rc.text[:200]}"


# ---- Finance cash position + cashflow + P&L ------------------------------
def test_cash_position_fields(tokens):
    r = requests.get(f"{BASE_URL}/api/finance/cash/position", headers=_h(tokens["admin"]), timeout=30)
    assert r.status_code == 200, r.text[:300]
    data = r.json().get("data") or r.json()
    assert "gl_cash_balance" in data, f"missing gl_cash_balance: keys={list(data.keys())}"
    assert "variance_manual_vs_gl" in data, f"missing variance_manual_vs_gl: keys={list(data.keys())}"


def test_cashflow(tokens):
    r = requests.get(f"{BASE_URL}/api/finance/cashflow?period=2026-08", headers=_h(tokens["admin"]), timeout=30)
    assert r.status_code == 200, r.text[:300]


def test_profit_loss(tokens):
    r = requests.get(f"{BASE_URL}/api/finance/profit-loss?period=2026-08", headers=_h(tokens["admin"]), timeout=30)
    assert r.status_code == 200, r.text[:300]


def test_outlet_drilldown_admin(tokens):
    r = requests.get(f"{BASE_URL}/api/master/outlets?per_page=50", headers=_h(tokens["admin"]), timeout=30)
    outlets = r.json().get("data") or []
    if isinstance(outlets, dict):
        outlets = outlets.get("items") or outlets.get("data") or []
    assert outlets
    oid = outlets[0].get("id") or outlets[0].get("_id")
    r2 = requests.get(f"{BASE_URL}/api/executive/outlet/{oid}/drilldown?period=2026-08",
                      headers=_h(tokens["admin"]), timeout=30)
    assert r2.status_code == 200, r2.text[:300]
    data = r2.json().get("data") or r2.json()
    # pl should exist with revenue/cogs fields
    pl = data.get("pl") or {}
    assert isinstance(pl, dict), f"pl missing/invalid: {data}"
    assert "revenue" in pl or "cogs" in pl, f"pl lacks revenue/cogs: {pl}"


# ---- Public reservation invalid outlet -----------------------------------
def test_public_reservation_bad_outlet():
    payload = {
        "outlet_id": "nonexistent-outlet-" + uuid.uuid4().hex[:8],
        "customer_name": "TEST_regression",
        "customer_phone": "081234567890",
        "pax": 2,
        "reservation_date": "2027-08-15",
        "reservation_time": "19:00",
    }
    r = requests.post(f"{BASE_URL}/api/public/reservations", json=payload, timeout=30)
    assert r.status_code == 400, f"expected 400 got {r.status_code}: {r.text[:200]}"


# ---- Journals doc_no + je_number -----------------------------------------
def test_journals_have_doc_no(tokens):
    r = requests.get(f"{BASE_URL}/api/finance/journals?limit=20", headers=_h(tokens["admin"]), timeout=30)
    assert r.status_code == 200, r.text[:300]
    body = r.json().get("data") or r.json()
    items = body if isinstance(body, list) else (body.get("items") or body.get("data") or [])
    if not items:
        pytest.skip("no journal entries seeded")
    missing = [j for j in items if not (j.get("doc_no") or j.get("je_number"))]
    assert not missing, f"{len(missing)} journals missing doc_no/je_number"

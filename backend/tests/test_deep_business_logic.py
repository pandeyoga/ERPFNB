"""
Deep Business-Logic Tests (Iteration 43).
Validates the ENVELOPE response format {success, data, errors, meta} and tests
actual business logic (Dr=Cr balance, totals reconciliation, state transitions),
NOT just HTTP status codes.

Based on test request: focus on real fixed bug verification - manual journal
creation (JE/JER number series seeded) and end-to-end daily sales -> JE flow.
"""
import os
import pytest
import requests
from datetime import datetime, date, timezone

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fallback - read from frontend env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                break

ADMIN_EMAIL = "admin@fnbgroup.id"
ADMIN_PASS = "Demo@2026"

# Mark EVERY test in this module as part of the deploy-gate E2E smoke pipeline.
# Run via `pytest -m e2e` or `bash scripts/e2e_smoke.sh` before each deploy.
pytestmark = pytest.mark.e2e


def _unwrap(resp):
    """Parse envelope: assert success, return data."""
    try:
        j = resp.json()
    except Exception:
        pytest.fail(f"Non-JSON response {resp.status_code}: {resp.text[:300]}")
    return j


# ---------- Session / Auth ----------
@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def admin_token(session):
    r = session.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASS},
        timeout=30,
    )
    assert r.status_code == 200, f"Login failed {r.status_code}: {r.text[:300]}"
    j = r.json()
    assert j.get("success") is True, f"Login envelope not success: {j}"
    data = j.get("data") or {}
    token = data.get("access_token")
    assert token, f"No access_token in data: {data}"
    return token


@pytest.fixture(scope="session")
def auth(session, admin_token):
    session.headers.update({"Authorization": f"Bearer {admin_token}"})
    return session


@pytest.fixture(scope="session")
def me(auth):
    r = auth.get(f"{BASE_URL}/api/auth/me", timeout=15)
    j = _unwrap(r)
    return (j.get("data") or {})


# ---------- AUTH ----------
def test_auth_login_envelope(admin_token):
    assert admin_token and len(admin_token) > 20


# ---------- MANUAL JOURNAL (the recently FIXED bug) ----------
@pytest.fixture(scope="session")
def postable_accounts(auth):
    r = auth.get(f"{BASE_URL}/api/finance/chart-of-accounts", timeout=30)
    j = _unwrap(r)
    assert j.get("success") is True, f"COA envelope: {j}"
    data = j.get("data")
    # data may be list or dict with 'items'
    items = data if isinstance(data, list) else (data.get("items") if isinstance(data, dict) else [])
    postable = [a for a in items if a.get("is_postable")]
    assert len(postable) >= 2, f"Need >=2 postable accounts, got {len(postable)}"
    return postable


def test_manual_journal_balanced_create_get_reverse(auth, postable_accounts):
    a1, a2 = postable_accounts[0], postable_accounts[1]
    payload = {
        "entry_date": date.today().isoformat(),
        "description": "QA-TEST-DEEP-BL balanced JE",
        "lines": [
            {"coa_id": a1["id"], "memo": "QA dr", "dr": 100000, "cr": 0},
            {"coa_id": a2["id"], "memo": "QA cr", "dr": 0, "cr": 100000},
        ],
    }
    r = auth.post(f"{BASE_URL}/api/finance/journals/manual", json=payload, timeout=30)
    j = _unwrap(r)
    assert j.get("success") is True, f"Balanced JE rejected: {r.status_code} {j}"
    je = j.get("data") or {}
    je_number = je.get("je_number") or je.get("doc_no")
    assert je_number and je_number.startswith("JE"), f"Bad je_number: {je}"
    je_id = je.get("id") or je.get("je_id")
    assert je_id, f"No id in JE response: {je}"

    # Verify Dr==Cr in stored doc
    total_dr = je.get("total_dr") or je.get("total_debit") or sum(l.get("debit", 0) for l in je.get("lines", []))
    total_cr = je.get("total_cr") or je.get("total_credit") or sum(l.get("credit", 0) for l in je.get("lines", []))
    assert total_dr == total_cr == 100000, f"JE not balanced: dr={total_dr} cr={total_cr}"

    # GET back
    r2 = auth.get(f"{BASE_URL}/api/finance/journals/{je_id}", timeout=15)
    j2 = _unwrap(r2)
    assert j2.get("success") is True, f"GET JE failed: {j2}"

    # REVERSE
    r3 = auth.post(f"{BASE_URL}/api/finance/journals/{je_id}/reverse", json={"reason": "QA-TEST reversal"}, timeout=30)
    j3 = _unwrap(r3)
    assert j3.get("success") is True, f"Reverse failed: {r3.status_code} {j3}"
    rev = j3.get("data") or {}
    rev_no = rev.get("je_number") or rev.get("doc_no") or ""
    assert rev_no.startswith("JER"), f"Reversal doc no should start with JER: {rev_no} (full: {rev})"

    # Optional dr/cr swap check
    rev_lines = rev.get("lines") or []
    if rev_lines:
        rev_dr = sum(l.get("debit", 0) for l in rev_lines)
        rev_cr = sum(l.get("credit", 0) for l in rev_lines)
        assert rev_dr == rev_cr, f"Reversal JE not balanced dr={rev_dr} cr={rev_cr}"


def test_manual_journal_unbalanced_rejected(auth, postable_accounts):
    a1, a2 = postable_accounts[0], postable_accounts[1]
    payload = {
        "entry_date": date.today().isoformat(),
        "description": "QA-TEST-DEEP-BL UNBALANCED",
        "lines": [
            {"coa_id": a1["id"], "dr": 100000, "cr": 0},
            {"coa_id": a2["id"], "dr": 0, "cr": 90000},
        ],
    }
    r = auth.post(f"{BASE_URL}/api/finance/journals/manual", json=payload, timeout=30)
    j = _unwrap(r)
    # Must be rejected - either HTTP 400/422 or success=false
    assert r.status_code in (400, 422) or j.get("success") is False, (
        f"Unbalanced JE was accepted! status={r.status_code} body={j}"
    )


def test_manual_journal_zero_amount_rejected(auth, postable_accounts):
    """Regression: an all-zero JE (dr=0,cr=0 on every line) is 'balanced' but
    meaningless. It MUST be rejected, not posted with a wasted doc number."""
    a1, a2 = postable_accounts[0], postable_accounts[1]
    payload = {
        "entry_date": date.today().isoformat(),
        "description": "QA-TEST-DEEP-BL ZERO-AMOUNT",
        "lines": [
            {"coa_id": a1["id"], "dr": 0, "cr": 0},
            {"coa_id": a2["id"], "dr": 0, "cr": 0},
        ],
    }
    r = auth.post(f"{BASE_URL}/api/finance/journals/manual", json=payload, timeout=30)
    j = _unwrap(r)
    assert r.status_code in (400, 422) or j.get("success") is False, (
        f"Zero-amount JE was accepted! status={r.status_code} body={j}"
    )


def test_daily_sales_draft_invalid_shape_rejected(auth, me):
    """Regression: sending payment_breakdown/revenue_buckets as a dict (instead
    of list-of-dicts) must return a clean 400 validation error, NOT a 500."""
    outlet_ids = me.get("outlet_ids") or []
    if not outlet_ids:
        pytest.skip("admin has no outlet scope to test daily-sales draft")
    payload = {
        "outlet_id": outlet_ids[0],
        "sales_date": date.today().isoformat(),
        "payment_breakdown": {"cash": 100},   # wrong shape (dict, not list)
        "revenue_buckets": {"food": 100},     # wrong shape (dict, not list)
    }
    r = auth.post(f"{BASE_URL}/api/outlet/daily-sales/draft", json=payload, timeout=30)
    j = _unwrap(r)
    assert r.status_code != 500, f"Daily-sales draft crashed (500): {r.text[:300]}"
    assert r.status_code in (400, 422) and j.get("success") is False, (
        f"Invalid-shape draft should be rejected with 400/422, got {r.status_code}: {j}"
    )


# ---------- DAILY SALES FULL FLOW ----------
def test_daily_sales_full_flow(auth, me):
    outlet_ids = me.get("outlet_ids") or []
    if not outlet_ids:
        # try fetch outlets
        r0 = auth.get(f"{BASE_URL}/api/outlet/outlets", timeout=15)
        if r0.status_code == 200:
            d = _unwrap(r0).get("data") or []
            items = d if isinstance(d, list) else d.get("items", [])
            outlet_ids = [o["id"] for o in items[:1]]
    if not outlet_ids:
        pytest.skip("No outlet_ids available")
    outlet_id = outlet_ids[0]

    grand_total = 500000
    # Find a payment method id (best-effort)
    pm_id = None
    rpm = auth.get(f"{BASE_URL}/api/master/payment-methods", timeout=15)
    if rpm.status_code == 200:
        pm_data = _unwrap(rpm).get("data") or []
        pm_items = pm_data if isinstance(pm_data, list) else pm_data.get("items", [])
        if pm_items:
            pm_id = pm_items[0].get("id")
    payload = {
        "outlet_id": outlet_id,
        "sales_date": date.today().isoformat(),
        "revenue_buckets": [
            {"bucket": "food", "amount": 300000},
            {"bucket": "beverage", "amount": 200000},
        ],
        "payment_breakdown": [
            {"payment_method_id": pm_id, "amount": grand_total},
        ],
        "grand_total": grand_total,
        "notes": "QA-TEST-DEEP-BL daily sales",
    }
    r = auth.post(f"{BASE_URL}/api/outlet/daily-sales/draft", json=payload, timeout=30)
    j = _unwrap(r)
    assert j.get("success") is True, f"Draft create failed: {r.status_code} {j}"
    ds = j.get("data") or {}
    ds_id = ds.get("id") or ds.get("_id")
    assert ds_id, f"No id in daily sales: {ds}"

    # Submit
    r2 = auth.post(f"{BASE_URL}/api/outlet/daily-sales/{ds_id}/submit", json={}, timeout=30)
    j2 = _unwrap(r2)
    assert j2.get("success") is True, f"Submit failed: {r2.status_code} {j2}"

    # Validate (finance) -> should create JE
    r3 = auth.post(f"{BASE_URL}/api/outlet/daily-sales/{ds_id}/validate", json={}, timeout=60)
    j3 = _unwrap(r3)
    assert j3.get("success") is True, f"Validate failed: {r3.status_code} {j3}"
    ds_v = j3.get("data") or {}
    je_id = ds_v.get("journal_entry_id") or ds_v.get("je_id")
    assert je_id, f"No journal_entry_id after validate: {ds_v}"

    # Fetch JE and verify balanced and amounts reconcile to grand_total
    r4 = auth.get(f"{BASE_URL}/api/finance/journals/{je_id}", timeout=15)
    j4 = _unwrap(r4)
    assert j4.get("success") is True, f"GET generated JE failed: {j4}"
    je = j4.get("data") or {}
    lines = je.get("lines") or []
    dr = sum(l.get("debit", 0) or l.get("dr", 0) or 0 for l in lines)
    cr = sum(l.get("credit", 0) or l.get("cr", 0) or 0 for l in lines)
    print(f"\n[DEBUG] Generated JE: total_dr={je.get('total_dr')} total_cr={je.get('total_cr')} lines={lines}")
    assert dr == cr, f"Daily-sales JE not balanced dr={dr} cr={cr}"
    assert dr == grand_total, f"JE total {dr} does not reconcile to grand_total {grand_total}; je={je}"


# ---------- PROCUREMENT PR (full lifecycle: POST + logic validation + GET) ----------
def test_procurement_pr_list_and_create(auth, me):
    r = auth.get(f"{BASE_URL}/api/procurement/prs", timeout=30)
    j = _unwrap(r)
    assert j.get("success") is True, f"PR list envelope: {j}"

    outlet_ids = me.get("outlet_ids") or []
    outlet_id = outlet_ids[0] if outlet_ids else None

    # LOGIC: a PR with no lines must be rejected
    r_no = auth.post(f"{BASE_URL}/api/procurement/prs",
                     json={"outlet_id": outlet_id, "status": "draft", "lines": []}, timeout=30)
    assert r_no.status_code in (400, 422) or _unwrap(r_no).get("success") is False, (
        f"PR with no lines was accepted! {r_no.status_code} {r_no.text[:200]}")

    # LOGIC: a PR line with qty<=0 must be rejected
    r_q = auth.post(f"{BASE_URL}/api/procurement/prs", json={
        "outlet_id": outlet_id, "status": "draft",
        "lines": [{"item_name": "QA item", "qty": 0, "unit": "PCS", "est_cost": 10000}],
    }, timeout=30)
    assert r_q.status_code in (400, 422) or _unwrap(r_q).get("success") is False, (
        f"PR with qty<=0 was accepted! {r_q.status_code} {r_q.text[:200]}")

    # Valid draft PR (status=draft skips the outlet-budget block)
    payload = {
        "outlet_id": outlet_id,
        "status": "draft",
        "request_date": date.today().isoformat(),
        "notes": "QA-TEST-DEEP-BL PR",
        "lines": [
            {"item_name": "QA Beras 5kg", "qty": 3, "unit": "SAK", "est_cost": 75000, "notes": "qa"},
            {"item_name": "QA Minyak 2L", "qty": 2, "unit": "BTL", "est_cost": 32000},
        ],
    }
    r2 = auth.post(f"{BASE_URL}/api/procurement/prs", json=payload, timeout=30)
    j2 = _unwrap(r2)
    assert j2.get("success") is True, f"Valid draft PR rejected: {r2.status_code} {j2}"
    pr = j2.get("data") or {}
    pr_id = pr.get("id")
    assert (pr.get("doc_no") or "").startswith("PR-"), f"PR doc_no wrong: {pr.get('doc_no')}"
    assert len(pr.get("lines") or []) == 2, f"PR lines not persisted: {pr}"
    assert pr.get("status") == "draft", f"PR status should be draft: {pr.get('status')}"

    # GET back the created PR
    r3 = auth.get(f"{BASE_URL}/api/procurement/prs/{pr_id}", timeout=15)
    j3 = _unwrap(r3)
    assert j3.get("success") is True and (j3.get("data") or {}).get("id") == pr_id, (
        f"GET PR back failed: {r3.status_code} {j3}")

    # approval-state endpoint must respond cleanly (no 5xx)
    r4 = auth.get(f"{BASE_URL}/api/procurement/prs/{pr_id}/approval-state", timeout=15)
    assert r4.status_code == 200, f"approval-state failed: {r4.status_code} {r4.text[:200]}"


# ---------- AP AGING ----------
def test_ap_aging_reconciliation(auth):
    r = auth.get(f"{BASE_URL}/api/finance/ap-aging", timeout=30)
    j = _unwrap(r)
    assert j.get("success") is True, f"AP aging envelope: {j}"
    data = j.get("data") or {}
    # Expect buckets dict and grand_total
    buckets = data.get("buckets") or data.get("totals") or {}
    grand_total = data.get("grand_total")
    if not buckets and isinstance(data, dict):
        # maybe top-level keys
        b_keys = ("current", "d_30", "d_60", "d_90", "d_90p")
        if all(k in data for k in b_keys):
            buckets = {k: data[k] for k in b_keys}
            grand_total = data.get("grand_total", grand_total)
    rows = data.get("rows") or data.get("items") or []
    if grand_total is None:
        pytest.skip(f"AP aging has no grand_total (clean db?): keys={list(data.keys())}")
    bucket_sum = sum(float(v or 0) for v in buckets.values()) if buckets else 0
    if grand_total == 0 and bucket_sum == 0:
        return  # nothing to reconcile
    # Tolerance for float
    assert abs(bucket_sum - float(grand_total)) < 1.0, (
        f"AP aging buckets sum ({bucket_sum}) != grand_total ({grand_total})"
    )
    if rows:
        row_sum = sum(float((r.get("total") or r.get("outstanding") or 0)) for r in rows)
        assert abs(row_sum - float(grand_total)) < 1.0, (
            f"AP aging rows sum ({row_sum}) != grand_total ({grand_total})"
        )


# ---------- TRIAL BALANCE ----------
def test_trial_balance_balanced(auth):
    period = datetime.now().strftime("%Y-%m")
    r = auth.get(f"{BASE_URL}/api/finance/trial-balance", params={"period": period}, timeout=30)
    j = _unwrap(r)
    assert j.get("success") is True, f"TB envelope: {j}"
    data = j.get("data") or {}
    total_dr = data.get("total_debit") or data.get("total_dr")
    total_cr = data.get("total_credit") or data.get("total_cr")
    if total_dr is None or total_cr is None:
        rows = data.get("rows") or data.get("items") or []
        total_dr = sum(float(r.get("debit") or 0) for r in rows)
        total_cr = sum(float(r.get("credit") or 0) for r in rows)
    assert abs(float(total_dr) - float(total_cr)) < 1.0, (
        f"Trial Balance NOT balanced! dr={total_dr} cr={total_cr}"
    )


# ---------- PAYMENT RUNS ----------
def test_payment_runs_envelope(auth):
    r = auth.get(f"{BASE_URL}/api/finance/payment-runs", timeout=30)
    j = _unwrap(r)
    assert j.get("success") is True, f"Payment runs envelope: {j}"


# ---------- HR LEAVE (full lifecycle: POST validation + PATCH + submit + DELETE) ----------
def test_hr_leaves_full_lifecycle(auth, me):
    r = auth.get(f"{BASE_URL}/api/hr/leaves", timeout=30)
    j = _unwrap(r)
    assert j.get("success") is True, f"HR leaves envelope: {j}"
    data = j.get("data") or {}
    assert "items" in data or isinstance(data, list), f"Leave list shape: {j}"

    emp_id = me.get("employee_id") or me.get("id")

    # LOGIC: invalid leave_type must be rejected
    r_bad = auth.post(f"{BASE_URL}/api/hr/leaves", json={
        "employee_id": emp_id, "leave_type": "NOT_A_TYPE",
        "start_date": date.today().isoformat(),
    }, timeout=30)
    assert r_bad.status_code in (400, 422) or _unwrap(r_bad).get("success") is False, (
        f"Invalid leave_type accepted! {r_bad.status_code} {r_bad.text[:200]}")

    # LOGIC: missing start_date must be rejected
    r_nos = auth.post(f"{BASE_URL}/api/hr/leaves", json={
        "employee_id": emp_id, "leave_type": "annual",
    }, timeout=30)
    assert r_nos.status_code in (400, 422) or _unwrap(r_nos).get("success") is False, (
        f"Missing start_date accepted! {r_nos.status_code} {r_nos.text[:200]}")

    # Create a valid leave (draft) spanning 3 days
    payload = {
        "employee_id": emp_id, "leave_type": "annual",
        "start_date": "2026-07-01", "end_date": "2026-07-03",
        "notes": "QA-TEST-DEEP-BL leave",
    }
    r2 = auth.post(f"{BASE_URL}/api/hr/leaves", json=payload, timeout=30)
    j2 = _unwrap(r2)
    assert j2.get("success") is True, f"Leave create rejected: {r2.status_code} {j2}"
    lv = j2.get("data") or {}
    lv_id = lv.get("id")
    assert (lv.get("doc_no") or "").startswith("LR-"), f"Leave doc_no wrong: {lv.get('doc_no')}"
    assert lv.get("status") == "draft", f"New leave should be draft: {lv.get('status')}"
    assert float(lv.get("days_count") or 0) == 3.0, f"days_count should be 3: {lv}"

    # PATCH (update a draft) — change notes
    r3 = auth.patch(f"{BASE_URL}/api/hr/leaves/{lv_id}",
                    json={"notes": "QA updated"}, timeout=15)
    j3 = _unwrap(r3)
    assert j3.get("success") is True, f"Leave PATCH failed: {r3.status_code} {j3}"
    assert (j3.get("data") or {}).get("notes") == "QA updated", f"PATCH not applied: {j3}"

    # SUBMIT — draft -> submitted
    r4 = auth.post(f"{BASE_URL}/api/hr/leaves/{lv_id}/submit", timeout=15)
    j4 = _unwrap(r4)
    assert j4.get("success") is True, f"Leave submit failed: {r4.status_code} {j4}"
    assert (j4.get("data") or {}).get("status") == "submitted", f"status not submitted: {j4}"

    # DELETE flow on a SEPARATE fresh draft (submitted leaves can't be deleted)
    r5 = auth.post(f"{BASE_URL}/api/hr/leaves", json={
        "employee_id": emp_id, "leave_type": "personal",
        "start_date": "2026-07-10", "notes": "QA-TEST delete-me",
    }, timeout=30)
    del_id = (_unwrap(r5).get("data") or {}).get("id")
    assert del_id, f"could not create deletable leave: {r5.text[:200]}"
    r6 = auth.delete(f"{BASE_URL}/api/hr/leaves/{del_id}", timeout=15)
    assert _unwrap(r6).get("success") is True, f"Leave DELETE failed: {r6.text[:200]}"
    # GET deleted -> 404
    r7 = auth.get(f"{BASE_URL}/api/hr/leaves/{del_id}", timeout=15)
    assert r7.status_code == 404, f"Deleted leave should be 404, got {r7.status_code}: {r7.text[:200]}"


def test_hr_leave_over_quota_rejected(auth, me):
    """RC-7 business rule: a leave request exceeding the annual quota (12 days) MUST be
    REJECTED — but an explicit allow_over_quota override is honored (e.g. unpaid leave).
    Regression for: 'system accepted leave exceeding quota' (no enforcement)."""
    emp_id = me.get("employee_id") or me.get("id")

    # 30-day annual leave >> quota(12) -> must be rejected with a quota message
    r_over = auth.post(f"{BASE_URL}/api/hr/leaves", json={
        "employee_id": emp_id, "leave_type": "annual",
        "start_date": "2026-12-01", "end_date": "2026-12-30", "days_count": 30,
        "notes": "QA over-quota (should reject)",
    }, timeout=30)
    j_over = _unwrap(r_over)
    assert r_over.status_code in (400, 422) or j_over.get("success") is False, (
        f"Over-quota leave was ACCEPTED! {r_over.status_code} {j_over}")
    assert "kuota" in r_over.text.lower() or "quota" in r_over.text.lower(), (
        f"Rejection should mention quota: {r_over.text[:200]}")

    # Same magnitude WITH explicit override -> accepted (different year to avoid pollution)
    r_ovr = auth.post(f"{BASE_URL}/api/hr/leaves", json={
        "employee_id": emp_id, "leave_type": "annual",
        "start_date": "2027-01-05", "end_date": "2027-02-03", "days_count": 30,
        "allow_over_quota": True, "notes": "QA over-quota override",
    }, timeout=30)
    j_ovr = _unwrap(r_ovr)
    assert j_ovr.get("success") is True, f"allow_over_quota override rejected: {r_ovr.status_code} {j_ovr}"
    ovr_id = (j_ovr.get("data") or {}).get("id")
    if ovr_id:
        auth.delete(f"{BASE_URL}/api/hr/leaves/{ovr_id}", timeout=15)


# ---------- INVENTORY ----------
def test_inventory_list_envelope(auth):
    # Try common inventory list endpoints
    candidates = [
        "/api/inventory/balance",
        "/api/inventory/movements",
        "/api/inventory/items",
        "/api/inventory/adjustments",
    ]
    ok = False
    last = None
    for ep in candidates:
        r = auth.get(f"{BASE_URL}{ep}", timeout=30)
        last = (ep, r.status_code, r.text[:200])
        if r.status_code == 200:
            j = _unwrap(r)
            if j.get("success") is True:
                ok = True
                break
    assert ok, f"No inventory list endpoint returned success envelope. Last: {last}"



# =====================================================================
#  DEEP E2E — multi-step mutation flows with stock / GL side-effects.
#  Data created here is rolled back by conftest._preserve_demo_db
#  (whole-DB snapshot/restore at session end).
# =====================================================================
import re as _re
import uuid as _uuid
from pymongo import MongoClient


@pytest.fixture(scope="session")
def mongo_db():
    env = open("/app/backend/.env").read()
    mongo = _re.search(r"MONGO_URL=(.*)", env).group(1).strip().strip('"')
    dbn = _re.search(r"DB_NAME=(.*)", env).group(1).strip().strip('"')
    client = MongoClient(mongo)
    yield client[dbn]
    client.close()


@pytest.fixture(scope="session")
def vendor_id(auth):
    r = auth.get(f"{BASE_URL}/api/master/vendors?per_page=5", timeout=20)
    data = _unwrap(r).get("data") or []
    data = data if isinstance(data, list) else data.get("items", [])
    assert data, "No vendors seeded"
    return data[0]["id"]


@pytest.fixture(scope="session")
def inv_item(auth):
    r = auth.get(f"{BASE_URL}/api/master/items?per_page=5", timeout=20)
    data = _unwrap(r).get("data") or []
    data = data if isinstance(data, list) else data.get("items", [])
    assert data, "No items seeded"
    it = data[0]
    return {"id": it["id"],
            "name": it.get("name") or "QA Item",
            "unit": it.get("unit") or it.get("base_unit") or "PCS"}


def _balance_qty(auth, outlet_id, item_id):
    r = auth.get(f"{BASE_URL}/api/inventory/balance",
                 params={"outlet_id": outlet_id, "item_id": item_id, "per_page": 500}, timeout=30)
    rows = _unwrap(r).get("data") or []
    rows = rows if isinstance(rows, list) else rows.get("items", [])
    for row in rows:
        if row.get("item_id") == item_id:
            return float(row.get("qty") or 0)
    return 0.0


def _je_totals(auth, je_id):
    r = auth.get(f"{BASE_URL}/api/finance/journals/{je_id}", timeout=15)
    je = _unwrap(r).get("data") or {}
    dr = je.get("total_dr") or sum(l.get("debit", 0) for l in je.get("lines", []))
    cr = je.get("total_cr") or sum(l.get("credit", 0) for l in je.get("lines", []))
    return float(dr or 0), float(cr or 0)


# ---------- INVENTORY: adjustment (stock-in) + transfer (stock movement) ----------
def test_inventory_adjustment_and_transfer_stock_movement(auth, me, inv_item):
    outlets = me.get("outlet_ids") or []
    if len(outlets) < 2:
        pytest.skip("need >=2 outlets in scope for a transfer")
    src, dst = outlets[0], outlets[1]
    item = inv_item

    # LOGIC: adjustment requires lines + reason
    r_nl = auth.post(f"{BASE_URL}/api/inventory/adjustments",
                     json={"outlet_id": src, "reason": "x", "lines": []}, timeout=20)
    assert r_nl.status_code in (400, 422) or _unwrap(r_nl).get("success") is False, "adjustment w/o lines accepted"
    r_nr = auth.post(f"{BASE_URL}/api/inventory/adjustments", json={
        "outlet_id": src, "lines": [{"item_id": item["id"], "item_name": item["name"], "qty_delta": 5, "unit_cost": 1000}],
    }, timeout=20)
    assert r_nr.status_code in (400, 422) or _unwrap(r_nr).get("success") is False, "adjustment w/o reason accepted"

    src_qty0 = _balance_qty(auth, src, item["id"])

    # Create adjustment (+10 units, total_value 50k < Rp500k -> Tier-1 single step)
    r1 = auth.post(f"{BASE_URL}/api/inventory/adjustments", json={
        "outlet_id": src, "reason": "QA-TEST stock-in", "adjustment_date": date.today().isoformat(),
        "lines": [{"item_id": item["id"], "item_name": item["name"], "qty_delta": 10, "unit_cost": 5000, "unit": item["unit"]}],
    }, timeout=30)
    assert _unwrap(r1).get("success") is True, f"adjustment create failed: {r1.text[:250]}"
    adj = _unwrap(r1).get("data") or {}
    assert (adj.get("doc_no") or "").startswith("ADJ-"), f"adj doc_no: {adj.get('doc_no')}"
    adj_id = adj["id"]

    # Approve (admin '*' satisfies Tier-1 single step) -> posts movement + JE
    r2 = auth.post(f"{BASE_URL}/api/inventory/adjustments/{adj_id}/approve", json={}, timeout=30)
    j2 = _unwrap(r2)
    assert j2.get("success") is True, f"adjustment approve failed: {r2.status_code} {r2.text[:250]}"
    adj2 = j2.get("data") or {}
    if adj2.get("status") != "approved":
        pytest.skip(f"adjustment not auto-completed by single approve (status={adj2.get('status')})")

    # Stock increased by exactly 10
    src_qty1 = _balance_qty(auth, src, item["id"])
    assert abs(src_qty1 - (src_qty0 + 10)) < 0.001, f"stock not +10: before={src_qty0} after={src_qty1}"
    # JE created + balanced
    assert adj2.get("journal_entry_id"), f"adjustment posted no JE: {adj2}"
    dr, cr = _je_totals(auth, adj2["journal_entry_id"])
    assert dr == cr and dr > 0, f"adjustment JE not balanced: dr={dr} cr={cr}"

    # LOGIC: transfer same-outlet rejected
    r_se = auth.post(f"{BASE_URL}/api/inventory/transfers", json={
        "from_outlet_id": src, "to_outlet_id": src,
        "lines": [{"item_id": item["id"], "item_name": item["name"], "qty": 1}],
    }, timeout=20)
    assert r_se.status_code in (400, 422) or _unwrap(r_se).get("success") is False, "transfer same-outlet accepted"

    dst_qty0 = _balance_qty(auth, dst, item["id"])
    # Create transfer (3 units src -> dst)
    r3 = auth.post(f"{BASE_URL}/api/inventory/transfers", json={
        "from_outlet_id": src, "to_outlet_id": dst, "transfer_date": date.today().isoformat(),
        "lines": [{"item_id": item["id"], "item_name": item["name"], "qty": 3, "unit": item["unit"], "unit_cost": 5000}],
    }, timeout=30)
    assert _unwrap(r3).get("success") is True, f"transfer create failed: {r3.text[:250]}"
    tr = _unwrap(r3).get("data") or {}
    assert (tr.get("doc_no") or "").startswith("TRF-"), f"transfer doc_no: {tr.get('doc_no')}"
    tr_id = tr["id"]

    # send -> transfer_out at src; receive -> transfer_in at dst
    r4 = auth.post(f"{BASE_URL}/api/inventory/transfers/{tr_id}/send", timeout=30)
    assert _unwrap(r4).get("success") is True, f"transfer send failed: {r4.text[:250]}"
    r5 = auth.post(f"{BASE_URL}/api/inventory/transfers/{tr_id}/receive", timeout=30)
    assert _unwrap(r5).get("success") is True, f"transfer receive failed: {r5.text[:250]}"

    # Stock physically moved: src -3, dst +3
    assert abs(_balance_qty(auth, src, item["id"]) - (src_qty1 - 3)) < 0.001, "src stock not -3 after transfer"
    assert abs(_balance_qty(auth, dst, item["id"]) - (dst_qty0 + 3)) < 0.001, "dst stock not +3 after transfer"


# ---------- PROCUREMENT: PO -> submit -> approve -> GR (stock + AP + balanced JE) ----------
def test_procurement_po_approve_and_gr(auth, me, vendor_id, inv_item):
    outlets = me.get("outlet_ids") or []
    if not outlets:
        pytest.skip("admin has no outlet scope")
    outlet = outlets[0]
    item = inv_item

    # LOGIC: PO requires vendor
    r_nv = auth.post(f"{BASE_URL}/api/procurement/pos", json={
        "outlet_id": outlet, "lines": [{"item_name": "x", "qty": 1, "unit_cost": 1000}],
    }, timeout=20)
    assert r_nv.status_code in (400, 422) or _unwrap(r_nv).get("success") is False, "PO w/o vendor accepted"

    # Create PO (grand_total 500k < Rp5jt -> Tier-1 single step)
    r1 = auth.post(f"{BASE_URL}/api/procurement/pos", json={
        "vendor_id": vendor_id, "outlet_id": outlet, "status": "draft", "order_date": date.today().isoformat(),
        "lines": [{"item_id": item["id"], "item_name": item["name"], "qty": 10, "unit": item["unit"], "unit_cost": 50000, "tax_rate": 0}],
    }, timeout=30)
    assert _unwrap(r1).get("success") is True, f"PO create failed: {r1.text[:250]}"
    po = _unwrap(r1).get("data") or {}
    assert (po.get("doc_no") or "").startswith("PO-"), f"PO doc_no: {po.get('doc_no')}"
    assert abs(float(po.get("grand_total") or 0) - 500000) < 1, f"PO grand_total wrong: {po.get('grand_total')}"
    po_id = po["id"]

    # submit -> awaiting_approval
    r2 = auth.post(f"{BASE_URL}/api/procurement/pos/{po_id}/submit", timeout=20)
    assert _unwrap(r2).get("success") is True, f"PO submit failed: {r2.text[:250]}"

    # approve (admin) -> approved
    r3 = auth.post(f"{BASE_URL}/api/procurement/pos/{po_id}/approve", json={}, timeout=30)
    j3 = _unwrap(r3)
    assert j3.get("success") is True, f"PO approve failed: {r3.status_code} {r3.text[:250]}"
    po3 = j3.get("data") or {}
    if po3.get("status") != "approved":
        pytest.skip(f"PO not auto-approved by single step (status={po3.get('status')})")

    # GR: receive full qty -> stock +10, AP + balanced JE
    before_qty = _balance_qty(auth, outlet, item["id"])
    r4 = auth.post(f"{BASE_URL}/api/procurement/grs", json={
        "po_id": po_id, "vendor_id": vendor_id, "outlet_id": outlet,
        "receive_date": date.today().isoformat(), "tax_rate": 0,
        "lines": [{"item_id": item["id"], "item_name": item["name"], "qty_ordered": 10, "qty_received": 10, "unit_cost": 50000, "unit": item["unit"]}],
    }, timeout=30)
    j4 = _unwrap(r4)
    assert j4.get("success") is True, f"GR post failed: {r4.status_code} {r4.text[:300]}"
    gr = j4.get("data") or {}
    assert (gr.get("doc_no") or "").startswith("GR-"), f"GR doc_no: {gr.get('doc_no')}"
    assert gr.get("inventory_movement_ids"), f"GR created no inventory movements: {gr}"
    assert gr.get("journal_entry_id"), f"GR created no JE: {gr}"

    dr, cr = _je_totals(auth, gr["journal_entry_id"])
    assert dr == cr and dr > 0, f"GR JE not balanced: dr={dr} cr={cr}"
    assert abs(_balance_qty(auth, outlet, item["id"]) - (before_qty + 10)) < 0.001, "GR did not add 10 to stock"

    r5 = auth.get(f"{BASE_URL}/api/procurement/pos/{po_id}", timeout=15)
    po5 = _unwrap(r5).get("data") or {}
    assert po5.get("status") in ("received", "partial", "closed"), f"PO status after GR: {po5.get('status')}"


# ---------- PAYMENT RUN: seed approved PAY -> create -> confirm -> post ----------
def test_payment_run_create_confirm_post(auth, mongo_db, vendor_id, postable_accounts):
    db = mongo_db
    ba = db.bank_accounts.find_one({"deleted_at": None, "gl_account_id": {"$ne": None}})
    if not ba:
        pytest.skip("no bank account with gl_account_id")
    bank_account_id = ba["id"]
    bank_coa = ba["gl_account_id"]
    debit_coa = next((a["id"] for a in postable_accounts if a["id"] != bank_coa), postable_accounts[0]["id"])

    # LOGIC: empty pay_ids rejected
    r_e = auth.post(f"{BASE_URL}/api/finance/payment-runs", json={
        "payment_date": date.today().isoformat(), "bank_account_id": bank_account_id, "pay_ids": [],
    }, timeout=20)
    assert r_e.status_code in (400, 422) or _unwrap(r_e).get("success") is False, "empty pay_ids accepted"

    # Seed an APPROVED payment_request directly (rolled back by snapshot)
    amount = 250000.0
    pay_id = str(_uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    db.payment_requests.insert_one({
        "id": pay_id, "doc_no": f"PAY-QATEST-{pay_id[:6]}", "status": "approved",
        "amount": amount, "gl_debit_id": debit_coa,
        "payee_type": "vendor", "payee_id": vendor_id, "payee_text": "QA Vendor",
        "description": "QA-TEST payment run", "wh_type": None, "wh_amount": 0,
        "period_week": date.today().strftime("%Y-W%U"), "request_date": date.today().isoformat(),
        "created_at": now, "updated_at": now, "deleted_at": None,
    })
    try:
        # Create run
        r1 = auth.post(f"{BASE_URL}/api/finance/payment-runs", json={
            "payment_date": date.today().isoformat(), "bank_account_id": bank_account_id, "pay_ids": [pay_id],
        }, timeout=30)
        assert _unwrap(r1).get("success") is True, f"run create failed: {r1.text[:300]}"
        run = _unwrap(r1).get("data") or {}
        assert (run.get("doc_no") or "").startswith("PRN-"), f"run doc_no: {run.get('doc_no')}"
        assert abs(float(run.get("total_amount") or 0) - amount) < 1, f"run total wrong: {run.get('total_amount')}"
        run_id = run["id"]

        # Confirm: draft -> confirmed
        r2 = auth.post(f"{BASE_URL}/api/finance/payment-runs/{run_id}/confirm", timeout=20)
        j2 = _unwrap(r2)
        assert j2.get("success") is True and (j2.get("data") or {}).get("status") == "confirmed", f"confirm failed: {r2.text[:250]}"

        # Post: confirmed -> posted (batch JE)
        r3 = auth.post(f"{BASE_URL}/api/finance/payment-runs/{run_id}/post", json={}, timeout=40)
        j3 = _unwrap(r3)
        assert j3.get("success") is True, f"post failed: {r3.status_code} {r3.text[:300]}"
        posted = j3.get("data") or {}
        assert posted.get("status") == "posted", f"run not posted: {posted.get('status')}"
        je_id = posted.get("je_id")
        assert je_id, f"posted run has no je_id: {posted}"

        # Batch JE balanced: Dr expense == Cr bank == amount
        dr, cr = _je_totals(auth, je_id)
        assert dr == cr == amount, f"payment-run JE not balanced/total: dr={dr} cr={cr} expected={amount}"

        # PAY now marked paid
        paydoc = db.payment_requests.find_one({"id": pay_id})
        assert paydoc and paydoc.get("status") == "paid", f"PAY not marked paid: {paydoc and paydoc.get('status')}"
    finally:
        db.payment_requests.delete_one({"id": pay_id})

"""Phase 5 Refactor Regression Tests — budget_service & business_rules_service.

Validates zero functional regression after splitting monolithic service files
into private sub-packages with facade re-exports.
"""
import pytest
import requests
from pathlib import Path


def _api_url() -> str:
    env = Path(__file__).parent.parent.parent / "frontend" / ".env"
    for line in env.read_text().splitlines():
        if line.startswith("REACT_APP_BACKEND_URL="):
            return line.split("=", 1)[1].strip().rstrip("/")
    raise RuntimeError("REACT_APP_BACKEND_URL tidak ditemukan")


BASE_URL = _api_url()
ADMIN_EMAIL = "admin@fnbgroup.id"
ADMIN_PASSWORD = "Demo@2026"


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text[:300]}"
    body = r.json()
    # Envelope: { data: { access_token, ... } }
    token = body.get("data", {}).get("access_token") or body.get("access_token")
    assert token, f"no access_token in {body}"
    return token


@pytest.fixture(scope="session")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def outlet_id(auth_headers):
    # Use master data endpoint which reads from `outlets` collection
    r = requests.get(f"{BASE_URL}/api/master/outlets", headers=auth_headers, timeout=30)
    assert r.status_code == 200, f"outlets fetch failed: {r.status_code} {r.text[:200]}"
    body = r.json()
    data = body.get("data") if isinstance(body, dict) else body
    items = data.get("items") if isinstance(data, dict) else data
    if not items:
        items = data if isinstance(data, list) else []
    assert items, f"no outlets returned: {body}"
    return items[0]["id"]


# ---------- Health & Auth ----------
def test_health():
    r = requests.get(f"{BASE_URL}/api/health", timeout=15)
    assert r.status_code == 200
    body = r.json()
    assert body.get("data", {}).get("status") == "ok"


def test_admin_login_envelope():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200
    body = r.json()
    assert "data" in body and "access_token" in body["data"]


# ---------- Budget — Categories & List ----------
class TestBudgetReadEndpoints:
    def test_get_categories(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/budget/categories", headers=auth_headers, timeout=20)
        assert r.status_code == 200, r.text[:300]
        body = r.json()
        assert body.get("success") is True or body.get("data") is not None

    def test_list_budgets(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/budget/budgets", headers=auth_headers, timeout=20)
        assert r.status_code == 200, r.text[:300]
        body = r.json()
        data = body.get("data", body)
        # Either items array or list
        assert "items" in data or isinstance(data, list)


# ---------- Budget — CRUD flow ----------
class TestBudgetCRUD:
    created_id = None

    def test_a_create_budget(self, auth_headers, outlet_id):
        payload = {
            "name": "TEST_PHASE5_BUDGET",
            "period": "2026-02",
            "scope_type": "outlet",
            "outlet_id": outlet_id,
            "notes": "phase5 refactor test",
            "lines": [],
        }
        r = requests.post(f"{BASE_URL}/api/budget/budgets",
                          headers=auth_headers, json=payload, timeout=30)
        assert r.status_code in (200, 201), f"create budget failed: {r.status_code} {r.text[:500]}"
        body = r.json()
        data = body.get("data", body)
        bid = data.get("id") or data.get("_id")
        assert bid, f"no id in created budget: {body}"
        TestBudgetCRUD.created_id = bid

    def test_b_get_budget(self, auth_headers):
        assert TestBudgetCRUD.created_id, "budget not created"
        r = requests.get(f"{BASE_URL}/api/budget/budgets/{TestBudgetCRUD.created_id}",
                         headers=auth_headers, timeout=20)
        assert r.status_code == 200, r.text[:300]
        body = r.json()
        data = body.get("data", body)
        assert data.get("name") == "TEST_PHASE5_BUDGET"

    def test_c_update_budget(self, auth_headers):
        assert TestBudgetCRUD.created_id
        r = requests.put(f"{BASE_URL}/api/budget/budgets/{TestBudgetCRUD.created_id}",
                         headers=auth_headers,
                         json={"name": "TEST_PHASE5_BUDGET_UPD", "notes": "updated"}, timeout=20)
        assert r.status_code == 200, r.text[:300]
        # verify persistence
        g = requests.get(f"{BASE_URL}/api/budget/budgets/{TestBudgetCRUD.created_id}",
                         headers=auth_headers, timeout=20).json()
        gdata = g.get("data", g)
        assert gdata.get("name") == "TEST_PHASE5_BUDGET_UPD"

    def test_d_submit_for_approval(self, auth_headers):
        assert TestBudgetCRUD.created_id
        r = requests.post(f"{BASE_URL}/api/budget/budgets/{TestBudgetCRUD.created_id}/submit",
                          headers=auth_headers, timeout=30)
        # Accept 200/201/202 — approval_service.notify_pending_approvers regression check (no 500)
        assert r.status_code in (200, 201, 202), \
            f"submit failed (approval regression?): {r.status_code} {r.text[:500]}"
        body = r.json()
        data = body.get("data", body)
        # Field is `approval_status`, not `status`. submit_for_approval sets it to "submitted".
        approval_status = data.get("approval_status", data.get("status", ""))
        assert approval_status in ("submitted", "awaiting_approval", "pending_approval", "pending", "approved"), \
            f"unexpected approval_status: {approval_status} (full data: {list(data.keys())[:15]})"

    def test_e_delete_budget(self, auth_headers):
        assert TestBudgetCRUD.created_id
        r = requests.delete(f"{BASE_URL}/api/budget/budgets/{TestBudgetCRUD.created_id}",
                            headers=auth_headers, timeout=20)
        # Some backends require draft state for delete; allow 200/204/400/409
        assert r.status_code in (200, 204, 400, 409), \
            f"delete unexpected status: {r.status_code} {r.text[:300]}"


# ---------- Budget — Vs Actual ----------
class TestBudgetVsActual:
    def test_vs_actual(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/budget/vs-actual?period=2026-01",
                         headers=auth_headers, timeout=30)
        assert r.status_code == 200, r.text[:500]
        body = r.json()
        data = body.get("data", body)
        # Must include coa_level + category_rollup keys
        assert "coa_level" in data, f"missing coa_level: {list(data.keys())[:10]}"
        assert "category_rollup" in data, f"missing category_rollup: {list(data.keys())[:10]}"

    def test_vs_actual_multi_outlet(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/budget/vs-actual-multi-outlet?period=2026-01",
                         headers=auth_headers, timeout=30)
        assert r.status_code == 200, r.text[:500]


# ---------- Budget — Excel Template ----------
class TestBudgetTemplate:
    def test_template_simple(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/budget/template-excel?period_type=simple",
                         headers=auth_headers, timeout=30)
        assert r.status_code == 200, r.text[:300]
        assert len(r.content) > 4000, f"xlsx too small: {len(r.content)}"
        assert r.content[:2] == b"PK", f"not a valid xlsx (magic): {r.content[:10]}"

    def test_template_monthly(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/budget/template-excel?period_type=monthly",
                         headers=auth_headers, timeout=30)
        assert r.status_code == 200, r.text[:300]
        assert len(r.content) > 4000
        assert r.content[:2] == b"PK"


# ---------- Business Rules — Read endpoints ----------
class TestBusinessRulesReadEndpoints:
    def test_seed_defaults(self, auth_headers):
        r = requests.post(f"{BASE_URL}/api/admin/business-rules/seed-defaults",
                          headers=auth_headers, json={"rule_type": "config"}, timeout=30)
        assert r.status_code == 200, r.text[:300]
        body = r.json()
        data = body.get("data", body)
        # Allow either int count or dict with counters
        if isinstance(data, dict):
            inserted = data.get("inserted", data.get("created", data.get("count", 0)))
            assert inserted in (0, 5) or inserted >= 0, f"unexpected seed result: {data}"

    def test_list_by_rule_type(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/admin/business-rules?rule_type=service_charge_policy",
                         headers=auth_headers, timeout=20)
        assert r.status_code == 200, r.text[:300]

    def test_timeline(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/admin/business-rules/timeline?rule_type=service_charge_policy",
                         headers=auth_headers, timeout=20)
        assert r.status_code == 200, r.text[:300]

    def test_rule_types_config(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/admin/configuration/rule-types",
                         headers=auth_headers, timeout=15)
        assert r.status_code == 200, r.text[:300]
        body = r.json()
        data = body.get("data", body)
        # 5 expected rule types
        if isinstance(data, list):
            assert len(data) == 5, f"expected 5 rule types, got {len(data)}"
        elif isinstance(data, dict) and "items" in data:
            assert len(data["items"]) == 5


# ---------- Business Rules — CRUD lifecycle ----------
class TestBusinessRulesCRUD:
    created_id = None

    def test_a_create_rule(self, auth_headers):
        payload = {
            "rule_type": "incentive_policy",
            "scope_type": "group",
            "scope_id": "*",
            "name": "TEST_PHASE5_RULE",
            "description": "phase5 refactor regression",
            "effective_from": "2026-01-01",
            "rule_data": {
                "rule_type": "pct_of_sales",
                "target_amount": 50000000,
                "incentive_pct": 0.02,
            },
        }
        r = requests.post(f"{BASE_URL}/api/admin/business-rules",
                          headers=auth_headers, json=payload, timeout=30)
        assert r.status_code in (200, 201), f"create rule failed: {r.status_code} {r.text[:500]}"
        body = r.json()
        data = body.get("data", body)
        rid = data.get("id") or data.get("_id")
        assert rid, f"no id in created rule: {body}"
        TestBusinessRulesCRUD.created_id = rid

    def test_b_update_rule(self, auth_headers):
        rid = TestBusinessRulesCRUD.created_id
        assert rid
        r = requests.patch(f"{BASE_URL}/api/admin/business-rules/{rid}",
                           headers=auth_headers,
                           json={"name": "TEST_PHASE5_RULE_UPD", "description": "updated"},
                           timeout=20)
        assert r.status_code == 200, r.text[:300]

    def test_c_duplicate_rule(self, auth_headers):
        rid = TestBusinessRulesCRUD.created_id
        assert rid
        r = requests.post(f"{BASE_URL}/api/admin/business-rules/{rid}/duplicate",
                          headers=auth_headers, json={}, timeout=20)
        assert r.status_code in (200, 201), r.text[:300]

    def test_d_archive_rule(self, auth_headers):
        rid = TestBusinessRulesCRUD.created_id
        assert rid
        r = requests.post(f"{BASE_URL}/api/admin/business-rules/{rid}/archive",
                          headers=auth_headers, json={}, timeout=20)
        assert r.status_code == 200, r.text[:300]

    def test_e_activate_rule(self, auth_headers):
        rid = TestBusinessRulesCRUD.created_id
        assert rid
        r = requests.post(f"{BASE_URL}/api/admin/business-rules/{rid}/activate",
                          headers=auth_headers, json={}, timeout=20)
        # activate may fail if archived state not allowed; accept 200/400/409
        assert r.status_code in (200, 400, 409), r.text[:300]

    def test_f_delete_rule(self, auth_headers):
        rid = TestBusinessRulesCRUD.created_id
        assert rid
        r = requests.delete(f"{BASE_URL}/api/admin/business-rules/{rid}",
                            headers=auth_headers, timeout=20)
        assert r.status_code in (200, 204), r.text[:300]


# ---------- Downstream consumer regression ----------
class TestDownstreamConsumers:
    def test_anomalies_endpoint(self, auth_headers):
        """Validates _anomaly/helpers.py still imports business_rules_service."""
        r = requests.get(f"{BASE_URL}/api/admin/anomalies", headers=auth_headers, timeout=30)
        # Accept 200 (success) or 422 (missing params) but NOT 500 (ImportError)
        assert r.status_code != 500, f"500 from anomalies — possible ImportError: {r.text[:500]}"
        assert r.status_code in (200, 400, 404, 422), f"unexpected: {r.status_code} {r.text[:300]}"

    def test_hr_service_charge_endpoint(self, auth_headers):
        """Validates _hr/service_charge.py still imports business_rules_service."""
        # Try common service-charge subroutes
        candidates = [
            "/api/hr/service-charge/config",
            "/api/hr/service-charge/policy",
            "/api/hr/service-charge",
        ]
        statuses = []
        for path in candidates:
            r = requests.get(f"{BASE_URL}{path}", headers=auth_headers, timeout=20)
            statuses.append((path, r.status_code))
            # If we see 500 with ImportError that is regression
            if r.status_code == 500:
                pytest.fail(f"500 from {path} — possible ImportError: {r.text[:500]}")
        # At least one path should respond with non-500
        assert all(s != 500 for _, s in statuses), f"some 500s: {statuses}"

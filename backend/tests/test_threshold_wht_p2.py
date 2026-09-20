"""Tests for P2 features: Anomaly Threshold API + Payment Run WHT support"""
import pytest
import httpx
from pathlib import Path


def _api_url() -> str:
    env = Path(__file__).parent.parent.parent / "frontend" / ".env"
    for line in env.read_text().splitlines():
        if line.startswith("REACT_APP_BACKEND_URL="):
            return line.split("=", 1)[1].strip().rstrip("/")
    raise RuntimeError("REACT_APP_BACKEND_URL tidak ditemukan")


BASE_URL = _api_url()
ADMIN = {"email": "admin@fnbgroup.id", "password": "Demo@2026"}


@pytest.fixture(scope="module")
def http_client():
    with httpx.Client(base_url=BASE_URL, timeout=20, follow_redirects=True) as c:
        yield c


@pytest.fixture(scope="module")
def auth_headers(http_client):
    r = http_client.post("/api/auth/login", json=ADMIN)
    assert r.status_code == 200, f"Login gagal: {r.text[:200]}"
    token = r.json()["data"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def token(http_client):
    r = http_client.post("/api/auth/login", json=ADMIN)
    assert r.status_code == 200
    return r.json()["data"]["access_token"]


@pytest.fixture(scope="module")
def auth(http_client, auth_headers):
    """Compat fixture: returns http_client with headers bound."""
    class _S:
        def get(self, url, **kw):
            return http_client.get(url, headers=auth_headers, **kw)
        def post(self, url, **kw):
            kw.setdefault("headers", auth_headers)
            return http_client.post(url, **kw)
        def delete(self, url, **kw):
            return http_client.delete(url, headers=auth_headers, **kw)
    return _S()


# ── Anomaly Threshold GET ──────────────────────────────────────────────────────
class TestThresholdGet:
    """GET /api/anomalies/thresholds"""

    def test_list_returns_200(self, auth):
        r = auth.get("/api/anomalies/thresholds")
        assert r.status_code == 200

    def test_list_returns_array(self, auth):
        r = auth.get("/api/anomalies/thresholds")
        data = r.json()
        assert "data" in data
        assert isinstance(data["data"], list)

    def test_list_has_at_least_one_rule(self, auth):
        r = auth.get("/api/anomalies/thresholds")
        items = r.json()["data"]
        assert len(items) >= 1, "Expected at least 1 threshold rule in DB"

    def test_rule_has_required_fields(self, auth):
        r = auth.get("/api/anomalies/thresholds")
        rule = r.json()["data"][0]
        for field in ["id", "scope_type", "scope_id", "rule_data", "active"]:
            assert field in rule, f"Missing field: {field}"


# ── Anomaly Threshold POST ─────────────────────────────────────────────────────
class TestThresholdUpsert:
    """POST /api/anomalies/thresholds"""
    _created_id = None

    def test_upsert_group_returns_200(self, auth):
        payload = {
            "scope_type": "group",
            "scope_id": "*",
            "rule_data": {
                "sales_deviation": {"sigma_mild": 1.8, "sigma_severe": 3.0, "window_days": 14, "min_points": 7}
            }
        }
        r = auth.post("/api/anomalies/thresholds", json=payload)
        assert r.status_code == 200
        rule = r.json()["data"]
        assert "id" in rule
        TestThresholdUpsert._created_id = rule["id"]

    def test_upsert_returns_rule_with_scope(self, auth):
        r = auth.get("/api/anomalies/thresholds")
        items = r.json()["data"]
        group_rule = next((x for x in items if x["scope_type"] == "group" and x["scope_id"] == "*"), None)
        assert group_rule is not None
        assert group_rule["rule_data"]["sales_deviation"]["sigma_mild"] == 1.8

    def test_upsert_idempotent_updates_existing(self, auth):
        # Call twice with different value — should update same rule
        payload = {
            "scope_type": "group",
            "scope_id": "*",
            "rule_data": {"sales_deviation": {"sigma_mild": 2.0, "sigma_severe": 3.5, "window_days": 14, "min_points": 7}}
        }
        r1 = auth.post("/api/anomalies/thresholds", json=payload)
        r2 = auth.post("/api/anomalies/thresholds", json=payload)
        assert r1.status_code == 200 and r2.status_code == 200
        # Both should return same id (upsert)
        assert r1.json()["data"]["id"] == r2.json()["data"]["id"]


# ── Anomaly Threshold DELETE ───────────────────────────────────────────────────
class TestThresholdDelete:
    """DELETE /api/anomalies/thresholds/{rule_id}"""

    def test_delete_nonexistent_returns_404(self, auth):
        r = auth.delete("/api/anomalies/thresholds/nonexistent-id-999")
        assert r.status_code == 404

    def test_create_then_delete(self, auth):
        # Create a brand-scope rule
        payload = {
            "scope_type": "brand",
            "scope_id": "TEST_brand_delete",
            "rule_data": {"sales_deviation": {"sigma_mild": 1.5, "sigma_severe": 2.5, "window_days": 14, "min_points": 7}}
        }
        r = auth.post("/api/anomalies/thresholds", json=payload)
        assert r.status_code == 200
        rule_id = r.json()["data"]["id"]

        # Delete it
        rd = auth.delete(f"/api/anomalies/thresholds/{rule_id}")
        assert rd.status_code == 200
        assert rd.json()["data"]["deleted"] == rule_id

        # Verify it's gone from list
        rl = auth.get("/api/anomalies/thresholds")
        ids = [x["id"] for x in rl.json()["data"]]
        assert rule_id not in ids


# ── Payment Run: backend import health ────────────────────────────────────────
class TestPaymentRunWHT:
    """Payment run endpoints must respond without 500 (WHT support)"""

    def test_payment_run_list_not_500(self, auth):
        r = auth.get("/api/finance/payment-runs")
        assert r.status_code in [200, 400]  # not 500

    def test_payment_run_kpi_not_500(self, auth):
        r = auth.get("/api/finance/payment-runs/kpi")
        assert r.status_code in [200, 400]

    def test_payment_run_create_validates_schema(self, auth):
        # Create without pay_ids should fail with 422 or validation error — NOT 500
        r = auth.post("/api/finance/payment-runs", json={})
        assert r.status_code != 500, "Server should not 500 on empty payload"


# ── Finance portal routes (not 500) ───────────────────────────────────────────
class TestFinanceRoutes:
    """Critical finance routes should not 500"""

    def test_anomalies_list(self, auth):
        r = auth.get("/api/anomalies?status=open&per_page=10")
        assert r.status_code == 200

    def test_anomalies_summary(self, auth):
        r = auth.get("/api/anomalies/summary?days=7")
        assert r.status_code == 200

    def test_anomalies_thresholds_resolve(self, auth):
        r = auth.get("/api/anomalies/thresholds/resolve")
        assert r.status_code == 200

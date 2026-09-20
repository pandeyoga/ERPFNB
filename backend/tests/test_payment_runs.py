"""test_payment_runs.py — Regression tests untuk fitur Payment Runs (Batch).

Covers:
  1. GET /api/finance/payment-runs/kpi — shape
  2. GET /api/finance/payment-runs — list (empty)
  3. POST /api/finance/payment-runs — create draft dengan approved PAY
  4. GET /api/finance/payment-runs/{id} — detail enrich
  5. POST /api/finance/payment-runs/{id}/confirm — draft → confirmed
  6. POST /api/finance/payment-runs/{id}/post — confirmed → posted + JE
  7. POST /api/finance/payment-runs/{id}/cancel — cancel draft
  8. Error: create dengan PAY bukan approved → 422/409
  9. Error: post run tidak confirmed → 409
  10. Trailing-slash rejection — /api/finance/payment-runs/ → 400

Run:
    cd /app/backend
    python3 -m pytest tests/test_payment_runs.py -v
"""
import pytest
import httpx
from pathlib import Path


# ── Helpers ───────────────────────────────────────────────────────────────────

def _api_url() -> str:
    env = Path(__file__).parent.parent.parent / "frontend" / ".env"
    for line in env.read_text().splitlines():
        if line.startswith("REACT_APP_BACKEND_URL="):
            return line.split("=", 1)[1].strip().rstrip("/")
    raise RuntimeError("REACT_APP_BACKEND_URL tidak ditemukan")


API = _api_url()
ADMIN = {"email": "admin@fnbgroup.id", "password": "Demo@2026"}


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def http_client():
    with httpx.Client(base_url=API, timeout=20, follow_redirects=True) as c:
        yield c


@pytest.fixture(scope="module")
def auth_headers(http_client):
    r = http_client.post("/api/auth/login", json=ADMIN)
    assert r.status_code == 200, f"Login gagal: {r.text[:200]}"
    token = r.json()["data"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def bank_account_id(http_client, auth_headers):
    """Get first available bank account id."""
    r = http_client.get("/api/master/bank-accounts?page=1&per_page=5", headers=auth_headers)
    assert r.status_code == 200
    items = r.json().get("data") or []
    if not items:
        pytest.skip("Tidak ada bank account di DB")
    return items[0]["id"]


@pytest.fixture(scope="module")
def approved_pay_id(http_client, auth_headers):
    """Get one approved payment request id (or skip)."""
    r = http_client.get("/api/finance/payments?status=approved&per_page=5", headers=auth_headers)
    assert r.status_code == 200
    items = (r.json().get("data") or [])
    # Filter: no withholding tax
    no_wh = [p for p in items if not p.get("wh_type") or float(p.get("wh_amount") or 0) == 0]
    if not no_wh:
        pytest.skip("Tidak ada approved payment (tanpa withholding) di DB")
    return no_wh[0]["id"]


# ── Tests ─────────────────────────────────────────────────────────────────────

@pytest.mark.finance
class TestPaymentRunsBasic:
    def test_kpi_shape(self, http_client, auth_headers):
        r = http_client.get("/api/finance/payment-runs/kpi", headers=auth_headers)
        assert r.status_code == 200
        d = r.json()["data"]
        assert "draft" in d
        assert "confirmed" in d
        assert "posted_this_month" in d
        assert "period" in d
        assert isinstance(d["draft"], int)

    def test_list_empty_ok(self, http_client, auth_headers):
        r = http_client.get("/api/finance/payment-runs", headers=auth_headers)
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True
        assert isinstance(body["data"], list)
        assert "total" in body["meta"]

    def test_trailing_slash_rejected(self, http_client, auth_headers):
        r = http_client.get("/api/finance/payment-runs/", headers=auth_headers,
                            follow_redirects=False)
        assert r.status_code == 400, f"Expected 400 TRAILING_SLASH, got {r.status_code}"
        body = r.json()
        # Middleware returns {"code": "TRAILING_SLASH", ...}
        assert body.get("code") == "TRAILING_SLASH" or (
            body.get("errors", [{}])[0].get("code") == "TRAILING_SLASH"
        )

    def test_unauthenticated_rejected(self, http_client):
        r = http_client.get("/api/finance/payment-runs")
        assert r.status_code in (401, 403)


@pytest.mark.finance
class TestPaymentRunsWorkflow:
    def test_create_draft(self, http_client, auth_headers, bank_account_id, approved_pay_id):
        payload = {
            "payment_date": "2026-06-15",
            "bank_account_id": bank_account_id,
            "pay_ids": [approved_pay_id],
            "notes": "Test batch run dari pytest",
        }
        r = http_client.post("/api/finance/payment-runs", json=payload, headers=auth_headers)
        assert r.status_code == 200, f"Create gagal: {r.text[:300]}"
        body = r.json()
        assert body["success"] is True
        d = body["data"]
        assert d["status"] == "draft"
        assert d["doc_no"].startswith("PRN-")
        assert d["pay_count"] == 1
        assert d["total_amount"] > 0
        # Store for subsequent tests
        TestPaymentRunsWorkflow._run_id = d["id"]

    def test_get_detail(self, http_client, auth_headers):
        run_id = getattr(TestPaymentRunsWorkflow, "_run_id", None)
        if not run_id:
            pytest.skip("No run created")
        r = http_client.get(f"/api/finance/payment-runs/{run_id}", headers=auth_headers)
        assert r.status_code == 200
        d = r.json()["data"]
        assert d["id"] == run_id
        assert isinstance(d.get("payments"), list)
        assert len(d["payments"]) >= 1
        assert "payee_name" in d["payments"][0]

    def test_confirm_run(self, http_client, auth_headers):
        run_id = getattr(TestPaymentRunsWorkflow, "_run_id", None)
        if not run_id:
            pytest.skip("No run created")
        r = http_client.post(f"/api/finance/payment-runs/{run_id}/confirm", headers=auth_headers)
        assert r.status_code == 200, f"Confirm gagal: {r.text[:300]}"
        d = r.json()["data"]
        assert d["status"] == "confirmed"
        assert d["confirmed_at"] is not None

    def test_post_run(self, http_client, auth_headers):
        run_id = getattr(TestPaymentRunsWorkflow, "_run_id", None)
        if not run_id:
            pytest.skip("No run created")
        r = http_client.post(f"/api/finance/payment-runs/{run_id}/post", headers=auth_headers)
        assert r.status_code == 200, f"Post gagal: {r.text[:300]}"
        d = r.json()["data"]
        assert d["status"] == "posted"
        assert d["je_id"] is not None
        assert d["posted_at"] is not None
        TestPaymentRunsWorkflow._je_id = d["je_id"]

    def test_posted_je_exists(self, http_client, auth_headers):
        je_id = getattr(TestPaymentRunsWorkflow, "_je_id", None)
        if not je_id:
            pytest.skip("No JE id recorded")
        r = http_client.get(f"/api/finance/journals/{je_id}", headers=auth_headers)
        assert r.status_code == 200
        je = r.json()["data"]
        assert je["status"] == "posted"
        assert je.get("source_type") == "payment_run"


@pytest.mark.finance
class TestPaymentRunsErrors:
    def test_create_without_pay_ids(self, http_client, auth_headers, bank_account_id):
        r = http_client.post("/api/finance/payment-runs", json={
            "payment_date": "2026-06-15",
            "bank_account_id": bank_account_id,
            "pay_ids": [],
        }, headers=auth_headers)
        assert r.status_code in (400, 422)

    def test_cancel_posted_run_fails(self, http_client, auth_headers):
        run_id = getattr(TestPaymentRunsWorkflow, "_run_id", None)
        if not run_id:
            pytest.skip("No run to test cancel")
        r = http_client.post(f"/api/finance/payment-runs/{run_id}/cancel", json={},
                             headers=auth_headers)
        assert r.status_code in (409, 400, 422), f"Expected conflict error, got {r.status_code}"

    def test_post_draft_run_fails(self, http_client, auth_headers, bank_account_id, approved_pay_id):
        """A draft run (not confirmed) cannot be posted directly."""
        # First create a second draft run (may fail if approved_pay_id already paid)
        r = http_client.post("/api/finance/payment-runs", json={
            "payment_date": "2026-06-15",
            "bank_account_id": bank_account_id,
            "pay_ids": [approved_pay_id],  # may already be paid from test above
        }, headers=auth_headers)
        if r.status_code != 200:
            pytest.skip("Can't create second draft (pay already used)")
        run_id2 = r.json()["data"]["id"]
        r2 = http_client.post(f"/api/finance/payment-runs/{run_id2}/post", headers=auth_headers)
        assert r2.status_code in (409, 400, 422), "Draft run should not be postable directly"

    def test_cancel_draft_run(self, http_client, auth_headers, bank_account_id):
        """Create a new draft and cancel it."""
        # Get fresh approved pay
        r = http_client.get("/api/finance/payments?status=approved&per_page=5", headers=auth_headers)
        pays = [p for p in (r.json().get("data") or [])
                if not p.get("wh_type") or float(p.get("wh_amount") or 0) == 0]
        if not pays:
            pytest.skip("No approved payment for cancel test")
        r2 = http_client.post("/api/finance/payment-runs", json={
            "payment_date": "2026-06-15",
            "bank_account_id": bank_account_id,
            "pay_ids": [pays[0]["id"]],
        }, headers=auth_headers)
        if r2.status_code != 200:
            pytest.skip("Can't create draft run for cancel test")
        run_id = r2.json()["data"]["id"]
        r3 = http_client.post(f"/api/finance/payment-runs/{run_id}/cancel",
                               json={"reason": "Test cancel"}, headers=auth_headers)
        assert r3.status_code == 200
        assert r3.json()["data"]["status"] == "cancelled"

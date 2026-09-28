"""Tests for Payment Run Templates feature (6 endpoints)."""
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

CREDS = {"email": "admin@fnbgroup.id", "password": "Demo@2026"}


@pytest.fixture(scope="module")
def auth_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json=CREDS)
    assert r.status_code == 200, f"Login failed: {r.text}"
    return r.json()["data"]["access_token"]


@pytest.fixture(scope="module")
def authed(auth_token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def bank_id(authed):
    r = authed.get(f"{BASE_URL}/api/master/bank-accounts?page=1&per_page=5")
    data = r.json().get("data") or []
    if not data:
        pytest.skip("No bank accounts to test with")
    return data[0]["id"]


class TestPaymentRunTemplatesCRUD:

    def test_list_returns_200_and_array(self, authed):
        r = authed.get(f"{BASE_URL}/api/finance/payment-run-templates")
        assert r.status_code == 200
        body = r.json()
        assert "data" in body
        assert isinstance(body["data"], list)

    def test_trailing_slash_returns_400_or_405(self, authed):
        r = authed.post(f"{BASE_URL}/api/finance/payment-run-templates/")
        assert r.status_code in (400, 405, 422), f"Expected 4xx got {r.status_code}: {r.text}"

    def test_create_template(self, authed, bank_id):
        payload = {
            "name": "TEST_Template_Monthly",
            "description": "Test template",
            "bank_account_id": bank_id,
            "schedule_day": 15,
            "auto_approve": True,
            "items": [],
        }
        r = authed.post(f"{BASE_URL}/api/finance/payment-run-templates", json=payload)
        assert r.status_code == 200, f"Create failed: {r.text}"
        data = r.json().get("data", {})
        assert "id" in data
        assert data["name"] == "TEST_Template_Monthly"
        assert data["bank_account_id"] == bank_id
        # Store for other tests
        TestPaymentRunTemplatesCRUD._created_id = data["id"]

    def test_get_single_template(self, authed):
        tmpl_id = getattr(TestPaymentRunTemplatesCRUD, "_created_id", None)
        if not tmpl_id:
            pytest.skip("No template created")
        r = authed.get(f"{BASE_URL}/api/finance/payment-run-templates/{tmpl_id}")
        assert r.status_code == 200
        data = r.json().get("data", {})
        assert data["id"] == tmpl_id
        assert data["name"] == "TEST_Template_Monthly"

    def test_update_template_name(self, authed):
        tmpl_id = getattr(TestPaymentRunTemplatesCRUD, "_created_id", None)
        if not tmpl_id:
            pytest.skip("No template created")
        r = authed.patch(f"{BASE_URL}/api/finance/payment-run-templates/{tmpl_id}", json={"name": "TEST_Template_Updated"})
        assert r.status_code == 200
        data = r.json().get("data", {})
        assert data["name"] == "TEST_Template_Updated"

    def test_apply_template_with_empty_items(self, authed):
        """Apply with no items should either error or return pr_ids=[]"""
        tmpl_id = getattr(TestPaymentRunTemplatesCRUD, "_created_id", None)
        if not tmpl_id:
            pytest.skip("No template created")
        from datetime import date
        payload = {"payment_date": date.today().isoformat(), "notes": "Test apply"}
        r = authed.post(f"{BASE_URL}/api/finance/payment-run-templates/{tmpl_id}/apply", json=payload)
        # Could return 400 (no items) or 200 with empty pr_ids
        assert r.status_code in (200, 400), f"Unexpected: {r.status_code} {r.text}"

    def test_delete_template(self, authed):
        tmpl_id = getattr(TestPaymentRunTemplatesCRUD, "_created_id", None)
        if not tmpl_id:
            pytest.skip("No template created")
        r = authed.delete(f"{BASE_URL}/api/finance/payment-run-templates/{tmpl_id}")
        assert r.status_code == 200
        # Verify deleted (should 404)
        r2 = authed.get(f"{BASE_URL}/api/finance/payment-run-templates/{tmpl_id}")
        assert r2.status_code == 404

    def test_create_and_apply_with_items(self, authed, bank_id):
        """Create template with items, apply, verify pr_ids returned."""
        # Get a vendor
        rv = authed.get(f"{BASE_URL}/api/master/vendors?page=1&per_page=5")
        vendors = rv.json().get("data") or []
        if not vendors:
            pytest.skip("No vendors available")
        vendor = vendors[0]

        # Get COA
        rc = authed.get(f"{BASE_URL}/api/finance/coa?is_postable=true&page=1&per_page=10")
        coas = rc.json().get("data") or []
        if not coas:
            pytest.skip("No COA available")
        coa = coas[0]

        import uuid
        item = {
            "id": str(uuid.uuid4()),
            "payee_type": "vendor",
            "payee_id": vendor["id"],
            "payee_name": vendor["name"],
            "description": "TEST sewa bulanan",
            "amount": 5000000,
            "gl_debit_id": coa["id"],
            "wh_type": "",
            "wh_rate": 0,
        }
        payload = {
            "name": "TEST_Template_With_Items",
            "bank_account_id": bank_id,
            "schedule_day": 1,
            "auto_approve": False,
            "items": [item],
        }
        r = authed.post(f"{BASE_URL}/api/finance/payment-run-templates", json=payload)
        assert r.status_code == 200, f"Create failed: {r.text}"
        tmpl_id = r.json()["data"]["id"]

        # Apply
        from datetime import date
        ar = authed.post(f"{BASE_URL}/api/finance/payment-run-templates/{tmpl_id}/apply",
                         json={"payment_date": date.today().isoformat()})
        assert ar.status_code == 200, f"Apply failed: {ar.text}"
        result = ar.json().get("data", {})
        assert "pr_ids" in result or "pr_doc_nos" in result, f"Missing pr_ids in result: {result}"

        # Cleanup
        authed.delete(f"{BASE_URL}/api/finance/payment-run-templates/{tmpl_id}")

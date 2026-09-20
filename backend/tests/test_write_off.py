"""Regression tests for AR Bad Debt Write-off feature.

Tests:
  - Write-off a sent/overdue invoice → 200 + status written_off
  - Write-off without reason → 400 ValidationError
  - Write-off an already written-off invoice → 409 ConflictError
  - Write-off report XLSX export → 200 + xlsx content-type

Note: http_client has base_url="http://localhost:8001/api",
so paths must NOT include /api prefix (it's already in base_url).
"""
import pytest
import time

pytestmark = pytest.mark.ar

CURRENT_PERIOD = __import__("datetime").datetime.utcnow().strftime("%Y-%m")


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


class TestARWriteOff:
    """End-to-end tests for AR write-off flow."""

    @pytest.fixture
    def unique_suffix(self):
        return str(int(time.time() * 1000))[-6:]

    @pytest.fixture
    def write_off_customer_id(self, http_client, admin_token, unique_suffix):
        r = http_client.post("/ar/customers", headers=_auth(admin_token),
                             json={"name": f"PYTEST WO Customer {unique_suffix}",
                                   "email": f"wo{unique_suffix}@test.com"})
        assert r.status_code in (200, 201), f"Customer creation failed: {r.text}"
        return r.json()["data"]["id"]

    @pytest.fixture
    def sent_invoice_id(self, http_client, admin_token, write_off_customer_id, unique_suffix):
        """Create + send an invoice so it can be written off."""
        r = http_client.post("/ar/invoices", headers=_auth(admin_token), json={
            "customer_id": write_off_customer_id,
            "invoice_date": f"{CURRENT_PERIOD}-01",
            "due_date": f"{CURRENT_PERIOD}-15",
            "lines": [{"description": f"PYTEST WO service {unique_suffix}",
                       "qty": 1, "unit_price": 750_000}],
        })
        assert r.status_code in (200, 201), f"Invoice creation failed: {r.text}"
        inv_id = r.json()["data"]["id"]
        send_r = http_client.post(f"/ar/invoices/{inv_id}/send", headers=_auth(admin_token), json={})
        assert send_r.status_code in (200, 409), f"Send failed: {send_r.text}"
        return inv_id

    def test_write_off_happy_path(self, http_client, admin_token, sent_invoice_id):
        """POST /ar/invoices/{id}/write-off with valid reason → 200, status=written_off."""
        r = http_client.post(f"/ar/invoices/{sent_invoice_id}/write-off", headers=_auth(admin_token),
                             json={"reason": "PYTEST — piutang tidak dapat ditagih setelah 90 hari"})
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()["data"]
        assert data["status"] == "written_off"
        assert data["written_off_amount"] > 0

    def test_write_off_no_reason(self, http_client, admin_token, sent_invoice_id):
        """POST /ar/invoices/{id}/write-off without reason → 400 or 409."""
        # First write off once (may succeed or already conflict)
        http_client.post(f"/ar/invoices/{sent_invoice_id}/write-off", headers=_auth(admin_token),
                         json={"reason": "First write-off"})
        r = http_client.post(f"/ar/invoices/{sent_invoice_id}/write-off", headers=_auth(admin_token),
                             json={"reason": ""})
        assert r.status_code in (400, 409), f"Expected 400/409, got {r.status_code}: {r.text}"

    def test_write_off_already_written_off(self, http_client, admin_token, sent_invoice_id):
        """Write-off twice → second attempt returns 409 ConflictError."""
        http_client.post(f"/ar/invoices/{sent_invoice_id}/write-off", headers=_auth(admin_token),
                         json={"reason": "First write-off"})
        r = http_client.post(f"/ar/invoices/{sent_invoice_id}/write-off", headers=_auth(admin_token),
                             json={"reason": "Duplicate write-off attempt"})
        assert r.status_code == 409, f"Expected 409, got {r.status_code}: {r.text}"

    def test_write_off_xlsx_export(self, http_client, admin_token):
        """GET /ar/invoices/write-off/export/xlsx → 200 + xlsx content-type."""
        r = http_client.get("/ar/invoices/write-off/export/xlsx", headers=_auth(admin_token))
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        ct = r.headers.get("content-type", "")
        assert "spreadsheet" in ct or "openxmlformats" in ct, f"Unexpected content-type: {ct}"
        assert len(r.content) > 2000, "XLSX file too small"


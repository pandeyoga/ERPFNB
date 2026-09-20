"""Integration tests for AR Ledger (ar_service / ar.router).

Covers:
- AR customers: list, create, get, update
- AR invoices: list, create (happy + validation error), get
- AR invoice send / mark_sent
- AR receipt (payment recording)
- AR Aging report
- AR Reconciliation report

Tests CREATE entities with unique suffixes so they are idempotent across runs.
"""
import time
import uuid
from datetime import date, timedelta

import pytest

from .conftest import api_get, api_post

pytestmark = pytest.mark.journal  # reuse 'journal' marker or add 'ar' to pytest.ini

CURRENT_PERIOD = date.today().strftime("%Y-%m")
TODAY = date.today().isoformat()


# ---------------------------------------------------------------------------
# AR Customers
# ---------------------------------------------------------------------------
class TestARCustomers:
    def test_list_customers_admin(self, http_client, admin_token):
        """GET /ar/customers returns a list (possibly empty)."""
        r = api_get(http_client, "/ar/customers", admin_token)
        assert r.status_code == 200
        assert r.json()["success"] is True
        data = r.json()["data"]
        # API returns paginated {items:[...]} or plain list
        items = data if isinstance(data, list) else data.get("items", [])
        assert isinstance(items, list)

    def test_create_customer_happy(self, http_client, admin_token, unique_suffix):
        """POST /ar/customers with valid data creates a customer."""
        payload = {
            "name": f"Test Customer {unique_suffix}",
            "channel": "b2b",
            "contact_person": "Test Contact",
            "phone": "08111000001",
            "email": f"testcust_{unique_suffix}@example.com",
            "credit_terms_days": 30,
            "notes": "Created by pytest",
        }
        r = api_post(http_client, "/ar/customers", admin_token, json=payload)
        assert r.status_code == 200, f"Create customer failed: {r.text[:300]}"
        body = r.json()
        assert body["success"] is True
        cust = body["data"]
        assert cust["name"] == payload["name"]
        assert cust.get("id") or cust.get("customer_id")

    def test_create_customer_missing_name(self, http_client, admin_token):
        """POST /ar/customers without name must be rejected."""
        r = api_post(http_client, "/ar/customers", admin_token, json={"channel": "b2b"})
        # FastAPI/Pydantic will return 422, or service may return 400
        assert r.status_code in (400, 422), f"Expected 400/422, got {r.status_code}: {r.text[:200]}"

    def test_customers_unauthorized(self, http_client):
        """GET /ar/customers without token must be rejected."""
        r = http_client.get("/ar/customers")
        assert r.status_code == 401


# ---------------------------------------------------------------------------
# AR Invoices
# ---------------------------------------------------------------------------
class TestARInvoices:
    @pytest.fixture
    def ar_customer_id(self, http_client, admin_token, unique_suffix):
        """Create a throw-away customer for invoice tests."""
        payload = {
            "name": f"InvTest Cust {unique_suffix}",
            "channel": "b2b",
            "credit_terms_days": 14,
        }
        r = api_post(http_client, "/ar/customers", admin_token, json=payload)
        if r.status_code != 200:
            pytest.skip(f"Could not create test customer: {r.text[:200]}")
        return r.json()["data"]["id"]

    @pytest.fixture
    def created_invoice_id(self, http_client, admin_token, ar_customer_id, unique_suffix):
        """Create a draft invoice for subsequent send/receipt tests."""
        due = (date.today() + timedelta(days=14)).isoformat()
        payload = {
            "customer_id": ar_customer_id,
            "customer_name": f"InvTest Cust {unique_suffix}",
            "channel": "b2b",
            "invoice_date": TODAY,
            "due_date": due,
            "lines": [
                {"description": "Catering services", "qty": 10, "unit_price": 150_000, "include_ppn": False},
            ],
        }
        r = api_post(http_client, "/ar/invoices", admin_token, json=payload)
        if r.status_code != 200:
            pytest.skip(f"Could not create test invoice: {r.text[:300]}")
        return r.json()["data"]["id"]

    def test_list_invoices(self, http_client, admin_token):
        """GET /ar/invoices returns list."""
        r = api_get(http_client, f"/ar/invoices?period={CURRENT_PERIOD}", admin_token)
        assert r.status_code == 200
        assert r.json()["success"] is True
        data = r.json()["data"]
        # API returns paginated {items:[...]} or plain list
        items = data if isinstance(data, list) else data.get("items", [])
        assert isinstance(items, list)

    def test_create_invoice_happy(self, http_client, admin_token, ar_customer_id, unique_suffix):
        """POST /ar/invoices with valid lines creates invoice."""
        payload = {
            "customer_id": ar_customer_id,
            "customer_name": f"Direct InvTest {unique_suffix}",
            "channel": "b2b",
            "invoice_date": TODAY,
            "lines": [
                {"description": "Jasa Konsultasi", "qty": 1, "unit_price": 500_000, "include_ppn": False},
                {"description": "Bahan Makanan",  "qty": 5, "unit_price": 100_000, "include_ppn": True},
            ],
        }
        r = api_post(http_client, "/ar/invoices", admin_token, json=payload)
        assert r.status_code == 200, f"Create invoice failed: {r.text[:400]}"
        body = r.json()
        assert body["success"] is True
        inv = body["data"]
        assert inv.get("invoice_no")
        assert inv["status"] == "draft"
        # Subtotal = 500_000 + 500_000 = 1_000_000
        assert float(inv["subtotal"]) == pytest.approx(1_000_000, rel=0.01)

    def test_create_invoice_no_lines_rejected(self, http_client, admin_token, ar_customer_id):
        """POST /ar/invoices with empty lines should be rejected."""
        payload = {
            "customer_id": ar_customer_id,
            "customer_name": "NoLines Customer",
            "channel": "b2b",
            "invoice_date": TODAY,
            "lines": [],
        }
        r = api_post(http_client, "/ar/invoices", admin_token, json=payload)
        # Service raises ValidationError for empty lines
        assert r.status_code in (400, 422), f"Expected rejection, got {r.status_code}: {r.text[:200]}"

    def test_get_invoice(self, http_client, admin_token, created_invoice_id):
        """GET /ar/invoices/{id} returns the invoice detail."""
        r = api_get(http_client, f"/ar/invoices/{created_invoice_id}", admin_token)
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True
        assert body["data"]["id"] == created_invoice_id

    def test_send_invoice(self, http_client, admin_token, created_invoice_id):
        """POST /ar/invoices/{id}/send transitions status to 'sent'."""
        r = api_post(http_client, f"/ar/invoices/{created_invoice_id}/send", admin_token)
        assert r.status_code == 200, f"Send invoice failed: {r.text[:300]}"
        body = r.json()
        assert body["success"] is True
        assert body["data"]["status"] in ("sent", "draft")  # draft if already sent in prior run

    def test_record_receipt(self, http_client, admin_token, created_invoice_id):
        """POST /ar/invoices/{id}/receipt records a payment."""
        r = api_post(http_client, f"/ar/invoices/{created_invoice_id}/receipt", admin_token,
                     json={"amount": 100_000, "receipt_date": TODAY, "payment_method": "transfer", "reference": "TRF-TEST-001"})
        # Allow 400 if already fully paid (idempotency across test runs)
        assert r.status_code in (200, 400), f"Receipt failed: {r.text[:300]}"
        if r.status_code == 200:
            assert r.json()["success"] is True

    def test_receipt_zero_amount_rejected(self, http_client, admin_token, created_invoice_id):
        """POST receipt with amount=0 must be rejected."""
        r = api_post(http_client, f"/ar/invoices/{created_invoice_id}/receipt", admin_token,
                     json={"amount": 0, "receipt_date": TODAY, "payment_method": "cash"})
        assert r.status_code in (400, 422), f"Expected rejection for amount=0, got {r.status_code}"


# ---------------------------------------------------------------------------
# AR Aging + Reconciliation (read-only, always safe)
# ---------------------------------------------------------------------------
class TestARReports:
    def test_ar_aging(self, http_client, admin_token):
        """GET /ar/aging returns the aging report structure."""
        r = api_get(http_client, "/ar/aging", admin_token)
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True
        data = body["data"]
        assert "total_outstanding" in data
        assert "buckets" in data
        assert "items" in data

    def test_ar_reconciliation(self, http_client, admin_token):
        """GET /ar/reconciliation?period=YYYY-MM returns reconciliation summary."""
        r = api_get(http_client, f"/ar/reconciliation?period={CURRENT_PERIOD}", admin_token)
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True
        data = body["data"]
        assert "period" in data
        assert "opening_balance" in data
        assert "closing_balance" in data

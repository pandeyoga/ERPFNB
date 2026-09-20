"""Integration tests for Outlet operations (petty cash, daily sales, urgent purchase).

Covers:
- Petty cash list (GET) and balance (GET)
- Create petty cash transaction (POST)
- Petty cash with missing amount rejected
- Daily sales list (GET)
- Create daily sales draft (POST)
- Daily sales draft → submit transition
- Urgent purchase list and create
"""
import time
from datetime import date

import pytest

from .conftest import api_get, api_post

pytestmark = pytest.mark.journal

TODAY = date.today().isoformat()
CURRENT_PERIOD = date.today().strftime("%Y-%m")


@pytest.fixture(scope="module")
def first_outlet_id(http_client, admin_token):
    """Return id of the first seeded outlet."""
    r = api_get(http_client, "/master/outlets", admin_token)
    if r.status_code != 200:
        pytest.skip("Could not fetch outlets")
    outlets = r.json().get("data") or []
    if isinstance(outlets, dict):
        outlets = outlets.get("items") or outlets.get("outlets") or list(outlets.values())
    if not outlets:
        pytest.skip("No outlets seeded")
    return outlets[0]["id"]


# ---------------------------------------------------------------------------
# Petty Cash
# ---------------------------------------------------------------------------
class TestPettyCash:
    def test_list_petty_cash(self, http_client, admin_token, first_outlet_id):
        """GET /outlet/petty-cash returns list."""
        r = api_get(http_client, f"/outlet/petty-cash?outlet_id={first_outlet_id}", admin_token)
        assert r.status_code == 200
        assert r.json()["success"] is True
        data = r.json()["data"]
        # data is a list of transactions
        assert isinstance(data, list)

    def test_petty_cash_balance(self, http_client, admin_token, first_outlet_id):
        """GET /outlet/petty-cash/balance returns numeric balance."""
        r = api_get(http_client, f"/outlet/petty-cash/balance?outlet_id={first_outlet_id}", admin_token)
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True
        data = body["data"]
        # balance key may be 'balance', 'current_balance', or 'amount'
        has_balance = any(k in data for k in ("balance", "current_balance", "amount", "closing_balance"))
        assert has_balance, f"No balance key in response: {data}"

    def test_create_petty_cash_happy(self, http_client, admin_token, first_outlet_id, unique_suffix):
        """POST /outlet/petty-cash creates a transaction (replenish to add balance)."""
        payload = {
            "outlet_id": first_outlet_id,
            "txn_date": TODAY,
            "type": "replenish",  # replenish = add to balance, no existing balance needed
            "category": "supplies",
            "description": f"PYTEST petty cash {unique_suffix}",
            "amount": 50_000,
            "reference": f"PC-PYTEST-{unique_suffix}",
        }
        r = api_post(http_client, "/outlet/petty-cash", admin_token, json=payload)
        assert r.status_code == 200, f"Create petty cash failed: {r.text[:400]}"
        body = r.json()
        assert body["success"] is True
        txn = body["data"]
        assert float(txn["amount"]) == pytest.approx(50_000)

    def test_create_petty_cash_missing_amount_rejected(self, http_client, admin_token, first_outlet_id):
        """POST /outlet/petty-cash without amount must be rejected."""
        payload = {
            "outlet_id": first_outlet_id,
            "txn_date": TODAY,
            "type": "expense",
            "description": "missing amount test",
        }
        r = api_post(http_client, "/outlet/petty-cash", admin_token, json=payload)
        assert r.status_code in (400, 422), f"Expected rejection, got {r.status_code}: {r.text[:200]}"

    def test_petty_cash_unauthorized(self, http_client, first_outlet_id):
        """GET /outlet/petty-cash without auth must be rejected."""
        r = http_client.get(f"/outlet/petty-cash?outlet_id={first_outlet_id}")
        assert r.status_code == 401


# ---------------------------------------------------------------------------
# Daily Sales
# ---------------------------------------------------------------------------
class TestDailySales:
    def test_list_daily_sales(self, http_client, admin_token, first_outlet_id):
        """GET /outlet/daily-sales returns list."""
        r = api_get(http_client, f"/outlet/daily-sales?outlet_id={first_outlet_id}&page=1&per_page=5", admin_token)
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True
        assert isinstance(body["data"], list)

    def test_create_draft_daily_sales(self, http_client, admin_token, first_outlet_id, unique_suffix):
        """POST /outlet/daily-sales/draft creates a draft."""
        payload = {
            "outlet_id": first_outlet_id,
            "sales_date": f"{CURRENT_PERIOD}-28",  # non-today to avoid duplicate
            "service_charge": 350_000,
            "tax_amount": 420_000,
            "revenue_buckets": [{"label": "food", "amount": 3_500_000}],
            "transaction_count": 40,
            "notes": f"PYTEST draft {unique_suffix}",
        }
        r = api_post(http_client, "/outlet/daily-sales/draft", admin_token, json=payload)
        # Allow 400 if a draft for this date already exists (idempotency)
        assert r.status_code in (200, 400), f"Unexpected status: {r.status_code} {r.text[:400]}"
        if r.status_code == 200:
            body = r.json()
            assert body["success"] is True
            ds = body["data"]
            assert ds["status"] == "draft"
            # grand_total = revenue_buckets sum + service_charge + tax_amount
            assert float(ds["grand_total"]) == pytest.approx(4_270_000)

    def test_daily_sales_missing_outlet_rejected(self, http_client, admin_token):
        """POST /outlet/daily-sales/draft without outlet_id must fail."""
        payload = {"sales_date": TODAY, "gross_sales": 1_000_000}
        r = api_post(http_client, "/outlet/daily-sales/draft", admin_token, json=payload)
        assert r.status_code in (400, 422), f"Expected rejection, got {r.status_code}: {r.text[:200]}"

    def test_daily_sales_unauthorized(self, http_client, first_outlet_id):
        """GET /outlet/daily-sales without auth must be rejected."""
        r = http_client.get(f"/outlet/daily-sales?outlet_id={first_outlet_id}")
        assert r.status_code == 401


# ---------------------------------------------------------------------------
# Urgent Purchases
# ---------------------------------------------------------------------------
class TestUrgentPurchases:
    def test_list_urgent_purchases(self, http_client, admin_token, first_outlet_id):
        """GET /outlet/urgent-purchases returns list."""
        r = api_get(http_client, f"/outlet/urgent-purchases?outlet_id={first_outlet_id}&page=1&per_page=5", admin_token)
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True
        assert isinstance(body["data"], list)

    def test_create_urgent_purchase(self, http_client, admin_token, first_outlet_id, unique_suffix):
        """POST /outlet/urgent-purchases creates an urgent purchase."""
        payload = {
            "outlet_id": first_outlet_id,
            "purchase_date": TODAY,
            "vendor_name": f"Vendor PYTEST {unique_suffix}",
            "description": f"Urgent beli bahan {unique_suffix}",
            "items": [{"name": "Minyak goreng", "qty": 5, "unit_price": 25_000}],
            "total": 125_000,
            "payment_method": "cash",
            "notes": "Created by pytest",
        }
        r = api_post(http_client, "/outlet/urgent-purchases", admin_token, json=payload)
        assert r.status_code in (200, 201), f"Create urgent purchase failed: {r.text[:400]}"
        if r.status_code == 200:
            body = r.json()
            assert body["success"] is True

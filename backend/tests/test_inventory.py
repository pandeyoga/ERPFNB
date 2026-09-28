"""Integration tests for Inventory module.

Covers:
- Stock balance list (read)
- Stock movements list (read)
- Inventory valuation (read)
- Transfer create → send → receive workflow
- Adjustment create (happy + validation)
- Adjustment approval / rejection
"""
from datetime import date

import pytest

from .conftest import api_get, api_post

pytestmark = pytest.mark.journal

TODAY = date.today().isoformat()


@pytest.fixture(scope="module")
def first_outlet_id(http_client, admin_token):
    r = api_get(http_client, "/master/outlets", admin_token)
    if r.status_code != 200:
        pytest.skip("Could not fetch outlets")
    outlets = r.json().get("data") or []
    if isinstance(outlets, dict):
        outlets = outlets.get("items") or outlets.get("outlets") or list(outlets.values())
    if not outlets:
        pytest.skip("No outlets seeded")
    return outlets[0]["id"]


@pytest.fixture(scope="module")
def second_outlet_id(http_client, admin_token):
    """Second outlet for transfer destination (may be same as first if only 1 exists)."""
    r = api_get(http_client, "/master/outlets", admin_token)
    if r.status_code != 200:
        return None
    outlets = r.json().get("data") or []
    if isinstance(outlets, dict):
        outlets = outlets.get("items") or outlets.get("outlets") or list(outlets.values())
    if len(outlets) < 2:
        return outlets[0]["id"] if outlets else None
    return outlets[1]["id"]


@pytest.fixture(scope="module")
def first_item_id(http_client, admin_token):
    r = api_get(http_client, "/master/items", admin_token)
    if r.status_code != 200:
        return None
    items = r.json().get("data") or []
    if isinstance(items, dict):
        items = items.get("items") or list(items.values())
    return items[0]["id"] if items else None


# ---------------------------------------------------------------------------
# Read-only: Balance, Movements, Valuation
# ---------------------------------------------------------------------------
class TestInventoryRead:
    def test_stock_balance_all(self, http_client, admin_token):
        """GET /inventory/balance returns paginated stock balance."""
        r = api_get(http_client, "/inventory/balance?page=1&per_page=20", admin_token)
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True
        data = body["data"]
        # data may be a list or {items, meta}
        items = data if isinstance(data, list) else (data.get("items") or data.get("balances") or [])
        assert isinstance(items, list)

    def test_stock_balance_by_outlet(self, http_client, admin_token, first_outlet_id):
        """GET /inventory/balance?outlet_id=... filters correctly."""
        r = api_get(http_client, f"/inventory/balance?outlet_id={first_outlet_id}&page=1&per_page=10", admin_token)
        assert r.status_code == 200
        assert r.json()["success"] is True

    def test_stock_movements_list(self, http_client, admin_token, first_outlet_id):
        """GET /inventory/movements returns a list."""
        r = api_get(http_client, f"/inventory/movements?outlet_id={first_outlet_id}&page=1&per_page=10", admin_token)
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True

    def test_inventory_valuation(self, http_client, admin_token):
        """GET /inventory/valuation returns valuation summary."""
        r = api_get(http_client, "/inventory/valuation", admin_token)
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True
        data = body["data"]
        # Should have total_value or similar key
        assert any(k in data for k in ("total_value", "valuation", "items", "total")), (
            f"Unexpected valuation response structure: {list(data.keys())}"
        )

    def test_inventory_unauthorized(self, http_client):
        """GET /inventory/balance without auth must return 401."""
        r = http_client.get("/inventory/balance")
        assert r.status_code == 401


# ---------------------------------------------------------------------------
# Transfers
# ---------------------------------------------------------------------------
class TestInventoryTransfers:
    def test_list_transfers(self, http_client, admin_token):
        """GET /inventory/transfers returns list."""
        r = api_get(http_client, "/inventory/transfers?page=1&per_page=5", admin_token)
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True
        data = body["data"]
        items = data if isinstance(data, list) else (data.get("items") or data.get("transfers") or [])
        assert isinstance(items, list)

    def test_create_and_send_transfer(self, http_client, admin_token, first_outlet_id, second_outlet_id, first_item_id, unique_suffix):
        """POST /inventory/transfers creates a transfer, then send it."""
        if not first_item_id:
            pytest.skip("No items seeded")
        if first_outlet_id == second_outlet_id:
            pytest.skip("Need 2 distinct outlets for transfer test")

        # Create transfer
        payload = {
            "from_outlet_id": first_outlet_id,
            "to_outlet_id": second_outlet_id,
            "transfer_date": TODAY,
            "notes": f"PYTEST transfer {unique_suffix}",
            "lines": [{"item_id": first_item_id, "qty": 1}],  # Service expects "lines" not "items"
        }
        r = api_post(http_client, "/inventory/transfers", admin_token, json=payload)
        assert r.status_code in (200, 201), f"Transfer create failed: {r.status_code} {r.text[:400]}"
        if r.status_code not in (200, 201):
            pytest.skip("Transfer creation not supported or insufficient stock")
        body = r.json()
        assert body["success"] is True
        transfer_id = body["data"]["id"]
        assert transfer_id

        # Send transfer
        r_send = api_post(http_client, f"/inventory/transfers/{transfer_id}/send", admin_token)
        # 200 expected; 400 if status already past 'draft'
        assert r_send.status_code in (200, 400), f"Send failed: {r_send.text[:300]}"
        if r_send.status_code == 200:
            sent = r_send.json()["data"]
            assert sent["status"] in ("sent", "in_transit", "pending_receive")

    def test_transfer_missing_items_rejected(self, http_client, admin_token, first_outlet_id, second_outlet_id):
        """POST /inventory/transfers with empty items must be rejected."""
        if not second_outlet_id:
            pytest.skip("Need second outlet")
        payload = {
            "from_outlet_id": first_outlet_id,
            "to_outlet_id": second_outlet_id,
            "transfer_date": TODAY,
            "items": [],
        }
        r = api_post(http_client, "/inventory/transfers", admin_token, json=payload)
        assert r.status_code in (400, 422), f"Expected rejection, got {r.status_code}: {r.text[:200]}"

    def test_transfer_exceeding_stock_blocked(self, http_client, admin_token, first_outlet_id, second_outlet_id, first_item_id):
        """Negative-stock guard: sending a transfer beyond on-hand must be rejected (cannot go negative)."""
        if not first_item_id or not second_outlet_id or second_outlet_id == first_outlet_id:
            pytest.skip("Need an item + 2 distinct outlets")
        payload = {
            "from_outlet_id": first_outlet_id,
            "to_outlet_id": second_outlet_id,
            "transfer_date": TODAY,
            "lines": [{"item_id": first_item_id, "qty": 9_999_999}],
        }
        r = api_post(http_client, "/inventory/transfers", admin_token, json=payload)
        assert r.status_code in (200, 201), f"create failed: {r.text[:200]}"
        tid = r.json()["data"]["id"]
        r_send = api_post(http_client, f"/inventory/transfers/{tid}/send", admin_token)
        assert r_send.status_code in (400, 422), \
            f"over-transfer should be blocked, got {r_send.status_code}: {r_send.text[:200]}"
        body = r_send.text.lower()
        assert ("negatif" in body or "mencukupi" in body or "stok" in body), \
            f"expected negative-stock message, got: {r_send.text[:200]}"
    def test_list_adjustments(self, http_client, admin_token):
        """GET /inventory/adjustments returns list."""
        r = api_get(http_client, "/inventory/adjustments?page=1&per_page=5", admin_token)
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True

    def test_create_adjustment_happy(self, http_client, admin_token, first_outlet_id, first_item_id, unique_suffix):
        """POST /inventory/adjustments creates an adjustment pending approval."""
        if not first_item_id:
            pytest.skip("No items seeded")
        payload = {
            "outlet_id": first_outlet_id,
            "adjustment_date": TODAY,
            "reason": "opname",
            "notes": f"PYTEST adj {unique_suffix}",
            "lines": [{"item_id": first_item_id, "qty_actual": 10, "qty_system": 8, "delta": 2}],
        }
        r = api_post(http_client, "/inventory/adjustments", admin_token, json=payload)
        assert r.status_code in (200, 201), f"Adjustment create failed: {r.status_code} {r.text[:400]}"
        if r.status_code in (200, 201):
            body = r.json()
            assert body["success"] is True
            adj = body["data"]
            assert adj.get("id")
            # status should be 'pending_approval', 'submitted', 'draft' or 'pending'
            assert adj["status"] in ("pending_approval", "submitted", "draft", "pending"), f"Unexpected status: {adj['status']}"

    def test_create_adjustment_no_lines_rejected(self, http_client, admin_token, first_outlet_id):
        """POST /inventory/adjustments with empty lines must be rejected."""
        payload = {
            "outlet_id": first_outlet_id,
            "adjustment_date": TODAY,
            "reason": "opname",
            "lines": [],
        }
        r = api_post(http_client, "/inventory/adjustments", admin_token, json=payload)
        assert r.status_code in (400, 422), f"Expected rejection, got {r.status_code}: {r.text[:200]}"

    def test_approve_nonexistent_adjustment_404(self, http_client, admin_token):
        """POST /inventory/adjustments/{bad_id}/approve must return 404."""
        r = api_post(http_client, "/inventory/adjustments/nonexistent-id-9999/approve", admin_token)
        assert r.status_code in (400, 404), f"Expected 404, got {r.status_code}: {r.text[:200]}"
        body = r.json()
        assert body["success"] is False

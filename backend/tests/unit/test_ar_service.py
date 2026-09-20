"""Unit tests for services._ar (Accounts Receivable) module.

Semua test disesuaikan dengan signature aktual:
  - create_customer(payload, *, user_id: str)       — bukan user=
  - _next_invoice_no()                              — async, 0 args, baca system_settings
  - create_invoice(payload, *, user_id: str)        — bukan user=
  - list_invoices(*, ...) -> tuple[list, dict]      — returns tuple
  - record_receipt(invoice_id, ..., *, user_id: str) — bukan payload dict
  - ar_aging() -> dict                              — async for cursor
"""
import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch


# ── Async iterator helper untuk mock Motor "async for" ─────────────────────
class AsyncIterMock:
    """Mock Motor async cursor untuk 'async for doc in cursor' pattern."""
    def __init__(self, items):
        self._items = iter(items)

    def __aiter__(self):
        return self

    async def __anext__(self):
        try:
            return next(self._items)
        except StopIteration:
            raise StopAsyncIteration


from services._ar import (
    create_customer,
    list_customers,
    update_customer,
    create_invoice,
    list_invoices,
    get_invoice,
    record_receipt,
    ar_aging,
)
from services._ar.invoice import _next_invoice_no


# ─────────────────────────────────────────────────────────────────────────────
class TestARCustomer:
    """Test AR customer management."""

    @pytest.mark.asyncio
    async def test_create_customer_success(self):
        """Test creating a new AR customer."""
        mock_db = MagicMock()
        mock_ar_customers = MagicMock()
        mock_db.ar_customers = mock_ar_customers
        mock_ar_customers.insert_one = AsyncMock()
        mock_ar_customers.find_one = AsyncMock(return_value=None)

        # Actual payload uses "name" (not "customer_name"), "npwp" (not "tax_id")
        payload = {
            "name": "Acme Corp",
            "npwp": "01.234.567.8-901.000",
            "email": "billing@acme.com",
            "phone": "021-12345678",
            "address": "Jl. Sudirman 123, Jakarta",
            "channel": "b2b",
            "credit_terms_days": 30,
        }

        # Actual signature: create_customer(payload, *, user_id: str)
        with patch("services._ar.customer.get_db", return_value=mock_db):
            result = await create_customer(payload, user_id="finance@fnbgroup.id")

            assert result["name"] == "Acme Corp"
            assert "id" in result
            mock_ar_customers.insert_one.assert_called_once()

    @pytest.mark.asyncio
    async def test_list_customers(self):
        """Test listing all AR customers."""
        mock_db = MagicMock()
        mock_ar_customers = MagicMock()
        mock_db.ar_customers = mock_ar_customers

        mock_cursor = MagicMock()
        mock_cursor.sort = MagicMock(return_value=mock_cursor)
        mock_cursor.to_list = AsyncMock(return_value=[
            {"id": "cust-001", "name": "Acme Corp", "balance": 1_000_000},
            {"id": "cust-002", "name": "Beta Inc",  "balance": 500_000},
        ])
        mock_ar_customers.find = MagicMock(return_value=mock_cursor)

        with patch("services._ar.customer.get_db", return_value=mock_db):
            result = await list_customers()
            assert len(result) == 2
            assert result[0]["name"] == "Acme Corp"

    @pytest.mark.asyncio
    async def test_update_customer(self):
        """Test updating customer information."""
        mock_db = MagicMock()
        mock_ar_customers = MagicMock()
        mock_db.ar_customers = mock_ar_customers

        existing = {"id": "cust-001", "name": "Acme Corp", "email": "old@acme.com"}
        updated  = {"id": "cust-001", "name": "Acme Corp", "email": "new@acme.com", "phone": "021-99999999"}

        mock_ar_customers.find_one = AsyncMock(side_effect=[existing, updated])
        mock_ar_customers.update_one = AsyncMock(return_value=MagicMock(modified_count=1))

        updates = {"email": "new@acme.com", "phone": "021-99999999"}

        # Actual signature: update_customer(customer_id, payload, *, user_id: str)
        with patch("services._ar.customer.get_db", return_value=mock_db):
            result = await update_customer("cust-001", updates, user_id="finance@fnbgroup.id")
            mock_ar_customers.update_one.assert_called_once()


# ─────────────────────────────────────────────────────────────────────────────
class TestARInvoice:
    """Test AR invoice management."""

    @pytest.mark.asyncio
    async def test_next_invoice_no_format(self):
        """Test invoice number generation uses system_settings SSOT."""
        mock_db = MagicMock()
        mock_system = MagicMock()
        mock_db.system_settings = mock_system

        year = datetime.now(timezone.utc).year
        mock_system.find_one_and_update = AsyncMock(return_value={"key": f"AR_INV_SEQ_{year}", "seq": 1})

        with patch("services._ar.invoice.get_db", return_value=mock_db):
            result = await _next_invoice_no()
            assert result.startswith(f"INV-{year}-")
            assert len(result.split("-")) == 3
            mock_system.find_one_and_update.assert_called_once()

    @pytest.mark.asyncio
    async def test_next_invoice_no_increments(self):
        """Test invoice number increments correctly."""
        mock_db = MagicMock()
        year = datetime.now(timezone.utc).year
        mock_db.system_settings.find_one_and_update = AsyncMock(
            return_value={"seq": 99}
        )

        with patch("services._ar.invoice.get_db", return_value=mock_db):
            result = await _next_invoice_no()
            assert result == f"INV-{year}-00099"

    @pytest.mark.asyncio
    async def test_create_invoice_success(self):
        """Test creating a new AR invoice."""
        mock_db = MagicMock()
        mock_db.ar_invoices = MagicMock()
        mock_db.system_settings = MagicMock()
        mock_db.ar_customers = MagicMock()

        year = datetime.now(timezone.utc).year
        mock_db.system_settings.find_one_and_update = AsyncMock(
            return_value={"seq": 100}
        )
        mock_db.ar_invoices.insert_one = AsyncMock()
        # create_invoice also calls db.ar_customers.find_one for customer lookup
        mock_db.ar_customers.find_one = AsyncMock(return_value={
            "id": "cust-001", "name": "Acme Corp", "credit_terms_days": 30
        })

        payload = {
            "customer_id": "cust-001",
            "invoice_date": f"{year}-06-01",
            "due_date": f"{year}-06-30",
            "lines": [
                {"description": "Catering Service", "qty": 1, "unit_price": 5_000_000}
            ],
            "tax_rate": 11,
        }

        # Actual signature: create_invoice(payload, *, user_id: str)
        with patch("services._ar.invoice.get_db", return_value=mock_db):
            with patch("services._ar.journal._post_ar_je", new=AsyncMock(return_value=None)):
                result = await create_invoice(payload, user_id="finance@fnbgroup.id")

                assert result["customer_id"] == "cust-001"
                assert "invoice_no" in result
                mock_db.ar_invoices.insert_one.assert_called_once()

    @pytest.mark.asyncio
    async def test_list_invoices_with_status_filter(self):
        """Test listing invoices returns (items, meta) tuple."""
        mock_db = MagicMock()
        mock_ar_invoices = MagicMock()
        mock_db.ar_invoices = mock_ar_invoices

        mock_cursor = MagicMock()
        mock_cursor.sort = MagicMock(return_value=mock_cursor)
        mock_cursor.skip = MagicMock(return_value=mock_cursor)
        mock_cursor.limit = MagicMock(return_value=mock_cursor)
        mock_cursor.to_list = AsyncMock(return_value=[
            {"id": "inv-001", "invoice_no": "INV-2024-001", "status": "sent", "total": 5_550_000},
        ])
        mock_ar_invoices.find = MagicMock(return_value=mock_cursor)
        mock_ar_invoices.count_documents = AsyncMock(return_value=1)

        # list_invoices returns tuple[list, dict]
        with patch("services._ar.invoice.get_db", return_value=mock_db):
            result = await list_invoices(status="sent")
            items, meta = result  # Unpack tuple
            assert len(items) == 1
            assert items[0]["status"] == "sent"
            assert "total" in meta

    @pytest.mark.asyncio
    async def test_get_invoice_by_id(self):
        """Test getting specific invoice returns dict (None if not found)."""
        mock_db = MagicMock()
        mock_ar_invoices = MagicMock()
        mock_db.ar_invoices = mock_ar_invoices
        mock_ar_invoices.find_one = AsyncMock(return_value={
            "id": "inv-001",
            "invoice_no": "INV-2024-001",
            "customer_id": "cust-001",
            "total": 5_550_000,
            "status": "sent",
            "due_date": "2099-12-31",  # Not overdue
        })

        with patch("services._ar.invoice.get_db", return_value=mock_db):
            result = await get_invoice("inv-001")
            assert result is not None
            assert result["id"] == "inv-001"
            assert result["invoice_no"] == "INV-2024-001"

    @pytest.mark.asyncio
    async def test_get_invoice_returns_none_when_not_found(self):
        """Test get_invoice returns None (not 404) when not found."""
        mock_db = MagicMock()
        mock_db.ar_invoices.find_one = AsyncMock(return_value=None)

        with patch("services._ar.invoice.get_db", return_value=mock_db):
            result = await get_invoice("nonexistent-id")
            assert result is None  # Returns None, not raises HTTPException


# ─────────────────────────────────────────────────────────────────────────────
class TestARReceipt:
    """Test AR receipt recording."""

    @pytest.mark.asyncio
    async def test_record_receipt_full_payment(self):
        """Test recording a full payment receipt with individual args."""
        mock_db = MagicMock()
        mock_db.ar_invoices = MagicMock()
        mock_db.ar_receipts = MagicMock()

        invoice = {
            "id": "inv-001",
            "invoice_no": "INV-2024-001",
            "total": 5_550_000,
            "outstanding": 5_550_000,
            "status": "sent",
            "deleted_at": None,
        }

        mock_db.ar_invoices.find_one = AsyncMock(return_value=invoice)
        mock_db.ar_invoices.update_one = AsyncMock(return_value=MagicMock(modified_count=1))
        mock_db.ar_receipts.insert_one = AsyncMock()

        # Actual signature: record_receipt(invoice_id, receipt_date, amount, ..., *, user_id)
        # Patch _post_ar_je at its source module (services._ar.journal)
        with patch("services._ar.receipt.get_db", return_value=mock_db):
            with patch("services._ar.journal._post_ar_je", new=AsyncMock(return_value=None)):
                result = await record_receipt(
                    "inv-001",
                    receipt_date="2024-06-15",
                    amount=5_550_000,
                    payment_method="bank_transfer",
                    reference="TRF-123456",
                    user_id="finance@fnbgroup.id",
                )
                assert result["amount"] == 5_550_000
                assert result["invoice_id"] == "inv-001"
                mock_db.ar_receipts.insert_one.assert_called_once()


# ─────────────────────────────────────────────────────────────────────────────
class TestARAging:
    """Test AR aging report."""

    @pytest.mark.asyncio
    async def test_ar_aging_buckets(self):
        """Test AR aging generates correct total_outstanding and buckets dict."""
        mock_db = MagicMock()
        today = datetime.now(timezone.utc).date()

        invoices = [
            {
                "id": "inv-001",
                "due_date": (today + timedelta(days=20)).isoformat(),
                "outstanding": 1_000_000,
                "status": "sent",
            },
            {
                "id": "inv-002",
                "due_date": (today - timedelta(days=30)).isoformat(),
                "outstanding": 500_000,
                "status": "overdue",
            },
        ]

        # ar_aging uses "async for inv in db.ar_invoices.find(...)"
        mock_db.ar_invoices.find = MagicMock(return_value=AsyncIterMock(invoices))

        with patch("services._ar.aging.get_db", return_value=mock_db):
            result = await ar_aging()

            assert "total_outstanding" in result
            assert "buckets" in result
            assert result["total_outstanding"] == 1_500_000


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

"""Unit tests for services._reservation module.

Semua test disesuaikan dengan implementasi aktual:
  - _normalize_phone() hanya menghapus karakter [\s\-\(\)] — TIDAK konversi ke internasional
  - create_reservation(payload, *, created_by: str)  — bukan user=; payload pakai customer_phone/reservation_date/reservation_time
  - update_reservation(id, payload, *, user_id: str) — bukan user=
  - delete_reservation(id, *, user_id: str)          — soft delete via deleted_at, bukan deleted: True
  - update_status(id, new_status, *, user_id: str)   — bukan user=
"""
import pytest
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

from services._reservation import (
    create_reservation,
    list_reservations,
    get_reservation,
    update_reservation,
    delete_reservation,
    update_status,
)
from services._reservation._common import _normalize_phone, _phone_variants
from core.exceptions import NotFoundError


def _make_mock_db():
    """Helper: buat mock_db dengan semua AsyncMock yang dibutuhkan reservation service."""
    mock_db = MagicMock()
    # reservations
    mock_db.reservations = MagicMock()
    mock_db.reservations.find_one = AsyncMock(return_value=None)
    mock_db.reservations.insert_one = AsyncMock()
    mock_db.reservations.update_one = AsyncMock(return_value=MagicMock(modified_count=1))
    mock_db.reservations.count_documents = AsyncMock(return_value=0)

    # Async cursor untuk find()
    mock_cursor = MagicMock()
    mock_cursor.sort = MagicMock(return_value=mock_cursor)
    mock_cursor.skip = MagicMock(return_value=mock_cursor)
    mock_cursor.limit = MagicMock(return_value=mock_cursor)
    mock_cursor.to_list = AsyncMock(return_value=[])
    mock_db.reservations.find = MagicMock(return_value=mock_cursor)

    # outlets — create_reservation dan get_reservation calls db.outlets.find_one
    mock_db.outlets = MagicMock()
    mock_db.outlets.find_one = AsyncMock(return_value={
        "id": "outlet-alt-001",
        "name": "The Coffeeshop",
        "brand_id": "brand-alt",
    })

    # system_configs — create_reservation reads reservation config
    mock_db.system_configs = MagicMock()
    mock_db.system_configs.find_one = AsyncMock(return_value=None)

    return mock_db


# ─────────────────────────────────────────────────────────────────────────────
class TestReservationCommon:
    """Test common utility functions for reservations."""

    def test_normalize_phone_removes_spaces_hyphens(self):
        r"""_normalize_phone ONLY removes [\s\-\(\)] — does NOT convert to international format."""
        # re.sub(r"[\s\-\(\)]", "", phone) — removes spaces, hyphens, parens simultaneously
        assert _normalize_phone("0812-3456-7890") == "081234567890"
        assert _normalize_phone("(0812) 345-6789") == "08123456789"   # removes (, ), space, -
        assert _normalize_phone("+62 812 345 6789") == "+628123456789"  # removes spaces only

    def test_normalize_phone_does_not_convert_to_e164(self):
        """Fungsi TIDAK melakukan konversi 08xx ke 628xx (itu tugas _phone_variants)."""
        # "081234567890" → tetap "081234567890" (tidak dikonversi ke "6281234567890")
        result = _normalize_phone("081234567890")
        assert result == "081234567890"  # Tetap, hanya hapus special chars

    def test_normalize_phone_removes_special_chars(self):
        """Spasi, tanda hubung, dan kurung dihapus."""
        assert _normalize_phone("0812-3456-7890") == "081234567890"
        assert _normalize_phone("021 1234 5678") == "02112345678"

    def test_phone_variants_generates_alternatives(self):
        """_phone_variants menghasilkan format alternatif untuk lookup."""
        variants = _phone_variants("081234567890")
        assert "081234567890" in variants   # Format asli
        assert "6281234567890" in variants  # Format internasional (tanpa +)
        assert len(variants) >= 2


# ─────────────────────────────────────────────────────────────────────────────
class TestReservationCRUD:
    """Test CRUD operations for reservations."""

    @pytest.mark.asyncio
    async def test_create_reservation_success(self):
        """Test creating a new reservation dengan payload dan kwarg yang benar."""
        mock_db = _make_mock_db()

        # Actual payload uses: customer_phone, reservation_date, reservation_time
        payload = {
            "outlet_id": "outlet-alt-001",
            "customer_name": "John Doe",
            "customer_phone": "081234567890",
            "customer_email": "john@example.com",
            "reservation_date": "2024-06-01",
            "reservation_time": "19:00",
            "pax": 4,
            "notes": "Birthday celebration",
        }

        # Actual signature: create_reservation(payload, *, created_by: str)
        with patch("core.db.get_db", return_value=mock_db):
            with patch("services._reservation.crud.get_db", return_value=mock_db):
                with patch("services._reservation._common.get_db", return_value=mock_db):
                    with patch("services._reservation.crud._get_or_create_member",
                               new=AsyncMock(return_value=(None, False))):
                        with patch("services._reservation.crud._notify_created",
                                   new=AsyncMock(return_value=None)):
                            result = await create_reservation(payload, created_by="manager@fnbgroup.id")

                            assert result["customer_name"] == "John Doe"
                            assert result["pax"] == 4
                            assert "id" in result
                            mock_db.reservations.insert_one.assert_called_once()

    @pytest.mark.asyncio
    async def test_list_reservations_with_filters(self):
        """Test listing reservations dengan filter date."""
        mock_db = _make_mock_db()

        mock_cursor = MagicMock()
        mock_cursor.sort = MagicMock(return_value=mock_cursor)
        mock_cursor.skip = MagicMock(return_value=mock_cursor)
        mock_cursor.limit = MagicMock(return_value=mock_cursor)
        mock_cursor.to_list = AsyncMock(return_value=[
            {"id": "res-001", "customer_name": "Alice", "reservation_date": "2024-06-01"},
            {"id": "res-002", "customer_name": "Bob",   "reservation_date": "2024-06-01"},
        ])
        mock_db.reservations.find = MagicMock(return_value=mock_cursor)
        mock_db.reservations.count_documents = AsyncMock(return_value=2)

        with patch("services._reservation.crud.get_db", return_value=mock_db):
            result = await list_reservations(date_from="2024-06-01", date_to="2024-06-30")

            # list_reservations may return (items, meta) tuple — handle both
            if isinstance(result, tuple):
                items, _ = result
            else:
                items = result
            assert len(items) == 2
            mock_db.reservations.find.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_reservation_by_id(self):
        """Test getting a specific reservation by ID."""
        mock_db = _make_mock_db()
        mock_db.reservations.find_one = AsyncMock(return_value={
            "id": "res-001",
            "customer_name": "Alice",
            "reservation_date": "2024-06-01",
            "status": "confirmed",
            "outlet_id": "outlet-alt-001",
        })

        with patch("services._reservation.crud.get_db", return_value=mock_db):
            result = await get_reservation("res-001")
            assert result["id"] == "res-001"
            assert result["customer_name"] == "Alice"

    @pytest.mark.asyncio
    async def test_get_reservation_not_found(self):
        """Test getting non-existent reservation returns None or raises."""
        mock_db = _make_mock_db()
        mock_db.reservations.find_one = AsyncMock(return_value=None)

        with patch("services._reservation.crud.get_db", return_value=mock_db):
            # get_reservation returns None when not found (doesn't raise)
            result = await get_reservation("nonexistent-id")
            assert result is None

    @pytest.mark.asyncio
    async def test_update_reservation(self):
        """Test updating reservation details — kwarg adalah user_id."""
        mock_db = _make_mock_db()

        existing = {"id": "res-001", "customer_name": "Alice", "pax": 2, "outlet_id": "outlet-alt-001", "deleted_at": None}
        mock_db.reservations.find_one = AsyncMock(return_value=existing)
        mock_db.reservations.update_one = AsyncMock(return_value=MagicMock(modified_count=1))

        updates = {"pax": 4, "notes": "Updated notes"}

        # Actual signature: update_reservation(reservation_id, payload, *, user_id: str)
        with patch("services._reservation.crud.get_db", return_value=mock_db):
            result = await update_reservation("res-001", updates, user_id="manager@fnbgroup.id")
            mock_db.reservations.update_one.assert_called_once()

    @pytest.mark.asyncio
    async def test_delete_reservation_soft_delete(self):
        """Test soft delete — menggunakan deleted_at (bukan deleted: True)."""
        mock_db = _make_mock_db()
        mock_db.reservations.find_one = AsyncMock(return_value={
            "id": "res-001",
            "customer_name": "Alice",
            "deleted_at": None,
            "outlet_id": "outlet-alt-001",
        })

        # Actual signature: delete_reservation(reservation_id, *, user_id: str)
        with patch("services._reservation.crud.get_db", return_value=mock_db):
            await delete_reservation("res-001", user_id="manager@fnbgroup.id")
            mock_db.reservations.update_one.assert_called_once()

            # Soft delete menggunakan deleted_at timestamp (bukan deleted: True)
            call_args = mock_db.reservations.update_one.call_args
            set_payload = call_args[0][1]["$set"]
            assert "deleted_at" in set_payload


# ─────────────────────────────────────────────────────────────────────────────
class TestReservationStatus:
    """Test reservation status transitions."""

    @pytest.mark.asyncio
    async def test_update_status_to_confirmed(self):
        """Test updating reservation status to confirmed."""
        mock_db = _make_mock_db()

        existing = {"id": "res-001", "status": "pending", "customer_name": "Alice",
                    "outlet_id": "outlet-alt-001", "deleted_at": None}
        mock_db.reservations.find_one = AsyncMock(return_value=existing)

        # Actual signature: update_status(reservation_id, new_status, *, user_id: str)
        with patch("services._reservation.status.get_db", return_value=mock_db):
            with patch("services._reservation.status.get_reservation",
                       new=AsyncMock(return_value=existing)):
                result = await update_status("res-001", "confirmed", user_id="manager@fnbgroup.id")

                mock_db.reservations.update_one.assert_called_once()
                call_args = mock_db.reservations.update_one.call_args
                assert call_args[0][1]["$set"]["status"] == "confirmed"

    @pytest.mark.asyncio
    async def test_update_status_invalid_transition(self):
        """Test that invalid status transitions are rejected."""
        mock_db = _make_mock_db()

        existing = {"id": "res-001", "status": "cancelled", "customer_name": "Alice",
                    "outlet_id": "outlet-alt-001", "deleted_at": None}
        mock_db.reservations.find_one = AsyncMock(return_value=existing)

        # Actual signature: update_status(reservation_id, new_status, *, user_id: str)
        with patch("services._reservation.status.get_db", return_value=mock_db):
            with patch("services._reservation.status.get_reservation",
                       new=AsyncMock(return_value=existing)):
                # cancelled → confirmed is invalid transition
                with pytest.raises(Exception) as exc_info:
                    await update_status("res-001", "confirmed", user_id="manager@fnbgroup.id")
                assert exc_info.value is not None


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

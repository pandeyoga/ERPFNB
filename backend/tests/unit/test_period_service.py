"""Unit tests for services._period module.

Semua test disesuaikan dengan implementasi aktual:
  - Koleksi: accounting_periods (BUKAN periods!)
  - get_db() adalah fungsi sinkron (tidak di-await)
  - derive_period_from_date() mengembalikan None untuk input invalid (tidak raise)
  - assert_period_unlocked() raise ValidationError (bukan HTTPException)
  - close_period(period, *, user: dict, reason=None)  — user adalah dict
"""
import pytest
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

from services._period import (
    list_periods,
    get_period,
    closing_checks,
    close_period,
    lock_period,
    reopen_period,
    is_period_locked,
    assert_period_unlocked,
    derive_period_from_date,
)
from services._period._common import _valid_period
from core.exceptions import ValidationError


# ─────────────────────────────────────────────────────────────────────────────
class TestPeriodCommon:
    """Test common utility functions."""

    def test_valid_period_correct_format(self):
        """Valid YYYY-MM format returns True."""
        assert _valid_period("2024-01") is True
        assert _valid_period("2025-12") is True

    def test_valid_period_incorrect_format(self):
        """Invalid formats return False."""
        assert _valid_period("2024-13") is False  # Month > 12
        assert _valid_period("2024-00") is False  # Month < 1
        assert _valid_period("24-01")   is False  # Year too short
        assert _valid_period("2024/01") is False  # Wrong separator
        assert _valid_period("abc")     is False  # Non-numeric


# ─────────────────────────────────────────────────────────────────────────────
class TestPeriodGuards:
    """Test period locking guards."""

    def test_derive_period_from_date(self):
        """Derive YYYY-MM from valid date string."""
        assert derive_period_from_date("2024-05-15") == "2024-05"
        assert derive_period_from_date("2025-12-31") == "2025-12"

    def test_derive_period_from_date_invalid(self):
        """derive_period_from_date returns None for None/empty input (does NOT raise)."""
        # Actual implementation: returns None for None/empty, first-7-chars for anything else
        assert derive_period_from_date(None) is None
        assert derive_period_from_date("") is None

    def test_derive_period_from_date_short_string(self):
        """Returns first 7 chars for any string — be aware of this behaviour."""
        # "invalid-date"[:7] == "invalid"
        result = derive_period_from_date("invalid-date")
        assert result == "invalid"  # Not None, not exception — just sliced

    @pytest.mark.asyncio
    async def test_is_period_locked_locked(self):
        """is_period_locked returns {locked: True} for locked period."""
        mock_db = MagicMock()
        mock_db.accounting_periods = MagicMock()  # ← accounting_periods, NOT periods
        mock_db.accounting_periods.find_one = AsyncMock(return_value={
            "period": "2024-05",
            "status": "locked",
            "locked_by": "admin@fnbgroup.id",
            "locked_at": datetime(2024, 5, 31, 23, 59),
        })

        with patch("services._period.guards.get_db", return_value=mock_db):
            result = await is_period_locked("2024-05")
            assert result["locked"] is True
            assert result["status"] == "locked"

    @pytest.mark.asyncio
    async def test_is_period_locked_open(self):
        """is_period_locked returns {locked: False} for open period."""
        mock_db = MagicMock()
        mock_db.accounting_periods = MagicMock()
        mock_db.accounting_periods.find_one = AsyncMock(return_value={
            "period": "2024-05",
            "status": "open",
        })

        with patch("services._period.guards.get_db", return_value=mock_db):
            result = await is_period_locked("2024-05")
            assert result["locked"] is False
            assert result["status"] == "open"

    @pytest.mark.asyncio
    async def test_is_period_locked_not_found_defaults_open(self):
        """Period not in DB defaults to open / not locked."""
        mock_db = MagicMock()
        mock_db.accounting_periods = MagicMock()
        mock_db.accounting_periods.find_one = AsyncMock(return_value=None)

        with patch("services._period.guards.get_db", return_value=mock_db):
            result = await is_period_locked("2099-01")
            assert result["locked"] is False
            assert result["status"] == "open"

    @pytest.mark.asyncio
    async def test_assert_period_unlocked_raises_when_locked(self):
        """assert_period_unlocked raises ValidationError (not HTTPException) for locked period."""
        mock_db = MagicMock()
        mock_db.accounting_periods = MagicMock()
        mock_db.accounting_periods.find_one = AsyncMock(return_value={
            "period": "2024-05",
            "status": "locked",
        })

        # Raises ValidationError (core.exceptions), NOT HTTPException
        with patch("services._period.guards.get_db", return_value=mock_db):
            with pytest.raises(ValidationError) as exc_info:
                await assert_period_unlocked("2024-05", action="test posting")
            assert "locked" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_assert_period_unlocked_passes_when_open(self):
        """assert_period_unlocked does not raise for open period."""
        mock_db = MagicMock()
        mock_db.accounting_periods = MagicMock()
        mock_db.accounting_periods.find_one = AsyncMock(return_value={
            "period": "2024-05",
            "status": "open",
        })

        with patch("services._period.guards.get_db", return_value=mock_db):
            # Should NOT raise
            await assert_period_unlocked("2024-05", action="test posting")


# ─────────────────────────────────────────────────────────────────────────────
class TestPeriodCRUD:
    """Test CRUD operations for periods."""

    @pytest.mark.asyncio
    async def test_list_periods_returns_list(self):
        """list_periods reads from accounting_periods (NOT periods)."""
        mock_db = MagicMock()
        mock_db.accounting_periods = MagicMock()  # ← accounting_periods!

        mock_cursor = MagicMock()
        mock_cursor.sort = MagicMock(return_value=mock_cursor)
        mock_cursor.to_list = AsyncMock(return_value=[
            {"period": "2024-01", "status": "closed"},
            {"period": "2024-02", "status": "open"},
        ])
        mock_db.accounting_periods.find = MagicMock(return_value=mock_cursor)

        with patch("services._period.crud.get_db", return_value=mock_db):
            result = await list_periods()
            assert len(result) >= 2

    @pytest.mark.asyncio
    async def test_get_period_returns_period(self):
        """get_period reads from accounting_periods."""
        mock_db = MagicMock()
        mock_db.accounting_periods = MagicMock()
        mock_db.accounting_periods.find_one = AsyncMock(return_value={
            "period": "2024-05",
            "status": "open",
            "fiscal_year": 2024,
        })

        with patch("services._period.crud.get_db", return_value=mock_db):
            result = await get_period("2024-05")
            assert result["period"] == "2024-05"
            assert result["status"] == "open"

    @pytest.mark.asyncio
    async def test_get_period_not_found_raises_validation_error(self):
        """get_period raises ValidationError for non-existent period with invalid format."""
        mock_db = MagicMock()
        mock_db.accounting_periods = MagicMock()
        mock_db.accounting_periods.find_one = AsyncMock(return_value=None)

        with patch("services._period.crud.get_db", return_value=mock_db):
            with pytest.raises(ValidationError):
                await get_period("2099-99")  # Invalid month (99 > 12) → ValidationError


# ─────────────────────────────────────────────────────────────────────────────
class TestPeriodTransitions:
    """Test period state transitions (close, lock, reopen)."""

    @pytest.mark.asyncio
    async def test_close_period_updates_status(self):
        """close_period changes status to closed."""
        mock_db = MagicMock()
        mock_db.accounting_periods = MagicMock()

        open_period = {"period": "2024-05", "status": "open", "id": "period-001"}

        mock_db.accounting_periods.find_one = AsyncMock(return_value=open_period)
        mock_db.accounting_periods.update_one = AsyncMock(return_value=MagicMock(modified_count=1))

        user = {"id": "admin-001", "email": "admin@fnbgroup.id", "name": "Admin"}

        # close_period imports get_period from services._period.crud — patch at source
        with patch("services._period.transitions.get_db", return_value=mock_db):
            with patch("services._period.crud.get_db", return_value=mock_db):
                with patch("services._period.transitions.closing_checks",
                           new=AsyncMock(return_value={"summary": {"blockers": []}, "checks": []})):
                    with patch("services._period.transitions.generate_tax_settlement_je",
                               new=AsyncMock(return_value=None)):
                        # close_period signature: close_period(period, *, user: dict, reason=None)
                        result = await close_period("2024-05", user=user, reason="Month end")
                        mock_db.accounting_periods.update_one.assert_called()
                        call_args = mock_db.accounting_periods.update_one.call_args
                        assert call_args[0][1]["$set"]["status"] == "closed"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

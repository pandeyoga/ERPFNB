"""Period posting guards and utility helpers."""
from __future__ import annotations

from typing import Optional

from core.db import get_db
from core.exceptions import ValidationError
from services._period._common import _valid_period


async def is_period_locked(period: str) -> dict:
    """Return {locked, closed, status, lock_reason, locked_at, locked_by}."""
    db = get_db()
    p = await db.accounting_periods.find_one({"period": period})
    if not p:
        return {
            "period": period, "status": "open",
            "locked": False, "closed": False,
            "lock_reason": None, "locked_at": None, "locked_by": None,
        }
    status = p.get("status", "open")
    return {
        "period": period,
        "status": status,
        "locked": status == "locked",
        "closed": status == "closed",
        "lock_reason": p.get("lock_reason") or p.get("close_reason"),
        "locked_at": p.get("locked_at") or p.get("closed_at"),
        "locked_by": p.get("locked_by") or p.get("closed_by"),
    }


async def assert_period_unlocked(period: str, *, allow_closed: bool = False, action: str = "posting") -> None:
    """Raise ValidationError early if the target period is locked/closed."""
    if not _valid_period(period):
        return
    info = await is_period_locked(period)
    if info["locked"]:
        raise ValidationError(
            f"Period {period} sudah LOCKED — {action} ditolak. "
            + (f"Alasan: {info['lock_reason']}" if info.get("lock_reason") else "")
            + " Hubungi Finance Manager untuk reopen.",
            code="PERIOD_LOCKED",
        )
    if info["closed"] and not allow_closed:
        raise ValidationError(
            f"Period {period} sudah CLOSED — {action} ditolak. "
            + (f"Alasan: {info['lock_reason']}" if info.get("lock_reason") else "")
            + " Hubungi Finance Manager untuk reopen.",
            code="PERIOD_CLOSED",
        )


def derive_period_from_date(date_str: Optional[str]) -> Optional[str]:
    """Return YYYY-MM from a date-like string. None if invalid."""
    if not date_str:
        return None
    try:
        return str(date_str)[:7]
    except Exception:  # noqa: BLE001
        return None

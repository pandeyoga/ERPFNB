"""Shared helpers for period_service subpackage."""
import logging
from datetime import datetime, timezone

logger = logging.getLogger("aurora.period")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _valid_period(period: str) -> bool:
    try:
        y, m = period.split("-")
        return len(y) == 4 and 1 <= int(m) <= 12
    except Exception:  # noqa: BLE001
        return False

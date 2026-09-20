"""Executive Drilldown shared helpers."""
from datetime import datetime, timezone
from typing import Optional

from core.exceptions import ValidationError


def _today() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _period_to_range(period: str) -> tuple[str, str]:
    """Convert 'YYYY-MM' → (start_iso, next_start_iso)."""
    try:
        y, m = period.split("-")
        y_i, m_i = int(y), int(m)
    except Exception:  # noqa: BLE001
        raise ValidationError("period harus 'YYYY-MM'")
    start = f"{y_i:04d}-{m_i:02d}-01"
    if m_i == 12:
        next_y, next_m = y_i + 1, 1
    else:
        next_y, next_m = y_i, m_i + 1
    return start, f"{next_y:04d}-{next_m:02d}-01"


def _resolve_period(period: Optional[str]) -> str:
    if not period:
        return datetime.now(timezone.utc).strftime("%Y-%m")
    return period

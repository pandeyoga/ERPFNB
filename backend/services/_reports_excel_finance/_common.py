"""Shared helpers for reports_excel_finance sub-modules."""
from datetime import datetime, timezone

from core.exceptions import ValidationError


def _now():
    return datetime.now(timezone.utc).isoformat()


def _parse_date(s, *, fallback_today=False):
    if not s:
        return datetime.now(timezone.utc) if fallback_today else None
    try:
        return datetime.strptime(s, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except ValueError as e:
        raise ValidationError(f"Invalid date format: {s}") from e

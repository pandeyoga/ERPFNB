"""Common server-side validators (Phase 4-Hardening + Sprint A Security).

Tightens query/parameter validation to fail-fast at endpoint layer with consistent
ValidationError envelopes. Reusable across routers — call from inside endpoint
handlers, BEFORE invoking the service layer.

Conventions:
- Each validator returns the cleaned/parsed value
- Each validator raises ValidationError with a clear, user-facing message
- All validators are pure (no DB access) and synchronous
"""
import re
from datetime import datetime
from typing import Optional

from .exceptions import ValidationError

MAX_ID_LIST = 100  # max number of IDs accepted in csv-list query params
MAX_PAGE_SIZE = 200
DEFAULT_PAGE_SIZE = 20
MAX_PERIOD_RANGE_MONTHS = 24

# Password blacklist (umum + FnB Group-specific)
_PASSWORD_BLACKLIST = {
    "password", "password123", "admin123", "fnbgroup123", "12345678",
    "qwerty123", "123456789", "iloveyou", "aurora123", "fnb@2026",
}


def validate_password_strength(password: str, *, field: str = "password") -> str:
    """Validasi kekuatan password — A10 fix: SEC-006.

    Aturan:
    - Minimal 8 karakter
    - Minimal 1 huruf besar (A-Z)
    - Minimal 1 huruf kecil (a-z)
    - Minimal 1 angka (0-9)
    - Minimal 1 karakter spesial
    - Tidak boleh password umum (blacklist)

    Returns password yang sudah divalidasi.
    Raises ValidationError jika tidak memenuhi syarat.
    """
    if not password or len(password) < 8:
        raise ValidationError("Password minimal 8 karakter", field=field)
    if len(password) > 128:
        raise ValidationError("Password maksimal 128 karakter", field=field)
    if not re.search(r"[A-Z]", password):
        raise ValidationError("Password harus mengandung minimal 1 huruf besar (A-Z)", field=field)
    if not re.search(r"[a-z]", password):
        raise ValidationError("Password harus mengandung minimal 1 huruf kecil (a-z)", field=field)
    if not re.search(r"[0-9]", password):
        raise ValidationError("Password harus mengandung minimal 1 angka (0-9)", field=field)
    if not re.search(r"[!@#$%^&*()\-_=+\[\]{};:'\",.<>?/\\|`~]", password):
        raise ValidationError(
            "Password harus mengandung minimal 1 karakter spesial (!@#$%^&* dll)", field=field
        )
    if password.lower() in _PASSWORD_BLACKLIST:
        raise ValidationError("Password terlalu umum, gunakan kombinasi yang lebih unik", field=field)
    return password


def validate_period(value: Optional[str], *, field: str = "period", required: bool = False) -> Optional[str]:
    """Validate YYYY-MM string. Returns the cleaned value or None."""
    if value is None or value == "":
        if required:
            raise ValidationError(f"{field} is required (format: YYYY-MM)")
        return None
    if not isinstance(value, str) or len(value) != 7 or value[4] != "-":
        raise ValidationError(f"{field} must be in format YYYY-MM (got: {value!r})")
    try:
        y, m = int(value[:4]), int(value[5:])
        if not (1900 <= y <= 2100) or not (1 <= m <= 12):
            raise ValueError
    except ValueError as e:
        raise ValidationError(f"{field} must be a valid YYYY-MM (got: {value!r})") from e
    return value


def validate_iso_date(value: Optional[str], *, field: str = "date", required: bool = False) -> Optional[str]:
    """Validate YYYY-MM-DD string. Returns the cleaned value or None."""
    if value is None or value == "":
        if required:
            raise ValidationError(f"{field} is required (format: YYYY-MM-DD)")
        return None
    if not isinstance(value, str):
        raise ValidationError(f"{field} must be a string (got: {type(value).__name__})")
    try:
        datetime.strptime(value[:10], "%Y-%m-%d")
    except (ValueError, TypeError) as e:
        raise ValidationError(f"{field} must be in format YYYY-MM-DD (got: {value!r})") from e
    return value[:10]


def validate_date_range(
    period_from: Optional[str],
    period_to: Optional[str],
    *,
    iso_date: bool = True,
    field_from: str = "period_from",
    field_to: str = "period_to",
) -> tuple[Optional[str], Optional[str]]:
    """Validate that both dates parse and from <= to."""
    if iso_date:
        f = validate_iso_date(period_from, field=field_from)
        t = validate_iso_date(period_to, field=field_to)
    else:
        f = validate_period(period_from, field=field_from)
        t = validate_period(period_to, field=field_to)
    if f and t and f > t:
        raise ValidationError(f"{field_from} must be <= {field_to} (got: {f} > {t})")
    return f, t


def validate_id_list(
    csv: Optional[str], *, field: str = "ids", max_items: int = MAX_ID_LIST,
) -> Optional[list[str]]:
    """Parse 'a,b,c' into list, enforce max length, strip empties."""
    if not csv:
        return None
    items = [s.strip() for s in str(csv).split(",") if s.strip()]
    if not items:
        return None
    if len(items) > max_items:
        raise ValidationError(f"{field} accepts at most {max_items} items (got: {len(items)})")
    # Light id validation: alphanumeric + dash + underscore only (UUIDs / slugs)
    for it in items:
        if not all(ch.isalnum() or ch in "-_" for ch in it):
            raise ValidationError(f"{field} contains invalid id: {it!r}")
    return items


def validate_pagination(
    page: int = 1, per_page: int = DEFAULT_PAGE_SIZE, *, max_per_page: int = MAX_PAGE_SIZE,
) -> tuple[int, int]:
    """Clamp pagination into safe range."""
    if page < 1:
        page = 1
    if per_page < 1:
        per_page = 1
    if per_page > max_per_page:
        per_page = max_per_page
    return page, per_page

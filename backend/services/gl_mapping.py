"""GL Mapping resolver — logical account name → actual coa_id.
Mapping stored in `system_settings` doc with key='gl_mapping'.
Missing keys raise so the issue is loud-and-early at journal time.
"""
import logging
from typing import Optional

from core.db import get_db
from core.exceptions import AuroraException

logger = logging.getLogger("aurora.gl_mapping")

_cache: dict | None = None
_cache_at: float = 0.0
_CACHE_TTL_S = 30  # SSOT-14: other workers pick up mapping changes within 30s


async def get_mapping() -> dict:
    """Returns flat dict logical_name → coa_id (cached)."""
    global _cache, _cache_at
    import time as _t
    if _cache is not None and _t.monotonic() - _cache_at < _CACHE_TTL_S:
        return _cache
    db = get_db()
    s = await db.system_settings.find_one({"key": "gl_mapping"})
    if not s or not s.get("value"):
        raise AuroraException(
            "GL mapping belum dikonfigurasi. Jalankan seed atau setup di Admin > System Settings.",
            code="GL_MAPPING_MISSING", status_code=500,
        )
    _cache = s["value"]
    _cache_at = _t.monotonic()
    return _cache


async def resolve(logical: str, *, scope_outlet_id: Optional[str] = None) -> str:
    """Get coa_id for logical name. Supports per-outlet maps like inventory.{outlet_id}."""
    m = await get_mapping()
    # Check scoped first
    if scope_outlet_id:
        scoped = m.get(f"{logical}.{scope_outlet_id}")
        if scoped:
            return scoped
    # Check direct
    val = m.get(logical)
    if isinstance(val, dict) and scope_outlet_id:
        val = val.get(scope_outlet_id) or val.get("default")
    if not val:
        raise AuroraException(
            f"GL mapping untuk '{logical}' belum diset",
            code="GL_MAPPING_MISSING", status_code=500,
        )
    return val


async def resolve_or(logical: str, fallback: str, *, scope_outlet_id: Optional[str] = None) -> str:
    """Resolve `logical`; if unmapped, resolve `fallback` (still raises if both missing)."""
    m = await get_mapping()
    if m.get(logical) or (scope_outlet_id and m.get(f"{logical}.{scope_outlet_id}")):
        return await resolve(logical, scope_outlet_id=scope_outlet_id)
    return await resolve(fallback, scope_outlet_id=scope_outlet_id)


_PAYROLL_ACCOUNTS = [
    # (logical, code, name, type, normal_balance, parent_code)
    ("bpjs_payable", "2115", "Utang BPJS", "liability", "Cr", "2100"),
    ("bpjs_employer_expense", "5413", "Beban BPJS Perusahaan", "expense", "Dr", "5400"),
]


async def ensure_default_accounts() -> list[str]:
    """Idempotent migration: COA + gl_mapping for BPJS (P0-01) and AR (SSOT-14). Returns keys added."""
    import uuid
    from datetime import datetime, timezone
    db = get_db()
    s = await db.system_settings.find_one({"key": "gl_mapping"})
    if not s or not isinstance(s.get("value"), dict):
        return []
    mapping = dict(s["value"])
    added: list[str] = []
    now = datetime.now(timezone.utc).isoformat()
    for logical, code, name, typ, nb, parent_code in _PAYROLL_ACCOUNTS:
        if mapping.get(logical):
            continue
        coa = await db.chart_of_accounts.find_one({"code": code, "deleted_at": None})
        if not coa:
            parent = await db.chart_of_accounts.find_one({"code": parent_code, "deleted_at": None})
            coa = {"id": str(uuid.uuid4()), "code": code, "name": name, "type": typ, "normal_balance": nb,
                   "is_postable": True, "active": True, "parent_id": (parent or {}).get("id"), "level": 1,
                   "created_at": now, "updated_at": now, "deleted_at": None}
            await db.chart_of_accounts.insert_one(coa)
        mapping[logical] = coa["id"]
        added.append(logical)
    for logical, codes in (("ar_receivable", ("1201",)), ("ar_revenue", ("4101", "4000", "4001"))):
        if mapping.get(logical):
            continue
        for c in codes:
            coa = await db.chart_of_accounts.find_one({"code": c, "deleted_at": None})
            if coa:
                mapping[logical] = coa["id"]
                added.append(logical)
                break
    if added:
        await db.system_settings.update_one({"key": "gl_mapping"}, {"$set": {"value": mapping, "updated_at": now}})
        invalidate_cache()
    return added


def invalidate_cache():
    global _cache
    _cache = None

"""System settings CRUD operations."""
from __future__ import annotations

import logging
import os
import uuid
from typing import Optional

from core.db import get_db
from core.exceptions import ValidationError
from core.secrets import decrypt, encrypt, is_ciphertext
from services._system_settings.catalog import KNOWN_SETTINGS
from services._system_settings._helpers import COLLECTION, _now, _mask, _ensure_index, _meta_for, _is_secret_key

logger = logging.getLogger("aurora.system_settings")


async def get_value(key: str) -> Optional[str]:
    """Internal: get plain (decrypted) value. Never expose over HTTP without masking."""
    try:
        db = get_db()
        row = await db[COLLECTION].find_one({"key": key})
        if row and row.get("value") not in (None, ""):
            stored = str(row["value"])
            return decrypt(stored)
    except Exception:  # noqa: BLE001
        logger.exception("system_settings.get_value DB fetch failed")
    return os.environ.get(key) or None


async def list_settings(*, include_unset: bool = True) -> list[dict]:
    db = get_db()
    rows: dict[str, dict] = {}
    async for r in db[COLLECTION].find({}):
        rows[r["key"]] = r
    out = []
    for key, meta in KNOWN_SETTINGS.items():
        row = rows.get(key)
        env_value = os.environ.get(key)
        source: Optional[str] = None
        if row and row.get("value"):
            source = "database"
        elif env_value:
            source = "environment"
        stored = (row or {}).get("value") or env_value
        plain = decrypt(stored) if stored else None
        out.append({
            "key": key, "label": meta["label"], "description": meta["description"],
            "category": meta["category"], "is_secret": meta["is_secret"],
            "placeholder": meta["placeholder"], "is_set": bool(plain), "source": source,
            "value_masked": _mask(plain, is_secret=meta["is_secret"]) if plain else None,
            "updated_at": (row or {}).get("updated_at"),
            "updated_by": (row or {}).get("updated_by"),
            "updated_by_email": (row or {}).get("updated_by_email"),
        })
    for key, r in rows.items():
        if key in KNOWN_SETTINGS:
            continue
        if not r.get("updated_by_email"):
            continue
        plain = decrypt(r.get("value")) if r.get("value") else None
        out.append({
            "key": key, "label": key, "description": r.get("description") or "",
            "category": r.get("category") or "custom", "is_secret": bool(r.get("is_secret", False)),
            "placeholder": "", "is_set": bool(plain), "source": "database",
            "value_masked": _mask(plain, is_secret=bool(r.get("is_secret", False))),
            "updated_at": r.get("updated_at"), "updated_by": r.get("updated_by"),
            "updated_by_email": r.get("updated_by_email"),
        })
    return out


async def set_value(
    key: str, value: str, *, user: dict,
    description: str | None = None,
    is_secret: bool | None = None,
    category: str | None = None,
) -> dict:
    db = get_db()
    if not key or not key.strip():
        raise ValidationError("Key wajib", field="key")
    if value is None:
        raise ValidationError("Value wajib", field="value")
    await _ensure_index()
    meta = KNOWN_SETTINGS.get(key, {})
    secret = bool(meta.get("is_secret", False) if is_secret is None else is_secret)
    cat = category or meta.get("category", "custom")
    plain = str(value).strip()
    stored = encrypt(plain) if secret else plain
    rec = {
        "key": key, "value": stored, "is_secret": secret, "category": cat,
        "description": description or meta.get("description"),
        "updated_at": _now(), "updated_by": user.get("id") if user else None,
        "updated_by_email": user.get("email") if user else None,
    }
    await db[COLLECTION].update_one(
        {"key": key},
        {"$set": rec, "$setOnInsert": {"id": str(uuid.uuid4()), "created_at": _now()}},
        upsert=True,
    )
    await _audit(user, "set", key, {"is_secret": secret, "category": cat})
    try:
        from core import runtime_config
        runtime_config.invalidate(key)
    except Exception:  # noqa: BLE001
        pass
    return {"key": key, "is_set": True, "is_secret": secret, "category": cat,
            "value_masked": _mask(plain, is_secret=secret), "updated_at": rec["updated_at"], "source": "database"}


async def delete_value(key: str, *, user: dict) -> bool:
    db = get_db()
    res = await db[COLLECTION].delete_one({"key": key})
    if res.deleted_count > 0:
        await _audit(user, "delete", key, {})
        try:
            from core import runtime_config
            runtime_config.invalidate(key)
        except Exception:  # noqa: BLE001
            pass
        return True
    return False


async def _audit(user: dict | None, action: str, key: str, payload: dict) -> None:
    db = get_db()
    try:
        await db.audit_log.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": (user or {}).get("id"),
            "user_email": (user or {}).get("email"),
            "action": f"system_settings.{action}",
            "entity_type": "system_settings",
            "entity_id": key,
            "payload": payload,
            "timestamp": _now(),
        })
    except Exception:  # noqa: BLE001
        logger.exception("audit log insert failed")

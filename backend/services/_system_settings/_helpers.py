"""System settings helpers."""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

from core.db import get_db
from services._system_settings.catalog import KNOWN_SETTINGS

logger = logging.getLogger("aurora.system_settings")

COLLECTION = "system_settings"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _mask(value: str | None, *, is_secret: bool = True) -> Optional[str]:
    if value is None or value == "":
        return None
    if not is_secret:
        return value
    s = str(value)
    if len(s) <= 8:
        return "*" * len(s)
    return f"{s[:4]}\u2026{s[-4:]}"


async def _ensure_index() -> None:
    db = get_db()
    await db[COLLECTION].create_index("key", unique=True)


def _meta_for(key: str) -> dict:
    return KNOWN_SETTINGS.get(key, {})


def _is_secret_key(key: str) -> bool:
    return bool(_meta_for(key).get("is_secret", False))

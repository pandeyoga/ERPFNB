"""System settings migration: re-encrypt legacy plaintext secrets."""
from __future__ import annotations

import logging

from core.db import get_db
from core.secrets import encrypt, is_ciphertext
from services._system_settings._helpers import _meta_for, _now

logger = logging.getLogger("aurora.system_settings")


async def encrypt_legacy_plaintext_secrets() -> dict:
    """One-time migration: encrypt is_secret=True rows that are still plaintext. Idempotent."""
    db = get_db()
    encrypted_count = skipped_count = error_count = 0
    async for row in db.system_settings.find({}):
        key = row.get("key")
        meta = _meta_for(key)
        should_encrypt = bool(meta.get("is_secret", False) or row.get("is_secret"))
        value = row.get("value")
        if not should_encrypt or not value:
            skipped_count += 1
            continue
        if is_ciphertext(value):
            skipped_count += 1
            continue
        try:
            new_value = encrypt(str(value))
            if new_value == value:
                skipped_count += 1
                continue
            await db.system_settings.update_one(
                {"_id": row["_id"]},
                {"$set": {"value": new_value, "is_secret": True, "encrypted_at": _now()}},
            )
            encrypted_count += 1
        except Exception:  # noqa: BLE001
            logger.exception("migration encrypt failed for %s", key)
            error_count += 1
    if encrypted_count:
        logger.info("system_settings migration: encrypted=%d skipped=%d errors=%d", encrypted_count, skipped_count, error_count)
    return {"encrypted": encrypted_count, "skipped": skipped_count, "errors": error_count}

"""Phase 11A — Lightweight Mongo-backed TTL cache for heavy aggregation responses.

Usage:
    from services.cache_service import cache_get, cache_set, cache_or_compute

    @cache_or_compute("executive_overview", ttl_sec=60)
    async def heavy_aggregation(period: str, brand_id: str | None = None):
        ...

The cache is best-effort. Any failure (Mongo down, serialization issue) falls
back to the underlying compute. Keys are derived from a stable hash of the
function's positional + keyword arguments.
"""
from __future__ import annotations

import asyncio
import functools
import hashlib
import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Any, Callable

from core.db import get_db

logger = logging.getLogger("aurora.cache")

COLLECTION = "_cache_kv"  # underscore prefix = internal/system collection

_indexes_ensured = False


async def _ensure_indexes() -> None:
    global _indexes_ensured
    if _indexes_ensured:
        return
    try:
        db = get_db()
        # TTL index — Mongo auto-deletes when expires_at < now
        await db[COLLECTION].create_index("expires_at", expireAfterSeconds=0)
        await db[COLLECTION].create_index("key", unique=True)
        _indexes_ensured = True
    except Exception:  # noqa: BLE001
        logger.exception("cache_service_index_create_failed")


def _stable_key(prefix: str, args: tuple, kwargs: dict) -> str:
    """Deterministic key from prefix + args/kwargs."""
    payload = {
        "a": [str(a) for a in args],
        "k": {k: str(v) for k, v in sorted(kwargs.items())},
    }
    raw = json.dumps(payload, sort_keys=True, default=str)
    h = hashlib.md5(raw.encode()).hexdigest()[:16]  # noqa: S324 — non-secret
    return f"{prefix}:{h}"


async def cache_get(key: str) -> Any | None:
    try:
        await _ensure_indexes()
        db = get_db()
        doc = await db[COLLECTION].find_one({"key": key})
        if not doc:
            return None
        # Check manual expiration too in case TTL hasn't kicked in yet
        exp = doc.get("expires_at")
        if exp and isinstance(exp, datetime):
            # MongoDB may return tz-naive datetimes; normalize to UTC for safe comparison
            if exp.tzinfo is None:
                exp = exp.replace(tzinfo=timezone.utc)
            if exp < datetime.now(timezone.utc):
                return None
        return doc.get("value")
    except Exception:  # noqa: BLE001
        logger.exception("cache_get_failed")
        return None


async def cache_set(key: str, value: Any, ttl_sec: int = 60) -> bool:
    try:
        await _ensure_indexes()
        db = get_db()
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=ttl_sec)
        await db[COLLECTION].update_one(
            {"key": key},
            {"$set": {"key": key, "value": value, "expires_at": expires_at}},
            upsert=True,
        )
        return True
    except Exception:  # noqa: BLE001
        logger.exception("cache_set_failed")
        return False


async def cache_invalidate(prefix: str | None = None) -> int:
    """Drop cache entries matching prefix (or all if None). Returns deleted count."""
    try:
        await _ensure_indexes()
        db = get_db()
        if prefix:
            res = await db[COLLECTION].delete_many({"key": {"$regex": f"^{prefix}:"}})
        else:
            res = await db[COLLECTION].delete_many({})
        return res.deleted_count
    except Exception:  # noqa: BLE001
        logger.exception("cache_invalidate_failed")
        return 0


def cache_or_compute(prefix: str, ttl_sec: int = 60):
    """Decorator: caches an async function's return for ttl_sec."""
    def decorator(func: Callable):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            # Allow caller to bypass cache via kwarg force_refresh=True
            force = kwargs.pop("force_refresh", False)
            key = _stable_key(prefix, args, kwargs)
            if not force:
                cached = await cache_get(key)
                if cached is not None:
                    return cached
            result = await func(*args, **kwargs)
            # Fire-and-forget cache_set so we don't slow the response
            asyncio.create_task(cache_set(key, result, ttl_sec=ttl_sec))
            return result
        return wrapper
    return decorator

"""Phase 12C — Runtime configuration resolver.

Unified async helper that reads configuration values from (in order):
  1. `system_settings` collection in MongoDB (DB-driven, set via Admin UI)
  2. OS environment variables (legacy / .env-driven)
  3. Provided default value

Includes a small in-process invalidation cache (5s TTL) to avoid hammering
the DB for hot config keys (LLM key, API tokens). The cache is invalidated
when `system_settings_service.set_value` / `delete_value` is called.

Usage:
    from core.runtime_config import get_setting

    api_key = await get_setting("OPENAI_API_KEY", default="")
    if not api_key:
        return {"error": "not_configured"}

The DB read is best-effort. If MongoDB is unavailable, falls back to env.
"""
from __future__ import annotations

import logging
import os
import time
from typing import Optional

logger = logging.getLogger("aurora.runtime_config")

_CACHE_TTL_SEC = 5  # very short TTL — just to coalesce burst reads

# {key: (value, expires_at)}
_cache: dict[str, tuple[Optional[str], float]] = {}


def invalidate(key: str | None = None) -> None:
    """Invalidate the cache entry (or all if key is None)."""
    global _cache
    if key is None:
        _cache = {}
    else:
        _cache.pop(key, None)


async def get_setting(key: str, *, default: Optional[str] = None) -> Optional[str]:
    """Resolve a setting value. DB > env > default.

    Returns `None` (or default) if value is unset everywhere.
    """
    if not key:
        return default

    # Cache lookup
    now = time.monotonic()
    cached = _cache.get(key)
    if cached and cached[1] > now:
        v = cached[0]
        return v if (v is not None and v != "") else default

    # 1) DB lookup via system_settings_service
    db_val: Optional[str] = None
    try:
        # B2: lazy import di dalam fungsi — pattern yang benar untuk menghindari circular
        # (runtime_config ← system_settings_service ← db, dan keduanya tidak saling import di top-level)
        from services import system_settings_service  # local import to avoid cycle
        db_val = await system_settings_service.get_value(key)
    except Exception:  # noqa: BLE001
        logger.debug("runtime_config DB lookup failed for %s", key, exc_info=True)

    # 2) env var fallback (only if DB had no value at all — not just empty)
    if db_val is None or db_val == "":
        env_val = os.environ.get(key)
        resolved: Optional[str] = env_val if (env_val is not None and env_val != "") else None
    else:
        resolved = db_val

    _cache[key] = (resolved, now + _CACHE_TTL_SEC)
    return resolved if resolved is not None else default


async def get_settings_bulk(keys: list[str]) -> dict[str, Optional[str]]:
    """Convenience: resolve many settings in one go (still per-key cache hits)."""
    out: dict[str, Optional[str]] = {}
    for k in keys:
        out[k] = await get_setting(k)
    return out


async def get_int_setting(key: str, default: int = 0) -> int:
    raw = await get_setting(key)
    if raw is None or raw == "":
        return default
    try:
        return int(str(raw).strip())
    except (ValueError, TypeError):
        return default


async def get_bool_setting(key: str, default: bool = False) -> bool:
    raw = await get_setting(key)
    if raw is None or raw == "":
        return default
    return str(raw).strip().lower() in ("1", "true", "yes", "on")

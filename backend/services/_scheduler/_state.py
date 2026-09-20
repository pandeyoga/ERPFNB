"""Scheduler global state, registration, and run tracking."""
from __future__ import annotations

import asyncio
import functools
import logging
import uuid
from datetime import datetime
from typing import Callable, Optional

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

try:
    import pytz
    _TZ = pytz.timezone("Asia/Jakarta")
except Exception:  # noqa: BLE001
    _TZ = None

logger = logging.getLogger("aurora.scheduler")

_scheduler: Optional[AsyncIOScheduler] = None
_JOB_REGISTRY: dict[str, dict] = {}


def _now() -> str:
    return datetime.now().isoformat()


def _register(
    job_id: str, name: str, cron: str, func: Callable,
    *, description: str = "", enabled: bool = True,
) -> None:
    _JOB_REGISTRY[job_id] = {
        "id": job_id, "name": name, "cron": cron, "description": description,
        "func": func, "enabled": enabled,
    }


async def _record_run(
    job_id: str, *, status: str = "ok", detail: Optional[str] = None, duration_ms: Optional[int] = None
) -> None:
    """Persist run record. Best-effort."""
    try:
        from core.db import get_db
        db = get_db()
        await db.scheduler_runs.insert_one({
            "id": str(uuid.uuid4()),
            "job_id": job_id,
            "status": status,
            "detail": detail,
            "duration_ms": duration_ms,
            "ran_at": _now(),
        })
    except Exception:  # noqa: BLE001
        logger.warning("_record_run failed for %s", job_id)


def _wrap_job(job_id: str, func: Callable) -> Callable:
    """Wrap a job function with timing, logging, and run recording."""
    @functools.wraps(func)
    async def _inner():
        start = datetime.now()
        try:
            await func()
            elapsed = int((datetime.now() - start).total_seconds() * 1000)
            logger.info("job %s OK (%dms)", job_id, elapsed)
            await _record_run(job_id, status="ok", duration_ms=elapsed)
        except Exception as e:  # noqa: BLE001
            elapsed = int((datetime.now() - start).total_seconds() * 1000)
            logger.exception("job %s FAILED (%dms): %s", job_id, elapsed, e)
            await _record_run(job_id, status="error", detail=str(e), duration_ms=elapsed)
    return _inner

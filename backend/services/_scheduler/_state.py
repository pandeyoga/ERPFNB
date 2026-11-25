"""Scheduler global state, registration, and run tracking."""
from __future__ import annotations

import asyncio
import functools
import logging
import os
import socket
import uuid
from datetime import datetime, timezone
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


INSTANCE_ID = f"{socket.gethostname()}:{os.getpid()}:{uuid.uuid4().hex[:6]}"


async def _claim_tick(job_id: str) -> bool:
    """Satu tick cron dijalankan sekali walau backend berjalan di beberapa worker/instance: worker pertama yang
    menyisipkan `scheduler_locks[_id = job@menit]` menang, sisanya melewati tick itu. Semua job memakai cron (menit
    tepat) dan APScheduler melewati job yang telat > 1 dtk, jadi menit UTC saat mulai = menit jadwal.
    Bila DB bermasalah: tetap jalan (perilaku lama), job toh butuh DB."""
    from pymongo.errors import DuplicateKeyError
    now = datetime.now(timezone.utc)
    tick = now.replace(second=0, microsecond=0)
    try:
        from core.db import get_db
        await get_db().scheduler_locks.insert_one({"_id": f"{job_id}@{tick.strftime('%Y-%m-%dT%H:%MZ')}",
                                                   "job_id": job_id, "owner": INSTANCE_ID, "at": now})
        return True
    except DuplicateKeyError:
        return False
    except Exception:  # noqa: BLE001
        logger.warning("kunci tick %s gagal — job tetap dijalankan", job_id)
        return True


def _wrap_job(job_id: str, func: Callable, *, scheduled: bool = False) -> Callable:
    """Wrap a job function with timing, logging, and run recording. `scheduled`: dipanggil APScheduler (pakai kunci
    tick lintas worker); "Jalankan sekarang" dari admin tidak memakai kunci."""
    @functools.wraps(func)
    async def _inner():
        if scheduled and not await _claim_tick(job_id):
            logger.debug("job %s tick ini sudah dijalankan worker lain", job_id)
            return
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

"""Scheduler public API (start, shutdown, list, run_now, list_runs)."""
from __future__ import annotations

import logging
import uuid
from typing import Optional

from services._scheduler._state import _scheduler, _JOB_REGISTRY, _wrap_job, _TZ, _now
from services._scheduler.registry import _ensure_registered

logger = logging.getLogger("aurora.scheduler")


async def start_scheduler() -> None:
    global _scheduler
    from services._scheduler import _state
    if _state._scheduler and _state._scheduler.running:
        logger.info("Scheduler already running")
        return
    _ensure_registered()
    from apscheduler.schedulers.asyncio import AsyncIOScheduler
    from apscheduler.triggers.cron import CronTrigger
    _state._scheduler = AsyncIOScheduler(timezone=_TZ)
    for job_id, job in _state._JOB_REGISTRY.items():
        if not job.get("enabled", True):
            continue
        trigger = CronTrigger.from_crontab(job["cron"], timezone=_TZ)
        _state._scheduler.add_job(_wrap_job(job_id, job["func"]), trigger, id=job_id, name=job["name"], replace_existing=True)
    _state._scheduler.start()
    logger.info("Scheduler started with %d jobs", len(_state._JOB_REGISTRY))


async def shutdown_scheduler() -> None:
    from services._scheduler import _state
    if _state._scheduler and _state._scheduler.running:
        _state._scheduler.shutdown(wait=False)
        logger.info("Scheduler shut down")


def list_jobs() -> list[dict]:
    from services._scheduler import _state
    _ensure_registered()
    jobs_out = []
    for job_id, job in _state._JOB_REGISTRY.items():
        next_run = None
        if _state._scheduler and _state._scheduler.running:
            try:
                j = _state._scheduler.get_job(job_id)
                next_run = j.next_run_time.isoformat() if j and j.next_run_time else None
            except Exception:  # noqa: BLE001
                pass
        jobs_out.append({
            "id": job_id,
            "name": job["name"],
            "cron": job["cron"],
            "description": job.get("description", ""),
            "enabled": job.get("enabled", True),
            "next_run": next_run,
        })
    return jobs_out


async def run_job_now(job_id: str) -> dict:
    from services._scheduler import _state
    _ensure_registered()
    job = _state._JOB_REGISTRY.get(job_id)
    if not job:
        raise ValueError(f"Job '{job_id}' tidak ditemukan")
    import asyncio
    asyncio.create_task(_wrap_job(job_id, job["func"])())
    return {"job_id": job_id, "triggered": True}


async def list_runs(
    job_id: Optional[str] = None,
    page: int = 1,
    per_page: int = 20,
) -> dict:
    from core.db import get_db, serialize
    db = get_db()
    q: dict = {}
    if job_id:
        q["job_id"] = job_id
    skip = (page - 1) * per_page
    items = await db.scheduler_runs.find(q).sort("ran_at", -1).skip(skip).limit(per_page).to_list(per_page)
    total = await db.scheduler_runs.count_documents(q)
    return {
        "items": [serialize(d) for d in items],
        "page": page, "per_page": per_page, "total": total,
        "pages": max(1, (total + per_page - 1) // per_page),
    }

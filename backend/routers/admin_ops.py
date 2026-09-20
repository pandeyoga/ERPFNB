"""/api/admin/* operations endpoints (Phase 10): metrics, logs, scheduler, archival."""
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from core.exceptions import NotFoundError, ok_envelope
from core.security import require_perm
from services import archival_service, log_service, metrics_service, scheduler_service
from core.logging_config import get_db_sink

router = APIRouter(prefix="/api/admin", tags=["admin-ops"])


# ----- METRICS -----
@router.get("/metrics")
async def get_metrics(_: dict = Depends(require_perm("system.metrics.read"))):
    return ok_envelope(await metrics_service.collect_metrics())


# ----- LOGS -----
@router.get("/logs/recent")
async def get_logs(
    limit: int = Query(100, ge=1, le=500),
    level: Optional[str] = Query(None),
    request_id: Optional[str] = Query(None),
    route_contains: Optional[str] = Query(None),
    user_id: Optional[str] = Query(None),
    since_iso: Optional[str] = Query(None),
    page: Optional[int] = Query(None, ge=1, description="Enable pagination mode"),
    per_page: Optional[int] = Query(None, ge=1, le=500),
    _: dict = Depends(require_perm("system.logs.read")),
):
    """List logs. If `page` is set, response includes pagination metadata."""
    # Persist any buffered in-memory logs first so the viewer reflects current state.
    try:
        await get_db_sink().flush_to_db()
    except Exception:  # noqa: BLE001
        pass
    result = await log_service.list_recent(
        limit=limit, level=level, request_id=request_id,
        route_contains=route_contains, user_id=user_id, since_iso=since_iso,
        page=page, per_page=per_page,
    )
    if isinstance(result, dict):
        return ok_envelope(result)
    return ok_envelope({"items": result, "count": len(result)})


@router.get("/logs/stats")
async def get_log_stats(_: dict = Depends(require_perm("system.logs.read"))):
    return ok_envelope(await log_service.stats())


# ----- RATE LIMITER -----
@router.get("/rate-limits")
async def get_rate_limit_stats(_: dict = Depends(require_perm("system.metrics.read"))):
    from core.rate_limiter import limiter
    return ok_envelope({"buckets": limiter.buckets, "top_keys": limiter.stats()})


class RateLimitResetIn(BaseModel):
    bucket: Optional[str] = None
    key: Optional[str] = None


@router.post("/rate-limits/reset")
async def reset_rate_limits(payload: RateLimitResetIn, _: dict = Depends(require_perm("system.scheduler.manage"))):
    from core.rate_limiter import limiter
    cleared = await limiter.reset(payload.bucket, payload.key)
    return ok_envelope({"cleared": cleared})


# ----- SCHEDULER -----
@router.get("/scheduler/jobs")
async def get_jobs(_: dict = Depends(require_perm("system.scheduler.manage"))):
    return ok_envelope({"items": scheduler_service.list_jobs()})


@router.get("/scheduler/runs")
async def get_job_runs(
    job_id: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200, description="Legacy: maps to per_page if page not set"),
    page: Optional[int] = Query(None, ge=1, description="Enable pagination mode"),
    per_page: Optional[int] = Query(None, ge=1, le=200),
    _: dict = Depends(require_perm("system.scheduler.manage")),
):
    """List scheduler runs. If `page` is set, response includes pagination metadata.

    `limit` is a legacy query parameter — kept for backward compat with older callers.
    If `page` is not provided, we default to page=1 and use `limit` as per_page.
    """
    # Resolve effective pagination: page/per_page take precedence, fall back to legacy limit
    effective_page = page or 1
    effective_per_page = per_page if per_page is not None else limit
    result = await scheduler_service.list_runs(
        job_id=job_id, page=effective_page, per_page=effective_per_page,
    )
    if isinstance(result, dict):
        return ok_envelope(result)
    return ok_envelope({"items": result, "count": len(result)})


@router.post("/scheduler/jobs/{job_id}/run")
async def trigger_job(job_id: str, _: dict = Depends(require_perm("system.scheduler.manage"))):
    try:
        result = await scheduler_service.run_job_now(job_id)
        return ok_envelope(result)
    except ValueError as e:
        raise NotFoundError(str(e))


# ----- ARCHIVAL -----
@router.get("/archival/stats")
async def get_archival_stats(_: dict = Depends(require_perm("system.archival.manage"))):
    return ok_envelope(await archival_service.stats())


class ArchivalRunIn(BaseModel):
    dry_run: bool = False
    batch_size: int = Field(1000, ge=1, le=5000)
    retention_overrides: Optional[dict[str, int]] = None


@router.post("/archival/run")
async def run_archival(payload: ArchivalRunIn, _: dict = Depends(require_perm("system.archival.manage"))):
    return ok_envelope(
        await archival_service.run_archival(
            retention_overrides=payload.retention_overrides,
            batch_size=payload.batch_size,
            dry_run=payload.dry_run,
        )
    )

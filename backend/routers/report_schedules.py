"""Report Schedules router — Sprint E.

Endpoints:
  GET  /api/report-schedules/types         — list available report types
  GET  /api/report-schedules               — list schedules
  POST /api/report-schedules               — create schedule
  GET  /api/report-schedules/{id}          — get single
  PUT  /api/report-schedules/{id}          — update
  DELETE /api/report-schedules/{id}        — delete
  POST /api/report-schedules/{id}/run-now  — trigger immediate run
  POST /api/report-schedules/{id}/preview  — preview report payload (no send)
  GET  /api/report-schedules/runs          — run history
"""
from typing import Optional
from fastapi import APIRouter, Depends, Query

from core.exceptions import ok_envelope, AuroraException
from core.security import current_user, require_perm
from services import report_schedule_service as svc

router = APIRouter(prefix="/api/report-schedules", tags=["report-schedules"])


@router.get("/types")
async def list_report_types(user: dict = Depends(current_user)):
    return ok_envelope(svc.REPORT_TYPES)


@router.get("/runs")
async def list_runs(
    schedule_id: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_perm("report_schedules.manage")),
):
    runs = await svc.list_runs(schedule_id, limit)
    return ok_envelope(runs)


@router.get("")
async def list_schedules(
    user: dict = Depends(require_perm("report_schedules.manage")),
):
    items = await svc.list_schedules()
    return ok_envelope(items)


@router.post("")
async def create_schedule(
    payload: dict,
    user: dict = Depends(require_perm("report_schedules.manage")),
):
    if payload.get("report_type") not in svc.REPORT_TYPE_IDS:
        raise AuroraException(f"Valid types: {', '.join(svc.REPORT_TYPE_IDS)}", code='INVALID_REPORT_TYPE', field='report_type')
    item = await svc.create_schedule(payload, user["id"])
    return ok_envelope(item)


@router.get("/{schedule_id}")
async def get_schedule(
    schedule_id: str,
    user: dict = Depends(require_perm("report_schedules.manage")),
):
    item = await svc.get_schedule(schedule_id)
    if not item:
        raise AuroraException('Schedule not found', code='NOT_FOUND', field='schedule_id')
    return ok_envelope(item)


@router.put("/{schedule_id}")
async def update_schedule(
    schedule_id: str,
    payload: dict,
    user: dict = Depends(require_perm("report_schedules.manage")),
):
    item = await svc.update_schedule(schedule_id, payload)
    if not item:
        raise AuroraException('Schedule not found', code='NOT_FOUND', field='schedule_id')
    return ok_envelope(item)


@router.delete("/{schedule_id}")
async def delete_schedule(
    schedule_id: str,
    user: dict = Depends(require_perm("report_schedules.manage")),
):
    ok = await svc.delete_schedule(schedule_id)
    if not ok:
        raise AuroraException('Schedule not found', code='NOT_FOUND', field='schedule_id')
    return ok_envelope({"deleted": True})


@router.post("/{schedule_id}/run-now")
async def run_now(
    schedule_id: str,
    user: dict = Depends(require_perm("report_schedules.manage")),
):
    """Trigger a run immediately (ignores frequency/time check)."""
    sched = await svc.get_schedule(schedule_id)
    if not sched:
        raise AuroraException('Schedule not found', code='NOT_FOUND', field='schedule_id')
    log = await svc.dispatch_schedule(sched)
    return ok_envelope(log)


@router.post("/{schedule_id}/preview")
async def preview_report(
    schedule_id: str,
    user: dict = Depends(require_perm("report_schedules.manage")),
):
    """Return report payload without sending."""
    sched = await svc.get_schedule(schedule_id)
    if not sched:
        raise AuroraException('Schedule not found', code='NOT_FOUND', field='schedule_id')
    payload = await svc.build_payload(sched["report_type"])
    return ok_envelope(payload)

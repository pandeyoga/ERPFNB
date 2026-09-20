"""Tour Analytics Router.

Endpoints:
- POST /api/tour-analytics/events — submit tour interaction events (any authed user)
- GET  /api/tour-analytics/summary — aggregated stats (admin only)
- GET  /api/tour-analytics/tour/{tour_id} — per-tour detail (admin only)
"""
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from core.exceptions import ok_envelope
from core.security import current_user, require_any_perm
from services import tour_analytics_service


router = APIRouter(prefix="/api/tour-analytics", tags=["tour-analytics"])


# ============================================================
# Schemas
# ============================================================


class TourEventIn(BaseModel):
    type: str = Field(..., description="Event type (tour_started, tour_completed, etc.)")
    tour_id: str = Field(..., description="Tour identifier")
    tour_version: int = Field(default=1, ge=1)
    step_index: int | None = Field(default=None, ge=0)
    total_steps: int | None = Field(default=None, ge=1)
    duration_ms: int | None = Field(default=None, ge=0)
    path: str | None = None
    meta: dict | None = None
    client_ts: str | None = None


class TourEventsBatchIn(BaseModel):
    events: list[TourEventIn] = Field(default_factory=list, max_length=100)


# ============================================================
# Endpoints
# ============================================================


@router.post("/events")
async def submit_events(
    payload: TourEventsBatchIn,
    user: dict = Depends(current_user),
):
    """Submit batched tour analytics events from client.

    Any authenticated user can submit their own events (PII-free).
    Returns count of accepted events.
    """
    raw = [e.model_dump() for e in payload.events]
    accepted = await tour_analytics_service.record_events(
        user_id=user["id"],
        events=raw,
    )
    return ok_envelope({"accepted": accepted, "submitted": len(payload.events)})


@router.get("/summary")
async def get_summary(
    days: int = Query(30, ge=1, le=365),
    _user: dict = Depends(require_any_perm("admin.dashboard.view", "admin.view", "settings.manage", "audit.view")),
):
    """Aggregated summary of tour analytics across all tours (last N days)."""
    data = await tour_analytics_service.summary(days=days)
    return ok_envelope(data)


@router.get("/tour/{tour_id}")
async def get_tour_detail(
    tour_id: str,
    days: int = Query(30, ge=1, le=365),
    _user: dict = Depends(require_any_perm("admin.dashboard.view", "admin.view", "settings.manage", "audit.view")),
):
    """Detailed analytics for a single tour, including per-step drop-off."""
    data = await tour_analytics_service.detail(tour_id=tour_id, days=days)
    return ok_envelope(data)

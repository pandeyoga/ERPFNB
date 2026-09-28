"""Anomaly: list / detail / triage / summary."""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from core.db import get_db, serialize
from services.cache_service import cache_or_compute, cache_invalidate

from services._anomaly.helpers import _now_iso, ANOMALY_TYPE_LABELS, VALID_STATUSES

logger = logging.getLogger("aurora.anomaly")


async def list_events(
    *,
    type: Optional[str] = None,
    severity: Optional[str] = None,
    status: Optional[str] = None,
    outlet_id: Optional[str] = None,
    vendor_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    page: int = 1, per_page: int = 50,
) -> tuple[list[dict], dict]:
    db = get_db()
    q: dict = {"deleted_at": None}
    if type:
        q["type"] = type
    if severity:
        q["severity"] = severity
    if status:
        q["status"] = status
    if outlet_id:
        q["outlet_id"] = outlet_id
    if vendor_id:
        q["vendor_id"] = vendor_id
    if date_from:
        q.setdefault("scan_date", {})["$gte"] = date_from
    if date_to:
        q.setdefault("scan_date", {})["$lte"] = date_to

    skip = max(0, (page - 1) * per_page)
    cursor = db.anomaly_events.find(q).sort([("created_at", -1)]).skip(skip).limit(per_page)
    items = [serialize(d) async for d in cursor]
    total = await db.anomaly_events.count_documents(q)
    return items, {"page": page, "per_page": per_page, "total": total}


async def get_event(event_id: str) -> Optional[dict]:
    db = get_db()
    d = await db.anomaly_events.find_one({"id": event_id, "deleted_at": None})
    if not d:
        return None
    return serialize(d)


async def triage_event(
    event_id: str, *, new_status: str, note: Optional[str] = None,
    user: dict,
    assigned_to: Optional[str] = None,  # Phase 5C.3
) -> dict:
    if new_status not in VALID_STATUSES:
        from core.exceptions import ValidationError
        raise ValidationError(f"status tidak valid. Pilih: {', '.join(VALID_STATUSES)}")
    db = get_db()
    d = await db.anomaly_events.find_one({"id": event_id, "deleted_at": None})
    if not d:
        from core.exceptions import NotFoundError
        raise NotFoundError("Anomaly event")

    now = _now_iso()
    update: dict[str, Any] = {"status": new_status, "updated_at": now}
    
    # Phase 5C.3: Handle assignment
    if assigned_to is not None:
        update["assigned_to"] = assigned_to
        update["assigned_at"] = now
        update["assigned_by"] = user["id"]
    
    if new_status == "acknowledged":
        update.update({"acknowledged_by": user["id"], "acknowledged_at": now,
                       "acknowledged_note": note})
    elif new_status in ("resolved", "false_positive"):
        update.update({"resolved_by": user["id"], "resolved_at": now,
                       "resolution_note": note})
    elif new_status == "investigating":
        if not d.get("acknowledged_at"):
            update.update({"acknowledged_by": user["id"], "acknowledged_at": now,
                           "acknowledged_note": note})
    
    # Phase 5C.3: Append comment to timeline if note provided
    if note:
        comment = {
            "user_id": user["id"],
            "user_name": user.get("full_name", user.get("email", "Unknown")),
            "note": note,
            "timestamp": now,
            "action": new_status,
        }
        await db.anomaly_events.update_one(
            {"id": event_id},
            {"$push": {"comments": comment}}
        )

    await db.anomaly_events.update_one({"id": event_id}, {"$set": update})
    fresh = await db.anomaly_events.find_one({"id": event_id})
    # Invalidate cached summary
    try:
        await cache_invalidate("anomaly_summary")
    except Exception:  # noqa: BLE001
        pass
    return serialize(fresh)


@cache_or_compute("anomaly_summary", ttl_sec=60)
async def summary(days: int = 7) -> dict:
    """Executive dashboard overview — counts by type/severity for last N days."""
    db = get_db()
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    q = {"deleted_at": None, "created_at": {"$gte": cutoff}}

    counts = {"severe": 0, "mild": 0, "open": 0, "total": 0, "resolved": 0}
    by_type: dict[str, dict] = {}
    by_outlet: dict[str, dict] = {}
    recent: list[dict] = []

    outlets_map: dict[str, dict] = {}
    async for o in db.outlets.find({"deleted_at": None}):
        outlets_map[o["id"]] = {"name": o.get("name", o["id"]), "code": o.get("code", "")}

    async for d in db.anomaly_events.find(q).sort([("created_at", -1)]):
        sev = d.get("severity", "none")
        status = d.get("status", "open")
        counts["total"] += 1
        if sev == "severe":
            counts["severe"] += 1
        elif sev == "mild":
            counts["mild"] += 1
        if status in ("open", "acknowledged", "investigating"):
            counts["open"] += 1
        elif status in ("resolved", "false_positive"):
            counts["resolved"] += 1

        t = d.get("type", "other")
        bt = by_type.setdefault(t, {"type": t, "label": ANOMALY_TYPE_LABELS.get(t, t),
                                    "severe": 0, "mild": 0, "total": 0})
        bt["total"] += 1
        if sev == "severe":
            bt["severe"] += 1
        elif sev == "mild":
            bt["mild"] += 1

        oid = d.get("outlet_id")
        if oid:
            bo = by_outlet.setdefault(oid, {
                "outlet_id": oid,
                "outlet_name": outlets_map.get(oid, {}).get("name", oid),
                "outlet_code": outlets_map.get(oid, {}).get("code", ""),
                "severe": 0, "mild": 0, "total": 0,
            })
            bo["total"] += 1
            if sev == "severe":
                bo["severe"] += 1
            elif sev == "mild":
                bo["mild"] += 1

        if len(recent) < 10:
            recent.append({
                "id": d.get("id"),
                "type": t, "type_label": ANOMALY_TYPE_LABELS.get(t, t),
                "severity": sev, "status": status,
                "title": d.get("title"),
                "deviation_pct": d.get("deviation_pct"),
                "outlet_id": oid,
                "outlet_name": outlets_map.get(oid, {}).get("name") if oid else None,
                "created_at": d.get("created_at"),
                "link": f"/finance/anomalies?id={d.get('id')}",
            })

    # Last scan metadata
    last_scan_doc = await db.system_settings.find_one({"key": "last_anomaly_scan"})
    last_scan = None
    if last_scan_doc:
        last_scan = {
            "updated_at": last_scan_doc.get("updated_at"),
            "counts": last_scan_doc.get("counts", {}),
        }

    return {
        "days": days,
        "counts": counts,
        "by_type": list(by_type.values()),
        "by_outlet": sorted(by_outlet.values(), key=lambda x: x["total"], reverse=True)[:10],
        "recent": recent,
        "last_scan": last_scan,
    }


# Phase 5C.3: CSV Export
async def export_to_csv(
    *,
    type: Optional[str] = None,
    severity: Optional[str] = None,
    status: Optional[str] = None,
    outlet_id: Optional[str] = None,
    vendor_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
) -> list[dict]:
    """Export anomalies as CSV-ready list of dicts."""
    db = get_db()
    q: dict = {"deleted_at": None}
    if type:
        q["type"] = type
    if severity:
        q["severity"] = severity
    if status:
        q["status"] = status
    if outlet_id:
        q["outlet_id"] = outlet_id
    if vendor_id:
        q["vendor_id"] = vendor_id
    if date_from:
        q.setdefault("scan_date", {})["$gte"] = date_from
    if date_to:
        q.setdefault("scan_date", {})["$lte"] = date_to

    # Fetch outlet & vendor names for readable export
    outlets_map = {}
    async for o in db.outlets.find({"deleted_at": None}):
        outlets_map[o["id"]] = o.get("name", o["id"])
    
    vendors_map = {}
    async for v in db.vendors.find({"deleted_at": None}):
        vendors_map[v["id"]] = v.get("name", v["id"])

    cursor = db.anomaly_events.find(q).sort([("created_at", -1)]).limit(1000)  # Max 1000 rows
    rows = []
    async for d in cursor:
        rows.append({
            "ID": d.get("id", ""),
            "Type": ANOMALY_TYPE_LABELS.get(d.get("type"), d.get("type", "")),
            "Severity": d.get("severity", ""),
            "Status": d.get("status", ""),
            "Title": d.get("title", ""),
            "Message": d.get("message", ""),
            "Observed": d.get("observed_value", ""),
            "Baseline": d.get("baseline_value", ""),
            "Deviation %": d.get("deviation_pct", ""),
            "Z-Score": d.get("z_score", ""),
            "Outlet": outlets_map.get(d.get("outlet_id"), d.get("outlet_id", "")),
            "Vendor": vendors_map.get(d.get("vendor_id"), d.get("vendor_id", "")),
            "Period": d.get("period", ""),
            "Created At": d.get("created_at", ""),
            "Acknowledged At": d.get("acknowledged_at", ""),
            "Resolved At": d.get("resolved_at", ""),
            "Assigned To": d.get("assigned_to", ""),
        })
    return rows

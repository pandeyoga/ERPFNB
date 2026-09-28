"""Anomaly: storage (upsert_event) + notification dispatch."""
from __future__ import annotations

import logging
import uuid
from typing import Optional

from core.db import get_db, serialize
from services import notification_service

from services._anomaly.helpers import _now_iso, _today_iso, ANOMALY_TYPE_LABELS

logger = logging.getLogger("aurora.anomaly")


async def upsert_event(payload: dict, *, user_id: Optional[str] = None) -> dict:
    """Insert or update an anomaly_event row keyed by (type, source_type, source_id).

    If the same source is scanned again, row is UPDATED (not duplicated) so severity
    stays current. Status/resolution fields are preserved unless explicitly changed.
    """
    db = get_db()
    now = _now_iso()
    key = {
        "type": payload["type"],
        "source_type": payload["source_type"],
        "source_id": payload["source_id"],
        "deleted_at": None,
    }
    existing = await db.anomaly_events.find_one(key)
    if existing:
        update = {
            **{k: v for k, v in payload.items() if k not in (
                "id", "created_at", "status", "acknowledged_by", "acknowledged_at",
                "acknowledged_note", "resolved_by", "resolved_at", "resolution_note",
            )},
            "updated_at": now,
        }
        await db.anomaly_events.update_one({"id": existing["id"]}, {"$set": update})
        fresh = await db.anomaly_events.find_one({"id": existing["id"]})
        return serialize(fresh)

    doc = {
        "id": str(uuid.uuid4()),
        "status": payload.get("status", "open"),
        "scan_date": payload.get("scan_date", _today_iso()),
        "acknowledged_by": None, "acknowledged_at": None, "acknowledged_note": None,
        "resolved_by": None, "resolved_at": None, "resolution_note": None,
        "created_at": now, "updated_at": now, "deleted_at": None,
        "created_by": user_id,
        **payload,
    }
    await db.anomaly_events.insert_one(doc)
    return serialize(doc)


# ============================================================
# NOTIFICATION DISPATCH
# ============================================================


RECIPIENT_PERMS = {
    "sales_deviation": ["finance.sales.validate", "executive.dashboard.read"],
    "vendor_price_spike": ["procurement.po.approve", "procurement.pr.approve"],
    "vendor_leadtime": ["procurement.po.approve", "procurement.pr.approve"],
    "ap_cash_spike": ["finance.payment.approve", "finance.report.cashflow"],
}


async def _users_with_any_perm(perms: list[str]) -> list[dict]:
    """Find active users whose role permissions include any of `perms` OR '*'."""
    db = get_db()
    role_ids: set[str] = set()
    async for r in db.roles.find({"deleted_at": None, "permissions": {"$in": perms + ["*"]}}):
        role_ids.add(r["id"])
    if not role_ids:
        return []
    users: list[dict] = []
    async for u in db.users.find({
        "deleted_at": None, "status": "active", "role_ids": {"$in": list(role_ids)},
    }):
        users.append(u)
    return users


async def dispatch_event_notification(event: dict) -> int:
    """Create notifications for all relevant recipients."""
    if event.get("severity") == "none":
        return 0
    etype = event.get("type")
    perms = RECIPIENT_PERMS.get(etype, ["*"])
    recipients = await _users_with_any_perm(perms)
    count = 0
    link = f"/finance/anomalies?id={event['id']}"
    title = event.get("title") or ANOMALY_TYPE_LABELS.get(etype, "Anomaly")
    body = event.get("message", "")
    ntype = "urgent" if event.get("severity") == "severe" else "warn"
    for u in recipients:
        # Respect outlet scope for sales anomalies — only notify users who have access
        # to the outlet (or super users with no scope restriction).
        if etype == "sales_deviation" and event.get("outlet_id"):
            if u.get("outlet_ids") and event["outlet_id"] not in u.get("outlet_ids", []):
                # Check if user is super (role has '*')
                is_super_user = await _is_super(u)
                if not is_super_user:
                    continue
        try:
            await notification_service.push(
                user_id=u["id"], type=ntype, title=title, body=body,
                link=link, source_type="anomaly_event", source_id=event["id"],
            )
            count += 1
        except Exception as e:  # noqa: BLE001
            logger.warning("Notif dispatch failed for user %s: %s", u["id"], e)
    return count


async def _is_super(user: dict) -> bool:
    db = get_db()
    role_ids = user.get("role_ids") or []
    if not role_ids:
        return False
    async for r in db.roles.find({"id": {"$in": role_ids}}):
        if "*" in (r.get("permissions") or []):
            return True
    return False

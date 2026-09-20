"""Anomaly: batch scan entrypoints (daily/weekly cron)."""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from core.db import get_db

from services._anomaly.helpers import (
    _now_iso,
    _today_iso,
    _format_rp,
    resolve_thresholds,
)
from services._anomaly.detectors import (
    detect_ap_cash_spike,
)
from services._anomaly.live import check_sales_live, check_gr_live
from services._anomaly.storage_notif import upsert_event, dispatch_event_notification

logger = logging.getLogger("aurora.anomaly")


async def scan_sales(as_of_date: Optional[str] = None, *, days: int = 1,
                     user_id: Optional[str] = None) -> list[dict]:
    """Batch scan daily_sales validated in the last N days for anomalies.
    Idempotent — re-running updates existing events.
    """
    as_of_date = as_of_date or _today_iso()
    end = datetime.strptime(as_of_date, "%Y-%m-%d").date()
    start = (end - timedelta(days=days)).isoformat()

    db = get_db()
    events: list[dict] = []
    async for ds in db.daily_sales.find({
        "deleted_at": None, "status": "validated",
        "sales_date": {"$gte": start, "$lte": as_of_date},
    }):
        ev = await check_sales_live(ds, user_id=user_id)
        if ev:
            events.append(ev)
    return events


async def scan_vendors(as_of_date: Optional[str] = None, *, days: int = 1,
                       user_id: Optional[str] = None) -> list[dict]:
    """Batch scan GRs posted in the last N days for price spikes + lead-time anomalies."""
    as_of_date = as_of_date or _today_iso()
    end = datetime.strptime(as_of_date, "%Y-%m-%d").date()
    start = (end - timedelta(days=days)).isoformat()

    db = get_db()
    events: list[dict] = []
    async for gr in db.goods_receipts.find({
        "deleted_at": None, "status": "posted",
        "receive_date": {"$gte": start, "$lte": as_of_date},
    }):
        ev_list = await check_gr_live(gr, user_id=user_id)
        events.extend(ev_list)
    return events


async def scan_ap_cash(*, period: Optional[str] = None,
                       user_id: Optional[str] = None) -> list[dict]:
    """Scan AP/cash outflow spike for current month per-outlet + consolidated."""
    period = period or datetime.now(timezone.utc).strftime("%Y-%m")
    db = get_db()
    events: list[dict] = []

    async def _scan_scope(outlet_id: Optional[str], brand_id: Optional[str],
                         label: str, src_id: str):
        thresholds = await resolve_thresholds(
            outlet_id=outlet_id, brand_id=brand_id, on_date=period + "-01",
        )
        d = await detect_ap_cash_spike(
            outlet_id=outlet_id, brand_id=brand_id, period=period,
            thresholds=thresholds["ap_cash_spike"],
        )
        if d.get("severity", "none") == "none":
            return
        title = f"Kas/AP {label} — proyeksi +{d.get('deviation_pct', 0):.1f}% vs baseline"
        message = (
            f"Proyeksi bulan {period}: {_format_rp(d.get('observed', 0))} — "
            f"MTD: {_format_rp(d.get('mtd', 0))}, baseline 3-bulan: {_format_rp(d.get('baseline_mean', 0))}."
        )
        event = await upsert_event({
            "type": "ap_cash_spike", "severity": d["severity"],
            "source_type": "period_scan", "source_id": src_id,
            "outlet_id": outlet_id, "brand_id": brand_id,
            "observed_value": d.get("observed"),
            "baseline_value": d.get("baseline_mean"),
            "deviation_pct": d.get("deviation_pct"),
            "period": period, "scan_date": _today_iso(),
            "threshold_snapshot": thresholds.get("ap_cash_spike"),
            "title": title, "message": message,
            "context": {"scope_label": label, "mtd": d.get("mtd"),
                        "baseline_count": d.get("baseline_count")},
        }, user_id=user_id)
        await dispatch_event_notification(event)
        events.append(event)

    # Consolidated + per outlet
    await _scan_scope(None, None, "Konsolidasi", f"consolidated::{period}")
    async for o in db.outlets.find({"deleted_at": None}):
        await _scan_scope(o["id"], None, o.get("name", o["id"]), f"outlet::{o['id']}::{period}")

    return events


async def scan_all(as_of_date: Optional[str] = None, *, days: int = 7,
                   period: Optional[str] = None,
                   user_id: Optional[str] = None) -> dict:
    """Orchestrate full scan. Returns counts by type."""
    as_of_date = as_of_date or _today_iso()
    period = period or as_of_date[:7]

    sales_events = await scan_sales(as_of_date, days=days, user_id=user_id)
    vendor_events = await scan_vendors(as_of_date, days=days, user_id=user_id)
    ap_events = await scan_ap_cash(period=period, user_id=user_id)

    # Record last scan timestamp
    db = get_db()
    await db.system_settings.update_one(
        {"key": "last_anomaly_scan"},
        {"$set": {
            "key": "last_anomaly_scan",
            "value": _now_iso(),
            "counts": {
                "sales_deviation": len(sales_events),
                "vendor": len(vendor_events),
                "ap_cash_spike": len(ap_events),
            },
            "updated_at": _now_iso(),
        }},
        upsert=True,
    )

    return {
        "as_of_date": as_of_date,
        "period": period,
        "counts": {
            "sales_deviation": len(sales_events),
            "vendor": len(vendor_events),
            "ap_cash_spike": len(ap_events),
            "total": len(sales_events) + len(vendor_events) + len(ap_events),
        },
        "events": {
            "sales": sales_events,
            "vendor": vendor_events,
            "ap_cash": ap_events,
        },
    }

"""Anomaly: live hooks called from sales/inventory/payment services."""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Optional

from core.db import get_db

from services._anomaly.helpers import (
    _today_iso,
    _format_rp,
    resolve_thresholds,
)
from services._anomaly.detectors import (
    detect_sales_deviation,
    detect_vendor_price_spike,
    detect_vendor_leadtime,
)
from services._anomaly.storage_notif import upsert_event, dispatch_event_notification

logger = logging.getLogger("aurora.anomaly")


async def check_sales_live(daily_sales_doc: dict, *, user_id: Optional[str] = None) -> Optional[dict]:
    """Called after a daily_sales is validated. Creates anomaly_event + notification
    if severity ≥ mild. Exception-safe (logs + returns None on failure).
    """
    try:
        outlet_id = daily_sales_doc.get("outlet_id")
        brand_id = daily_sales_doc.get("brand_id")
        sales_date = daily_sales_doc.get("sales_date")
        amount = float(daily_sales_doc.get("grand_total", 0) or 0)
        if not outlet_id or not sales_date:
            return None

        thresholds = await resolve_thresholds(outlet_id=outlet_id, brand_id=brand_id, on_date=sales_date)
        d = await detect_sales_deviation(
            outlet_id=outlet_id, sales_date=sales_date, amount=amount,
            thresholds=thresholds["sales_deviation"],
        )
        if d.get("severity", "none") == "none":
            return None

        # Resolve outlet/brand labels
        db = get_db()
        outlet = await db.outlets.find_one({"id": outlet_id}) or {}
        title = f"{outlet.get('name', 'Outlet')} — Sales {'naik' if d.get('deviation_pct', 0) > 0 else 'turun'} {abs(d.get('deviation_pct', 0)):.1f}%"
        direction = "naik" if d.get("deviation_pct", 0) > 0 else "turun"
        message = (
            f"Sales tervalidasi {sales_date} = {_format_rp(amount)}. "
            f"Baseline 14-hari: {_format_rp(d.get('baseline_mean', 0))} "
            f"(σ={_format_rp(d.get('baseline_stddev', 0))}, n={d.get('baseline_count', 0)}). "
            f"Z-score: {d.get('z_score', 0):.2f} — {direction} {abs(d.get('deviation_pct', 0)):.1f}% dari rata-rata."
        )
        event = await upsert_event({
            "type": "sales_deviation",
            "severity": d["severity"],
            "source_type": "daily_sales",
            "source_id": daily_sales_doc.get("id"),
            "source_doc_no": daily_sales_doc.get("doc_no") or sales_date,
            "outlet_id": outlet_id, "brand_id": brand_id,
            "observed_value": amount,
            "baseline_value": d.get("baseline_mean"),
            "baseline_stddev": d.get("baseline_stddev"),
            "baseline_count": d.get("baseline_count"),
            "deviation_pct": d.get("deviation_pct"),
            "z_score": d.get("z_score"),
            "period": sales_date[:7],
            "scan_date": _today_iso(),
            "threshold_snapshot": thresholds.get("sales_deviation"),
            "title": title, "message": message,
            "context": {
                "window_days": d.get("window_days"),
                "rule_id": thresholds.get("_rule_id"),
                "rule_scope_type": thresholds.get("_rule_scope_type"),
                "rule_scope_id": thresholds.get("_rule_scope_id"),
            },
        }, user_id=user_id)
        await dispatch_event_notification(event)
        return event
    except Exception as e:  # noqa: BLE001
        logger.exception("check_sales_live failed: %s", e)
        return None


async def check_gr_live(gr_doc: dict, *, user_id: Optional[str] = None) -> list[dict]:
    """Called after a GR is posted. Runs vendor_price_spike for every line +
    vendor_leadtime once per GR. Returns created anomaly events.
    """
    results: list[dict] = []
    try:
        vendor_id = gr_doc.get("vendor_id")
        receive_date = gr_doc.get("receive_date")
        gr_id = gr_doc.get("id")
        if not vendor_id or not receive_date:
            return results

        thresholds = await resolve_thresholds(
            outlet_id=gr_doc.get("outlet_id"), brand_id=None, on_date=receive_date,
        )

        # Price spike per line
        db = get_db()
        vendor = await db.vendors.find_one({"id": vendor_id}) or {}
        for idx, ln in enumerate(gr_doc.get("lines", [])):
            item_id = ln.get("item_id")
            unit_cost = float(ln.get("unit_cost", 0) or 0)
            if not item_id or unit_cost <= 0:
                continue
            d = await detect_vendor_price_spike(
                vendor_id=vendor_id, item_id=item_id, unit_cost=unit_cost,
                as_of_date=receive_date,
                thresholds=thresholds["vendor_price_spike"],
            )
            if d.get("severity", "none") == "none":
                continue
            title = f"Harga vendor {vendor.get('name', vendor_id)}: {ln.get('item_name', item_id)} +{d.get('deviation_pct', 0):.1f}%"
            message = (
                f"Unit cost {_format_rp(unit_cost)} — "
                f"baseline 90 hari: {_format_rp(d.get('baseline_mean', 0))} "
                f"(n={d.get('baseline_count', 0)})."
            )
            event = await upsert_event({
                "type": "vendor_price_spike",
                "severity": d["severity"],
                "source_type": "goods_receipt_line",
                "source_id": f"{gr_id}::{idx}",
                "source_doc_no": gr_doc.get("doc_no"),
                "vendor_id": vendor_id, "item_id": item_id,
                "outlet_id": gr_doc.get("outlet_id"),
                "observed_value": unit_cost,
                "baseline_value": d.get("baseline_mean"),
                "baseline_count": d.get("baseline_count"),
                "deviation_pct": d.get("deviation_pct"),
                "period": receive_date[:7],
                "scan_date": _today_iso(),
                "threshold_snapshot": thresholds.get("vendor_price_spike"),
                "title": title, "message": message,
                "context": {"item_name": ln.get("item_name"),
                           "vendor_name": vendor.get("name"),
                           "window_days": d.get("window_days")},
            }, user_id=user_id)
            await dispatch_event_notification(event)
            results.append(event)

        # Lead time (once per GR)
        po_id = gr_doc.get("po_id")
        if po_id:
            po = await db.purchase_orders.find_one({"id": po_id}) or {}
            order_date = po.get("order_date") or (po.get("sent_at") or "")[:10]
            if order_date:
                try:
                    od = datetime.strptime(order_date[:10], "%Y-%m-%d").date()
                    rd = datetime.strptime(receive_date, "%Y-%m-%d").date()
                    actual_days = (rd - od).days
                    d = await detect_vendor_leadtime(
                        vendor_id=vendor_id, actual_days=float(actual_days),
                        as_of_date=receive_date,
                        thresholds=thresholds["vendor_leadtime"],
                    )
                    if d.get("severity", "none") != "none":
                        title = f"Lead time {vendor.get('name', vendor_id)}: +{d.get('excess_days', 0):.1f} hari"
                        message = (
                            f"Aktual {actual_days} hari vs baseline {d.get('baseline_mean', 0):.1f} hari "
                            f"(n={d.get('baseline_count', 0)}). Terlambat {d.get('excess_days', 0):.1f} hari."
                        )
                        event = await upsert_event({
                            "type": "vendor_leadtime", "severity": d["severity"],
                            "source_type": "goods_receipt", "source_id": gr_id,
                            "source_doc_no": gr_doc.get("doc_no"),
                            "vendor_id": vendor_id,
                            "outlet_id": gr_doc.get("outlet_id"),
                            "observed_value": actual_days,
                            "baseline_value": d.get("baseline_mean"),
                            "baseline_count": d.get("baseline_count"),
                            "excess_days": d.get("excess_days"),
                            "period": receive_date[:7], "scan_date": _today_iso(),
                            "threshold_snapshot": thresholds.get("vendor_leadtime"),
                            "title": title, "message": message,
                            "context": {"po_id": po_id, "po_doc_no": po.get("doc_no"),
                                        "order_date": order_date,
                                        "vendor_name": vendor.get("name"),
                                        "window_days": d.get("window_days")},
                        }, user_id=user_id)
                        await dispatch_event_notification(event)
                        results.append(event)
                except Exception as e:  # noqa: BLE001
                    logger.warning("Leadtime calc failed: %s", e)
    except Exception as e:  # noqa: BLE001
        logger.exception("check_gr_live failed: %s", e)
    return results

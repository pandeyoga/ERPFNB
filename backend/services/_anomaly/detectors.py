"""Anomaly: core detectors (sales_deviation, vendor_price, vendor_leadtime, ap_cash)."""
from __future__ import annotations

import logging
import statistics
from datetime import datetime, timedelta, timezone
from typing import Optional

from core.db import get_db

from services._anomaly.helpers import (
    DEFAULT_THRESHOLDS,
    _classify_sigma,
    _classify_pct,
    _classify_excess_days,
    _rolling_stats,
)

logger = logging.getLogger("aurora.anomaly")


async def detect_sales_deviation(
    *, outlet_id: str, sales_date: str, amount: float,
    thresholds: Optional[dict] = None,
) -> dict:
    """Compare `amount` to rolling window mean/stddev of validated sales."""
    th = (thresholds or DEFAULT_THRESHOLDS["sales_deviation"])
    if not th.get("enabled", True):
        return {"severity": "none", "reason": "disabled"}

    window_days = int(th.get("window_days", 14))
    min_points = int(th.get("min_points", 7))
    mild = float(th.get("sigma_mild", 1.5))
    severe = float(th.get("sigma_severe", 2.5))

    db = get_db()
    date_obj = datetime.strptime(sales_date, "%Y-%m-%d").date()
    start = (date_obj - timedelta(days=window_days)).isoformat()
    end = (date_obj - timedelta(days=1)).isoformat()

    cursor = db.daily_sales.find({
        "deleted_at": None, "status": "validated", "outlet_id": outlet_id,
        "sales_date": {"$gte": start, "$lte": end},
    })
    hist: list[float] = []
    async for d in cursor:
        hist.append(float(d.get("grand_total", 0) or 0))

    stats = _rolling_stats(hist)
    if stats["count"] < min_points or stats["stddev"] <= 0:
        return {
            "severity": "none", "reason": "insufficient_data",
            "baseline_count": stats["count"], "observed": amount,
            "baseline_mean": round(stats["mean"], 2),
        }

    z = (amount - stats["mean"]) / stats["stddev"]
    sev = _classify_sigma(z, mild, severe)
    dev_pct = (amount - stats["mean"]) / stats["mean"] * 100 if stats["mean"] > 0 else 0.0
    return {
        "severity": sev,
        "z_score": round(z, 3),
        "deviation_pct": round(dev_pct, 2),
        "observed": round(amount, 2),
        "baseline_mean": round(stats["mean"], 2),
        "baseline_stddev": round(stats["stddev"], 2),
        "baseline_count": stats["count"],
        "window_days": window_days,
    }


async def detect_vendor_price_spike(
    *, vendor_id: str, item_id: str, unit_cost: float, as_of_date: str,
    thresholds: Optional[dict] = None,
) -> dict:
    th = (thresholds or DEFAULT_THRESHOLDS["vendor_price_spike"])
    if not th.get("enabled", True):
        return {"severity": "none", "reason": "disabled"}

    window_days = int(th.get("window_days", 90))
    pct_mild = float(th.get("pct_mild", 15))
    pct_severe = float(th.get("pct_severe", 30))

    db = get_db()
    date_obj = datetime.strptime(as_of_date, "%Y-%m-%d").date()
    start = (date_obj - timedelta(days=window_days)).isoformat()
    end = (date_obj - timedelta(days=1)).isoformat()

    prices: list[float] = []
    cursor = db.goods_receipts.find({
        "deleted_at": None, "vendor_id": vendor_id,
        "receive_date": {"$gte": start, "$lte": end},
    })
    async for gr in cursor:
        for ln in gr.get("lines", []):
            if ln.get("item_id") == item_id:
                uc = float(ln.get("unit_cost", 0) or 0)
                if uc > 0:
                    prices.append(uc)

    if not prices:
        return {"severity": "none", "reason": "no_history", "observed": unit_cost}
    avg = statistics.mean(prices)
    if avg <= 0:
        return {"severity": "none", "reason": "zero_baseline", "observed": unit_cost}

    pct = (unit_cost - avg) / avg * 100
    sev = _classify_pct(pct, pct_mild, pct_severe)
    # Only flag spikes UPWARD by default (cost shouldn't trigger for drops)
    if sev != "none" and pct < 0:
        sev = "none"
    return {
        "severity": sev, "deviation_pct": round(pct, 2),
        "observed": round(unit_cost, 2), "baseline_mean": round(avg, 2),
        "baseline_count": len(prices), "window_days": window_days,
    }


async def detect_vendor_leadtime(
    *, vendor_id: str, actual_days: float, as_of_date: str,
    thresholds: Optional[dict] = None,
) -> dict:
    th = (thresholds or DEFAULT_THRESHOLDS["vendor_leadtime"])
    if not th.get("enabled", True):
        return {"severity": "none", "reason": "disabled"}

    window_days = int(th.get("window_days", 90))
    days_mild = float(th.get("days_mild", 3))
    days_severe = float(th.get("days_severe", 7))

    db = get_db()
    date_obj = datetime.strptime(as_of_date, "%Y-%m-%d").date()
    start = (date_obj - timedelta(days=window_days)).isoformat()
    end = (date_obj - timedelta(days=1)).isoformat()

    # B10 fix: batch-load purchase_orders by po_id (was N+1 find_one in async-for cursor)
    gr_list = await db.goods_receipts.find({
        "deleted_at": None, "vendor_id": vendor_id,
        "receive_date": {"$gte": start, "$lte": end},
    }, {"po_id": 1, "receive_date": 1}).to_list(500)
    po_ids = list({gr["po_id"] for gr in gr_list if gr.get("po_id")})
    pos_raw = await db.purchase_orders.find(
        {"id": {"$in": po_ids}},
        {"id": 1, "order_date": 1, "sent_at": 1, "_id": 0}
    ).to_list(len(po_ids) + 1) if po_ids else []
    po_map = {p["id"]: p for p in pos_raw}

    baselines: list[float] = []
    for gr in gr_list:
        po_id = gr.get("po_id")
        if not po_id:
            continue
        po = po_map.get(po_id)
        if not po:
            continue
        order_date = po.get("order_date") or (po.get("sent_at") or "")[:10]
        if not order_date:
            continue
        try:
            od = datetime.strptime(order_date[:10], "%Y-%m-%d").date()
            rd = datetime.strptime(gr["receive_date"], "%Y-%m-%d").date()
            baselines.append((rd - od).days)
        except Exception:  # noqa: BLE001
            continue

    if not baselines:
        return {"severity": "none", "reason": "no_history", "observed": actual_days}
    avg = statistics.mean(baselines)
    excess = actual_days - avg
    sev = _classify_excess_days(excess, days_mild, days_severe)
    return {
        "severity": sev, "excess_days": round(excess, 2),
        "observed": round(actual_days, 2), "baseline_mean": round(avg, 2),
        "baseline_count": len(baselines), "window_days": window_days,
    }


async def detect_ap_cash_spike(
    *, outlet_id: Optional[str] = None, brand_id: Optional[str] = None,
    period: Optional[str] = None, thresholds: Optional[dict] = None,
) -> dict:
    """AP/cash outflow spike vs forecast. Reuses forecast_guard_service math.

    Compares month-to-date cash outflow (Cr on cash/bank COA accounts) vs a forecast
    value derived from last-3-months average of the same metric.
    """
    th = (thresholds or DEFAULT_THRESHOLDS["ap_cash_spike"])
    if not th.get("enabled", True):
        return {"severity": "none", "reason": "disabled"}
    pct_mild = float(th.get("pct_mild", 15))
    pct_severe = float(th.get("pct_severe", 30))

    db = get_db()
    now = datetime.now(timezone.utc).date()
    period = period or now.strftime("%Y-%m")
    try:
        y, m = [int(x) for x in period.split("-")]
    except Exception:  # noqa: BLE001
        return {"severity": "none", "reason": "bad_period"}

    start = f"{y:04d}-{m:02d}-01"
    cap = now.isoformat()

    # Resolve bank/cash COA ids
    cash_ids: list[str] = []
    async for c in db.chart_of_accounts.find(
        {"deleted_at": None, "is_postable": True,
         "$or": [
             {"type": "asset"},
         ]},
    ):
        name = (c.get("name") or "").lower() + " " + (c.get("name_id") or "").lower()
        if any(tok in name for tok in ("cash", "kas", "bank")):
            cash_ids.append(c["id"])
    if not cash_ids:
        return {"severity": "none", "reason": "no_cash_accounts"}

    # Sum MTD cash outflow (Cr on cash accounts)
    mtd_outflow = 0.0
    async for je in db.journal_entries.find({
        "deleted_at": None, "status": "posted",
        "entry_date": {"$gte": start, "$lte": cap},
    }):
        for ln in je.get("lines", []):
            if ln.get("coa_id") not in cash_ids:
                continue
            if outlet_id and ln.get("dim_outlet") != outlet_id:
                continue
            if brand_id and ln.get("dim_brand") != brand_id:
                continue
            mtd_outflow += float(ln.get("cr", 0) or 0)

    # Baseline: avg outflow over last 3 complete months (same metric)
    baselines: list[float] = []
    for back in (1, 2, 3):
        by = y
        bm = m - back
        while bm <= 0:
            bm += 12
            by -= 1
        b_start = f"{by:04d}-{bm:02d}-01"
        if bm == 12:
            b_end = f"{by + 1:04d}-01-01"
        else:
            b_end = f"{by:04d}-{bm + 1:02d}-01"
        tot = 0.0
        async for je in db.journal_entries.find({
            "deleted_at": None, "status": "posted",
            "entry_date": {"$gte": b_start, "$lt": b_end},
        }):
            for ln in je.get("lines", []):
                if ln.get("coa_id") not in cash_ids:
                    continue
                if outlet_id and ln.get("dim_outlet") != outlet_id:
                    continue
                if brand_id and ln.get("dim_brand") != brand_id:
                    continue
                tot += float(ln.get("cr", 0) or 0)
        if tot > 0:
            baselines.append(tot)

    if not baselines:
        return {"severity": "none", "reason": "no_baseline", "observed": mtd_outflow}

    # Project MTD to full-month based on day-of-month ratio
    day_of_month = now.day
    import calendar
    days_in_month = calendar.monthrange(y, m)[1]
    projected_full = mtd_outflow / max(1, day_of_month) * days_in_month if day_of_month > 0 else mtd_outflow
    avg_baseline = statistics.mean(baselines)
    if avg_baseline <= 0:
        return {"severity": "none", "reason": "zero_baseline"}

    pct = (projected_full - avg_baseline) / avg_baseline * 100
    sev = _classify_pct(pct, pct_mild, pct_severe)
    if sev != "none" and pct < 0:
        sev = "none"
    return {
        "severity": sev, "deviation_pct": round(pct, 2),
        "observed": round(projected_full, 2),
        "mtd": round(mtd_outflow, 2),
        "baseline_mean": round(avg_baseline, 2),
        "baseline_count": len(baselines), "period": period,
    }

"""Vendor comparison service (Phase 9B).

Provides side-by-side vendor pricing + history for a set of items, sourced from
posted Goods Receipts (actual paid prices). Used in:
- /procurement/vendor-comparison (standalone tool)
- POForm right panel (suggested vendors per line)
"""
from __future__ import annotations

from datetime import datetime, timezone, timedelta

from core.db import get_db


def _parse_date(s: str | None) -> datetime | None:
    if not s:
        return None
    try:
        # accept YYYY-MM-DD or ISO
        if "T" in s:
            return datetime.fromisoformat(s.replace("Z", "+00:00"))
        return datetime.strptime(s, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except Exception:  # noqa: BLE001
        return None


async def compare(
    item_ids: list[str],
    *,
    days: int = 180,
    top_vendors_per_item: int = 5,
    history_limit: int = 3,
) -> dict:
    """Return vendor pricing comparison for a list of items.

    Output:
      {
        "items": [
          {
            "item_id": "...", "item_name": "Susu UHT 1L", "unit": "L",
            "vendors": [
              {
                "vendor_id": "...", "vendor_name": "Toko Sumber",
                "last_unit_cost": 25000, "avg_unit_cost": 24500,
                "min_unit_cost": 24000, "max_unit_cost": 25500,
                "purchase_count": 8, "last_purchase_date": "2026-04-15",
                "history": [
                  {"date": "2026-04-15", "unit_cost": 25000, "qty": 10, "doc_no": "GR-..."},
                  ...
                ],
                "score": 92.5    # for ranking (lower price + recency)
              }, ...
            ],
            "best_price_vendor_id": "...",
            "spread_pct": 4.5    # max-min / min × 100
          }, ...
        ],
        "period_days": 180,
        "as_of": "2026-04-28T00:00:00+00:00"
      }
    """
    if not item_ids:
        return {"items": [], "period_days": days, "as_of": datetime.now(timezone.utc).isoformat()}

    db = get_db()
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    cutoff_str = cutoff.strftime("%Y-%m-%d")

    # Fetch the items (for names + units)
    items_docs = await db.items.find(
        {"id": {"$in": item_ids}, "deleted_at": None}
    ).to_list(len(item_ids))
    items_by_id = {d["id"]: d for d in items_docs}

    # Fetch vendors (for names)
    vendor_ids_seen: set[str] = set()
    # Find all GRs with status posted in window touching any item
    grs_cur = db.goods_receipts.find({
        "deleted_at": None,
        "status": {"$in": ["posted", "completed", "received"]},
        "receive_date": {"$gte": cutoff_str},
        "lines.item_id": {"$in": item_ids},
    }).sort([("receive_date", -1)]).limit(2000)
    grs = await grs_cur.to_list(2000)

    # Aggregate: per (item_id, vendor_id) -> [(date, unit_cost, qty, doc_no), ...]
    bucket: dict[tuple, list[dict]] = {}
    for gr in grs:
        vendor_id = gr.get("vendor_id")
        if not vendor_id:
            continue
        vendor_ids_seen.add(vendor_id)
        date = gr.get("receive_date")
        doc_no = gr.get("doc_no") or gr.get("id", "")[:8]
        for ln in gr.get("lines", []) or []:
            iid = ln.get("item_id")
            if iid not in items_by_id and iid not in item_ids:
                continue
            if iid not in item_ids:
                continue
            unit_cost = float(ln.get("unit_cost", 0) or 0)
            if unit_cost <= 0:
                continue
            qty = float(ln.get("qty_received") or ln.get("qty") or 0)
            key = (iid, vendor_id)
            bucket.setdefault(key, []).append({
                "date": date, "unit_cost": unit_cost,
                "qty": qty, "doc_no": doc_no,
            })

    vendors_docs = await db.vendors.find(
        {"id": {"$in": list(vendor_ids_seen)}, "deleted_at": None}
    ).to_list(len(vendor_ids_seen))
    vendors_by_id = {d["id"]: d for d in vendors_docs}

    # Build response
    items_out: list[dict] = []
    for iid in item_ids:
        item = items_by_id.get(iid, {})
        # Get all vendors that have history for this item
        vendors_summary: list[dict] = []
        for (i2, vid), hist in bucket.items():
            if i2 != iid:
                continue
            # already sorted desc by receive_date because GRs were
            unit_costs = [h["unit_cost"] for h in hist]
            avg_uc = sum(unit_costs) / len(unit_costs) if unit_costs else 0
            min_uc = min(unit_costs) if unit_costs else 0
            max_uc = max(unit_costs) if unit_costs else 0
            last = hist[0]
            v = vendors_by_id.get(vid, {})
            vendors_summary.append({
                "vendor_id": vid,
                "vendor_name": v.get("name", vid[:8]),
                "vendor_code": v.get("code"),
                "last_unit_cost": round(last["unit_cost"], 2),
                "avg_unit_cost": round(avg_uc, 2),
                "min_unit_cost": round(min_uc, 2),
                "max_unit_cost": round(max_uc, 2),
                "purchase_count": len(hist),
                "last_purchase_date": last["date"],
                "history": hist[:history_limit],
            })
        # Sort vendors: best last price asc, then most recent
        vendors_summary.sort(key=lambda x: (x["last_unit_cost"], -x["purchase_count"]))
        # Compute composite score (relative to cheapest in this item)
        if vendors_summary:
            cheapest = vendors_summary[0]["last_unit_cost"]
            most_recent_dt = max(_parse_date(v["last_purchase_date"]) or datetime.min.replace(tzinfo=timezone.utc) for v in vendors_summary)
            for v in vendors_summary:
                price_idx = 0 if cheapest == 0 else (cheapest / v["last_unit_cost"]) * 60  # 0..60 (cheapest=60)
                # recency score 0..40
                last_dt = _parse_date(v["last_purchase_date"]) or datetime.min.replace(tzinfo=timezone.utc)
                day_gap = max(0, (most_recent_dt - last_dt).days)
                rec_idx = max(0, 40 - (day_gap / max(1, days)) * 40)
                v["score"] = round(price_idx + rec_idx, 1)
        # Spread
        spread_pct = 0.0
        if len(vendors_summary) >= 2:
            mn = min(v["last_unit_cost"] for v in vendors_summary)
            mx = max(v["last_unit_cost"] for v in vendors_summary)
            if mn > 0:
                spread_pct = round((mx - mn) / mn * 100, 1)

        items_out.append({
            "item_id": iid,
            "item_name": item.get("name", "Unknown"),
            "item_code": item.get("code"),
            "unit": item.get("unit_default") or item.get("unit") or "pcs",
            "vendors": vendors_summary[:top_vendors_per_item],
            "best_price_vendor_id": vendors_summary[0]["vendor_id"] if vendors_summary else None,
            "best_price": vendors_summary[0]["last_unit_cost"] if vendors_summary else None,
            "spread_pct": spread_pct,
            "total_vendors": len(vendors_summary),
        })

    return {
        "items": items_out,
        "period_days": days,
        "as_of": datetime.now(timezone.utc).isoformat(),
    }


async def vendor_scorecard(vendor_id: str, *, days: int = 180) -> dict:
    """Compute basic vendor performance: lead_time, on_time%, defect_rate,
    price_stability — sourced from POs + GRs. Returns dict for UI scorecard.
    """
    db = get_db()
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%d")
    pos = await db.purchase_orders.find({
        "vendor_id": vendor_id, "deleted_at": None,
        "order_date": {"$gte": cutoff},
    }).to_list(500)
    grs = await db.goods_receipts.find({
        "vendor_id": vendor_id, "deleted_at": None,
        "receive_date": {"$gte": cutoff},
    }).to_list(500)

    # Lead time per matched PO -> GR
    lead_times: list[float] = []
    on_time_count = 0
    on_time_total = 0
    qty_ordered_total = 0.0
    qty_received_total = 0.0
    grs_by_po: dict[str, list[dict]] = {}
    for g in grs:
        if g.get("po_id"):
            grs_by_po.setdefault(g["po_id"], []).append(g)
    for po in pos:
        po_grs = grs_by_po.get(po["id"], [])
        if not po_grs:
            continue
        first_gr = sorted(po_grs, key=lambda x: x.get("receive_date", ""))[0]
        order_dt = _parse_date(po.get("order_date"))
        rec_dt = _parse_date(first_gr.get("receive_date"))
        if order_dt and rec_dt:
            lt = (rec_dt - order_dt).days
            if lt >= 0:
                lead_times.append(lt)
        # On-time vs expected
        exp_dt = _parse_date(po.get("expected_delivery_date"))
        if exp_dt and rec_dt:
            on_time_total += 1
            if rec_dt <= exp_dt + timedelta(days=1):
                on_time_count += 1
        # Variance
        for ln_po in po.get("lines", []) or []:
            qty_ordered_total += float(ln_po.get("qty", 0) or 0)
        for g in po_grs:
            for ln_g in g.get("lines", []) or []:
                qty_received_total += float(ln_g.get("qty_received", 0) or 0)

    # Price stability per item
    item_prices: dict[str, list[float]] = {}
    for g in grs:
        for ln in g.get("lines", []) or []:
            iid = ln.get("item_id")
            uc = float(ln.get("unit_cost", 0) or 0)
            if iid and uc > 0:
                item_prices.setdefault(iid, []).append(uc)
    stabilities: list[float] = []
    for prices in item_prices.values():
        if len(prices) >= 2:
            avg = sum(prices) / len(prices)
            std = (sum((p - avg) ** 2 for p in prices) / len(prices)) ** 0.5
            cv = (std / avg * 100) if avg > 0 else 0
            stabilities.append(max(0, 100 - cv))  # higher = more stable
    avg_stability = sum(stabilities) / len(stabilities) if stabilities else None

    avg_lead = sum(lead_times) / len(lead_times) if lead_times else None
    on_time_pct = (on_time_count / on_time_total * 100) if on_time_total else None
    defect_rate = ((qty_ordered_total - qty_received_total) / qty_ordered_total * 100) if qty_ordered_total > 0 else 0.0

    return {
        "vendor_id": vendor_id,
        "period_days": days,
        "avg_lead_time_days": round(avg_lead, 1) if avg_lead is not None else None,
        "on_time_pct": round(on_time_pct, 1) if on_time_pct is not None else None,
        "defect_rate_pct": round(max(0, defect_rate), 1),
        "price_stability_pct": round(avg_stability, 1) if avg_stability is not None else None,
        "po_count": len(pos),
        "gr_count": len(grs),
        "total_qty_ordered": round(qty_ordered_total, 2),
        "total_qty_received": round(qty_received_total, 2),
    }

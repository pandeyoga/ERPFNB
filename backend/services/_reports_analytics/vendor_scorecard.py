"""Vendor performance scorecard — computed from POs + GRs."""
import statistics
from datetime import datetime, timezone
from typing import Any, Optional

from core.db import get_db


async def vendor_scorecard(
    *,
    vendor_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    top: int = 20,
) -> dict[str, Any]:
    """Compute vendor performance metrics from purchase_orders + goods_receipts.

    Metrics per vendor:
      - po_count, gr_count
      - total_spend (sum GR grand_total)
      - on_time_pct: GR receive_date <= PO expected_delivery_date
      - avg_lead_time_days: receive_date - sent_at (POs that have GR)
      - price_stability: 1 - (stddev(unit_cost) / avg(unit_cost)) per item, averaged
      - defect_rate: sum(qty_ordered - qty_received) / sum(qty_ordered)
      - late_delivery_count

    If vendor_id given → returns single vendor detail with per-PO breakdown.
    Else → returns list ranked by total_spend.
    """
    db = get_db()

    # Build common date filter on PO order_date
    date_filter: dict[str, Any] = {}
    if date_from:
        date_filter["$gte"] = date_from
    if date_to:
        date_filter["$lte"] = date_to

    po_match: dict[str, Any] = {"deleted_at": None}
    if date_filter:
        po_match["order_date"] = date_filter
    if vendor_id:
        po_match["vendor_id"] = vendor_id

    # Load all relevant POs
    pos: list[dict] = []
    async for po in db.purchase_orders.find(po_match):
        pos.append(po)

    if not pos:
        return {
            "vendors": [],
            "filters": {"vendor_id": vendor_id, "date_from": date_from, "date_to": date_to},
        }

    # Load all related GRs in one go
    po_ids = [p["id"] for p in pos]
    grs_by_po: dict[str, list[dict]] = {}
    async for gr in db.goods_receipts.find({"deleted_at": None, "po_id": {"$in": po_ids}}):
        grs_by_po.setdefault(gr["po_id"], []).append(gr)

    # Load vendor names
    vendor_ids = list({p["vendor_id"] for p in pos if p.get("vendor_id")})
    vendors_by_id: dict[str, dict] = {}
    async for v in db.vendors.find({"id": {"$in": vendor_ids}}):
        vendors_by_id[v["id"]] = {"id": v["id"], "name": v.get("name", v["id"]), "code": v.get("code", "")}

    # Group POs by vendor and compute metrics
    by_vendor: dict[str, dict[str, Any]] = {}
    for po in pos:
        vid = po["vendor_id"]
        bucket = by_vendor.setdefault(vid, {
            "vendor_id": vid,
            "vendor_name": vendors_by_id.get(vid, {}).get("name", vid),
            "vendor_code": vendors_by_id.get(vid, {}).get("code", ""),
            "po_count": 0,
            "gr_count": 0,
            "total_spend": 0.0,
            "on_time_count": 0,
            "late_count": 0,
            "lead_times": [],
            "qty_ordered": 0.0,
            "qty_received": 0.0,
            "item_costs": {},  # item_id -> [unit_cost,...]
            "po_breakdown": [],
        })
        bucket["po_count"] += 1
        grs = grs_by_po.get(po["id"], [])
        bucket["gr_count"] += len(grs)

        po_qty_ordered = sum(float(ln.get("qty", 0) or 0) for ln in po.get("lines", []))
        bucket["qty_ordered"] += po_qty_ordered

        # Track per-item unit cost from PO lines (price stability sample)
        for ln in po.get("lines", []):
            iid = ln.get("item_id")
            uc = float(ln.get("unit_cost", 0) or 0)
            if iid and uc > 0:
                bucket["item_costs"].setdefault(iid, []).append(uc)

        po_qty_received = 0.0
        po_spend = 0.0
        on_time_for_po = None  # tri-state: True/False/None
        for gr in grs:
            po_spend += float(gr.get("grand_total", 0) or 0)
            for gln in gr.get("lines", []):
                po_qty_received += float(gln.get("qty_received", 0) or 0)
            # Lead time
            try:
                if po.get("sent_at") and gr.get("receive_date"):
                    sent = datetime.fromisoformat(po["sent_at"].replace("Z", "+00:00"))
                    recv = datetime.strptime(gr["receive_date"], "%Y-%m-%d").replace(tzinfo=timezone.utc)
                    lead = (recv - sent).days
                    if lead >= 0:
                        bucket["lead_times"].append(lead)
            except Exception:  # noqa: BLE001
                pass
            # On-time check
            try:
                if po.get("expected_delivery_date") and gr.get("receive_date"):
                    exp_d = datetime.strptime(po["expected_delivery_date"], "%Y-%m-%d").date()
                    rcv_d = datetime.strptime(gr["receive_date"], "%Y-%m-%d").date()
                    on_time_for_po = rcv_d <= exp_d
            except Exception:  # noqa: BLE001
                pass

        if on_time_for_po is True:
            bucket["on_time_count"] += 1
        elif on_time_for_po is False:
            bucket["late_count"] += 1

        bucket["qty_received"] += po_qty_received
        bucket["total_spend"] += po_spend

        if vendor_id:  # single-vendor detail mode
            bucket["po_breakdown"].append({
                "po_id": po["id"],
                "doc_no": po.get("doc_no"),
                "order_date": po.get("order_date"),
                "expected_delivery_date": po.get("expected_delivery_date"),
                "grand_total": float(po.get("grand_total", 0) or 0),
                "status": po.get("status"),
                "gr_count": len(grs),
                "received_total": po_spend,
                "qty_ordered": po_qty_ordered,
                "qty_received": po_qty_received,
                "on_time": on_time_for_po,
                "doc_first_gr": grs[0].get("doc_no") if grs else None,
                "first_gr_id": grs[0].get("id") if grs else None,
            })

    # Compute derived metrics
    out_rows: list[dict[str, Any]] = []
    for vid, b in by_vendor.items():
        rated_pos = b["on_time_count"] + b["late_count"]
        on_time_pct = round(b["on_time_count"] / rated_pos * 100, 2) if rated_pos else None
        avg_lead = round(statistics.mean(b["lead_times"]), 2) if b["lead_times"] else None
        # Price stability: 1 - mean(stddev/mean) across items with >= 2 samples
        ratios: list[float] = []
        for iid, costs in b["item_costs"].items():
            if len(costs) >= 2 and statistics.mean(costs) > 0:
                ratio = statistics.stdev(costs) / statistics.mean(costs)
                ratios.append(ratio)
        price_stability = round((1.0 - statistics.mean(ratios)) * 100, 2) if ratios else None
        if price_stability is not None and price_stability < 0:
            price_stability = 0.0
        defect_rate = round(
            (b["qty_ordered"] - b["qty_received"]) / b["qty_ordered"] * 100, 2,
        ) if b["qty_ordered"] > 0 else None

        # Composite score 0-100 (weighted)
        components: list[float] = []
        if on_time_pct is not None:
            components.append(on_time_pct * 0.40)
        if price_stability is not None:
            components.append(price_stability * 0.25)
        if defect_rate is not None:
            components.append(max(0, 100 - defect_rate) * 0.20)
        if avg_lead is not None:
            # 0-day = 100, >=14 days = 0
            lead_score = max(0, 100 - (avg_lead / 14) * 100)
            components.append(lead_score * 0.15)
        composite = round(sum(components), 2) if components else None

        row: dict[str, Any] = {
            "vendor_id": vid,
            "vendor_name": b["vendor_name"],
            "vendor_code": b["vendor_code"],
            "po_count": b["po_count"],
            "gr_count": b["gr_count"],
            "total_spend": round(b["total_spend"], 2),
            "total_value": round(b["total_spend"], 2),  # alias for list UI (Total Value column)
            "on_time_pct": on_time_pct,
            "late_count": b["late_count"],
            "avg_lead_time_days": avg_lead,
            "price_stability_pct": price_stability,
            "defect_rate_pct": defect_rate,
            "composite_score": composite,
        }
        if vendor_id:
            row["po_breakdown"] = sorted(
                b["po_breakdown"], key=lambda r: r.get("order_date") or "", reverse=True,
            )
            row["item_price_samples"] = [
                {"item_id": iid, "samples": costs, "mean": round(statistics.mean(costs), 2),
                 "stdev": round(statistics.stdev(costs), 2) if len(costs) >= 2 else 0,
                 "n": len(costs)}
                for iid, costs in b["item_costs"].items() if costs
            ][:30]
        out_rows.append(row)

    out_rows.sort(key=lambda r: r["total_spend"], reverse=True)
    if not vendor_id:
        out_rows = out_rows[:top]

    return {
        "vendors": out_rows,
        "filters": {"vendor_id": vendor_id, "date_from": date_from, "date_to": date_to, "top": top},
        "summary": {
            "vendor_count": len(out_rows),
            "total_spend": round(sum(r["total_spend"] for r in out_rows), 2),
            "avg_on_time_pct": round(
                statistics.mean([r["on_time_pct"] for r in out_rows if r["on_time_pct"] is not None]), 2,
            ) if [r for r in out_rows if r["on_time_pct"] is not None] else None,
        },
    }

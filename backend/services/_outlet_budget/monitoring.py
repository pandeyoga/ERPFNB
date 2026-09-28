"""Multi-outlet aggregation for Executive dashboards (overview + heatmap)."""
from typing import Optional

from services._outlet_budget._common import get_db, serialize
from services._outlet_budget.actuals import compute_actuals, compute_pace


async def monitor_overview(
    *, period_type: str, period_key: str,
    brand_id: Optional[str] = None,
) -> dict:
    """Aggregate budget vs actual across all outlets in a period."""
    db = get_db()
    q: dict = {
        "period_type": period_type, "period_key": period_key,
        "deleted_at": None, "status": "active",
    }
    if brand_id:
        q["brand_id"] = brand_id
    docs = await db.outlet_budgets.find(q).to_list(1000)
    items = []
    totals = {"kdo": 0.0, "fdo": 0.0, "bdo": 0.0, "combined": 0.0, "total": 0.0,
              "actual_kdo": 0.0, "actual_fdo": 0.0, "actual_bdo": 0.0, "actual_total": 0.0,
              "per_bucket_count": 0, "combined_count": 0}
    for d in docs:
        actuals = await compute_actuals(d["outlet_id"], d["period_start"], d["period_end"])
        pace = compute_pace(serialize(d), actuals)
        items.append({**serialize(d), "actuals": actuals, "pace": pace})
        mode = (d.get("budget_mode") or "per_bucket").lower()
        if mode == "combined":
            totals["combined"] += float(d.get("combined_budget", 0) or 0)
            totals["total"] += float(d.get("combined_budget", 0) or 0)
            totals["combined_count"] += 1
        else:
            totals["kdo"] += float(d.get("kdo_budget", 0) or 0)
            totals["fdo"] += float(d.get("fdo_budget", 0) or 0)
            totals["bdo"] += float(d.get("bdo_budget", 0) or 0)
            totals["total"] += float(d.get("total_budget", 0) or 0)
            totals["per_bucket_count"] += 1
        totals["actual_kdo"] += float(actuals.get("kdo", 0) or 0)
        totals["actual_fdo"] += float(actuals.get("fdo", 0) or 0)
        totals["actual_bdo"] += float(actuals.get("bdo", 0) or 0)
        totals["actual_total"] += float(actuals.get("total", 0) or 0)
    over_count = sum(1 for it in items if it.get("pace", {}).get("summary", {}).get("any_red"))
    warn_count = sum(1 for it in items if it.get("pace", {}).get("summary", {}).get("any_amber"))
    return {
        "period_type": period_type, "period_key": period_key,
        "items": items,
        "totals": {k: round(v, 2) for k, v in totals.items()},
        "over_budget_count": over_count,
        "warning_count": warn_count,
        "total_outlets": len(items),
    }


async def heatmap(
    *, period_type: str, period_keys: list[str],
    outlet_ids: Optional[list[str]] = None,
) -> dict:
    """Heatmap data: outlet x period x pct_used."""
    db = get_db()
    q: dict = {
        "period_type": period_type, "period_key": {"$in": period_keys},
        "deleted_at": None, "status": "active",
    }
    if outlet_ids:
        q["outlet_id"] = {"$in": outlet_ids}
    docs = await db.outlet_budgets.find(q).to_list(1000)
    matrix: dict = {}
    for d in docs:
        actuals = await compute_actuals(d["outlet_id"], d["period_start"], d["period_end"])
        pace = compute_pace(serialize(d), actuals)
        cell_key = d["outlet_id"]
        if cell_key not in matrix:
            matrix[cell_key] = {}
        # Overall pct_used (total)
        total_budget = float(d.get("total_budget", 0) or 0)
        total_actual = float(actuals.get("total", 0) or 0)
        pct = (total_actual / total_budget * 100.0) if total_budget > 0 else 0.0
        any_red = pace.get("summary", {}).get("any_red", False) if pace else False
        any_amber = pace.get("summary", {}).get("any_amber", False) if pace else False
        status = "red" if any_red else ("amber" if any_amber else "green")
        matrix[cell_key][d["period_key"]] = {
            "pct": round(pct, 1),
            "status": status,
            "budget": total_budget,
            "actual": total_actual,
            "budget_id": d["id"],
        }
    return {"matrix": matrix, "period_keys": period_keys}

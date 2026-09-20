"""Actuals + pace computation (per-outlet, per-period)."""
from datetime import datetime

from services._outlet_budget._common import get_db, BUCKETS, _today


async def compute_actuals(outlet_id: str, period_start: str, period_end: str) -> dict:
    """Sum approved PR amounts in (period_start, period_end] grouped by source bucket.

    Statuses counted as "committed" spending:
      - approved
      - awaiting_approval (pending but already submitted — reserves budget)
      - converted_to_po

    Draft & rejected are excluded.

    Returns:
        {
          "kdo": <float>, "fdo": <float>, "bdo": <float>,
          "combined": <float>,   # alias for total of KDO+FDO+BDO (used in combined mode)
          "total": <float>, "count": <int>,
        }
    """
    db = get_db()
    q = {
        "outlet_id": outlet_id,
        "deleted_at": None,
        "source": {"$in": list(BUCKETS)},
        "status": {"$in": ["submitted", "awaiting_approval", "approved", "converted_to_po"]},
        "request_date": {"$gte": period_start, "$lte": period_end},
    }
    out = {"kdo": 0.0, "fdo": 0.0, "bdo": 0.0, "total": 0.0, "count": 0}
    async for pr in db.purchase_requests.find(q):
        total = sum(
            float(ln.get("qty", 0) or 0) * float(ln.get("unit_cost", 0) or 0)
            for ln in (pr.get("lines") or [])
        )
        bucket = pr.get("source", "")
        if bucket in out:
            out[bucket] += total
            out["total"] += total
            out["count"] += 1
    # Combined alias = total of all 3 buckets
    out["combined"] = out["total"]
    return {k: (round(v, 2) if isinstance(v, float) else v) for k, v in out.items()}


def compute_pace(budget_doc: dict, actuals: dict) -> dict:
    """Compute pace metrics for UI.

    Returns dict with per-bucket pct_used, status (green|amber|red),
    days_elapsed/total, time_elapsed_pct, and run-rate projections.

    Mode-aware:
      - per_bucket: returns kdo/fdo/bdo cells + a synthesized "total_combined" cell.
      - combined:   returns a single "combined" cell (kdo/fdo/bdo cells still
                    present for visibility, but their `budget` will be 0 and pct=0).
    """
    try:
        start = datetime.strptime(budget_doc["period_start"], "%Y-%m-%d").date()
        end = datetime.strptime(budget_doc["period_end"], "%Y-%m-%d").date()
    except Exception:
        return {}
    today = _today()
    if today < start:
        time_elapsed = 0.0
        days_elapsed = 0
    elif today > end:
        time_elapsed = 1.0
        days_elapsed = (end - start).days + 1
    else:
        days_elapsed = (today - start).days + 1
        days_total = max(1, (end - start).days + 1)
        time_elapsed = days_elapsed / days_total
    days_total = max(1, (end - start).days + 1)

    threshold = float(budget_doc.get("alert_threshold_pct", 80.0))
    mode = (budget_doc.get("budget_mode") or "per_bucket").lower()

    def _cell(budget_val: float, actual_val: float) -> dict:
        budget_val = float(budget_val or 0)
        actual_val = float(actual_val or 0)
        pct = (actual_val / budget_val * 100.0) if budget_val > 0 else 0.0
        remaining = max(0.0, budget_val - actual_val)
        if pct >= 100:
            status = "red"
        elif pct >= threshold:
            status = "amber"
        else:
            status = "green"
        projected = actual_val / time_elapsed if time_elapsed > 0 else 0.0
        projected_pct = (projected / budget_val * 100.0) if budget_val > 0 else 0.0
        return {
            "budget": round(budget_val, 2),
            "actual": round(actual_val, 2),
            "remaining": round(remaining, 2),
            "pct_used": round(pct, 1),
            "status": status,
            "projected_eop": round(projected, 2),
            "projected_pct": round(projected_pct, 1),
        }

    out = {b: _cell(budget_doc.get(f"{b}_budget", 0), actuals.get(b, 0)) for b in BUCKETS}
    # Always provide a "combined" cell for UI:
    # - In combined mode, this is the authoritative cell (driven by combined_budget vs total actual)
    # - In per_bucket mode, this is informational (sum of bucket budgets vs sum of actuals)
    if mode == "combined":
        combined_budget = float(budget_doc.get("combined_budget", 0) or 0)
    else:
        combined_budget = sum(float(budget_doc.get(f"{b}_budget", 0) or 0) for b in BUCKETS)
    combined_actual = float(actuals.get("combined", actuals.get("total", 0)) or 0)
    out["combined"] = _cell(combined_budget, combined_actual)

    out["summary"] = {
        "days_elapsed": days_elapsed,
        "days_total": days_total,
        "time_elapsed_pct": round(time_elapsed * 100, 1),
        "days_remaining": max(0, (end - today).days),
        "period_start": str(start),
        "period_end": str(end),
        "alert_threshold_pct": threshold,
        "budget_mode": mode,
        "total_budget": round(
            combined_budget if mode == "combined"
            else sum(out[b]["budget"] for b in BUCKETS),
            2,
        ),
        "total_actual": round(
            combined_actual if mode == "combined"
            else sum(out[b]["actual"] for b in BUCKETS),
            2,
        ),
        # `any_red`/`any_amber` reflect the cells that ACTUALLY drive blocking:
        "any_red": (
            out["combined"]["status"] == "red" if mode == "combined"
            else any(out[b]["status"] == "red" for b in BUCKETS)
        ),
        "any_amber": (
            out["combined"]["status"] == "amber" if mode == "combined"
            else any(out[b]["status"] == "amber" for b in BUCKETS)
        ),
    }
    return out

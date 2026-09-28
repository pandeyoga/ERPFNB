"""PR hook — check budget compliance before PR creation."""
from services._outlet_budget._common import get_db, serialize, BUCKETS, _today
from services._outlet_budget.actuals import compute_actuals
from services._outlet_budget.lookup import find_active_budget


async def check_pr_against_budget(pr_payload: dict) -> dict:
    """Inspect a draft PR payload and return budget compliance verdict.

    Returns:
      {
        ok: bool,
        block: bool,  # if True → should reject PR submit
        reason: str?,
        bucket: "kdo|fdo|bdo",
        pr_total: float,
        budget: {kdo,fdo,bdo,...} or None,
        actuals: ... or None,
        remaining: float?,
        budget_id: str?
      }
    """
    source = pr_payload.get("source", "").lower()
    if source not in BUCKETS:
        # Not a cost-controlled PR (urgent_purchase, manual, etc.)
        return {"ok": True, "block": False, "applicable": False, "bucket": source}
    outlet_id = pr_payload.get("outlet_id")
    if not outlet_id:
        return {"ok": False, "block": True, "applicable": True, "bucket": source,
                "reason": "outlet_id missing"}

    db = get_db()
    pr_total = 0.0
    lines = pr_payload.get("lines", []) or []

    # B9 fix: batch-lookup market_list_prices for all items missing unit_cost (was N+1)
    no_cost_item_ids = list({ln["item_id"] for ln in lines
                             if float(ln.get("unit_cost", 0) or 0) == 0 and ln.get("item_id")})
    ml_price_map: dict[str, float] = {}
    if no_cost_item_ids:
        # Aggregate latest ref_price per item_id (most recent created_at)
        ml_pipeline = [
            {"$match": {"item_id": {"$in": no_cost_item_ids}, "deleted_at": None}},
            {"$sort": {"created_at": -1}},
            {"$group": {"_id": "$item_id", "ref_price": {"$first": "$ref_price"}}},
        ]
        async for row in db.market_list_prices.aggregate(ml_pipeline):
            ml_price_map[row["_id"]] = float(row.get("ref_price") or 0)

    for ln in lines:
        qty = float(ln.get("qty", 0) or 0)
        unit_cost = float(ln.get("unit_cost", 0) or 0)
        # Fallback: use pre-fetched map
        if unit_cost == 0 and ln.get("item_id"):
            unit_cost = ml_price_map.get(ln["item_id"], 0)
        pr_total += qty * unit_cost

    # Use request_date to find the right active budget; fall back to today
    on_date = pr_payload.get("request_date") or _today().strftime("%Y-%m-%d")

    # Prefer monthly budget for spend (broader window); fall back to weekly
    budget = await find_active_budget(outlet_id, on_date=on_date, period_type="monthly")
    period_type = "monthly"
    if not budget:
        budget = await find_active_budget(outlet_id, on_date=on_date, period_type="weekly")
        period_type = "weekly" if budget else "monthly"

    if not budget:
        return {
            "ok": False, "block": True, "applicable": True,
            "bucket": source, "pr_total": pr_total,
            "reason": "NO_BUDGET",
            "message": f"Belum ada Outlet Operational Budget aktif untuk outlet ini. Hubungi Executive untuk set budget {source.upper()}.",
        }

    actuals = await compute_actuals(outlet_id, budget["period_start"], budget["period_end"])
    mode = (budget.get("budget_mode") or "per_bucket").lower()

    if mode == "combined":
        # Single pool — total of all KDO+FDO+BDO actuals against combined_budget
        pool_budget = float(budget.get("combined_budget", 0) or 0)
        pool_used = float(actuals.get("combined", actuals.get("total", 0)) or 0)
        remaining = pool_budget - pool_used

        if pool_budget <= 0:
            return {
                "ok": False, "block": True, "applicable": True,
                "bucket": source, "effective_bucket": "combined", "mode": "combined",
                "pr_total": pr_total,
                "budget": serialize(budget), "actuals": actuals, "remaining": 0,
                "budget_id": budget["id"], "period_type": period_type,
                "reason": "BUCKET_ZERO",
                "message": (
                    "Budget gabungan (KDO+FDO+BDO) untuk periode ini = 0. "
                    "Hubungi Executive untuk set budget."
                ),
            }
        if pr_total > remaining:
            return {
                "ok": False, "block": True, "applicable": True,
                "bucket": source, "effective_bucket": "combined", "mode": "combined",
                "pr_total": round(pr_total, 2),
                "budget": serialize(budget), "actuals": actuals,
                "remaining": round(remaining, 2),
                "shortfall": round(pr_total - remaining, 2),
                "budget_id": budget["id"], "period_type": period_type,
                "reason": "OVER_BUDGET",
                "message": (
                    f"PR ini Rp {pr_total:,.0f} melebihi sisa budget gabungan "
                    f"(Rp {remaining:,.0f}). Submit Request Penambahan Budget terlebih dahulu."
                ),
            }
        return {
            "ok": True, "block": False, "applicable": True,
            "bucket": source, "effective_bucket": "combined", "mode": "combined",
            "pr_total": round(pr_total, 2),
            "budget": serialize(budget), "actuals": actuals,
            "remaining": round(remaining, 2),
            "budget_id": budget["id"], "period_type": period_type,
        }

    # per_bucket (default) — check the specific source bucket
    bucket_budget = float(budget.get(f"{source}_budget", 0) or 0)
    bucket_used = float(actuals.get(source, 0) or 0)
    remaining = bucket_budget - bucket_used

    if bucket_budget <= 0:
        return {
            "ok": False, "block": True, "applicable": True,
            "bucket": source, "effective_bucket": source, "mode": "per_bucket",
            "pr_total": pr_total,
            "budget": serialize(budget), "actuals": actuals, "remaining": 0,
            "budget_id": budget["id"], "period_type": period_type,
            "reason": "BUCKET_ZERO",
            "message": f"Budget {source.upper()} untuk periode ini = 0. Hubungi Executive untuk set budget.",
        }

    if pr_total > remaining:
        return {
            "ok": False, "block": True, "applicable": True,
            "bucket": source, "effective_bucket": source, "mode": "per_bucket",
            "pr_total": round(pr_total, 2),
            "budget": serialize(budget), "actuals": actuals,
            "remaining": round(remaining, 2),
            "shortfall": round(pr_total - remaining, 2),
            "budget_id": budget["id"], "period_type": period_type,
            "reason": "OVER_BUDGET",
            "message": (
                f"PR ini Rp {pr_total:,.0f} melebihi sisa budget {source.upper()} "
                f"(Rp {remaining:,.0f}). Submit Request Penambahan Budget terlebih dahulu."
            ),
        }

    return {
        "ok": True, "block": False, "applicable": True,
        "bucket": source, "effective_bucket": source, "mode": "per_bucket",
        "pr_total": round(pr_total, 2),
        "budget": serialize(budget), "actuals": actuals,
        "remaining": round(remaining, 2),
        "budget_id": budget["id"], "period_type": period_type,
    }

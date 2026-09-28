"""Active budget lookup helpers (per outlet, per date)."""
from typing import Optional

from services._outlet_budget._common import get_db, serialize, _today
from services._outlet_budget.actuals import compute_actuals, compute_pace


async def find_active_budget(
    outlet_id: str, *, on_date: Optional[str] = None,
    period_type: str = "monthly",
) -> Optional[dict]:
    """Find currently-active budget for outlet on a given date (default today).

    Prefers requested period_type. Returns serialized doc or None.
    """
    db = get_db()
    if on_date is None:
        on_date = _today().strftime("%Y-%m-%d")
    doc = await db.outlet_budgets.find_one({
        "outlet_id": outlet_id,
        "period_type": period_type,
        "period_start": {"$lte": on_date},
        "period_end": {"$gte": on_date},
        "deleted_at": None,
        "status": "active",
    })
    return serialize(doc) if doc else None


async def current_periods_for_outlet(outlet_id: str) -> dict:
    """Return active weekly + monthly budgets for outlet (if any)."""
    today = _today()
    today_iso = today.strftime("%Y-%m-%d")
    weekly = await find_active_budget(outlet_id, on_date=today_iso, period_type="weekly")
    monthly = await find_active_budget(outlet_id, on_date=today_iso, period_type="monthly")
    out: dict = {"weekly": None, "monthly": None}
    if weekly:
        actuals = await compute_actuals(outlet_id, weekly["period_start"], weekly["period_end"])
        weekly["actuals"] = actuals
        weekly["pace"] = compute_pace(weekly, actuals)
        out["weekly"] = weekly
    if monthly:
        actuals = await compute_actuals(outlet_id, monthly["period_start"], monthly["period_end"])
        monthly["actuals"] = actuals
        monthly["pace"] = compute_pace(monthly, actuals)
        out["monthly"] = monthly
    return out

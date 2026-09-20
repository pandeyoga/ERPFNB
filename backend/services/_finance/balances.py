"""Balance aggregation helpers for Trial Balance and P&L."""
from __future__ import annotations

from core.db import get_db


async def _aggregate_balance(
    coa_ids: list[str],
    period: str,
    *,
    period_only: bool = False,
) -> dict[str, dict]:
    """Aggregate journal line totals by COA.
    Returns {coa_id: {period_dr, period_cr, cumulative_dr, cumulative_cr}}
    """
    db = get_db()
    result: dict[str, dict] = {coa_id: {"period_dr": 0.0, "period_cr": 0.0, "cumulative_dr": 0.0, "cumulative_cr": 0.0} for coa_id in coa_ids}

    pipeline = [
        {"$match": {"deleted_at": None, "status": "posted", "period": {"$lte": period}}},
        {"$unwind": "$lines"},
        {"$match": {"lines.coa_id": {"$in": coa_ids}}},
        {"$group": {
            "_id": {"coa_id": "$lines.coa_id", "is_current": {"$eq": ["$period", period]}},
            "dr": {"$sum": "$lines.dr"},
            "cr": {"$sum": "$lines.cr"},
        }},
    ]
    async for row in db.journal_entries.aggregate(pipeline):
        coa_id = row["_id"]["coa_id"]
        is_current = row["_id"]["is_current"]
        if coa_id not in result:
            result[coa_id] = {"period_dr": 0.0, "period_cr": 0.0, "cumulative_dr": 0.0, "cumulative_cr": 0.0}
        result[coa_id]["cumulative_dr"] += float(row["dr"])
        result[coa_id]["cumulative_cr"] += float(row["cr"])
        if is_current:
            result[coa_id]["period_dr"] += float(row["dr"])
            result[coa_id]["period_cr"] += float(row["cr"])
    return result


def _prev_period(period: str) -> str:
    """Return the preceding YYYY-MM period."""
    try:
        y, m = period.split("-")
        y_i, m_i = int(y), int(m)
        if m_i == 1:
            return f"{y_i - 1:04d}-12"
        return f"{y_i:04d}-{m_i - 1:02d}"
    except Exception:  # noqa: BLE001
        return period

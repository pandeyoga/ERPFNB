"""HR sub-module: LB Fund Ledger.

Auto-extracted from former monolithic hr_service.py for maintainability.
"""
import uuid
from typing import Optional

from core.db import get_db, serialize
from services.hr_constants import _now


async def _lb_ledger_add(
    *, entry_date: str, direction: str, amount: float,
    source_type: str, source_id: Optional[str] = None,
    outlet_id: Optional[str] = None, description: Optional[str] = None,
) -> dict:
    db = get_db()
    # Compute new running balance
    cursor = db.lb_fund_ledger.aggregate([
        {"$match": {"deleted_at": None}},
        {"$group": {
            "_id": None,
            "balance": {"$sum": {"$cond": [
                {"$eq": ["$direction", "in"]}, "$amount", {"$multiply": ["$amount", -1]},
            ]}},
        }},
    ])
    res = await cursor.to_list(1)
    cur = float(res[0]["balance"]) if res else 0.0
    delta = amount if direction == "in" else -amount
    new_bal = round(cur + delta, 2)
    doc = {
        "id": str(uuid.uuid4()),
        "entry_date": entry_date,
        "direction": direction,
        "amount": round(amount, 2),
        "source_type": source_type,
        "source_id": source_id,
        "outlet_id": outlet_id,
        "description": description,
        "balance_after": new_bal,
        "created_at": _now(), "updated_at": _now(), "deleted_at": None,
    }
    await db.lb_fund_ledger.insert_one(doc)
    return serialize(doc)


async def list_lb_fund(*, page: int = 1, per_page: int = 50):
    db = get_db()
    q = {"deleted_at": None}
    skip = (page - 1) * per_page
    items = await db.lb_fund_ledger.find(q).sort([("entry_date", -1), ("created_at", -1)]).skip(skip).limit(per_page).to_list(per_page)
    total = await db.lb_fund_ledger.count_documents(q)
    cursor = db.lb_fund_ledger.aggregate([
        {"$match": q},
        {"$group": {"_id": None,
                    "balance": {"$sum": {"$cond": [
                        {"$eq": ["$direction", "in"]}, "$amount", {"$multiply": ["$amount", -1]},
                    ]}}}},
    ])
    res = await cursor.to_list(1)
    balance = float(res[0]["balance"]) if res else 0.0
    return [serialize(d) for d in items], {"page": page, "per_page": per_page, "total": total, "balance": round(balance, 2)}

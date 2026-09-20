"""Balance Sheet report — cumulative balances up to as_of date.

Assets (Dr-normal) = opening + Σ dr − Σ cr   (since beginning of time)
Liabilities/Equity (Cr-normal) = opening + Σ cr − Σ dr

Assets must equal Liabilities + Equity (accounting identity).
"""
import logging
from datetime import datetime
from typing import Optional

from core.db import get_db
from core.exceptions import ValidationError

logger = logging.getLogger("aurora.balance_sheet")


def _parse_date(s: str) -> str:
    try:
        datetime.strptime(s, "%Y-%m-%d")
        return s
    except Exception as e:  # noqa: BLE001
        raise ValidationError(f"as_of harus YYYY-MM-DD: {e}")


async def balance_sheet(*, as_of: Optional[str] = None, dim_outlet: Optional[str] = None) -> dict:
    """Generate BS grouped by type/sub-type."""
    as_of = _parse_date(as_of) if as_of else datetime.now().strftime("%Y-%m-%d")
    db = get_db()

    base_match: dict = {
        "deleted_at": None,
        "status": "posted",
        "entry_date": {"$lte": as_of},
    }

    pipeline: list[dict] = [
        {"$match": base_match},
        {"$unwind": "$lines"},
    ]
    if dim_outlet:
        pipeline.append({"$match": {"lines.dim_outlet": dim_outlet}})
    pipeline.append({
        "$group": {
            "_id": "$lines.coa_id",
            "dr": {"$sum": {"$ifNull": ["$lines.dr", 0]}},
            "cr": {"$sum": {"$ifNull": ["$lines.cr", 0]}},
        },
    })
    by_coa: dict = {}
    async for d in db.journal_entries.aggregate(pipeline):
        coa_id = d["_id"]
        if not coa_id:
            continue
        by_coa[coa_id] = {"dr": float(d["dr"]), "cr": float(d["cr"])}

    # Load COAs (asset/liability/equity only)
    coas: list[dict] = []
    async for c in db.chart_of_accounts.find({
        "deleted_at": None,
        "type": {"$in": ["asset", "liability", "equity"]},
    }):
        coas.append(c)

    # Net income — must be added to equity (current period retained earnings)
    ni_dr = ni_cr = 0.0
    async for d in db.journal_entries.aggregate([
        {"$match": {**base_match}},
        {"$unwind": "$lines"},
        *([{"$match": {"lines.dim_outlet": dim_outlet}}] if dim_outlet else []),
        {"$lookup": {
            "from": "chart_of_accounts", "localField": "lines.coa_id",
            "foreignField": "id", "as": "coa",
        }},
        {"$unwind": "$coa"},
        {"$match": {"coa.type": {"$in": ["revenue", "cogs", "expense"]}}},
        {"$group": {
            "_id": "$coa.type",
            "dr": {"$sum": {"$ifNull": ["$lines.dr", 0]}},
            "cr": {"$sum": {"$ifNull": ["$lines.cr", 0]}},
        }},
    ]):
        t = d["_id"]
        if t == "revenue":
            ni_cr += float(d["cr"]) - float(d["dr"])
        else:  # cogs, expense (Dr-normal)
            ni_dr += float(d["dr"]) - float(d["cr"])
    net_income = round(ni_cr - ni_dr, 2)  # Revenue - (COGS + Expense)

    sections: dict = {"asset": [], "liability": [], "equity": []}
    totals: dict = {"asset": 0.0, "liability": 0.0, "equity": 0.0}
    for coa in coas:
        t = coa["type"]
        bal = by_coa.get(coa["id"], {"dr": 0.0, "cr": 0.0})
        normal = coa.get("normal_balance", "Dr" if t == "asset" else "Cr")
        if normal == "Dr":
            amount = bal["dr"] - bal["cr"]
        else:
            amount = bal["cr"] - bal["dr"]
        amount = round(amount, 2)
        if amount == 0:
            continue
        sections[t].append({
            "coa_id": coa["id"],
            "code": coa["code"],
            "name": coa["name"],
            "amount": amount,
        })
        totals[t] += amount
    for k in sections:
        sections[k].sort(key=lambda r: r["code"])

    # Add current-period net income under Equity (pseudo-row)
    if net_income != 0:
        sections["equity"].append({
            "coa_id": "__ni__",
            "code": "NI",
            "name": "Net Income (current period)",
            "amount": net_income,
            "pseudo": True,
        })
        totals["equity"] += net_income

    total_assets = round(totals["asset"], 2)
    total_liab_equity = round(totals["liability"] + totals["equity"], 2)
    diff = round(total_assets - total_liab_equity, 2)

    return {
        "as_of": as_of,
        "dim_outlet": dim_outlet,
        "sections": sections,
        "totals": {
            "assets": total_assets,
            "liabilities": round(totals["liability"], 2),
            "equity": round(totals["equity"], 2),
            "liabilities_plus_equity": total_liab_equity,
            "net_income": net_income,
            "diff": diff,
            "is_balanced": abs(diff) < 0.5,
        },
    }

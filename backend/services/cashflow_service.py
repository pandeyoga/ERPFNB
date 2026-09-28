"""Cashflow Report (Direct Method) — aggregates cash/bank account movements and
classifies by source_type into Operating / Investing / Financing categories.

Default mapping (can be overridden via business rule if needed later):
  OPERATING   = sales, petty_cash, urgent_purchase, goods_receipt,
                payment_request (non-payroll), adjustment, service_charge,
                voucher_redeem, foc, opname
  INVESTING   = capex / asset purchase (manual JE tagged)
  FINANCING   = loan, capital injection (manual JE tagged)
  OTHER       = any unclassified (mostly manual JE)
"""
import logging
from datetime import datetime, timedelta
from typing import Optional

from core.db import get_db
from core.exceptions import ValidationError

logger = logging.getLogger("aurora.cashflow")


# Source-type -> category
CATEGORY_MAP: dict[str, str] = {
    "sales": "operating",
    "petty_cash": "operating",
    "urgent_purchase": "operating",
    "goods_receipt": "operating",
    "payment_request": "operating",
    "adjustment": "operating",
    "opname": "operating",
    "service_charge": "operating",
    "payroll": "operating",
    "incentive": "operating",
    "employee_advance": "operating",
    "voucher_issue": "operating",
    "voucher_redeem": "operating",
    "foc": "operating",
    "manual": "other",
    "reversal": "other",
}


CATEGORY_LABELS = {
    "operating": "Aktivitas Operasi",
    "investing": "Aktivitas Investasi",
    "financing": "Aktivitas Pendanaan",
    "other": "Lainnya / Manual",
}


def _parse_period(period: str) -> tuple[str, str]:
    try:
        y, m = period.split("-")
        y, m = int(y), int(m)
    except Exception as e:  # noqa: BLE001
        raise ValidationError(f"period harus YYYY-MM: {e}")
    start = f"{y:04d}-{m:02d}-01"
    if m == 12:
        end_dt = datetime(y + 1, 1, 1) - timedelta(days=1)
    else:
        end_dt = datetime(y, m + 1, 1) - timedelta(days=1)
    return start, end_dt.strftime("%Y-%m-%d")


async def _cash_coa_ids() -> list[str]:
    """Return coa_ids that represent cash/bank (from bank_accounts + gl_mapping cash_on_hand/petty_cash)."""
    db = get_db()
    ids: set[str] = set()
    # Bank accounts
    async for ba in db.bank_accounts.find({"deleted_at": None}):
        if ba.get("gl_account_id"):
            ids.add(ba["gl_account_id"])
    # COA type=asset with code starting 110* (cash) or 11 (traditional)
    async for coa in db.chart_of_accounts.find({
        "deleted_at": None, "type": "asset",
    }):
        code = coa.get("code", "")
        name = (coa.get("name") or "").lower()
        if code.startswith("110") or code.startswith("111") or "cash" in name or "kas" in name or "bank" in name:
            ids.add(coa["id"])
    return list(ids)


async def cashflow(*, period: str, dim_outlet: Optional[str] = None) -> dict:
    """Generate cashflow for a period.

    Returns:
      {
        period, start_date, end_date, dim_outlet,
        opening_balance, closing_balance, net_flow,
        by_category: {operating: {inflow, outflow, net, rows: [...]}, ...},
        daily: [{date, inflow, outflow, balance}],
        transactions: [...],   # top 200 for UI list
      }
    """
    db = get_db()
    start, end = _parse_period(period)

    cash_coas = await _cash_coa_ids()
    if not cash_coas:
        return {
            "period": period, "start_date": start, "end_date": end,
            "dim_outlet": dim_outlet,
            "opening_balance": 0.0, "closing_balance": 0.0, "net_flow": 0.0,
            "by_category": {}, "daily": [], "transactions": [],
        }

    # Opening balance: sum of (dr - cr) for cash COAs BEFORE start
    opening_pipe: list[dict] = [
        {"$match": {"deleted_at": None, "status": "posted", "entry_date": {"$lt": start}}},
        {"$unwind": "$lines"},
        {"$match": {"lines.coa_id": {"$in": cash_coas}}},
    ]
    if dim_outlet:
        opening_pipe.append({"$match": {"lines.dim_outlet": dim_outlet}})
    opening_pipe.append({
        "$group": {"_id": None, "dr": {"$sum": "$lines.dr"}, "cr": {"$sum": "$lines.cr"}},
    })
    opening = 0.0
    async for d in db.journal_entries.aggregate(opening_pipe):
        opening = float(d.get("dr", 0)) - float(d.get("cr", 0))

    # Period JE lines touching cash
    match = {"deleted_at": None, "status": "posted",
             "entry_date": {"$gte": start, "$lte": end}}
    jes = await db.journal_entries.find(match).sort("entry_date", 1).to_list(20000)

    by_cat: dict[str, dict] = {
        k: {"label": v, "inflow": 0.0, "outflow": 0.0, "net": 0.0, "rows": []}
        for k, v in CATEGORY_LABELS.items()
    }
    daily: dict[str, dict] = {}
    txns: list[dict] = []
    for je in jes:
        src = je.get("source_type") or "manual"
        cat = CATEGORY_MAP.get(src, "other")
        je_in = 0.0
        je_out = 0.0
        for ln in je.get("lines", []):
            if ln.get("coa_id") not in cash_coas:
                continue
            if dim_outlet and ln.get("dim_outlet") != dim_outlet:
                continue
            dr = float(ln.get("dr", 0) or 0)
            cr = float(ln.get("cr", 0) or 0)
            je_in += dr
            je_out += cr
        if je_in == 0 and je_out == 0:
            continue
        by_cat[cat]["inflow"] += je_in
        by_cat[cat]["outflow"] += je_out
        by_cat[cat]["net"] += je_in - je_out
        by_cat[cat]["rows"].append({
            "je_id": je["id"], "doc_no": je.get("doc_no"),
            "entry_date": je.get("entry_date"),
            "description": je.get("description"),
            "source_type": src,
            "inflow": round(je_in, 2), "outflow": round(je_out, 2),
            "net": round(je_in - je_out, 2),
        })
        # Daily buckets
        d = je.get("entry_date", "")
        bucket = daily.setdefault(d, {"date": d, "inflow": 0.0, "outflow": 0.0, "balance": 0.0})
        bucket["inflow"] += je_in
        bucket["outflow"] += je_out
        txns.append({
            "je_id": je["id"], "doc_no": je.get("doc_no"),
            "entry_date": d, "description": je.get("description"),
            "source_type": src, "category": cat,
            "inflow": round(je_in, 2), "outflow": round(je_out, 2),
            "net": round(je_in - je_out, 2),
        })

    # Build daily list with running balance
    daily_list = sorted(daily.values(), key=lambda r: r["date"])
    running = opening
    for bucket in daily_list:
        running += bucket["inflow"] - bucket["outflow"]
        bucket["balance"] = round(running, 2)
        bucket["inflow"] = round(bucket["inflow"], 2)
        bucket["outflow"] = round(bucket["outflow"], 2)

    closing = running
    net_flow = closing - opening

    # Round
    for k, v in by_cat.items():
        v["inflow"] = round(v["inflow"], 2)
        v["outflow"] = round(v["outflow"], 2)
        v["net"] = round(v["net"], 2)
        v["rows"].sort(key=lambda r: r["entry_date"], reverse=True)

    return {
        "period": period,
        "start_date": start, "end_date": end,
        "dim_outlet": dim_outlet,
        "opening_balance": round(opening, 2),
        "closing_balance": round(closing, 2),
        "net_flow": round(net_flow, 2),
        "by_category": by_cat,
        "daily": daily_list,
        "transactions": sorted(txns, key=lambda r: (r["entry_date"], r.get("doc_no") or ""), reverse=True)[:500],
    }

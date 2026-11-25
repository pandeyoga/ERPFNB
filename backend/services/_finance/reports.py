"""Trial Balance and Profit & Loss reports."""
from __future__ import annotations

from typing import Optional

from core.db import get_db
from services._finance.balances import _aggregate_balance, _prev_period, is_debit_normal


_PL_CATEGORIES = {
    "revenue": ["pendapatan", "revenue", "income", "sales"],
    "cogs": ["hpp", "cogs", "harga pokok", "cost of goods"],
    "expense": ["beban", "expense", "biaya", "operating"],
}


def pl_section(coa: dict) -> Optional[str]:
    """Bagian P&L sebuah akun: revenue | cogs | expense | None (bukan akun laba rugi)."""
    cat = (coa.get("category") or coa.get("type") or "").lower()
    if any(k in cat for k in _PL_CATEGORIES["revenue"]):
        return "revenue"
    if any(k in cat for k in _PL_CATEGORIES["cogs"]):
        return "cogs"
    if any(k in cat for k in _PL_CATEGORIES["expense"]):
        return "expense"
    return None


async def trial_balance(
    *,
    period: str,
    outlet_id: Optional[str] = None,
    dim_outlet: Optional[str] = None,
    scope=None,
) -> dict:
    """Compute Trial Balance for the given period."""
    if dim_outlet and not outlet_id:
        outlet_id = dim_outlet
    db = get_db()
    all_coa = await db.chart_of_accounts.find({"deleted_at": None}).to_list(None)
    coa_ids = [c["id"] for c in all_coa]
    balances = await _aggregate_balance(coa_ids, period, outlet_id=outlet_id, scope=scope)

    rows = []
    total_period_dr = total_period_cr = total_cumul_dr = total_cumul_cr = 0.0

    for coa in sorted(all_coa, key=lambda x: x.get("code", "")):
        coa_id = coa["id"]
        b = balances.get(coa_id, {})
        period_dr = round(b.get("period_dr", 0), 2)
        period_cr = round(b.get("period_cr", 0), 2)
        cumul_dr = round(b.get("cumulative_dr", 0), 2)
        cumul_cr = round(b.get("cumulative_cr", 0), 2)
        if period_dr == 0 and period_cr == 0 and cumul_dr == 0 and cumul_cr == 0:
            continue

        normal_balance = coa.get("normal_balance", "debit")
        if is_debit_normal(normal_balance):
            balance_cumul = round(cumul_dr - cumul_cr, 2)
        else:
            balance_cumul = round(cumul_cr - cumul_dr, 2)

        period_net = (period_dr - period_cr) if is_debit_normal(normal_balance) else (period_cr - period_dr)
        rows.append({
            "coa_id": coa_id, "code": coa.get("code"), "name": coa.get("name"),
            "category": coa.get("category"), "normal_balance": normal_balance,
            "type": (coa.get("type") or coa.get("category") or "other"),
            "opening": round(balance_cumul - period_net, 2),
            "closing": balance_cumul,
            "period_dr": period_dr, "period_cr": period_cr,
            "cumulative_dr": cumul_dr, "cumulative_cr": cumul_cr,
            "balance_cumulative": balance_cumul,
        })
        total_period_dr += period_dr
        total_period_cr += period_cr
        total_cumul_dr += cumul_dr
        total_cumul_cr += cumul_cr

    return {
        "period": period,
        "outlet_id": outlet_id,
        "rows": rows,
        "totals": {
            "period_dr": round(total_period_dr, 2),
            "period_cr": round(total_period_cr, 2),
            "cumulative_dr": round(total_cumul_dr, 2),
            "cumulative_cr": round(total_cumul_cr, 2),
            "opening_dr": round(total_cumul_dr - total_period_dr, 2),
            "opening_cr": round(total_cumul_cr - total_period_cr, 2),
            "closing_dr": round(total_cumul_dr, 2),
            "closing_cr": round(total_cumul_cr, 2),
            "is_balanced_period": abs(total_period_dr - total_period_cr) < 0.01,
            "is_balanced_cumul": abs(total_cumul_dr - total_cumul_cr) < 0.01,
        },
    }


async def profit_loss(
    *,
    period: str,
    compare_prev: bool = True,
    outlet_id: Optional[str] = None,
    dim_outlet: Optional[str] = None,
    scope=None,
) -> dict:
    """P&L for the given period, with optional prior-period comparison."""
    if dim_outlet and not outlet_id:
        outlet_id = dim_outlet
    db = get_db()
    all_coa = await db.chart_of_accounts.find({"deleted_at": None}).to_list(None)
    coa_ids = [c["id"] for c in all_coa]

    current_balances = await _aggregate_balance(coa_ids, period, outlet_id=outlet_id, scope=scope)
    prev_balances: dict = {}
    prev_period = _prev_period(period)
    if compare_prev:
        prev_balances = await _aggregate_balance(coa_ids, prev_period, period_only=True, outlet_id=outlet_id, scope=scope)

    def _get_period_net(b: dict, normal: str) -> float:
        if not is_debit_normal(normal):
            return b.get("period_cr", 0) - b.get("period_dr", 0)
        return b.get("period_dr", 0) - b.get("period_cr", 0)

    revenue_rows, cogs_rows, expense_rows = [], [], []
    total_revenue = total_revenue_prev = 0.0
    total_cogs = total_cogs_prev = 0.0
    total_expense = total_expense_prev = 0.0

    for coa in sorted(all_coa, key=lambda x: x.get("code", "")):
        section = pl_section(coa)
        if section is None:
            continue
        is_revenue, is_cogs = section == "revenue", section == "cogs"
        b = current_balances.get(coa["id"], {})
        bp = prev_balances.get(coa["id"], {}) if compare_prev else {}
        # FIN-06: sign follows the P&L SECTION, not the account's normal balance — a contra-revenue
        # account (4010 Discount, normal Dr) must REDUCE revenue (cr−dr < 0), not be added to it.
        normal = "credit" if is_revenue else "debit"
        period_net = round(_get_period_net(b, normal), 2)
        prev_net = round(_get_period_net(bp, normal), 2) if compare_prev else None
        if period_net == 0 and (not compare_prev or prev_net == 0):
            continue
        row = {"coa_id": coa["id"], "code": coa.get("code"), "name": coa.get("name"),
               "amount": period_net, "period": period_net, "prev_period": prev_net}
        if is_revenue:
            revenue_rows.append(row)
            total_revenue += period_net
            total_revenue_prev += prev_net or 0
        elif is_cogs:
            cogs_rows.append(row)
            total_cogs += period_net
            total_cogs_prev += prev_net or 0
        else:
            expense_rows.append(row)
            total_expense += period_net
            total_expense_prev += prev_net or 0

    net_income = round(total_revenue - total_cogs - total_expense, 2)
    net_prev = round(total_revenue_prev - total_cogs_prev - total_expense_prev, 2) if compare_prev else None
    def _section(key: str, label: str, rows: list, total: float, prev: float) -> dict:
        return {"key": key, "label": label, "rows": rows, "total": round(total, 2),
                "prev_total": round(prev, 2) if compare_prev else None}

    return {
        "period": period,
        "outlet_id": outlet_id,
        "sections": [
            _section("revenue", "Pendapatan", revenue_rows, total_revenue, total_revenue_prev),
            _section("cogs", "HPP", cogs_rows, total_cogs, total_cogs_prev),
            _section("expense", "Beban", expense_rows, total_expense, total_expense_prev),
        ],
        "prev_period": prev_period if compare_prev else None,
        "revenue": {"rows": revenue_rows, "total": round(total_revenue, 2), "prev_total": round(total_revenue_prev, 2) if compare_prev else None},
        "cogs": {"rows": cogs_rows, "total": round(total_cogs, 2), "prev_total": round(total_cogs_prev, 2) if compare_prev else None},
        "expense": {"rows": expense_rows, "total": round(total_expense, 2), "prev_total": round(total_expense_prev, 2) if compare_prev else None},
        "net_income": net_income,
        "net_income_prev": net_prev,
    }


PUSAT = "__pusat__"
_SECTION_LABELS = {"revenue": "Pendapatan", "cogs": "HPP", "expense": "Beban"}


async def profit_loss_breakdown(*, period: str, by: str = "brand", scope=None) -> dict:
    """P&L satu periode dengan kolom per brand atau per toko, dalam cakupan `scope` (DESIGN_SYSTEM §10.7).

    Kolom "Pusat" memuat baris tanpa toko (dan, untuk `by=outlet`, baris tingkat brand) bila cakupan memuatnya.
    Jumlah semua kolom = P&L cakupan itu.
    """
    from services._finance.scope import coerce_scope

    scope = coerce_scope(scope)
    db = get_db()
    outlets = await db.outlets.find({"deleted_at": None}, {"_id": 0, "id": 1, "name": 1, "brand_id": 1}).to_list(None)
    brands = await db.brands.find({"deleted_at": None}, {"_id": 0, "id": 1, "name": 1}).to_list(None)
    outlet_brand = {o["id"]: o.get("brand_id") for o in outlets}
    coas = {c["id"]: c for c in await db.chart_of_accounts.find({"deleted_at": None}).to_list(None)}

    pipeline: list[dict] = [
        {"$match": {"deleted_at": None, "status": "posted", "period": period}},
        {"$unwind": "$lines"},
    ]
    if scope.line_match():
        pipeline.append({"$match": scope.line_match()})
    pipeline.append({"$group": {
        "_id": {"coa": "$lines.coa_id", "o": "$lines.dim_outlet", "ho": "$outlet_id", "b": "$lines.dim_brand"},
        "dr": {"$sum": "$lines.dr"}, "cr": {"$sum": "$lines.cr"},
    }})

    cells: dict[tuple[str, str], float] = {}
    for g in await db.journal_entries.aggregate(pipeline).to_list(None):
        coa = coas.get(g["_id"].get("coa"))
        section = pl_section(coa) if coa else None
        if section is None:
            continue
        outlet = g["_id"].get("o") or g["_id"].get("ho") or None
        if by == "outlet":
            key = outlet or PUSAT
        else:
            key = (outlet_brand.get(outlet) if outlet else g["_id"].get("b")) or PUSAT
        net = float(g["cr"]) - float(g["dr"]) if section == "revenue" else float(g["dr"]) - float(g["cr"])
        cells[(coa["id"], key)] = cells.get((coa["id"], key), 0.0) + net

    # Kolom: semua brand/toko dalam cakupan (juga yang nol), lalu Pusat bila ada isinya.
    in_scope = [o for o in outlets if scope.outlet_ids is None or o["id"] in scope.outlet_ids]
    brand_name = {b["id"]: b["name"] for b in brands}
    if by == "outlet":
        columns = [{"key": o["id"], "label": o["name"], "brand": brand_name.get(o.get("brand_id"), "")}
                   for o in sorted(in_scope, key=lambda o: (brand_name.get(o.get("brand_id"), ""), o["name"]))]
    else:
        ids = sorted({o.get("brand_id") for o in in_scope if o.get("brand_id")}, key=lambda b: brand_name.get(b, ""))
        columns = [{"key": b, "label": brand_name.get(b, b)} for b in ids]
    keys = [c["key"] for c in columns]
    if any(k == PUSAT for _, k in cells):
        columns.append({"key": PUSAT, "label": "Pusat"})
        keys.append(PUSAT)

    sections = []
    totals = {k: {"revenue": 0.0, "cogs": 0.0, "expense": 0.0} for k in keys + ["total"]}
    for sec in ("revenue", "cogs", "expense"):
        rows = []
        for coa in sorted((c for c in coas.values() if pl_section(c) == sec), key=lambda c: c.get("code", "")):
            values = {k: round(cells.get((coa["id"], k), 0.0), 2) for k in keys}
            total = round(sum(values.values()), 2)
            if not any(values.values()):
                continue
            rows.append({"coa_id": coa["id"], "code": coa.get("code"), "name": coa.get("name"),
                         "values": values, "total": total})
            for k, v in values.items():
                totals[k][sec] += v
            totals["total"][sec] += total
        sections.append({"key": sec, "label": _SECTION_LABELS[sec], "rows": rows,
                         "totals": {k: round(totals[k][sec], 2) for k in keys + ["total"]}})

    def _summary(field):
        out = {}
        for k in keys + ["total"]:
            t = totals[k]
            out[k] = round(t["revenue"] - t["cogs"] - (t["expense"] if field == "net_income" else 0), 2)
        return out

    return {"period": period, "by": by, "columns": columns, "sections": sections,
            "gross_profit": _summary("gross_profit"), "net_income": _summary("net_income")}

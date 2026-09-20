"""Trial Balance and Profit & Loss reports."""
from __future__ import annotations

from typing import Optional

from core.db import get_db, serialize
from services._finance.balances import _aggregate_balance, _prev_period


async def trial_balance(
    *,
    period: str,
    outlet_id: Optional[str] = None,
    dim_outlet: Optional[str] = None,
) -> dict:
    """Compute Trial Balance for the given period."""
    if dim_outlet and not outlet_id:
        outlet_id = dim_outlet
    db = get_db()
    all_coa = await db.chart_of_accounts.find({"deleted_at": None}).to_list(500)
    coa_ids = [c["id"] for c in all_coa]
    balances = await _aggregate_balance(coa_ids, period)

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
        if normal_balance == "debit":
            balance_cumul = round(cumul_dr - cumul_cr, 2)
        else:
            balance_cumul = round(cumul_cr - cumul_dr, 2)

        rows.append({
            "coa_id": coa_id, "code": coa.get("code"), "name": coa.get("name"),
            "category": coa.get("category"), "normal_balance": normal_balance,
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
        "rows": rows,
        "totals": {
            "period_dr": round(total_period_dr, 2),
            "period_cr": round(total_period_cr, 2),
            "cumulative_dr": round(total_cumul_dr, 2),
            "cumulative_cr": round(total_cumul_cr, 2),
            "is_balanced_period": abs(total_period_dr - total_period_cr) < 0.02,
            "is_balanced_cumul": abs(total_cumul_dr - total_cumul_cr) < 0.02,
        },
    }


async def profit_loss(
    *,
    period: str,
    compare_prev: bool = True,
    outlet_id: Optional[str] = None,
    dim_outlet: Optional[str] = None,
) -> dict:
    """P&L for the given period, with optional prior-period comparison."""
    if dim_outlet and not outlet_id:
        outlet_id = dim_outlet
    db = get_db()
    categories = {
        "revenue": ["pendapatan", "revenue", "income", "sales"],
        "cogs": ["hpp", "cogs", "harga pokok", "cost of goods"],
        "expense": ["beban", "expense", "biaya", "operating"],
    }
    all_coa = await db.chart_of_accounts.find({"deleted_at": None}).to_list(500)
    coa_ids = [c["id"] for c in all_coa]

    current_balances = await _aggregate_balance(coa_ids, period)
    prev_balances: dict = {}
    prev_period = _prev_period(period)
    if compare_prev:
        prev_balances = await _aggregate_balance(coa_ids, prev_period, period_only=True)

    def _get_period_net(b: dict, normal: str) -> float:
        n = (normal or "").lower()
        if n in ("credit", "cr"):
            return b.get("period_cr", 0) - b.get("period_dr", 0)
        return b.get("period_dr", 0) - b.get("period_cr", 0)

    revenue_rows, cogs_rows, expense_rows = [], [], []
    total_revenue = total_revenue_prev = 0.0
    total_cogs = total_cogs_prev = 0.0
    total_expense = total_expense_prev = 0.0

    for coa in sorted(all_coa, key=lambda x: x.get("code", "")):
        cat = (coa.get("category") or coa.get("type") or "").lower()
        is_revenue = any(k in cat for k in categories["revenue"])
        is_cogs = any(k in cat for k in categories["cogs"])
        is_expense = (not is_cogs) and any(k in cat for k in categories["expense"])
        if not (is_revenue or is_cogs or is_expense):
            continue
        b = current_balances.get(coa["id"], {})
        bp = prev_balances.get(coa["id"], {}) if compare_prev else {}
        normal = coa.get("normal_balance") or coa.get("normal") or "debit"
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
    return {
        "period": period,
        "prev_period": prev_period if compare_prev else None,
        "revenue": {"rows": revenue_rows, "total": round(total_revenue, 2), "prev_total": round(total_revenue_prev, 2) if compare_prev else None},
        "cogs": {"rows": cogs_rows, "total": round(total_cogs, 2), "prev_total": round(total_cogs_prev, 2) if compare_prev else None},
        "expense": {"rows": expense_rows, "total": round(total_expense, 2), "prev_total": round(total_expense_prev, 2) if compare_prev else None},
        "net_income": net_income,
        "net_income_prev": net_prev,
    }

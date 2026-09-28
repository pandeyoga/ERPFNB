"""Phase 11D — Profit Walk service.

Provides waterfall (Revenue → COGS → GP → OPEX → Service Charge → Net Profit)
+ period comparison (MTD vs LMTD vs YoY).
"""
import calendar
import logging
from datetime import date, datetime, timezone, timedelta
from typing import Optional

from core.db import get_db
from services.cache_service import cache_or_compute

logger = logging.getLogger("aurora.profit_walk")

# Map account types to walk stages (using account_type field on COA)
STAGE_MAPPING = {
    "revenue": "Revenue",
    "cogs": "COGS",
    "opex": "OPEX",
    "service_charge": "Service Charge",
    "incentive": "Bonus & Incentive",
    "other_income": "Other Income",
    "other_expense": "Other Expense",
    "tax": "Tax",
}


def _resolve_period(period_kind: str, ref: Optional[date] = None) -> tuple[date, date, str]:
    """Return (start, end, label) for a period kind."""
    today = ref or datetime.now(timezone.utc).date()
    if period_kind == "mtd":
        start = today.replace(day=1)
        return start, today, today.strftime("%Y-%m")
    if period_kind == "lmtd":
        last_month_end = today.replace(day=1) - timedelta(days=1)
        start = last_month_end.replace(day=1)
        # Use same day-of-month as today for LMTD
        last_dow = min(today.day, calendar.monthrange(start.year, start.month)[1])
        end = start.replace(day=last_dow)
        return start, end, f"{start.strftime('%Y-%m')} (LMTD-{today.day}d)"
    if period_kind == "qtd":
        q = (today.month - 1) // 3 + 1
        start = today.replace(month=(q - 1) * 3 + 1, day=1)
        return start, today, f"Q{q} {today.year}"
    if period_kind == "ytd":
        start = date(today.year, 1, 1)
        return start, today, f"{today.year} YTD"
    if period_kind == "yoy":
        # Same MTD window in last year
        start = today.replace(year=today.year - 1, day=1)
        last_dow = min(today.day, calendar.monthrange(start.year, start.month)[1])
        end = start.replace(day=last_dow)
        return start, end, f"{start.strftime('%Y-%m')} (YoY-{today.day}d)"
    if period_kind == "last_month":
        last_month_end = today.replace(day=1) - timedelta(days=1)
        start = last_month_end.replace(day=1)
        return start, last_month_end, start.strftime("%Y-%m")
    # Default = today only
    return today, today, today.isoformat()


async def _aggregate_stages(start: date, end: date) -> dict[str, float]:
    """Aggregate posted journal lines by COA account_type within [start, end].

    For revenue/income types we look at credit-net (Cr-Dr).
    For expense types we look at debit-net (Dr-Cr).
    """
    db = get_db()
    pipeline = [
        {"$match": {
            "status": "posted",
            "entry_date": {"$gte": start.isoformat(), "$lte": end.isoformat()},
        }},
        {"$unwind": "$lines"},
        {"$lookup": {
            "from": "chart_of_accounts",
            "localField": "lines.coa_id",
            "foreignField": "id",
            "as": "coa",
        }},
        {"$unwind": {"path": "$coa", "preserveNullAndEmptyArrays": True}},
        {"$group": {
            "_id": "$coa.type",
            "debit": {"$sum": {"$ifNull": ["$lines.dr", 0]}},
            "credit": {"$sum": {"$ifNull": ["$lines.cr", 0]}},
        }},
    ]
    rows = await db.journal_entries.aggregate(pipeline).to_list(50)
    out: dict[str, float] = {}
    for r in rows:
        atype = (r.get("_id") or "unknown").lower()
        cr = float(r.get("credit") or 0)
        dr = float(r.get("debit") or 0)
        if atype in ("revenue", "other_income"):
            out[atype] = out.get(atype, 0) + (cr - dr)
        else:
            out[atype] = out.get(atype, 0) + (dr - cr)
    return out


async def _aggregate_accounts(start: date, end: date) -> dict[str, dict]:
    """Aggregate posted journal lines grouped by individual COA account.

    Returns {coa_id: {coa_id, name, type, value(signed magnitude)}} used to
    build the per-stage drill-down breakdown on the Profit Walk page.
    """
    db = get_db()
    pipeline = [
        {"$match": {
            "status": "posted",
            "entry_date": {"$gte": start.isoformat(), "$lte": end.isoformat()},
        }},
        {"$unwind": "$lines"},
        {"$lookup": {
            "from": "chart_of_accounts",
            "localField": "lines.coa_id",
            "foreignField": "id",
            "as": "coa",
        }},
        {"$unwind": {"path": "$coa", "preserveNullAndEmptyArrays": True}},
        {"$group": {
            "_id": {"coa_id": "$coa.id", "name": "$coa.name", "type": "$coa.type"},
            "debit": {"$sum": {"$ifNull": ["$lines.dr", 0]}},
            "credit": {"$sum": {"$ifNull": ["$lines.cr", 0]}},
        }},
    ]
    rows = await db.journal_entries.aggregate(pipeline).to_list(500)
    out: dict[str, dict] = {}
    for r in rows:
        gid = r.get("_id") or {}
        coa_id = gid.get("coa_id") or gid.get("name") or "unknown"
        atype = (gid.get("type") or "unknown").lower()
        cr = float(r.get("credit") or 0)
        dr = float(r.get("debit") or 0)
        val = (cr - dr) if atype in ("revenue", "other_income") else (dr - cr)
        out[coa_id] = {
            "coa_id": coa_id,
            "name": gid.get("name") or "(Tanpa Akun)",
            "type": atype,
            "value": val,
        }
    return out


# Stage label → COA account_type(s) that roll up into that stage (for drill-down).
_STAGE_ACCOUNT_TYPES = {
    "Revenue": {"revenue"},
    "COGS": {"cogs"},
    "Other Income": {"other_income"},
    "OPEX": {"opex", "expense", "other_expense"},
    "Service Charge": {"service_charge"},
    "Bonus/Incentive": {"incentive"},
    "Tax": {"tax"},
}


@cache_or_compute("profit_walk", ttl_sec=60)
async def compute_profit_walk(
    period_kind: str = "mtd",
    compare_kind: Optional[str] = "lmtd",
) -> dict:
    """Returns waterfall stages + compare period deltas."""
    p_start, p_end, p_label = _resolve_period(period_kind)
    p_data = await _aggregate_stages(p_start, p_end)
    p_accts = await _aggregate_accounts(p_start, p_end)

    cmp_data: dict[str, float] = {}
    c_accts: dict[str, dict] = {}
    cmp_label = None
    if compare_kind:
        c_start, c_end, c_label = _resolve_period(compare_kind)
        cmp_data = await _aggregate_stages(c_start, c_end)
        c_accts = await _aggregate_accounts(c_start, c_end)
        cmp_label = c_label

    revenue = p_data.get("revenue", 0)
    cogs = p_data.get("cogs", 0)
    other_income = p_data.get("other_income", 0)
    gross_profit = revenue - cogs + other_income
    opex = p_data.get("opex", 0) + p_data.get("expense", 0) + p_data.get("other_expense", 0)
    service_charge = p_data.get("service_charge", 0)
    incentive = p_data.get("incentive", 0)
    tax = p_data.get("tax", 0)
    net_profit = gross_profit - opex - service_charge - incentive - tax

    cmp_revenue = cmp_data.get("revenue", 0)
    cmp_cogs = cmp_data.get("cogs", 0)
    cmp_other_income = cmp_data.get("other_income", 0)
    cmp_gp = cmp_revenue - cmp_cogs + cmp_other_income
    cmp_opex = cmp_data.get("opex", 0) + cmp_data.get("expense", 0) + cmp_data.get("other_expense", 0)
    cmp_service = cmp_data.get("service_charge", 0)
    cmp_incentive = cmp_data.get("incentive", 0)
    cmp_tax = cmp_data.get("tax", 0)
    cmp_net = cmp_gp - cmp_opex - cmp_service - cmp_incentive - cmp_tax

    def pct(curr: float, prev: float) -> Optional[float]:
        if not prev:
            return None
        return round(((curr - prev) / abs(prev)) * 100, 1)

    stages = [
        {"label": "Revenue",         "value": revenue,        "compare": cmp_revenue,   "delta_pct": pct(revenue, cmp_revenue),       "kind": "positive", "running": revenue},
        {"label": "COGS",            "value": -cogs,          "compare": -cmp_cogs,     "delta_pct": pct(cogs, cmp_cogs),             "kind": "negative", "running": revenue - cogs},
        {"label": "Other Income",    "value": other_income,   "compare": cmp_other_income, "delta_pct": pct(other_income, cmp_other_income), "kind": "positive", "running": gross_profit},
        {"label": "Gross Profit",    "value": gross_profit,   "compare": cmp_gp,        "delta_pct": pct(gross_profit, cmp_gp),       "kind": "subtotal", "running": gross_profit},
        {"label": "OPEX",            "value": -opex,          "compare": -cmp_opex,     "delta_pct": pct(opex, cmp_opex),             "kind": "negative", "running": gross_profit - opex},
        {"label": "Service Charge",  "value": -service_charge, "compare": -cmp_service,  "delta_pct": pct(service_charge, cmp_service), "kind": "negative", "running": gross_profit - opex - service_charge},
        {"label": "Bonus/Incentive", "value": -incentive,     "compare": -cmp_incentive, "delta_pct": pct(incentive, cmp_incentive),  "kind": "negative", "running": gross_profit - opex - service_charge - incentive},
        {"label": "Tax",             "value": -tax,           "compare": -cmp_tax,      "delta_pct": pct(tax, cmp_tax),               "kind": "negative", "running": gross_profit - opex - service_charge - incentive - tax},
        {"label": "Net Profit",      "value": net_profit,     "compare": cmp_net,       "delta_pct": pct(net_profit, cmp_net),        "kind": "total",    "running": net_profit},
    ]

    # Per-stage drill-down breakdown (individual COA accounts)
    def _build_breakdown(types: set[str]) -> list[dict]:
        keys = {k for k, a in p_accts.items() if a["type"] in types}
        keys |= {k for k, a in c_accts.items() if a["type"] in types}
        items = []
        for k in keys:
            pa = p_accts.get(k)
            ca = c_accts.get(k)
            name = (pa or ca)["name"]
            pv = abs(pa["value"]) if pa else 0
            cv = abs(ca["value"]) if ca else 0
            if pv == 0 and cv == 0:
                continue
            items.append({"label": name, "period": pv, "compare": cv, "delta_pct": pct(pv, cv)})
        items.sort(key=lambda x: x["period"], reverse=True)
        return items

    for s in stages:
        s["breakdown"] = _build_breakdown(_STAGE_ACCOUNT_TYPES[s["label"]]) if s["label"] in _STAGE_ACCOUNT_TYPES else []

    # Drivers (top 3 stages by absolute delta)
    drivers = []
    for s in stages:
        if s["kind"] == "subtotal" or s["kind"] == "total":
            continue
        delta = abs(s["value"] - s["compare"])
        drivers.append({"label": s["label"], "delta": s["value"] - s["compare"],
                         "abs_delta": delta, "delta_pct": s["delta_pct"]})
    drivers.sort(key=lambda x: x["abs_delta"], reverse=True)

    return {
        "period": {"kind": period_kind, "label": p_label,
                     "start": p_start.isoformat(), "end": p_end.isoformat()},
        "compare": {"kind": compare_kind, "label": cmp_label} if compare_kind else None,
        "stages": stages,
        "summary": {
            "revenue": revenue,
            "gross_profit": gross_profit,
            "net_profit": net_profit,
            "compare_net_profit": cmp_net,
            "net_delta_pct": pct(net_profit, cmp_net),
            "gp_margin_pct": round((gross_profit / revenue * 100), 1) if revenue else None,
            "net_margin_pct": round((net_profit / revenue * 100), 1) if revenue else None,
        },
        "top_drivers": drivers[:5],
    }


@cache_or_compute("period_compare", ttl_sec=60)
async def compute_period_compare(
    metrics: list[str], period_kinds: list[str],
) -> dict:
    """Compare multiple metrics across multiple periods. Returns a matrix."""
    METRIC_KEYS = {
        "revenue":        lambda d: d.get("revenue", 0),
        "cogs":           lambda d: d.get("cogs", 0),
        "gross_profit":   lambda d: d.get("revenue", 0) - d.get("cogs", 0) + d.get("other_income", 0),
        "opex":           lambda d: d.get("opex", 0) + d.get("expense", 0) + d.get("other_expense", 0),
        "service_charge": lambda d: d.get("service_charge", 0),
        "net_profit":     lambda d: (d.get("revenue", 0) - d.get("cogs", 0) + d.get("other_income", 0)
                                       - d.get("opex", 0) - d.get("expense", 0) - d.get("other_expense", 0)
                                       - d.get("service_charge", 0) - d.get("incentive", 0) - d.get("tax", 0)),
    }
    rows = []
    cache: dict[str, dict] = {}
    period_meta: list[dict] = []
    for pk in period_kinds:
        if pk not in cache:
            ps, pe, pl = _resolve_period(pk)
            cache[pk] = await _aggregate_stages(ps, pe)
            period_meta.append({"kind": pk, "label": pl,
                                  "start": ps.isoformat(), "end": pe.isoformat()})
    for m in metrics:
        if m not in METRIC_KEYS:
            continue
        row = {"metric": m, "values": {}}
        for pk in period_kinds:
            row["values"][pk] = round(METRIC_KEYS[m](cache[pk]), 2)
        rows.append(row)
    return {
        "periods": period_meta,
        "metrics": rows,
    }

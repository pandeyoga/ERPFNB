"""Budget vs Actual computations — multi-scope (outlet/brand/group)."""
from __future__ import annotations

from typing import Optional

from core.db import get_db
from models.budget import BUDGET_CATEGORIES

from services._budget._common import guess_category


async def _get_outlet_ids_for_brand(brand_id: str) -> list[str]:
    db = get_db()
    outlets = await db.outlets.find({"brand_id": brand_id, "deleted_at": None}).to_list(50)
    return [o["id"] for o in outlets]


async def _get_actuals_by_coa(
    period: str,
    outlet_ids: Optional[list[str]] = None,
) -> dict[str, float]:
    """Sum JE actuals for a period, optionally filtered by outlet(s)."""
    db = get_db()
    actual_by_coa: dict[str, float] = {}
    q: dict = {"period": period, "status": "posted", "deleted_at": None}
    if outlet_ids is not None:
        q["outlet_id"] = {"$in": outlet_ids}
    async for je in db.journal_entries.find(q):
        for line in je.get("lines", []):
            coa_id = line.get("coa_id")
            if not coa_id:
                continue
            net = float(line.get("dr", 0)) - float(line.get("cr", 0))
            actual_by_coa[coa_id] = actual_by_coa.get(coa_id, 0) + net
    return actual_by_coa


async def vs_actual(
    period: str,
    *,
    outlet_id: Optional[str] = None,
    brand_id: Optional[str] = None,
    scope: str = "outlet",
    level: str = "both",  # coa | category | both
) -> dict:
    """Compute budget vs actual for a period at the requested scope."""
    db = get_db()

    # Determine outlet_ids for actuals
    outlet_ids: Optional[list[str]] = None
    if scope == "outlet" and outlet_id:
        outlet_ids = [outlet_id]
    elif scope == "brand" and brand_id:
        outlet_ids = await _get_outlet_ids_for_brand(brand_id)
    # scope == "group" → outlet_ids remains None → all outlets

    # Get budget docs for this scope/period
    q_bud: dict = {"period": period, "deleted_at": None, "status": "active",
                   "approval_status": {"$in": ["approved", "locked", "submitted"]}}
    # fallback: also include drafts if no approved/locked exists
    if scope == "outlet":
        q_bud["scope"] = "outlet"
        if outlet_id:
            q_bud["outlet_id"] = outlet_id
    elif scope == "brand":
        q_bud["scope"] = "brand"
        if brand_id:
            q_bud["brand_id"] = brand_id
    else:
        q_bud["scope"] = "group"

    budget_docs = await db.budgets.find(q_bud).to_list(20)
    # Fallback to any status if no approved/locked
    if not budget_docs:
        q_bud.pop("approval_status", None)
        budget_docs = await db.budgets.find(q_bud).to_list(20)

    # Extract budget amounts
    budget_by_coa: dict[str, float] = {}
    for bdoc in budget_docs:
        for line in bdoc.get("lines", []):
            coa_id = line["coa_id"]
            # Use monthly_amounts if period matches
            if "monthly_amounts" in line and line["monthly_amounts"].get(period):
                amount = float(line["monthly_amounts"][period])
            else:
                amount = float(line.get("amount", 0))
            budget_by_coa[coa_id] = budget_by_coa.get(coa_id, 0) + amount

    # Get actuals
    actual_by_coa = await _get_actuals_by_coa(period, outlet_ids)

    # Build COA-level comparison
    all_coa_ids = set(list(budget_by_coa.keys()) + list(actual_by_coa.keys()))
    # B3 fix: batch-lookup all COA docs at once (was N+1 find_one per coa_id)
    coa_docs_raw = await db.chart_of_accounts.find(
        {"id": {"$in": list(all_coa_ids)}, "deleted_at": None},
        {"id": 1, "code": 1, "name": 1, "_id": 0}
    ).to_list(len(all_coa_ids) + 1)
    coa_lookup = {c["id"]: c for c in coa_docs_raw}
    coa_level = []
    for coa_id in all_coa_ids:
        coa_doc = coa_lookup.get(coa_id)
        if not coa_doc:
            continue
        budget_amt = budget_by_coa.get(coa_id, 0)
        actual_amt = actual_by_coa.get(coa_id, 0)
        variance = actual_amt - budget_amt
        variance_pct = (variance / budget_amt * 100) if budget_amt != 0 else None
        cat = guess_category(coa_doc.get("code", ""))
        is_revenue = cat == "REV"
        coa_level.append({
            "coa_id": coa_id,
            "coa_code": coa_doc.get("code"),
            "coa_name": coa_doc.get("name"),
            "category": cat,
            "budget": round(budget_amt, 2),
            "actual": round(actual_amt, 2),
            "variance": round(variance, 2),
            "variance_pct": round(variance_pct, 1) if variance_pct is not None else None,
            # For revenue: over means actual > budget = good; for expense: over = bad
            "achievement": round(actual_amt / budget_amt * 100, 1) if budget_amt != 0 else None,
            "flag": "good" if (is_revenue and actual_amt >= budget_amt) or (not is_revenue and actual_amt <= budget_amt) else "warn",
        })
    coa_level.sort(key=lambda x: x["coa_code"] or "")

    # Category rollup
    cat_rollup: dict[str, dict] = {}
    for row in coa_level:
        cat = row["category"]
        if cat not in cat_rollup:
            cat_rollup[cat] = {"category": cat, "name": cat, "budget": 0.0, "actual": 0.0}
        cat_rollup[cat]["budget"] += row["budget"]
        cat_rollup[cat]["actual"] += row["actual"]

    # Add category names
    cat_names = {c["code"]: c["name"] for c in BUDGET_CATEGORIES if not c.get("derived")}
    for cat, row in cat_rollup.items():
        row["name"] = cat_names.get(cat, cat)
        row["variance"] = round(row["actual"] - row["budget"], 2)
        row["variance_pct"] = round(row["variance"] / row["budget"] * 100, 1) if row["budget"] != 0 else None
        row["achievement"] = round(row["actual"] / row["budget"] * 100, 1) if row["budget"] != 0 else None
        row["budget"] = round(row["budget"], 2)
        row["actual"] = round(row["actual"], 2)
        is_rev = cat == "REV"
        row["flag"] = "good" if (is_rev and row["actual"] >= row["budget"]) or (not is_rev and row["actual"] <= row["budget"]) else "warn"

    # Derived categories: GROSS = REV - COGS, EBITDA = GROSS - OPEX - PAYROLL - MKTG, NET = EBITDA - DEP - TAX
    def _d(cat: str) -> dict:
        return cat_rollup.get(cat, {"budget": 0, "actual": 0})

    gross_budget = _d("REV")["budget"] - _d("COGS")["budget"]
    gross_actual = _d("REV")["actual"] - _d("COGS")["actual"]
    ebitda_budget = gross_budget - _d("OPEX")["budget"] - _d("PAYROLL")["budget"] - _d("MKTG")["budget"]
    ebitda_actual = gross_actual - _d("OPEX")["actual"] - _d("PAYROLL")["actual"] - _d("MKTG")["actual"]
    net_budget = ebitda_budget - _d("DEP")["budget"] - _d("TAX")["budget"]
    net_actual = ebitda_actual - _d("DEP")["actual"] - _d("TAX")["actual"]

    derived = [
        {"category": "GROSS", "name": "Gross Profit", "budget": round(gross_budget, 2), "actual": round(gross_actual, 2),
         "variance": round(gross_actual - gross_budget, 2),
         "variance_pct": round((gross_actual - gross_budget) / gross_budget * 100, 1) if gross_budget else None,
         "achievement": round(gross_actual / gross_budget * 100, 1) if gross_budget else None,
         "derived": True},
        {"category": "EBITDA", "name": "EBITDA", "budget": round(ebitda_budget, 2), "actual": round(ebitda_actual, 2),
         "variance": round(ebitda_actual - ebitda_budget, 2),
         "variance_pct": round((ebitda_actual - ebitda_budget) / ebitda_budget * 100, 1) if ebitda_budget else None,
         "achievement": round(ebitda_actual / ebitda_budget * 100, 1) if ebitda_budget else None,
         "derived": True},
        {"category": "NET", "name": "Net Income", "budget": round(net_budget, 2), "actual": round(net_actual, 2),
         "variance": round(net_actual - net_budget, 2),
         "variance_pct": round((net_actual - net_budget) / net_budget * 100, 1) if net_budget else None,
         "achievement": round(net_actual / net_budget * 100, 1) if net_budget else None,
         "derived": True},
    ]

    # Sort category rollup by BUDGET_CATEGORIES order
    cat_order = [c["code"] for c in BUDGET_CATEGORIES]
    cat_rows_base = sorted(
        cat_rollup.values(),
        key=lambda x: cat_order.index(x["category"]) if x["category"] in cat_order else 99
    )
    # Inject derived categories at the right positions
    final_cat = []
    gross_inserted = ebitda_inserted = net_inserted = False
    for row in cat_rows_base:
        final_cat.append(row)
        if row["category"] == "COGS" and not gross_inserted:
            final_cat.append(derived[0])
            gross_inserted = True
        elif row["category"] == "MKTG" and not ebitda_inserted:
            final_cat.append(derived[1])
            ebitda_inserted = True
        elif row["category"] == "TAX" and not net_inserted:
            final_cat.append(derived[2])
            net_inserted = True
    if not net_inserted:
        final_cat.append(derived[2])
    if not ebitda_inserted:
        final_cat.insert(-1, derived[1])

    return {
        "period": period,
        "scope": scope,
        "outlet_id": outlet_id,
        "brand_id": brand_id,
        "coa_level": coa_level if level in ("coa", "both") else [],
        "category_rollup": final_cat if level in ("category", "both") else [],
        "total_budget": round(sum(r["budget"] for r in coa_level), 2),
        "total_actual": round(sum(r["actual"] for r in coa_level), 2),
        "total_variance": round(sum(r["variance"] for r in coa_level), 2),
        "has_budget": bool(budget_docs),
    }


async def vs_actual_multi_outlet(
    period: str,
    brand_id: Optional[str] = None,
) -> dict:
    """Compare budget vs actual per outlet side by side (brand or all)."""
    db = get_db()
    q = {"deleted_at": None}
    if brand_id:
        q["brand_id"] = brand_id
    outlets = await db.outlets.find(q).to_list(50)
    results = []
    for outlet in outlets:
        r = await vs_actual(period, outlet_id=outlet["id"], scope="outlet")
        results.append({
            "outlet_id": outlet["id"],
            "outlet_name": outlet.get("name"),
            "brand_id": outlet.get("brand_id"),
            "total_budget": r["total_budget"],
            "total_actual": r["total_actual"],
            "total_variance": r["total_variance"],
            "achievement_pct": round(r["total_actual"] / r["total_budget"] * 100, 1) if r["total_budget"] else None,
            "has_budget": r["has_budget"],
            "category_rollup": r["category_rollup"],
        })
    return {"period": period, "brand_id": brand_id, "outlets": results}

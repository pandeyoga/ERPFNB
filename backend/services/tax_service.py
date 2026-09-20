"""Tax Service — Sprint 1 Indonesian Compliance 2026.

Handles:
1. PPN (PPN 12%) configuration & calculation
2. PPh 21 (progressive employee withholding)
3. PPh 23 (vendor service withholding — 2% default)
4. PPh 4(2) (final tax on rent/constructions — 10% default)
5. Withholding transaction CRUD
6. Monthly summary reports

All tax behaviour is TOGGLED via system settings (TAX_*_ENABLED).
When disabled, returns 0 withholding and no JE is created.
"""
from __future__ import annotations

import logging
from typing import Optional

from core.constants import PPN_DEFAULT_RATE
from core.db import get_db, serialize
from models.tax import (
    PPH21_BRACKETS, PPH23_SERVICE_TYPES, PPH42_SERVICE_TYPES,
    PPH_TYPES, PTKP_BY_STATUS, PTKP_DEFAULT,
)
from services.system_settings_service import get_value

logger = logging.getLogger("aurora.tax")


# ─────────────────────────────────────────
# 1. RUNTIME CONFIG HELPERS
# ─────────────────────────────────────────

async def get_tax_config() -> dict:
    """Return all tax configuration from system settings."""
    raw_ppn_rate = await get_value("TAX_PPN_RATE") or str(PPN_DEFAULT_RATE)
    raw_pph23_rate = await get_value("TAX_PPH23_RATE") or "0.02"
    raw_pph42_rate = await get_value("TAX_PPH42_RATE") or "0.10"
    return {
        "ppn": {
            "enabled": (await get_value("TAX_PPN_ENABLED") or "true").lower() in ("true", "1", "yes"),
            "rate": float(raw_ppn_rate),
            "rate_pct": round(float(raw_ppn_rate) * 100, 4),
            "label": f"PPN {round(float(raw_ppn_rate)*100)}%",
        },
        "pph21": {
            "enabled": (await get_value("TAX_PPH21_ENABLED") or "false").lower() in ("true", "1", "yes"),
            "method": await get_value("TAX_PPH21_METHOD") or "gross",
            "brackets": [
                {"lower": b[0], "upper": None if b[1] == float("inf") else b[1], "rate": b[2], "rate_pct": round(b[2]*100, 0)}
                for b in PPH21_BRACKETS
            ],
        },
        "pph23": {
            "enabled": (await get_value("TAX_PPH23_ENABLED") or "false").lower() in ("true", "1", "yes"),
            "rate": float(raw_pph23_rate),
            "rate_pct": round(float(raw_pph23_rate) * 100, 4),
            "service_types": PPH23_SERVICE_TYPES,
        },
        "pph42": {
            "enabled": (await get_value("TAX_PPH42_ENABLED") or "false").lower() in ("true", "1", "yes"),
            "rate": float(raw_pph42_rate),
            "rate_pct": round(float(raw_pph42_rate) * 100, 4),
            "service_types": PPH42_SERVICE_TYPES,
        },
    }


async def is_ppn_enabled() -> bool:
    v = await get_value("TAX_PPN_ENABLED")
    return (v or "true").lower() in ("true", "1", "yes")


async def get_ppn_rate() -> float:
    v = await get_value("TAX_PPN_RATE")
    try:
        return float(v or str(PPN_DEFAULT_RATE))
    except (ValueError, TypeError):
        return PPN_DEFAULT_RATE


async def is_pph_enabled(pph_type: str) -> bool:
    key = {"pph21": "TAX_PPH21_ENABLED", "pph23": "TAX_PPH23_ENABLED", "pph42": "TAX_PPH42_ENABLED"}.get(pph_type)
    if not key:
        return False
    v = await get_value(key)
    return (v or "false").lower() in ("true", "1", "yes")


# ─────────────────────────────────────────
# 2. PPN CALCULATION
# ─────────────────────────────────────────

async def calc_ppn(gross_amount: float) -> dict:
    """Calculate PPN for a given gross amount."""
    enabled = await is_ppn_enabled()
    if not enabled:
        return {"enabled": False, "rate": 0, "ppn_amount": 0, "total_with_ppn": gross_amount}
    rate = await get_ppn_rate()
    ppn_amount = round(gross_amount * rate, 2)
    return {
        "enabled": True,
        "rate": rate,
        "rate_pct": round(rate * 100, 2),
        "gross_amount": gross_amount,
        "ppn_amount": ppn_amount,
        "total_with_ppn": round(gross_amount + ppn_amount, 2),
    }


# ─────────────────────────────────────────
# 3. PPh 21 ENGINE
# ─────────────────────────────────────────

def calc_pph21_annual(annual_pkp: float) -> float:
    """Calculate annual PPh 21 on PKP using progressive brackets (UU HPP 7/2021).

    annual_pkp = annual gross income - PTKP
    Returns annual tax amount.
    """
    if annual_pkp <= 0:
        return 0.0
    tax = 0.0
    for lower, upper, rate in PPH21_BRACKETS:
        if annual_pkp <= lower:
            break
        taxable_in_bracket = min(annual_pkp, upper) - lower
        tax += taxable_in_bracket * rate
    return round(tax, 2)


def calc_pph21_monthly(
    monthly_gross: float,
    ptkp_status: str = "TK/0",
    months_worked: int = 12,
) -> dict:
    """Calculate monthly PPh 21 withholding.

    Uses annual projection method:
    1. Project annual income = monthly_gross * months_remaining
    2. Subtract PTKP
    3. Apply progressive brackets
    4. Divide by 12 to get monthly amount
    """
    ptkp = PTKP_BY_STATUS.get(ptkp_status, PTKP_DEFAULT)
    annual_gross = monthly_gross * 12
    annual_pkp = max(0.0, annual_gross - ptkp)
    annual_tax = calc_pph21_annual(annual_pkp)
    monthly_tax = round(annual_tax / 12, 2)
    return {
        "monthly_gross": monthly_gross,
        "ptkp_status": ptkp_status,
        "ptkp_annual": ptkp,
        "annual_gross": annual_gross,
        "annual_pkp": annual_pkp,
        "annual_tax": annual_tax,
        "monthly_tax": monthly_tax,
        "effective_rate": round(monthly_tax / monthly_gross * 100, 2) if monthly_gross else 0,
    }


async def calc_pph21_for_payroll(payroll: dict) -> dict:
    """Calculate PPh 21 for an entire payroll run.

    Expects payroll to have employee_lines with:
        - employee_id, monthly_gross, ptkp_status (optional, default TK/0)

    Returns {
        total_pph21: float,
        employee_details: [...]
    }
    """
    enabled = await is_pph_enabled("pph21")
    if not enabled:
        return {"enabled": False, "total_pph21": 0.0, "employee_details": []}

    details = []
    total = 0.0
    for emp in payroll.get("employee_lines", []):
        gross = float(emp.get("gross_salary", 0) or 0)
        ptkp = emp.get("ptkp_status", "TK/0")
        calc = calc_pph21_monthly(gross, ptkp)
        total += calc["monthly_tax"]
        details.append({
            "employee_id": emp.get("employee_id"),
            "employee_name": emp.get("employee_name"),
            **calc,
        })

    return {"enabled": True, "total_pph21": round(total, 2), "employee_details": details}


# ─────────────────────────────────────────
# 4. PPh 23 ENGINE
# ─────────────────────────────────────────

async def calc_pph23(gross_amount: float, service_type: str = "jasa") -> dict:
    """Calculate PPh 23 withholding."""
    enabled = await is_pph_enabled("pph23")
    if not enabled:
        return {"enabled": False, "wh_type": "pph23", "wh_amount": 0, "net_amount": gross_amount}

    # Find service type rate (fall back to default from settings)
    st = next((s for s in PPH23_SERVICE_TYPES if s["code"] == service_type), None)
    if st:
        rate = st["rate"]
    else:
        raw = await get_value("TAX_PPH23_RATE") or "0.02"
        rate = float(raw)

    wh_amount = round(gross_amount * rate, 2)
    return {
        "enabled": True,
        "wh_type": "pph23",
        "service_type": service_type,
        "service_label": (st or {}).get("label", service_type),
        "rate": rate,
        "rate_pct": round(rate * 100, 2),
        "gross_amount": gross_amount,
        "wh_amount": wh_amount,
        "net_amount": round(gross_amount - wh_amount, 2),
    }


# ─────────────────────────────────────────
# 5. PPh 4(2) ENGINE
# ─────────────────────────────────────────

async def calc_pph42(gross_amount: float, service_type: str = "sewa_bangunan") -> dict:
    """Calculate PPh 4 ayat 2 withholding."""
    enabled = await is_pph_enabled("pph42")
    if not enabled:
        return {"enabled": False, "wh_type": "pph42", "wh_amount": 0, "net_amount": gross_amount}

    st = next((s for s in PPH42_SERVICE_TYPES if s["code"] == service_type), None)
    if st:
        rate = st["rate"]
    else:
        raw = await get_value("TAX_PPH42_RATE") or "0.10"
        rate = float(raw)

    wh_amount = round(gross_amount * rate, 2)
    return {
        "enabled": True,
        "wh_type": "pph42",
        "service_type": service_type,
        "service_label": (st or {}).get("label", service_type),
        "rate": rate,
        "rate_pct": round(rate * 100, 2),
        "gross_amount": gross_amount,
        "wh_amount": wh_amount,
        "net_amount": round(gross_amount - wh_amount, 2),
    }


# ─────────────────────────────────────────
# 6. WITHHOLDING TRANSACTION CRUD
# ─────────────────────────────────────────

async def record_withholding(doc: dict) -> dict:
    """Save a withholding transaction to MongoDB."""
    db = get_db()
    await db.withholding_transactions.insert_one(doc)
    return serialize(doc)


async def list_withholding(
    *,
    period: Optional[str] = None,
    wh_type: Optional[str] = None,
    page: int = 1,
    per_page: int = 50,
) -> tuple[list[dict], dict]:
    db = get_db()
    q: dict = {"deleted_at": None}
    if period:
        q["period"] = period
    if wh_type:
        q["wh_type"] = wh_type
    skip = (page - 1) * per_page
    items = await db.withholding_transactions.find(q).sort([("created_at", -1)]).skip(skip).limit(per_page).to_list(per_page)
    total = await db.withholding_transactions.count_documents(q)
    return [serialize(d) for d in items], {"page": page, "per_page": per_page, "total": total}


async def withholding_summary(*, year: Optional[str] = None) -> list[dict]:
    """Monthly summary per wh_type."""
    db = get_db()
    match: dict = {"deleted_at": None}
    if year:
        match["period"] = {"$regex": f"^{year}"}

    pipeline = [
        {"$match": match},
        {"$group": {
            "_id": {"period": "$period", "wh_type": "$wh_type"},
            "count": {"$sum": 1},
            "gross_total": {"$sum": "$gross_amount"},
            "wh_total": {"$sum": "$wh_amount"},
            "net_total": {"$sum": "$net_amount"},
        }},
        {"$sort": {"_id.period": -1, "_id.wh_type": 1}},
    ]
    result = []
    async for row in db.withholding_transactions.aggregate(pipeline):
        result.append({
            "period": row["_id"]["period"],
            "wh_type": row["_id"]["wh_type"],
            "wh_type_label": PPH_TYPES.get(row["_id"]["wh_type"], {}).get("name", row["_id"]["wh_type"]),
            "count": row["count"],
            "gross_total": round(row["gross_total"], 2),
            "wh_total": round(row["wh_total"], 2),
            "net_total": round(row["net_total"], 2),
        })
    return result


async def get_withholding_by_source(source_type: str, source_id: str) -> list[dict]:
    """Get withholding records for a specific source document."""
    db = get_db()
    items = await db.withholding_transactions.find({
        "source_type": source_type, "source_id": source_id, "deleted_at": None,
    }).to_list(20)
    return [serialize(d) for d in items]


# ─────────────────────────────────────────
# 7. RESOLVE COA IDS FOR WITHHOLDING
# ─────────────────────────────────────────

async def resolve_wh_coa_id(wh_type: str) -> Optional[str]:
    """Return the GL account id for the given withholding type."""
    db = get_db()
    code_map = {"pph21": "2112", "pph23": "2113", "pph42": "2114"}
    code = code_map.get(wh_type)
    if not code:
        return None
    coa = await db.chart_of_accounts.find_one({"code": code, "deleted_at": None})
    return coa["id"] if coa else None

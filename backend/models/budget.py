"""Budget vs Actual models — Sprint 2 Enhanced (v0.3.5)."""
from datetime import datetime, timezone
from typing import Optional
import uuid


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# Standard F&B P&L categories for rollup
BUDGET_CATEGORIES = [
    {"code": "REV",    "name": "Revenue",           "sign": 1,  "description": "Pendapatan penjualan"},
    {"code": "COGS",   "name": "HPP / COGS",         "sign": -1, "description": "Harga pokok penjualan"},
    {"code": "GROSS",  "name": "Gross Profit",       "sign": 1,  "description": "Laba kotor (REV - COGS)", "derived": True},
    {"code": "OPEX",   "name": "Operating Expenses", "sign": -1, "description": "Beban operasional"},
    {"code": "PAYROLL","name": "Payroll",             "sign": -1, "description": "Gaji & tunjangan"},
    {"code": "MKTG",   "name": "Marketing",          "sign": -1, "description": "Biaya pemasaran"},
    {"code": "EBITDA", "name": "EBITDA",             "sign": 1,  "description": "Laba sebelum bunga, pajak, penyusutan", "derived": True},
    {"code": "DEP",    "name": "Depreciation",       "sign": -1, "description": "Penyusutan aset tetap"},
    {"code": "TAX",    "name": "Tax Expense",        "sign": -1, "description": "Beban pajak"},
    {"code": "NET",    "name": "Net Income",         "sign": 1,  "description": "Laba bersih", "derived": True},
]

# Budget scope levels
BUDGET_SCOPES = ["outlet", "brand", "group"]

# Approval workflow statuses
APPROVAL_STATUSES = ["draft", "submitted", "approved", "locked", "rejected"]


def make_budget_doc(
    *,
    name: str,
    period: str,                # YYYY-MM or YYYY-QN or YYYY
    period_type: str,           # monthly | quarterly | annual | annual_monthly
    scope: str = "outlet",      # outlet | brand | group
    outlet_id: Optional[str],
    brand_id: Optional[str] = None,
    lines: list,                # [{coa_id, coa_code, coa_name, category, amount, monthly_amounts?}]
    notes: Optional[str],
    created_by: Optional[str],
) -> dict:
    now = _now()
    # Derive scope from provided IDs if not set
    if scope == "outlet" and not outlet_id:
        scope = "brand" if brand_id else "group"
    return {
        "id": str(uuid.uuid4()),
        "name": name,
        "period": period,
        "period_type": period_type,
        "scope": scope,
        "outlet_id": outlet_id,
        "brand_id": brand_id,
        "lines": lines,
        "notes": notes,
        # Approval workflow
        "approval_status": "draft",
        "submitted_at": None,
        "submitted_by": None,
        "approved_at": None,
        "approved_by": None,
        "rejected_at": None,
        "rejected_by": None,
        "rejection_reason": None,
        "locked_at": None,
        "locked_by": None,
        # Legacy status kept for soft-delete
        "status": "active",
        "created_at": now,
        "updated_at": now,
        "updated_by": created_by,
        "deleted_at": None,
        "created_by": created_by,
    }

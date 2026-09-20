"""Shared helpers, constants, and guards for budget service."""
from __future__ import annotations

from datetime import datetime, timezone

from core.db import get_db

# ─────────────────────────────────────────────────────────────
# Constants
# ─────────────────────────────────────────────────────────────

MONTH_COLS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]
MONTH_IDX = {m: f"{i+1:02d}" for i, m in enumerate(MONTH_COLS)}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ─────────────────────────────────────────────────────────────
# Category helpers
# ─────────────────────────────────────────────────────────────

def guess_category(coa_code: str) -> str:
    code = str(coa_code)
    if code.startswith("4"):
        return "REV"
    if code.startswith("54"):
        return "PAYROLL"
    if code.startswith("55"):
        return "MKTG"
    if code.startswith("57") or code.startswith("61"):
        return "DEP"
    if code.startswith("58"):
        return "TAX"
    if code.startswith("5"):
        return "COGS"
    if code.startswith("6"):
        return "OPEX"
    return "OPEX"


# ─────────────────────────────────────────────────────────────
# Line enrichment
# ─────────────────────────────────────────────────────────────

async def _enrich_lines(raw_lines: list) -> list:
    """B3 fix: Batch-lookup COA for all lines (was N+1 find_one per line)."""
    db = get_db()
    coa_ids = list({ln.get("coa_id") for ln in raw_lines if ln.get("coa_id")})
    if coa_ids:
        coa_docs = await db.chart_of_accounts.find(
            {"id": {"$in": coa_ids}, "deleted_at": None},
            {"id": 1, "code": 1, "name": 1, "_id": 0}
        ).to_list(len(coa_ids) + 1)
        coa_map = {c["id"]: c for c in coa_docs}
    else:
        coa_map = {}
    lines = []
    for line in raw_lines:
        coa = coa_map.get(line.get("coa_id") or "")
        entry = {
            "coa_id": line.get("coa_id"),
            "coa_code": (coa or {}).get("code"),
            "coa_name": (coa or {}).get("name"),
            "category": line.get("category") or guess_category((coa or {}).get("code", "")),
            "amount": round(float(line.get("amount", 0)), 2),
        }
        # annual_monthly support: monthly_amounts dict {YYYY-MM: amount}
        if "monthly_amounts" in line:
            entry["monthly_amounts"] = {k: round(float(v), 2) for k, v in (line["monthly_amounts"] or {}).items()}
        lines.append(entry)
    return lines


# ─────────────────────────────────────────────────────────────
# Guard: locked/approved budgets cannot be edited
# ─────────────────────────────────────────────────────────────

async def _check_editable(budget_id: str) -> dict:
    db = get_db()
    doc = await db.budgets.find_one({"id": budget_id, "deleted_at": None})
    if not doc:
        raise ValueError("Budget not found")
    if doc.get("approval_status") in ("locked", "approved"):
        raise PermissionError(
            f"Budget berstatus '{doc['approval_status']}' tidak dapat diedit. Hubungi Executive untuk unlock."
        )
    return doc

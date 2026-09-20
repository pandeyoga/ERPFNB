"""Bank recon match algorithm and candidate building."""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional

from core.db import get_db
from services._bank_recon._common import DEFAULT_DATE_TOL_DAYS, DEFAULT_AMOUNT_TOL


def match_score(
    stmt_row: dict, candidate: dict, *,
    date_tol_days: int = DEFAULT_DATE_TOL_DAYS,
    amount_tol: float = DEFAULT_AMOUNT_TOL,
) -> float:
    """Return 0..1 match score, or -1 if not a candidate."""
    if not stmt_row.get("date") or not candidate.get("date"):
        return -1.0
    try:
        d_stmt = datetime.strptime(stmt_row["date"], "%Y-%m-%d").date()
        d_cand = datetime.strptime(candidate["date"], "%Y-%m-%d").date()
    except Exception:  # noqa: BLE001
        return -1.0
    dd = abs((d_stmt - d_cand).days)
    if dd > date_tol_days:
        return -1.0
    a_stmt = abs(float(stmt_row.get("amount", 0)))
    a_cand = abs(float(candidate.get("amount", 0)))
    da = abs(a_stmt - a_cand)
    if da > amount_tol:
        return -1.0
    date_score = 1 - (dd / max(date_tol_days, 1)) * 0.4
    amount_score = 1 - (da / max(amount_tol, 1)) * 0.3
    ref_score = 0.0
    desc = (stmt_row.get("description") or "").lower()
    for token in (candidate.get("doc_no"), candidate.get("reference"), candidate.get("payee_name")):
        if token and str(token).lower() in desc:
            ref_score = 0.15
            break
    return max(0.0, min(1.0, date_score * 0.5 + amount_score * 0.5 + ref_score))


async def _build_candidates(
    *, start_date: str, end_date: str,
    bank_account_id: Optional[str] = None,
    gl_account_id: Optional[str] = None,
) -> list[dict]:
    """Build match candidates from two sources:

    1. payment_requests  — status='paid', filtered by bank_account_id
    2. journal_entries   — posted entries where a line hits the bank GL account
                           (identified by gl_account_id from bank_accounts.gl_account_id)
    """
    db = get_db()
    d_from = (datetime.strptime(start_date, "%Y-%m-%d") - timedelta(days=7)).strftime("%Y-%m-%d")
    d_to = (datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=7)).strftime("%Y-%m-%d")

    # ── 1. Payment Requests ────────────────────────────────────────────────
    q: dict = {"deleted_at": None, "status": "paid", "payment_date": {"$gte": d_from, "$lte": d_to}}
    if bank_account_id:
        q["bank_account_id"] = bank_account_id
    vendors: dict = {}
    async for v in db.vendors.find({}):
        vendors[v["id"]] = v
    cands: list[dict] = []
    async for p in db.payment_requests.find(q).sort("payment_date", 1):
        payee_name = None
        if p.get("payee_type") == "vendor" and p.get("payee_id"):
            payee_name = vendors.get(p["payee_id"], {}).get("name")
        elif p.get("payee_text"):
            payee_name = p["payee_text"]
        cands.append({
            "target_type": "payment_request", "target_id": p["id"],
            "doc_no": p.get("doc_no"), "reference": p.get("payment_ref"),
            "date": p.get("payment_date"), "amount": float(p.get("amount", 0) or 0),
            "payee_name": payee_name, "description": p.get("description"),
            "reconciled": bool(p.get("reconciled_at")),
        })

    # ── 2. Journal Entries (bank GL lines) ─────────────────────────────────
    if gl_account_id:
        je_q: dict = {
            "deleted_at": None,
            "status": "posted",
            "entry_date": {"$gte": d_from, "$lte": d_to},
            "lines.coa_id": gl_account_id,
        }
        seen_je_ids: set[str] = set()
        async for je in db.journal_entries.find(je_q).sort("entry_date", 1):
            je_id = je["id"]
            if je_id in seen_je_ids:
                continue
            seen_je_ids.add(je_id)
            # Sum all lines that hit the bank GL account
            bank_lines = [l for l in je.get("lines", []) if l.get("coa_id") == gl_account_id]
            net_amount = sum(
                float(l.get("dr", 0)) - float(l.get("cr", 0)) for l in bank_lines
            )
            if abs(net_amount) < 0.01:
                continue  # zero-net lines don't affect the bank balance
            cands.append({
                "target_type": "journal_entry", "target_id": je_id,
                "doc_no": je.get("doc_no"), "reference": je.get("doc_no"),
                "date": je.get("entry_date"),
                "amount": round(net_amount, 2),  # positive=inflow, negative=outflow
                "payee_name": None,
                "description": je.get("description"),
                "reconciled": bool(je.get("reconciled_at")),
            })

    return cands

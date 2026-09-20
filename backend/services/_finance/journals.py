"""Finance journal entry operations."""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from core.db import get_db, serialize
from core.exceptions import ConflictError, NotFoundError, ValidationError

logger = logging.getLogger("aurora.finance")


async def _enrich_journal(je: dict) -> dict:
    """Add COA names to a JE dict (mutates in place, returns je)."""
    db = get_db()
    coa_ids = {ln.get("coa_id") for ln in je.get("lines", []) if ln.get("coa_id")}
    if not coa_ids:
        return je
    coa_map = {}
    async for c in db.chart_of_accounts.find({"id": {"$in": list(coa_ids)}}):
        coa_map[c["id"]] = c.get("name", "")
    for ln in je.get("lines", []):
        ln["coa_name"] = coa_map.get(ln.get("coa_id"), "")
    return je


async def list_journals(
    *,
    period: Optional[str] = None,
    source_type: Optional[str] = None,
    outlet_id: Optional[str] = None,
    dim_outlet: Optional[str] = None,
    coa_id: Optional[str] = None,
    status: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    per_page: int = 50,
) -> tuple[list[dict], dict]:
    if dim_outlet and not outlet_id:
        outlet_id = dim_outlet
    db = get_db()
    q: dict = {"deleted_at": None}
    if period:
        q["period"] = period
    if source_type:
        q["source_type"] = source_type
    if outlet_id:
        q["outlet_id"] = outlet_id
    if status:
        q["status"] = status
    if date_from or date_to:
        q["entry_date"] = {}
        if date_from:
            q["entry_date"]["$gte"] = date_from
        if date_to:
            q["entry_date"]["$lte"] = date_to
    if search:
        q["$or"] = [
            {"description": {"$regex": search, "$options": "i"}},
            {"je_number": {"$regex": search, "$options": "i"}},
        ]
    if coa_id:
        q["lines.coa_id"] = coa_id
    skip = (page - 1) * per_page
    items = await db.journal_entries.find(q).sort([("entry_date", -1), ("created_at", -1)]).skip(skip).limit(per_page).to_list(per_page)
    total = await db.journal_entries.count_documents(q)
    results = []
    for je in items:
        d = serialize(je)
        await _enrich_journal(d)
        results.append(d)
    return results, {"page": page, "per_page": per_page, "total": total}


async def get_journal(je_id: str) -> dict:
    db = get_db()
    je = await db.journal_entries.find_one({"id": je_id, "deleted_at": None})
    if not je:
        raise NotFoundError("Journal entry tidak ditemukan")
    d = serialize(je)
    await _enrich_journal(d)
    return d


async def post_manual_journal(payload: dict, *, user: dict) -> dict:
    """Create and post a manual journal entry."""
    db = get_db()
    lines = payload.get("lines", [])
    if not lines:
        raise ValidationError("lines wajib")
    total_dr = round(sum(float(ln.get("dr", 0)) for ln in lines), 2)
    total_cr = round(sum(float(ln.get("cr", 0)) for ln in lines), 2)
    if abs(total_dr - total_cr) > 0.01:
        raise ValidationError(f"JE tidak balance: Dr={total_dr} Cr={total_cr}")
    if total_dr <= 0:
        raise ValidationError("JE harus memiliki nilai > 0 — total debit/kredit tidak boleh nol")
    coa_ids = [ln.get("coa_id") for ln in lines if ln.get("coa_id")]
    coa_map = {}
    async for c in db.chart_of_accounts.find({"id": {"$in": coa_ids}}):
        coa_map[c["id"]] = c
    entry_date = payload.get("entry_date", datetime.now(timezone.utc).strftime("%Y-%m-%d"))
    period = payload.get("period") or entry_date[:7]
    from services._period import assert_period_unlocked
    await assert_period_unlocked(period, action="manual journal posting")
    cleaned_lines = []
    for ln in lines:
        coa = coa_map.get(ln.get("coa_id"))
        if not coa:
            raise ValidationError(f"COA {ln.get('coa_id')} tidak ditemukan")
        cleaned_lines.append({
            "coa_id": ln["coa_id"], "coa_code": coa.get("code"), "coa_name": coa.get("name"),
            "dr": round(float(ln.get("dr", 0)), 2), "cr": round(float(ln.get("cr", 0)), 2),
            "memo": ln.get("memo", ""),
        })
    from utils.number_series import next_doc_no
    je_no = await next_doc_no("JE")
    je = {
        "id": str(uuid.uuid4()), "je_number": je_no, "entry_date": entry_date, "period": period,
        "description": payload.get("description", ""), "source_type": "manual",
        "source_id": None, "outlet_id": payload.get("outlet_id"),
        "lines": cleaned_lines, "total_dr": total_dr, "total_cr": total_cr,
        "status": "posted", "posted_at": datetime.now(timezone.utc).isoformat(),
        "posted_by": user["id"], "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user["id"], "updated_at": datetime.now(timezone.utc).isoformat(),
        "deleted_at": None,
    }
    await db.journal_entries.insert_one(je)
    return serialize(je)


async def reverse_journal(je_id: str, *, user: dict, reason: str = "") -> dict:
    """Create reversing journal entry."""
    db = get_db()
    original = await db.journal_entries.find_one({"id": je_id, "deleted_at": None})
    if not original:
        raise NotFoundError("Journal entry tidak ditemukan")
    if original.get("reversed"):
        raise ConflictError("JE sudah pernah di-reverse")
    if original.get("source_type") not in ("manual", None):
        raise ValidationError("Hanya manual JE yang bisa di-reverse")
    entry_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    period = entry_date[:7]
    await assert_period_unlocked(period, action="reversal")
    reversed_lines = []
    for ln in original.get("lines", []):
        reversed_lines.append({**ln, "dr": ln.get("cr", 0), "cr": ln.get("dr", 0), "memo": f"REVERSAL: {ln.get('memo', '')}"})
    from utils.number_series import next_doc_no
    je_no = await next_doc_no("JER")
    rev_je = {
        "id": str(uuid.uuid4()), "je_number": je_no, "entry_date": entry_date, "period": period,
        "description": f"REVERSAL of {original.get('je_number', je_id)}: {reason}",
        "source_type": "reversal", "source_id": je_id, "outlet_id": original.get("outlet_id"),
        "lines": reversed_lines, "total_dr": original.get("total_cr"), "total_cr": original.get("total_dr"),
        "status": "posted", "posted_at": datetime.now(timezone.utc).isoformat(),
        "posted_by": user["id"], "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user["id"], "updated_at": datetime.now(timezone.utc).isoformat(), "deleted_at": None,
        "is_reversal": True, "reversal_of": je_id,
    }
    await db.journal_entries.insert_one(rev_je)
    await db.journal_entries.update_one({"id": je_id}, {"$set": {"reversed": True, "reversal_je_id": rev_je["id"], "updated_at": datetime.now(timezone.utc).isoformat()}})
    return serialize(rev_je)


async def assert_period_unlocked(period: str, *, action: str = "posting") -> None:
    """Convenience re-export used within finance package."""
    from services._period import assert_period_unlocked as _a
    await _a(period, action=action)

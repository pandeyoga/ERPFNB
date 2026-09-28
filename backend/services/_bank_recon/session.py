"""Bank recon session CRUD (upload, auto_match, manual_match, commit)."""
from __future__ import annotations

import uuid
from typing import Optional

from core.audit import log as audit_log
from core.db import get_db, serialize
from core.exceptions import ConflictError, NotFoundError, ValidationError
from services._bank_recon._common import DEFAULT_DATE_TOL_DAYS, DEFAULT_AMOUNT_TOL, _now
from services._bank_recon.parser import parse_statement_csv
from services._bank_recon.matcher import match_score, _build_candidates


async def list_sessions() -> list[dict]:
    db = get_db()
    items = await db.bank_recon_sessions.find({"deleted_at": None}).sort("created_at", -1).to_list(200)
    return [serialize(d) for d in items]


async def get_session(session_id: str) -> dict:
    db = get_db()
    s = await db.bank_recon_sessions.find_one({"id": session_id, "deleted_at": None})
    if not s:
        raise NotFoundError("Bank recon session tidak ditemukan")
    return serialize(s)


async def upload_statement(
    *, bank_account_id: str, filename: str, content: bytes, user: dict,
    date_tol_days: int = DEFAULT_DATE_TOL_DAYS, amount_tol: float = DEFAULT_AMOUNT_TOL,
) -> dict:
    """Parse file, create session, auto-match."""
    db = get_db()
    ba = await db.bank_accounts.find_one({"id": bank_account_id, "deleted_at": None})
    if not ba:
        raise ValidationError("bank_account_id tidak valid")
    rows = parse_statement_csv(content)
    if not rows:
        raise ValidationError("Tidak ada baris valid terdeteksi dari file.")
    dates = sorted(r["date"] for r in rows)
    start_d, end_d = dates[0], dates[-1]
    total_in = round(sum(r["amount"] for r in rows if r["amount"] > 0), 2)
    total_out = round(sum(-r["amount"] for r in rows if r["amount"] < 0), 2)
    session = {
        "id": str(uuid.uuid4()), "bank_account_id": bank_account_id,
        "bank_account_name": f"{ba.get('bank', '')} {ba.get('account_number', '')} — {ba.get('name', '')}",
        "gl_account_id": ba.get("gl_account_id"),
        "filename": filename, "status": "pending",
        "start_date": start_d, "end_date": end_d,
        "total_rows": len(rows), "total_inflow": total_in, "total_outflow": total_out,
        "date_tol_days": int(date_tol_days), "amount_tol": float(amount_tol),
        "rows": rows, "created_at": _now(), "updated_at": _now(), "deleted_at": None,
        "created_by": user["id"],
    }
    await db.bank_recon_sessions.insert_one(session)
    await audit_log(user_id=user["id"], entity_type="bank_recon_session",
                    entity_id=session["id"], action="create", after={"filename": filename, "rows": len(rows)})
    await auto_match(session["id"], user=user)
    return await get_session(session["id"])


async def auto_match(session_id: str, *, user: dict) -> dict:
    db = get_db()
    session = await get_session(session_id)
    if session["status"] == "committed":
        raise ConflictError("Session sudah committed, tidak bisa re-match")
    bank_id = session["bank_account_id"]
    cands = await _build_candidates(
        start_date=session["start_date"],
        end_date=session["end_date"],
        bank_account_id=bank_id,
        gl_account_id=session.get("gl_account_id"),
    )
    cands = [c for c in cands if not c["reconciled"]]
    matched = 0
    used_target_ids: set[str] = set()
    for row in session["rows"]:
        if row.get("matched") and row.get("match_type") == "manual":
            continue
        best: Optional[dict] = None
        best_score = -1.0
        for c in cands:
            if c["target_id"] in used_target_ids:
                continue
            s = match_score(row, c, date_tol_days=session.get("date_tol_days", DEFAULT_DATE_TOL_DAYS), amount_tol=session.get("amount_tol", DEFAULT_AMOUNT_TOL))
            if s > best_score:
                best_score = s
                best = c
        if best and best_score >= 0:
            row["matched"] = True
            row["match_type"] = "auto"
            row["match_target_type"] = best["target_type"]
            row["match_target_id"] = best["target_id"]
            row["match_target_doc_no"] = best["doc_no"]
            row["match_confidence"] = round(float(best_score), 3)
            row["match_reason"] = "date ±tol + amount ±tol" + (" + ref" if best.get("doc_no") and best["doc_no"].lower() in (row.get("description") or "").lower() else "")
            used_target_ids.add(best["target_id"])
            matched += 1
        else:
            row.update({"matched": False, "match_type": None, "match_target_type": None, "match_target_id": None, "match_target_doc_no": None, "match_confidence": None, "match_reason": None})
    await db.bank_recon_sessions.update_one({"id": session_id}, {"$set": {"rows": session["rows"], "matched_count": matched, "updated_at": _now(), "status": "pending"}})
    await audit_log(user_id=user["id"], entity_type="bank_recon_session", entity_id=session_id, action="auto_match", after={"matched": matched, "total": len(session["rows"])})
    return await get_session(session_id)


async def set_manual_match(session_id: str, row_id: str, target_type: str, target_id: str, *, user: dict) -> dict:
    db = get_db()
    session = await get_session(session_id)
    if session["status"] == "committed":
        raise ConflictError("Session sudah committed")
    if target_type not in ("payment_request", "journal_entry"):
        raise ValidationError("target_type harus 'payment_request' atau 'journal_entry'")
    if target_type == "payment_request":
        tdoc = await db.payment_requests.find_one({"id": target_id, "deleted_at": None})
    else:
        tdoc = await db.journal_entries.find_one({"id": target_id, "deleted_at": None})
    if not tdoc:
        raise NotFoundError("Target tidak ditemukan")
    found = False
    for row in session["rows"]:
        if row["id"] == row_id:
            row.update({"matched": True, "match_type": "manual", "match_target_type": target_type, "match_target_id": target_id, "match_target_doc_no": tdoc.get("doc_no"), "match_confidence": 1.0, "match_reason": "manual"})
            found = True
            break
    if not found:
        raise NotFoundError("Row ID tidak ditemukan di session")
    matched = sum(1 for r in session["rows"] if r.get("matched"))
    await db.bank_recon_sessions.update_one({"id": session_id}, {"$set": {"rows": session["rows"], "matched_count": matched, "updated_at": _now()}})
    await audit_log(user_id=user["id"], entity_type="bank_recon_session", entity_id=session_id, action="manual_match", after={"row_id": row_id, "target_type": target_type, "target_id": target_id})
    return await get_session(session_id)


async def unmatch_row(session_id: str, row_id: str, *, user: dict) -> dict:
    db = get_db()
    session = await get_session(session_id)
    if session["status"] == "committed":
        raise ConflictError("Session sudah committed")
    found = False
    for row in session["rows"]:
        if row["id"] == row_id:
            row.update({"matched": False, "match_type": None, "match_target_type": None, "match_target_id": None, "match_target_doc_no": None, "match_confidence": None, "match_reason": None})
            found = True
            break
    if not found:
        raise NotFoundError("Row ID tidak ditemukan")
    matched = sum(1 for r in session["rows"] if r.get("matched"))
    await db.bank_recon_sessions.update_one({"id": session_id}, {"$set": {"rows": session["rows"], "matched_count": matched, "updated_at": _now()}})
    return await get_session(session_id)


async def commit_session(session_id: str, *, user: dict) -> dict:
    db = get_db()
    session = await get_session(session_id)
    if session["status"] == "committed":
        raise ConflictError("Session sudah committed")
    matched_rows = [r for r in session["rows"] if r.get("matched")]
    if not matched_rows:
        raise ValidationError("Tidak ada baris yang di-match, tidak bisa commit")
    for row in matched_rows:
        ttype = row["match_target_type"]
        tid = row["match_target_id"]
        if ttype == "payment_request":
            await db.payment_requests.update_one({"id": tid}, {"$set": {"reconciled_at": _now(), "reconciled_session_id": session_id, "reconciled_row_id": row["id"], "updated_at": _now()}})
        elif ttype == "journal_entry":
            await db.journal_entries.update_one({"id": tid}, {"$set": {"reconciled_at": _now(), "reconciled_session_id": session_id, "updated_at": _now()}})
    await db.bank_recon_sessions.update_one({"id": session_id}, {"$set": {"status": "committed", "committed_at": _now(), "committed_by": user["id"], "updated_at": _now()}})
    await audit_log(user_id=user["id"], entity_type="bank_recon_session", entity_id=session_id, action="commit", after={"matched": len(matched_rows)})
    return await get_session(session_id)


async def reverse_commit(session_id: str, *, user: dict) -> dict:
    """Reverse a committed reconciliation session back to 'pending'.

    - Clears reconciled_at / reconciled_session_id on all payment_requests and
      journal_entries that were reconciled by THIS session (safe guard: only
      unsets records whose reconciled_session_id matches this session).
    - Preserves all row match data so the user can review and re-commit.
    - Creates an audit log entry.
    """
    db = get_db()
    session = await get_session(session_id)
    if session["status"] != "committed":
        raise ConflictError("Session belum committed, tidak ada yang perlu di-reverse")

    matched_rows = [r for r in session["rows"] if r.get("matched")]
    reversed_count = 0
    for row in matched_rows:
        ttype = row.get("match_target_type")
        tid = row.get("match_target_id")
        if not ttype or not tid:
            continue
        # Only unset if this session is the one that set reconciled_session_id
        # (prevents undoing a re-reconciliation done by a newer session)
        if ttype == "payment_request":
            result = await db.payment_requests.update_one(
                {"id": tid, "reconciled_session_id": session_id},
                {"$unset": {"reconciled_at": "", "reconciled_session_id": "", "reconciled_row_id": ""}, "$set": {"updated_at": _now()}},
            )
            if result.modified_count:
                reversed_count += 1
        elif ttype == "journal_entry":
            result = await db.journal_entries.update_one(
                {"id": tid, "reconciled_session_id": session_id},
                {"$unset": {"reconciled_at": "", "reconciled_session_id": ""}, "$set": {"updated_at": _now()}},
            )
            if result.modified_count:
                reversed_count += 1

    await db.bank_recon_sessions.update_one(
        {"id": session_id},
        {"$set": {"status": "pending", "updated_at": _now()},
         "$unset": {"committed_at": "", "committed_by": ""}},
    )
    await audit_log(
        user_id=user["id"], entity_type="bank_recon_session", entity_id=session_id,
        action="reverse_commit", after={"reversed": reversed_count, "total_matched": len(matched_rows)},
    )
    return await get_session(session_id)


async def get_match_candidates(session_id: str, row_id: str) -> list[dict]:
    """Return scored candidates for a specific row."""
    session = await get_session(session_id)
    row = next((r for r in session["rows"] if r["id"] == row_id), None)
    if not row:
        raise NotFoundError("Row tidak ditemukan")
    cands = await _build_candidates(
        start_date=session["start_date"],
        end_date=session["end_date"],
        bank_account_id=session["bank_account_id"],
        gl_account_id=session.get("gl_account_id"),
    )
    scored = []
    for c in cands:
        s = match_score(row, c, date_tol_days=session.get("date_tol_days", DEFAULT_DATE_TOL_DAYS), amount_tol=session.get("amount_tol", DEFAULT_AMOUNT_TOL))
        if s >= 0:
            scored.append({**c, "score": round(float(s), 3)})
    import math
    loose_cands = []
    amt = abs(float(row["amount"]))
    for c in cands:
        if c in scored:
            continue
        ca = abs(float(c.get("amount", 0)))
        if ca == 0:
            continue
        if math.isclose(ca, amt, rel_tol=0.05, abs_tol=5000):
            loose_cands.append({**c, "score": None, "loose": True})
    scored.sort(key=lambda x: -x["score"])
    loose_cands.sort(key=lambda x: x["date"])
    return scored + loose_cands[:20]

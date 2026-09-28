"""Bank recon session extras: exception, bulk accept, summary, export."""
from __future__ import annotations

import csv as _csv
import io as _io

from core.audit import log as audit_log
from core.db import get_db
from core.exceptions import ConflictError
from services._bank_recon._common import DEFAULT_DATE_TOL_DAYS, DEFAULT_AMOUNT_TOL, _now
from services._bank_recon.matcher import match_score, _build_candidates
from services._bank_recon.session import get_session


async def mark_exception(session_id: str, row_id: str, note: str, *, user: dict) -> dict:
    db = get_db()
    await db.bank_recon_sessions.update_one(
        {"id": session_id, "rows.id": row_id},
        {"$set": {"rows.$.exception": True, "rows.$.exception_note": note, "rows.$.matched": False, "rows.$.match_target_type": None, "rows.$.match_target_id": None, "updated_at": _now()}},
    )
    await audit_log(user_id=user["id"], entity_type="bank_recon_row", entity_id=row_id, action="exception", after={"note": note})
    return await get_session(session_id)


async def bulk_auto_accept(session_id: str, min_score: float, *, user: dict) -> dict:
    """Bulk-accept unmatched rows whose best candidate score >= min_score.

    Fixes vs original implementation:
    - Fetch candidates ONCE (not per row) → O(1) DB reads vs O(n)
    - Filter out already-reconciled candidates
    - Track used_target_ids to prevent duplicate matching
    - Correct field names matching auto_match convention
    - Validate session not already committed
    - Update entire rows array at once
    """
    db = get_db()
    session = await get_session(session_id)
    if session["status"] == "committed":
        raise ConflictError("Session sudah committed, tidak bisa bulk accept")

    # Fetch & filter candidates once
    cands = await _build_candidates(
        start_date=session["start_date"],
        end_date=session["end_date"],
        bank_account_id=session["bank_account_id"],
        gl_account_id=session.get("gl_account_id"),
    )
    cands = [c for c in cands if not c["reconciled"]]

    accepted = 0
    used_target_ids: set[str] = set()

    # Seed used_target_ids from already-matched rows (preserve existing matches)
    for row in session["rows"]:
        if row.get("matched") and row.get("match_target_id"):
            used_target_ids.add(row["match_target_id"])

    for row in session["rows"]:
        # Skip already-matched or exception rows
        if row.get("matched") or row.get("exception"):
            continue

        best: dict | None = None
        best_score = -1.0
        for c in cands:
            if c["target_id"] in used_target_ids:
                continue
            s = match_score(
                row, c,
                date_tol_days=session.get("date_tol_days", DEFAULT_DATE_TOL_DAYS),
                amount_tol=session.get("amount_tol", DEFAULT_AMOUNT_TOL),
            )
            if s > best_score:
                best_score = s
                best = c

        if best and best_score >= min_score:
            row["matched"] = True
            row["match_type"] = "auto"
            row["match_target_type"] = best["target_type"]
            row["match_target_id"] = best["target_id"]
            row["match_target_doc_no"] = best["doc_no"]
            row["match_confidence"] = round(float(best_score), 3)
            row["match_reason"] = "bulk-accept"
            used_target_ids.add(best["target_id"])
            accepted += 1

    # Update entire rows array at once (same pattern as auto_match)
    matched_total = sum(1 for r in session["rows"] if r.get("matched"))
    await db.bank_recon_sessions.update_one(
        {"id": session_id},
        {"$set": {"rows": session["rows"], "matched_count": matched_total, "updated_at": _now()}},
    )
    await audit_log(
        user_id=user["id"], entity_type="bank_recon_session", entity_id=session_id,
        action="bulk_accept", after={"accepted": accepted, "min_score": min_score},
    )
    return {"session": await get_session(session_id), "accepted": accepted}


async def get_summary(session_id: str) -> dict:
    session = await get_session(session_id)
    rows = session.get("rows", [])
    total = len(rows)
    matched = sum(1 for r in rows if r.get("matched"))
    exceptional = sum(1 for r in rows if r.get("exception"))
    unmatched = total - matched - exceptional
    matched_amount = sum(abs(float(r.get("amount", 0))) for r in rows if r.get("matched"))
    unmatched_amount = sum(abs(float(r.get("amount", 0))) for r in rows if not r.get("matched") and not r.get("exception"))
    exceptional_amount = sum(abs(float(r.get("amount", 0))) for r in rows if r.get("exception"))
    total_amount = sum(abs(float(r.get("amount", 0))) for r in rows)
    match_pct = round(matched / total * 100, 1) if total > 0 else 0.0
    return {
        "session_id": session_id, "status": session["status"],
        "total_rows": total, "matched_rows": matched, "unmatched_rows": unmatched, "exceptional_rows": exceptional,
        "match_pct": match_pct, "total_amount": total_amount,
        "matched_amount": matched_amount, "unmatched_amount": unmatched_amount, "exceptional_amount": exceptional_amount,
        "bank_account_id": session.get("bank_account_id"),
        "period": f"{session.get('start_date')} – {session.get('end_date')}",
    }


def export_session_csv(session: dict) -> str:
    buf = _io.StringIO()
    writer = _csv.writer(buf)
    writer.writerow(["Date", "Description", "Amount", "Status", "Match Type", "Match Ref", "Confidence", "Exception Note"])
    for row in session.get("rows", []):
        status = "matched" if row.get("matched") else ("exception" if row.get("exception") else "unmatched")
        writer.writerow([
            row.get("date", ""),
            row.get("description", ""),
            row.get("amount", ""),
            status,
            row.get("match_target_type", ""),
            row.get("match_target_doc_no", ""),   # consistent with auto_match
            row.get("match_confidence", ""),       # consistent with auto_match
            row.get("exception_note", ""),
        ])
    return buf.getvalue()


async def get_session_history(session_id: str) -> list[dict]:
    """Return audit log entries for this session, enriched with user display name.

    Sorted oldest-first so the UI can render a top-down timeline.
    """
    db = get_db()
    # Fetch raw audit entries
    cursor = db.audit_log.find(
        {"entity_type": "bank_recon_session", "entity_id": session_id},
        {"_id": 0},
    ).sort("timestamp", 1)
    entries = await cursor.to_list(200)

    if not entries:
        return []

    # Batch-resolve user display names
    user_ids = {e["user_id"] for e in entries if e.get("user_id")}
    user_map: dict[str, str] = {}
    if user_ids:
        async for u in db.users.find({"id": {"$in": list(user_ids)}}, {"id": 1, "full_name": 1, "email": 1, "_id": 0}):
            user_map[u["id"]] = u.get("full_name") or u.get("email") or u["id"][:8]

    result = []
    for e in entries:
        result.append({
            "id": e.get("id"),
            "action": e.get("action"),
            "user_id": e.get("user_id"),
            "user_name": user_map.get(e.get("user_id", ""), "System"),
            "timestamp": e.get("timestamp"),
            "after": e.get("after"),
            "reason": e.get("reason"),
        })
    return result

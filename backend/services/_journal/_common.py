"""_journal/_common.py — shared helpers for journal_service sub-modules."""
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from core.audit import log as audit_log
from core.db import get_db, serialize
from core.exceptions import AuroraException, ValidationError
from services import gl_mapping
from utils.number_series import next_doc_no

logger = logging.getLogger("aurora.journal")


async def _ensure_period_open(period: str) -> None:
    """Auto-create period if missing, but if locked → reject."""
    db = get_db()
    p = await db.accounting_periods.find_one({"period": period})
    if not p:
        await db.accounting_periods.insert_one({
            "id": str(uuid.uuid4()),
            "period": period,
            "fiscal_year": int(period.split("-")[0]),
            "status": "open",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        })
        return
    if p["status"] in ("locked", "closed"):
        raise AuroraException(
            f"Period {period} sudah {p['status']}, tidak bisa post journal",
            code="PERIOD_LOCKED", status_code=409,
        )


def _period_of(date_str: str) -> str:
    return date_str[:7]  # YYYY-MM


async def _post_journal(
    *,
    entry_date: str,
    description: str,
    source_type: str,
    source_id: str,
    lines: list[dict],
    user_id: Optional[str] = None,
    dim_outlet: Optional[str] = None,
    dim_brand: Optional[str] = None,
) -> dict:
    """Generic JE poster. Validates Dr=Cr, opens period, idempotent."""
    db = get_db()
    period = _period_of(entry_date)
    await _ensure_period_open(period)

    # Idempotency: if a posted JE already exists for this source, skip
    existing = await db.journal_entries.find_one({
        "source_type": source_type, "source_id": source_id,
        "status": "posted", "deleted_at": None,
    })
    if existing:
        return serialize(existing)

    # Filter zero-amount lines, total
    filtered = []
    total_dr = 0.0
    total_cr = 0.0
    for ln in lines:
        dr = float(ln.get("dr", 0) or 0)
        cr = float(ln.get("cr", 0) or 0)
        if dr == 0 and cr == 0:
            continue
        filtered.append({
            "coa_id": ln["coa_id"],
            "coa_code": ln.get("coa_code"),
            "coa_name": ln.get("coa_name"),
            "dr": round(dr, 2),
            "cr": round(cr, 2),
            "memo": ln.get("memo"),
            "dim_outlet": ln.get("dim_outlet") or dim_outlet,
            "dim_brand": ln.get("dim_brand") or dim_brand,
            "dim_employee": ln.get("dim_employee"),
            "dim_vendor": ln.get("dim_vendor"),
        })
        total_dr += dr
        total_cr += cr

    if abs(total_dr - total_cr) > 0.5:
        raise ValidationError(
            f"Journal tidak balance: Dr={total_dr}, Cr={total_cr} (diff={total_dr-total_cr})"
        )

    doc_no = await next_doc_no("JAE")
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": str(uuid.uuid4()),
        "doc_no": doc_no,
        "entry_date": entry_date,
        "period": period,
        "source_type": source_type,
        "source_id": source_id,
        "description": description,
        "status": "posted",
        "lines": filtered,
        "total_dr": round(total_dr, 2),
        "total_cr": round(total_cr, 2),
        "posted_by": user_id,
        "posted_at": now,
        "reversal_of": None,
        "created_at": now, "updated_at": now, "deleted_at": None,
    }
    await db.journal_entries.insert_one(doc)
    await audit_log(
        user_id=user_id, entity_type="journal_entry", entity_id=doc["id"],
        action="post", after={"source_type": source_type, "source_id": source_id, "doc_no": doc_no},
    )
    return serialize(doc)

"""_journal/_common.py — shared helpers for journal_service sub-modules."""
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from pymongo.errors import DuplicateKeyError

from core.audit import log as audit_log
from core.db import get_db, serialize
from core.exceptions import AuroraException, ValidationError
from services import gl_mapping
from utils.number_series import next_doc_no

logger = logging.getLogger("aurora.journal")
JE_BALANCE_TOLERANCE = 0.01  # A7/SSOT-15: single tolerance


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


MAX_FUTURE_MONTHS = 1  # accrual/payroll entries may be dated up to the end of next month


def normalize_entry_date(entry_date) -> str:
    """FIN-10/FIN-22: entry dates must be real calendar dates (YYYY-MM-DD, optionally with a time part)
    and not far in the future — malformed dates used to slip past period locks ("2019-1-15" → "2019-1-")."""
    from datetime import date as _date
    from core.clock import today_local
    raw = str(entry_date or "").strip()
    try:
        d = _date.fromisoformat(raw[:10])
    except ValueError:
        raise ValidationError("Tanggal jurnal harus berformat YYYY-MM-DD", field="entry_date")
    if len(raw) > 10 and raw[10] not in "T ":
        raise ValidationError("Tanggal jurnal harus berformat YYYY-MM-DD", field="entry_date")
    t = today_local()
    if (d.year - t.year) * 12 + (d.month - t.month) > MAX_FUTURE_MONTHS:
        raise ValidationError(f"Tanggal jurnal {d.isoformat()} terlalu jauh di masa depan", field="entry_date")
    return d.isoformat()


def _to_sen(value) -> int:
    """Money → integer sen with HALF_UP rounding (no binary-float drift)."""
    from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
    try:
        return int((Decimal(str(value or 0)) * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))
    except (InvalidOperation, ValueError):
        raise ValidationError("Nilai debit/kredit jurnal tidak valid")


async def _assert_postable_accounts(coa_ids: set) -> None:
    """FIN-11: every line must hit an existing, active, postable (non-header) account."""
    docs = await get_db().chart_of_accounts.find(
        {"id": {"$in": list(coa_ids)}},
        {"_id": 0, "id": 1, "code": 1, "is_postable": 1, "active": 1, "deleted_at": 1},
    ).to_list(len(coa_ids) + 1)
    found = {d["id"]: d for d in docs}
    for cid in coa_ids:
        d = found.get(cid)
        if not d or d.get("deleted_at"):
            raise ValidationError(f"Akun jurnal tidak ditemukan: {cid}", code="COA_INVALID")
        if d.get("is_postable") is False:
            raise ValidationError(f"Akun {d.get('code')} adalah akun header (tidak bisa diposting)",
                                  code="COA_NOT_POSTABLE")
        if d.get("active") is False:
            raise ValidationError(f"Akun {d.get('code')} tidak aktif", code="COA_INACTIVE")


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
    entry_date = normalize_entry_date(entry_date)
    period = _period_of(entry_date)

    # Idempotency: if a posted JE already exists for this source, skip
    existing = await db.journal_entries.find_one({
        "source_type": source_type, "source_id": source_id,
        "status": "posted", "deleted_at": None,
    })
    if existing:
        return serialize(existing)

    # Filter zero-amount lines, total — amounts are handled in integer sen (FIN-09: float sums of
    # individually rounded lines produced rejected or 1-sen-unbalanced JEs that blocked period close)
    filtered = []
    for ln in lines:
        dr = _to_sen(ln.get("dr"))
        cr = _to_sen(ln.get("cr"))
        if dr == 0 and cr == 0:
            continue
        if dr < 0 or cr < 0 or (dr and cr):
            raise ValidationError("Baris jurnal tidak valid: dr/cr negatif atau terisi keduanya")
        if not ln.get("coa_id"):
            raise ValidationError("Baris jurnal tanpa akun (coa_id)")
        filtered.append({
            "coa_id": ln["coa_id"],
            "coa_code": ln.get("coa_code"),
            "coa_name": ln.get("coa_name"),
            "dr": dr,
            "cr": cr,
            "memo": ln.get("memo"),
            "dim_outlet": ln.get("dim_outlet") or dim_outlet,
            "dim_brand": ln.get("dim_brand") or dim_brand,
            "dim_employee": ln.get("dim_employee"),
            "dim_vendor": ln.get("dim_vendor"),
        })
    if not filtered:
        # Nothing of value to post (e.g. zero-cost movement): don't persist an empty ledger entry.
        logger.info("journal skipped (no non-zero lines) source=%s:%s", source_type, source_id)
        return {"id": None, "doc_no": None, "entry_date": entry_date, "period": period,
                "source_type": source_type, "source_id": source_id, "lines": [],
                "total_dr": 0.0, "total_cr": 0.0, "skipped": "no_amount"}
    await _assert_postable_accounts({ln["coa_id"] for ln in filtered})

    diff = sum(ln["dr"] for ln in filtered) - sum(ln["cr"] for ln in filtered)
    if diff:
        # Each caller-side rounding can leave at most half a sen per line; absorb that residue on the
        # largest line of the lighter side. Anything bigger is a real imbalance.
        if abs(diff) > max(1, (len(filtered) + 1) // 2):
            raise ValidationError(
                f"Journal tidak balance: Dr={sum(ln['dr'] for ln in filtered) / 100}, "
                f"Cr={sum(ln['cr'] for ln in filtered) / 100} (diff={diff / 100})")
        side = "cr" if diff > 0 else "dr"
        target = max((ln for ln in filtered if ln[side]), key=lambda ln: ln[side])
        target[side] += abs(diff)
        target["rounding_adjustment"] = abs(diff) / 100
    for ln in filtered:
        ln["dr"] = ln["dr"] / 100
        ln["cr"] = ln["cr"] / 100
    total_dr = sum(ln["dr"] for ln in filtered)
    total_cr = total_dr

    # FIN-22: only open/create the period once the entry itself is known to be valid
    await _ensure_period_open(period)
    doc_no = await next_doc_no("JAE")
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": str(uuid.uuid4()),
        "doc_no": doc_no,
        "entry_date": entry_date,
        "period": period,
        "source_type": source_type,
        "source_id": source_id,
        "outlet_id": dim_outlet,
        "brand_id": dim_brand,
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
    try:
        await db.journal_entries.insert_one(doc)
    except DuplicateKeyError:
        # FIN-28/POS-03: a concurrent request posted this source first (je_source_unique_partial) —
        # posting is idempotent, so hand back that entry instead of failing with a 500.
        existing = await db.journal_entries.find_one({
            "source_type": source_type, "source_id": source_id, "deleted_at": None})
        if existing:
            return serialize(existing)
        raise
    await audit_log(
        user_id=user_id, entity_type="journal_entry", entity_id=doc["id"],
        action="post", after={"source_type": source_type, "source_id": source_id, "doc_no": doc_no},
    )
    return serialize(doc)


async def resolve_payment_target(pm: dict | None, outlet_id: str | None, ba: dict | None = None) -> str:
    """DUP-06: one rule for 'which GL account does this payment method hit'."""
    from services import gl_mapping
    if pm and pm.get("code") == "PETTY":
        return await gl_mapping.resolve("petty_cash", scope_outlet_id=outlet_id)
    if pm and pm.get("bank_account_id"):
        ba = ba or await get_db().bank_accounts.find_one({"id": pm["bank_account_id"]})
        if ba and ba.get("gl_account_id"):
            return ba["gl_account_id"]
    if pm and pm.get("type") == "card":
        return await gl_mapping.resolve("cards_receivable")
    return await gl_mapping.resolve("cash_on_hand")

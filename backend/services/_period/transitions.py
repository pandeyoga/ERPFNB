"""Period status transitions: close, lock, reopen."""
from __future__ import annotations

from typing import Optional

from core.audit import log as audit_log
from core.db import get_db, serialize
from core.exceptions import ConflictError, ValidationError
from services._period._common import _now, _valid_period, logger
from services._period.crud import get_period
from services._period.checks import closing_checks
from services._period.tax_settlement import generate_tax_settlement_je


async def _transition(period: str, *, to_status: str, user: dict, reason: Optional[str] = None,
                      allowed_from: tuple[str, ...]) -> dict:
    if not _valid_period(period):
        raise ValidationError("period harus YYYY-MM")
    db = get_db()
    p = await db.accounting_periods.find_one({"period": period})
    if not p:
        await get_period(period)
        p = await db.accounting_periods.find_one({"period": period})
    cur = p.get("status", "open")
    if cur == to_status:
        raise ConflictError(f"Period {period} sudah {to_status}")
    if cur not in allowed_from:
        raise ValidationError(
            f"Tidak dapat ke '{to_status}' dari status '{cur}' (dibolehkan: {','.join(allowed_from)})"
        )
    before = serialize(p)
    update = {"status": to_status, "updated_at": _now()}
    if to_status == "closed":
        update["closed_at"] = _now()
        update["closed_by"] = user["id"]
        if reason:
            update["close_reason"] = reason
    if to_status == "locked":
        update["locked_at"] = _now()
        update["locked_by"] = user["id"]
        if reason:
            update["lock_reason"] = reason
    if to_status == "open":
        update["reopened_at"] = _now()
        update["reopened_by"] = user["id"]
        update["reopen_reason"] = reason or ""
        update["closed_at"] = None
        update["locked_at"] = None
    await db.accounting_periods.update_one({"period": period}, {"$set": update})
    after = await db.accounting_periods.find_one({"period": period})
    await audit_log(
        user_id=user["id"], entity_type="accounting_period",
        entity_id=p["id"], action=f"transition_{to_status}",
        before=before, after=serialize(after), reason=reason,
    )
    return serialize(after)


async def close_period(period: str, *, user: dict, reason: Optional[str] = None) -> dict:
    """Set status to 'closed'. Auto-generates tax settlement JE."""
    res = await closing_checks(period)
    if res["summary"]["blockers"]:
        failures = [c for c in res["checks"] if c["status"] == "fail" and c.get("blocker")]
        names = ", ".join(c["label"] for c in failures)
        raise ValidationError(f"Tidak dapat close: blocker check gagal — {names}", code="CLOSING_BLOCKED")
    try:
        settlement_je = await generate_tax_settlement_je(period, user=user)
        if settlement_je:
            logger.info(f"Tax settlement JE generated: {settlement_je.get('je_number')}")
    except Exception as e:
        logger.error(f"Failed to generate tax settlement JE for period {period}: {e}")
    return await _transition(period, to_status="closed", user=user, reason=reason, allowed_from=("open",))


async def lock_period(period: str, *, user: dict, reason: Optional[str] = None) -> dict:
    """Set status to 'locked'. Allowed from: open or closed."""
    res = await closing_checks(period)
    if res["summary"]["blockers"]:
        failures = [c for c in res["checks"] if c["status"] == "fail" and c.get("blocker")]
        names = ", ".join(c["label"] for c in failures)
        raise ValidationError(f"Tidak dapat lock: blocker check gagal — {names}", code="LOCKING_BLOCKED")
    return await _transition(period, to_status="locked", user=user, reason=reason, allowed_from=("open", "closed"))


async def reopen_period(period: str, *, user: dict, reason: str) -> dict:
    """Reopen a closed/locked period. Reason mandatory."""
    if not reason or not reason.strip():
        raise ValidationError("Alasan reopen wajib")
    return await _transition(period, to_status="open", user=user, reason=reason.strip(), allowed_from=("closed", "locked"))

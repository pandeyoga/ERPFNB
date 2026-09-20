"""HR sub-module: Employee Advances (Kasbon).

Auto-extracted from former monolithic hr_service.py for maintainability.
"""
import uuid
from datetime import datetime, timezone
from typing import Optional

from core.audit import log as audit_log
from core.db import get_db, serialize
from core.exceptions import (
    NotFoundError, ValidationError,
)
from services import approval_service, journal_service
from services.hr_constants import _now, _today
from utils.number_series import next_doc_no


def _build_schedule(principal: float, terms_months: int, start_date: str) -> tuple[float, list[dict]]:
    """Build flat amortization schedule (equal installments)."""
    if terms_months <= 0:
        terms_months = 1
    monthly = round(principal / terms_months, 2)
    # Last installment absorbs rounding diff
    schedule: list[dict] = []
    remaining = principal
    try:
        anchor = datetime.strptime(start_date, "%Y-%m-%d")
    except Exception:
        anchor = datetime.now(timezone.utc)
    for i in range(terms_months):
        # Due date: same day next i+1 months (clip to month end if needed)
        y = anchor.year
        m = anchor.month + i + 1
        while m > 12:
            m -= 12
            y += 1
        d = anchor.day
        # Clip d to last day of month
        if m == 2 and d > 28:
            d = 28
        elif m in (4, 6, 9, 11) and d > 30:
            d = 30
        try:
            due = datetime(y, m, d).strftime("%Y-%m-%d")
        except Exception:
            due = f"{y:04d}-{m:02d}-28"
        amount = monthly if i < terms_months - 1 else round(remaining, 2)
        remaining -= amount
        schedule.append({
            "period": f"{y:04d}-{m:02d}",
            "due_date": due,
            "amount": amount,
            "paid": False,
            "paid_at": None,
        })
    return monthly, schedule


async def list_advances(
    *, employee_id: Optional[str] = None, outlet_id: Optional[str] = None,
    status: Optional[str] = None,
    page: int = 1, per_page: int = 20,
):
    db = get_db()
    q: dict = {"deleted_at": None}
    if employee_id:
        q["employee_id"] = employee_id
    if outlet_id:
        q["outlet_id"] = outlet_id
    if status:
        q["status"] = status
    skip = (page - 1) * per_page
    items = await db.employee_advances.find(q).sort([("advance_date", -1), ("created_at", -1)]).skip(skip).limit(per_page).to_list(per_page)
    total = await db.employee_advances.count_documents(q)
    # Enrich with employee name
    emp_ids = list({d.get("employee_id") for d in items if d.get("employee_id")})
    emp_map: dict = {}
    if emp_ids:
        async for e in db.employees.find({"id": {"$in": emp_ids}}):
            emp_map[e["id"]] = e.get("full_name", e["id"])
    out = []
    for d in items:
        s = serialize(d)
        s["employee_name"] = emp_map.get(s.get("employee_id"))
        out.append(s)
    return out, {"page": page, "per_page": per_page, "total": total}


async def get_advance(adv_id: str) -> dict:
    db = get_db()
    d = await db.employee_advances.find_one({"id": adv_id, "deleted_at": None})
    if not d:
        raise NotFoundError("Employee advance tidak ditemukan")
    s = serialize(d)
    if s.get("employee_id"):
        emp = await db.employees.find_one({"id": s["employee_id"]})
        if emp:
            s["employee_name"] = emp.get("full_name")
    return s


async def create_advance(payload: dict, *, user: dict) -> dict:
    db = get_db()
    employee_id = payload.get("employee_id")
    if not employee_id:
        raise ValidationError("employee_id wajib")
    emp = await db.employees.find_one({"id": employee_id, "deleted_at": None})
    if not emp:
        raise ValidationError("Employee tidak ditemukan")

    principal = float(payload.get("principal", 0) or 0)
    if principal <= 0:
        raise ValidationError("principal harus > 0")
    terms_months = int(payload.get("terms_months", 1) or 1)
    if terms_months < 1 or terms_months > 24:
        raise ValidationError("terms_months 1..24")
    advance_date = payload.get("advance_date") or _today()
    monthly, schedule = _build_schedule(principal, terms_months, advance_date)
    doc_no = await next_doc_no("EA")
    doc = {
        "id": str(uuid.uuid4()),
        "doc_no": doc_no,
        "employee_id": employee_id,
        "outlet_id": payload.get("outlet_id") or emp.get("outlet_id"),
        "advance_date": advance_date,
        "principal": principal,
        "terms_months": terms_months,
        "monthly_installment": monthly,
        "schedule": schedule,
        "status": "draft",
        "reason": payload.get("reason"),
        "payment_method_id": payload.get("payment_method_id"),
        "approved_by": None, "approved_at": None,
        "disbursed_at": None,
        "journal_entry_id": None,
        "settled_at": None,
        "notes": payload.get("notes"),
        "created_at": _now(), "updated_at": _now(), "deleted_at": None,
        "created_by": user["id"],
    }
    await db.employee_advances.insert_one(doc)
    await audit_log(user_id=user["id"], entity_type="employee_advance",
                    entity_id=doc["id"], action="create")
    return await get_advance(doc["id"])


async def submit_advance_for_approval(adv_id: str, *, user: dict) -> dict:
    """Move EA from draft → awaiting_approval (engine flow starts)."""
    db = get_db()
    d = await db.employee_advances.find_one({"id": adv_id, "deleted_at": None})
    if not d:
        raise NotFoundError("Employee advance tidak ditemukan")
    if d["status"] != "draft":
        raise ValidationError(f"Hanya draft yang bisa di-submit. Status saat ini: {d['status']}")
    await db.employee_advances.update_one(
        {"id": adv_id},
        {"$set": {"status": "awaiting_approval", "submitted_at": _now(), "updated_at": _now()}},
    )
    await audit_log(user_id=user["id"], entity_type="employee_advance",
                    entity_id=adv_id, action="submit")
    fresh = await db.employee_advances.find_one({"id": adv_id})
    fresh_s = serialize(fresh)
    try:
        state = await approval_service.evaluate("employee_advance", fresh_s)
        await approval_service.notify_pending_approvers(
            "employee_advance", fresh_s, state=state, triggered_by=user,
        )
    except Exception:  # noqa: BLE001
        pass
    return await get_advance(adv_id)


async def approve_advance(adv_id: str, *, user: dict, note: str | None = None) -> dict:
    """Multi-tier approve via engine. On final approval, disburse + post JE."""
    db = get_db()
    d = await db.employee_advances.find_one({"id": adv_id, "deleted_at": None})
    if not d:
        raise NotFoundError("Employee advance tidak ditemukan")
    # Engine accepts draft / submitted / awaiting_approval
    if d["status"] not in ("draft", "submitted", "awaiting_approval"):
        raise ValidationError(f"Status saat ini: {d['status']} tidak bisa di-approve")

    # Detect workflow presence: when no workflow is configured, preserve LEGACY behavior
    state = await approval_service.evaluate("employee_advance", serialize(d))
    has_wf = bool(state.get("has_workflow"))

    if not has_wf:
        # LEGACY: single-step + immediate disburse
        # Accept draft, submitted, atau awaiting_approval (semua status pre-workflow)
        if d["status"] not in ("draft", "submitted", "awaiting_approval"):
            raise ValidationError(f"Status saat ini: {d['status']} tidak bisa di-approve (legacy)")
        je = await journal_service.post_for_employee_advance(
            {**d, "disbursed_at": _now()}, user_id=user["id"],
        )
        await db.employee_advances.update_one(
            {"id": adv_id},
            {"$set": {
                "status": "repaying",
                "approved_at": _now(), "approved_by": user["id"],
                "disbursed_at": _now(),
                "journal_entry_id": je["id"] if je else None,
                "updated_at": _now(),
            }},
        )
        await audit_log(user_id=user["id"], entity_type="employee_advance",
                        entity_id=adv_id, action="approve")
        return await get_advance(adv_id)

    # WORKFLOW: delegate to engine; if completed → disburse
    res = await approval_service.approve("employee_advance", adv_id, user=user, note=note)
    entity = res["entity"]
    if entity.get("status") == "approved" and not entity.get("journal_entry_id"):
        je = await journal_service.post_for_employee_advance(
            {**entity, "disbursed_at": _now()}, user_id=user["id"],
        )
        await db.employee_advances.update_one(
            {"id": adv_id},
            {"$set": {
                "status": "repaying",
                "approved_at": _now(), "approved_by": user["id"],
                "disbursed_at": _now(),
                "journal_entry_id": je["id"] if je else None,
                "updated_at": _now(),
            }},
        )
    await audit_log(user_id=user["id"], entity_type="employee_advance",
                    entity_id=adv_id, action="approve_step")
    return await get_advance(adv_id)


async def reject_advance(adv_id: str, *, user: dict, reason: str) -> dict:
    res = await approval_service.reject("employee_advance", adv_id, user=user, reason=reason)
    return res["entity"]


async def get_advance_approval_state(adv_id: str) -> dict:
    db = get_db()
    d = await db.employee_advances.find_one({"id": adv_id, "deleted_at": None})
    if not d:
        raise NotFoundError("Employee advance tidak ditemukan")
    return await approval_service.evaluate("employee_advance", serialize(d))


async def mark_advance_installment_paid(adv_id: str, period: str, *, user: dict) -> dict:
    """Mark a schedule line as paid (finance staff/HR action). Does not generate JE — payroll posting handles offset."""
    db = get_db()
    d = await db.employee_advances.find_one({"id": adv_id, "deleted_at": None})
    if not d:
        raise NotFoundError("Employee advance tidak ditemukan")
    schedule = d.get("schedule", [])
    found = False
    for line in schedule:
        if line.get("period") == period and not line.get("paid"):
            line["paid"] = True
            line["paid_at"] = _now()
            found = True
            break
    if not found:
        raise ValidationError(f"Schedule line {period} tidak ditemukan / sudah paid")
    all_paid = all(item.get("paid") for item in schedule)
    update: dict = {"schedule": schedule, "updated_at": _now()}
    if all_paid:
        update["status"] = "settled"
        update["settled_at"] = _now()
    await db.employee_advances.update_one({"id": adv_id}, {"$set": update})
    await audit_log(user_id=user["id"], entity_type="employee_advance",
                    entity_id=adv_id, action="mark_paid",
                    after={"period": period})
    return await get_advance(adv_id)

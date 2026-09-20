"""HR Payroll cycle (create, approve, post)."""
from __future__ import annotations

import uuid
from typing import Optional

from core.audit import log as audit_log
from core.db import get_db, serialize
from core.exceptions import ConflictError, NotFoundError, ValidationError
from services import journal_service
from utils.number_series import next_doc_no
from services.hr_constants import _calc_bpjs, _calc_pph21, _now, _period_now, PTKP_BY_STATUS


async def list_payroll(*, period: Optional[str] = None, status: Optional[str] = None, page: int = 1, per_page: int = 20):
    db = get_db()
    q: dict = {"deleted_at": None}
    if period:
        q["period"] = period
    if status:
        q["status"] = status
    skip = (page - 1) * per_page
    items = await db.payroll_cycles.find(q).sort([("period", -1), ("created_at", -1)]).skip(skip).limit(per_page).to_list(per_page)
    total = await db.payroll_cycles.count_documents(q)
    return [serialize(d) for d in items], {"page": page, "per_page": per_page, "total": total}


async def get_payroll(p_id: str) -> dict:
    db = get_db()
    d = await db.payroll_cycles.find_one({"id": p_id, "deleted_at": None})
    if not d:
        raise NotFoundError("Payroll cycle tidak ditemukan")
    return serialize(d)


async def create_payroll(payload: dict, *, user: dict) -> dict:
    """Generate payroll cycle with BPJS/PPh21/advance computations."""
    from services.system_settings_service import get_value as _get_val  # noqa: avoid circular
    db = get_db()
    period = payload.get("period") or _period_now()
    outlet_id = payload.get("outlet_id")
    if await db.payroll_cycles.find_one({"period": period, "outlet_id": outlet_id, "status": {"$in": ["draft", "approved"]}, "deleted_at": None}):
        raise ConflictError(f"Payroll {period} sudah ada (draft/approved); selesaikan atau hapus dulu")

    pph21_enabled = str(await _get_val("TAX_PPH21_ENABLED") or "false").lower() == "true"
    pph21_method = str(await _get_val("TAX_PPH21_METHOD") or "gross")

    emp_filter = {"deleted_at": None, "status": "active"}
    if outlet_id:
        emp_filter["outlet_id"] = outlet_id

    all_employees_raw = await db.employees.find(emp_filter).to_list(500)
    emp_ids = [e["id"] for e in all_employees_raw]
    sms_raw = await db.salary_masters.find({"employee_id": {"$in": emp_ids}, "deleted_at": None}).to_list(len(emp_ids) + 1) if emp_ids else []
    sm_by_emp = {s["employee_id"]: s for s in sms_raw}

    employees: list[dict] = []
    total_gross = total_bpjs_employee = total_pph21 = total_deductions = total_allowances = total_advance_repay = total_take_home = total_bpjs_employer = 0.0

    async for e in db.employees.find(emp_filter):
        sm = sm_by_emp.get(e["id"])
        basic = float(e.get("basic_salary", 0) or 0)
        if sm and sm.get("basic_salary"):
            basic = float(sm.get("basic_salary") or basic)
        allowances_total = 0.0
        allowances_list = []
        if sm:
            for comp in sm.get("components", []):
                amt = float(comp.get("amount", 0) or 0)
                allowances_total += amt
                allowances_list.append({"code": comp.get("code", ""), "name": comp.get("name", ""), "amount": amt})

        advances = await db.employee_advances.find({"employee_id": e["id"], "status": {"$in": ["repaying"]}, "deleted_at": None}).to_list(20)
        repay_amount = 0.0
        for a in advances:
            for line in a.get("schedule", []):
                if line.get("period") == period and not line.get("paid"):
                    repay_amount += float(line.get("amount", 0) or 0)

        sc_share = 0.0
        sc = await db.service_charge_periods.find_one({"period": period, "outlet_id": e.get("outlet_id"), "status": "posted", "deleted_at": None})
        if sc:
            for alloc in sc.get("allocations", []):
                if alloc.get("employee_id") == e["id"]:
                    sc_share = float(alloc.get("amount", 0) or 0)
                    break

        inc_share = 0.0
        runs = await db.incentive_runs.find({"period": period, "status": "posted", "deleted_at": None}).to_list(50)
        for r in runs:
            for alloc in r.get("allocations", []):
                if alloc.get("employee_id") == e["id"]:
                    inc_share += float(alloc.get("amount", 0) or 0)

        gross_total = round(basic + allowances_total + sc_share + inc_share, 2)
        bpjs_enrolled = sm.get("bpjs_enrolled", True) if sm else True
        bpjs = _calc_bpjs(basic + allowances_total, bpjs_enrolled)
        pph21_monthly = 0.0
        pph21_detail: dict = {}
        if pph21_enabled:
            ptkp_status = sm.get("ptkp_status", "TK/0") if sm else "TK/0"
            result21 = _calc_pph21(gross_total, ptkp_status)
            pph21_monthly = result21["monthly_tax"]
            pph21_detail = {**result21, "method": pph21_method}
        deductions = round(bpjs["employee"] + pph21_monthly, 2)
        take_home = round(gross_total - deductions - repay_amount, 2)
        employees.append({
            "employee_id": e["id"], "name": e.get("full_name"), "outlet_id": e.get("outlet_id"),
            "basic": basic, "allowances_total": allowances_total, "allowances": allowances_list,
            "service_share": sc_share, "incentive_share": inc_share, "gross": gross_total,
            "bpjs_employee": bpjs["employee"], "bpjs_employer": bpjs["employer"],
            "bpjs_detail": bpjs.get("detail", {}), "pph21": pph21_monthly, "pph21_detail": pph21_detail,
            "deductions": deductions, "variable_pay": round(sc_share + inc_share, 2),
            "advance_repayment": repay_amount, "take_home": take_home,
            "ptkp_status": sm.get("ptkp_status", "TK/0") if sm else "TK/0",
        })
        total_gross += gross_total
        total_bpjs_employee += bpjs["employee"]
        total_bpjs_employer += bpjs["employer"]
        total_pph21 += pph21_monthly
        total_deductions += deductions
        total_allowances += round(sc_share + inc_share, 2)
        total_advance_repay += repay_amount
        total_take_home += take_home

    doc_no = await next_doc_no("PAY")
    doc = {
        "id": str(uuid.uuid4()), "doc_no": doc_no, "period": period, "outlet_id": outlet_id,
        "payroll_date": payload.get("payroll_date") or f"{period}-25",
        "employees": employees,
        "total_gross": round(total_gross, 2), "total_deductions": round(total_deductions, 2),
        "total_allowances": round(total_allowances, 2), "total_bpjs_employee": round(total_bpjs_employee, 2),
        "total_bpjs_employer": round(total_bpjs_employer, 2), "total_pph21": round(total_pph21, 2),
        "total_advance_repayment": round(total_advance_repay, 2), "total_take_home": round(total_take_home, 2),
        "pph21_enabled": pph21_enabled, "status": "draft",
        "approved_at": None, "approved_by": None, "posted_at": None, "posted_by": None, "journal_entry_id": None,
        "notes": payload.get("notes"), "created_at": _now(), "updated_at": _now(), "deleted_at": None,
        "created_by": user["id"],
    }
    await db.payroll_cycles.insert_one(doc)
    await audit_log(user_id=user["id"], entity_type="payroll_cycle", entity_id=doc["id"], action="create")
    return serialize(doc)


async def approve_payroll(p_id: str, *, user: dict) -> dict:
    db = get_db()
    d = await db.payroll_cycles.find_one({"id": p_id, "deleted_at": None})
    if not d:
        raise NotFoundError("Payroll cycle tidak ditemukan")
    if d["status"] != "draft":
        raise ValidationError(f"Status saat ini: {d['status']}")
    await db.payroll_cycles.update_one({"id": p_id}, {"$set": {"status": "approved", "approved_at": _now(), "approved_by": user["id"], "updated_at": _now()}})
    return await get_payroll(p_id)


async def post_payroll(p_id: str, *, user: dict) -> dict:
    db = get_db()
    d = await db.payroll_cycles.find_one({"id": p_id, "deleted_at": None})
    if not d:
        raise NotFoundError("Payroll cycle tidak ditemukan")
    if d["status"] not in ("approved", "draft"):
        raise ValidationError(f"Status saat ini: {d['status']}")
    je = await journal_service.post_for_payroll(d, user_id=user["id"])
    period = d.get("period")
    for emp in d.get("employees", []):
        if float(emp.get("advance_repayment", 0) or 0) > 0:
            advances = await db.employee_advances.find({"employee_id": emp["employee_id"], "status": "repaying", "deleted_at": None}).to_list(20)
            for a in advances:
                schedule = a.get("schedule", [])
                changed = False
                for line in schedule:
                    if line.get("period") == period and not line.get("paid"):
                        line["paid"] = True
                        line["paid_at"] = _now()
                        changed = True
                        break
                if changed:
                    all_paid = all(item.get("paid") for item in schedule)
                    update: dict = {"schedule": schedule, "updated_at": _now()}
                    if all_paid:
                        update["status"] = "settled"
                        update["settled_at"] = _now()
                    await db.employee_advances.update_one({"id": a["id"]}, {"$set": update})
    await db.payroll_cycles.update_one({"id": p_id}, {"$set": {"status": "posted", "posted_at": _now(), "posted_by": user["id"], "journal_entry_id": je["id"] if je else None, "updated_at": _now()}})
    await audit_log(user_id=user["id"], entity_type="payroll_cycle", entity_id=p_id, action="post")
    return await get_payroll(p_id)

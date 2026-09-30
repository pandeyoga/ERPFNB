"""HR Payroll cycle (create, approve, post, cancel)."""
from __future__ import annotations

import re
import uuid
from typing import Optional

from core.audit import log as audit_log
from core.db import get_db, serialize
from core.exceptions import ConflictError, NotFoundError, ValidationError
from services import journal_service
from utils.number_series import next_doc_no
from services.hr_constants import _calc_bpjs, _calc_pph21, _now, _period_now

# CTL-10: employees on leave ("Cuti") stay on payroll; only terminated are excluded
PAYROLL_EMPLOYEE_STATUSES = ["active", "leave"]
ACTIVE_CYCLE_STATUSES = ["draft", "approved", "posting", "posted"]


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


async def _variable_sources(db, period: str, outlet_id: Optional[str], emp_ids: set) -> tuple[dict, dict, list, list]:
    """Posted SC/incentive allocations relevant to this payroll → (sc_by_emp, inc_by_emp, sc_ids, inc_ids)."""
    sc_q: dict = {"period": period, "status": "posted", "deleted_at": None}
    if outlet_id:
        sc_q["outlet_id"] = outlet_id
    sc_by_emp: dict = {}
    sc_ids: list = []
    async for sc in db.service_charge_periods.find(sc_q):
        hit = False
        for a in sc.get("allocations", []):
            if a.get("employee_id") in emp_ids:
                sc_by_emp[a["employee_id"]] = sc_by_emp.get(a["employee_id"], 0.0) + float(a.get("amount", 0) or 0)
                hit = True
        if hit:
            sc_ids.append(sc["id"])
    inc_by_emp: dict = {}
    inc_ids: list = []
    async for r in db.incentive_runs.find({"period": period, "status": "posted", "deleted_at": None}):
        hit = False
        for a in r.get("allocations", []):
            if a.get("employee_id") in emp_ids:
                inc_by_emp[a["employee_id"]] = inc_by_emp.get(a["employee_id"], 0.0) + float(a.get("amount", 0) or 0)
                hit = True
        if hit:
            inc_ids.append(r["id"])
    return sc_by_emp, inc_by_emp, sorted(sc_ids), sorted(inc_ids)


async def _assert_sources_unchanged(db, d: dict) -> None:
    refs = d.get("source_refs")
    if refs is None:  # legacy cycle without snapshot
        return
    emp_ids = {e["employee_id"] for e in d.get("employees", [])}
    _, _, sc_ids, inc_ids = await _variable_sources(db, d["period"], d.get("outlet_id"), emp_ids)
    if sc_ids != refs.get("service_charge_ids", []) or inc_ids != refs.get("incentive_run_ids", []):
        raise ValidationError(
            "Service charge / insentif periode ini berubah sejak payroll dibuat. "
            "Batalkan payroll ini lalu generate ulang agar porsi SC/insentif ikut terbayar.")


async def create_payroll(payload: dict, *, user: dict) -> dict:
    """Generate payroll cycle with BPJS/PPh21/advance computations. Salary Master is the single pay source."""
    from services.system_settings_service import get_value as _get_val  # noqa: avoid circular
    db = get_db()
    period = payload.get("period") or _period_now()
    if not re.fullmatch(r"\d{4}-(0[1-9]|1[0-2])", str(period)):
        raise ValidationError("Format period harus YYYY-MM", field="period")
    outlet_id = payload.get("outlet_id") or None
    # P0-03: block duplicates incl. posted, and overlap between all-outlet vs per-outlet runs
    dup_q: dict = {"period": period, "status": {"$in": ACTIVE_CYCLE_STATUSES}, "deleted_at": None}
    if outlet_id:
        dup_q["outlet_id"] = {"$in": [outlet_id, None]}
    dup = await db.payroll_cycles.find_one(dup_q)
    if dup:
        raise ConflictError(f"Payroll {period} sudah ada ({dup.get('status')}, outlet={dup.get('outlet_id') or 'ALL'})")

    pph21_enabled = str(await _get_val("TAX_PPH21_ENABLED") or "false").lower() == "true"
    pph21_method = str(await _get_val("TAX_PPH21_METHOD") or "gross")

    emp_filter: dict = {
        "deleted_at": None, "status": {"$in": PAYROLL_EMPLOYEE_STATUSES},
        # employees joining after the period are not yet on payroll
        "$or": [{"join_date": {"$in": [None, ""]}}, {"join_date": {"$exists": False}}, {"join_date": {"$lte": f"{period}-31"}}],
    }
    if outlet_id:
        emp_filter["outlet_id"] = outlet_id
    emps = await db.employees.find(emp_filter).sort("full_name", 1).to_list(None)
    if not emps:
        raise ValidationError("Tidak ada karyawan aktif/cuti untuk periode & outlet ini")
    emp_ids = [e["id"] for e in emps]
    sms = await db.salary_masters.find({"employee_id": {"$in": emp_ids}, "deleted_at": None}).to_list(None)
    sm_by_emp = {s["employee_id"]: s for s in sms}
    missing = [e.get("full_name") or e.get("code") for e in emps if e["id"] not in sm_by_emp]
    if missing:
        more = f" (+{len(missing) - 10} lainnya)" if len(missing) > 10 else ""
        raise ValidationError(
            f"{len(missing)} karyawan belum punya Salary Master: {', '.join(missing[:10])}{more}. "
            "Atur dulu di HR → Payroll → Salary Master.")

    sc_by_emp, inc_by_emp, sc_ids, inc_ids = await _variable_sources(db, period, outlet_id, set(emp_ids))
    adv_by_emp: dict = {}
    async for a in db.employee_advances.find({"employee_id": {"$in": emp_ids}, "status": "repaying", "deleted_at": None}):
        for line in a.get("schedule", []):
            if line.get("period") == period and not line.get("paid"):
                adv_by_emp.setdefault(a["employee_id"], []).append(
                    {"advance_id": a["id"], "doc_no": a.get("doc_no"), "period": period,
                     "amount": float(line.get("amount", 0) or 0)})
                break

    employees: list[dict] = []
    warnings: list[str] = []
    totals = dict.fromkeys(("gross", "bpjs_emp", "bpjs_er", "pph21", "ded", "var", "adv", "th"), 0.0)
    for e in emps:
        sm = sm_by_emp[e["id"]]
        basic = float(sm.get("basic_salary", 0) or 0)
        allowances_list = [{"code": c.get("code", ""), "name": c.get("name", ""), "amount": float(c.get("amount", 0) or 0)}
                           for c in sm.get("components", [])]
        allowances_total = round(sum(c["amount"] for c in allowances_list), 2)
        sc_share = round(sc_by_emp.get(e["id"], 0.0), 2)
        inc_share = round(inc_by_emp.get(e["id"], 0.0), 2)
        gross_total = round(basic + allowances_total + sc_share + inc_share, 2)
        bpjs = _calc_bpjs(basic + allowances_total, sm.get("bpjs_enrolled", True))
        ptkp_status = sm.get("ptkp_status", "TK/0")
        pph21_monthly = 0.0
        pph21_detail: dict = {}
        if pph21_enabled:
            result21 = _calc_pph21(gross_total, ptkp_status)
            pph21_monthly = result21["monthly_tax"]
            pph21_detail = {**result21, "method": pph21_method}
        deductions = round(bpjs["employee"] + pph21_monthly, 2)
        advance_lines = adv_by_emp.get(e["id"], [])
        repay_amount = round(sum(x["amount"] for x in advance_lines), 2)
        if gross_total - deductions - repay_amount < 0:
            warnings.append(f"{e.get('full_name')}: cicilan kasbon {repay_amount:,.0f} melebihi gaji bersih — tidak dipotong periode ini")
            advance_lines, repay_amount = [], 0.0
        take_home = round(gross_total - deductions - repay_amount, 2)
        employees.append({
            "employee_id": e["id"], "name": e.get("full_name"), "code": e.get("code"), "outlet_id": e.get("outlet_id"),
            "employment_status": e.get("status"),
            "basic": basic, "allowances_total": allowances_total, "allowances": allowances_list,
            "service_share": sc_share, "incentive_share": inc_share, "gross": gross_total,
            "bpjs_employee": bpjs["employee"], "bpjs_employer": bpjs["employer"],
            "bpjs_detail": bpjs.get("detail", {}), "pph21": pph21_monthly, "pph21_detail": pph21_detail,
            "deductions": deductions, "variable_pay": round(sc_share + inc_share, 2),
            "advance_repayment": repay_amount, "advance_lines": advance_lines, "take_home": take_home,
            "ptkp_status": ptkp_status,
        })
        if e.get("status") == "leave":
            warnings.append(f"{e.get('full_name')}: berstatus Cuti — tetap digaji penuh")
        totals["gross"] += gross_total
        totals["bpjs_emp"] += bpjs["employee"]
        totals["bpjs_er"] += bpjs["employer"]
        totals["pph21"] += pph21_monthly
        totals["ded"] += deductions
        totals["var"] += sc_share + inc_share
        totals["adv"] += repay_amount
        totals["th"] += take_home

    doc_no = await next_doc_no("PAYR")
    doc = {
        "id": str(uuid.uuid4()), "doc_no": doc_no, "period": period, "outlet_id": outlet_id,
        "payroll_date": payload.get("payroll_date") or f"{period}-25",
        "employees": employees, "warnings": warnings,
        "source_refs": {"service_charge_ids": sc_ids, "incentive_run_ids": inc_ids},
        "total_gross": round(totals["gross"], 2), "total_deductions": round(totals["ded"], 2),
        "total_allowances": round(totals["var"], 2), "total_bpjs_employee": round(totals["bpjs_emp"], 2),
        "total_bpjs_employer": round(totals["bpjs_er"], 2), "total_pph21": round(totals["pph21"], 2),
        "total_advance_repayment": round(totals["adv"], 2), "total_take_home": round(totals["th"], 2),
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
    if d.get("created_by") == user["id"]:
        raise ValidationError("Pembuat payroll tidak boleh meng-approve sendiri (SoD)")
    await _assert_sources_unchanged(db, d)
    res = await db.payroll_cycles.update_one(
        {"id": p_id, "status": "draft"},
        {"$set": {"status": "approved", "approved_at": _now(), "approved_by": user["id"], "updated_at": _now()}})
    if not res.modified_count:
        raise ConflictError("Payroll sudah diproses oleh user lain")
    await audit_log(user_id=user["id"], entity_type="payroll_cycle", entity_id=p_id, action="approve")
    return await get_payroll(p_id)


async def _preflight_advances(db, d: dict) -> None:
    """Advance lines deducted in this payroll must still be unpaid (no manual cash repayment in between)."""
    for emp in d.get("employees", []):
        for line in emp.get("advance_lines", []):
            adv = await db.employee_advances.find_one({"id": line["advance_id"], "deleted_at": None})
            sched = next((s for s in (adv or {}).get("schedule", []) if s.get("period") == line["period"]), None)
            if not adv or not sched or sched.get("paid"):
                raise ValidationError(
                    f"Cicilan kasbon {line.get('doc_no') or line['advance_id']} ({emp.get('name')}) periode {line['period']} "
                    "sudah dibayar di luar payroll. Batalkan payroll ini lalu generate ulang.")


async def _settle_advances(db, d: dict, p_id: str) -> None:
    period = d.get("period")
    for emp in d.get("employees", []):
        lines = emp.get("advance_lines")
        if lines is None and float(emp.get("advance_repayment", 0) or 0) > 0:  # legacy cycle
            lines = [{"advance_id": a["id"], "period": period} async for a in db.employee_advances.find(
                {"employee_id": emp["employee_id"], "status": "repaying", "deleted_at": None})]
        for line in lines or []:
            await db.employee_advances.update_one(
                {"id": line["advance_id"], "schedule": {"$elemMatch": {"period": line["period"], "paid": {"$ne": True}}}},
                {"$set": {"schedule.$.paid": True, "schedule.$.paid_at": _now(),
                          "schedule.$.paid_via": "payroll", "schedule.$.payroll_id": p_id, "updated_at": _now()}})
            adv = await db.employee_advances.find_one({"id": line["advance_id"]})
            if adv and adv.get("status") == "repaying" and all(s.get("paid") for s in adv.get("schedule", [])):
                await db.employee_advances.update_one(
                    {"id": adv["id"], "status": "repaying"},
                    {"$set": {"status": "settled", "settled_at": _now(), "updated_at": _now()}})


async def post_payroll(p_id: str, *, user: dict) -> dict:
    db = get_db()
    d = await db.payroll_cycles.find_one({"id": p_id, "deleted_at": None})
    if not d:
        raise NotFoundError("Payroll cycle tidak ditemukan")
    if d["status"] != "approved":
        raise ValidationError(f"Payroll harus di-approve dulu. Status saat ini: {d['status']}")
    await _assert_sources_unchanged(db, d)
    await _preflight_advances(db, d)
    # atomic claim: concurrent post requests cannot both proceed
    claimed = await db.payroll_cycles.find_one_and_update(
        {"id": p_id, "status": "approved"}, {"$set": {"status": "posting", "updated_at": _now()}})
    if not claimed:
        raise ConflictError("Payroll sedang/sudah di-post oleh user lain")
    try:
        je = await journal_service.post_for_payroll(d, user_id=user["id"])
        await _settle_advances(db, d, p_id)
    except Exception:
        await db.payroll_cycles.update_one({"id": p_id, "status": "posting"}, {"$set": {"status": "approved", "updated_at": _now()}})
        raise
    await db.payroll_cycles.update_one({"id": p_id}, {"$set": {"status": "posted", "posted_at": _now(), "posted_by": user["id"], "journal_entry_id": je["id"] if je else None, "updated_at": _now()}})
    await audit_log(user_id=user["id"], entity_type="payroll_cycle", entity_id=p_id, action="post")
    return await get_payroll(p_id)


async def cancel_payroll(p_id: str, reason: str, *, user: dict) -> dict:
    """Draft/approved payroll can be cancelled (e.g. to regenerate after SC/salary changes)."""
    db = get_db()
    reason = (reason or "").strip()
    if len(reason) < 5:
        raise ValidationError("Alasan pembatalan wajib diisi (min. 5 karakter)", field="reason")
    res = await db.payroll_cycles.find_one_and_update(
        {"id": p_id, "deleted_at": None, "status": {"$in": ["draft", "approved"]}},
        {"$set": {"status": "cancelled", "cancelled_at": _now(), "cancelled_by": user["id"],
                  "cancel_reason": reason, "updated_at": _now()}})
    if not res:
        d = await db.payroll_cycles.find_one({"id": p_id, "deleted_at": None})
        if not d:
            raise NotFoundError("Payroll cycle tidak ditemukan")
        raise ValidationError(f"Hanya payroll draft/approved yang bisa dibatalkan. Status saat ini: {d['status']}")
    await audit_log(user_id=user["id"], entity_type="payroll_cycle", entity_id=p_id, action="cancel", reason=reason)
    return await get_payroll(p_id)


async def open_payroll_covering(db, period: str, outlet_id: Optional[str], statuses: list) -> Optional[dict]:
    """Payroll cycle for `period` that covers `outlet_id` (per-outlet or group-wide)."""
    q: dict = {"period": period, "status": {"$in": statuses}, "deleted_at": None}
    if outlet_id:
        q["outlet_id"] = {"$in": [outlet_id, None]}
    return await db.payroll_cycles.find_one(q)

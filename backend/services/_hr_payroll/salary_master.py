"""Salary Master CRUD and import. Salary Master is the single source of employee pay (CTL-10)."""
from __future__ import annotations

import csv
import uuid

from core.audit import log as audit_log
from core.db import get_db, serialize
from core.exceptions import NotFoundError, ValidationError
from services.hr_constants import _calc_bpjs, _calc_pph21, _now, PTKP_BY_STATUS

STANDARD_COMPONENTS = [
    {"code": "TUNJ_JABATAN",   "name": "Tunjangan Jabatan",    "amount": 0.0},
    {"code": "TUNJ_MAKAN",     "name": "Tunjangan Makan",      "amount": 0.0},
    {"code": "TUNJ_TRANSPORT", "name": "Tunjangan Transport",  "amount": 0.0},
    {"code": "TUNJ_KESEHATAN", "name": "Tunjangan Kesehatan",  "amount": 0.0},
]
PTKP_OPTIONS = list(PTKP_BY_STATUS.keys())
LEGACY_EMPLOYEE_SALARY_FIELDS = ("basic_salary", "gross_salary", "salary")
PAYROLL_EMPLOYEE_STATUSES = ["active", "leave"]


def standard_components() -> list[dict]:
    return [dict(c) for c in STANDARD_COMPONENTS]


def _summary(sm: dict | None) -> dict:
    basic = float((sm or {}).get("basic_salary", 0) or 0)
    allowances_total = round(sum(float(c.get("amount", 0) or 0) for c in (sm or {}).get("components", [])), 2)
    return {
        "has_master": sm is not None, "basic_salary": basic, "allowances_total": allowances_total,
        "total_fixed_pay": round(basic + allowances_total, 2),
        "bpjs_enrolled": (sm or {}).get("bpjs_enrolled", True), "ptkp_status": (sm or {}).get("ptkp_status", "TK/0"),
        "updated_at": (sm or {}).get("updated_at"),
    }


async def salary_summary_map(employee_ids: list[str]) -> dict[str, dict]:
    """Read-only salary snapshot per employee (used by the employee master form)."""
    if not employee_ids:
        return {}
    db = get_db()
    sms = await db.salary_masters.find({"employee_id": {"$in": employee_ids}, "deleted_at": None}).to_list(None)
    by_emp = {s["employee_id"]: s for s in sms}
    return {eid: _summary(by_emp.get(eid)) for eid in employee_ids}


async def get_salary_master(employee_id: str) -> dict:
    db = get_db()
    emp = await db.employees.find_one({"id": employee_id, "deleted_at": None})
    if not emp:
        raise NotFoundError("Karyawan tidak ditemukan")
    sm = await db.salary_masters.find_one({"employee_id": employee_id, "deleted_at": None})
    base = {"employee_name": emp.get("full_name"), "outlet_id": emp.get("outlet_id"), "employee_status": emp.get("status")}
    if not sm:
        return {"employee_id": employee_id, **base, "basic_salary": 0.0, "components": standard_components(),
                "bpjs_enrolled": True, "ptkp_status": "TK/0", "npwp": emp.get("npwp", ""), "notes": "",
                "is_default": True, "has_master": False}
    return serialize({**sm, **base, "is_default": False, "has_master": True})


def _clean_payload(payload: dict, prev: dict) -> dict:
    try:
        basic = float(payload.get("basic_salary", prev.get("basic_salary", 0)) or 0)
        comps = [{"code": (c.get("code") or "MISC").strip(), "name": c.get("name", ""), "amount": float(c.get("amount", 0) or 0)}
                 for c in payload.get("components", prev.get("components", []))]
    except (TypeError, ValueError):
        raise ValidationError("Nominal gaji/tunjangan harus berupa angka")
    if basic < 0 or any(c["amount"] < 0 for c in comps):
        raise ValidationError("Gaji pokok dan tunjangan tidak boleh negatif")
    if len({c["code"] for c in comps}) != len(comps):
        raise ValidationError("Kode komponen tunjangan tidak boleh duplikat")
    ptkp = str(payload.get("ptkp_status", prev.get("ptkp_status", "TK/0")) or "TK/0").upper()
    if ptkp not in PTKP_BY_STATUS:
        raise ValidationError(f"Status PTKP tidak valid: {ptkp}", field="ptkp_status")
    return {"basic_salary": round(basic, 2), "components": comps,
            "bpjs_enrolled": bool(payload.get("bpjs_enrolled", prev.get("bpjs_enrolled", True))),
            "ptkp_status": ptkp, "notes": payload.get("notes", prev.get("notes", "")) or ""}


async def set_salary_master(employee_id: str, payload: dict, *, user: dict) -> dict:
    db = get_db()
    emp = await db.employees.find_one({"id": employee_id, "deleted_at": None})
    if not emp:
        raise NotFoundError("Karyawan tidak ditemukan")
    prev = await db.salary_masters.find_one({"employee_id": employee_id, "deleted_at": None}) or {}
    now = _now()
    doc = {**_clean_payload(payload, prev),
           "npwp": (payload.get("npwp") or prev.get("npwp") or emp.get("npwp") or "").strip(),
           "updated_at": now, "updated_by": user["id"]}
    await db.salary_masters.update_one(
        {"employee_id": employee_id, "deleted_at": None},
        {"$set": doc, "$setOnInsert": {"id": str(uuid.uuid4()), "employee_id": employee_id,
                                       "created_at": now, "created_by": user["id"]}},
        upsert=True)
    updated = await db.salary_masters.find_one({"employee_id": employee_id, "deleted_at": None})
    await audit_log(user_id=user["id"], entity_type="salary_master", entity_id=updated["id"],
                    action="update" if prev else "create",
                    before={k: prev.get(k) for k in ("basic_salary", "components", "ptkp_status", "bpjs_enrolled")} if prev else None,
                    after={k: doc.get(k) for k in ("basic_salary", "components", "ptkp_status", "bpjs_enrolled")})
    return serialize(updated)


async def list_salary_masters(outlet_id: str | None = None, per_page: int = 100) -> list:
    db = get_db()
    emp_filter: dict = {"deleted_at": None, "status": {"$in": PAYROLL_EMPLOYEE_STATUSES}}
    if outlet_id:
        emp_filter["outlet_id"] = outlet_id
    emps = await db.employees.find(emp_filter).sort("full_name", 1).to_list(per_page)
    sms = await db.salary_masters.find({"employee_id": {"$in": [e["id"] for e in emps]}, "deleted_at": None}).to_list(None) if emps else []
    sm_map = {s["employee_id"]: s for s in sms}
    result = []
    for emp in emps:
        sm = sm_map.get(emp["id"])
        s = _summary(sm)
        bpjs = _calc_bpjs(s["total_fixed_pay"], s["bpjs_enrolled"])
        pph21_detail = _calc_pph21(s["total_fixed_pay"], s["ptkp_status"])
        result.append({
            "employee_id": emp["id"], "employee_name": emp.get("full_name"),
            "employee_code": emp.get("code"), "outlet_id": emp.get("outlet_id"),
            "position": emp.get("position"), "employee_status": emp.get("status"),
            **s, "bpjs_employee": bpjs["employee"], "bpjs_employer": bpjs["employer"],
            "pph21_monthly": pph21_detail["monthly_tax"],
            "npwp": (sm or {}).get("npwp") or emp.get("npwp", ""),
        })
    return result


async def import_salary_excel(file_bytes: bytes, *, user: dict) -> dict:
    """Import salary master from Excel (.xlsx) or CSV."""
    import io as _io
    import re as _re
    db = get_db()
    errors = []
    rows_in = []
    try:
        import openpyxl
        wb = openpyxl.load_workbook(_io.BytesIO(file_bytes))
        ws = wb.active
        headers = [str(cell.value or "").strip().lower().replace(" ", "_") for cell in next(ws.iter_rows(min_row=1, max_row=1))]
        for i, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
            if all(v is None for v in row):
                continue
            rows_in.append({"_row": i, **dict(zip(headers, row))})
    except Exception:
        try:
            reader = csv.DictReader(_io.StringIO(file_bytes.decode("utf-8-sig")))
            for i, row in enumerate(reader, start=2):
                rows_in.append({"_row": i, **{k.strip().lower().replace(" ", "_"): v for k, v in row.items()}})
        except Exception as e:
            return {"imported": 0, "updated": 0, "errors": [f"Cannot parse file: {e}"], "preview": []}

    imported = updated = 0
    preview = []
    for row in rows_in:
        rn = row.get("_row", "?")
        emp = None
        # INV-02: match on the canonical employee `code` (or id/nik/npwp); name fallback must be EXACT and unique
        for key in ("employee_code", "employee_id", "kode_karyawan", "nik"):
            val = str(row.get(key) or "").strip()
            if val:
                emp = await db.employees.find_one({"$or": [{"code": val}, {"id": val}, {"nik": val}, {"npwp": val}], "deleted_at": None})
                if emp:
                    break
        if not emp:
            name_val = str(row.get("full_name") or row.get("nama") or "").strip()
            if name_val:
                matches = await db.employees.find(
                    {"full_name": {"$regex": f"^{_re.escape(name_val)}$", "$options": "i"}, "deleted_at": None}).to_list(2)
                if len(matches) > 1:
                    errors.append(f"Row {rn}: Nama '{name_val}' ambigu — gunakan kolom employee_code")
                    continue
                emp = matches[0] if matches else None
        if not emp:
            errors.append(f"Row {rn}: Employee not found")
            continue

        def _float(key, default=0.0):
            v = row.get(key)
            try:
                return float(str(v).replace(",", "").strip()) if v not in (None, "") else default
            except Exception:
                return default
        # INV-02: an empty cell keeps the existing value instead of overwriting with 0
        prev = await db.salary_masters.find_one({"employee_id": emp["id"], "deleted_at": None}) or {}
        prev_basic = float(prev.get("basic_salary", 0) or 0)
        basic = _float("basic_salary", _float("gaji_pokok", prev_basic))
        prev_amt = {c.get("code"): float(c.get("amount", 0) or 0) for c in prev.get("components", [])}
        components = [{"code": code, "name": name, "amount": _float(col, prev_amt.get(code, 0.0))} for code, name, col in [
            ("TUNJ_JABATAN", "Tunjangan Jabatan", "tunjangan_jabatan"),
            ("TUNJ_MAKAN", "Tunjangan Makan", "tunjangan_makan"),
            ("TUNJ_TRANSPORT", "Tunjangan Transport", "tunjangan_transport"),
            ("TUNJ_KESEHATAN", "Tunjangan Kesehatan", "tunjangan_kesehatan"),
        ]]
        if basic < 0 or any(c["amount"] < 0 for c in components):
            errors.append(f"Row {rn}: nominal negatif tidak diizinkan")
            continue
        bpjs_val = str(row.get("bpjs_enrolled", "true") or "true").lower().strip()
        bpjs_enrolled = bpjs_val not in ("false", "0", "no", "tidak")
        ptkp_status = str(row.get("ptkp_status") or prev.get("ptkp_status") or "TK/0").strip().upper()
        if ptkp_status not in PTKP_BY_STATUS:
            errors.append(f"Row {rn}: PTKP '{ptkp_status}' tidak valid")
            continue
        npwp = str(row.get("npwp") or prev.get("npwp") or emp.get("npwp", "") or "").strip()
        now = _now()
        await db.salary_masters.update_one(
            {"employee_id": emp["id"], "deleted_at": None},
            {"$set": {"basic_salary": basic, "components": components, "bpjs_enrolled": bpjs_enrolled,
                      "ptkp_status": ptkp_status, "npwp": npwp, "updated_at": now, "updated_by": user["id"]},
             "$setOnInsert": {"id": str(uuid.uuid4()), "employee_id": emp["id"], "notes": "",
                              "created_at": now, "created_by": user["id"]}},
            upsert=True)
        if prev:
            updated += 1
        else:
            imported += 1
        preview.append({"employee_name": emp.get("full_name"), "employee_id": emp["id"], "basic_salary": basic, "allowances_total": sum(c["amount"] for c in components), "ptkp_status": ptkp_status, "bpjs_enrolled": bpjs_enrolled})
    if imported or updated:
        await audit_log(user_id=user["id"], entity_type="salary_master", entity_id=None, action="import",
                        after={"imported": imported, "updated": updated, "errors": len(errors)})
    return {"imported": imported, "updated": updated, "errors": errors, "preview": preview}

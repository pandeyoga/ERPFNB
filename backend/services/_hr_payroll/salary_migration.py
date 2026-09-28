"""CTL-10 one-time migration: employee salary fields → salary_masters (single source). Idempotent."""
from __future__ import annotations

import logging
import uuid

from core.db import get_db
from services.hr_constants import _now
from services._hr_payroll.salary_master import LEGACY_EMPLOYEE_SALARY_FIELDS, standard_components

logger = logging.getLogger("aurora.hr")


async def migrate_employee_salary_to_master() -> dict:
    db = get_db()
    try:
        await db.salary_masters.create_index(
            [("employee_id", 1)], unique=True,
            partialFilterExpression={"deleted_at": None}, name="salary_master_employee_unique")
    except Exception as e:  # noqa: BLE001 — existing duplicates must be cleaned first
        logger.warning("salary_masters unique index skipped: %s", e)
    created = cleaned = 0
    q = {"$or": [{f: {"$exists": True}} for f in LEGACY_EMPLOYEE_SALARY_FIELDS]}
    async for emp in db.employees.find(q):
        legacy = {f: emp.get(f) for f in LEGACY_EMPLOYEE_SALARY_FIELDS if f in emp}
        if emp.get("deleted_at") is None and not await db.salary_masters.find_one(
                {"employee_id": emp["id"], "deleted_at": None}, {"_id": 1}):
            # payroll historically used basic_salary; gross_salary only as fallback
            basic = float(emp.get("basic_salary") or emp.get("salary") or emp.get("gross_salary") or 0)
            now = _now()
            await db.salary_masters.insert_one({
                "id": str(uuid.uuid4()), "employee_id": emp["id"], "basic_salary": round(basic, 2),
                "components": standard_components(), "bpjs_enrolled": True, "ptkp_status": "TK/0",
                "npwp": emp.get("npwp") or "", "notes": "Migrasi otomatis dari data karyawan",
                "legacy_employee_salary": legacy, "created_at": now, "created_by": "system",
                "updated_at": now, "updated_by": "system", "deleted_at": None,
            })
            created += 1
        await db.employees.update_one({"id": emp["id"]}, {"$unset": {f: "" for f in LEGACY_EMPLOYEE_SALARY_FIELDS}})
        cleaned += 1
    if cleaned:
        logger.info("salary migration: %d salary masters created, %d employees cleaned", created, cleaned)
    return {"created": created, "cleaned": cleaned}

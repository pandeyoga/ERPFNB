"""Payslip data generation."""
from __future__ import annotations

from core.db import get_db
from core.exceptions import NotFoundError


async def get_payroll_payslip_data(cycle_id: str, employee_id: str) -> dict:
    """Return payslip data for one employee in a payroll cycle."""
    db = get_db()
    cycle = await db.payroll_cycles.find_one({"id": cycle_id, "deleted_at": None})
    if not cycle:
        raise NotFoundError("Payroll cycle tidak ditemukan")
    emp_data = next((e for e in cycle.get("employees", []) if e.get("employee_id") == employee_id), None)
    if not emp_data:
        raise NotFoundError("Karyawan tidak ada dalam payroll cycle ini")
    from services.system_settings_service import get_value as _get_val
    company_name = await _get_val("COMPANY_PKP_NAME") or "PT. FnB Group"
    company_npwp = await _get_val("COMPANY_NPWP") or ""
    return {
        "cycle_id": cycle_id, "doc_no": cycle.get("doc_no"), "period": cycle.get("period"),
        "payroll_date": cycle.get("payroll_date"), "company_name": company_name,
        "company_npwp": company_npwp, "employee": emp_data,
        "pph21_enabled": cycle.get("pph21_enabled", False),
    }

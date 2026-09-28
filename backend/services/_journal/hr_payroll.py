"""_journal/hr_payroll.py — HR payroll & compensation journal postings."""
from core.clock import period_now as _biz_period, today_str as _biz_today  # SSOT-11: WIB business date
from datetime import datetime, timezone
from typing import Optional

from core.db import get_db
from services import gl_mapping
from services._journal._common import _post_journal


def _period_end(period: Optional[str]) -> str:
    """FIN-11: accrual JEs dated at the END of the period they belong to (not 'today')."""
    import calendar
    try:
        y, m = int(period[:4]), int(period[5:7])
        return f"{y:04d}-{m:02d}-{calendar.monthrange(y, m)[1]:02d}"
    except Exception:  # noqa: BLE001
        return _biz_today()


async def post_for_employee_advance(adv: dict, *, user_id: str) -> Optional[dict]:
    """Disbursement kasbon: Dr Employee Advance Receivable (1210), Cr Cash/Petty/Bank.

    Idempotent — keyed by (source_type=employee_advance, source_id=adv.id).
    """
    db = get_db()
    amount = float(adv.get("principal", 0) or 0)
    if amount <= 0:
        return None
    ar_acc = await gl_mapping.resolve("employee_advance_receivable")
    pm_id = adv.get("payment_method_id")
    target = None
    pm = None
    if pm_id:
        pm = await db.payment_methods.find_one({"id": pm_id})
    if pm and pm.get("code") == "PETTY":
        target = await gl_mapping.resolve("petty_cash", scope_outlet_id=adv.get("outlet_id"))
    elif pm and pm.get("bank_account_id"):
        ba = await db.bank_accounts.find_one({"id": pm["bank_account_id"]})
        target = ba and ba.get("gl_account_id")
    if not target:
        target = await gl_mapping.resolve("cash_on_hand")

    return await _post_journal(
        entry_date=adv.get("disbursed_at", "")[:10] or adv.get("advance_date"),
        description=f"EA disbursement {adv.get('doc_no','')}",
        source_type="employee_advance",
        source_id=adv["id"],
        lines=[
            {"coa_id": ar_acc, "dr": amount, "cr": 0,
             "memo": f"EA {adv.get('doc_no','')}", "dim_employee": adv.get("employee_id")},
            {"coa_id": target, "dr": 0, "cr": amount, "memo": "EA cash out"},
        ],
        user_id=user_id,
        dim_outlet=adv.get("outlet_id"),
    )


async def post_for_service_charge(sc: dict, *, user_id: str) -> Optional[dict]:
    """Service Charge posting:
    Dr Service Charge Liability (2120) for distributable + LB amount + LD amount
    Cr Salary Payable (2130) for distributable
    Cr LB Fund Liability (2121) for lb_amount
    Cr LD Fund Liability (2122) for ld_amount
    """
    distributable = float(sc.get("distributable", 0) or 0)
    lb_amount = float(sc.get("lb_amount", 0) or 0)
    ld_amount = float(sc.get("ld_amount", 0) or 0)
    total = distributable + lb_amount + ld_amount
    if total <= 0:
        return None
    sc_liab = await gl_mapping.resolve("service_charge_liability")
    salary_payable = await gl_mapping.resolve("salary_payable")
    lines: list[dict] = [
        {"coa_id": sc_liab, "dr": total, "cr": 0,
         "memo": f"Service charge release {sc.get('period')}"},
    ]
    if distributable > 0:
        lines.append({"coa_id": salary_payable, "dr": 0, "cr": distributable,
                      "memo": "Service share to employees"})
    if lb_amount > 0:
        lb_fund = await gl_mapping.resolve("lb_fund_liability")
        lines.append({"coa_id": lb_fund, "dr": 0, "cr": lb_amount,
                      "memo": "L&B fund deduction"})
    if ld_amount > 0:
        ld_fund = await gl_mapping.resolve("ld_fund_liability")
        lines.append({"coa_id": ld_fund, "dr": 0, "cr": ld_amount,
                      "memo": "L&D fund deduction"})
    return await _post_journal(
        entry_date=_period_end(sc.get("period")),
        description=f"Service Charge {sc.get('period')} - {sc.get('outlet_id')}",
        source_type="service_charge",
        source_id=sc["id"],
        lines=lines,
        user_id=user_id,
        dim_outlet=sc.get("outlet_id"),
        dim_brand=sc.get("brand_id"),
    )


async def post_for_incentive(run: dict, *, user_id: str) -> Optional[dict]:
    """Incentive posting: Dr Incentive Expense (5411), Cr Salary Payable (2130)."""
    total = float(run.get("total_amount", 0) or 0)
    if total <= 0:
        return None
    inc_acc = await gl_mapping.resolve("incentive_expense")
    payable = await gl_mapping.resolve("salary_payable")
    return await _post_journal(
        entry_date=_period_end(run.get("period")),
        description=f"Incentive {run.get('period')} - scheme {run.get('scheme_name','')}",
        source_type="incentive",
        source_id=run["id"],
        lines=[
            {"coa_id": inc_acc, "dr": total, "cr": 0,
             "memo": f"Incentive {run.get('period')}"},
            {"coa_id": payable, "dr": 0, "cr": total,
             "memo": "Incentive payable to employees"},
        ],
        user_id=user_id,
        dim_outlet=run.get("outlet_id"),
        dim_brand=run.get("brand_id"),
    )


async def post_for_payroll(payroll: dict, *, user_id: str) -> Optional[dict]:
    """Payroll posting (P0-01/P0-02).
    SC & incentive shares were already credited to Salary Payable by their own JEs,
    so only the base (basic + allowances) is expensed here.
      Dr Salary Expense (base) · Dr BPJS Employer Expense
      Cr Salary Payable (take_home − variable) · Cr Utang PPh21 · Cr Utang BPJS (emp+er) · Cr EA Receivable
    """
    total_gross = float(payroll.get("total_gross", 0) or 0)
    advance_repay = float(payroll.get("total_advance_repayment", 0) or 0)
    take_home = float(payroll.get("total_take_home", 0) or 0)
    total_pph21 = float(payroll.get("total_pph21", 0) or 0)
    bpjs_emp = float(payroll.get("total_bpjs_employee", 0) or 0)
    bpjs_er = float(payroll.get("total_bpjs_employer", 0) or 0)
    variable = sum(float(e.get("variable_pay", 0) or 0) for e in payroll.get("employees", []))
    if total_gross <= 0:
        return None
    salary_expense = await gl_mapping.resolve("salary_expense")
    salary_payable = await gl_mapping.resolve("salary_payable")

    base_expense = round(total_gross - variable, 2)
    net_payable = round(take_home - variable, 2)
    lines: list[dict] = [
        {"coa_id": salary_expense, "dr": base_expense, "cr": 0,
         "memo": f"Payroll {payroll.get('period')}"},
        {"coa_id": salary_payable, "dr": max(-net_payable, 0), "cr": max(net_payable, 0),
         "memo": "Net payable to employees (SC/incentive already accrued)"},
    ]
    if bpjs_er > 0:
        bpjs_exp = await gl_mapping.resolve_or("bpjs_employer_expense", "salary_expense")
        lines.append({"coa_id": bpjs_exp, "dr": bpjs_er, "cr": 0, "memo": "BPJS porsi perusahaan"})
    if bpjs_emp + bpjs_er > 0:
        bpjs_pay = await gl_mapping.resolve_or("bpjs_payable", "accrued_expenses")
        lines.append({"coa_id": bpjs_pay, "dr": 0, "cr": round(bpjs_emp + bpjs_er, 2),
                      "memo": "Utang BPJS (karyawan + perusahaan)"})
    if total_pph21 > 0:
        pph21_acc = await gl_mapping.resolve("withholding_pph21")
        lines.append({"coa_id": pph21_acc, "dr": 0, "cr": total_pph21,
                      "memo": "PPh 21 withheld \u2014 payable ke DJP"})
    if advance_repay > 0:
        ea_acc = await gl_mapping.resolve("employee_advance_receivable")
        lines.append({
            "coa_id": ea_acc, "dr": 0, "cr": advance_repay,
            "memo": "Advance repayment offset",
        })
    return await _post_journal(
        entry_date=payroll.get("payroll_date") or _biz_today(),
        description=f"Payroll {payroll.get('period')} {payroll.get('doc_no','')}",
        source_type="payroll",
        source_id=payroll["id"],
        lines=lines,
        user_id=user_id,
        dim_outlet=payroll.get("outlet_id"),
    )


async def post_for_withholding_payment(
    payment: dict,
    *,
    cr_coa_id: str,
    user_id: str,
) -> Optional[dict]:
    """Post JE for vendor payment WITH PPh withholding (pph23 or pph42).

    Normal payment: Dr gl_debit (gross), Cr Bank (gross)
    With withholding: Dr gl_debit (gross), Cr Bank (gross - wh), Cr Utang PPh (wh)
    """
    gross = float(payment.get("amount", 0) or 0)
    wh_amount = float(payment.get("wh_amount", 0) or 0)
    wh_coa_id = payment.get("wh_coa_id")
    net_to_bank = gross - wh_amount
    description = payment.get("description") or f"Payment {payment['doc_no']}"

    db = get_db()
    coa_dbt = await db.chart_of_accounts.find_one({"id": payment["gl_debit_id"]})
    coa_crt = await db.chart_of_accounts.find_one({"id": cr_coa_id})

    lines = [
        {
            "coa_id": payment["gl_debit_id"],
            "coa_code": (coa_dbt or {}).get("code"),
            "coa_name": (coa_dbt or {}).get("name"),
            "dr": round(gross, 2), "cr": 0.0,
            "memo": description,
            "dim_vendor": payment.get("payee_id") if payment.get("payee_type") == "vendor" else None,
        },
        {
            "coa_id": cr_coa_id,
            "coa_code": (coa_crt or {}).get("code"),
            "coa_name": (coa_crt or {}).get("name"),
            "dr": 0.0, "cr": round(net_to_bank, 2),
            "memo": f"Bank transfer (net of PPh {payment.get('wh_type','')})",
        },
    ]
    if wh_amount > 0 and wh_coa_id:
        coa_wh = await db.chart_of_accounts.find_one({"id": wh_coa_id})
        lines.append({
            "coa_id": wh_coa_id,
            "coa_code": (coa_wh or {}).get("code"),
            "coa_name": (coa_wh or {}).get("name"),
            "dr": 0.0, "cr": round(wh_amount, 2),
            "memo": f"Withholding {payment.get('wh_type','')} ({round(payment.get('wh_rate',0)*100,0):.0f}%)",
        })

    return await _post_journal(
        entry_date=payment.get("payment_date") or _biz_today(),
        description=f"Payment {payment['doc_no']}: {description}",
        source_type="payment_request",
        source_id=payment["id"],
        lines=lines,
        user_id=user_id,
    )

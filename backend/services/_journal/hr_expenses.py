"""_journal/hr_expenses.py — HR expense & voucher journal postings."""
from datetime import datetime, timezone
from typing import Optional

from services import gl_mapping
from services._journal._common import _post_journal


async def post_for_voucher_issue(voucher: dict, *, user_id: str) -> Optional[dict]:
    """Voucher issuance (marketing/comp use):
    Dr Marketing Expense (or Customer Compensation), Cr Voucher Liability
    """
    value = float(voucher.get("value", 0) or 0)
    if value <= 0:
        return None
    purpose = (voucher.get("purpose") or "marketing").lower()
    if purpose == "customer_comp":
        exp_acc = await gl_mapping.resolve("customer_compensation")
    elif purpose == "staff":
        exp_acc = await gl_mapping.resolve("staff_meal_expense")
    else:
        exp_acc = await gl_mapping.resolve("marketing_expense")
    voucher_liab = await gl_mapping.resolve("voucher_liability")
    return await _post_journal(
        entry_date=voucher.get("issue_date"),
        description=f"Voucher issue {voucher.get('code')} ({purpose})",
        source_type="voucher_issue",
        source_id=voucher["id"],
        lines=[
            {"coa_id": exp_acc, "dr": value, "cr": 0,
             "memo": f"Voucher {voucher.get('code')}"},
            {"coa_id": voucher_liab, "dr": 0, "cr": value,
             "memo": "Voucher liability"},
        ],
        user_id=user_id,
        dim_outlet=voucher.get("outlet_id"),
    )


async def post_for_voucher_redeem(voucher: dict, *, user_id: str) -> Optional[dict]:
    """Voucher redemption: Dr Voucher Liability, Cr Voucher Breakage Income."""
    amount = float(voucher.get("redeemed_amount", 0) or 0)
    if amount <= 0:
        return None
    voucher_liab = await gl_mapping.resolve("voucher_liability")
    breakage = await gl_mapping.resolve("voucher_breakage_income")
    return await _post_journal(
        entry_date=(voucher.get("redeemed_at") or datetime.now(timezone.utc).isoformat())[:10],
        description=f"Voucher redeem {voucher.get('code')}",
        source_type="voucher_redeem",
        source_id=voucher["id"],
        lines=[
            {"coa_id": voucher_liab, "dr": amount, "cr": 0,
             "memo": f"Redeem voucher {voucher.get('code')}"},
            {"coa_id": breakage, "dr": 0, "cr": amount,
             "memo": "Voucher cleared"},
        ],
        user_id=user_id,
        dim_outlet=voucher.get("redeemed_outlet_id") or voucher.get("outlet_id"),
    )


async def post_for_foc(foc: dict, *, user_id: str) -> Optional[dict]:
    """FOC entry: Dr expense by type, Cr Inventory.

    foc_type → expense GL:
      staff_meal     → 5402 staff_meal_expense
      marketing      → 5401 marketing_expense
      customer_comp  → 5421 customer_compensation
      other          → use foc.gl_account_id if provided, else marketing_expense
    """
    amount = float(foc.get("amount", 0) or 0)
    if amount <= 0:
        return None
    foc_type = (foc.get("foc_type") or "").lower()
    type_map = {
        "staff_meal": "staff_meal_expense",
        "marketing": "marketing_expense",
        "customer_comp": "customer_compensation",
    }
    if foc.get("gl_account_id"):
        exp_acc = foc["gl_account_id"]
    else:
        logical = type_map.get(foc_type, "marketing_expense")
        exp_acc = await gl_mapping.resolve(logical)
    inv_acc = await gl_mapping.resolve("inventory", scope_outlet_id=foc.get("outlet_id"))
    return await _post_journal(
        entry_date=foc.get("foc_date"),
        description=f"FOC {foc_type} {foc.get('doc_no','')}",
        source_type="foc",
        source_id=foc["id"],
        lines=[
            {"coa_id": exp_acc, "dr": amount, "cr": 0,
             "memo": foc.get("notes") or foc_type},
            {"coa_id": inv_acc, "dr": 0, "cr": amount,
             "memo": "FOC inventory release"},
        ],
        user_id=user_id,
        dim_outlet=foc.get("outlet_id"),
        dim_brand=foc.get("brand_id"),
    )

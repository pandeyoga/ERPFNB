"""_journal/outlet.py — journal postings for outlet events."""
from typing import Optional

from core.db import get_db
from core.exceptions import ValidationError
from services import gl_mapping
from services._journal._common import _post_journal, resolve_payment_target


async def post_for_daily_sales(sales: dict, *, user_id: str) -> dict:
    """On daily_sales validated:
       Dr Cash/Bank/Card per payment method, Dr Discount
       Cr Revenue per bucket, Cr Service Charge Liability, Cr Output VAT
    """
    outlet_id = sales["outlet_id"]
    lines: list[dict] = []

    # Pre-load all payment methods + bank accounts for this sales record (avoids N+1)
    db = get_db()
    pm_ids = list({pay["payment_method_id"] for pay in sales.get("payment_breakdown", []) if pay.get("payment_method_id")})
    pms_raw = await db.payment_methods.find(
        {"id": {"$in": pm_ids}, "deleted_at": None}
    ).to_list(len(pm_ids) + 1) if pm_ids else []
    pm_lookup = {p["id"]: p for p in pms_raw}

    ba_ids = list({p["bank_account_id"] for p in pms_raw if p.get("bank_account_id")})
    bas_raw = await db.bank_accounts.find(
        {"id": {"$in": ba_ids}}
    ).to_list(len(ba_ids) + 1) if ba_ids else []
    ba_lookup = {b["id"]: b for b in bas_raw}

    # Debit: payment methods
    for pay in sales.get("payment_breakdown", []):
        pm_id = pay.get("payment_method_id")
        amount = float(pay.get("amount", 0) or 0)
        if amount == 0 or not pm_id:
            continue
        pm = pm_lookup.get(pm_id)
        if not pm:
            continue
        target = await resolve_payment_target(pm, outlet_id, ba_lookup.get(pm.get("bank_account_id")))
        lines.append({
            "coa_id": target, "dr": amount, "cr": 0,
            "memo": f"Sales {sales['sales_date']} via {pm['name']}",
        })

    # Debit: voucher discount (contra-revenue) so Dr payments + Dr discount = Cr revenue + svc + tax
    disc = float(sales.get("voucher_discount_amount", 0) or 0)
    if disc:
        coa_id = await gl_mapping.resolve("discount_expense")
        lines.append({"coa_id": coa_id, "dr": disc, "cr": 0,
                      "memo": f"Voucher discount {sales.get('voucher_code') or ''}".strip()})

    # Credit: revenue buckets
    bucket_to_logical = {
        "food": "revenue_food",
        "beverage": "revenue_beverage",
        "other": "revenue_other",
    }
    for bucket in sales.get("revenue_buckets", []):
        bk = (bucket.get("bucket") or "other").lower()
        amount = float(bucket.get("amount", 0) or 0)
        if amount == 0:
            continue
        logical = bucket_to_logical.get(bk, "revenue_other")
        coa_id = await gl_mapping.resolve(logical)
        lines.append({"coa_id": coa_id, "dr": 0, "cr": amount, "memo": f"Revenue {bk}"})

    # Credit: service charge liability
    svc = float(sales.get("service_charge", 0) or 0)
    if svc:
        coa_id = await gl_mapping.resolve("service_charge_liability")
        lines.append({"coa_id": coa_id, "dr": 0, "cr": svc, "memo": "Service charge"})

    # Credit: output VAT
    tax = float(sales.get("tax_amount", 0) or 0)
    if tax:
        coa_id = await gl_mapping.resolve("output_vat")
        lines.append({"coa_id": coa_id, "dr": 0, "cr": tax, "memo": "PPN Keluaran"})

    return await _post_journal(
        entry_date=sales["sales_date"],
        description=f"Daily Sales {sales['sales_date']}",
        source_type="sales",
        source_id=sales["id"],
        lines=lines,
        user_id=user_id,
        dim_outlet=outlet_id,
        dim_brand=sales.get("brand_id"),
    )


async def post_for_petty_cash(txn: dict, *, user_id: str) -> Optional[dict]:
    """Petty cash: purchase Dr expense/Cr PC · replenish Dr PC/Cr bank · adjustment ± vs adjustment_income."""
    petty_id = await gl_mapping.resolve("petty_cash", scope_outlet_id=txn["outlet_id"])
    amount = float(txn["amount"])
    if txn["type"] in ("replenish", "adjustment"):
        other = (txn.get("source_coa_id") or await gl_mapping.resolve("bank_default")) if txn["type"] == "replenish" \
            else await gl_mapping.resolve("adjustment_income")
        cash_in = txn["type"] == "replenish" or txn.get("direction") != "out"
        return await _post_journal(
            entry_date=txn["txn_date"],
            description=f"PC {txn['type']}: {txn.get('description', '')}",
            source_type="petty_cash",
            source_id=txn["id"],
            lines=[
                {"coa_id": petty_id, "dr": amount if cash_in else 0, "cr": 0 if cash_in else amount, "memo": txn["type"]},
                {"coa_id": other, "dr": 0 if cash_in else amount, "cr": amount if cash_in else 0, "memo": txn.get("description", "")},
            ],
            user_id=user_id,
            dim_outlet=txn["outlet_id"],
        )
    if not txn.get("gl_account_id"):
        raise ValidationError("Akun GL wajib untuk pembelian petty cash")
    return await _post_journal(
        entry_date=txn["txn_date"],
        description=f"PC: {txn['description']}",
        source_type="petty_cash",
        source_id=txn["id"],
        lines=[
            {"coa_id": txn["gl_account_id"], "dr": amount, "cr": 0, "memo": txn["description"]},
            {"coa_id": petty_id, "dr": 0, "cr": amount, "memo": "Petty cash out"},
        ],
        user_id=user_id,
        dim_outlet=txn["outlet_id"],
    )


async def post_for_urgent_purchase(up: dict, *, user_id: str) -> Optional[dict]:
    """Urgent purchase paid by petty cash: Dr [item GL], Cr Petty Cash."""
    db = get_db()
    pm_id = up.get("payment_method_id")
    pm = await db.payment_methods.find_one({"id": pm_id}) if pm_id else None
    target = await resolve_payment_target(pm, up["outlet_id"])

    lines = []
    for it in up.get("items", []):
        gl = it.get("gl_account_id")
        amt = float(it.get("total", 0) or 0)
        if amt == 0:
            continue
        if not gl:
            raise ValidationError(f"Item '{it.get('name', '')}' belum punya akun GL")
        lines.append({"coa_id": gl, "dr": amt, "cr": 0, "memo": it.get("name", "")})
    if not lines:
        return None
    total = sum(ln["dr"] for ln in lines)
    lines.append({"coa_id": target, "dr": 0, "cr": total, "memo": "Urgent purchase pay"})

    return await _post_journal(
        entry_date=up["purchase_date"],
        description=f"Urgent purchase {up.get('doc_no','')}",
        source_type="urgent_purchase",
        source_id=up["id"],
        lines=lines,
        user_id=user_id,
        dim_outlet=up["outlet_id"],
    )

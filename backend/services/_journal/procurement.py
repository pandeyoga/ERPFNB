"""_journal/procurement.py — journal postings for procurement events."""
from services import gl_mapping
from services._journal._common import _post_journal


async def post_for_gr(gr: dict, *, user_id: str) -> dict:
    """GR posted: Dr Inventory + Input VAT, Cr AP"""
    inv_acc = await gl_mapping.resolve("inventory", scope_outlet_id=gr["outlet_id"])
    ap_acc = await gl_mapping.resolve("accounts_payable")
    in_vat_acc = await gl_mapping.resolve("input_vat")
    subtotal = float(gr.get("subtotal", 0))
    tax = float(gr.get("tax_total", 0))
    grand = float(gr.get("grand_total", 0))
    lines = [
        {"coa_id": inv_acc, "dr": subtotal, "cr": 0, "memo": "GR inventory"},
    ]
    if tax:
        lines.append({"coa_id": in_vat_acc, "dr": tax, "cr": 0, "memo": "PPN Masukan"})
    lines.append({"coa_id": ap_acc, "dr": 0, "cr": grand, "memo": "AP vendor",
                  "dim_vendor": gr["vendor_id"]})
    return await _post_journal(
        entry_date=gr["receive_date"],
        description=f"Goods Receipt {gr.get('doc_no','')}",
        source_type="goods_receipt",
        source_id=gr["id"],
        lines=lines,
        user_id=user_id,
        dim_outlet=gr["outlet_id"],
    )

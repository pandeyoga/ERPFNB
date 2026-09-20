"""HR sub-module: FOC (free of charge).

Auto-extracted from former monolithic hr_service.py for maintainability.
"""
import uuid
from typing import Optional

from core.audit import log as audit_log
from core.db import get_db, serialize
from core.exceptions import (
    ValidationError,
)
from services import journal_service
from services.hr_constants import _now, _today
from utils.number_series import next_doc_no
from services._hr.lb_fund import _lb_ledger_add


async def list_foc(
    *, outlet_ids: Optional[list[str]] = None, foc_type: Optional[str] = None,
    date_from: Optional[str] = None, date_to: Optional[str] = None,
    page: int = 1, per_page: int = 20,
):
    db = get_db()
    q: dict = {"deleted_at": None}
    if outlet_ids:
        q["outlet_id"] = {"$in": outlet_ids}
    if foc_type:
        q["foc_type"] = foc_type
    if date_from:
        q.setdefault("foc_date", {})["$gte"] = date_from
    if date_to:
        q.setdefault("foc_date", {})["$lte"] = date_to
    skip = (page - 1) * per_page
    items = await db.foc_entries.find(q).sort([("foc_date", -1), ("created_at", -1)]).skip(skip).limit(per_page).to_list(per_page)
    total = await db.foc_entries.count_documents(q)
    return [serialize(d) for d in items], {"page": page, "per_page": per_page, "total": total}


async def create_foc(payload: dict, *, user: dict) -> dict:
    db = get_db()
    outlet_id = payload.get("outlet_id")
    if not outlet_id:
        raise ValidationError("outlet_id wajib")
    outlet = await db.outlets.find_one({"id": outlet_id, "deleted_at": None})
    if not outlet:
        raise ValidationError("Outlet tidak ditemukan")
    foc_type = (payload.get("foc_type") or "").lower()
    if foc_type not in ("staff_meal", "marketing", "customer_comp", "other"):
        raise ValidationError("foc_type harus staff_meal/marketing/customer_comp/other")
    amount = float(payload.get("amount", 0) or 0)
    items = payload.get("items") or []
    if amount <= 0 and items:
        amount = sum(float(it.get("total", 0) or 0) for it in items)
    if amount <= 0:
        raise ValidationError("Amount > 0 wajib (atau items dengan total)")

    doc_no = await next_doc_no("FOC")
    doc = {
        "id": str(uuid.uuid4()),
        "doc_no": doc_no,
        "foc_date": payload.get("foc_date") or _today(),
        "outlet_id": outlet_id,
        "brand_id": outlet.get("brand_id"),
        "foc_type": foc_type,
        "amount": round(amount, 2),
        "items": items,
        "beneficiary": payload.get("beneficiary"),
        "gl_account_id": payload.get("gl_account_id"),
        "receipt_url": payload.get("receipt_url"),
        "notes": payload.get("notes"),
        "status": "posted",
        "journal_entry_id": None,
        "created_at": _now(), "updated_at": _now(), "deleted_at": None,
        "created_by": user["id"],
    }
    await db.foc_entries.insert_one(doc)
    je = await journal_service.post_for_foc(doc, user_id=user["id"])
    if je:
        await db.foc_entries.update_one({"id": doc["id"]},
            {"$set": {"journal_entry_id": je["id"]}})
        doc["journal_entry_id"] = je["id"]
    # Customer comp also feeds LB Fund out (when LB pays the comp)
    if foc_type == "customer_comp":
        await _lb_ledger_add(
            entry_date=doc["foc_date"],
            direction="out",
            amount=float(doc["amount"]),
            source_type="customer_compensation",
            source_id=doc["id"],
            outlet_id=outlet_id,
            description=f"Customer compensation {doc_no}",
        )
    await audit_log(user_id=user["id"], entity_type="foc",
                    entity_id=doc["id"], action="create")
    return serialize(doc)

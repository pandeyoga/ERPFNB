"""HR sub-module: Vouchers (issue + redeem).

Auto-extracted from former monolithic hr_service.py for maintainability.
"""
import uuid
from datetime import datetime, timezone
from typing import Optional

from core.audit import log as audit_log
from core.db import get_db, serialize
from core.exceptions import (
    NotFoundError, ValidationError,
)
from services import journal_service
from services.hr_constants import _now, _today
from utils.number_series import next_doc_no


async def list_vouchers(
    *, status: Optional[str] = None, batch_id: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1, per_page: int = 50,
):
    db = get_db()
    q: dict = {"deleted_at": None}
    if status:
        q["status"] = status
    if batch_id:
        q["batch_id"] = batch_id
    if search:
        q["$or"] = [
            {"code": {"$regex": search, "$options": "i"}},
            {"purpose": {"$regex": search, "$options": "i"}},
            {"notes": {"$regex": search, "$options": "i"}},
        ]
    skip = (page - 1) * per_page
    items = await db.vouchers.find(q).sort([("issue_date", -1), ("created_at", -1)]).skip(skip).limit(per_page).to_list(per_page)
    total = await db.vouchers.count_documents(q)
    return [serialize(d) for d in items], {"page": page, "per_page": per_page, "total": total}


async def issue_vouchers(payload: dict, *, user: dict) -> dict:
    """Issue voucher batch:
    payload: {value, qty, expire_date?, purpose, prefix?, outlet_id?, post_journal: bool}
    """
    db = get_db()
    qty = int(payload.get("qty", 1) or 1)
    if qty < 1 or qty > 1000:
        raise ValidationError("qty 1..1000")
    value = float(payload.get("value", 0) or 0)
    if value <= 0:
        raise ValidationError("value harus > 0")
    purpose = (payload.get("purpose") or "marketing").strip().lower()
    if purpose not in ("marketing", "customer_comp", "staff", "replacement"):
        raise ValidationError("purpose tidak valid")
    prefix = (payload.get("prefix") or "VOC").upper()
    issue_date = payload.get("issue_date") or _today()
    expire_date = payload.get("expire_date")
    outlet_id = payload.get("outlet_id")
    post_je = bool(payload.get("post_journal", True))

    batch_id = str(uuid.uuid4())
    docs: list[dict] = []
    journals_created = 0
    for i in range(qty):
        seq_no = await next_doc_no("VOC")
        v = {
            "id": str(uuid.uuid4()),
            "code": f"{prefix}-{seq_no}",
            "batch_id": batch_id,
            "value": value,
            "issue_date": issue_date,
            "expire_date": expire_date,
            "issued_by": user["id"],
            "issued_to": payload.get("issued_to"),
            "purpose": purpose,
            "outlet_id": outlet_id,
            "status": "issued",
            "redeemed_at": None, "redeemed_amount": 0,
            "redeemed_outlet_id": None, "redeemed_ref": None,
            "journal_entry_issue_id": None, "journal_entry_redeem_id": None,
            "notes": payload.get("notes"),
            "created_at": _now(), "updated_at": _now(), "deleted_at": None,
            "created_by": user["id"],
        }
        await db.vouchers.insert_one(v)
        if post_je:
            je = await journal_service.post_for_voucher_issue(v, user_id=user["id"])
            if je:
                await db.vouchers.update_one({"id": v["id"]},
                    {"$set": {"journal_entry_issue_id": je["id"]}})
                v["journal_entry_issue_id"] = je["id"]
                journals_created += 1
        docs.append(v)
    await audit_log(user_id=user["id"], entity_type="voucher_batch",
                    entity_id=batch_id, action="issue",
                    after={"qty": qty, "value": value, "purpose": purpose})
    return {
        "batch_id": batch_id,
        "qty": qty, "value": value, "purpose": purpose,
        "vouchers": [serialize(v) for v in docs],
        "journals_created": journals_created,
    }


async def redeem_voucher(code: str, payload: dict, *, user: dict) -> dict:
    db = get_db()
    v = await db.vouchers.find_one({"code": code, "deleted_at": None})
    if not v:
        raise NotFoundError(f"Voucher {code} tidak ditemukan")
    if v["status"] != "issued":
        raise ValidationError(f"Voucher status: {v['status']}, tidak bisa redeem")
    if v.get("expire_date"):
        try:
            exp = datetime.strptime(v["expire_date"], "%Y-%m-%d").date()
            if exp < datetime.now(timezone.utc).date():
                await db.vouchers.update_one({"id": v["id"]},
                    {"$set": {"status": "expired", "updated_at": _now()}})
                raise ValidationError("Voucher sudah expired")
        except ValueError:
            pass
    redeemed_amount = float(payload.get("amount") or v["value"])
    if redeemed_amount <= 0:
        raise ValidationError("Amount redeem harus > 0")
    if redeemed_amount > float(v["value"]):
        raise ValidationError("Amount redeem melebihi value voucher")
    await db.vouchers.update_one(
        {"id": v["id"]},
        {"$set": {"status": "redeemed",
                  "redeemed_at": _now(),
                  "redeemed_amount": redeemed_amount,
                  "redeemed_outlet_id": payload.get("outlet_id"),
                  "redeemed_ref": payload.get("ref"),
                  "updated_at": _now()}},
    )
    fresh = await db.vouchers.find_one({"id": v["id"]})
    je = await journal_service.post_for_voucher_redeem(fresh, user_id=user["id"])
    if je:
        await db.vouchers.update_one({"id": v["id"]},
            {"$set": {"journal_entry_redeem_id": je["id"]}})
        fresh["journal_entry_redeem_id"] = je["id"]
    await audit_log(user_id=user["id"], entity_type="voucher",
                    entity_id=v["id"], action="redeem",
                    after={"amount": redeemed_amount})
    return serialize(fresh)

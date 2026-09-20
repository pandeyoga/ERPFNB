"""Payment Request (PAY) service — money-out workflow.

Flow:
  draft -> submit -> (multi-tier approval) -> approved -> mark_paid -> paid (or cancelled)

Multi-tier approval handled via `services/approval_service.py`
(entity_type='payment_request').

On mark_paid:
  - Post JE: Dr AP/Expense, Cr Bank/Cash
  - Reduce AP balance on linked GR (if any)
  - Notify creator + next approver removed
  - Idempotent via source_type='payment_request' + source_id=pay_id
"""
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from core.audit import log as audit_log
from core.db import get_db, serialize
from core.exceptions import ConflictError, NotFoundError, ValidationError
from services import approval_service, gl_mapping, journal_service, notification_service
from utils.number_series import next_doc_no

logger = logging.getLogger("aurora.payment")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------- PAY TYPES ----------------
# vendor: pay a vendor (may link to GR/KB for AP reduction)
# employee: pay an employee (advance, incentive, travel, etc.)
# other: ad-hoc (utilities, tax, one-off expenses)
ALLOWED_PAYEE_TYPES = ("vendor", "employee", "other")


# ====================== QUERY / DETAIL ======================

async def list_payments(
    *,
    status: Optional[str] = None,
    payee_type: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1, per_page: int = 20,
):
    db = get_db()
    q: dict = {"deleted_at": None}
    if status:
        q["status"] = status
    if payee_type:
        q["payee_type"] = payee_type
    if date_from:
        q.setdefault("request_date", {})["$gte"] = date_from
    if date_to:
        q.setdefault("request_date", {})["$lte"] = date_to
    if search:
        q["$or"] = [
            {"doc_no": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
            {"payee_text": {"$regex": search, "$options": "i"}},
            {"invoice_no": {"$regex": search, "$options": "i"}},
        ]
    skip = (page - 1) * per_page
    items = await db.payment_requests.find(q).sort([("request_date", -1), ("created_at", -1)]).skip(skip).limit(per_page).to_list(per_page)
    total = await db.payment_requests.count_documents(q)
    enriched = [await _enrich(serialize(d)) for d in items]
    return enriched, {"page": page, "per_page": per_page, "total": total}


async def get_payment(pay_id: str) -> dict:
    db = get_db()
    doc = await db.payment_requests.find_one({"id": pay_id, "deleted_at": None})
    if not doc:
        raise NotFoundError("Payment request tidak ditemukan")
    out = await _enrich(serialize(doc))
    # Attach approval state for UI
    out["approval_state"] = await approval_service.evaluate("payment_request", out)
    return out


async def _enrich(d: dict) -> dict:
    db = get_db()
    # Resolve payee name
    if d.get("payee_type") == "vendor" and d.get("payee_id"):
        v = await db.vendors.find_one({"id": d["payee_id"]})
        d["payee_name"] = (v or {}).get("name") or d.get("payee_text") or d["payee_id"]
    elif d.get("payee_type") == "employee" and d.get("payee_id"):
        e = await db.employees.find_one({"id": d["payee_id"]})
        d["payee_name"] = (e or {}).get("full_name") or d.get("payee_text") or d["payee_id"]
    else:
        d["payee_name"] = d.get("payee_text") or "-"
    # Resolve bank account name
    if d.get("bank_account_id"):
        b = await db.bank_accounts.find_one({"id": d["bank_account_id"]})
        if b:
            d["bank_account_name"] = f"{b.get('bank', '')} {b.get('account_number', '')} — {b.get('name', '')}".strip()
    # Resolve GL debit account name
    if d.get("gl_debit_id"):
        coa = await db.chart_of_accounts.find_one({"id": d["gl_debit_id"]})
        if coa:
            d["gl_debit_code"] = coa.get("code")
            d["gl_debit_name"] = coa.get("name")
    return d


# ====================== CREATE / SUBMIT ======================

async def create_payment(payload: dict, *, user: dict) -> dict:
    db = get_db()
    payee_type = payload.get("payee_type")
    if payee_type not in ALLOWED_PAYEE_TYPES:
        raise ValidationError(f"payee_type harus salah satu dari {ALLOWED_PAYEE_TYPES}")

    amount = float(payload.get("amount", 0) or 0)
    if amount <= 0:
        raise ValidationError("amount harus > 0")

    description = (payload.get("description") or "").strip()
    if not description:
        raise ValidationError("description wajib")

    gl_debit_id = payload.get("gl_debit_id")
    if not gl_debit_id:
        raise ValidationError("gl_debit_id (COA debit) wajib")
    coa_dbt = await db.chart_of_accounts.find_one({"id": gl_debit_id, "deleted_at": None})
    if not coa_dbt or not coa_dbt.get("is_postable"):
        raise ValidationError("gl_debit_id tidak valid (harus postable COA)")

    payment_method_id = payload.get("payment_method_id")
    bank_account_id = payload.get("bank_account_id")
    if not bank_account_id and not payment_method_id:
        raise ValidationError("bank_account_id atau payment_method_id wajib")

    request_date = payload.get("request_date") or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    payee_id = payload.get("payee_id") or None
    payee_text = (payload.get("payee_text") or "").strip() or None
    if payee_type in ("vendor", "employee") and not payee_id and not payee_text:
        raise ValidationError("payee_id atau payee_text wajib")

    # Validate linked GR (optional) — used to reduce AP on mark_paid
    gr_id = payload.get("gr_id")
    if gr_id:
        gr = await db.goods_receipts.find_one({"id": gr_id, "deleted_at": None})
        if not gr:
            raise ValidationError("gr_id tidak ditemukan")
        if gr.get("payment_status") == "paid" or gr.get("paid_at"):
            raise ConflictError("GR sudah dibayar")

    doc_no = await next_doc_no("PAY")
    now = _now()
    # Sprint 1: withholding fields (PPh 23, PPh 4(2))
    wh_type = payload.get("wh_type") or None        # pph23 | pph42 | None
    wh_subtype = payload.get("wh_subtype") or None  # e.g. jasa, sewa_bangunan
    wh_rate = float(payload.get("wh_rate", 0) or 0)
    wh_amount = round(float(payload.get("wh_amount", 0) or 0), 2)
    wh_coa_id = payload.get("wh_coa_id") or None

    doc = {
        "id": str(uuid.uuid4()),
        "doc_no": doc_no,
        "request_date": request_date,
        "payee_type": payee_type,
        "payee_id": payee_id,
        "payee_text": payee_text,
        "description": description,
        "amount": round(amount, 2),
        "gl_debit_id": gl_debit_id,
        "payment_method_id": payment_method_id,
        "bank_account_id": bank_account_id,
        "invoice_no": payload.get("invoice_no") or None,
        "invoice_date": payload.get("invoice_date") or None,
        "gr_id": gr_id,
        "tax_detail_id": payload.get("tax_detail_id"),
        # Sprint 1: withholding
        "wh_type": wh_type,
        "wh_subtype": wh_subtype,
        "wh_rate": wh_rate,
        "wh_amount": wh_amount,
        "wh_coa_id": wh_coa_id,
        "notes": payload.get("notes") or None,
        "attachments": payload.get("attachments") or [],
        "status": "draft",
        "approval_chain": [],
        "created_at": now, "updated_at": now, "deleted_at": None,
        "created_by": user["id"],
    }
    await db.payment_requests.insert_one(doc)
    await audit_log(user_id=user["id"], entity_type="payment_request",
                    entity_id=doc["id"], action="create", after=serialize(doc))
    return await _enrich(serialize(doc))


async def update_payment(pay_id: str, patch: dict, *, user: dict) -> dict:
    db = get_db()
    before = await db.payment_requests.find_one({"id": pay_id, "deleted_at": None})
    if not before:
        raise NotFoundError("Payment request tidak ditemukan")
    if before["status"] not in ("draft",):
        raise ConflictError("Hanya status 'draft' yang bisa diupdate")
    allowed = {"request_date", "description", "amount", "gl_debit_id",
               "payment_method_id", "bank_account_id", "invoice_no", "invoice_date",
               "payee_id", "payee_text", "notes", "gr_id", "attachments"}
    update: dict = {k: v for k, v in patch.items() if k in allowed}
    if not update:
        return serialize(before)
    if "amount" in update:
        update["amount"] = round(float(update["amount"]), 2)
        if update["amount"] <= 0:
            raise ValidationError("amount harus > 0")
    update["updated_at"] = _now()
    await db.payment_requests.update_one({"id": pay_id}, {"$set": update})
    after = await db.payment_requests.find_one({"id": pay_id})
    await audit_log(user_id=user["id"], entity_type="payment_request",
                    entity_id=pay_id, action="update",
                    before=serialize(before), after=serialize(after))
    return await _enrich(serialize(after))


async def submit_payment(pay_id: str, *, user: dict) -> dict:
    """Transition draft -> submitted/awaiting_approval + kick off notifications."""
    db = get_db()
    doc = await db.payment_requests.find_one({"id": pay_id, "deleted_at": None})
    if not doc:
        raise NotFoundError("Payment request tidak ditemukan")
    if doc["status"] != "draft":
        raise ConflictError(f"Status saat ini '{doc['status']}' — hanya draft yang bisa di-submit")

    # Resolve workflow state for this amount
    state = await approval_service.evaluate("payment_request", doc)
    if state.get("is_complete"):
        # Edge-case — no workflow yet & already complete → go to approved directly
        new_status = "approved"
    else:
        new_status = "awaiting_approval" if state.get("has_workflow") else "submitted"

    update = {"status": new_status, "submitted_at": _now(), "updated_at": _now()}
    await db.payment_requests.update_one({"id": pay_id}, {"$set": update})
    after = await db.payment_requests.find_one({"id": pay_id})
    after_s = serialize(after)

    # Notify first-step approvers
    try:
        await approval_service.notify_pending_approvers(
            "payment_request", after_s, state=state, triggered_by=user,
        )
    except Exception:  # noqa: BLE001
        logger.exception("submit notify failed")

    await audit_log(user_id=user["id"], entity_type="payment_request",
                    entity_id=pay_id, action="submit", after={"status": new_status})
    return await _enrich(after_s)


async def cancel_payment(pay_id: str, *, user: dict, reason: str) -> dict:
    if not reason or not reason.strip():
        raise ValidationError("Alasan cancel wajib")
    db = get_db()
    doc = await db.payment_requests.find_one({"id": pay_id, "deleted_at": None})
    if not doc:
        raise NotFoundError("Payment request tidak ditemukan")
    if doc["status"] in ("paid", "cancelled"):
        raise ConflictError(f"Tidak bisa cancel dari status '{doc['status']}'")
    await db.payment_requests.update_one({"id": pay_id}, {"$set": {
        "status": "cancelled", "cancelled_reason": reason.strip(),
        "cancelled_at": _now(), "cancelled_by": user["id"], "updated_at": _now(),
    }})
    after = await db.payment_requests.find_one({"id": pay_id})
    await audit_log(user_id=user["id"], entity_type="payment_request",
                    entity_id=pay_id, action="cancel", reason=reason.strip())
    return await _enrich(serialize(after))


# ====================== MARK PAID (journal + AP reduce) ======================

async def mark_paid(pay_id: str, payload: dict, *, user: dict) -> dict:
    """Post the payment. Requires approval complete.

    Payload: {payment_date, payment_ref, bank_account_id?}
    """
    db = get_db()
    doc = await db.payment_requests.find_one({"id": pay_id, "deleted_at": None})
    if not doc:
        raise NotFoundError("Payment request tidak ditemukan")
    if doc["status"] != "approved":
        raise ConflictError(f"Status '{doc['status']}' — hanya 'approved' yang bisa mark-paid")

    payment_date = payload.get("payment_date") or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    payment_ref = (payload.get("payment_ref") or "").strip() or None
    bank_account_id = payload.get("bank_account_id") or doc.get("bank_account_id")
    if not bank_account_id:
        raise ValidationError("bank_account_id wajib")

    # Phase 3 hardening — block if target period locked
    from services._period import derive_period_from_date, assert_period_unlocked
    target_period = derive_period_from_date(payment_date)
    if target_period:
        await assert_period_unlocked(target_period, action="mark Payment paid")

    ba = await db.bank_accounts.find_one({"id": bank_account_id, "deleted_at": None})
    if not ba:
        raise ValidationError("bank_account_id tidak valid")
    cr_coa_id = ba.get("gl_account_id")
    if not cr_coa_id:
        # Fallback to GL mapping (bank_default)
        try:
            cr_coa_id = await gl_mapping.resolve("bank_default")
        except Exception as e:  # noqa: BLE001
            raise ValidationError(f"Bank account tidak terhubung ke COA: {e}")

    amount = float(doc.get("amount", 0) or 0)
    description = doc.get("description") or f"Payment {doc['doc_no']}"

    # Sprint 1: PPh Withholding support
    wh_type = doc.get("wh_type")   # pph23 | pph42 | None
    wh_rate = float(doc.get("wh_rate", 0) or 0)
    wh_amount = float(doc.get("wh_amount", 0) or 0)
    wh_coa_id = doc.get("wh_coa_id")

    # Use withholding-aware JE builder if withholding is present, else fall back to standard
    if wh_type and wh_amount > 0 and wh_coa_id:
        enriched_doc = {
            **serialize(doc),
            "payment_date": payment_date,
            "wh_coa_id": wh_coa_id,
        }
        je = await journal_service.post_for_withholding_payment(
            enriched_doc,
            cr_coa_id=cr_coa_id,
            user_id=user["id"],
        )
        # Record withholding transaction
        try:
            from models.tax import make_withholding_doc
            from services import tax_service
            period_str = payment_date[:7]
            vendor_name = None
            if doc.get("payee_id"):
                vendor = await db.vendors.find_one({"id": doc["payee_id"]})
                vendor_name = vendor["name"] if vendor else None
            wh_doc = make_withholding_doc(
                source_type="payment_request",
                source_id=pay_id,
                wh_type=wh_type,
                wh_subtype=doc.get("wh_subtype"),
                gross_amount=amount,
                wh_rate=wh_rate,
                wh_amount=wh_amount,
                period=period_str,
                payee_type=doc.get("payee_type", "vendor"),
                payee_id=doc.get("payee_id"),
                payee_name=vendor_name or doc.get("payee_text"),
                gl_withholding_id=wh_coa_id,
                journal_entry_id=je["id"] if je else None,
                created_by=user["id"],
            )
            await tax_service.record_withholding(wh_doc)
        except Exception as _wh_err:  # noqa: BLE001
            logger.warning("withholding record failed: %s", _wh_err)
    else:
        # Standard payment journal: Dr gl_debit (amount), Cr Bank (amount)
        coa_dbt = await db.chart_of_accounts.find_one({"id": doc["gl_debit_id"]})
        coa_crt = await db.chart_of_accounts.find_one({"id": cr_coa_id})
        lines = [
            {
                "coa_id": doc["gl_debit_id"],
                "coa_code": (coa_dbt or {}).get("code"),
                "coa_name": (coa_dbt or {}).get("name"),
                "dr": round(amount, 2), "cr": 0.0,
                "memo": description,
                "dim_vendor": doc["payee_id"] if doc["payee_type"] == "vendor" else None,
                "dim_employee": doc["payee_id"] if doc["payee_type"] == "employee" else None,
            },
            {
                "coa_id": cr_coa_id,
                "coa_code": (coa_crt or {}).get("code"),
                "coa_name": (coa_crt or {}).get("name"),
                "dr": 0.0, "cr": round(amount, 2),
                "memo": f"via {ba.get('bank', '')} {ba.get('account_number', '')}",
            },
        ]
        je = await journal_service._post_journal(  # type: ignore[attr-defined]
            entry_date=payment_date,
            description=f"Payment {doc['doc_no']}: {description}",
            source_type="payment_request",
            source_id=pay_id,
            lines=lines,
            user_id=user["id"],
        )

    # Update payment doc
    update = {
        "status": "paid",
        "paid_at": _now(),
        "paid_by": user["id"],
        "payment_date": payment_date,
        "payment_ref": payment_ref,
        "bank_account_id": bank_account_id,
        "journal_entry_id": je["id"],
        "updated_at": _now(),
    }
    await db.payment_requests.update_one({"id": pay_id}, {"$set": update})

    # Reduce AP on linked GR
    if doc.get("gr_id"):
        try:
            gr = await db.goods_receipts.find_one({"id": doc["gr_id"]})
            if gr:
                paid_so_far = float(gr.get("paid_amount", 0) or 0) + amount
                gr_total = float(gr.get("grand_total", 0) or 0)
                new_status = "paid" if paid_so_far >= gr_total - 0.5 else "partial"
                await db.goods_receipts.update_one({"id": doc["gr_id"]}, {"$set": {
                    "paid_amount": round(paid_so_far, 2),
                    "payment_status": new_status,
                    "paid_at": _now() if new_status == "paid" else gr.get("paid_at"),
                    "updated_at": _now(),
                }})
        except Exception:  # noqa: BLE001
            logger.exception("GR payment status update failed")

    # Notify creator ("your payment was paid")
    try:
        await notification_service.push(
            user_id=doc.get("created_by") or user["id"],
            type="done",
            title=f"Payment paid: {doc['doc_no']}",
            body=f"Rp {amount:,.0f}".replace(",", ".") + f" · ref {payment_ref or '-'}",
            link=f"/finance/payments/{pay_id}",
            source_type="payment_request", source_id=pay_id,
        )
    except Exception:  # noqa: BLE001
        logger.exception("paid notif failed")

    await audit_log(user_id=user["id"], entity_type="payment_request",
                    entity_id=pay_id, action="mark_paid",
                    after={"journal_entry_id": je["id"], "payment_ref": payment_ref})

    after = await db.payment_requests.find_one({"id": pay_id})
    return await _enrich(serialize(after))


# ====================== UNPAID GR LIST (payable candidates) ======================

async def list_unpaid_grs() -> list[dict]:
    """Return GR records that are unpaid/partial — to populate PAY form."""
    db = get_db()
    grs = await db.goods_receipts.find({
        "deleted_at": None,
        "payment_status": {"$nin": ["paid"]},
    }).sort("receive_date", 1).to_list(500)
    vendors_by_id: dict = {}
    async for v in db.vendors.find({}):
        vendors_by_id[v["id"]] = v
    out = []
    for g in grs:
        total = float(g.get("grand_total", 0) or 0)
        paid = float(g.get("paid_amount", 0) or 0)
        out_bal = total - paid
        if out_bal <= 0:
            continue
        out.append({
            "gr_id": g["id"],
            "doc_no": g.get("doc_no"),
            "vendor_id": g.get("vendor_id"),
            "vendor_name": vendors_by_id.get(g.get("vendor_id"), {}).get("name") or g.get("vendor_id"),
            "invoice_no": g.get("invoice_no"),
            "receive_date": g.get("receive_date"),
            "grand_total": total,
            "paid_amount": paid,
            "outstanding": round(out_bal, 2),
            "payment_terms_days": int(g.get("payment_terms_days", 30) or 30),
        })
    return out


# ====================== KPI ======================

async def payments_kpi() -> dict:
    db = get_db()
    draft = await db.payment_requests.count_documents({"deleted_at": None, "status": "draft"})
    await_appr = await db.payment_requests.count_documents({"deleted_at": None, "status": {"$in": ["submitted", "awaiting_approval"]}})
    approved = await db.payment_requests.count_documents({"deleted_at": None, "status": "approved"})
    month = datetime.now(timezone.utc).strftime("%Y-%m")
    paid_this_month_agg = [
        {"$match": {"deleted_at": None, "status": "paid", "payment_date": {"$regex": f"^{month}"}}},
        {"$group": {"_id": None, "sum": {"$sum": "$amount"}, "cnt": {"$sum": 1}}},
    ]
    paid_sum = 0.0
    paid_cnt = 0
    async for d in db.payment_requests.aggregate(paid_this_month_agg):
        paid_sum = float(d["sum"])
        paid_cnt = int(d["cnt"])
    return {
        "draft": draft,
        "awaiting_approval": await_appr,
        "approved": approved,
        "paid_this_month": {"count": paid_cnt, "amount": round(paid_sum, 2)},
        "period": month,
    }

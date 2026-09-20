"""Payment Run Template service — store & apply recurring payment configurations.

Workflow:
  1. Admin creates a template: name, bank_account, schedule_day, items (vendor/amount/COA)
  2. Finance team clicks "Apply" on the template each month:
     - Creates N Payment Requests (status='approved' if auto_approve=True)
     - Creates a draft Payment Run referencing those PRs
     - Returns pay_ids + run_id so user can go directly to Payment Run detail
  3. User clicks Confirm → Post on the Payment Run to execute batch payment

Items in template are stored with denormalized payee_name, COA code for display.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from core.audit import log as audit_log
from core.db import get_db, serialize
from core.exceptions import ConflictError, NotFoundError, ValidationError
from utils.number_series import next_doc_no

logger = logging.getLogger("aurora.payment_run_template")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ====================== QUERY ======================

async def list_templates(
    *,
    page: int = 1,
    per_page: int = 20,
) -> tuple[list[dict], dict]:
    db = get_db()
    q: dict = {"deleted_at": None}
    skip = (page - 1) * per_page
    items = await db.payment_run_templates.find(q).sort(
        [("name", 1)]
    ).skip(skip).limit(per_page).to_list(per_page)
    total = await db.payment_run_templates.count_documents(q)
    enriched = [await _enrich(serialize(d)) for d in items]
    return enriched, {"page": page, "per_page": per_page, "total": total}


async def get_template(tmpl_id: str) -> dict:
    db = get_db()
    doc = await db.payment_run_templates.find_one({"id": tmpl_id, "deleted_at": None})
    if not doc:
        raise NotFoundError("Template tidak ditemukan")
    return await _enrich(serialize(doc))


# ====================== MUTATIONS ======================

async def create_template(payload: dict, *, user: dict) -> dict:
    """Create a new payment run template.

    Payload: {
        name: str,
        description?: str,
        bank_account_id: str,
        schedule_day: int (1-28),
        auto_approve: bool (default True),
        items: [{
            payee_id?: str, payee_type: str, payee_name?: str,
            amount: float, description: str, gl_debit_id: str,
            wh_type?: str, wh_subtype?: str, wh_rate?: float, wh_coa_id?: str,
        }],
    }
    """
    db = get_db()
    name = (payload.get("name") or "").strip()
    if not name:
        raise ValidationError("name wajib")

    bank_account_id = (payload.get("bank_account_id") or "").strip()
    if not bank_account_id:
        raise ValidationError("bank_account_id wajib")
    ba = await db.bank_accounts.find_one({"id": bank_account_id, "deleted_at": None})
    if not ba:
        raise ValidationError("bank_account_id tidak valid")

    schedule_day = int(payload.get("schedule_day") or 1)
    if not 1 <= schedule_day <= 28:
        raise ValidationError("schedule_day harus antara 1-28")

    raw_items = payload.get("items") or []
    items = await _validate_and_build_items(raw_items, db)
    total_amount = round(sum(float(it["amount"]) for it in items), 2)

    doc = {
        "id": str(uuid.uuid4()),
        "name": name,
        "description": (payload.get("description") or "").strip() or None,
        "bank_account_id": bank_account_id,
        "schedule_day": schedule_day,
        "auto_approve": bool(payload.get("auto_approve", True)),
        "items": items,
        "total_amount": total_amount,
        "apply_count": 0,
        "last_applied_at": None,
        "last_applied_by": None,
        "created_by": user["id"],
        "created_at": _now(),
        "updated_at": _now(),
        "deleted_at": None,
    }
    await db.payment_run_templates.insert_one(doc)
    await audit_log(user_id=user["id"], entity_type="payment_run_template", entity_id=doc["id"],
                    action="create", after={"name": name, "items": len(items), "total": total_amount})
    return await _enrich(serialize(doc))


async def update_template(tmpl_id: str, payload: dict, *, user: dict) -> dict:
    """Update template name, description, items, schedule_day, auto_approve."""
    db = get_db()
    doc = await db.payment_run_templates.find_one({"id": tmpl_id, "deleted_at": None})
    if not doc:
        raise NotFoundError("Template tidak ditemukan")

    upd: dict = {"updated_at": _now()}
    if "name" in payload:
        n = (payload["name"] or "").strip()
        if not n:
            raise ValidationError("name tidak boleh kosong")
        upd["name"] = n
    if "description" in payload:
        upd["description"] = (payload.get("description") or "").strip() or None
    if "schedule_day" in payload:
        day = int(payload["schedule_day"])
        if not 1 <= day <= 28:
            raise ValidationError("schedule_day harus 1-28")
        upd["schedule_day"] = day
    if "auto_approve" in payload:
        upd["auto_approve"] = bool(payload["auto_approve"])
    if "bank_account_id" in payload:
        ba = await db.bank_accounts.find_one({"id": payload["bank_account_id"], "deleted_at": None})
        if not ba:
            raise ValidationError("bank_account_id tidak valid")
        upd["bank_account_id"] = payload["bank_account_id"]
    if "items" in payload:
        items = await _validate_and_build_items(payload["items"] or [], db)
        upd["items"] = items
        upd["total_amount"] = round(sum(float(it["amount"]) for it in items), 2)

    await db.payment_run_templates.update_one({"id": tmpl_id}, {"$set": upd})
    fresh = await db.payment_run_templates.find_one({"id": tmpl_id})
    return await _enrich(serialize(fresh))


async def delete_template(tmpl_id: str, *, user: dict) -> None:
    db = get_db()
    doc = await db.payment_run_templates.find_one({"id": tmpl_id, "deleted_at": None})
    if not doc:
        raise NotFoundError("Template tidak ditemukan")
    await db.payment_run_templates.update_one(
        {"id": tmpl_id},
        {"$set": {"deleted_at": _now(), "updated_at": _now()}}
    )
    await audit_log(user_id=user["id"], entity_type="payment_run_template",
                    entity_id=tmpl_id, action="delete", after={})


async def apply_template(tmpl_id: str, payload: dict, *, user: dict) -> dict:
    """Apply template: create Payment Requests + draft Payment Run.

    Payload: {
        payment_date: "YYYY-MM-DD",
        notes?: str,
    }

    Returns: {
        template_id, payment_date,
        pr_ids: [str], pr_doc_nos: [str],
        run_id: str?, run_doc_no: str?,
    }
    """
    db = get_db()
    tmpl = await db.payment_run_templates.find_one({"id": tmpl_id, "deleted_at": None})
    if not tmpl:
        raise NotFoundError("Template tidak ditemukan")

    payment_date = (payload.get("payment_date") or "").strip()
    if not payment_date:
        raise ValidationError("payment_date wajib")

    items: list[dict] = tmpl.get("items") or []
    if not items:
        raise ValidationError("Template tidak memiliki items")

    auto_approve = bool(tmpl.get("auto_approve", True))
    bank_account_id = tmpl["bank_account_id"]
    notes = (payload.get("notes") or "").strip() or None
    now = _now()

    # ── 1. Create Payment Requests ─────────────────────────────────────────────
    pr_ids: list[str] = []
    pr_doc_nos: list[str] = []
    request_date = payment_date

    for item in items:
        wh_amount = 0.0
        if item.get("wh_type") and float(item.get("wh_rate", 0) or 0) > 0:
            wh_amount = round(float(item["amount"]) * float(item["wh_rate"]) / 100, 2)

        doc_no = await next_doc_no("PAY")
        pr_doc = {
            "id": str(uuid.uuid4()),
            "doc_no": doc_no,
            "request_date": request_date,
            "payee_type": item["payee_type"],
            "payee_id": item.get("payee_id") or None,
            "payee_text": item.get("payee_name") or None,
            "description": item["description"],
            "amount": round(float(item["amount"]), 2),
            "gl_debit_id": item["gl_debit_id"],
            "bank_account_id": bank_account_id,
            "payment_method_id": None,
            "invoice_no": None,
            "gr_id": None,
            # WHT fields
            "wh_type": item.get("wh_type") or None,
            "wh_subtype": item.get("wh_subtype") or None,
            "wh_rate": float(item.get("wh_rate", 0) or 0),
            "wh_amount": wh_amount,
            "wh_coa_id": item.get("wh_coa_id") or None,
            # Status
            "status": "approved" if auto_approve else "submitted",
            "approvals": [{"user_id": user["id"], "action": "approve",
                           "timestamp": now, "note": f"Auto-approved via template: {tmpl['name']}"}]
                         if auto_approve else [],
            "submitted_at": now,
            "submitted_by": user["id"],
            "approved_at": now if auto_approve else None,
            "approved_by": user["id"] if auto_approve else None,
            "paid_at": None, "paid_by": None,
            "payment_date": None, "payment_ref": None,
            "journal_entry_id": None,
            "template_id": tmpl_id,  # link back
            "created_by": user["id"],
            "created_at": now,
            "updated_at": now,
            "deleted_at": None,
        }
        await db.payment_requests.insert_one(pr_doc)
        pr_ids.append(pr_doc["id"])
        pr_doc_nos.append(doc_no)
        logger.info("Created PR %s from template %s", doc_no, tmpl_id)

    # ── 2. Create draft Payment Run (only if auto_approve=True) ───────────────
    run_id: Optional[str] = None
    run_doc_no: Optional[str] = None

    if auto_approve and pr_ids:
        total_amount = round(sum(float(it["amount"]) for it in items), 2)
        wht_total = round(sum(
            round(float(it["amount"]) * float(it.get("wh_rate", 0) or 0) / 100, 2)
            for it in items if it.get("wh_type") and float(it.get("wh_rate", 0) or 0) > 0
        ), 2)
        run_doc_no_val = await next_doc_no("PRN")
        run_doc = {
            "id": str(uuid.uuid4()),
            "doc_no": run_doc_no_val,
            "status": "draft",
            "payment_date": payment_date,
            "bank_account_id": bank_account_id,
            "pay_ids": pr_ids,
            "total_amount": total_amount,
            "net_amount": round(total_amount - wht_total, 2),
            "total_wht": wht_total,
            "notes": notes or f"Dari template: {tmpl['name']}",
            "je_id": None,
            "je_ids": [],
            "template_id": tmpl_id,
            "created_by": user["id"],
            "created_at": now,
            "updated_at": now,
            "confirmed_at": None, "confirmed_by": None,
            "posted_at": None, "posted_by": None,
            "cancelled_at": None, "cancelled_by": None,
            "cancel_reason": None,
            "deleted_at": None,
        }
        await db.payment_runs.insert_one(run_doc)
        run_id = run_doc["id"]
        run_doc_no = run_doc_no_val

    # ── 3. Update template apply metadata ─────────────────────────────────────
    await db.payment_run_templates.update_one({"id": tmpl_id}, {"$set": {
        "last_applied_at": now,
        "last_applied_by": user["id"],
        "apply_count": (tmpl.get("apply_count") or 0) + 1,
        "updated_at": now,
    }})
    await audit_log(user_id=user["id"], entity_type="payment_run_template", entity_id=tmpl_id,
                    action="apply", after={"payment_date": payment_date, "pr_count": len(pr_ids),
                                           "run_id": run_id, "auto_approve": auto_approve})

    return {
        "template_id": tmpl_id,
        "template_name": tmpl["name"],
        "payment_date": payment_date,
        "auto_approve": auto_approve,
        "pr_ids": pr_ids,
        "pr_doc_nos": pr_doc_nos,
        "run_id": run_id,
        "run_doc_no": run_doc_no,
    }


# ====================== ENRICH ======================

async def _enrich(doc: dict) -> dict:
    db = get_db()
    if doc.get("bank_account_id"):
        ba = await db.bank_accounts.find_one({"id": doc["bank_account_id"]})
        if ba:
            doc["bank_account_name"] = f"{ba.get('bank', '')} {ba.get('account_number', '')} — {ba.get('name', '')}".strip(" —")
    if doc.get("created_by"):
        u = await db.users.find_one({"id": doc["created_by"]})
        doc["created_by_name"] = (u or {}).get("full_name") or (u or {}).get("email") or doc["created_by"]
    if doc.get("last_applied_by"):
        u = await db.users.find_one({"id": doc["last_applied_by"]})
        doc["last_applied_by_name"] = (u or {}).get("full_name") or (u or {}).get("email") or doc["last_applied_by"]
    doc["item_count"] = len(doc.get("items") or [])
    return doc


async def _validate_and_build_items(raw_items: list, db) -> list[dict]:
    """Validate + denormalize payee_name and COA info for each item."""
    if not raw_items:
        return []
    items = []
    for i, it in enumerate(raw_items):
        payee_type = it.get("payee_type", "vendor")
        amount = float(it.get("amount", 0) or 0)
        if amount <= 0:
            raise ValidationError(f"Item {i+1}: amount harus > 0")
        description = (it.get("description") or "").strip()
        if not description:
            raise ValidationError(f"Item {i+1}: description wajib")
        gl_debit_id = it.get("gl_debit_id")
        if not gl_debit_id:
            raise ValidationError(f"Item {i+1}: gl_debit_id wajib")
        coa = await db.chart_of_accounts.find_one({"id": gl_debit_id})
        if not coa:
            raise ValidationError(f"Item {i+1}: gl_debit_id '{gl_debit_id}' tidak ditemukan")

        # Denormalize payee_name
        payee_name = (it.get("payee_name") or "").strip()
        payee_id = it.get("payee_id") or None
        if payee_id and not payee_name:
            if payee_type == "vendor":
                v = await db.vendors.find_one({"id": payee_id})
                payee_name = (v or {}).get("name") or ""
            elif payee_type == "employee":
                e = await db.employees.find_one({"id": payee_id})
                payee_name = (e or {}).get("full_name") or ""

        wh_rate = float(it.get("wh_rate", 0) or 0)
        items.append({
            "id": it.get("id") or str(uuid.uuid4()),
            "payee_type": payee_type,
            "payee_id": payee_id,
            "payee_name": payee_name,
            "amount": round(amount, 2),
            "description": description,
            "gl_debit_id": gl_debit_id,
            "gl_debit_code": coa.get("code"),
            "gl_debit_name": coa.get("name"),
            "wh_type": it.get("wh_type") or None,
            "wh_subtype": it.get("wh_subtype") or None,
            "wh_rate": wh_rate,
            "wh_coa_id": it.get("wh_coa_id") or None,
        })
    return items

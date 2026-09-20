"""Payment Runs service — batch payment execution.

Workflow:
  draft → confirmed → posted  (or cancelled at draft/confirmed)

On post:
  - Validates all selected PAYs are still in 'approved' status
  - Non-WHT PAYs → single batch JE (Dr expense lines, Cr bank total)
  - WHT PAYs → individual JEs per payment via post_for_withholding_payment
    (bank outflow = gross - WHT; PPh recorded to ebupot_wh collection)
  - All JE IDs stored in je_ids; first batch JE also stored in je_id
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from core.audit import log as audit_log
from core.db import get_db, serialize
from core.exceptions import ConflictError, NotFoundError, ValidationError
from services import gl_mapping, journal_service, notification_service
from utils.number_series import next_doc_no

logger = logging.getLogger("aurora.payment_run")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ====================== QUERY ======================

async def list_payment_runs(
    *,
    status: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    page: int = 1,
    per_page: int = 20,
) -> tuple[list[dict], dict]:
    db = get_db()
    q: dict = {"deleted_at": None}
    if status:
        q["status"] = status
    if date_from:
        q.setdefault("payment_date", {})["$gte"] = date_from
    if date_to:
        q.setdefault("payment_date", {})["$lte"] = date_to
    skip = (page - 1) * per_page
    items = (
        await db.payment_runs
        .find(q)
        .sort([("created_at", -1)])
        .skip(skip)
        .limit(per_page)
        .to_list(per_page)
    )
    total = await db.payment_runs.count_documents(q)
    enriched = [await _enrich_summary(serialize(d)) for d in items]
    return enriched, {"page": page, "per_page": per_page, "total": total}


async def get_payment_run(run_id: str) -> dict:
    db = get_db()
    doc = await db.payment_runs.find_one({"id": run_id, "deleted_at": None})
    if not doc:
        raise NotFoundError("Payment run tidak ditemukan")
    return await _enrich_detail(serialize(doc))


async def kpi() -> dict:
    db = get_db()
    now = datetime.now(timezone.utc)
    period = now.strftime("%Y-%m")
    base_q = {"deleted_at": None}

    draft_count = await db.payment_runs.count_documents({**base_q, "status": "draft"})
    confirmed_count = await db.payment_runs.count_documents({**base_q, "status": "confirmed"})

    # Posted this month
    start = f"{period}-01"
    cap = now.strftime("%Y-%m-%d")
    posted_docs = await db.payment_runs.find({
        **base_q, "status": "posted",
        "payment_date": {"$gte": start, "$lte": cap},
    }, {"total_amount": 1}).to_list(500)
    posted_amount = sum(float(d.get("total_amount", 0) or 0) for d in posted_docs)
    posted_count = len(posted_docs)

    return {
        "draft": draft_count,
        "confirmed": confirmed_count,
        "posted_this_month": {"count": posted_count, "amount": posted_amount},
        "period": period,
    }


# ====================== MUTATIONS ======================

async def create_payment_run(payload: dict, *, user: dict) -> dict:
    """Create a draft payment run.

    Payload: {
        payment_date: "YYYY-MM-DD",
        bank_account_id: str,
        pay_ids: [str],   # list of approved payment_request IDs
        notes?: str,
    }
    """
    db = get_db()
    payment_date = (payload.get("payment_date") or "").strip()
    if not payment_date:
        raise ValidationError("payment_date wajib diisi")
    bank_account_id = (payload.get("bank_account_id") or "").strip()
    if not bank_account_id:
        raise ValidationError("bank_account_id wajib diisi")
    pay_ids = payload.get("pay_ids") or []
    if not pay_ids:
        raise ValidationError("pay_ids tidak boleh kosong")

    # Validate bank account
    ba = await db.bank_accounts.find_one({"id": bank_account_id, "deleted_at": None})
    if not ba:
        raise ValidationError("bank_account_id tidak valid")
    if not ba.get("gl_account_id"):
        raise ValidationError("Bank account tidak terhubung ke COA GL — hubungi admin")

    # Validate period lock
    from services._period import derive_period_from_date, assert_period_unlocked
    target_period = derive_period_from_date(payment_date)
    if target_period:
        await assert_period_unlocked(target_period, action="create Payment Run")

    # Validate all pay_ids exist and are approved
    pays = await db.payment_requests.find(
        {"id": {"$in": pay_ids}, "deleted_at": None}
    ).to_list(len(pay_ids) + 1)
    pay_map = {p["id"]: p for p in pays}

    errors = []
    for pid in pay_ids:
        p = pay_map.get(pid)
        if not p:
            errors.append(f"{pid}: tidak ditemukan")
        elif p["status"] != "approved":
            errors.append(f"{p.get('doc_no', pid)}: status '{p['status']}' — harus 'approved'")
    if errors:
        raise ValidationError("Validasi payment gagal: " + "; ".join(errors))

    total_amount = sum(float(p.get("amount", 0) or 0) for p in pays)
    wht_total = sum(float(p.get("wh_amount", 0) or 0) for p in pays if p.get("wh_type") and float(p.get("wh_amount", 0) or 0) > 0)
    net_amount = round(total_amount - wht_total, 2)
    doc_no = await next_doc_no("PRN")

    doc = {
        "id": str(uuid.uuid4()),
        "doc_no": doc_no,
        "status": "draft",
        "payment_date": payment_date,
        "bank_account_id": bank_account_id,
        "pay_ids": list(pay_ids),
        "total_amount": round(total_amount, 2),
        "net_amount": net_amount,
        "notes": (payload.get("notes") or "").strip() or None,
        "je_id": None,
        "je_ids": [],
        "created_by": user["id"],
        "created_at": _now(),
        "updated_at": _now(),
        "confirmed_at": None,
        "confirmed_by": None,
        "posted_at": None,
        "posted_by": None,
        "cancelled_at": None,
        "cancelled_by": None,
        "cancel_reason": None,
        "deleted_at": None,
    }
    await db.payment_runs.insert_one(doc)

    await audit_log(
        user_id=user["id"], entity_type="payment_run",
        entity_id=doc["id"], action="create",
        after={"doc_no": doc_no, "total_amount": total_amount, "pay_count": len(pay_ids)},
    )
    return await _enrich_detail(serialize(doc))


async def update_payment_run(run_id: str, payload: dict, *, user: dict) -> dict:
    """Update draft payment run (payment_date, bank_account_id, pay_ids, notes)."""
    db = get_db()
    doc = await db.payment_runs.find_one({"id": run_id, "deleted_at": None})
    if not doc:
        raise NotFoundError("Payment run tidak ditemukan")
    if doc["status"] != "draft":
        raise ConflictError(f"Hanya payment run 'draft' yang bisa diubah (status: {doc['status']})")

    upd: dict = {"updated_at": _now()}
    if "payment_date" in payload:
        upd["payment_date"] = payload["payment_date"]
    if "notes" in payload:
        upd["notes"] = (payload.get("notes") or "").strip() or None
    if "pay_ids" in payload:
        pay_ids = payload["pay_ids"] or []
        if not pay_ids:
            raise ValidationError("pay_ids tidak boleh kosong")
        pays = await db.payment_requests.find(
            {"id": {"$in": pay_ids}, "deleted_at": None}
        ).to_list(len(pay_ids) + 1)
        pay_map = {p["id"]: p for p in pays}
        errors = []
        for pid in pay_ids:
            p = pay_map.get(pid)
            if not p:
                errors.append(f"{pid}: tidak ditemukan")
            elif p["status"] != "approved":
                errors.append(f"{p.get('doc_no', pid)}: status '{p['status']}'")
        if errors:
            raise ValidationError("Validasi: " + "; ".join(errors))
        upd["pay_ids"] = list(pay_ids)
        upd["total_amount"] = round(sum(float(p.get("amount", 0) or 0) for p in pays), 2)

    if "bank_account_id" in payload:
        ba = await db.bank_accounts.find_one({"id": payload["bank_account_id"], "deleted_at": None})
        if not ba:
            raise ValidationError("bank_account_id tidak valid")
        upd["bank_account_id"] = payload["bank_account_id"]

    await db.payment_runs.update_one({"id": run_id}, {"$set": upd})
    fresh = await db.payment_runs.find_one({"id": run_id})
    return await _enrich_detail(serialize(fresh))


async def confirm_payment_run(run_id: str, *, user: dict) -> dict:
    """Transition draft → confirmed (final review before execution)."""
    db = get_db()
    doc = await db.payment_runs.find_one({"id": run_id, "deleted_at": None})
    if not doc:
        raise NotFoundError("Payment run tidak ditemukan")
    if doc["status"] != "draft":
        raise ConflictError(f"Hanya status 'draft' yang bisa dikonfirmasi (saat ini: {doc['status']})")

    now = _now()
    await db.payment_runs.update_one({"id": run_id}, {"$set": {
        "status": "confirmed",
        "confirmed_at": now,
        "confirmed_by": user["id"],
        "updated_at": now,
    }})
    await audit_log(user_id=user["id"], entity_type="payment_run", entity_id=run_id,
                    action="confirm", after={"status": "confirmed"})
    fresh = await db.payment_runs.find_one({"id": run_id})
    return await _enrich_detail(serialize(fresh))


async def post_payment_run(run_id: str, payload: dict, *, user: dict) -> dict:
    """Execute the payment run: post batch JE + mark all PAYs as paid.

    Payload (optional): { notes?: str }
    """
    db = get_db()
    doc = await db.payment_runs.find_one({"id": run_id, "deleted_at": None})
    if not doc:
        raise NotFoundError("Payment run tidak ditemukan")
    if doc["status"] != "confirmed":
        raise ConflictError(f"Hanya status 'confirmed' yang bisa dieksekusi (saat ini: {doc['status']})")

    payment_date = doc["payment_date"]
    bank_account_id = doc["bank_account_id"]
    pay_ids: list[str] = doc.get("pay_ids") or []

    # Period lock check
    from services._period import derive_period_from_date, assert_period_unlocked
    target_period = derive_period_from_date(payment_date)
    if target_period:
        await assert_period_unlocked(target_period, action="post Payment Run")

    # Fetch bank account
    ba = await db.bank_accounts.find_one({"id": bank_account_id, "deleted_at": None})
    if not ba:
        raise ValidationError("Bank account tidak ditemukan")
    cr_coa_id = ba.get("gl_account_id")
    if not cr_coa_id:
        try:
            cr_coa_id = await gl_mapping.resolve("bank_default")
        except Exception as e:  # noqa: BLE001
            raise ValidationError(f"Bank account tidak terhubung ke COA: {e}")

    # Re-validate all payments are still approved
    pays = await db.payment_requests.find(
        {"id": {"$in": pay_ids}, "deleted_at": None}
    ).to_list(len(pay_ids) + 1)
    pay_map = {p["id"]: p for p in pays}

    issues = []
    for pid in pay_ids:
        p = pay_map.get(pid)
        if not p:
            issues.append(f"{pid}: tidak ditemukan")
        elif p["status"] != "approved":
            issues.append(f"{p.get('doc_no', pid)}: status sudah berubah menjadi '{p['status']}'")
    if issues:
        raise ConflictError("Eksekusi gagal — beberapa payment bermasalah: " + "; ".join(issues))

    # Build JE lines for non-WHT pays (WHT pays have individual JEs below)
    je_lines = []
    coa_cache: dict[str, dict] = {}
    for pid in pay_ids:
        p = pay_map[pid]
        dr_coa_id = p.get("gl_debit_id")
        if not dr_coa_id:
            issues.append(f"{p.get('doc_no', pid)}: gl_debit_id tidak ada")
            continue
        if dr_coa_id not in coa_cache:
            coa = await db.chart_of_accounts.find_one({"id": dr_coa_id})
            coa_cache[dr_coa_id] = coa or {}
        coa = coa_cache[dr_coa_id]
        amount = round(float(p.get("amount", 0) or 0), 2)
        desc_short = (p.get("description") or p.get("doc_no") or "")[:60]
        je_lines.append({
            "_pay_id": p["id"],  # internal tag for split logic
            "coa_id": dr_coa_id,
            "coa_code": coa.get("code"),
            "coa_name": coa.get("name"),
            "dr": amount, "cr": 0.0,
            "memo": f"{p['doc_no']}: {desc_short}",
            "dim_vendor": p["payee_id"] if p.get("payee_type") == "vendor" else None,
            "dim_employee": p["payee_id"] if p.get("payee_type") == "employee" else None,
        })

    if issues:
        raise ValidationError("JE build gagal: " + "; ".join(issues))

    # Fetch bank COA
    if cr_coa_id not in coa_cache:
        coa_cr = await db.chart_of_accounts.find_one({"id": cr_coa_id})
        coa_cache[cr_coa_id] = coa_cr or {}
    coa_cr = coa_cache[cr_coa_id]

    # ── Split: non-WHT batch JE + WHT individual JEs ──────────────────────────
    all_je_ids: list[str] = []
    batch_je_id: Optional[str] = None

    wht_pays = [p for p in pays if p.get("wh_type") and float(p.get("wh_amount", 0) or 0) > 0 and p.get("wh_coa_id")]
    wht_pay_ids = {p["id"] for p in wht_pays}
    non_wht_lines = [ln for ln in je_lines if ln.get("_pay_id") not in wht_pay_ids]
    # Strip internal tag
    for ln in non_wht_lines:
        ln.pop("_pay_id", None)

    # ── 1. Batch JE for non-WHT payments ──────────────────────────────────────
    if non_wht_lines:
        batch_total = round(sum(ln["dr"] for ln in non_wht_lines), 2)
        non_wht_lines.append({
            "coa_id": cr_coa_id,
            "coa_code": coa_cr.get("code"),
            "coa_name": coa_cr.get("name"),
            "dr": 0.0, "cr": batch_total,
            "memo": f"Payment Run {doc['doc_no']} (batch) via {ba.get('bank','')} {ba.get('account_number','')}".strip(),
        })
        batch_je = await journal_service._post_journal(  # type: ignore[attr-defined]
            entry_date=payment_date,
            description=f"Payment Run {doc['doc_no']}: {len(non_wht_lines)-1} payments (batch) — Rp {batch_total:,.0f}".replace(",", "."),
            source_type="payment_run",
            source_id=run_id,
            lines=non_wht_lines,
            user_id=user["id"],
        )
        batch_je_id = batch_je["id"]
        all_je_ids.append(batch_je_id)

    # ── 2. Individual JEs for WHT payments ────────────────────────────────────
    for pay in wht_pays:
        enriched = {**serialize(pay), "payment_date": payment_date, "wh_coa_id": pay.get("wh_coa_id")}
        try:
            je_wht = await journal_service.post_for_withholding_payment(  # type: ignore[attr-defined]
                enriched, cr_coa_id=cr_coa_id, user_id=user["id"],
            )
            if je_wht:
                all_je_ids.append(je_wht["id"])
        except Exception:  # noqa: BLE001
            logger.exception("WHT JE failed for pay %s in run %s", pay["id"], run_id)
            continue
        # Record to ebupot_wh
        try:
            from models.tax import make_withholding_doc
            from services import tax_service
            vendor_name = None
            if pay.get("payee_id"):
                v = await db.vendors.find_one({"id": pay["payee_id"]})
                vendor_name = (v or {}).get("name")
            wh_doc = make_withholding_doc(
                source_type="payment_request", source_id=pay["id"],
                wh_type=pay.get("wh_type"), wh_subtype=pay.get("wh_subtype"),
                gross_amount=float(pay.get("amount", 0) or 0),
                wh_rate=float(pay.get("wh_rate", 0) or 0),
                wh_amount=float(pay.get("wh_amount", 0) or 0),
                period=payment_date[:7],
                payee_type=pay.get("payee_type", "vendor"), payee_id=pay.get("payee_id"),
                payee_name=vendor_name or pay.get("payee_text"),
                gl_withholding_id=pay.get("wh_coa_id"),
                journal_entry_id=all_je_ids[-1] if all_je_ids else None,
                created_by=user["id"],
            )
            await tax_service.record_withholding(wh_doc)
        except Exception:  # noqa: BLE001
            logger.warning("WHT record failed for pay %s", pay["id"])

    # Totals
    total_amount = round(sum(float(p.get("amount", 0) or 0) for p in pays), 2)
    total_wht = round(sum(float(p.get("wh_amount", 0) or 0) for p in wht_pays), 2)
    net_amount = round(total_amount - total_wht, 2)
    primary_je_id = batch_je_id or (all_je_ids[0] if all_je_ids else None)

    # Mark each PAY as paid
    now = _now()
    for pid in pay_ids:
        p = pay_map[pid]
        # Use WHT-specific JE if this pay has WHT, otherwise batch JE
        pay_je_id = next((jid for jid in all_je_ids
                          if jid != batch_je_id), None) if p["id"] in wht_pay_ids else batch_je_id
        await db.payment_requests.update_one({"id": pid}, {"$set": {
            "status": "paid",
            "paid_at": now,
            "paid_by": user["id"],
            "payment_date": payment_date,
            "payment_ref": doc["doc_no"],
            "bank_account_id": bank_account_id,
            "journal_entry_id": pay_je_id or primary_je_id,
            "updated_at": now,
        }})
        # Reduce AP on linked GR
        if p.get("gr_id"):
            try:
                gr = await db.goods_receipts.find_one({"id": p["gr_id"]})
                if gr:
                    paid_so_far = float(gr.get("paid_amount", 0) or 0) + float(p.get("amount", 0) or 0)
                    gr_total = float(gr.get("grand_total", 0) or 0)
                    new_status = "paid" if paid_so_far >= gr_total - 0.5 else "partial"
                    await db.goods_receipts.update_one({"id": p["gr_id"]}, {"$set": {
                        "paid_amount": round(paid_so_far, 2),
                        "payment_status": new_status,
                        "paid_at": now if new_status == "paid" else gr.get("paid_at"),
                        "updated_at": now,
                    }})
            except Exception:  # noqa: BLE001
                logger.exception("GR AP reduction failed for pay %s in run %s", pid, run_id)

    # Notify creator of the run
    try:
        await notification_service.push(
            user_id=doc.get("created_by") or user["id"],
            type="done",
            title=f"Payment Run dieksekusi: {doc['doc_no']}",
            body=f"{len(pay_ids)} payments · Rp {total_amount:,.0f}".replace(",", "."),
            link=f"/finance/payment-runs/{run_id}",
            source_type="payment_run", source_id=run_id,
        )
    except Exception:  # noqa: BLE001
        logger.exception("payment run notif failed")

    # Update run doc
    await db.payment_runs.update_one({"id": run_id}, {"$set": {
        "status": "posted",
        "posted_at": now,
        "posted_by": user["id"],
        "je_id": primary_je_id,
        "je_ids": all_je_ids,
        "total_amount": total_amount,
        "net_amount": net_amount,
        "total_wht": total_wht,
        "updated_at": now,
    }})

    await audit_log(user_id=user["id"], entity_type="payment_run", entity_id=run_id,
                    action="post", after={"je_ids": all_je_ids, "pay_count": len(pay_ids),
                                          "total_amount": total_amount, "total_wht": total_wht})

    fresh = await db.payment_runs.find_one({"id": run_id})
    return await _enrich_detail(serialize(fresh))


async def cancel_payment_run(run_id: str, payload: dict, *, user: dict) -> dict:
    """Cancel a draft or confirmed payment run."""
    db = get_db()
    doc = await db.payment_runs.find_one({"id": run_id, "deleted_at": None})
    if not doc:
        raise NotFoundError("Payment run tidak ditemukan")
    if doc["status"] not in ("draft", "confirmed"):
        raise ConflictError(f"Hanya status 'draft'/'confirmed' yang bisa dibatalkan (saat ini: {doc['status']})")

    reason = (payload.get("reason") or "").strip() or None
    now = _now()
    await db.payment_runs.update_one({"id": run_id}, {"$set": {
        "status": "cancelled",
        "cancelled_at": now,
        "cancelled_by": user["id"],
        "cancel_reason": reason,
        "updated_at": now,
    }})
    await audit_log(user_id=user["id"], entity_type="payment_run", entity_id=run_id,
                    action="cancel", after={"reason": reason})
    fresh = await db.payment_runs.find_one({"id": run_id})
    return await _enrich_detail(serialize(fresh))


# ====================== ENRICH ======================

async def _enrich_summary(doc: dict) -> dict:
    db = get_db()
    if doc.get("bank_account_id"):
        ba = await db.bank_accounts.find_one({"id": doc["bank_account_id"]})
        if ba:
            doc["bank_account_name"] = f"{ba.get('bank', '')} {ba.get('account_number', '')} — {ba.get('name', '')}".strip(" —")
    doc["pay_count"] = len(doc.get("pay_ids") or [])
    doc["has_wht"] = doc.get("total_wht", 0) > 0
    # Resolve created_by name
    if doc.get("created_by"):
        u = await db.users.find_one({"id": doc["created_by"]})
        doc["created_by_name"] = (u or {}).get("full_name") or (u or {}).get("email") or doc["created_by"]
    return doc


async def _enrich_detail(doc: dict) -> dict:
    doc = await _enrich_summary(doc)
    db = get_db()
    pay_ids: list[str] = doc.get("pay_ids") or []
    if pay_ids:
        pays_raw = await db.payment_requests.find(
            {"id": {"$in": pay_ids}, "deleted_at": None}
        ).to_list(len(pay_ids) + 1)
        # Enrich payee names
        enriched_pays = []
        for p in pays_raw:
            ps = serialize(p)
            if ps.get("payee_type") == "vendor" and ps.get("payee_id"):
                v = await db.vendors.find_one({"id": ps["payee_id"]})
                ps["payee_name"] = (v or {}).get("name") or ps.get("payee_text") or ""
            elif ps.get("payee_type") == "employee" and ps.get("payee_id"):
                e = await db.employees.find_one({"id": ps["payee_id"]})
                ps["payee_name"] = (e or {}).get("full_name") or ps.get("payee_text") or ""
            else:
                ps["payee_name"] = ps.get("payee_text") or "-"
            enriched_pays.append(ps)
        # Sort by pay_ids order
        order = {pid: i for i, pid in enumerate(pay_ids)}
        enriched_pays.sort(key=lambda x: order.get(x["id"], 999))
        doc["payments"] = enriched_pays
    else:
        doc["payments"] = []
    # Resolve posted_by, confirmed_by
    for field in ("confirmed_by", "posted_by", "cancelled_by"):
        uid = doc.get(field)
        if uid:
            u = await db.users.find_one({"id": uid})
            doc[f"{field}_name"] = (u or {}).get("full_name") or (u or {}).get("email") or uid
    return doc

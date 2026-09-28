"""Outlet portal services: daily_sales, petty_cash, urgent_purchase."""
import uuid
from core.clock import period_now as _biz_period, today_str as _biz_today  # SSOT-11: WIB business date
from datetime import datetime, timezone
from typing import Optional

from core.audit import log as audit_log
from core.db import get_db, serialize
from core.exceptions import (
    ForbiddenError, NotFoundError, ValidationError,
)
from services import journal_service


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# =================== DAILY SALES ===================

async def list_daily_sales(
    *, outlet_ids: Optional[list[str]], date_from: Optional[str] = None, date_to: Optional[str] = None,
    status: Optional[str] = None, page: int = 1, per_page: int = 20,
):
    db = get_db()
    q: dict = {"deleted_at": None}
    if outlet_ids is not None and len(outlet_ids) > 0:
        q["outlet_id"] = {"$in": outlet_ids}
    elif outlet_ids is not None and len(outlet_ids) == 0:
        # Empty list means no accessible outlets → return empty
        return [], {"page": page, "per_page": per_page, "total": 0}
    # outlet_ids=None means no restriction (superadmin)
    if date_from:
        q.setdefault("sales_date", {})["$gte"] = date_from
    if date_to:
        q.setdefault("sales_date", {})["$lte"] = date_to
    if status:
        q["status"] = status
    skip = (page - 1) * per_page
    items = await db.daily_sales.find(q).sort([("sales_date", -1), ("created_at", -1)]).skip(skip).limit(per_page).to_list(per_page)
    total = await db.daily_sales.count_documents(q)
    
    # Build outlet lookup map for enrichment
    outlets_map = {}
    async for outlet_doc in db.outlets.find({"deleted_at": None}, {"id": 1, "name": 1, "brand": 1}):
        outlets_map[outlet_doc["id"]] = {
            "name": outlet_doc.get("name", "(Unknown Outlet)"),
            "brand": outlet_doc.get("brand", "")
        }
    
    # Enrich each daily sales entry with outlet_name
    enriched_items = []
    for d in items:
        item = serialize(d)
        outlet_id = item.get("outlet_id")
        if outlet_id and outlet_id in outlets_map:
            item["outlet_name"] = outlets_map[outlet_id]["name"]
            item["outlet_brand"] = outlets_map[outlet_id]["brand"]
        else:
            item["outlet_name"] = "(Unknown Outlet)"
            item["outlet_brand"] = ""
        enriched_items.append(item)
    
    return enriched_items, {"page": page, "per_page": per_page, "total": total}


async def upsert_daily_sales_draft(payload: dict, *, user: dict) -> dict:
    """Create or update DRAFT daily_sales (one per outlet+date)."""
    db = get_db()
    if not payload.get("outlet_id"):
        raise ValidationError("outlet_id wajib diisi")
    if not payload.get("sales_date"):
        raise ValidationError("sales_date wajib diisi")
    # Guard input shape: these fields must be lists of objects (FE sends list-of-dicts).
    # Prevents an uncaught AttributeError (500) when a caller sends a dict/scalar.
    for _fld in ("channels", "payment_breakdown", "revenue_buckets"):
        if payload.get(_fld) is not None and not isinstance(payload[_fld], list):
            raise ValidationError(f"{_fld} harus berupa list")
    outlet_id = payload["outlet_id"]
    sales_date = payload["sales_date"]
    if outlet_id not in user.get("outlet_ids", []) and "*" not in await _user_perms(user):
        raise ForbiddenError("Outlet bukan dalam scope Anda")

    # FIN-04: one daily sales per outlet+date — no new draft once submitted/validated exists
    if await db.daily_sales.find_one({"outlet_id": outlet_id, "sales_date": sales_date,
                                      "status": {"$in": ["submitted", "validated"]}, "deleted_at": None}):
        raise ValidationError(f"Daily sales {sales_date} untuk outlet ini sudah disubmit/divalidasi")
    existing = await db.daily_sales.find_one({
        "outlet_id": outlet_id, "sales_date": sales_date,
        "status": {"$in": ["draft", "rejected"]},
        "deleted_at": None,
    })

    # FIN-03: voucher discount is computed server-side (never trusted from client)
    payload["voucher_discount_amount"] = await _server_voucher_discount(payload, outlet_id, sales_date,
                                                                        exclude_id=(existing or {}).get("id"))
    grand_total = _calc_grand_total(payload)
    common = {
        "outlet_id": outlet_id, "brand_id": payload.get("brand_id"),
        "sales_date": sales_date,
        "channels": payload.get("channels", []),
        "payment_breakdown": payload.get("payment_breakdown", []),
        "revenue_buckets": payload.get("revenue_buckets", []),
        "service_charge": float(payload.get("service_charge", 0) or 0),
        "tax_amount": float(payload.get("tax_amount", 0) or 0),
        "grand_total": grand_total,
        "transaction_count": int(payload.get("transaction_count", 0) or 0),
        "notes": payload.get("notes"),
        # Loyalty customer phone (optional — used for auto-award on validation)
        "customer_phone": (payload.get("customer_phone") or "").strip() or None,
        # Sprint C — Voucher fields
        "voucher_code": (payload.get("voucher_code") or "").strip().upper() or None,
        "voucher_discount_amount": float(payload.get("voucher_discount_amount", 0) or 0),
        "voucher_meta": payload.get("voucher_meta") or None,
        "updated_at": _now(), "updated_by": user["id"],
    }
    if existing:
        common["status"] = "draft"  # back to draft on edit
        common["rejected_reason"] = None
        await db.daily_sales.update_one({"id": existing["id"]}, {"$set": common})
        result = await db.daily_sales.find_one({"id": existing["id"]})
        await audit_log(user_id=user["id"], entity_type="daily_sales",
                        entity_id=existing["id"], action="update")
        return serialize(result)
    # Create new
    doc = {
        "id": str(uuid.uuid4()), "status": "draft", "schema_version": 1,
        "created_at": _now(), "deleted_at": None,
        "created_by": user["id"],
        "submitted_at": None, "submitted_by": None,
        "validated_at": None, "validated_by": None,
        "journal_entry_id": None, "rejected_reason": None,
        # Sprint C — Voucher fields initialization
        "voucher_code": None,
        "voucher_discount_amount": 0,
        "voucher_meta": None,
        **common,
    }
    await db.daily_sales.insert_one(doc)
    await audit_log(user_id=user["id"], entity_type="daily_sales", entity_id=doc["id"],
                    action="create")
    return serialize(doc)


async def submit_daily_sales(id_: str, *, user: dict) -> dict:
    db = get_db()
    s = await db.daily_sales.find_one({"id": id_, "deleted_at": None})
    if not s:
        raise NotFoundError("Daily sales")
    if s["status"] not in ("draft", "rejected"):
        raise ValidationError(f"Status saat ini: {s['status']}, tidak bisa submit")
    # Validate payment vs grand total balance
    pay_total = sum(float(p.get("amount", 0) or 0) for p in s.get("payment_breakdown", []))
    if abs(pay_total - s["grand_total"]) > 1:
        raise ValidationError(
            f"Total pembayaran ({pay_total}) tidak cocok dengan grand total ({s['grand_total']})"
        )
    await db.daily_sales.update_one(
        {"id": id_},
        {"$set": {"status": "submitted", "submitted_at": _now(),
                 "submitted_by": user["id"], "updated_at": _now()}},
    )
    await audit_log(user_id=user["id"], entity_type="daily_sales", entity_id=id_, action="submit")
    return await get_daily_sales(id_)


async def validate_daily_sales(id_: str, *, user: dict) -> dict:
    db = get_db()
    s = await db.daily_sales.find_one({"id": id_, "deleted_at": None})
    if not s:
        raise NotFoundError("Daily sales")
    if s["status"] != "submitted":
        raise ValidationError(f"Status saat ini: {s['status']}, tidak bisa validate")
    # Phase 3 hardening — block if target period locked
    from services._period import derive_period_from_date, assert_period_unlocked
    target_period = derive_period_from_date(s.get("sales_date"))
    if target_period:
        await assert_period_unlocked(target_period, action="validate Daily Sales")
    # FIN-03: claim the voucher atomically BEFORE posting (one voucher = one daily sales)
    claimed = False
    if s.get("voucher_code"):
        claimed = await _claim_voucher(db, s["voucher_code"], id_)
    try:
        je = await journal_service.post_for_daily_sales(s, user_id=user["id"])
    except Exception:
        if claimed:
            await db.redemptions.update_one(
                {"voucher_code": s["voucher_code"], "claimed_reference_id": id_},
                {"$set": {"status": "pending", "claimed_reference_id": None, "claimed_at": None}})
        raise
    await db.daily_sales.update_one(
        {"id": id_},
        {"$set": {"status": "validated", "validated_at": _now(),
                 "validated_by": user["id"],
                 "journal_entry_id": je["id"], "updated_at": _now()}},
    )
    await audit_log(user_id=user["id"], entity_type="daily_sales", entity_id=id_, action="validate")
    # Phase 7D — Real-time sales anomaly check (best-effort, non-blocking)
    try:
        from services import anomaly_service
        fresh = await db.daily_sales.find_one({"id": id_, "deleted_at": None})
        if fresh:
            await anomaly_service.check_sales_live(fresh, user_id=user["id"])
    except Exception as e:  # noqa: BLE001
        import logging as _logging
        _logging.getLogger("aurora.outlet").warning("sales anomaly check failed: %s", e)
    # Loyalty points are now handled by the Cashier Points Entry screen.
    # Daily Sales no longer auto-awards loyalty points.
    # (Disconnected in Sprint Loyalty-Cashier, May 2026)

    return await get_daily_sales(id_)


async def _server_voucher_discount(payload: dict, outlet_id: str, sales_date: str, *, exclude_id: Optional[str]) -> float:
    code = (payload.get("voucher_code") or "").strip().upper()
    if not code:
        return 0.0
    from services.voucher_service import validate_voucher, get_voucher_rules
    v = await validate_voucher(code, outlet_id=outlet_id, sales_date=sales_date,
                               customer_phone=payload.get("customer_phone"))
    if not v.get("valid"):
        raise ValidationError(f"Voucher tidak valid: {v.get('message')}", field="voucher_code")
    db = get_db()
    other = await db.daily_sales.find_one({"voucher_code": code, "deleted_at": None,
                                           "status": {"$in": ["draft", "submitted", "validated"]},
                                           "id": {"$ne": exclude_id}})
    if other:
        raise ValidationError(f"Voucher {code} sudah dipakai di daily sales lain ({other.get('sales_date')})",
                              field="voucher_code")
    revenue = sum(float(b.get("amount", 0) or 0) for b in payload.get("revenue_buckets", []))
    value = float(v.get("discount_value") or 0)
    amount = revenue * value / 100 if v.get("discount_type") == "percentage" else value
    cap = (await get_voucher_rules()).get("max_discount_amount")
    if cap:
        amount = min(amount, float(cap))
    return round(min(amount, revenue), 2)


async def _claim_voucher(db, code: str, daily_sales_id: str) -> bool:
    res = await db.redemptions.update_one(
        {"voucher_code": code, "status": "pending"},
        {"$set": {"status": "claimed", "claimed_at": _now(), "claimed_reference_type": "daily_sales",
                  "claimed_reference_id": daily_sales_id, "updated_at": _now()}})
    if res.modified_count:
        return True
    if await db.redemptions.find_one({"voucher_code": code, "claimed_reference_id": daily_sales_id}):
        return False  # already claimed by this same daily sales (retry)
    raise ValidationError(f"Voucher {code} sudah dipakai/kadaluarsa — hapus voucher lalu submit ulang")


async def reject_daily_sales(id_: str, *, user: dict, reason: str) -> dict:
    db = get_db()
    s = await db.daily_sales.find_one({"id": id_, "deleted_at": None})
    if not s:
        raise NotFoundError("Daily sales")
    if s["status"] != "submitted":
        raise ValidationError(f"Status saat ini: {s['status']}, tidak bisa reject")
    await db.daily_sales.update_one(
        {"id": id_},
        {"$set": {"status": "rejected", "rejected_reason": reason, "updated_at": _now()}},
    )
    await audit_log(user_id=user["id"], entity_type="daily_sales", entity_id=id_,
                    action="reject", reason=reason)
    return await get_daily_sales(id_)


async def get_daily_sales(id_: str) -> dict:
    db = get_db()
    s = await db.daily_sales.find_one({"id": id_, "deleted_at": None})
    if not s:
        raise NotFoundError("Daily sales")
    return serialize(s)


def _calc_grand_total(payload: dict) -> float:
    revenue = sum(float(b.get("amount", 0) or 0) for b in payload.get("revenue_buckets", []))
    return round(revenue + float(payload.get("service_charge", 0) or 0)
                 + float(payload.get("tax_amount", 0) or 0)
                 - float(payload.get("voucher_discount_amount", 0) or 0), 2)


# =================== PETTY CASH ===================

async def list_petty_cash(
    *, outlet_ids: Optional[list[str]], date_from: Optional[str] = None, date_to: Optional[str] = None,
    page: int = 1, per_page: int = 20,
):
    db = get_db()
    q: dict = {"deleted_at": None}
    if outlet_ids is not None and len(outlet_ids) > 0:
        q["outlet_id"] = {"$in": outlet_ids}
    elif outlet_ids is not None and len(outlet_ids) == 0:
        return [], {"page": page, "per_page": per_page, "total": 0}
    if date_from:
        q.setdefault("txn_date", {})["$gte"] = date_from
    if date_to:
        q.setdefault("txn_date", {})["$lte"] = date_to
    skip = (page - 1) * per_page
    items = await db.petty_cash_transactions.find(q).sort([("txn_date", -1), ("created_at", -1)]).skip(skip).limit(per_page).to_list(per_page)
    total = await db.petty_cash_transactions.count_documents(q)
    # Compute current balance per outlet (simple sum of all postings)
    return [serialize(d) for d in items], {"page": page, "per_page": per_page, "total": total}


async def petty_cash_balance(outlet_id: str) -> float:
    db = get_db()
    cursor = db.petty_cash_transactions.aggregate([
        {"$match": {"outlet_id": outlet_id, "deleted_at": None, "status": "posted"}},
        {"$group": {
            "_id": None,
            "total": {"$sum": {
                "$cond": [
                    {"$or": [{"$eq": ["$type", "replenish"]},
                             {"$and": [{"$eq": ["$type", "adjustment"]}, {"$ne": ["$direction", "out"]}]}]},
                    "$amount",
                    {"$multiply": ["$amount", -1]},
                ]
            }},
        }}
    ])
    res = await cursor.to_list(1)
    return float(res[0]["total"]) if res else 0.0


async def add_petty_cash(payload: dict, *, user: dict) -> dict:
    db = get_db()
    outlet_id = payload["outlet_id"]
    if outlet_id not in user.get("outlet_ids", []) and "*" not in await _user_perms(user):
        raise ForbiddenError("Outlet bukan dalam scope Anda")
    if payload.get("type") not in ("purchase", "replenish", "adjustment"):
        raise ValidationError("type harus purchase / replenish / adjustment")
    if float(payload.get("amount", 0) or 0) <= 0:
        raise ValidationError("Amount harus > 0")
    # FIN-05: purchase needs a GL account (always journaled); replenish/adjustment need approval + JE
    direction = "out" if payload.get("direction") == "out" else "in"
    if payload["type"] == "purchase" and not payload.get("gl_account_id"):
        raise ValidationError("Akun GL wajib diisi untuk pembelian petty cash", field="gl_account_id")
    cur_bal = await petty_cash_balance(outlet_id)
    delta = float(payload["amount"])
    if payload["type"] == "purchase" or (payload["type"] == "adjustment" and direction == "out"):
        delta = -delta
    new_bal = cur_bal + delta
    if delta < 0 and new_bal < 0:
        raise ValidationError(
            f"Saldo PC tidak cukup. Saldo sekarang Rp {cur_bal:,.0f}, butuh Rp {-delta:,.0f}".replace(",","."),
        )
    doc = {
        "id": str(uuid.uuid4()),
        "outlet_id": outlet_id,
        "txn_date": payload["txn_date"],
        "type": payload["type"],
        "direction": direction if payload["type"] == "adjustment" else None,
        "amount": float(payload["amount"]),
        "description": payload.get("description", ""),
        "item_text": payload.get("item_text"),
        "item_id": payload.get("item_id"),
        "vendor_text": payload.get("vendor_text"),
        "vendor_id": payload.get("vendor_id"),
        "category_id": payload.get("category_id"),
        "gl_account_id": payload.get("gl_account_id"),
        "receipt_url": payload.get("receipt_url"),
        "notes": payload.get("notes"),
        "status": "posted" if payload["type"] == "purchase" else "pending_approval",
        "balance_after": new_bal if payload["type"] == "purchase" else None,
        "journal_entry_id": None,
        "created_at": _now(), "updated_at": _now(), "deleted_at": None,
        "created_by": user["id"],
    }
    await db.petty_cash_transactions.insert_one(doc)
    # Auto-journal for purchase with GL
    je = await journal_service.post_for_petty_cash(doc, user_id=user["id"])
    if je:
        await db.petty_cash_transactions.update_one({"id": doc["id"]},
            {"$set": {"journal_entry_id": je["id"]}})
        doc["journal_entry_id"] = je["id"]
    await audit_log(user_id=user["id"], entity_type="petty_cash", entity_id=doc["id"], action="create")
    return serialize(doc)


async def approve_petty_cash(id_: str, *, user: dict) -> dict:
    """FIN-05: approve replenish/adjustment → post JE, then it counts toward the balance."""
    db = get_db()
    doc = await db.petty_cash_transactions.find_one({"id": id_, "deleted_at": None})
    if not doc:
        raise NotFoundError("Petty cash")
    if doc.get("status") != "pending_approval":
        raise ValidationError(f"Status saat ini: {doc.get('status')}")
    if doc.get("created_by") == user["id"]:
        raise ValidationError("Pembuat transaksi tidak boleh meng-approve sendiri (SoD)")
    if doc["type"] == "adjustment" and doc.get("direction") == "out":
        if await petty_cash_balance(doc["outlet_id"]) < float(doc["amount"]):
            raise ValidationError("Saldo petty cash tidak cukup untuk penyesuaian keluar")
    res = await db.petty_cash_transactions.update_one(
        {"id": id_, "status": "pending_approval"}, {"$set": {"status": "approving"}})
    if not res.modified_count:
        raise ValidationError("Transaksi sedang diproses")
    try:
        je = await journal_service.post_for_petty_cash(doc, user_id=user["id"])
    except Exception:
        await db.petty_cash_transactions.update_one({"id": id_}, {"$set": {"status": "pending_approval"}})
        raise
    await db.petty_cash_transactions.update_one({"id": id_}, {"$set": {
        "status": "posted", "approved_by": user["id"], "approved_at": _now(),
        "journal_entry_id": je["id"] if je else None, "updated_at": _now()}})
    new_bal = await petty_cash_balance(doc["outlet_id"])
    await db.petty_cash_transactions.update_one({"id": id_}, {"$set": {"balance_after": new_bal}})
    await audit_log(user_id=user["id"], entity_type="petty_cash", entity_id=id_, action="approve")
    return serialize(await db.petty_cash_transactions.find_one({"id": id_}))


# =================== URGENT PURCHASE ===================

async def list_urgent_purchases(
    *, outlet_ids: Optional[list[str]], status: Optional[str] = None,
    page: int = 1, per_page: int = 20,
):
    db = get_db()
    q: dict = {"deleted_at": None}
    if outlet_ids is not None and len(outlet_ids) > 0:
        q["outlet_id"] = {"$in": outlet_ids}
    elif outlet_ids is not None and len(outlet_ids) == 0:
        return [], {"page": page, "per_page": per_page, "total": 0}
    if status:
        q["status"] = status
    skip = (page - 1) * per_page
    items = await db.urgent_purchases.find(q).sort([("purchase_date", -1)]).skip(skip).limit(per_page).to_list(per_page)
    total = await db.urgent_purchases.count_documents(q)
    return [serialize(d) for d in items], {"page": page, "per_page": per_page, "total": total}


async def create_urgent_purchase(payload: dict, *, user: dict) -> dict:
    db = get_db()
    outlet_id = payload["outlet_id"]
    if outlet_id not in user.get("outlet_ids", []) and "*" not in await _user_perms(user):
        raise ForbiddenError("Outlet bukan dalam scope Anda")
    items = payload.get("items", [])
    if not items:
        raise ValidationError("Minimal 1 item")
    total = sum(float(it.get("total", 0) or 0) for it in items)
    forecast_guard_reason = (payload.get("forecast_guard_reason") or "").strip() or None

    # Pre-check forecast guard (urgent purchase doesn't post a JE on creation, but still
    # captures intent and prevents MTD self-counting later when admin approves)
    pre_check_verdict = None
    try:
        from services import forecast_guard_service
        pre_check_verdict = await forecast_guard_service.check_expense(
            amount=total, outlet_id=outlet_id, kind="expense",
            period=(payload["purchase_date"] or "")[:7] or None,
        )
    except Exception:  # noqa: BLE001
        import logging as _logging
        _logging.getLogger("aurora.forecast_guard").exception("guard pre-check failed for UP")

    from utils.number_series import next_doc_no
    doc_no = await next_doc_no("PR")  # sharing PR series for now
    doc = {
        "id": str(uuid.uuid4()),
        "doc_no": doc_no,
        "outlet_id": outlet_id,
        "purchase_date": payload["purchase_date"],
        "vendor_id": payload.get("vendor_id"),
        "vendor_text": payload.get("vendor_text"),
        "items": items,
        "total": total,
        "payment_method_id": payload.get("payment_method_id"),
        "paid_by": payload.get("paid_by"),
        "receipt_url": payload.get("receipt_url"),
        "notes": payload.get("notes"),
        "forecast_guard_reason": forecast_guard_reason,
        "status": "submitted",
        "approved_by": None, "approved_at": None,
        "journal_entry_id": None,
        "created_at": _now(), "updated_at": _now(), "deleted_at": None,
        "created_by": user["id"],
    }
    await db.urgent_purchases.insert_one(doc)
    await audit_log(user_id=user["id"], entity_type="urgent_purchase",
                    entity_id=doc["id"], action="create")

    # Persist guard log if pre-check produced a verdict
    if pre_check_verdict is not None:
        try:
            from services import forecast_guard_service
            await forecast_guard_service.log_verdict(
                verdict=pre_check_verdict,
                source_type="urgent_purchase",
                source_id=doc["id"],
                source_doc_no=doc_no,
                reason=forecast_guard_reason,
                user_id=user["id"],
            )
        except Exception:  # noqa: BLE001
            import logging as _logging
            _logging.getLogger("aurora.forecast_guard").exception("guard log failed for UP")

    return serialize(doc)


async def approve_urgent_purchase(id_: str, *, user: dict) -> dict:
    db = get_db()
    up = await db.urgent_purchases.find_one({"id": id_, "deleted_at": None})
    if not up:
        raise NotFoundError("Urgent purchase")
    if up["status"] != "submitted":
        raise ValidationError(f"Status saat ini: {up['status']}")
    # FIN-06: SoD, full GL coverage, and petty-cash subledger kept in sync
    if up.get("created_by") == user["id"]:
        raise ValidationError("Pembuat urgent purchase tidak boleh meng-approve sendiri (SoD)")
    missing = [it.get("name", "?") for it in up.get("items", [])
               if float(it.get("total", 0) or 0) and not it.get("gl_account_id")]
    if missing:
        raise ValidationError(f"Item tanpa akun GL: {', '.join(missing[:5])}")
    pm = await db.payment_methods.find_one({"id": up.get("payment_method_id")}) if up.get("payment_method_id") else None
    is_petty = bool(pm and pm.get("code") == "PETTY")
    if is_petty and await petty_cash_balance(up["outlet_id"]) < float(up.get("total", 0) or 0):
        raise ValidationError("Saldo petty cash tidak cukup untuk urgent purchase ini")
    je = await journal_service.post_for_urgent_purchase(up, user_id=user["id"])
    if is_petty:
        await db.petty_cash_transactions.insert_one({
            "id": str(uuid.uuid4()), "outlet_id": up["outlet_id"], "txn_date": up["purchase_date"],
            "type": "purchase", "direction": None, "amount": float(up.get("total", 0) or 0),
            "description": f"Urgent purchase {up.get('doc_no', '')}", "vendor_id": up.get("vendor_id"),
            "vendor_text": up.get("vendor_text"), "gl_account_id": None, "status": "posted",
            "ref_type": "urgent_purchase", "ref_id": id_,
            "balance_after": await petty_cash_balance(up["outlet_id"]) - float(up.get("total", 0) or 0),
            "journal_entry_id": je["id"] if je else None,
            "created_at": _now(), "updated_at": _now(), "deleted_at": None, "created_by": user["id"],
        })
    await db.urgent_purchases.update_one(
        {"id": id_},
        {"$set": {"status": "approved", "approved_by": user["id"], "approved_at": _now(),
                 "journal_entry_id": je["id"] if je else None,
                 "updated_at": _now()}},
    )
    await audit_log(user_id=user["id"], entity_type="urgent_purchase", entity_id=id_, action="approve")
    fresh = await db.urgent_purchases.find_one({"id": id_})
    return serialize(fresh)


# =================== HOME / TASKS ===================

async def home_tasks(*, user: dict) -> dict:
    """Return today's tasks for outlet user."""
    db = get_db()
    outlet_ids = user.get("outlet_ids", [])
    today = _biz_today()
    yesterday = (datetime.now(timezone.utc).date() - __import__("datetime").timedelta(days=1)).isoformat()

    # Daily sales status today + yesterday
    sales_today = await db.daily_sales.find_one({
        "outlet_id": {"$in": outlet_ids}, "sales_date": today, "deleted_at": None,
    })
    sales_yesterday = await db.daily_sales.find_one({
        "outlet_id": {"$in": outlet_ids}, "sales_date": yesterday, "deleted_at": None,
    })

    pending_pr = await db.purchase_requests.count_documents({
        "outlet_id": {"$in": outlet_ids}, "status": "submitted", "deleted_at": None,
    })

    pc_balance_per_outlet = {}
    for oid in outlet_ids:
        pc_balance_per_outlet[oid] = await petty_cash_balance(oid)

    open_up = await db.urgent_purchases.count_documents({
        "outlet_id": {"$in": outlet_ids}, "status": "submitted", "deleted_at": None,
    })

    return {
        "today": today,
        "sales_today": serialize(sales_today),
        "sales_yesterday": serialize(sales_yesterday),
        "pending_pr_count": pending_pr,
        "open_urgent_purchase_count": open_up,
        "petty_cash_balance": pc_balance_per_outlet,
        "outlet_ids": outlet_ids,
    }


async def _user_perms(user: dict) -> set:
    from core.security import get_user_permissions
    return await get_user_permissions(user)

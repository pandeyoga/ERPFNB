"""Outlet router — Sprint A: loyalty lookup.
Sprint B: Voucher Redemption Station (verify + claim + customer vouchers + today log).
Sprint C: Voucher validation for Daily Sales.
Sprint D fix: /outlet/home dashboard.
"""
from datetime import datetime, date, timezone, timedelta
from typing import Optional
import uuid

from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel

from core.db import get_db
from core.exceptions import ok_envelope
from core.security import current_user, get_user_permissions
from services.voucher_service import validate_voucher, get_voucher_rules

router = APIRouter(prefix="/api/outlet", tags=["outlet"])


# ── Helpers ─────────────────────────────────────────────────
def _fmt_dt(val) -> Optional[str]:
    """Safely convert datetime / str to ISO string."""
    if val is None:
        return None
    if hasattr(val, "isoformat"):
        return val.isoformat()
    try:
        return str(val)
    except Exception:
        return None


def _parse_dt(val) -> Optional[datetime]:
    """Safely parse datetime from stored MongoDB value (datetime obj or ISO str)."""
    if val is None:
        return None
    if isinstance(val, datetime):
        return val if val.tzinfo else val.replace(tzinfo=timezone.utc)
    try:
        s = str(val).replace("Z", "+00:00")
        return datetime.fromisoformat(s)
    except Exception:
        return None


# ── Schemas ─────────────────────────────────────────────────
class ClaimVoucherRequest(BaseModel):
    code: str
    customer_phone: Optional[str] = None
    outlet_id: Optional[str] = None  # override (manager use-case)
    staff_note: Optional[str] = None


# ── Outlet Home ─────────────────────────────────────────────────
@router.get("/home")
async def outlet_home_summary(
    outlet_id: Optional[str] = Query(None, description="Filter to single outlet; empty=aggregate over user's scope"),
    user: dict = Depends(current_user),
    db=Depends(get_db),
):
    """Dashboard summary for Outlet Portal home screen.

    Scope rules:
    - If query param `outlet_id` provided AND user has access → filter to that outlet
    - If no `outlet_id` provided:
        - Full-access users (`*` perm or empty outlet_ids) → aggregate over ALL outlets
        - Restricted users → aggregate over their `outlet_ids` scope
    - If `outlet_id` provided but user has no access → 403
    """
    today_str = date.today().isoformat()
    yesterday_str = (date.today() - timedelta(days=1)).isoformat()

    user_outlet_ids = list(user.get("outlet_ids", []) or [])
    user_perms = await get_user_permissions(user)
    is_full_access = "*" in user_perms

    # Resolve effective scope filter
    requested = (outlet_id or "").strip() or None
    if requested:
        # Single-outlet filter — validate access
        if not is_full_access and user_outlet_ids and requested not in user_outlet_ids:
            raise HTTPException(status_code=403, detail="outlet_not_in_scope")
        scope_filter = {"outlet_id": requested}
        scope_outlet_ids = [requested]
    else:
        # Aggregate mode
        if is_full_access or not user_outlet_ids:
            scope_filter = {}  # all outlets
            scope_outlet_ids = []  # signals "all"
        else:
            scope_filter = {"outlet_id": {"$in": user_outlet_ids}}
            scope_outlet_ids = user_outlet_ids

    # ── Sales today ─────────────────────────────────────────
    # Fetch the most-recent daily_sales doc for today within scope (one per outlet
    # in restricted case; for single-outlet scope we get the unique doc).
    ds_today_filter = {"date": today_str, "deleted_at": None, **scope_filter}
    ds_today_docs = await db["daily_sales"].find(ds_today_filter).to_list(50)
    if requested and ds_today_docs:
        ds = ds_today_docs[0]
        sales_today = {
            "id": ds.get("id"),
            "outlet_id": ds.get("outlet_id"),
            "grand_total": float(ds.get("grand_total") or 0),
            "status": ds.get("status") or "draft",
            "transaction_count": int(ds.get("transaction_count") or ds.get("covers") or 0),
        }
    elif ds_today_docs:
        # Aggregate view: sum across docs and pick worst status
        grand_total = sum(float(d.get("grand_total") or 0) for d in ds_today_docs)
        statuses = [d.get("status") for d in ds_today_docs if d.get("status")]
        # Worst-status precedence (draft > pending_validation > validated)
        status_rank = {"draft": 0, "pending_validation": 1, "validated": 2}
        agg_status = min(statuses, key=lambda s: status_rank.get(s, 99)) if statuses else "draft"
        trx_count = sum(int(d.get("transaction_count") or d.get("covers") or 0) for d in ds_today_docs)
        sales_today = {
            "id": None,  # aggregate has no single id
            "outlet_id": None,
            "grand_total": grand_total,
            "status": agg_status,
            "transaction_count": trx_count,
            "is_aggregate": True,
            "outlet_count": len(ds_today_docs),
        }
    else:
        sales_today = None

    # ── Sales yesterday ─────────────────────────────────────
    ds_yest_filter = {"date": yesterday_str, "deleted_at": None, **scope_filter}
    ds_yest_docs = await db["daily_sales"].find(ds_yest_filter).to_list(50)
    if requested and ds_yest_docs:
        ds = ds_yest_docs[0]
        sales_yesterday = {
            "id": ds.get("id"),
            "outlet_id": ds.get("outlet_id"),
            "grand_total": float(ds.get("grand_total") or 0),
            "status": ds.get("status") or "draft",
        }
    elif ds_yest_docs:
        grand_total = sum(float(d.get("grand_total") or 0) for d in ds_yest_docs)
        statuses = [d.get("status") for d in ds_yest_docs if d.get("status")]
        status_rank = {"draft": 0, "pending_validation": 1, "validated": 2}
        agg_status = min(statuses, key=lambda s: status_rank.get(s, 99)) if statuses else "draft"
        sales_yesterday = {
            "id": None,
            "outlet_id": None,
            "grand_total": grand_total,
            "status": agg_status,
            "is_aggregate": True,
            "outlet_count": len(ds_yest_docs),
        }
    else:
        sales_yesterday = None

    # ── Petty cash balance per outlet (always grouped) ──────
    # Use the SAME collection + signed logic as services.outlet_service.petty_cash_balance
    pc_match = {**scope_filter, "deleted_at": None, "status": "posted"} if scope_filter else {"deleted_at": None, "status": "posted"}
    pc_docs = await db["petty_cash_transactions"].aggregate([
        {"$match": pc_match},
        {"$group": {
            "_id": "$outlet_id",
            "balance": {"$sum": {
                "$cond": [
                    {"$in": ["$type", ["replenish", "adjustment"]]},
                    "$amount",
                    {"$multiply": ["$amount", -1]},
                ]
            }},
        }},
    ]).to_list(50)
    pc_balances = {doc["_id"]: float(doc["balance"] or 0) for doc in pc_docs if doc.get("_id")}

    # ── Pending PR count ────────────────────────────────────
    pr_match = {"status": {"$in": ["draft", "submitted", "pending_approval"]}, "deleted_at": None}
    pr_match.update(scope_filter)
    pending_pr = await db["purchase_requests"].count_documents(pr_match)

    # ── Urgent purchase open count ──────────────────────────
    up_match = {"status": {"$in": ["open", "submitted", "draft", "pending_approval"]}, "deleted_at": None}
    up_match.update(scope_filter)
    urgent_count = await db["urgent_purchases"].count_documents(up_match)

    return ok_envelope({
        "today": today_str,
        "scope": {
            "outlet_id": requested,                # single outlet currently in view, or None
            "outlet_ids": scope_outlet_ids,        # full effective scope list (empty=all)
            "is_full_access": is_full_access,
            "user_outlet_ids": user_outlet_ids,    # raw user assignment
            "is_aggregate": not requested,
        },
        "sales_today": sales_today,
        "sales_yesterday": sales_yesterday,
        "petty_cash_balance": pc_balances,
        "pending_pr_count": pending_pr,
        "open_urgent_purchase_count": urgent_count,
        # Backward-compat keys (older clients)
        "outlet_ids": user_outlet_ids,
        "pending_approvals": pending_pr,
        "urgent_purchases": urgent_count,
    })


# ── Loyalty Lookup ───────────────────────────────────────────────
@router.get("/loyalty/lookup")
async def loyalty_customer_lookup(
    phone: Optional[str] = Query(None),
    query: Optional[str] = Query(None),
    limit: int = Query(5, ge=1, le=20),
    user: dict = Depends(current_user),
    db=Depends(get_db),
):
    """Look up loyalty customers by phone or name."""
    import re
    from services.customer_service import _normalize_phone, _phone_variants

    results = []
    search_term = (phone or query or "").strip()
    if not search_term:
        return ok_envelope([])

    try:
        normalized = _normalize_phone(search_term)
        phone_vars = _phone_variants(normalized)
        name_regex = {"$regex": re.escape(search_term), "$options": "i"}

        cursor = db.customers.find(
            {
                "$or": [
                    {"phone": {"$in": phone_vars}},
                    {"phone": {"$regex": f"^{re.escape(normalized)}", "$options": "i"}},
                    {"full_name": name_regex},
                ]
            }
        ).limit(limit)

        docs = await cursor.to_list(limit)
        for d in docs:
            results.append({
                "id": d.get("id") or str(d.get("_id", "")),
                "full_name": d.get("full_name", ""),
                "phone": d.get("phone", ""),
                "email": d.get("email", ""),
                "loyalty_tier": d.get("loyalty_tier", "bronze"),
                "total_points": d.get("total_points", 0),
                "lifetime_points": d.get("lifetime_points", 0),
            })
    except Exception as e:
        import logging as _log
        _log.getLogger("aurora.outlet").warning("Loyalty lookup error: %s", e)
        return ok_envelope([])

    return ok_envelope(results)


# ── Voucher Validation (Daily Sales) ───────────────────────────────
@router.post("/vouchers/validate")
async def validate_voucher_endpoint(
    payload: dict,
    user: dict = Depends(current_user),
):
    """Validasi voucher untuk Daily Sales."""
    code = payload.get("code", "")
    outlet_id = payload.get("outlet_id")
    sales_date = payload.get("sales_date")
    customer_phone = payload.get("customer_phone")

    result = await validate_voucher(
        code,
        outlet_id=outlet_id,
        sales_date=sales_date,
        customer_phone=customer_phone,
    )
    return ok_envelope(result)


@router.get("/vouchers/rules")
async def get_voucher_rules_endpoint(
    user: dict = Depends(current_user),
):
    """Ambil konfigurasi rules voucher."""
    rules = await get_voucher_rules()
    return ok_envelope(rules)


# ── Sprint CRM-B: Voucher Redemption Station ─────────────────────────────
@router.get("/vouchers/customer/{customer_id}")
async def list_customer_vouchers(
    customer_id: str,
    user: dict = Depends(current_user),
    db=Depends(get_db),
):
    """List pending (active) voucher redemptions for a specific customer.

    Returns only vouchers that are pending + not yet expired.
    Used by Voucher Redemption Station to show a customer's available rewards.
    """
    now = datetime.now(timezone.utc)

    # Auto-expire overdue vouchers first
    await db.redemptions.update_many(
        {
            "customer_id": customer_id,
            "status": "pending",
            "expires_at": {"$lt": now},
        },
        {"$set": {"status": "expired", "updated_at": now}},
    )

    cursor = db.redemptions.find(
        {"customer_id": customer_id, "status": "pending"}
    ).sort("created_at", -1)
    docs = await cursor.to_list(50)

    results = []
    for d in docs:
        expires = _parse_dt(d.get("expires_at"))
        results.append({
            "id": d.get("id"),
            "reward_id": d.get("reward_id"),
            "reward_name": d.get("reward_name"),
            "points_used": d.get("points_used", 0),
            "voucher_code": d.get("voucher_code"),
            "status": d.get("status"),
            "created_at": _fmt_dt(d.get("created_at")),
            "expires_at": _fmt_dt(expires),
        })

    return ok_envelope(results)


@router.get("/vouchers/verify/{code}")
async def verify_voucher_endpoint(
    code: str,
    user: dict = Depends(current_user),
    db=Depends(get_db),
):
    """Verify a voucher code — enriched with customer info.

    Used by Voucher Redemption Station to show full details before claiming.
    Does NOT change any state.
    """
    code_clean = code.strip().upper()

    # Base validation
    result = await validate_voucher(code_clean)

    # Enrich with customer info if valid or found
    redemption = await db.redemptions.find_one({"voucher_code": code_clean})
    customer_info = None
    if redemption:
        cid = redemption.get("customer_id")
        if cid:
            c = await db.customers.find_one({"id": cid})
            if c:
                customer_info = {
                    "id": c.get("id"),
                    "full_name": c.get("full_name"),
                    "phone": c.get("phone"),
                    "email": c.get("email"),
                    "loyalty_tier": c.get("loyalty_tier"),
                    "total_points": c.get("total_points", 0),
                }
        result["redemption_id"] = redemption.get("id")
        result["points_used"] = redemption.get("points_used", 0)
        result["created_at"] = _fmt_dt(redemption.get("created_at"))

    result["customer"] = customer_info
    result["code"] = code_clean
    return ok_envelope(result)


@router.post("/vouchers/claim")
async def claim_voucher_at_outlet(
    payload: ClaimVoucherRequest,
    user: dict = Depends(current_user),
    db=Depends(get_db),
):
    """Claim a loyalty voucher at the outlet — Sprint CRM-B.

    Marks a pending redemption as 'claimed' without requiring a daily_sales_id.
    Audit fields: claimed_at, claimed_by_user_id, claimed_outlet_id, claimed_reference_type.
    Idempotent: if already claimed by same staff+code, returns success.
    """
    code_clean = (payload.code or "").strip().upper()
    if not code_clean:
        return ok_envelope({"success": False, "message": "Kode voucher wajib diisi"})

    outlet_id = payload.outlet_id or user.get("outlet_id")
    staff_id = user.get("id")
    now = datetime.now(timezone.utc)

    redemption = await db.redemptions.find_one({"voucher_code": code_clean})
    if not redemption:
        return ok_envelope({"success": False, "message": f"Voucher '{code_clean}' tidak ditemukan"})

    # Check expiry (auto-expire)
    expires = _parse_dt(redemption.get("expires_at"))
    if expires and now > expires:
        await db.redemptions.update_one(
            {"id": redemption["id"]},
            {"$set": {"status": "expired", "updated_at": now}},
        )
        return ok_envelope({"success": False, "message": "Voucher sudah kadaluarsa", "status": "expired"})

    current_status = redemption.get("status")

    # Idempotency: already claimed by same code
    if current_status == "claimed":
        ref = redemption.get("claimed_reference_id", "")
        return ok_envelope({
            "success": False,
            "message": "Voucher sudah diklaim sebelumnya",
            "status": "already_claimed",
            "reference_id": ref,
        })

    if current_status == "expired":
        return ok_envelope({"success": False, "message": "Voucher sudah kadaluarsa", "status": "expired"})

    if current_status != "pending":
        return ok_envelope({"success": False, "message": f"Status voucher tidak valid: {current_status}"})

    reference_id = str(uuid.uuid4())
    await db.redemptions.update_one(
        {"id": redemption["id"]},
        {
            "$set": {
                "status": "claimed",
                "claimed_at": now,
                "claimed_by_user_id": staff_id,
                "claimed_outlet_id": outlet_id,
                "claimed_reference_type": "outlet_redeem",
                "claimed_reference_id": reference_id,
                "staff_note": payload.staff_note or "",
                "updated_at": now,
            }
        },
    )

    return ok_envelope({
        "success": True,
        "message": "Voucher berhasil diklaim!",
        "reference_id": reference_id,
        "reward_name": redemption.get("reward_name"),
        "voucher_code": code_clean,
        "claimed_at": _fmt_dt(now),
    })


@router.get("/vouchers/today")
async def today_claimed_vouchers(
    limit: int = Query(20, ge=1, le=100),
    user: dict = Depends(current_user),
    db=Depends(get_db),
):
    """Today's claimed vouchers at this outlet (Redemption Log).

    Scoped to current user's outlet_id. Returns up to `limit` latest claims today.
    """
    outlet_id = user.get("outlet_id")
    today_start = datetime.combine(date.today(), datetime.min.time()).replace(tzinfo=timezone.utc)

    query = {
        "status": "claimed",
        "claimed_reference_type": "outlet_redeem",
        "claimed_at": {"$gte": today_start},
    }
    if outlet_id:
        query["claimed_outlet_id"] = outlet_id

    cursor = db.redemptions.find(query).sort("claimed_at", -1).limit(limit)
    docs = await cursor.to_list(limit)

    # Enrich with customer info
    cids = list({d.get("customer_id") for d in docs if d.get("customer_id")})
    customer_map = {}
    if cids:
        async for c in db.customers.find({"id": {"$in": cids}}, {"id": 1, "full_name": 1, "phone": 1, "loyalty_tier": 1}):
            customer_map[c["id"]] = {
                "full_name": c.get("full_name"),
                "phone": c.get("phone"),
                "loyalty_tier": c.get("loyalty_tier"),
            }

    results = []
    for d in docs:
        cid = d.get("customer_id")
        ci = customer_map.get(cid, {})
        results.append({
            "id": d.get("id"),
            "voucher_code": d.get("voucher_code"),
            "reward_name": d.get("reward_name"),
            "points_used": d.get("points_used", 0),
            "customer_name": ci.get("full_name"),
            "customer_phone": ci.get("phone"),
            "loyalty_tier": ci.get("loyalty_tier"),
            "claimed_at": _fmt_dt(d.get("claimed_at")),
            "reference_id": d.get("claimed_reference_id"),
        })

    return ok_envelope(results)


# ─────────────────────────────────────────────────────────────
# CASHIER LOYALTY POINTS ENTRY  (Sprint Loyalty-Cashier)
# ─────────────────────────────────────────────────────────────

class CashierAddPointsRequest(BaseModel):
    phone: str
    amount_idr: float
    note: Optional[str] = None
    order_ref: Optional[str] = None


@router.post("/loyalty/cashier/add-points")
async def cashier_add_loyalty_points(
    payload: CashierAddPointsRequest,
    user: dict = Depends(current_user),
    db=Depends(get_db),
):
    """Cashier input nominal transaksi → award poin ke customer.

    - Lookup customer by phone.
    - If not found → auto-create account (phone as username + password).
    - Calculate points: Rp 10,000 = 1 point × tier multiplier.
    - Award points + create transaction record.
    - Send WhatsApp notification (best-effort, skip if not configured).
    """
    from services.customer_service import (
        get_customer_by_phone,
        create_customer_from_phone,
    )
    from services.loyalty_service import (
        create_transaction,
        calculate_points_from_amount,
        TIER_MULTIPLIERS,
    )
    import logging as _log

    phone = payload.phone.strip()
    amount = float(payload.amount_idr or 0)

    if not phone:
        raise HTTPException(status_code=400, detail="Nomor HP wajib diisi")
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Nominal transaksi harus > 0")

    # 1. Lookup or auto-create customer
    customer = await get_customer_by_phone(db, phone)
    was_created = False
    if not customer:
        customer = await create_customer_from_phone(db, phone)
        was_created = True

    # 2. Calculate points
    multiplier = TIER_MULTIPLIERS.get(customer.loyalty_tier, 1.0)
    points_awarded = calculate_points_from_amount(amount, tier_multiplier=multiplier)
    if points_awarded < 1:
        points_awarded = 0

    # 3. Award points
    note = payload.note or f"Kasir – Rp {amount:,.0f}"
    if points_awarded > 0:
        await create_transaction(
            db=db,
            customer_id=customer.id,
            transaction_type="earn",
            points=points_awarded,
            description=note,
            reference_type="cashier_entry",
            reference_id=payload.order_ref,
            created_by=user["id"],
        )

    # Refresh customer after point update
    from services.customer_service import get_customer_by_id
    updated = await get_customer_by_id(db, customer.id)
    new_total = updated.total_points if updated else customer.total_points

    # 4. WhatsApp notification (best-effort)
    try:
        from services.whatsapp_service import send_message, is_configured
        if points_awarded > 0 and is_configured():
            tier_icons = {"bronze": "🥉", "silver": "🥈", "gold": "🥇", "platinum": "👑"}
            tier = updated.loyalty_tier if updated else customer.loyalty_tier
            icon = tier_icons.get(tier, "🏅")
            name = (updated.full_name if updated else customer.full_name) or "Member"
            if was_created:
                msg = (
                    f"*FnB Rewards* 🎉\n\n"
                    f"Halo! Akun loyalty Anda telah dibuat.\n\n"
                    f"✅ *+{points_awarded} poin* untuk transaksi Rp {amount:,.0f}\n"
                    f"{icon} Tier: *{tier.title()}*\n"
                    f"💰 Total poin: *{new_total:,} poin*\n\n"
                    f"🔑 Login dengan nomor HP Anda (password = nomor HP ini).\n"
                    f"Ubah password setelah login pertama."
                )
            else:
                msg = (
                    f"*FnB Rewards*\n\n"
                    f"Halo {name}! 👋\n\n"
                    f"✅ *+{points_awarded} poin* dari transaksi Rp {amount:,.0f}\n"
                    f"{icon} Tier: *{tier.title()}*\n"
                    f"💰 Total poin: *{new_total:,} poin*"
                )
            await send_message(to=phone, text=msg)
    except Exception as e:
        _log.getLogger("aurora.loyalty").warning("WA notification failed: %s", e)

    return ok_envelope({
        "customer": {
            "id": (updated or customer).id,
            "full_name": (updated or customer).full_name,
            "phone": (updated or customer).phone,
            "loyalty_tier": (updated or customer).loyalty_tier,
            "total_points": new_total,
        },
        "points_awarded": points_awarded,
        "amount_idr": amount,
        "multiplier": multiplier,
        "was_created": was_created,
        "notification_sent": False,  # will be True if WA configured
    })


@router.get("/loyalty/cashier/lookup")
async def cashier_lookup_customer(
    phone: str = Query(..., description="Customer phone number"),
    user: dict = Depends(current_user),
    db=Depends(get_db),
):
    """Quick lookup customer by phone for cashier UI.

    Returns customer info if found, or null (no 404) — cashier will auto-create.
    """
    from services.customer_service import get_customer_by_phone
    from services.loyalty_service import TIER_MULTIPLIERS

    customer = await get_customer_by_phone(db, phone)
    if not customer:
        return ok_envelope(None)

    multiplier = TIER_MULTIPLIERS.get(customer.loyalty_tier, 1.0)

    return ok_envelope({
        "id": customer.id,
        "full_name": customer.full_name,
        "phone": customer.phone,
        "loyalty_tier": customer.loyalty_tier,
        "total_points": customer.total_points,
        "lifetime_points": customer.lifetime_points,
        "multiplier": multiplier,
        "is_auto_created": getattr(customer, "is_auto_created", False),
    })

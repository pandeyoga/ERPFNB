"""Daily Close Service — Phase 8B.

Represents the end-of-day closing checklist for an outlet on a given date.
Checklist:
  1. Daily Sales validated (status=validated)
  2. Petty Cash transactions for the day are posted (no draft); balance not negative
  3. KDO and BDO PRs (if any) have been submitted (no drafts left for the day)
  4. Deposit slip attachment present

The service computes status idempotently from existing data + records the
close event in `daily_close_records` with notification to finance.
"""
import uuid
from datetime import datetime, timezone
from typing import Optional

from core.audit import log as audit_log
from core.db import get_db, serialize
from core.exceptions import ConflictError, ForbiddenError, NotFoundError, ValidationError
from services import notification_service, outlet_service, upload_service


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _sales_check(outlet_id: str, date_str: str) -> dict:
    db = get_db()
    s = await db.daily_sales.find_one({
        "outlet_id": outlet_id, "sales_date": date_str, "deleted_at": None,
    })
    if not s:
        return {"ok": False, "status": "missing", "label": "Daily sales belum dibuat",
                "sales_id": None, "sales_status": None}
    sub_status = s.get("status")
    ok = sub_status in ("validated",)
    return {
        "ok": ok,
        "status": sub_status,
        "label": (
            "Tervalidasi finance" if ok else
            f"Status: {sub_status} — minta finance validate"
        ),
        "sales_id": s.get("id"),
        "grand_total": s.get("grand_total", 0),
        "sales_status": sub_status,
    }


async def _petty_cash_check(outlet_id: str, date_str: str) -> dict:
    db = get_db()
    q = {
        "outlet_id": outlet_id, "txn_date": date_str, "deleted_at": None,
    }
    txns = await db.petty_cash_transactions.find(q).to_list(500)
    drafts = [t for t in txns if t.get("status") == "draft"]
    bal = await outlet_service.petty_cash_balance(outlet_id)
    ok = (len(drafts) == 0) and (bal >= 0)
    return {
        "ok": ok,
        "label": (
            f"{len(txns)} transaksi hari ini, saldo Rp {bal:,.0f}".replace(",", ".") +
            ("" if not drafts else f" — {len(drafts)} masih draft")
        ),
        "txn_count": len(txns),
        "balance": bal,
        "draft_count": len(drafts),
    }


async def _kdo_bdo_check(outlet_id: str, date_str: str) -> dict:
    db = get_db()
    pr_today = await db.purchase_requests.find({
        "outlet_id": outlet_id,
        "deleted_at": None,
        "request_date": date_str,
        "source": {"$in": ["kdo", "bdo"]},
    }).to_list(500)
    drafts = [p for p in pr_today if p.get("status") == "draft"]
    ok = len(drafts) == 0  # any non-draft (including "none") is OK
    return {
        "ok": ok,
        "label": (
            f"{len(pr_today)} request hari ini" +
            ("" if not drafts else f" — {len(drafts)} masih draft (submit dulu)") +
            (" (tidak ada request: OK)" if not pr_today else "")
        ),
        "pr_count": len(pr_today),
        "draft_count": len(drafts),
    }


async def _deposit_slip_check(outlet_id: str, date_str: str,
                              attachment_id: Optional[str] = None) -> dict:
    db = get_db()
    if attachment_id:
        att = await db.attachments.find_one({"id": attachment_id, "deleted_at": None})
        if att:
            return {"ok": True, "label": f"Slip terlampir: {att.get('filename')}",
                    "attachment_id": attachment_id}
    # Look up any existing record for this date (perhaps already closed)
    rec = await db.daily_close_records.find_one({
        "outlet_id": outlet_id, "close_date": date_str, "deleted_at": None,
    })
    if rec and rec.get("deposit_slip_attachment_id"):
        return {"ok": True, "label": "Slip sudah pernah diunggah",
                "attachment_id": rec["deposit_slip_attachment_id"]}
    return {"ok": False, "label": "Belum upload slip setoran bank",
            "attachment_id": None}


async def get_status(outlet_id: str, date_str: str, *, user: dict,
                    deposit_slip_attachment_id: Optional[str] = None) -> dict:
    """Compute the full daily-close checklist + summary for outlet+date."""
    db = get_db()
    if not outlet_id:
        raise ValidationError("outlet_id wajib", field="outlet_id")
    if not date_str:
        raise ValidationError("date wajib", field="date")
    # Scope guard
    perms = await _user_perms(user)
    if outlet_id not in (user.get("outlet_ids") or []) and "*" not in perms:
        raise ForbiddenError("Outlet bukan dalam scope Anda")

    sales = await _sales_check(outlet_id, date_str)
    pc = await _petty_cash_check(outlet_id, date_str)
    kdo_bdo = await _kdo_bdo_check(outlet_id, date_str)
    deposit = await _deposit_slip_check(outlet_id, date_str, deposit_slip_attachment_id)

    items = [
        {"key": "sales", "title": "Daily Sales tervalidasi", **sales},
        {"key": "petty_cash", "title": "Petty Cash beres", **pc},
        {"key": "kdo_bdo", "title": "KDO/BDO sudah disubmit", **kdo_bdo},
        {"key": "deposit_slip", "title": "Slip setoran bank terlampir", **deposit},
    ]
    overall_ok = all(it.get("ok") for it in items)
    rec = await db.daily_close_records.find_one({
        "outlet_id": outlet_id, "close_date": date_str, "deleted_at": None,
    })
    return {
        "outlet_id": outlet_id,
        "date": date_str,
        "items": items,
        "can_close": overall_ok,
        "closed": bool(rec),
        "record": serialize(rec) if rec else None,
    }


async def list_records(
    *, outlet_ids: list[str], date_from: Optional[str] = None,
    date_to: Optional[str] = None, page: int = 1, per_page: int = 30,
):
    db = get_db()
    q: dict = {"deleted_at": None}
    if outlet_ids:
        q["outlet_id"] = {"$in": outlet_ids}
    if date_from:
        q.setdefault("close_date", {})["$gte"] = date_from
    if date_to:
        q.setdefault("close_date", {})["$lte"] = date_to
    skip = max(0, (page - 1) * per_page)
    items = await db.daily_close_records.find(q).sort("close_date", -1).skip(skip).limit(per_page).to_list(per_page)
    total = await db.daily_close_records.count_documents(q)
    return [serialize(it) for it in items], {"page": page, "per_page": per_page, "total": total}


async def submit(
    *,
    outlet_id: str,
    date_str: str,
    deposit_slip_attachment_id: str,
    notes: Optional[str],
    user: dict,
) -> dict:
    """Submit daily close. Validates checklist + persists record."""
    db = get_db()
    perms = await _user_perms(user)
    if outlet_id not in (user.get("outlet_ids") or []) and "*" not in perms:
        raise ForbiddenError("Outlet bukan dalam scope Anda")

    # Validate attachment exists and is a deposit slip
    if not deposit_slip_attachment_id:
        raise ValidationError("Slip setoran wajib", field="deposit_slip_attachment_id")
    att = await db.attachments.find_one({"id": deposit_slip_attachment_id, "deleted_at": None})
    if not att:
        raise NotFoundError("Attachment slip setoran tidak ditemukan")

    # Check existing
    existing = await db.daily_close_records.find_one({
        "outlet_id": outlet_id, "close_date": date_str, "deleted_at": None,
    })
    if existing:
        raise ConflictError("Daily close sudah dilakukan untuk tanggal ini")

    # Run checklist with the slip provided
    status = await get_status(
        outlet_id, date_str, user=user,
        deposit_slip_attachment_id=deposit_slip_attachment_id,
    )
    if not status["can_close"]:
        bad = [it["title"] for it in status["items"] if not it.get("ok")]
        raise ValidationError(
            "Daily close tidak bisa dilakukan: " + "; ".join(bad),
        )

    rec_id = str(uuid.uuid4())
    doc = {
        "id": rec_id,
        "outlet_id": outlet_id,
        "close_date": date_str,
        "checklist": [
            {k: it.get(k) for k in ("key", "title", "ok", "label", "status",
                                     "sales_id", "grand_total", "txn_count",
                                     "balance", "pr_count", "draft_count",
                                     "attachment_id")
             if k in it}
            for it in status["items"]
        ],
        "sales_id": status["items"][0].get("sales_id"),
        "sales_total": status["items"][0].get("grand_total", 0),
        "petty_cash_balance": status["items"][1].get("balance", 0),
        "deposit_slip_attachment_id": deposit_slip_attachment_id,
        "deposit_slip_url": att.get("url"),
        "deposit_slip_filename": att.get("filename"),
        "notes": notes,
        "closed_at": _now_iso(),
        "closed_by": user.get("id"),
        "closed_by_name": user.get("full_name") or user.get("email"),
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
        "deleted_at": None,
    }
    await db.daily_close_records.insert_one(doc)

    # Link attachment to this close record
    try:
        await upload_service.link_attachment(
            deposit_slip_attachment_id,
            source_type="daily_close",
            source_id=rec_id,
            user=user,
        )
    except Exception:  # noqa: BLE001
        pass

    await audit_log(
        user_id=user.get("id"),
        entity_type="daily_close",
        entity_id=rec_id,
        action="close",
        after={"outlet_id": outlet_id, "close_date": date_str},
    )

    # Notify finance team (anyone with finance.sales.validate)
    try:
        finance_users = await _users_with_perm("finance.sales.validate")
        outlet_name = await _outlet_name(outlet_id)
        for fu in finance_users:
            await notification_service.push(
                user_id=fu["id"],
                type="daily_close",
                title=f"Daily Close: {outlet_name} ({date_str})",
                body=(
                    f"Sales Rp {doc['sales_total']:,.0f} — PC Rp {doc['petty_cash_balance']:,.0f}."
                    .replace(",", ".") +
                    " Slip setoran terlampir."
                ),
                link=f"/outlet/daily-close?outlet_id={outlet_id}&date={date_str}",
                source_type="daily_close",
                source_id=rec_id,
            )
    except Exception:  # noqa: BLE001
        import logging as _logging
        _logging.getLogger("aurora.daily_close").exception("notify finance failed")

    return serialize(doc)


async def get_record(record_id: str) -> dict:
    db = get_db()
    rec = await db.daily_close_records.find_one({"id": record_id, "deleted_at": None})
    if not rec:
        raise NotFoundError("Daily close record")
    return serialize(rec)


async def reopen(record_id: str, *, reason: str, user: dict) -> dict:
    """Reopen a closed daily close (super admin / manager only)."""
    db = get_db()
    rec = await db.daily_close_records.find_one({"id": record_id, "deleted_at": None})
    if not rec:
        raise NotFoundError("Daily close record")
    perms = await _user_perms(user)
    if "*" not in perms and "admin.system_settings.manage" not in perms:
        raise ForbiddenError("Hanya admin yang bisa reopen daily close")
    await db.daily_close_records.update_one(
        {"id": record_id},
        {"$set": {"deleted_at": _now_iso(), "reopened_reason": reason,
                  "reopened_by": user.get("id"), "reopened_at": _now_iso()}},
    )
    await audit_log(
        user_id=user.get("id"), entity_type="daily_close", entity_id=record_id,
        action="reopen", reason=reason,
    )
    return {"id": record_id, "reopened": True}


async def _user_perms(user: dict) -> set:
    from core.security import get_user_permissions
    return await get_user_permissions(user)


async def _users_with_perm(perm: str) -> list[dict]:
    db = get_db()
    role_ids = []
    cursor = db.roles.find({"permissions": {"$in": [perm, "*"]}})
    async for r in cursor:
        role_ids.append(r["id"])
    if not role_ids:
        return []
    users = await db.users.find({
        "role_ids": {"$in": role_ids}, "deleted_at": None, "status": "active",
    }).to_list(200)
    return [serialize(u) for u in users]


async def _outlet_name(outlet_id: str) -> str:
    db = get_db()
    o = await db.outlets.find_one({"id": outlet_id})
    return (o or {}).get("name") or outlet_id

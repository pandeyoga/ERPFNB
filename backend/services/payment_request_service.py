"""Payment Request Service — weekly payment approval workflow.

Workflow:
1. Finance create PR (draft) → pilih invoices dari AP Ledger
2. Submit PR → masuk approval chain
3. Manager/CFO approve → status jadi 'approved'
4. Finance eksekusi payment → mark as 'paid'
"""
import logging
from datetime import datetime, timezone
from typing import Optional

from core.db import get_db, serialize
from core.exceptions import NotFoundError, ValidationError
from models.payment_request import payment_request_doc, generate_pr_no

logger = logging.getLogger("aurora.payment_request")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def create_payment_request(payload: dict, *, user: dict) -> dict:
    """Create new Payment Request (draft status)."""
    db = get_db()
    
    # Validations
    request_date = payload.get("request_date")
    period_week = payload.get("period_week")  # YYYY-WW
    items = payload.get("items", [])
    
    if not request_date:
        raise ValidationError("request_date wajib diisi (YYYY-MM-DD)")
    if not period_week:
        raise ValidationError("period_week wajib diisi (YYYY-WW)")
    if not items or len(items) == 0:
        raise ValidationError("items tidak boleh kosong")
    
    # Validate items
    for idx, item in enumerate(items):
        if not item.get("vendor_id"):
            raise ValidationError(f"Item #{idx+1}: vendor_id wajib")
        if not item.get("amount") or float(item["amount"]) <= 0:
            raise ValidationError(f"Item #{idx+1}: amount harus > 0")
    
    # Enrich vendor names
    vendor_ids = [item["vendor_id"] for item in items if item.get("vendor_id")]
    vendors = {}
    if vendor_ids:
        async for v in db.vendors.find({"id": {"$in": vendor_ids}}):
            vendors[v["id"]] = v.get("name", "Unknown Vendor")
    
    enriched_items = []
    for item in items:
        enriched_items.append({
            **item,
            "vendor_name": vendors.get(item["vendor_id"], item.get("vendor_name")),
        })
    
    # Generate doc_no
    doc_no = generate_pr_no("PR")
    
    # Create document
    doc = payment_request_doc(
        doc_no=doc_no,
        request_date=request_date,
        period_week=period_week,
        brand_id=payload.get("brand_id"),
        outlet_id=payload.get("outlet_id"),
        items=enriched_items,
        requested_by=user["id"],
        requested_by_name=user.get("name", user.get("email")),
        status="draft",
        notes=payload.get("notes"),
        created_by=user["id"],
    )
    
    await db.payment_requests.insert_one(doc)
    logger.info(f"PR created: {doc_no} by {user['email']}")
    
    return serialize(doc)


async def get_payment_request(pr_id: str) -> dict:
    """Get PR detail by ID."""
    db = get_db()
    pr = await db.payment_requests.find_one({"id": pr_id, "deleted_at": None})
    if not pr:
        raise NotFoundError("Payment Request tidak ditemukan")
    return serialize(pr)


async def list_payment_requests(
    *,
    status: Optional[str] = None,
    period_week: Optional[str] = None,
    brand_id: Optional[str] = None,
    outlet_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    page: int = 1,
    per_page: int = 20,
):
    """List PRs with filters."""
    db = get_db()
    q = {"deleted_at": None}
    
    if status:
        q["status"] = status
    if period_week:
        q["period_week"] = period_week
    if brand_id:
        q["brand_id"] = brand_id
    if outlet_id:
        q["outlet_id"] = outlet_id
    if date_from:
        q.setdefault("request_date", {})["$gte"] = date_from
    if date_to:
        q.setdefault("request_date", {})["$lte"] = date_to
    
    skip = (page - 1) * per_page
    cursor = db.payment_requests.find(q).sort([("request_date", -1), ("created_at", -1)])
    items = await cursor.skip(skip).limit(per_page).to_list(per_page)
    total = await db.payment_requests.count_documents(q)
    
    return [serialize(d) for d in items], {"page": page, "per_page": per_page, "total": total}


async def submit_payment_request(pr_id: str, *, user: dict) -> dict:
    """Submit PR untuk approval."""
    db = get_db()
    pr = await db.payment_requests.find_one({"id": pr_id, "deleted_at": None})
    if not pr:
        raise NotFoundError("Payment Request tidak ditemukan")
    
    if pr["status"] != "draft":
        raise ValidationError(f"Hanya PR dengan status 'draft' yang bisa di-submit (current: {pr['status']})")
    
    # TODO: In production, define approval chain based on amount/brand/outlet
    # For MVP, simple 1-level approval (Finance Manager or CFO)
    approval_chain = [
        {
            "user_id": "_auto_approve_",  # Placeholder: in production, lookup approver
            "user_name": "Finance Manager",
            "role": "Finance Manager",
            "status": "pending",
            "action_at": None,
            "notes": None,
        }
    ]
    
    await db.payment_requests.update_one(
        {"id": pr_id},
        {
            "$set": {
                "status": "submitted",
                "approval_chain": approval_chain,
                "current_approver": "_auto_approve_",  # First in chain
                "updated_at": _now(),
            }
        }
    )
    
    logger.info(f"PR {pr['doc_no']} submitted by {user['email']}")
    return await get_payment_request(pr_id)


async def approve_payment_request(pr_id: str, *, user: dict, notes: Optional[str] = None) -> dict:
    """Approve PR."""
    db = get_db()
    pr = await db.payment_requests.find_one({"id": pr_id, "deleted_at": None})
    if not pr:
        raise NotFoundError("Payment Request tidak ditemukan")
    
    if pr["status"] != "submitted":
        raise ValidationError(f"Hanya PR dengan status 'submitted' yang bisa di-approve (current: {pr['status']})")
    
    # Update approval chain
    approval_chain = pr.get("approval_chain", [])
    for step in approval_chain:
        if step.get("status") == "pending":
            step["status"] = "approved"
            step["action_at"] = _now()
            step["notes"] = notes
            step["user_id"] = user["id"]
            step["user_name"] = user.get("name", user.get("email"))
            break
    
    await db.payment_requests.update_one(
        {"id": pr_id},
        {
            "$set": {
                "status": "approved",
                "approval_chain": approval_chain,
                "approved_by": user["id"],
                "approved_at": _now(),
                "current_approver": None,
                "updated_at": _now(),
            }
        }
    )
    
    logger.info(f"PR {pr['doc_no']} approved by {user['email']}")
    return await get_payment_request(pr_id)


async def reject_payment_request(pr_id: str, *, user: dict, reason: str) -> dict:
    """Reject PR."""
    db = get_db()
    pr = await db.payment_requests.find_one({"id": pr_id, "deleted_at": None})
    if not pr:
        raise NotFoundError("Payment Request tidak ditemukan")
    
    if pr["status"] != "submitted":
        raise ValidationError(f"Hanya PR dengan status 'submitted' yang bisa di-reject (current: {pr['status']})")
    
    if not reason or not reason.strip():
        raise ValidationError("Reason wajib diisi untuk rejection")
    
    # Update approval chain
    approval_chain = pr.get("approval_chain", [])
    for step in approval_chain:
        if step.get("status") == "pending":
            step["status"] = "rejected"
            step["action_at"] = _now()
            step["notes"] = reason
            step["user_id"] = user["id"]
            step["user_name"] = user.get("name", user.get("email"))
            break
    
    await db.payment_requests.update_one(
        {"id": pr_id},
        {
            "$set": {
                "status": "rejected",
                "approval_chain": approval_chain,
                "rejected_by": user["id"],
                "rejected_at": _now(),
                "rejection_reason": reason,
                "current_approver": None,
                "updated_at": _now(),
            }
        }
    )
    
    logger.info(f"PR {pr['doc_no']} rejected by {user['email']}: {reason}")
    return await get_payment_request(pr_id)


async def mark_payment_request_paid(pr_id: str, *, user: dict) -> dict:
    """Mark PR as paid after payment execution."""
    db = get_db()
    pr = await db.payment_requests.find_one({"id": pr_id, "deleted_at": None})
    if not pr:
        raise NotFoundError("Payment Request tidak ditemukan")
    
    if pr["status"] != "approved":
        raise ValidationError(f"Hanya PR dengan status 'approved' yang bisa di-mark paid (current: {pr['status']})")
    
    await db.payment_requests.update_one(
        {"id": pr_id},
        {
            "$set": {
                "status": "paid",
                "paid_at": _now(),
                "updated_at": _now(),
            }
        }
    )
    
    logger.info(f"PR {pr['doc_no']} marked as paid by {user['email']}")
    return await get_payment_request(pr_id)


async def get_open_ap_for_pr(
    *,
    brand_id: Optional[str] = None,
    outlet_id: Optional[str] = None,
    vendor_id: Optional[str] = None,
) -> list[dict]:
    """Get list of open/overdue AP Ledger items yang bisa dipilih untuk PR."""
    db = get_db()
    
    # Query GoodsReceipt yang belum fully paid
    q = {
        "deleted_at": None,
        "status": "received",
        "$expr": {
            "$lt": [
                {"$sum": "$payments.amount"},
                "$total_amount"
            ]
        }
    }
    
    if brand_id:
        q["brand_id"] = brand_id
    if outlet_id:
        q["outlet_id"] = outlet_id
    if vendor_id:
        q["vendor_id"] = vendor_id
    
    cursor = db.goods_receipts.find(q).sort([("due_date", 1), ("receive_date", 1)]).limit(100)
    grs = await cursor.to_list(100)
    
    # Enrich dengan vendor info dan calculate outstanding
    vendor_ids = list({gr.get("vendor_id") for gr in grs if gr.get("vendor_id")})
    vendors = {}
    if vendor_ids:
        async for v in db.vendors.find({"id": {"$in": vendor_ids}}):
            vendors[v["id"]] = v
    
    items = []
    for gr in grs:
        paid = sum(p.get("amount", 0) for p in gr.get("payments", []))
        outstanding = gr.get("total_amount", 0) - paid
        
        if outstanding <= 0:
            continue
        
        vendor = vendors.get(gr.get("vendor_id"), {})
        due_date = gr.get("due_date") or gr.get("invoice_date")
        days_overdue = 0
        if due_date:
            try:
                due = datetime.fromisoformat(due_date.replace("Z", "+00:00"))
                days_overdue = max(0, (datetime.now(timezone.utc) - due).days)
            except (ValueError, AttributeError):
                pass
        
        items.append({
            "gr_id": gr["id"],
            "doc_no": gr.get("doc_no"),
            "vendor_id": gr.get("vendor_id"),
            "vendor_name": vendor.get("name", "Unknown"),
            "invoice_no": gr.get("invoice_no"),
            "invoice_date": gr.get("invoice_date"),
            "receive_date": gr.get("receive_date"),
            "due_date": due_date,
            "days_overdue": days_overdue,
            "total_amount": gr.get("total_amount", 0),
            "paid": paid,
            "outstanding": outstanding,
            "priority": "urgent" if days_overdue > 30 else "normal",
        })
    
    # Sort: overdue first, then by due date
    items.sort(key=lambda x: (-x["days_overdue"], x.get("due_date") or "9999-12-31"))
    
    return items

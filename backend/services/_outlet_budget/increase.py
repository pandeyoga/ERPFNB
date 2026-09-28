"""Budget increase requests: create / list / approve / reject."""
import uuid
from typing import Optional

from services._outlet_budget._common import (
    _now, audit_log, get_db, serialize, NotFoundError, ValidationError, BUCKETS,
)


async def create_increase_request(payload: dict, *, user: dict) -> dict:
    db = get_db()
    budget = await db.outlet_budgets.find_one({"id": payload["budget_id"], "deleted_at": None})
    if not budget:
        raise NotFoundError("OutletBudget")
    if payload["outlet_id"] != budget["outlet_id"]:
        raise ValidationError("outlet_id tidak sesuai dengan budget")

    mode = (budget.get("budget_mode") or "per_bucket").lower()
    bucket = payload["bucket"]
    if mode == "combined":
        # In combined mode, force-route any bucket to "combined"
        bucket = "combined"
    else:
        if bucket not in BUCKETS:
            raise ValidationError("bucket harus kdo/fdo/bdo")
    doc = {
        "id": str(uuid.uuid4()),
        "outlet_id": payload["outlet_id"],
        "brand_id": budget.get("brand_id"),
        "budget_id": payload["budget_id"],
        "bucket": bucket,
        "budget_mode": mode,
        "requested_amount": float(payload["requested_amount"]),
        "reason": payload["reason"],
        "related_pr_id": payload.get("related_pr_id"),
        "related_pr_amount": payload.get("related_pr_amount"),
        "status": "pending",
        "requested_by": user["id"],
        "requested_at": _now(),
        "decided_by": None,
        "decided_at": None,
        "decision_note": None,
        "approved_amount": None,
        "created_at": _now(),
        "updated_at": _now(),
        "deleted_at": None,
    }
    await db.budget_increase_requests.insert_one(doc)
    await audit_log(user_id=user["id"], entity_type="budget_increase_request",
                    entity_id=doc["id"], action="create")
    # Notify Executive: pick any user with executive.budget.approve or *.
    try:
        users = db.users.find({
            "deleted_at": None,
            "status": "active",
            "$or": [
                {"permissions": "*"},
                {"permissions": "outlet_budget.approve_increase"},
            ],
        })
        outlet_doc = await db.outlets.find_one({"id": payload["outlet_id"]}, {"name": 1})
        outlet_name = (outlet_doc or {}).get("name", payload["outlet_id"])
        label = "GABUNGAN" if bucket == "combined" else bucket.upper()
        async for u in users:
            await db.notifications.insert_one({
                "id": str(uuid.uuid4()),
                "user_id": u["id"],
                "kind": "budget_increase_request",
                "title": f"Request Penambahan Budget {label} \u2014 {outlet_name}",
                "body": f"Rp {float(payload['requested_amount']):,.0f} \u2014 {payload['reason'][:120]}",
                "link": "/executive/budget-increase-requests",
                "created_at": _now(),
                "read_at": None,
            })
    except Exception:
        pass
    return serialize(doc)


async def list_increase_requests(
    *, status: Optional[str] = None,
    outlet_ids: Optional[list[str]] = None,
) -> list[dict]:
    db = get_db()
    q: dict = {"deleted_at": None}
    if status:
        q["status"] = status
    if outlet_ids is not None:
        q["outlet_id"] = {"$in": outlet_ids}
    docs = await db.budget_increase_requests.find(q).sort([("requested_at", -1)]).to_list(500)
    return [serialize(d) for d in docs]


async def approve_increase_request(
    req_id: str, *, user: dict, approved_amount: Optional[float] = None,
    note: Optional[str] = None,
) -> dict:
    db = get_db()
    req = await db.budget_increase_requests.find_one({"id": req_id, "deleted_at": None})
    if not req:
        raise NotFoundError("BudgetIncreaseRequest")
    if req["status"] != "pending":
        raise ValidationError(f"Request sudah {req['status']}")
    add_amount = float(approved_amount) if approved_amount is not None else float(req["requested_amount"])
    bucket = req["bucket"]
    # Top up the budget
    budget = await db.outlet_budgets.find_one({"id": req["budget_id"], "deleted_at": None})
    if not budget:
        raise NotFoundError("OutletBudget")

    mode = (budget.get("budget_mode") or "per_bucket").lower()
    set_dict = {"updated_at": _now()}
    if bucket == "combined" or mode == "combined":
        new_combined = float(budget.get("combined_budget", 0) or 0) + add_amount
        set_dict["combined_budget"] = new_combined
        set_dict["total_budget"] = new_combined
    else:
        bf = f"{bucket}_budget"
        new_bucket = float(budget.get(bf, 0) or 0) + add_amount
        new_total = (
            float(budget.get("kdo_budget", 0) or 0)
            + float(budget.get("fdo_budget", 0) or 0)
            + float(budget.get("bdo_budget", 0) or 0)
            + add_amount
        )
        set_dict[bf] = new_bucket
        set_dict["total_budget"] = new_total
    await db.outlet_budgets.update_one(
        {"id": req["budget_id"]},
        {"$set": set_dict},
    )
    await db.budget_increase_requests.update_one(
        {"id": req_id},
        {"$set": {
            "status": "approved",
            "approved_amount": add_amount,
            "decided_by": user["id"],
            "decided_at": _now(),
            "decision_note": note,
            "updated_at": _now(),
        }},
    )
    await audit_log(user_id=user["id"], entity_type="budget_increase_request",
                    entity_id=req_id, action="approve")
    # Notify requester
    try:
        label = "GABUNGAN" if bucket == "combined" else bucket.upper()
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": req["requested_by"],
            "kind": "budget_increase_approved",
            "title": f"Request Penambahan Budget {label} DISETUJUI",
            "body": f"Tambahan Rp {add_amount:,.0f} disetujui. Anda bisa lanjutkan PR.",
            "link": "/outlet/budget",
            "created_at": _now(),
            "read_at": None,
        })
    except Exception:
        pass
    return serialize(await db.budget_increase_requests.find_one({"id": req_id}))


async def reject_increase_request(
    req_id: str, *, user: dict, note: Optional[str] = None,
) -> dict:
    db = get_db()
    req = await db.budget_increase_requests.find_one({"id": req_id, "deleted_at": None})
    if not req:
        raise NotFoundError("BudgetIncreaseRequest")
    if req["status"] != "pending":
        raise ValidationError(f"Request sudah {req['status']}")
    await db.budget_increase_requests.update_one(
        {"id": req_id},
        {"$set": {
            "status": "rejected",
            "decided_by": user["id"],
            "decided_at": _now(),
            "decision_note": note,
            "updated_at": _now(),
        }},
    )
    await audit_log(user_id=user["id"], entity_type="budget_increase_request",
                    entity_id=req_id, action="reject")
    try:
        label = "GABUNGAN" if req["bucket"] == "combined" else req["bucket"].upper()
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": req["requested_by"],
            "kind": "budget_increase_rejected",
            "title": f"Request Penambahan Budget {label} DITOLAK",
            "body": (note or "Tidak disetujui oleh Executive.")[:200],
            "link": "/outlet/budget",
            "created_at": _now(),
            "read_at": None,
        })
    except Exception:
        pass
    return serialize(await db.budget_increase_requests.find_one({"id": req_id}))

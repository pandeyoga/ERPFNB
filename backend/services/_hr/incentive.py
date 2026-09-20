"""HR sub-module: Incentive Schemes + Runs.

Auto-extracted from former monolithic hr_service.py for maintainability.
"""
import uuid
from typing import Optional

from core.audit import log as audit_log
from core.db import get_db, serialize
from core.exceptions import (
    ConflictError, NotFoundError, ValidationError,
)
from services import journal_service
from services.hr_constants import _now, _period_now


async def list_schemes(*, page: int = 1, per_page: int = 50):
    db = get_db()
    q = {"deleted_at": None}
    skip = (page - 1) * per_page
    items = await db.incentive_schemes.find(q).sort([("created_at", -1)]).skip(skip).limit(per_page).to_list(per_page)
    total = await db.incentive_schemes.count_documents(q)
    return [serialize(d) for d in items], {"page": page, "per_page": per_page, "total": total}


async def create_scheme(payload: dict, *, user: dict) -> dict:
    db = get_db()
    code = (payload.get("code") or "").strip().upper()
    name = (payload.get("name") or "").strip()
    if not code or not name:
        raise ValidationError("code dan name wajib")
    if await db.incentive_schemes.find_one({"code": code, "deleted_at": None}):
        raise ConflictError(f"Scheme code {code} sudah ada")
    doc = {
        "id": str(uuid.uuid4()),
        "code": code,
        "name": name,
        "scope_type": payload.get("scope_type", "outlet"),
        "scope_id": payload.get("scope_id"),
        "rule_type": payload.get("rule_type", "pct_of_sales"),
        "rule_data": payload.get("rule_data") or {},
        "employee_ids": payload.get("employee_ids") or [],
        "active": True,
        "notes": payload.get("notes"),
        "created_at": _now(), "updated_at": _now(), "deleted_at": None,
        "created_by": user["id"],
    }
    await db.incentive_schemes.insert_one(doc)
    await audit_log(user_id=user["id"], entity_type="incentive_scheme",
                    entity_id=doc["id"], action="create")
    return serialize(doc)


async def list_runs(*, scheme_id: Optional[str] = None, period: Optional[str] = None,
                     status: Optional[str] = None, page: int = 1, per_page: int = 20):
    db = get_db()
    q: dict = {"deleted_at": None}
    if scheme_id:
        q["scheme_id"] = scheme_id
    if period:
        q["period"] = period
    if status:
        q["status"] = status
    skip = (page - 1) * per_page
    items = await db.incentive_runs.find(q).sort([("period", -1), ("created_at", -1)]).skip(skip).limit(per_page).to_list(per_page)
    total = await db.incentive_runs.count_documents(q)
    return [serialize(d) for d in items], {"page": page, "per_page": per_page, "total": total}


async def get_run(run_id: str) -> dict:
    db = get_db()
    d = await db.incentive_runs.find_one({"id": run_id, "deleted_at": None})
    if not d:
        raise NotFoundError("Incentive run tidak ditemukan")
    return serialize(d)


async def calculate_incentive(payload: dict, *, user: dict) -> dict:
    """Run a scheme for a given period.
    Supported rule_types:
      - pct_of_sales: rule_data.pct (decimal). base = validated daily_sales for outlet+period.
      - flat_per_target: rule_data.target_sales, rule_data.flat_amount.
                          If base_sales >= target → flat_amount distributed.
      - tiered_sales: rule_data.tiers[{min_sales, max_sales, pct, flat}] → first match.
    Distribute equally across scheme.employee_ids.
    """
    db = get_db()
    scheme_id = payload.get("scheme_id")
    period = payload.get("period") or _period_now()
    if not scheme_id:
        raise ValidationError("scheme_id wajib")
    scheme = await db.incentive_schemes.find_one({"id": scheme_id, "deleted_at": None})
    if not scheme:
        raise ValidationError("Scheme tidak ditemukan")
    if not scheme.get("active"):
        raise ValidationError("Scheme tidak aktif")

    outlet_id = scheme.get("scope_id") if scheme.get("scope_type") == "outlet" else payload.get("outlet_id")
    # Compute base sales (validated daily_sales grand_total in period)
    sales_match: dict = {
        "deleted_at": None, "status": "validated",
        "sales_date": {"$gte": f"{period}-01", "$lte": f"{period}-31"},
    }
    if outlet_id:
        sales_match["outlet_id"] = outlet_id
    agg = db.daily_sales.aggregate([
        {"$match": sales_match},
        {"$group": {"_id": None, "total": {"$sum": {"$ifNull": ["$grand_total", 0]}}}},
    ])
    res = await agg.to_list(1)
    base_sales = float(res[0]["total"]) if res else 0.0

    rule_type = scheme.get("rule_type", "pct_of_sales")
    rule_data = scheme.get("rule_data") or {}
    if rule_type == "pct_of_sales":
        pct = float(rule_data.get("pct", 0) or 0)
        total_amount = round(base_sales * pct, 2)
    elif rule_type == "flat_per_target":
        target = float(rule_data.get("target_sales", 0) or 0)
        flat = float(rule_data.get("flat_amount", 0) or 0)
        total_amount = flat if base_sales >= target else 0
    elif rule_type == "tiered_sales":
        total_amount = 0
        for tier in rule_data.get("tiers", []):
            mn = float(tier.get("min_sales", 0) or 0)
            mx = float(tier.get("max_sales", 9e18) or 9e18)
            if mn <= base_sales <= mx:
                total_amount = round(base_sales * float(tier.get("pct", 0) or 0)
                                     + float(tier.get("flat", 0) or 0), 2)
                break
    else:
        total_amount = 0

    # Distribute equally among employees in scheme
    emp_ids = scheme.get("employee_ids") or []
    allocations: list[dict] = []
    if emp_ids and total_amount > 0:
        per_head = round(total_amount / len(emp_ids), 2)
        last = round(total_amount - per_head * (len(emp_ids) - 1), 2)
        # Resolve names
        emp_map = {}
        async for e in db.employees.find({"id": {"$in": emp_ids}}):
            emp_map[e["id"]] = e.get("full_name", e["id"])
        for i, eid in enumerate(emp_ids):
            allocations.append({
                "employee_id": eid,
                "employee_name": emp_map.get(eid, eid),
                "base_amount": base_sales,
                "formula_detail": f"{rule_type}",
                "amount": last if i == len(emp_ids) - 1 else per_head,
            })

    # Upsert run for (scheme, period, outlet)
    existing = await db.incentive_runs.find_one({
        "scheme_id": scheme_id, "period": period,
        "outlet_id": outlet_id, "deleted_at": None,
    })
    common = {
        "scheme_id": scheme_id,
        "scheme_name": scheme.get("name"),
        "period": period,
        "outlet_id": outlet_id,
        "brand_id": payload.get("brand_id"),
        "base_sales": round(base_sales, 2),
        "allocations": allocations,
        "total_amount": round(total_amount, 2),
        "status": "calculated",
        "calculated_at": _now(), "calculated_by": user["id"],
        "updated_at": _now(),
        "notes": payload.get("notes"),
    }
    if existing:
        if existing["status"] == "posted":
            raise ConflictError("Run sudah posted; tidak bisa di-recalculate")
        await db.incentive_runs.update_one({"id": existing["id"]}, {"$set": common})
        run_id = existing["id"]
    else:
        doc_no = f"INC-{period}-{(scheme.get('code') or 'GEN')}"
        doc = {
            "id": str(uuid.uuid4()), "doc_no": doc_no,
            **common,
            "approved_at": None, "approved_by": None,
            "posted_at": None, "posted_by": None,
            "journal_entry_id": None,
            "created_at": _now(), "deleted_at": None,
            "created_by": user["id"],
        }
        await db.incentive_runs.insert_one(doc)
        run_id = doc["id"]
    await audit_log(user_id=user["id"], entity_type="incentive_run",
                    entity_id=run_id, action="calculate",
                    after={"scheme_id": scheme_id, "period": period})
    return await get_run(run_id)


async def approve_incentive(run_id: str, *, user: dict) -> dict:
    db = get_db()
    d = await db.incentive_runs.find_one({"id": run_id, "deleted_at": None})
    if not d:
        raise NotFoundError("Incentive run tidak ditemukan")
    if d["status"] != "calculated":
        raise ValidationError(f"Status saat ini: {d['status']}")
    await db.incentive_runs.update_one(
        {"id": run_id},
        {"$set": {"status": "approved",
                  "approved_at": _now(), "approved_by": user["id"],
                  "updated_at": _now()}},
    )
    await audit_log(user_id=user["id"], entity_type="incentive_run",
                    entity_id=run_id, action="approve")
    return await get_run(run_id)


async def post_incentive(run_id: str, *, user: dict) -> dict:
    db = get_db()
    d = await db.incentive_runs.find_one({"id": run_id, "deleted_at": None})
    if not d:
        raise NotFoundError("Incentive run tidak ditemukan")
    if d["status"] not in ("approved", "calculated"):
        raise ValidationError(f"Status saat ini: {d['status']}")
    je = await journal_service.post_for_incentive(d, user_id=user["id"])
    update: dict = {
        "status": "posted",
        "posted_at": _now(), "posted_by": user["id"],
        "journal_entry_id": je["id"] if je else None,
        "journal_skipped": je is None,
        "journal_skip_reason": (
            None if je else "Incentive total is 0 (no validated sales / scheme produced no payout)"
        ),
        "updated_at": _now(),
    }
    await db.incentive_runs.update_one({"id": run_id}, {"$set": update})
    await audit_log(user_id=user["id"], entity_type="incentive_run",
                    entity_id=run_id, action="post")
    return await get_run(run_id)

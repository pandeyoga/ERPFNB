"""HR sub-module: Service Charge.

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
from services.hr_constants import _now, _today, _period_now
from services._hr.lb_fund import _lb_ledger_add


async def list_service_charge(
    *, period: Optional[str] = None, outlet_id: Optional[str] = None,
    status: Optional[str] = None,
    page: int = 1, per_page: int = 20,
):
    db = get_db()
    q: dict = {"deleted_at": None}
    if period:
        q["period"] = period
    if outlet_id:
        q["outlet_id"] = outlet_id
    if status:
        q["status"] = status
    skip = (page - 1) * per_page
    items = await db.service_charge_periods.find(q).sort([("period", -1)]).skip(skip).limit(per_page).to_list(per_page)
    total = await db.service_charge_periods.count_documents(q)
    return [serialize(d) for d in items], {"page": page, "per_page": per_page, "total": total}


async def get_service_charge(sc_id: str) -> dict:
    db = get_db()
    d = await db.service_charge_periods.find_one({"id": sc_id, "deleted_at": None})
    if not d:
        raise NotFoundError("Service charge period tidak ditemukan")
    s = serialize(d)
    # Enrich outlet name
    outlet = await db.outlets.find_one({"id": s.get("outlet_id")})
    s["outlet_name"] = outlet.get("name") if outlet else None
    return s


async def calculate_service_charge(payload: dict, *, user: dict) -> dict:
    """Calculate service charge for period/outlet:
    - Sum service_charge from validated daily_sales for outlet+period
    - Deduct LB% and LD% (defaults from `service_charge_policy` business rule
      resolved via outlet → brand → group hierarchy if not explicitly provided)
    - Distribute remainder by employee days_worked (default working-days from
      policy if not overridden in payload)
    """
    from services import business_rules_service  # local import to avoid cycle

    db = get_db()
    period = payload.get("period") or _period_now()
    outlet_id = payload.get("outlet_id")
    if not outlet_id:
        raise ValidationError("outlet_id wajib")
    outlet = await db.outlets.find_one({"id": outlet_id, "deleted_at": None})
    if not outlet:
        raise ValidationError("Outlet tidak ditemukan")

    # Resolve service_charge_policy if user did not override
    policy = await business_rules_service.resolve_rule(
        rule_type="service_charge_policy",
        outlet_id=outlet_id,
        brand_id=outlet.get("brand_id"),
        on_date=f"{period}-01",
    )
    policy_data = (policy or {}).get("rule_data") or {}

    lb_pct = float(
        payload.get("lb_pct") if payload.get("lb_pct") is not None else policy_data.get("lb_pct", 0.05)
    )
    ld_pct = float(
        payload.get("ld_pct") if payload.get("ld_pct") is not None else policy_data.get("ld_pct", 0)
    )
    default_days = int(payload.get("default_working_days") or policy_data.get("default_working_days") or 22)

    if lb_pct < 0 or lb_pct > 0.5:
        raise ValidationError("lb_pct di luar batas (0..0.5)")
    if ld_pct < 0 or ld_pct > 0.5:
        raise ValidationError("ld_pct di luar batas (0..0.5)")

    # Aggregate validated daily_sales service_charge for outlet+period
    agg = db.daily_sales.aggregate([
        {"$match": {
            "deleted_at": None, "status": "validated",
            "outlet_id": outlet_id,
            "sales_date": {"$gte": f"{period}-01", "$lte": f"{period}-31"},
        }},
        {"$group": {"_id": None,
                    "total": {"$sum": {"$ifNull": ["$service_charge", 0]}}}},
    ])
    res = await agg.to_list(1)
    gross_service = float(res[0]["total"]) if res else 0.0
    lb_amount = round(gross_service * lb_pct, 2)
    ld_amount = round(gross_service * ld_pct, 2)
    distributable = round(gross_service - lb_amount - ld_amount, 2)

    # Employees in outlet: assume 22 working days each by default; allow override via payload.allocations[]
    employees: list[dict] = []
    async for e in db.employees.find({"deleted_at": None, "outlet_id": outlet_id, "status": "active"}):
        employees.append(e)

    # Days worked override
    days_overrides = {a["employee_id"]: float(a.get("days_worked", default_days))
                      for a in payload.get("allocations", []) if a.get("employee_id")}
    total_days = sum(days_overrides.get(e["id"], default_days) for e in employees)
    allocations: list[dict] = []
    if total_days <= 0 or distributable <= 0 or not employees:
        for e in employees:
            allocations.append({
                "employee_id": e["id"],
                "employee_name": e.get("full_name"),
                "days_worked": days_overrides.get(e["id"], default_days),
                "share_pct": 0,
                "amount": 0,
            })
    else:
        for e in employees:
            d_w = days_overrides.get(e["id"], default_days)
            share = d_w / total_days
            amount = round(distributable * share, 2)
            allocations.append({
                "employee_id": e["id"],
                "employee_name": e.get("full_name"),
                "days_worked": d_w,
                "share_pct": round(share * 100, 2),
                "amount": amount,
            })

    # Upsert (one per period+outlet) — keep status flow safe
    existing = await db.service_charge_periods.find_one({
        "period": period, "outlet_id": outlet_id, "deleted_at": None,
    })
    common = {
        "period": period, "outlet_id": outlet_id,
        "brand_id": outlet.get("brand_id"),
        "gross_service": round(gross_service, 2),
        "lb_pct": lb_pct, "ld_pct": ld_pct,
        "lb_amount": lb_amount, "ld_amount": ld_amount,
        "distributable": distributable,
        "allocations": allocations,
        "status": "calculated",
        "calculated_at": _now(), "calculated_by": user["id"],
        "updated_at": _now(),
        "notes": payload.get("notes"),
        "policy_id": (policy or {}).get("id"),
        "policy_version": (policy or {}).get("version"),
        "policy_scope": ((policy or {}).get("scope_type"), (policy or {}).get("scope_id"))
            if policy else None,
    }
    if existing:
        if existing["status"] == "posted":
            raise ConflictError("Period sudah posted; tidak bisa di-recalculate")
        await db.service_charge_periods.update_one({"id": existing["id"]}, {"$set": common})
        sc_id = existing["id"]
    else:
        doc = {
            "id": str(uuid.uuid4()),
            "doc_no": f"SC-{period}-{outlet.get('code','')}",
            **common,
            "approved_at": None, "approved_by": None,
            "posted_at": None, "posted_by": None,
            "journal_entry_id": None,
            "created_at": _now(), "deleted_at": None,
            "created_by": user["id"],
        }
        await db.service_charge_periods.insert_one(doc)
        sc_id = doc["id"]
    await audit_log(user_id=user["id"], entity_type="service_charge",
                    entity_id=sc_id, action="calculate",
                    after={"period": period, "outlet_id": outlet_id})
    return await get_service_charge(sc_id)


async def approve_service_charge(sc_id: str, *, user: dict) -> dict:
    db = get_db()
    d = await db.service_charge_periods.find_one({"id": sc_id, "deleted_at": None})
    if not d:
        raise NotFoundError("Service charge tidak ditemukan")
    if d["status"] != "calculated":
        raise ValidationError(f"Status saat ini: {d['status']}, hanya calculated yang bisa di-approve")
    await db.service_charge_periods.update_one(
        {"id": sc_id},
        {"$set": {"status": "approved",
                  "approved_at": _now(), "approved_by": user["id"],
                  "updated_at": _now()}},
    )
    await audit_log(user_id=user["id"], entity_type="service_charge",
                    entity_id=sc_id, action="approve")
    return await get_service_charge(sc_id)


async def post_service_charge(sc_id: str, *, user: dict) -> dict:
    db = get_db()
    d = await db.service_charge_periods.find_one({"id": sc_id, "deleted_at": None})
    if not d:
        raise NotFoundError("Service charge tidak ditemukan")
    if d["status"] not in ("approved", "calculated"):
        raise ValidationError(f"Status saat ini: {d['status']}")
    je = await journal_service.post_for_service_charge(d, user_id=user["id"])
    # LB Fund ledger entry (in)
    if d.get("lb_amount", 0) > 0:
        await _lb_ledger_add(
            entry_date=_today(),
            direction="in",
            amount=float(d["lb_amount"]),
            source_type="service_charge",
            source_id=sc_id,
            outlet_id=d.get("outlet_id"),
            description=f"L&B deduction from service charge {d.get('period')}",
        )
    update: dict = {
        "status": "posted",
        "posted_at": _now(), "posted_by": user["id"],
        "journal_entry_id": je["id"] if je else None,
        "journal_skipped": je is None,
        "journal_skip_reason": (
            None if je else "Service charge total is 0 (no validated daily_sales for period+outlet)"
        ),
        "updated_at": _now(),
    }
    await db.service_charge_periods.update_one({"id": sc_id}, {"$set": update})
    await audit_log(user_id=user["id"], entity_type="service_charge",
                    entity_id=sc_id, action="post")
    return await get_service_charge(sc_id)

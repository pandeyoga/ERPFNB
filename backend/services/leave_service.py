"""Leave Request service."""
from datetime import datetime, timezone
from typing import Optional

from core.audit import log as audit_log
from core.db import get_db, serialize
from core.exceptions import ForbiddenError, NotFoundError, ValidationError
from models.leave_request import LEAVE_TYPES, make_leave_request
from services import approval_service


# HR/manager perms that MAY act on any employee's leave record (not just their own).
# Same list as _HR_LEAVE_VIEW_PERMS in routers/leave.py — kept here to keep the
# service self-contained (SoC + easier to unit-test).
_HR_LEAVE_MANAGE_PERMS = ("hr.leave.approve", "hr.leave.read", "hr.employee.read")


async def _assert_can_manage_leave(user_id: str, leave_doc: dict) -> None:
    """IDOR guard for write actions (PATCH/DELETE/submit/cancel) on a leave record.

    Allow if the caller IS the leave owner (employee_id == user_id), is super (*),
    or holds an HR/manager leave-manage permission. Otherwise raise 403.
    """
    if leave_doc.get("employee_id") == user_id:
        return
    from core.security import get_user_permissions
    db = get_db()
    caller = await db.users.find_one({"id": user_id, "deleted_at": None})
    if not caller:
        raise ForbiddenError("User tidak ditemukan", code="LEAVE_OWNERSHIP_REQUIRED")
    perms = await get_user_permissions(caller)
    if "*" in perms or any(p in perms for p in _HR_LEAVE_MANAGE_PERMS):
        return
    raise ForbiddenError(
        "Tidak boleh mengubah/menghapus data cuti karyawan lain",
        code="LEAVE_OWNERSHIP_REQUIRED",
    )


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# Annual leave entitlement per type (days/year). Single source of truth shared by
# create-time enforcement and the usage-summary endpoint.
LEAVE_QUOTAS = {
    "annual": 12, "sick": 14, "personal": 3, "emergency": 3,
    "maternity": 90, "paternity": 3, "other": 5,
}


async def _used_leave_days(db, employee_id: str, leave_type: str, year: str,
                           exclude_id: Optional[str] = None) -> float:
    """Sum committed days (submitted + approved) for an employee/type/year.

    Counts in-flight (submitted) + approved so concurrent requests can't collectively
    overbook the quota. Drafts/rejected/cancelled are excluded.
    """
    match = {
        "employee_id": employee_id,
        "leave_type": leave_type,
        "status": {"$in": ["submitted", "approved"]},
        "deleted_at": None,
        "start_date": {"$regex": f"^{year}"},
    }
    if exclude_id:
        match["id"] = {"$ne": exclude_id}
    rows = await db.leave_requests.aggregate([
        {"$match": match},
        {"$group": {"_id": None, "total": {"$sum": "$days_count"}}},
    ]).to_list(1)
    return float(rows[0]["total"]) if rows else 0.0


async def _assert_within_quota(db, *, employee_id: str, leave_type: str,
                               start_date: str, days_count: float,
                               exclude_id: Optional[str] = None) -> None:
    """Reject a leave request that would exceed the employee's remaining quota.

    Callers may bypass with payload {"allow_over_quota": true} for special cases
    (e.g. approved unpaid / extended leave).
    """
    quota = LEAVE_QUOTAS.get(leave_type)
    if not quota:
        return  # untracked type → no quota ceiling
    year = (start_date or "")[:4] or str(datetime.now(timezone.utc).year)
    used = await _used_leave_days(db, employee_id, leave_type, year, exclude_id=exclude_id)
    remaining = quota - used
    if days_count > remaining:
        raise ValidationError(
            f"Pengajuan cuti {days_count:g} hari melebihi sisa kuota '{leave_type}' "
            f"({remaining:g} dari {quota} hari, terpakai {used:g}). "
            f"Set allow_over_quota=true untuk cuti di luar kuota (mis. tanpa gaji).",
            field="days_count",
        )


async def _next_doc_no(db) -> str:
    year = datetime.now(timezone.utc).year
    key = f"LR-{year}"
    count = await db.leave_requests.count_documents({"doc_no": {"$regex": f"^{key}"}})
    return f"{key}-{count + 1:04d}"


async def create_leave_request(payload: dict, *, user_id: str) -> dict:
    db = get_db()
    employee_id = payload.get("employee_id") or user_id
    # Get employee name
    emp = await db.employees.find_one({"id": employee_id, "deleted_at": None})
    if not emp:
        # Fall back to user profile
        emp_user = await db.users.find_one({"id": employee_id, "deleted_at": None})
        employee_name = (emp_user or {}).get("full_name", "Unknown")
        outlet_id = payload.get("outlet_id")
    else:
        employee_name = emp.get("full_name") or emp.get("name", "Unknown")
        outlet_id = payload.get("outlet_id") or emp.get("outlet_id")

    leave_type = payload.get("leave_type", "personal")
    if leave_type not in [lt["code"] for lt in LEAVE_TYPES]:
        raise ValidationError(f"Jenis cuti tidak valid: {leave_type}", field="leave_type")
    start_date = payload.get("start_date")
    end_date = payload.get("end_date") or start_date
    if not start_date:
        raise ValidationError("start_date wajib", field="start_date")

    # Calculate days_count
    try:
        sd = datetime.strptime(start_date, "%Y-%m-%d")
        ed = datetime.strptime(end_date, "%Y-%m-%d")
        days_count = float(payload.get("days_count") or max(1, (ed - sd).days + 1))
    except Exception:
        days_count = float(payload.get("days_count") or 1)

    doc_no = await _next_doc_no(db)
    # ENFORCE quota (reject over-quota unless explicitly overridden). RC-7 business rule.
    if not payload.get("allow_over_quota"):
        await _assert_within_quota(
            db, employee_id=employee_id, leave_type=leave_type,
            start_date=start_date, days_count=days_count,
        )
    doc = make_leave_request(
        employee_id=employee_id,
        employee_name=employee_name,
        outlet_id=outlet_id,
        leave_type=leave_type,
        start_date=start_date,
        end_date=end_date,
        days_count=days_count,
        notes=payload.get("notes"),
        attachment_url=payload.get("attachment_url"),
        created_by=user_id,
        doc_no=doc_no,
    )
    await db.leave_requests.insert_one(doc)
    await audit_log(user_id=user_id, entity_type="leave_request", entity_id=doc["id"], action="create")
    return serialize(doc)


async def list_leave_requests(
    *,
    employee_id: Optional[str] = None,
    outlet_id: Optional[str] = None,
    status: Optional[str] = None,
    leave_type: Optional[str] = None,
    period: Optional[str] = None,
    page: int = 1,
    per_page: int = 50,
    pending_approval: bool = False,
    user_id: Optional[str] = None,
) -> tuple[list[dict], dict]:
    db = get_db()
    q: dict = {"deleted_at": None}
    if employee_id:
        q["employee_id"] = employee_id
    if outlet_id:
        q["outlet_id"] = outlet_id
    if status:
        q["status"] = status
    elif pending_approval:
        q["status"] = {"$in": ["submitted", "awaiting_approval"]}
    if leave_type:
        q["leave_type"] = leave_type
    if period:
        q["start_date"] = {"$regex": f"^{period}"}

    total = await db.leave_requests.count_documents(q)
    skip = (page - 1) * per_page
    items = await db.leave_requests.find(q).sort("created_at", -1).skip(skip).limit(per_page).to_list(per_page)
    return [serialize(d) for d in items], {
        "total": total, "page": page, "per_page": per_page,
        "total_pages": max(1, (total + per_page - 1) // per_page),
    }


async def get_leave_request(leave_id: str) -> Optional[dict]:
    db = get_db()
    doc = await db.leave_requests.find_one({"id": leave_id, "deleted_at": None})
    return serialize(doc) if doc else None


async def update_leave_request(leave_id: str, payload: dict, *, user_id: str) -> Optional[dict]:
    db = get_db()
    doc = await db.leave_requests.find_one({"id": leave_id, "deleted_at": None})
    if not doc:
        raise NotFoundError("Leave request")
    await _assert_can_manage_leave(user_id, doc)
    if doc.get("status") not in ("draft",):
        raise ValidationError("Hanya leave request berstatus draft yang bisa diedit")
    allowed = ["leave_type", "start_date", "end_date", "days_count", "notes", "attachment_url", "outlet_id"]
    upd = {k: v for k, v in payload.items() if k in allowed}
    upd["updated_at"] = _now()
    await db.leave_requests.update_one({"id": leave_id}, {"$set": upd})
    return await get_leave_request(leave_id)


async def delete_leave_request(leave_id: str, *, user_id: str) -> bool:
    db = get_db()
    doc = await db.leave_requests.find_one({"id": leave_id, "deleted_at": None})
    if not doc:
        raise NotFoundError("Leave request")
    await _assert_can_manage_leave(user_id, doc)
    if doc.get("status") not in ("draft", "rejected"):
        raise ValidationError("Hanya leave request draft/rejected yang bisa dihapus")
    await db.leave_requests.update_one(
        {"id": leave_id}, {"$set": {"deleted_at": _now(), "updated_at": _now()}}
    )
    return True


async def submit_leave_request(leave_id: str, *, user_id: str) -> dict:
    db = get_db()
    doc = await db.leave_requests.find_one({"id": leave_id, "deleted_at": None})
    if not doc:
        raise NotFoundError("Leave request")
    await _assert_can_manage_leave(user_id, doc)
    if doc.get("status") != "draft":
        raise ValidationError(f"Status saat ini tidak dapat diajukan: {doc.get('status')}")
    now = _now()
    await db.leave_requests.update_one(
        {"id": leave_id},
        {"$set": {"status": "submitted", "submitted_at": now, "updated_at": now,
                  "approval_chain": []}},
    )
    entity = serialize(await db.leave_requests.find_one({"id": leave_id}))
    # Notify approvers
    try:
        user = serialize(await db.users.find_one({"id": user_id})) or {}
        await approval_service.notify_pending_approvers("leave_request", entity, triggered_by=user)
    except Exception:
        pass
    return entity


async def cancel_leave_request(leave_id: str, *, user_id: str) -> dict:
    db = get_db()
    doc = await db.leave_requests.find_one({"id": leave_id, "deleted_at": None})
    if not doc:
        raise NotFoundError("Leave request")
    await _assert_can_manage_leave(user_id, doc)
    if doc.get("status") in ("approved",):
        raise ValidationError("Leave request yang sudah disetujui tidak dapat dibatalkan")
    await db.leave_requests.update_one(
        {"id": leave_id},
        {"$set": {"status": "cancelled", "updated_at": _now()}},
    )
    return serialize(await db.leave_requests.find_one({"id": leave_id}))


async def get_leave_summary(employee_id: str) -> dict:
    """Get leave usage summary for an employee for the current year."""
    db = get_db()
    year = str(datetime.now(timezone.utc).year)
    pipeline = [
        {"$match": {
            "employee_id": employee_id,
            "status": "approved",
            "deleted_at": None,
            "start_date": {"$regex": f"^{year}"},
        }},
        {"$group": {
            "_id": "$leave_type",
            "total_days": {"$sum": "$days_count"},
            "count": {"$sum": 1},
        }},
    ]
    rows = await db.leave_requests.aggregate(pipeline).to_list(20)
    result = {r["_id"]: {"total_days": r["total_days"], "count": r["count"]} for r in rows}
    summary = {}
    for lt_code, quota in LEAVE_QUOTAS.items():
        used = result.get(lt_code, {}).get("total_days", 0)
        summary[lt_code] = {"quota": quota, "used": used, "remaining": max(0, quota - used)}
    return summary

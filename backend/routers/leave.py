"""Leave Request router."""
from typing import Optional
from fastapi import APIRouter, Body, Depends, Query

from core.exceptions import ForbiddenError, NotFoundError, ok_envelope, ValidationError
from core.security import current_user, get_user_permissions, require_perm
from models.leave_request import LEAVE_TYPES
from services import approval_service, leave_service

router = APIRouter(prefix="/api/hr/leaves", tags=["leave_requests"])

# Permissions that allow viewing OTHER employees' leave data/PII. Anyone holding
# one of these is an HR/manager actor; everyone else may only read their OWN data.
_HR_LEAVE_VIEW_PERMS = ("hr.leave.approve", "hr.leave.read", "hr.employee.read")


async def _assert_can_view_employee_leave(user: dict, employee_id: Optional[str]) -> None:
    """IDOR guard: allow if the caller IS the employee, is super (*), or holds an
    HR/manager leave-view permission. Otherwise raise 403.

    Prevents any authenticated user from reading another employee's leave PII via
    /summary/{employee_id} or GET /{leave_id}.
    """
    if employee_id and employee_id == user.get("id"):
        return
    perms = await get_user_permissions(user)
    if "*" in perms or any(p in perms for p in _HR_LEAVE_VIEW_PERMS):
        return
    raise ForbiddenError(
        "Tidak boleh mengakses data cuti karyawan lain",
        code="LEAVE_OWNERSHIP_REQUIRED",
    )


@router.get("")
async def list_leaves(
    employee_id: Optional[str] = Query(default=None),
    outlet_id: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    leave_type: Optional[str] = Query(default=None),
    period: Optional[str] = Query(default=None),
    pending: bool = Query(default=False),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    user: dict = Depends(current_user),
):
    # Non-HR users can only see their own leaves
    perms = await get_user_permissions(user)
    is_hr = "*" in perms or any(p in perms for p in _HR_LEAVE_VIEW_PERMS)
    emp_id = employee_id if is_hr else user["id"]
    items, meta = await leave_service.list_leave_requests(
        employee_id=emp_id, outlet_id=outlet_id, status=status,
        leave_type=leave_type, period=period, pending_approval=pending,
        page=page, per_page=per_page,
    )
    return ok_envelope({"items": items}, meta)


@router.post("")
async def create_leave(payload: dict = Body(...), user: dict = Depends(current_user)):
    doc = await leave_service.create_leave_request(payload, user_id=user["id"])
    return ok_envelope(doc)


@router.get("/types")
async def leave_types(_: dict = Depends(current_user)):
    return ok_envelope(LEAVE_TYPES)


@router.get("/summary/{employee_id}")
async def leave_summary(employee_id: str, user: dict = Depends(current_user)):
    await _assert_can_view_employee_leave(user, employee_id)
    return ok_envelope(await leave_service.get_leave_summary(employee_id))


@router.get("/{leave_id}")
async def get_leave(leave_id: str, user: dict = Depends(current_user)):
    doc = await leave_service.get_leave_request(leave_id)
    if not doc:
        raise NotFoundError("Leave request")
    await _assert_can_view_employee_leave(user, doc.get("employee_id"))
    return ok_envelope(doc)


@router.patch("/{leave_id}")
async def update_leave(leave_id: str, payload: dict = Body(...), user: dict = Depends(current_user)):
    doc = await leave_service.update_leave_request(leave_id, payload, user_id=user["id"])
    return ok_envelope(doc)


@router.delete("/{leave_id}")
async def delete_leave(leave_id: str, user: dict = Depends(current_user)):
    await leave_service.delete_leave_request(leave_id, user_id=user["id"])
    return ok_envelope({"deleted": True})


@router.post("/{leave_id}/submit")
async def submit_leave(leave_id: str, user: dict = Depends(current_user)):
    doc = await leave_service.submit_leave_request(leave_id, user_id=user["id"])
    return ok_envelope(doc)


@router.post("/{leave_id}/cancel")
async def cancel_leave(leave_id: str, user: dict = Depends(current_user)):
    doc = await leave_service.cancel_leave_request(leave_id, user_id=user["id"])
    return ok_envelope(doc)


@router.post("/{leave_id}/approve")
async def approve_leave(
    leave_id: str,
    payload: dict = Body(default={}),
    user: dict = Depends(require_perm("hr.leave.approve")),
):
    result = await approval_service.approve(
        "leave_request", leave_id, user=user, note=payload.get("note")
    )
    return ok_envelope(result)


@router.post("/{leave_id}/reject")
async def reject_leave(
    leave_id: str,
    payload: dict = Body(...),
    user: dict = Depends(require_perm("hr.leave.approve")),
):
    reason = payload.get("reason", "").strip()
    if not reason:
        raise ValidationError("reason wajib", field="reason")
    result = await approval_service.reject(
        "leave_request", leave_id, user=user, reason=reason
    )
    return ok_envelope(result)

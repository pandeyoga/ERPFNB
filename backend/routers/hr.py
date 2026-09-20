"""/api/hr router — Phase 5 + Sprint G: advances, service charge, incentive, voucher, FOC, LB fund, payroll, salary master."""
from typing import Optional
from fastapi import APIRouter, Body, Depends, Query, UploadFile, File

from core.exceptions import ok_envelope
from core.security import current_user, require_any_perm, require_perm
from services import hr_service

router = APIRouter(prefix="/api/hr", tags=["hr"])



# ============================================================
# HOME & EMPLOYEES
# ============================================================
@router.get("/home")
async def hr_home(user: dict = Depends(require_perm("hr.read"))):
    """HR home dashboard - alias for /dashboard."""
    return ok_envelope(await hr_service.hr_dashboard())


@router.get("/employees")
async def list_employees(
    q: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_perm("hr.read")),
):
    """List employees with search and filters."""
    from core.db import get_db
    db = get_db()
    
    query = {"deleted_at": None}
    if status:
        query["status"] = status
    if q:
        query["$or"] = [
            {"full_name": {"$regex": q, "$options": "i"}},
            {"email": {"$regex": q, "$options": "i"}},
            {"employee_code": {"$regex": q, "$options": "i"}},
        ]
    
    skip = (page - 1) * per_page
    employees = await db.employees.find(query).sort("full_name", 1).skip(skip).limit(per_page).to_list(per_page)
    total = await db.employees.count_documents(query)
    
    # Serialize
    result = []
    for emp in employees:
        emp.pop("_id", None)
        result.append(emp)
    
    return ok_envelope(result, {"page": page, "per_page": per_page, "total": total})



# ============================================================
# DASHBOARD
# ============================================================
@router.get("/dashboard")
async def hr_dashboard(user: dict = Depends(require_any_perm(
    "hr.advance.read", "hr.lb_fund.read",
    "finance.report.profit_loss", "executive.dashboard.read",
))):
    return ok_envelope(await hr_service.hr_dashboard())


# ============================================================
# EMPLOYEE ADVANCES
# ============================================================
@router.get("/advances")
async def list_advances(
    employee_id: Optional[str] = None,
    outlet_id: Optional[str] = None,
    status: Optional[str] = None,
    page: int = Query(1, ge=1), per_page: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_perm("hr.advance.read")),
):
    items, meta = await hr_service.list_advances(
        employee_id=employee_id, outlet_id=outlet_id, status=status,
        page=page, per_page=per_page,
    )
    return ok_envelope(items, meta)


@router.get("/advances/{adv_id}")
async def get_advance(adv_id: str,
                      user: dict = Depends(require_perm("hr.advance.read"))):
    return ok_envelope(await hr_service.get_advance(adv_id))


@router.post("/advances")
async def create_advance(payload: dict = Body(...),
                         user: dict = Depends(require_perm("hr.advance.create"))):
    return ok_envelope(await hr_service.create_advance(payload, user=user))


@router.post("/advances/{adv_id}/submit")
async def submit_advance(adv_id: str,
                         user: dict = Depends(require_perm("hr.advance.create"))):
    return ok_envelope(await hr_service.submit_advance_for_approval(adv_id, user=user))


@router.post("/advances/{adv_id}/approve")
async def approve_advance(adv_id: str, payload: dict = Body(default={}),
                          user: dict = Depends(current_user)):
    # Permission enforced by approval engine when workflow exists; legacy fallback uses creator-by-default
    return ok_envelope(await hr_service.approve_advance(
        adv_id, user=user, note=payload.get("note")))


@router.post("/advances/{adv_id}/reject")
async def reject_advance(adv_id: str, payload: dict = Body(...),
                         user: dict = Depends(current_user)):
    return ok_envelope(await hr_service.reject_advance(
        adv_id, user=user, reason=payload.get("reason", "")))


@router.get("/advances/{adv_id}/approval-state")
async def advance_approval_state(adv_id: str, user: dict = Depends(current_user)):
    return ok_envelope(await hr_service.get_advance_approval_state(adv_id))


@router.post("/advances/{adv_id}/installments/{period}/mark-paid")
async def mark_advance_installment_paid(
    adv_id: str, period: str,
    user: dict = Depends(require_perm("hr.advance.approve")),
):
    return ok_envelope(await hr_service.mark_advance_installment_paid(adv_id, period, user=user))


# ============================================================
# SERVICE CHARGE
# ============================================================
@router.get("/service-charges")
async def list_service_charge(
    period: Optional[str] = None, outlet_id: Optional[str] = None,
    status: Optional[str] = None,
    page: int = Query(1, ge=1), per_page: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_perm("hr.service_charge.calculate")),
):
    items, meta = await hr_service.list_service_charge(
        period=period, outlet_id=outlet_id, status=status,
        page=page, per_page=per_page,
    )
    return ok_envelope(items, meta)


@router.get("/service-charges/{sc_id}")
async def get_service_charge(sc_id: str,
                              user: dict = Depends(require_perm("hr.service_charge.calculate"))):
    return ok_envelope(await hr_service.get_service_charge(sc_id))


@router.post("/service-charges/calculate")
async def calculate_service_charge(payload: dict = Body(...),
                                    user: dict = Depends(require_perm("hr.service_charge.calculate"))):
    return ok_envelope(await hr_service.calculate_service_charge(payload, user=user))


@router.post("/service-charges/{sc_id}/approve")
async def approve_service_charge(sc_id: str,
                                  user: dict = Depends(require_perm("hr.service_charge.post"))):
    return ok_envelope(await hr_service.approve_service_charge(sc_id, user=user))


@router.post("/service-charges/{sc_id}/post")
async def post_service_charge(sc_id: str,
                               user: dict = Depends(require_perm("hr.service_charge.post"))):
    return ok_envelope(await hr_service.post_service_charge(sc_id, user=user))


# ============================================================
# INCENTIVE
# ============================================================
@router.get("/incentive-schemes")
async def list_schemes(
    page: int = Query(1, ge=1), per_page: int = Query(50, ge=1, le=200),
    user: dict = Depends(require_perm("hr.incentive.calculate")),
):
    items, meta = await hr_service.list_schemes(page=page, per_page=per_page)
    return ok_envelope(items, meta)


@router.post("/incentive-schemes")
async def create_scheme(payload: dict = Body(...),
                         user: dict = Depends(require_perm("hr.incentive.calculate"))):
    return ok_envelope(await hr_service.create_scheme(payload, user=user))


@router.get("/incentive-runs")
async def list_runs(
    scheme_id: Optional[str] = None, period: Optional[str] = None,
    status: Optional[str] = None,
    page: int = Query(1, ge=1), per_page: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_perm("hr.incentive.calculate")),
):
    items, meta = await hr_service.list_runs(
        scheme_id=scheme_id, period=period, status=status,
        page=page, per_page=per_page,
    )
    return ok_envelope(items, meta)


@router.get("/incentive-runs/{run_id}")
async def get_run(run_id: str,
                   user: dict = Depends(require_perm("hr.incentive.calculate"))):
    return ok_envelope(await hr_service.get_run(run_id))


@router.post("/incentive-runs/calculate")
async def calculate_incentive(payload: dict = Body(...),
                                user: dict = Depends(require_perm("hr.incentive.calculate"))):
    return ok_envelope(await hr_service.calculate_incentive(payload, user=user))


@router.post("/incentive-runs/{run_id}/approve")
async def approve_incentive(run_id: str,
                              user: dict = Depends(require_perm("hr.incentive.approve"))):
    return ok_envelope(await hr_service.approve_incentive(run_id, user=user))


@router.post("/incentive-runs/{run_id}/post")
async def post_incentive(run_id: str,
                          user: dict = Depends(require_perm("hr.incentive.approve"))):
    return ok_envelope(await hr_service.post_incentive(run_id, user=user))


# ============================================================
# VOUCHER
# ============================================================
@router.get("/vouchers")
async def list_vouchers(
    status: Optional[str] = None, batch_id: Optional[str] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1), per_page: int = Query(50, ge=1, le=200),
    user: dict = Depends(require_perm("hr.voucher.issue")),
):
    items, meta = await hr_service.list_vouchers(
        status=status, batch_id=batch_id, search=search,
        page=page, per_page=per_page,
    )
    return ok_envelope(items, meta)


@router.post("/vouchers/issue")
async def issue_voucher_batch(payload: dict = Body(...),
                                user: dict = Depends(require_perm("hr.voucher.issue"))):
    return ok_envelope(await hr_service.issue_vouchers(payload, user=user))


@router.post("/vouchers/{code}/redeem")
async def redeem_voucher(code: str, payload: dict = Body(default={}),
                          user: dict = Depends(require_perm("hr.voucher.redeem"))):
    return ok_envelope(await hr_service.redeem_voucher(code, payload, user=user))


# ============================================================
# FOC
# ============================================================
@router.get("/foc")
async def list_foc(
    outlet_id: Optional[str] = None, foc_type: Optional[str] = None,
    date_from: Optional[str] = None, date_to: Optional[str] = None,
    page: int = Query(1, ge=1), per_page: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_perm("hr.foc.create")),
):
    outlet_ids = [outlet_id] if outlet_id else None
    items, meta = await hr_service.list_foc(
        outlet_ids=outlet_ids, foc_type=foc_type,
        date_from=date_from, date_to=date_to,
        page=page, per_page=per_page,
    )
    return ok_envelope(items, meta)


@router.post("/foc")
async def create_foc(payload: dict = Body(...),
                      user: dict = Depends(require_perm("hr.foc.create"))):
    return ok_envelope(await hr_service.create_foc(payload, user=user))


# ============================================================
# LB FUND
# ============================================================
@router.get("/lb-fund")
async def list_lb_fund(
    page: int = Query(1, ge=1), per_page: int = Query(50, ge=1, le=200),
    user: dict = Depends(require_perm("hr.lb_fund.read")),
):
    items, meta = await hr_service.list_lb_fund(page=page, per_page=per_page)
    return ok_envelope(items, meta)


# ============================================================
# PAYROLL
# ============================================================
@router.get("/payroll")
async def list_payroll(
    period: Optional[str] = None, status: Optional[str] = None,
    page: int = Query(1, ge=1), per_page: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_perm("hr.advance.approve")),
):
    items, meta = await hr_service.list_payroll(
        period=period, status=status, page=page, per_page=per_page,
    )
    return ok_envelope(items, meta)


@router.get("/payroll/export/xlsx")
async def export_payroll_xlsx(
    period: Optional[str] = None,
    user: dict = Depends(require_perm("hr.advance.approve")),
):
    """Export payroll cycles as Excel (.xlsx)."""
    from fastapi.responses import Response
    from services.excel_reports_service import generate_payroll_xlsx
    file_bytes = await generate_payroll_xlsx(period=period)
    fname = f"payroll_{period or 'all'}.xlsx"
    return Response(
        content=file_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={fname}"},
    )


@router.get("/payroll/{p_id}")
async def get_payroll(p_id: str,
                       user: dict = Depends(require_perm("hr.advance.approve"))):
    return ok_envelope(await hr_service.get_payroll(p_id))


@router.post("/payroll")
async def create_payroll(payload: dict = Body(...),
                          user: dict = Depends(require_perm("hr.advance.approve"))):
    return ok_envelope(await hr_service.create_payroll(payload, user=user))


@router.post("/payroll/{p_id}/approve")
async def approve_payroll(p_id: str,
                           user: dict = Depends(require_perm("hr.advance.approve"))):
    return ok_envelope(await hr_service.approve_payroll(p_id, user=user))


@router.post("/payroll/{p_id}/post")
async def post_payroll(p_id: str,
                        user: dict = Depends(require_perm("hr.advance.approve"))):
    return ok_envelope(await hr_service.post_payroll(p_id, user=user))



# ============================================================
# SALARY MASTER (Sprint G)
# ============================================================

@router.get("/salary-master")
async def list_salary_masters(
    outlet_id: Optional[str] = Query(None),
    per_page: int = Query(200),
    user: dict = Depends(require_any_perm("hr.payroll.read", "hr.advance.approve", "*")),
):
    """List all employees with their salary master (or defaults)."""
    return ok_envelope(await hr_service.list_salary_masters(outlet_id=outlet_id, per_page=per_page))


@router.get("/salary-master/{employee_id}")
async def get_salary_master(employee_id: str,
                             user: dict = Depends(require_any_perm("hr.payroll.read", "hr.advance.approve", "*"))):
    return ok_envelope(await hr_service.get_salary_master(employee_id))


@router.put("/salary-master/{employee_id}")
async def set_salary_master(employee_id: str,
                             payload: dict = Body(...),
                             user: dict = Depends(require_perm("hr.advance.approve"))):
    return ok_envelope(await hr_service.set_salary_master(employee_id, payload, user=user))


@router.post("/salary-master/import")
async def import_salary_master(
    file: UploadFile = File(...),
    user: dict = Depends(require_perm("hr.advance.approve")),
):
    """Import salary master from Excel (.xlsx) or CSV."""
    content = await file.read()
    result = await hr_service.import_salary_excel(content, user=user)
    return ok_envelope(result)


@router.get("/payroll/{cycle_id}/payslip/{employee_id}")
async def get_payslip_data(
    cycle_id: str, employee_id: str,
    user: dict = Depends(require_any_perm("hr.payroll.read", "hr.advance.approve", "*")),
):
    """Return payslip data for one employee in a cycle (for PDF generation)."""
    return ok_envelope(await hr_service.get_payroll_payslip_data(cycle_id, employee_id))


# ============================================================
# JOB APPLICATIONS (Careers Portal)
# ============================================================

@router.get("/job-applications")
async def list_job_applications(
    status: Optional[str] = Query(None),
    job_id: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_any_perm("hr.advance.read", "hr.advance.approve", "*")),
):
    """List all job applications for HR review."""
    from core.db import get_db
    db = get_db()
    query = {}
    if status:
        query["status"] = status
    if job_id:
        query["job_id"] = job_id
    if department:
        query["job_dept"] = department
    if q:
        query["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"email": {"$regex": q, "$options": "i"}},
            {"job_title": {"$regex": q, "$options": "i"}},
        ]
    total = await db.job_applications.count_documents(query)
    skip = (page - 1) * per_page
    cursor = db.job_applications.find(query, {"_id": 0}).sort("applied_at", -1).skip(skip).limit(per_page)
    apps = await cursor.to_list(length=per_page)
    from core.db import serialize
    return ok_envelope({
        "items": [serialize(a) for a in apps],
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": (total + per_page - 1) // per_page,
    })


@router.get("/job-applications/{app_id}")
async def get_job_application(
    app_id: str,
    user: dict = Depends(require_any_perm("hr.advance.read", "hr.advance.approve", "*")),
):
    """Get single job application."""
    from core.db import get_db, serialize
    db = get_db()
    app = await db.job_applications.find_one({"id": app_id}, {"_id": 0})
    if not app:
        from core.exceptions import NotFoundError
        raise NotFoundError("Lamaran tidak ditemukan.")
    return ok_envelope(serialize(app))


@router.patch("/job-applications/{app_id}")
async def update_job_application(
    app_id: str,
    payload: dict = Body(...),
    user: dict = Depends(require_perm("hr.advance.approve")),
):
    """Update job application status and notes."""
    from core.db import get_db, serialize
    from datetime import datetime, timezone
    db = get_db()
    allowed_statuses = {"new", "reviewed", "shortlisted", "rejected", "hired"}
    updates = {"updated_at": datetime.now(timezone.utc)}
    if "status" in payload:
        if payload["status"] not in allowed_statuses:
            from core.exceptions import ValidationError
            raise ValidationError(f"Status tidak valid: {payload['status']}")
        updates["status"] = payload["status"]
    if "notes" in payload:
        updates["notes"] = payload["notes"]
    if "reviewer" in payload:
        updates["reviewer"] = payload["reviewer"]
    result = await db.job_applications.update_one({"id": app_id}, {"$set": updates})
    if result.matched_count == 0:
        from core.exceptions import NotFoundError
        raise NotFoundError("Lamaran tidak ditemukan.")
    app = await db.job_applications.find_one({"id": app_id}, {"_id": 0})
    return ok_envelope(serialize(app))


@router.get("/job-listings")
async def list_job_listings_hr(
    user: dict = Depends(require_any_perm("hr.advance.read", "hr.advance.approve", "*")),
):
    """List all job listings (HR view — includes inactive)."""
    from core.db import get_db, serialize
    db = get_db()
    cursor = db.job_listings.find({}, {"_id": 0}).sort("created_at", -1)
    jobs = await cursor.to_list(length=200)
    return ok_envelope([serialize(j) for j in jobs])


@router.post("/job-listings")
async def create_job_listing(
    payload: dict = Body(...),
    user: dict = Depends(require_perm("hr.advance.approve")),
):
    """Create a new job listing."""
    from core.db import get_db
    from datetime import datetime, timezone
    import uuid
    db = get_db()
    now = datetime.now(timezone.utc)
    job = {
        "id": str(uuid.uuid4()),
        "title": payload.get("title", "").strip(),
        "department": payload.get("department", "").strip(),
        "brand": payload.get("brand", "").strip(),
        "location": payload.get("location", "").strip(),
        "job_type": payload.get("job_type", "Full-time"),
        "description": payload.get("description", "").strip(),
        "requirements": payload.get("requirements", "").strip(),
        "application_email": payload.get("application_email", "hr@fnbgroup.id"),
        "is_active": payload.get("is_active", True),
        "created_at": now,
        "updated_at": now,
        "created_by": user.get("id"),
    }
    await db.job_listings.insert_one(job)
    job.pop("_id", None)
    return ok_envelope(job)


@router.patch("/job-listings/{job_id}")
async def update_job_listing(
    job_id: str,
    payload: dict = Body(...),
    user: dict = Depends(require_perm("hr.advance.approve")),
):
    """Update a job listing (e.g., toggle is_active)."""
    from core.db import get_db, serialize
    from datetime import datetime, timezone
    db = get_db()
    updates = {k: v for k, v in payload.items() if k not in {"id", "_id", "created_at", "created_by"}}
    updates["updated_at"] = datetime.now(timezone.utc)
    result = await db.job_listings.update_one({"id": job_id}, {"$set": updates})
    if result.matched_count == 0:
        from core.exceptions import NotFoundError
        raise NotFoundError("Lowongan tidak ditemukan.")
    job = await db.job_listings.find_one({"id": job_id}, {"_id": 0})
    return ok_envelope(serialize(job))




# ============================================================
# JOB APPLICATIONS (Sprint C/D)
# ============================================================
@router.get("/applications")
async def list_applications(
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    user: dict = Depends(require_perm("hr.read")),
):
    """List all job applications with optional status filter."""
    from services import job_application_service
    
    offset = (page - 1) * per_page
    result = await job_application_service.list_applications(
        status=status,
        limit=per_page,
        offset=offset,
    )
    
    return ok_envelope(result)


@router.get("/applications/stats")
async def get_application_stats(user: dict = Depends(require_perm("hr.read"))):
    """Get application statistics by status."""
    from services import job_application_service
    return ok_envelope(await job_application_service.get_application_stats())


@router.get("/applications/{application_id}")
async def get_application(
    application_id: str,
    user: dict = Depends(require_perm("hr.read")),
):
    """Get single application detail."""
    from services import job_application_service
    try:
        application = await job_application_service.get_application(application_id)
        return ok_envelope(application)
    except ValueError as e:
        from core.exceptions import NotFoundError
        raise NotFoundError(str(e))


@router.patch("/applications/{application_id}")
async def update_application(
    application_id: str,
    payload: dict = Body(...),
    user: dict = Depends(require_perm("hr.write")),
):
    """Update application status and notes."""
    from services import job_application_service
    
    status = payload.get("status")
    notes = payload.get("notes")
    
    if not status:
        from core.exceptions import ValidationError
        raise ValidationError("Status is required")
    
    try:
        application = await job_application_service.update_application_status(
            application_id=application_id,
            status=status,
            notes=notes,
            user_id=user["id"],
        )
        return ok_envelope(application)
    except ValueError as e:
        from core.exceptions import ValidationError
        raise ValidationError(str(e))

"""/api/master — master data CRUD per entity.
Generic pattern but each has its own validation.
"""
import re
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pymongo.errors import DuplicateKeyError

from core.audit import log as audit_log
from core.db import get_db, serialize
from core.exceptions import ForbiddenError, ConflictError, NotFoundError, ok_envelope, ValidationError
from core.security import current_user, require_perm

router = APIRouter(prefix="/api/master", tags=["master"])

# Map URL slug → Mongo collection + uniq field for code
_ENTITIES: dict[str, dict] = {
    "groups":           {"col": "groups",            "uniq": None},
    "brands":           {"col": "brands",            "uniq": "code"},
    "outlets":          {"col": "outlets",           "uniq": "code"},
    "items":            {"col": "items",             "uniq": "code"},
    "categories":       {"col": "categories",        "uniq": "code"},
    "vendors":          {"col": "vendors",           "uniq": "code"},
    "employees":        {"col": "employees",         "uniq": "code"},
    "chart-of-accounts": {"col": "chart_of_accounts", "uniq": "code"},
    "coa":              {"col": "chart_of_accounts", "uniq": "code"},  # Alias
    "tax-codes":        {"col": "tax_codes",         "uniq": "code"},
    "payment-methods":  {"col": "payment_methods",   "uniq": "code"},
    "bank-accounts":    {"col": "bank_accounts",     "uniq": "code"},
    "number-series":    {"col": "number_series",     "uniq": "code"},
}

_NAME_FIELDS: dict[str, str] = {
    "employees": "full_name",
}


# CTL-09: sensitive masters need explicit read permission; employee pay/ID fields are masked otherwise
_READ_PERMS: dict[str, tuple] = {
    "bank-accounts": ("admin.master_data.manage", "finance.bank_reconciliation", "finance.payment.create",
                      "finance.payment.approve", "finance.ap.read"),
    "number-series": ("admin.master_data.manage",),
}
_EMP_SENSITIVE = ("basic_salary", "salary", "bank_account", "bank_account_no", "bank_name", "npwp", "nik",
                  "allowances", "bpjs_number")


def _can(user: dict, perms: tuple) -> bool:
    up = set(user.get("permissions") or [])
    return "*" in up or any(p in up for p in perms)


def _guard_read(entity: str, user: dict) -> None:
    need = _READ_PERMS.get(entity)
    if need and not _can(user, need):
        raise ForbiddenError(f"Tidak punya akses baca {entity}", code="INSUFFICIENT_PERMISSION")


def _mask(entity: str, doc: dict, user: dict) -> dict:
    if entity == "employees" and not _can(user, ("admin.master_data.manage", "hr.employee.read", "hr.payroll.read")):
        for k in _EMP_SENSITIVE:
            doc.pop(k, None)
    return doc


async def _coa_has_postings(db, coa_id: str) -> bool:
    return bool(await db.journal_entries.find_one({"lines.coa_id": coa_id, "deleted_at": None}, {"_id": 1}))


_SALARY_READERS = ("admin.master_data.manage", "hr.employee.read", "hr.payroll.read", "hr.advance.approve")
_EMP_STATUSES = ("active", "leave", "terminated")


def _clean_employee_payload(payload: dict) -> None:
    """CTL-10: pay lives only in Salary Master; employee form shows it read-only."""
    from services._hr_payroll.salary_master import LEGACY_EMPLOYEE_SALARY_FIELDS
    payload.pop("salary_summary", None)
    sent = [f for f in LEGACY_EMPLOYEE_SALARY_FIELDS if payload.get(f) not in (None, "", 0)]
    if sent:
        raise ValidationError("Gaji dikelola di Salary Master (HR → Payroll → Salary Master), bukan di data karyawan",
                              field=sent[0])
    for f in LEGACY_EMPLOYEE_SALARY_FIELDS:
        payload.pop(f, None)
    if "status" in payload and payload["status"] not in _EMP_STATUSES:
        raise ValidationError(f"Status karyawan tidak valid (pilih: {', '.join(_EMP_STATUSES)})", field="status")


async def _with_salary(entity: str, docs: list[dict], user: dict) -> list[dict]:
    if entity != "employees" or not docs or not _can(user, _SALARY_READERS):
        return docs
    from services._hr_payroll.salary_master import salary_summary_map
    summaries = await salary_summary_map([d["id"] for d in docs])
    for d in docs:
        d["salary_summary"] = summaries.get(d["id"])
    return docs


async def _check_employee_outlet(db, outlet_id, *, required: bool) -> None:
    """CTL-10: employees must belong to an existing outlet (per-outlet payroll & SC allocation)."""
    if not outlet_id:
        if required:
            raise ValidationError("Outlet wajib diisi untuk karyawan", field="outlet_id")
        return
    if not await db.outlets.find_one({"id": outlet_id, "deleted_at": None}, {"_id": 1}):
        raise ValidationError("Outlet tidak ditemukan", field="outlet_id")


def _get_entity(slug: str) -> dict:
    cfg = _ENTITIES.get(slug)
    if not cfg:
        raise NotFoundError(f"Entity '{slug}' not supported")
    return cfg


@router.get("/{entity}")
async def list_entity(
    entity: str,
    q: Optional[str] = None,
    active: Optional[bool] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=500),
    user: dict = Depends(current_user),
):
    """Master data list — readable by any authenticated user.
    Outlet managers etc. need to see vendors, items, GL accounts, etc."""
    cfg = _get_entity(entity)
    _guard_read(entity, user)
    db = get_db()
    query: dict = {"deleted_at": None}
    if active is not None:
        query["active"] = active
    if q:
        rx = {"$regex": re.escape(q), "$options": "i"}  # SEC-15
        name_field = _NAME_FIELDS.get(cfg["col"], "name")
        or_clauses = [{name_field: rx}]
        if cfg["uniq"]:
            or_clauses.append({cfg["uniq"]: rx})
        query["$or"] = or_clauses
    skip = (page - 1) * per_page
    sort_field = _NAME_FIELDS.get(cfg["col"], "name")
    cursor = db[cfg["col"]].find(query).sort(sort_field, 1).skip(skip).limit(per_page)
    items = await cursor.to_list(per_page)
    total = await db[cfg["col"]].count_documents(query)
    docs = await _with_salary(entity, [_mask(entity, serialize(d), user) for d in items], user)
    return ok_envelope(docs, {"page": page, "per_page": per_page, "total": total})


@router.get("/{entity}/{id_}")
async def get_entity(entity: str, id_: str,
                     user: dict = Depends(current_user)):
    """Master data detail — readable by any authenticated user."""
    cfg = _get_entity(entity)
    _guard_read(entity, user)
    db = get_db()
    d = await db[cfg["col"]].find_one({"id": id_, "deleted_at": None})
    if not d:
        raise NotFoundError(entity)
    return ok_envelope((await _with_salary(entity, [_mask(entity, serialize(d), user)], user))[0])


@router.post("/{entity}")
async def create_entity(entity: str, payload: dict,
                         user: dict = Depends(require_perm("admin.master_data.manage"))):
    cfg = _get_entity(entity)
    db = get_db()
    if entity == "employees":
        _clean_employee_payload(payload)
        await _check_employee_outlet(db, payload.get("outlet_id"), required=True)
        payload.setdefault("status", "active")
    if cfg["uniq"]:
        code = payload.get(cfg["uniq"])
        if not code:
            raise ValidationError(f"Field '{cfg['uniq']}' wajib diisi", field=cfg["uniq"])
        if await db[cfg["col"]].find_one({cfg["uniq"]: code, "deleted_at": None}):
            raise ConflictError(f"{cfg['uniq']} '{code}' sudah ada", field=cfg["uniq"])
    doc = dict(payload)
    doc["id"] = str(uuid.uuid4())
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    doc["updated_at"] = datetime.now(timezone.utc).isoformat()
    doc["deleted_at"] = None
    doc["created_by"] = user["id"]
    doc.setdefault("active", True)
    try:
        await db[cfg["col"]].insert_one(doc)
    except DuplicateKeyError as e:
        # Belt-and-suspenders: index might still be non-partial in older deployments
        raise ConflictError(
            f"Duplicate key on {cfg['col']}: {e.details.get('keyValue', {})}",
            field=cfg["uniq"],
        )
    await audit_log(user_id=user["id"], entity_type=cfg["col"], entity_id=doc["id"],
                    action="create", after=serialize(doc))
    return ok_envelope(serialize(doc))


@router.patch("/{entity}/{id_}")
async def update_entity(entity: str, id_: str, payload: dict,
                         user: dict = Depends(require_perm("admin.master_data.manage"))):
    cfg = _get_entity(entity)
    db = get_db()
    before = await db[cfg["col"]].find_one({"id": id_, "deleted_at": None})
    if not before:
        raise NotFoundError(entity)
    if entity == "employees":
        _clean_employee_payload(payload)
        if "outlet_id" in payload:
            await _check_employee_outlet(db, payload.get("outlet_id"), required=True)
    patch = dict(payload)
    # Don't allow id, audit, code uniqueness conflicts in patch
    for k in ("id", "created_at", "created_by", "deleted_at"):
        patch.pop(k, None)
    # CTL-09: number series counters are system-managed; COA type/normal_balance frozen after postings
    if entity == "number-series" and "*" not in (user.get("permissions") or []):
        raise ForbiddenError("Number series hanya bisa diubah SUPER_ADMIN")
    if entity == "number-series":
        for k in ("current", "counter", "next", "last_no", "seq"):
            if k in patch and float(patch[k] or 0) < float(before.get(k) or 0):
                raise ValidationError("Counter number series tidak boleh diturunkan (nomor dokumen bentrok)")
    if cfg["col"] == "chart_of_accounts" and await _coa_has_postings(db, id_):
        for k in ("type", "normal_balance", "category"):
            if k in patch and patch[k] != before.get(k):
                raise ValidationError(f"COA sudah punya jurnal — '{k}' tidak boleh diubah")
    if cfg["uniq"] and cfg["uniq"] in patch:
        new_code = patch[cfg["uniq"]]
        if new_code != before.get(cfg["uniq"]):
            if await db[cfg["col"]].find_one({cfg["uniq"]: new_code, "deleted_at": None, "id": {"$ne": id_}}):
                raise ConflictError(f"{cfg['uniq']} '{new_code}' sudah ada", field=cfg["uniq"])
    patch["updated_at"] = datetime.now(timezone.utc).isoformat()
    patch["updated_by"] = user["id"]
    after = await db[cfg["col"]].find_one_and_update({"id": id_}, {"$set": patch}, return_document=True)
    await audit_log(user_id=user["id"], entity_type=cfg["col"], entity_id=id_,
                    action="update", before=serialize(before), after=serialize(after))
    return ok_envelope(serialize(after))


@router.delete("/{entity}/{id_}")
async def delete_entity(entity: str, id_: str,
                          user: dict = Depends(require_perm("admin.master_data.manage"))):
    cfg = _get_entity(entity)
    db = get_db()
    if entity == "number-series":
        raise ForbiddenError("Number series tidak boleh dihapus")
    if cfg["col"] == "chart_of_accounts" and await _coa_has_postings(db, id_):
        raise ValidationError("COA sudah punya jurnal — nonaktifkan (active=false), jangan dihapus")
    res = await db[cfg["col"]].update_one(
        {"id": id_, "deleted_at": None},
        {"$set": {"deleted_at": datetime.now(timezone.utc).isoformat()}},
    )
    if not res.matched_count:
        raise NotFoundError(entity)
    await audit_log(user_id=user["id"], entity_type=cfg["col"], entity_id=id_, action="delete")
    return ok_envelope({"message": "Deleted"})


# Note: `/coa` alias endpoint was removed 2026-07-18 because it was shadowed by
# the parameterized `/{entity}` route above (FastAPI matches literal `/coa` to
# the parametric route with entity="coa"). The `_ENTITIES["coa"]` mapping still
# provides backward compatibility — GET /api/master/coa continues to work.

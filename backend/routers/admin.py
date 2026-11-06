"""/api/admin router — users, roles, audit log, permissions catalog, system settings."""
import re
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Body, Depends, Query
from pydantic import BaseModel, EmailStr, Field
from pymongo.errors import DuplicateKeyError

from core.audit import log as audit_log
from core.db import get_db, serialize
from core.exceptions import ConflictError, ForbiddenError, NotFoundError, ValidationError, ok_envelope
from core.perms_catalog import PERMISSIONS_CATALOG
from core.security import current_user, get_user_permissions, hash_password, require_perm
from core.validators import validate_password_strength
from repositories.base import Repo
from services import approval_service, business_rules_service

router = APIRouter(prefix="/api/admin", tags=["admin"])

users_repo = Repo("users")
roles_repo = Repo("roles")


# ---------- USERS ----------
class UserCreateIn(BaseModel):
    email: EmailStr
    full_name: str
    password: str = Field(min_length=8)
    role_ids: list[str] = []
    outlet_ids: list[str] = []
    brand_ids: list[str] = []
    phone: Optional[str] = None
    default_portal: Optional[str] = None
    default_outlet_id: Optional[str] = None
    status: str = "active"


class UserUpdateIn(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    role_ids: Optional[list[str]] = None
    outlet_ids: Optional[list[str]] = None
    brand_ids: Optional[list[str]] = None
    default_portal: Optional[str] = None
    default_outlet_id: Optional[str] = None
    status: Optional[str] = None
    avatar_url: Optional[str] = None


class PasswordResetIn(BaseModel):
    new_password: str = Field(min_length=8)


@router.get("/users")
async def list_users(
    q: Optional[str] = None,
    status: Optional[str] = None,
    role_id: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_perm("admin.user.read")),
):
    db = get_db()
    query: dict = {"deleted_at": None}
    if status:
        query["status"] = status
    if role_id:
        query["role_ids"] = role_id
    if q:
        rx = {"$regex": re.escape(q), "$options": "i"}
        query["$or"] = [{"full_name": rx}, {"email": rx}]
    skip = (page - 1) * per_page
    items = await db.users.find(query, {"password_hash": 0}).sort("created_at", -1).skip(skip).limit(per_page).to_list(per_page)
    total = await db.users.count_documents(query)
    return ok_envelope([serialize(u) for u in items], {"page": page, "per_page": per_page, "total": total})


async def _guard_assignment(actor: dict, target_id: Optional[str], role_ids: Optional[list], outlet_ids: Optional[list]) -> None:
    """SEC-09: validate role/outlet ids and block privilege escalation."""
    db = get_db()
    actor_perms = set(actor.get("permissions") or await get_user_permissions(actor))
    is_super = "*" in actor_perms
    if role_ids is not None:
        roles = await db.roles.find({"id": {"$in": role_ids}, "deleted_at": None}).to_list(None)
        if len(roles) != len(set(role_ids)):
            raise ValidationError("role_ids berisi role yang tidak ada", field="role_ids")
        if not is_super:
            if target_id == actor["id"]:
                raise ForbiddenError("Tidak boleh mengubah role milik sendiri", code="PRIVILEGE_ESCALATION")
            granted = set().union(*[set(r.get("permissions", [])) for r in roles]) if roles else set()
            if "*" in granted or not granted <= actor_perms:
                raise ForbiddenError("Tidak boleh memberi role dengan hak melebihi hak Anda", code="PRIVILEGE_ESCALATION")
    if outlet_ids:
        valid = await db.outlets.count_documents({"id": {"$in": [o for o in outlet_ids if o != "*"]}, "deleted_at": None})
        if valid != len({o for o in outlet_ids if o != "*"}) or ("*" in outlet_ids and not is_super):
            raise ValidationError("outlet_ids tidak valid", field="outlet_ids")


async def _guard_role_perms(actor: dict, perms: Optional[list]) -> None:
    if perms is None:
        return
    actor_perms = set(actor.get("permissions") or await get_user_permissions(actor))
    if "*" in actor_perms:
        return
    if "*" in perms or not set(perms) <= actor_perms:
        raise ForbiddenError("Role tidak boleh berisi permission melebihi hak Anda", code="PRIVILEGE_ESCALATION")


@router.post("/users")
async def create_user(payload: UserCreateIn, user: dict = Depends(require_perm("admin.user.create"))):
    db = get_db()
    await _guard_assignment(user, None, payload.role_ids, payload.outlet_ids)
    # A10 fix: SEC-006 — Validasi kekuatan password sebelum create
    validate_password_strength(payload.password, field="password")
    email = payload.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise ConflictError(f"Email '{email}' sudah terdaftar", field="email")
    doc = {
        "id": str(uuid.uuid4()),
        "email": email,
        "password_hash": hash_password(payload.password),
        "full_name": payload.full_name,
        "phone": payload.phone,
        "avatar_url": None,
        "status": payload.status,
        "role_ids": payload.role_ids,
        "outlet_ids": payload.outlet_ids,
        "brand_ids": payload.brand_ids,
        "default_portal": payload.default_portal,
        "default_outlet_id": payload.default_outlet_id,
        "last_login_at": None,
        "failed_login_count": 0,
        "locked_until": None,
        "mfa_enabled": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "deleted_at": None,
        "created_by": user["id"],
    }
    try:
        await db.users.insert_one(doc)
    except DuplicateKeyError as e:
        raise ConflictError(
            f"Email atau ID sudah ada: {e.details.get('keyValue', {})}",
            field="email",
        )
    await audit_log(user_id=user["id"], entity_type="user", entity_id=doc["id"], action="create", after=serialize(doc))
    res = serialize(doc)
    res.pop("password_hash", None)
    return ok_envelope(res)


@router.get("/users/{user_id}")
async def get_user(user_id: str, user: dict = Depends(require_perm("admin.user.read"))):
    db = get_db()
    u = await db.users.find_one({"id": user_id, "deleted_at": None}, {"password_hash": 0})
    if not u:
        raise NotFoundError("User")
    return ok_envelope(serialize(u))


@router.patch("/users/{user_id}")
async def update_user(user_id: str, payload: UserUpdateIn, user: dict = Depends(require_perm("admin.user.update"))):
    db = get_db()
    before = await db.users.find_one({"id": user_id, "deleted_at": None}, {"password_hash": 0})
    if not before:
        raise NotFoundError("User")
    patch = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    await _guard_assignment(user, user_id, patch.get("role_ids"), patch.get("outlet_ids"))
    # Special handling: allow clearing nullable fields
    for nullable_field in ("default_outlet_id", "default_portal", "avatar_url"):
        if payload.model_dump(exclude_unset=True).get(nullable_field) is None \
                and nullable_field in payload.model_fields_set:
            patch[nullable_field] = None
    if not patch:
        return ok_envelope(serialize(before))
    patch["updated_at"] = datetime.now(timezone.utc).isoformat()
    patch["updated_by"] = user["id"]
    after = await db.users.find_one_and_update(
        {"id": user_id}, {"$set": patch},
        return_document=True, projection={"password_hash": 0},
    )
    await audit_log(user_id=user["id"], entity_type="user", entity_id=user_id,
                    action="update", before=serialize(before), after=serialize(after))
    return ok_envelope(serialize(after))


@router.post("/users/{user_id}/reset-password")
async def reset_password(user_id: str, payload: PasswordResetIn,
                          user: dict = Depends(require_perm("admin.user.reset_password"))):
    db = get_db()
    u = await db.users.find_one({"id": user_id, "deleted_at": None})
    if not u:
        raise NotFoundError("User")
    # A10 fix: SEC-006 — Validasi kekuatan password saat reset
    validate_password_strength(payload.new_password, field="new_password")
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"password_hash": hash_password(payload.new_password),
                 "failed_login_count": 0, "locked_until": None,
                 "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    from services.auth_service import revoke_all_refresh_tokens
    await revoke_all_refresh_tokens(user_id)
    await audit_log(user_id=user["id"], entity_type="user", entity_id=user_id,
                    action="reset_password")
    return ok_envelope({"message": "Password reset"})


@router.delete("/users/{user_id}")
async def disable_user(user_id: str, user: dict = Depends(require_perm("admin.user.disable"))):
    db = get_db()
    if user_id == user["id"]:
        raise ValidationError("Tidak dapat menonaktifkan diri sendiri")
    res = await db.users.update_one(
        {"id": user_id, "deleted_at": None},
        {"$set": {"deleted_at": datetime.now(timezone.utc).isoformat(),
                 "status": "disabled",
                 "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    if not res.matched_count:
        raise NotFoundError("User")
    from services.auth_service import revoke_all_refresh_tokens
    await revoke_all_refresh_tokens(user_id)
    await audit_log(user_id=user["id"], entity_type="user", entity_id=user_id, action="disable")
    return ok_envelope({"message": "User disabled"})


# ---------- ROLES ----------
# Peran dapat dikonfigurasi penuh: peran bawaan (is_system) boleh diubah dan dikembalikan ke `default_permissions`;
# hanya peran Super Admin (berisi "*") yang terkunci. Tidak ada izin di luar katalog, tidak ada eskalasi melebihi hak
# pengubah, dan sistem tidak boleh kehilangan pemegang admin.role.manage terakhir (anti terkunci).
class RoleCreateIn(BaseModel):
    code: str
    name: str
    description: Optional[str] = None
    permissions: list[str] = []


class RoleUpdateIn(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    permissions: Optional[list[str]] = None


class RoleDuplicateIn(BaseModel):
    code: str
    name: str
    description: Optional[str] = None


_ROLE_CODE_RE = re.compile(r"^[A-Z][A-Z0-9_]{1,39}$")


def _is_locked(role: dict) -> bool:
    return "*" in (role.get("permissions") or [])


def _clean_perms(perms: list[str]) -> list[str]:
    from core.perms_registry import known_codes
    known = known_codes()
    out: list[str] = []
    bad = []
    for p in perms or []:
        p = str(p).strip()
        if not p or p in out:
            continue
        if p not in known:
            bad.append(p)
            continue
        out.append(p)
    if bad:
        raise ValidationError(f"Izin tidak dikenal: {', '.join(bad[:5])}", field="permissions")
    return out


async def _role_view(doc: dict, counts: Optional[dict] = None) -> dict:
    d = serialize(doc)
    if counts is None:
        db = get_db()
        d["user_count"] = await db.users.count_documents({"role_ids": d["id"], "deleted_at": None})
    else:
        d["user_count"] = counts.get(d["id"], 0)
    d["locked"] = _is_locked(d)
    default = d.get("default_permissions")
    d["has_default"] = default is not None
    d["modified"] = bool(default is not None and set(default) != set(d.get("permissions") or []))
    return d


async def _ensure_not_last_admin(role_id: str, new_perms: list[str]) -> None:
    """Tolak perubahan yang membuat tidak ada user aktif tersisa dengan admin.role.manage (atau *)."""
    if "admin.role.manage" in new_perms or "*" in new_perms:
        return
    db = get_db()
    holders = {r["id"] async for r in db.roles.find(
        {"deleted_at": None, "id": {"$ne": role_id}, "permissions": {"$in": ["admin.role.manage", "*"]}}, {"id": 1})}
    if holders and await db.users.count_documents({"role_ids": {"$in": list(holders)}, "deleted_at": None,
                                                   "status": {"$ne": "disabled"}}):
        return
    raise ValidationError("Perubahan ini membuat tidak ada lagi user yang bisa mengelola peran (admin.role.manage).",
                          code="LAST_ROLE_ADMIN", field="permissions")


@router.get("/roles")
async def list_roles(user: dict = Depends(require_perm("admin.role.manage"))):
    items, _ = await roles_repo.list({}, page=1, per_page=200, sort=[("name", 1)])
    db = get_db()
    counts = {}
    async for row in db.users.aggregate([{"$match": {"deleted_at": None}}, {"$unwind": "$role_ids"},
                                         {"$group": {"_id": "$role_ids", "n": {"$sum": 1}}}]):
        counts[row["_id"]] = row["n"]
    return ok_envelope([await _role_view(r, counts) for r in items])


@router.post("/roles")
async def create_role(payload: RoleCreateIn, user: dict = Depends(require_perm("admin.role.manage"))):
    db = get_db()
    code = payload.code.strip().upper()
    if not _ROLE_CODE_RE.match(code):
        raise ValidationError("Kode peran: huruf besar/angka/underscore, diawali huruf (mis. AREA_MANAGER)", field="code")
    perms = _clean_perms(payload.permissions)
    await _guard_role_perms(user, perms)
    if await db.roles.find_one({"code": code, "deleted_at": None}):
        raise ConflictError(f"Role code '{code}' sudah ada", field="code")
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": str(uuid.uuid4()), "code": code, "name": payload.name.strip(), "description": payload.description,
        "permissions": perms, "is_system": False, "created_at": now, "updated_at": now, "deleted_at": None,
        "created_by": user["id"],
    }
    try:
        await db.roles.insert_one(doc)
    except DuplicateKeyError as e:
        raise ConflictError(f"Role code sudah ada: {e.details.get('keyValue', {})}", field="code")
    await audit_log(user_id=user["id"], entity_type="role", entity_id=doc["id"], action="create", after=serialize(doc))
    return ok_envelope(await _role_view(doc))


@router.patch("/roles/{role_id}")
async def update_role(role_id: str, payload: RoleUpdateIn, user: dict = Depends(require_perm("admin.role.manage"))):
    db = get_db()
    before = await db.roles.find_one({"id": role_id, "deleted_at": None})
    if not before:
        raise NotFoundError("Role")
    if _is_locked(before):
        raise ValidationError("Peran Super Admin terkunci (akses penuh) dan tidak bisa diubah", code="ROLE_LOCKED")
    patch = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if "permissions" in patch:
        perms = _clean_perms(patch["permissions"])
        if "*" in perms:
            raise ValidationError("Akses penuh (*) hanya untuk peran Super Admin", field="permissions")
        # eskalasi dicek hanya untuk izin yang DITAMBAHKAN (mencabut izin yang tidak dimiliki pengubah tetap boleh)
        added = [p for p in perms if p not in (before.get("permissions") or [])]
        await _guard_role_perms(user, added)
        await _ensure_not_last_admin(role_id, perms)
        patch["permissions"] = perms
    if "name" in patch:
        patch["name"] = patch["name"].strip()
        if not patch["name"]:
            raise ValidationError("Nama peran wajib", field="name")
    patch["updated_at"] = datetime.now(timezone.utc).isoformat()
    patch["updated_by"] = user["id"]
    after = await db.roles.find_one_and_update({"id": role_id}, {"$set": patch}, return_document=True)
    await audit_log(user_id=user["id"], entity_type="role", entity_id=role_id,
                    action="update", before=serialize(before), after=serialize(after))
    return ok_envelope(await _role_view(after))


@router.post("/roles/{role_id}/reset")
async def reset_role(role_id: str, user: dict = Depends(require_perm("admin.role.manage"))):
    """Kembalikan peran bawaan ke izin default-nya."""
    db = get_db()
    before = await db.roles.find_one({"id": role_id, "deleted_at": None})
    if not before:
        raise NotFoundError("Role")
    if before.get("default_permissions") is None:
        raise ValidationError("Peran ini tidak punya izin bawaan (peran kustom)", code="NO_DEFAULT")
    if _is_locked(before):
        raise ValidationError("Peran Super Admin terkunci", code="ROLE_LOCKED")
    perms = list(before["default_permissions"])
    added = [p for p in perms if p not in (before.get("permissions") or [])]
    await _guard_role_perms(user, added)
    await _ensure_not_last_admin(role_id, perms)
    after = await db.roles.find_one_and_update(
        {"id": role_id}, {"$set": {"permissions": perms, "updated_at": datetime.now(timezone.utc).isoformat(),
                                   "updated_by": user["id"]}}, return_document=True)
    await audit_log(user_id=user["id"], entity_type="role", entity_id=role_id, action="reset",
                    before=serialize(before), after=serialize(after))
    return ok_envelope(await _role_view(after))


@router.post("/roles/{role_id}/duplicate")
async def duplicate_role(role_id: str, payload: RoleDuplicateIn, user: dict = Depends(require_perm("admin.role.manage"))):
    db = get_db()
    src = await db.roles.find_one({"id": role_id, "deleted_at": None})
    if not src:
        raise NotFoundError("Role")
    perms = [p for p in (src.get("permissions") or []) if p != "*"]
    return await create_role(RoleCreateIn(code=payload.code, name=payload.name,
                                          description=payload.description or src.get("description"),
                                          permissions=perms), user=user)


@router.get("/roles/{role_id}/users")
async def role_users(role_id: str, user: dict = Depends(require_perm("admin.role.manage"))):
    db = get_db()
    docs = await db.users.find({"role_ids": role_id, "deleted_at": None},
                               {"_id": 0, "id": 1, "full_name": 1, "email": 1, "status": 1}).sort("full_name", 1).to_list(500)
    return ok_envelope(docs)


@router.get("/roles/{role_id}/history")
async def role_history(role_id: str, limit: int = Query(30, ge=1, le=200),
                       user: dict = Depends(require_perm("admin.role.manage"))):
    """Riwayat perubahan peran: izin ditambah/dicabut per perubahan, siapa & kapan."""
    db = get_db()
    rows = await db.audit_log.find({"entity_type": "role", "entity_id": role_id}, {"_id": 0}) \
        .sort("timestamp", -1).limit(limit).to_list(limit)
    uids = list({r.get("user_id") for r in rows if r.get("user_id")})
    names = {u["id"]: u.get("full_name") or u.get("email") async for u in db.users.find({"id": {"$in": uids}}, {"id": 1, "full_name": 1, "email": 1})}
    out = []
    for r in rows:
        b = set(((r.get("before") or {}).get("permissions")) or [])
        a = set(((r.get("after") or {}).get("permissions")) or [])
        out.append({"id": r.get("id"), "action": r.get("action"), "timestamp": r.get("timestamp"),
                    "user_name": names.get(r.get("user_id")) or "(user tidak ditemukan)",
                    "added": sorted(a - b) if r.get("before") is not None else sorted(a),
                    "removed": sorted(b - a),
                    "renamed": (r.get("before") or {}).get("name") != (r.get("after") or {}).get("name") and r.get("before") is not None})
    return ok_envelope(out)


@router.delete("/roles/{role_id}")
async def delete_role(role_id: str, user: dict = Depends(require_perm("admin.role.manage"))):
    db = get_db()
    role = await db.roles.find_one({"id": role_id, "deleted_at": None})
    if not role:
        raise NotFoundError("Role")
    if role.get("is_system"):
        raise ValidationError("Peran bawaan tidak dapat dihapus (izinnya bisa diubah atau dikembalikan ke bawaan)")
    in_use = await db.users.count_documents({"role_ids": role_id, "deleted_at": None})
    if in_use:
        raise ValidationError(f"Role masih dipakai oleh {in_use} user")
    await db.roles.update_one({"id": role_id},
        {"$set": {"deleted_at": datetime.now(timezone.utc).isoformat()}})
    await audit_log(user_id=user["id"], entity_type="role", entity_id=role_id, action="delete", before=serialize(role))
    return ok_envelope({"message": "Role deleted"})


@router.get("/users/{user_id}/effective-permissions")
async def user_effective_permissions(user_id: str, user: dict = Depends(require_perm("admin.role.manage"))):
    """Izin efektif user = gabungan semua perannya, dengan asal peran per izin."""
    db = get_db()
    target = await db.users.find_one({"id": user_id, "deleted_at": None})
    if not target:
        raise NotFoundError("User")
    roles = await db.roles.find({"id": {"$in": target.get("role_ids") or []}, "deleted_at": None},
                                {"_id": 0, "id": 1, "name": 1, "permissions": 1}).to_list(50)
    src: dict[str, list[str]] = {}
    for r in roles:
        for p in r.get("permissions") or []:
            src.setdefault(p, []).append(r["name"])
    return ok_envelope({"user_id": user_id, "roles": [{"id": r["id"], "name": r["name"]} for r in roles],
                        "permissions": [{"code": k, "roles": v} for k, v in sorted(src.items())],
                        "full_access": "*" in src})


# ---------- PERMISSIONS CATALOG ----------
@router.get("/permissions")
async def permissions_catalog(grouped: bool = False, user: dict = Depends(current_user)):
    """Datar (kompatibel) atau `?grouped=true`: portal → modul → izin (label ID, aksi, sensitif, dependensi)."""
    if grouped:
        from core.perms_registry import grouped as _grouped
        return ok_envelope(_grouped())
    return ok_envelope(PERMISSIONS_CATALOG)


# ---------- AUDIT LOG ----------
@router.get("/audit-log")
async def list_audit_log(
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    user_id: Optional[str] = None,
    action: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    user: dict = Depends(require_perm("admin.audit_log.read")),
):
    db = get_db()
    query: dict = {}
    if entity_type:
        query["entity_type"] = entity_type
    if entity_id:
        query["entity_id"] = entity_id
    if user_id:
        query["user_id"] = user_id
    if action:
        query["action"] = action
    skip = (page - 1) * per_page
    items = await db.audit_log.find(query).sort("timestamp", -1).skip(skip).limit(per_page).to_list(per_page)
    total = await db.audit_log.count_documents(query)
    # Activity log showed only an 8-char user id; resolve names for the page in one query.
    uids = list({d.get("user_id") for d in items if d.get("user_id")})
    names = {u["id"]: u.get("full_name") or u.get("email") or ""
             async for u in db.users.find({"id": {"$in": uids}}, {"id": 1, "full_name": 1, "email": 1})}
    rows = [{**serialize(d), "user_name": names.get(d.get("user_id"), "")} for d in items]
    return ok_envelope(rows, {"page": page, "per_page": per_page, "total": total})


# ---------- BUSINESS RULES — APPROVAL WORKFLOWS + SELF-SERVICE CONFIG ----------
def _rule_perm(rule_type: Optional[str]) -> str:
    """approval_workflow continues using `admin.workflow.manage`.
    All other rule types use `admin.business_rules.manage`.
    """
    return "admin.workflow.manage" if (rule_type == "approval_workflow") else "admin.business_rules.manage"


@router.get("/business-rules")
async def list_business_rules(
    rule_type: Optional[str] = "approval_workflow",
    entity_type: Optional[str] = None,
    scope_type: Optional[str] = None,
    scope_id: Optional[str] = None,
    active: Optional[bool] = None,
    effective_on: Optional[str] = None,
    user: dict = Depends(current_user),
):
    # permission gating per rule_type (single endpoint, dual-perm dispatch)
    perms = await _user_perms(user)
    needed = _rule_perm(rule_type)
    if "*" not in perms and needed not in perms:
        from core.exceptions import ForbiddenError
        raise ForbiddenError(f"Missing permission: {needed}")

    db = get_db()
    q: dict = {"deleted_at": None}
    if rule_type:
        q["rule_type"] = rule_type
    if entity_type:
        q["rule_data.entity_type"] = entity_type
    if scope_type:
        q["scope_type"] = scope_type
    if scope_id:
        q["scope_id"] = scope_id
    if active is not None:
        q["active"] = bool(active)
    items = await db.business_rules.find(q, {
        "id": 1, "rule_type": 1, "scope_type": 1, "scope_id": 1,
        "active": 1, "version": 1, "effective_from": 1, "effective_to": 1,
        "rule_data": 1, "description": 1, "_id": 0,
    }).sort(
        [("scope_type", 1), ("scope_id", 1), ("rule_type", 1), ("active", -1), ("version", -1)]
    ).to_list(500)
    out = [serialize(d) for d in items]
    if effective_on:
        out = [
            r
            for r in out
            if (not r.get("effective_from") or r["effective_from"] <= effective_on)
            and (not r.get("effective_to") or r["effective_to"] >= effective_on)
        ]
    return ok_envelope(out)


@router.get("/business-rules/timeline")
async def business_rules_timeline(
    rule_type: Optional[str] = None,
    scope_type: Optional[str] = None,
    scope_id: Optional[str] = None,
    user: dict = Depends(current_user),
):
    """Return all versions for selected scope/rule_type with overlap flags.
    Mostly used by the configuration timeline page (non-approval rule types).
    """
    perms = await _user_perms(user)
    needed = _rule_perm(rule_type)
    if "*" not in perms and needed not in perms:
        from core.exceptions import ForbiddenError
        raise ForbiddenError(f"Missing permission: {needed}")
    rows = await business_rules_service.get_timeline(
        rule_type=rule_type, scope_type=scope_type, scope_id=scope_id
    )
    return ok_envelope(rows)


@router.get("/business-rules/{rule_id}")
async def get_business_rule(rule_id: str, user: dict = Depends(current_user)):
    db = get_db()
    doc = await db.business_rules.find_one({"id": rule_id, "deleted_at": None})
    if not doc:
        raise NotFoundError("Rule")
    perms = await _user_perms(user)
    needed = _rule_perm(doc.get("rule_type"))
    if "*" not in perms and needed not in perms:
        from core.exceptions import ForbiddenError
        raise ForbiddenError(f"Missing permission: {needed}")
    return ok_envelope(serialize(doc))


@router.post("/business-rules")
async def create_business_rule(payload: dict = Body(...),
                                user: dict = Depends(current_user)):
    rt = payload.get("rule_type", "approval_workflow")
    perms = await _user_perms(user)
    needed = _rule_perm(rt)
    if "*" not in perms and needed not in perms:
        from core.exceptions import ForbiddenError
        raise ForbiddenError(f"Missing permission: {needed}")

    if rt == "approval_workflow":
        return ok_envelope(await approval_service.create_workflow(payload, user=user))
    return ok_envelope(await business_rules_service.create_rule(payload, user=user))


@router.patch("/business-rules/{rule_id}")
async def update_business_rule(rule_id: str, payload: dict = Body(...),
                                user: dict = Depends(current_user)):
    db = get_db()
    existing = await db.business_rules.find_one({"id": rule_id, "deleted_at": None})
    if not existing:
        raise NotFoundError("Rule")
    rt = existing.get("rule_type")
    perms = await _user_perms(user)
    needed = _rule_perm(rt)
    if "*" not in perms and needed not in perms:
        from core.exceptions import ForbiddenError
        raise ForbiddenError(f"Missing permission: {needed}")

    if rt == "approval_workflow":
        return ok_envelope(await approval_service.update_workflow(rule_id, payload, user=user))
    return ok_envelope(await business_rules_service.update_rule(rule_id, payload, user=user))


@router.post("/business-rules/{rule_id}/duplicate")
async def duplicate_business_rule(rule_id: str, payload: dict = Body(default={}),
                                   user: dict = Depends(current_user)):
    db = get_db()
    existing = await db.business_rules.find_one({"id": rule_id, "deleted_at": None})
    if not existing:
        raise NotFoundError("Rule")
    rt = existing.get("rule_type")
    perms = await _user_perms(user)
    needed = _rule_perm(rt)
    if "*" not in perms and needed not in perms:
        from core.exceptions import ForbiddenError
        raise ForbiddenError(f"Missing permission: {needed}")
    if rt == "approval_workflow":
        raise ValidationError("Duplicate workflow saat ini didukung lewat halaman Workflow")
    return ok_envelope(await business_rules_service.duplicate_rule(rule_id, payload, user=user))


@router.post("/business-rules/{rule_id}/archive")
async def archive_business_rule(rule_id: str, user: dict = Depends(current_user)):
    db = get_db()
    existing = await db.business_rules.find_one({"id": rule_id, "deleted_at": None})
    if not existing:
        raise NotFoundError("Rule")
    rt = existing.get("rule_type")
    perms = await _user_perms(user)
    needed = _rule_perm(rt)
    if "*" not in perms and needed not in perms:
        from core.exceptions import ForbiddenError
        raise ForbiddenError(f"Missing permission: {needed}")
    if rt == "approval_workflow":
        # delegate to approval_service update path
        return ok_envelope(await approval_service.update_workflow(rule_id, {"active": False}, user=user))
    return ok_envelope(await business_rules_service.archive_rule(rule_id, user=user))


@router.post("/business-rules/{rule_id}/activate")
async def activate_business_rule(rule_id: str, user: dict = Depends(current_user)):
    db = get_db()
    existing = await db.business_rules.find_one({"id": rule_id, "deleted_at": None})
    if not existing:
        raise NotFoundError("Rule")
    rt = existing.get("rule_type")
    perms = await _user_perms(user)
    needed = _rule_perm(rt)
    if "*" not in perms and needed not in perms:
        from core.exceptions import ForbiddenError
        raise ForbiddenError(f"Missing permission: {needed}")
    if rt == "approval_workflow":
        return ok_envelope(await approval_service.update_workflow(rule_id, {"active": True}, user=user))
    return ok_envelope(await business_rules_service.activate_rule(rule_id, user=user))


@router.delete("/business-rules/{rule_id}")
async def delete_business_rule(rule_id: str, user: dict = Depends(current_user)):
    db = get_db()
    existing = await db.business_rules.find_one({"id": rule_id, "deleted_at": None})
    if not existing:
        raise NotFoundError("Rule")
    rt = existing.get("rule_type")
    perms = await _user_perms(user)
    needed = _rule_perm(rt)
    if "*" not in perms and needed not in perms:
        from core.exceptions import ForbiddenError
        raise ForbiddenError(f"Missing permission: {needed}")
    if rt == "approval_workflow":
        await approval_service.delete_workflow(rule_id, user=user)
    else:
        await business_rules_service.delete_rule(rule_id, user=user)
    return ok_envelope({"message": "Rule deleted"})


@router.post("/business-rules/seed-defaults")
async def seed_default_workflows(payload: dict = Body(default={}),
                                  user: dict = Depends(current_user)):
    """Seed defaults. By default (no `rule_type` in payload), seeds approval_workflow.
    Pass {"rule_type": "config"} to seed the 4 self-service config rule types.
    """
    rt = payload.get("rule_type") or "approval_workflow"
    perms = await _user_perms(user)
    needed = _rule_perm(rt if rt == "approval_workflow" else None)
    if "*" not in perms and needed not in perms:
        from core.exceptions import ForbiddenError
        raise ForbiddenError(f"Missing permission: {needed}")

    if rt == "approval_workflow":
        n = await approval_service.seed_defaults(user_id=user["id"], overwrite=bool(payload.get("overwrite", False)))
        return ok_envelope({"inserted": n, "kind": "approval_workflow"})
    if rt == "config":
        n = await business_rules_service.seed_defaults(user=user, overwrite=bool(payload.get("overwrite", False)))
        return ok_envelope({"inserted": n, "kind": "config"})
    raise ValidationError(f"rule_type tidak didukung untuk seed-defaults: {rt}")


@router.get("/approval-entity-types")
async def approval_entity_types(user: dict = Depends(require_perm("admin.workflow.manage"))):
    """All configurable entity types for approval workflow editor."""
    from services.approval_service import ENTITY_LABELS
    return ok_envelope([
        {"value": k, "label": v}
        for k, v in ENTITY_LABELS.items()
    ])
    return ok_envelope([
        {"value": "purchase_request",  "label": "Purchase Request (PR)"},
        {"value": "purchase_order",    "label": "Purchase Order (PO)"},
        {"value": "stock_adjustment",  "label": "Stock Adjustment"},
        {"value": "payment_request",   "label": "Payment Request (PAY)"},
        {"value": "employee_advance",  "label": "Employee Advance (EA)"},
    ])


@router.get("/configuration/rule-types")
async def list_config_rule_types(user: dict = Depends(require_perm("admin.business_rules.manage"))):
    """List of self-service configuration rule types managed via /admin/configuration/* UI."""
    return ok_envelope([
        {"value": rt, "label": label}
        for rt, label in business_rules_service.RULE_TYPE_LABELS.items()
    ])


# Helper used by perm dispatch ABOVE — defined late to access app context
async def _user_perms(user: dict) -> set[str]:
    from core.security import get_user_permissions
    return await get_user_permissions(user)

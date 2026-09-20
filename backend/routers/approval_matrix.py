"""Phase B — Approval Matrix global admin endpoints.

Visual workflow builder backend. Supports:
  - permission-based steps (legacy, default)
  - role-based steps (NEW)
  - specific-user-based steps (NEW)
  - tier conditions: outlet/brand filtering (NEW)

Endpoints:
  GET    /api/admin/approval-matrix/workflows                  list all workflows
  GET    /api/admin/approval-matrix/workflows/{entity_type}    get active workflow for entity
  POST   /api/admin/approval-matrix/workflows                  create/update (creates new version)
  DELETE /api/admin/approval-matrix/workflows/{workflow_id}    deactivate

  GET    /api/admin/approval-matrix/users                       searchable user list for builder
  GET    /api/admin/approval-matrix/roles                       searchable role list for builder
  GET    /api/admin/approval-matrix/permissions                 perm catalog for builder
  GET    /api/admin/approval-matrix/entity-types                supported entity types

  POST   /api/admin/approval-matrix/preview                     simulate workflow with sample entity
"""
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query, Body

from core.audit import log as audit_log
from core.db import get_db, serialize
from core.exceptions import NotFoundError, ValidationError, ok_envelope
from core.perms_catalog import PERMISSIONS_CATALOG
from core.security import require_perm
from services import approval_service

router = APIRouter(prefix="/api/admin/approval-matrix", tags=["approval-matrix"])


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ============================================================================
# Workflow CRUD
# ============================================================================


@router.get("/workflows")
async def list_workflows(user: dict = Depends(require_perm("admin.approval.read"))):
    """List one workflow row per entity_type (latest active version)."""
    out = []
    for et, label in approval_service.ENTITY_LABELS.items():
        wf = await approval_service.get_workflow(et)
        out.append({
            "entity_type": et,
            "entity_label": label,
            "workflow": wf,  # may be None
        })
    return ok_envelope({"items": out, "total": len(out)})


@router.get("/workflows/{entity_type}")
async def get_workflow(
    entity_type: str,
    user: dict = Depends(require_perm("admin.approval.read")),
):
    if entity_type not in approval_service.ENTITY_LABELS:
        raise ValidationError(f"Entity type tidak dikenal: {entity_type}")
    wf = await approval_service.get_workflow(entity_type)
    return ok_envelope({"entity_type": entity_type, "workflow": wf})


def _validate_step(step: dict, idx: int) -> None:
    mode = step.get("match_mode") or "permission"
    if mode not in ("permission", "role", "user"):
        raise ValidationError(f"Step {idx + 1}: match_mode harus permission/role/user")
    if mode == "permission":
        if not (step.get("any_of_perms") or []):
            raise ValidationError(f"Step {idx + 1}: permission mode butuh any_of_perms",
                                  field="any_of_perms")
    elif mode == "role":
        if not (step.get("any_of_role_ids") or []):
            raise ValidationError(f"Step {idx + 1}: role mode butuh any_of_role_ids",
                                  field="any_of_role_ids")
    elif mode == "user":
        if not (step.get("any_of_user_ids") or []):
            raise ValidationError(f"Step {idx + 1}: user mode butuh any_of_user_ids",
                                  field="any_of_user_ids")
    if not step.get("label"):
        raise ValidationError(f"Step {idx + 1}: label wajib", field="label")


def _validate_tier(tier: dict, idx: int) -> None:
    if "min_amount" not in tier:
        raise ValidationError(f"Tier {idx + 1}: min_amount wajib", field="min_amount")
    if not (tier.get("steps") or []):
        raise ValidationError(f"Tier {idx + 1}: minimal 1 step", field="steps")
    for s_idx, step in enumerate(tier["steps"]):
        _validate_step(step, s_idx)


async def _validate_workflow(payload: dict) -> None:
    if not payload.get("entity_type"):
        raise ValidationError("entity_type wajib", field="entity_type")
    if payload["entity_type"] not in approval_service.ENTITY_LABELS:
        raise ValidationError(f"Entity type tidak dikenal: {payload['entity_type']}",
                              field="entity_type")
    tiers = payload.get("tiers") or []
    if not tiers:
        raise ValidationError("Minimal 1 tier", field="tiers")
    for t_idx, t in enumerate(tiers):
        _validate_tier(t, t_idx)

    # Validate user/role/perm IDs actually exist
    db = get_db()
    # B10 fix: batch-lookup outlet + brand IDs from all tiers at once (was N+1 per tier)
    all_outlet_ids = list({uid for t in tiers for uid in (t.get("condition_outlet_ids") or [])})
    all_brand_ids  = list({bid for t in tiers for bid in (t.get("condition_brand_ids") or [])})
    existing_outlets = set()
    existing_brands  = set()
    if all_outlet_ids:
        ol_docs = await db.outlets.find({"id": {"$in": all_outlet_ids}}, {"id": 1, "_id": 0}).to_list(len(all_outlet_ids))
        existing_outlets = {d["id"] for d in ol_docs}
    if all_brand_ids:
        br_docs = await db.brands.find({"id": {"$in": all_brand_ids}}, {"id": 1, "_id": 0}).to_list(len(all_brand_ids))
        existing_brands = {d["id"] for d in br_docs}

    all_user_ids: set[str] = set()
    all_role_ids: set[str] = set()
    all_perms: set[str] = set()
    for t in tiers:
        # Conditions — use pre-loaded sets
        for uid in (t.get("condition_outlet_ids") or []):
            if uid not in existing_outlets:
                raise ValidationError(f"Outlet condition tidak ditemukan: {uid[:8]}")
        for bid in (t.get("condition_brand_ids") or []):
            if bid not in existing_brands:
                raise ValidationError(f"Brand condition tidak ditemukan: {bid[:8]}")
        for step in (t.get("steps") or []):
            for uid in (step.get("any_of_user_ids") or []):
                all_user_ids.add(uid)
            for rid in (step.get("any_of_role_ids") or []):
                all_role_ids.add(rid)
            for p in (step.get("any_of_perms") or []):
                all_perms.add(p)

    if all_user_ids:
        found = await db.users.count_documents({"id": {"$in": list(all_user_ids)}, "deleted_at": None})
        if found < len(all_user_ids):
            raise ValidationError("Ada user_id yang tidak valid / tidak aktif")
    if all_role_ids:
        found = await db.roles.count_documents({"id": {"$in": list(all_role_ids)}, "deleted_at": None})
        if found < len(all_role_ids):
            raise ValidationError("Ada role_id yang tidak valid")
    if all_perms:
        catalog = {p["code"] for p in PERMISSIONS_CATALOG}
        unknown = [p for p in all_perms if p not in catalog]
        if unknown:
            raise ValidationError(f"Permission tidak dikenal: {', '.join(unknown[:3])}")


@router.post("/workflows")
async def upsert_workflow(
    payload: dict = Body(...),
    user: dict = Depends(require_perm("admin.approval.write")),
):
    """Create a NEW version of the workflow for entity_type. Previous versions
    are deactivated. This preserves history.

    Body:
    {
      entity_type: str,
      amount_field: str?,
      tiers: [
        {
          min_amount: number,
          max_amount: number?,
          label: str,
          condition_outlet_ids: [str]?,
          condition_brand_ids: [str]?,
          steps: [
            {
              label: str,
              match_mode: "permission"|"role"|"user",
              any_of_perms: [str]?,
              any_of_role_ids: [str]?,
              any_of_user_ids: [str]?,
              deadline_hours: int?,
              escalation_to_perms: [str]?,
            }
          ]
        }
      ]
    }
    """
    await _validate_workflow(payload)
    db = get_db()
    et = payload["entity_type"]
    # Deactivate previous active rules for this entity
    await db.business_rules.update_many(
        {"rule_type": "approval_workflow", "rule_data.entity_type": et,
         "active": True, "deleted_at": None},
        {"$set": {"active": False, "updated_at": _now()}},
    )
    # Compute next version
    last = await db.business_rules.find_one(
        {"rule_type": "approval_workflow", "rule_data.entity_type": et},
        sort=[("version", -1)],
    )
    next_v = ((last or {}).get("version", 0) or 0) + 1

    doc = {
        "id": str(uuid.uuid4()),
        "rule_type": "approval_workflow",
        "name": payload.get("name") or f"Workflow {et} v{next_v}",
        "description": payload.get("description") or "",
        "active": True,
        "version": next_v,
        "rule_data": {
            "entity_type": et,
            "amount_field": payload.get("amount_field"),
            "tiers": payload.get("tiers") or [],
        },
        "created_at": _now(),
        "updated_at": _now(),
        "created_by": user["id"],
        "deleted_at": None,
    }
    await db.business_rules.insert_one(doc)
    await audit_log(user_id=user["id"], entity_type="approval_workflow",
                    entity_id=doc["id"], action="create")
    return ok_envelope(serialize(doc))


@router.delete("/workflows/{workflow_id}")
async def deactivate_workflow(
    workflow_id: str,
    user: dict = Depends(require_perm("admin.approval.write")),
):
    db = get_db()
    res = await db.business_rules.update_one(
        {"id": workflow_id, "deleted_at": None},
        {"$set": {"active": False, "updated_at": _now()}},
    )
    if res.matched_count == 0:
        raise NotFoundError("Workflow")
    await audit_log(user_id=user["id"], entity_type="approval_workflow",
                    entity_id=workflow_id, action="deactivate")
    return ok_envelope({"id": workflow_id, "active": False})


# ============================================================================
# Builder lookups (users / roles / perms / entity types)
# ============================================================================


@router.get("/users")
async def list_users_for_builder(
    q: Optional[str] = Query(None, description="search term (name/email)"),
    limit: int = Query(50, le=200),
    user: dict = Depends(require_perm("admin.approval.read")),
):
    db = get_db()
    query: dict = {"deleted_at": None, "status": "active"}
    if q:
        rx = {"$regex": q, "$options": "i"}
        query["$or"] = [{"full_name": rx}, {"email": rx}]
    items = []
    async for u in db.users.find(
        query,
        {"id": 1, "full_name": 1, "email": 1, "role_ids": 1, "outlet_ids": 1},
    ).sort("full_name", 1).limit(limit):
        items.append({
            "id": u["id"],
            "full_name": u.get("full_name") or u.get("email"),
            "email": u.get("email"),
            "role_ids": u.get("role_ids") or [],
            "outlet_ids": u.get("outlet_ids") or [],
        })
    return ok_envelope({"items": items, "total": len(items)})


@router.get("/roles")
async def list_roles_for_builder(
    user: dict = Depends(require_perm("admin.approval.read")),
):
    db = get_db()
    items = []
    async for r in db.roles.find(
        {"deleted_at": None},
        {"id": 1, "code": 1, "name": 1, "permissions": 1, "is_system": 1},
    ).sort("name", 1):
        items.append({
            "id": r["id"],
            "code": r.get("code"),
            "name": r.get("name"),
            "is_system": r.get("is_system", False),
            "perm_count": len(r.get("permissions") or []),
        })
    return ok_envelope({"items": items, "total": len(items)})


@router.get("/permissions")
async def list_perms_for_builder(
    user: dict = Depends(require_perm("admin.approval.read")),
):
    return ok_envelope({"items": PERMISSIONS_CATALOG})


@router.get("/entity-types")
async def list_entity_types(
    user: dict = Depends(require_perm("admin.approval.read")),
):
    items = []
    for et, label in approval_service.ENTITY_LABELS.items():
        wf = await approval_service.get_workflow(et)
        items.append({
            "value": et, "label": label,
            "has_workflow": wf is not None,
            "version": (wf or {}).get("version"),
        })
    return ok_envelope({"items": items})


# ============================================================================
# Preview simulator
# ============================================================================


@router.post("/preview")
async def preview_workflow(
    payload: dict = Body(...),
    user: dict = Depends(require_perm("admin.approval.read")),
):
    """Simulate which tier + which approvers would be selected for a sample entity.

    Body:
      { entity_type, sample: { amount, outlet_id?, brand_id? } }
    Returns:
      { tier, steps_resolved: [{label, mode, approvers: [...]}] }
    """
    et = payload.get("entity_type")
    sample = payload.get("sample") or {}
    if et not in approval_service.ENTITY_LABELS:
        raise ValidationError(f"Entity type tidak dikenal: {et}")
    wf = await approval_service.get_workflow(et)
    if not wf:
        return ok_envelope({"has_workflow": False})
    amount = float(sample.get("amount", 0) or 0)
    fake_entity = {
        "outlet_id": sample.get("outlet_id"),
        "brand_id": sample.get("brand_id"),
    }
    tier = approval_service._tier_for_amount(wf, amount, entity=fake_entity)
    if not tier:
        return ok_envelope({"has_workflow": True, "tier": None, "amount": amount})

    async def _resolve(step):
        approvers = await approval_service._resolve_eligible_approvers(
            step, outlet_id=sample.get("outlet_id"),
        )
        return [
            {"id": a["id"], "full_name": a.get("full_name"), "outlet_ids": a.get("outlet_ids") or []}
            for a in approvers
        ]

    steps_resolved = []
    for step in (tier.get("steps") or []):
        mode = step.get("match_mode") or "permission"
        resolved = await _resolve(step)
        steps_resolved.append({
            "label": step.get("label"),
            "match_mode": mode,
            "deadline_hours": step.get("deadline_hours"),
            "any_of_perms": step.get("any_of_perms"),
            "any_of_role_ids": step.get("any_of_role_ids"),
            "any_of_user_ids": step.get("any_of_user_ids"),
            "approvers": resolved,
            "approvers_count": len(resolved),
        })

    return ok_envelope({
        "has_workflow": True,
        "amount": amount,
        "tier": {
            "label": tier.get("label"),
            "min_amount": tier.get("min_amount"),
            "max_amount": tier.get("max_amount"),
            "condition_outlet_ids": tier.get("condition_outlet_ids") or [],
            "condition_brand_ids": tier.get("condition_brand_ids") or [],
        },
        "steps_resolved": steps_resolved,
    })

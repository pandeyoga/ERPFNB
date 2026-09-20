"""Workflow CRUD + default workflow seeder."""
import uuid
from typing import Optional

from core.audit import log as audit_log
from core.db import get_db, serialize
from core.exceptions import NotFoundError, ValidationError

from services._approval.constants import (
    DEFAULT_WORKFLOWS,
    ENTITY_COLLECTIONS,
    _now,
)


async def get_workflow(entity_type: str) -> Optional[dict]:
    """Return the active approval_workflow rule for the entity_type, or None.
    Latest version wins.
    """
    db = get_db()
    doc = await db.business_rules.find_one(
        {
            "deleted_at": None, "active": True,
            "rule_type": "approval_workflow",
            "rule_data.entity_type": entity_type,
        },
        sort=[("version", -1), ("updated_at", -1)],
    )
    return serialize(doc) if doc else None


async def list_workflows(*, entity_type: Optional[str] = None) -> list[dict]:
    db = get_db()
    q: dict = {"deleted_at": None, "rule_type": "approval_workflow"}
    if entity_type:
        q["rule_data.entity_type"] = entity_type
    items = await db.business_rules.find(q).sort([("rule_data.entity_type", 1), ("version", -1)]).to_list(200)
    return [serialize(d) for d in items]


async def create_workflow(payload: dict, *, user: dict) -> dict:
    db = get_db()
    rule_data = payload.get("rule_data") or {}
    if not rule_data.get("entity_type"):
        raise ValidationError("rule_data.entity_type wajib", field="rule_data.entity_type")
    if rule_data["entity_type"] not in ENTITY_COLLECTIONS:
        raise ValidationError(
            f"entity_type tidak didukung. Pilihan: {','.join(ENTITY_COLLECTIONS)}",
            field="rule_data.entity_type",
        )
    tiers = rule_data.get("tiers") or []
    if not tiers:
        raise ValidationError("rule_data.tiers minimal 1", field="rule_data.tiers")
    for t in tiers:
        if not (t.get("steps") or []):
            raise ValidationError("Setiap tier harus punya steps", field="rule_data.tiers")
    # Soft-archive any active workflow for the same entity_type
    await db.business_rules.update_many(
        {
            "rule_type": "approval_workflow",
            "rule_data.entity_type": rule_data["entity_type"],
            "active": True, "deleted_at": None,
        },
        {"$set": {"active": False, "updated_at": _now()}},
    )
    doc = {
        "id": str(uuid.uuid4()),
        "scope_type": payload.get("scope_type", "group"),
        "scope_id": payload.get("scope_id", "*"),
        "rule_type": "approval_workflow",
        "rule_data": rule_data,
        "active": True,
        "version": int(payload.get("version", 1)),
        "effective_from": payload.get("effective_from"),
        "effective_to": payload.get("effective_to"),
        "created_at": _now(), "updated_at": _now(), "deleted_at": None,
        "created_by": user["id"],
    }
    await db.business_rules.insert_one(doc)
    await audit_log(user_id=user["id"], entity_type="business_rule",
                    entity_id=doc["id"], action="create", after=serialize(doc))
    return serialize(doc)


async def update_workflow(rule_id: str, patch: dict, *, user: dict) -> dict:
    db = get_db()
    before = await db.business_rules.find_one({"id": rule_id, "deleted_at": None})
    if not before:
        raise NotFoundError("Rule")
    update = {k: v for k, v in patch.items() if v is not None}
    update["updated_at"] = _now()
    update["version"] = int(before.get("version", 1)) + 1
    await db.business_rules.update_one({"id": rule_id}, {"$set": update})
    after = await db.business_rules.find_one({"id": rule_id})
    await audit_log(user_id=user["id"], entity_type="business_rule",
                    entity_id=rule_id, action="update",
                    before=serialize(before), after=serialize(after))
    return serialize(after)


async def delete_workflow(rule_id: str, *, user: dict) -> None:
    db = get_db()
    before = await db.business_rules.find_one({"id": rule_id, "deleted_at": None})
    if not before:
        raise NotFoundError("Rule")
    await db.business_rules.update_one(
        {"id": rule_id},
        {"$set": {"deleted_at": _now(), "active": False, "updated_at": _now()}},
    )
    await audit_log(user_id=user["id"], entity_type="business_rule",
                    entity_id=rule_id, action="delete", before=serialize(before))


async def seed_defaults(*, user_id: str = "system", overwrite: bool = False) -> int:
    """Seed default approval workflows. Returns count inserted."""
    db = get_db()
    inserted = 0
    for entity_type, rule_data in DEFAULT_WORKFLOWS.items():
        existing = await db.business_rules.find_one({
            "rule_type": "approval_workflow",
            "rule_data.entity_type": entity_type,
            "deleted_at": None,
        })
        if existing and not overwrite:
            continue
        if existing and overwrite:
            await db.business_rules.update_one(
                {"id": existing["id"]},
                {"$set": {"active": False, "deleted_at": _now(), "updated_at": _now()}},
            )
        doc = {
            "id": str(uuid.uuid4()),
            "scope_type": "group",
            "scope_id": "*",
            "rule_type": "approval_workflow",
            "rule_data": rule_data,
            "active": True,
            "version": 1,
            "effective_from": None,
            "effective_to": None,
            "created_at": _now(), "updated_at": _now(), "deleted_at": None,
            "created_by": user_id,
        }
        await db.business_rules.insert_one(doc)
        inserted += 1
    return inserted

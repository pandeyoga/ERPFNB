"""Create/update/duplicate/archive/activate/delete for business rules."""
from __future__ import annotations

import uuid
from typing import Any

from core.audit import log as audit_log
from core.db import get_db, serialize
from core.exceptions import NotFoundError

from services._business_rules._common import RULE_TYPE_LABELS, _now
from services._business_rules.overlaps import detect_overlaps
from services._business_rules.query import get_rule
from services._business_rules.validation import (
    _validate_dates,
    _validate_rule_data,
    _validate_rule_type,
    _validate_scope,
)


async def _next_version(*, scope_type: str, scope_id: str, rule_type: str) -> int:
    db = get_db()
    doc = await db.business_rules.find_one(
        {
            "deleted_at": None,
            "scope_type": scope_type,
            "scope_id": scope_id,
            "rule_type": rule_type,
        },
        sort=[("version", -1)],
    )
    return int((doc or {}).get("version", 0)) + 1


async def create_rule(payload: dict, *, user: dict) -> dict:
    db = get_db()
    rule_type = payload.get("rule_type")
    scope_type = payload.get("scope_type") or "group"
    scope_id = payload.get("scope_id") or "*"
    rule_data = payload.get("rule_data") or {}
    effective_from = payload.get("effective_from")
    effective_to = payload.get("effective_to")
    active = payload.get("active", True)

    _validate_rule_type(rule_type)
    _validate_scope(scope_type, scope_id)
    _validate_dates(effective_from, effective_to)
    _validate_rule_data(rule_type, rule_data)

    version = int(payload.get("version") or await _next_version(
        scope_type=scope_type, scope_id=scope_id, rule_type=rule_type
    ))

    overlaps: list[dict] = []
    if active:
        overlaps = await detect_overlaps(
            rule_type=rule_type,
            scope_type=scope_type,
            scope_id=scope_id,
            effective_from=effective_from,
            effective_to=effective_to,
        )

    doc = {
        "id": str(uuid.uuid4()),
        "scope_type": scope_type,
        "scope_id": scope_id,
        "rule_type": rule_type,
        "rule_data": rule_data,
        "active": bool(active),
        "version": version,
        "effective_from": effective_from,
        "effective_to": effective_to,
        "name": payload.get("name") or RULE_TYPE_LABELS.get(rule_type, rule_type),
        "description": payload.get("description"),
        "created_at": _now(),
        "updated_at": _now(),
        "deleted_at": None,
        "created_by": user["id"],
        "updated_by": user["id"],
    }
    await db.business_rules.insert_one(doc)
    await audit_log(
        user_id=user["id"],
        entity_type="business_rule",
        entity_id=doc["id"],
        action="create",
        after=serialize(doc),
    )
    out = serialize(doc)
    out["overlaps_with"] = [o["id"] for o in overlaps]
    return out


async def update_rule(rule_id: str, patch: dict, *, user: dict) -> dict:
    db = get_db()
    before = await db.business_rules.find_one({"id": rule_id, "deleted_at": None})
    if not before:
        raise NotFoundError("Rule")

    rule_type = patch.get("rule_type", before.get("rule_type"))
    _validate_rule_type(rule_type)

    scope_type = patch.get("scope_type", before.get("scope_type"))
    scope_id = patch.get("scope_id", before.get("scope_id"))
    _validate_scope(scope_type, scope_id)

    effective_from = patch.get("effective_from", before.get("effective_from"))
    effective_to = patch.get("effective_to", before.get("effective_to"))
    _validate_dates(effective_from, effective_to)

    rule_data = patch.get("rule_data", before.get("rule_data") or {})
    _validate_rule_data(rule_type, rule_data)

    update: dict[str, Any] = {
        "scope_type": scope_type,
        "scope_id": scope_id,
        "rule_type": rule_type,
        "rule_data": rule_data,
        "active": bool(patch.get("active", before.get("active", True))),
        "effective_from": effective_from,
        "effective_to": effective_to,
        "updated_at": _now(),
        "updated_by": user["id"],
    }
    if "name" in patch:
        update["name"] = patch["name"]
    if "description" in patch:
        update["description"] = patch["description"]

    await db.business_rules.update_one({"id": rule_id}, {"$set": update})
    after = await db.business_rules.find_one({"id": rule_id})
    await audit_log(
        user_id=user["id"],
        entity_type="business_rule",
        entity_id=rule_id,
        action="update",
        before=serialize(before),
        after=serialize(after),
    )
    out = serialize(after)
    if out.get("active"):
        overlaps = await detect_overlaps(
            rule_type=rule_type,
            scope_type=scope_type,
            scope_id=scope_id,
            effective_from=effective_from,
            effective_to=effective_to,
            exclude_id=rule_id,
        )
        out["overlaps_with"] = [o["id"] for o in overlaps]
    return out


async def duplicate_rule(rule_id: str, overrides: dict, *, user: dict) -> dict:
    """Create a new draft version cloned from an existing rule.
    Caller can override scope, effective dates, or rule_data. By default new copy
    starts as active=False (draft) so it can be reviewed before scheduling.
    """
    src = await get_rule(rule_id)
    payload = {
        "rule_type": overrides.get("rule_type", src["rule_type"]),
        "scope_type": overrides.get("scope_type", src.get("scope_type")),
        "scope_id": overrides.get("scope_id", src.get("scope_id")),
        "rule_data": overrides.get("rule_data", src.get("rule_data") or {}),
        "effective_from": overrides.get("effective_from"),
        "effective_to": overrides.get("effective_to"),
        "active": bool(overrides.get("active", False)),
        "name": overrides.get("name") or (src.get("name") or "") + " (Salinan)",
        "description": overrides.get("description") or src.get("description"),
    }
    return await create_rule(payload, user=user)


async def archive_rule(rule_id: str, *, user: dict) -> dict:
    db = get_db()
    before = await db.business_rules.find_one({"id": rule_id, "deleted_at": None})
    if not before:
        raise NotFoundError("Rule")
    await db.business_rules.update_one(
        {"id": rule_id},
        {"$set": {"active": False, "updated_at": _now(), "updated_by": user["id"]}},
    )
    after = await db.business_rules.find_one({"id": rule_id})
    await audit_log(
        user_id=user["id"],
        entity_type="business_rule",
        entity_id=rule_id,
        action="archive",
        before=serialize(before),
        after=serialize(after),
    )
    return serialize(after)


async def activate_rule(rule_id: str, *, user: dict) -> dict:
    db = get_db()
    before = await db.business_rules.find_one({"id": rule_id, "deleted_at": None})
    if not before:
        raise NotFoundError("Rule")
    await db.business_rules.update_one(
        {"id": rule_id},
        {"$set": {"active": True, "updated_at": _now(), "updated_by": user["id"]}},
    )
    after = await db.business_rules.find_one({"id": rule_id})
    await audit_log(
        user_id=user["id"],
        entity_type="business_rule",
        entity_id=rule_id,
        action="activate",
        before=serialize(before),
        after=serialize(after),
    )
    out = serialize(after)
    overlaps = await detect_overlaps(
        rule_type=after["rule_type"],
        scope_type=after.get("scope_type"),
        scope_id=after.get("scope_id"),
        effective_from=after.get("effective_from"),
        effective_to=after.get("effective_to"),
        exclude_id=rule_id,
    )
    out["overlaps_with"] = [o["id"] for o in overlaps]
    return out


async def delete_rule(rule_id: str, *, user: dict) -> None:
    db = get_db()
    before = await db.business_rules.find_one({"id": rule_id, "deleted_at": None})
    if not before:
        raise NotFoundError("Rule")
    await db.business_rules.update_one(
        {"id": rule_id},
        {"$set": {"deleted_at": _now(), "active": False, "updated_at": _now()}},
    )
    await audit_log(
        user_id=user["id"],
        entity_type="business_rule",
        entity_id=rule_id,
        action="delete",
        before=serialize(before),
    )

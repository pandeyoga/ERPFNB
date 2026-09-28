"""AR Customer CRUD."""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

from core.db import get_db, serialize
from models.ar import make_ar_customer

logger = logging.getLogger("aurora.ar")


async def create_customer(payload: dict, *, user_id: str) -> dict:
    from core.exceptions import ValidationError as ValidationErr
    db = get_db()
    if not payload.get("name"):
        raise ValidationErr("name wajib diisi")
    doc = make_ar_customer(
        name=payload["name"],
        channel=payload.get("channel", "b2b"),
        npwp=payload.get("npwp"),
        address=payload.get("address"),
        contact_person=payload.get("contact_person"),
        phone=payload.get("phone"),
        email=payload.get("email"),
        credit_terms_days=int(payload.get("credit_terms_days", 30) or 30),
        notes=payload.get("notes"),
        created_by=user_id,
    )
    await db.ar_customers.insert_one(doc)
    return serialize(doc)


async def list_customers() -> list[dict]:
    db = get_db()
    items = await db.ar_customers.find({"deleted_at": None, "is_active": True}).sort("name", 1).to_list(200)
    return [serialize(i) for i in items]


async def update_customer(customer_id: str, payload: dict, *, user_id: str) -> Optional[dict]:
    db = get_db()
    allowed = ["name", "channel", "npwp", "address", "contact_person", "phone", "email", "credit_terms_days", "notes"]
    upd = {k: v for k, v in payload.items() if k in allowed}
    upd["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.ar_customers.update_one({"id": customer_id}, {"$set": upd})
    doc = await db.ar_customers.find_one({"id": customer_id})
    return serialize(doc) if doc else None

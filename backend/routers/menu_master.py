"""/api/menu/items — master menu ERP (per brand) + alias nama per sumber (POS, GoFood, …).

Dipakai untuk mencocokkan baris item penjualan hasil impor ke menu yang sama walau namanya berbeda antar sumber, dan
siap disambung ke resep/BOM. Item yang dibuat otomatis dari impor bertanda needs_review.
"""
import re
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Body, Depends, Query

from core.audit import log as audit_log
from core.db import get_db
from core.exceptions import NotFoundError, ValidationError, ok_envelope
from core.security import require_perm

router = APIRouter(prefix="/api/menu", tags=["menu-master"])
BUCKETS = ("food", "beverage", "other")


def _norm(s) -> str:
    return re.sub(r"[^a-z0-9]+", " ", str(s or "").lower()).strip()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


@router.get("/items")
async def list_items(brand_id: Optional[str] = Query(None), q: Optional[str] = Query(None),
                     needs_review: Optional[bool] = Query(None), limit: int = Query(500, ge=1, le=2000),
                     user: dict = Depends(require_perm("menu.item.read"))):
    flt: dict = {"deleted_at": None}
    if brand_id:
        flt["brand_id"] = brand_id
    if needs_review is not None:
        flt["needs_review"] = needs_review
    if q:
        flt["$or"] = [{"name_norm": {"$regex": re.escape(_norm(q))}}, {"aliases.name_norm": {"$regex": re.escape(_norm(q))}}]
    rows = await get_db().menu_items.find(flt, {"_id": 0}).sort("name", 1).limit(limit).to_list(limit)
    return ok_envelope(rows)


@router.post("/items")
async def create_item(payload: dict = Body(...), user: dict = Depends(require_perm("menu.item.manage"))):
    """{brand_id, name, category?, bucket?: food|beverage|other, price?, aliases?: [nama lain]}"""
    name = str(payload.get("name") or "").strip()
    if not name or not payload.get("brand_id"):
        raise ValidationError("brand_id dan name wajib diisi")
    db = get_db()
    if await db.menu_items.find_one({"brand_id": payload["brand_id"], "name_norm": _norm(name), "deleted_at": None}):
        raise ValidationError(f"Menu '{name}' sudah ada di brand ini")
    bucket = payload.get("bucket") or "food"
    if bucket not in BUCKETS:
        raise ValidationError("bucket harus food / beverage / other")
    doc = {"id": str(uuid.uuid4()), "brand_id": payload["brand_id"], "name": name, "name_norm": _norm(name),
           "category": payload.get("category"), "bucket": bucket, "price": payload.get("price"), "active": True,
           "aliases": [{"source": "manual", "name": a, "name_norm": _norm(a)} for a in payload.get("aliases") or [] if str(a).strip()],
           "origin": "manual", "needs_review": False, "created_at": _now(), "created_by": user["id"], "deleted_at": None}
    await db.menu_items.insert_one(doc)
    doc.pop("_id", None)
    await audit_log(user_id=user["id"], entity_type="menu_item", entity_id=doc["id"], action="create", after={"name": name})
    return ok_envelope(doc)


@router.patch("/items/{item_id}")
async def update_item(item_id: str, payload: dict = Body(...), user: dict = Depends(require_perm("menu.item.manage"))):
    """{name?, category?, bucket?, price?, active?, needs_review?, add_aliases?: [..], remove_aliases?: [..]}"""
    db = get_db()
    cur = await db.menu_items.find_one({"id": item_id, "deleted_at": None}, {"_id": 0})
    if not cur:
        raise NotFoundError("Menu")
    upd: dict = {"updated_at": _now(), "updated_by": user["id"]}
    for k in ("category", "price", "active", "needs_review"):
        if k in payload:
            upd[k] = payload[k]
    if "bucket" in payload:
        if payload["bucket"] not in BUCKETS:
            raise ValidationError("bucket harus food / beverage / other")
        upd["bucket"] = payload["bucket"]
    if payload.get("name"):
        upd["name"], upd["name_norm"] = str(payload["name"]).strip(), _norm(payload["name"])
    aliases = [a for a in cur.get("aliases") or [] if a.get("name_norm") not in {_norm(x) for x in payload.get("remove_aliases") or []}]
    for a in payload.get("add_aliases") or []:
        if _norm(a) and _norm(a) not in {x.get("name_norm") for x in aliases}:
            aliases.append({"source": "manual", "name": str(a).strip(), "name_norm": _norm(a)})
    upd["aliases"] = aliases
    await db.menu_items.update_one({"id": item_id}, {"$set": upd})
    await audit_log(user_id=user["id"], entity_type="menu_item", entity_id=item_id, action="update",
                    before={k: cur.get(k) for k in upd if k in cur}, after=upd)
    return ok_envelope({**cur, **upd})


@router.post("/items/{item_id}/merge")
async def merge_items(item_id: str, payload: dict = Body(...), user: dict = Depends(require_perm("menu.item.manage"))):
    """Gabungkan menu duplikat ke item ini: {source_ids: [..]} — nama & alias sumber jadi alias, baris penjualan dipindah."""
    db = get_db()
    target = await db.menu_items.find_one({"id": item_id, "deleted_at": None}, {"_id": 0})
    if not target:
        raise NotFoundError("Menu")
    ids = [i for i in payload.get("source_ids") or [] if i != item_id]
    aliases = list(target.get("aliases") or [])
    seen = {a.get("name_norm") for a in aliases} | {target["name_norm"]}
    merged = 0
    async for src in db.menu_items.find({"id": {"$in": ids}, "deleted_at": None}, {"_id": 0}):
        for a in [{"source": "gabung", "name": src["name"], "name_norm": src["name_norm"]}, *(src.get("aliases") or [])]:
            if a.get("name_norm") not in seen:
                aliases.append(a)
                seen.add(a.get("name_norm"))
        await db.sales_lines.update_many({"menu_item_id": src["id"]}, {"$set": {"menu_item_id": item_id}})
        await db.menu_items.update_one({"id": src["id"]}, {"$set": {"deleted_at": _now(), "merged_into": item_id}})
        merged += 1
    await db.menu_items.update_one({"id": item_id}, {"$set": {"aliases": aliases, "updated_at": _now()}})
    await audit_log(user_id=user["id"], entity_type="menu_item", entity_id=item_id, action="merge", after={"source_ids": ids})
    return ok_envelope({"merged": merged, "aliases": len(aliases)})


@router.delete("/items/{item_id}")
async def delete_item(item_id: str, user: dict = Depends(require_perm("menu.item.manage"))):
    r = await get_db().menu_items.update_one({"id": item_id, "deleted_at": None}, {"$set": {"deleted_at": _now()}})
    if not r.matched_count:
        raise NotFoundError("Menu")
    await audit_log(user_id=user["id"], entity_type="menu_item", entity_id=item_id, action="delete")
    return ok_envelope({"deleted": True})

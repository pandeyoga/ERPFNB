"""Emergent object storage client (replaces pod-local uploads)."""
import asyncio
import logging
import os
import uuid
from datetime import datetime, timezone

import requests

logger = logging.getLogger("aurora.storage")

STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
APP_NAME = "aurora-erpfnb"
PUBLIC_PREFIX = f"{APP_NAME}/public/"
_storage_key = None


def init_storage(force: bool = False) -> str:
    global _storage_key
    if _storage_key and not force:
        return _storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": os.environ.get("EMERGENT_LLM_KEY")}, timeout=30)
    resp.raise_for_status()
    _storage_key = resp.json()["storage_key"]
    return _storage_key


def _request(method: str, path: str, **kw) -> requests.Response:
    for attempt in (0, 1):
        resp = requests.request(method, f"{STORAGE_URL}/objects/{path}",
                                headers={"X-Storage-Key": init_storage(force=attempt == 1), **kw.pop("headers", {})},
                                timeout=120, **kw)
        if resp.status_code != 404 or attempt == 1 or method == "GET":
            break
    resp.raise_for_status()
    return resp


def _put_sync(path: str, data: bytes, content_type: str) -> dict:
    return _request("PUT", path, headers={"Content-Type": content_type}, data=data).json()


def _get_sync(path: str) -> tuple[bytes, str]:
    resp = _request("GET", path)
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


async def put_object(path: str, data: bytes, content_type: str) -> dict:
    return await asyncio.to_thread(_put_sync, path, data, content_type or "application/octet-stream")


async def get_object(path: str) -> tuple[bytes, str]:
    return await asyncio.to_thread(_get_sync, path)


async def store_public(data: bytes, *, folder: str, ext: str, content_type: str,
                       original_filename: str | None = None, name: str | None = None) -> str:
    """Upload a publicly-served asset (CMS/menu/loyalty images). Returns the API URL."""
    from core.db import get_db
    ext = ext if ext.startswith(".") else f".{ext}"
    path = f"{PUBLIC_PREFIX}{folder}/{name or uuid.uuid4()}{ext}"
    result = await put_object(path, data, content_type)
    await get_db().files.insert_one({
        "id": str(uuid.uuid4()), "storage_path": result["path"], "original_filename": original_filename,
        "content_type": content_type, "size": result.get("size", len(data)), "is_deleted": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return f"/api/files/{result['path']}"

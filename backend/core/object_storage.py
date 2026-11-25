"""Penyimpanan objek untuk upload (lampiran, foto struk, gambar CMS/menu/loyalty).

Backend dipilih lewat setting `STORAGE_BACKEND` (Admin → Integrations; DB > env):

- `local` (default): disk server di `UPLOAD_DIR` (default `<backend>/uploads`). Pastikan folder ini volume persisten.
- `s3`: S3-compatible (AWS S3, Cloudflare R2, MinIO, …) — `S3_BUCKET`, `S3_ENDPOINT_URL`, `S3_REGION`,
  `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`; butuh paket `boto3`.

Dulu memakai object storage Emergent (`integrations.emergentagent.com` + `EMERGENT_LLM_KEY`), yang tidak tersedia di
luar platform Emergent sehingga semua upload gagal. Antarmuka (`put_object`, `get_object`, `store_public`,
`init_storage`) tetap sama.
"""
from __future__ import annotations

import asyncio
import logging
import mimetypes
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

logger = logging.getLogger("aurora.storage")

APP_NAME = "aurora-erpfnb"
PUBLIC_PREFIX = f"{APP_NAME}/public/"
DEFAULT_UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads"


async def _setting(key: str, default: str | None = None) -> str | None:
    try:
        from core.runtime_config import get_setting
        return await get_setting(key, default=default)
    except Exception:  # noqa: BLE001 — DB belum siap (mis. saat startup): pakai env
        return os.environ.get(key) or default


async def _backend() -> str:
    return ((await _setting("STORAGE_BACKEND", "local")) or "local").strip().lower()


async def _local_root() -> Path:
    return Path((await _setting("UPLOAD_DIR")) or DEFAULT_UPLOAD_DIR)


def _safe_rel(path: str) -> str:
    p = Path(path)
    if p.is_absolute() or ".." in p.parts or not path:
        raise ValueError("Path penyimpanan tidak valid")
    return p.as_posix()


# ---------------- local disk ----------------

def _local_put(root: Path, path: str, data: bytes) -> dict:
    dest = root / _safe_rel(path)
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_name(dest.name + ".tmp")
    tmp.write_bytes(data)
    tmp.replace(dest)  # atomik: tidak ada file setengah jadi
    return {"path": path, "size": len(data)}


def _local_get(root: Path, path: str) -> tuple[bytes, str]:
    src = root / _safe_rel(path)
    if not src.exists():
        from core.exceptions import NotFoundError
        raise NotFoundError("File")
    return src.read_bytes(), mimetypes.guess_type(src.name)[0] or "application/octet-stream"


# ---------------- S3-compatible ----------------

_s3_client = None
_s3_sig = None


async def _s3():
    global _s3_client, _s3_sig
    cfg = {k: await _setting(k) for k in ("S3_BUCKET", "S3_ENDPOINT_URL", "S3_REGION", "S3_ACCESS_KEY_ID",
                                          "S3_SECRET_ACCESS_KEY")}
    if not cfg["S3_BUCKET"]:
        raise RuntimeError("STORAGE_BACKEND=s3 tetapi S3_BUCKET belum diisi")
    sig = tuple(cfg.values())
    if _s3_client is None or sig != _s3_sig:
        try:
            import boto3  # type: ignore
        except ImportError as e:  # pragma: no cover
            raise RuntimeError("STORAGE_BACKEND=s3 butuh paket boto3 (pip install boto3)") from e
        _s3_client = boto3.client(
            "s3", endpoint_url=cfg["S3_ENDPOINT_URL"] or None, region_name=cfg["S3_REGION"] or None,
            aws_access_key_id=cfg["S3_ACCESS_KEY_ID"] or None, aws_secret_access_key=cfg["S3_SECRET_ACCESS_KEY"] or None)
        _s3_sig = sig
    return _s3_client, cfg["S3_BUCKET"]


# ---------------- API ----------------

def init_storage(force: bool = False) -> str:
    """Dipanggil saat startup: siapkan folder lokal. (S3 divalidasi saat dipakai.)"""
    backend = (os.environ.get("STORAGE_BACKEND") or "local").strip().lower()
    if backend == "local":
        root = Path(os.environ.get("UPLOAD_DIR") or DEFAULT_UPLOAD_DIR)
        root.mkdir(parents=True, exist_ok=True)
        return str(root)
    return backend


async def put_object(path: str, data: bytes, content_type: str) -> dict:
    if await _backend() == "s3":
        client, bucket = await _s3()
        await asyncio.to_thread(client.put_object, Bucket=bucket, Key=_safe_rel(path), Body=data,
                                ContentType=content_type or "application/octet-stream")
        return {"path": path, "size": len(data)}
    return await asyncio.to_thread(_local_put, await _local_root(), path, data)


async def get_object(path: str) -> tuple[bytes, str]:
    if await _backend() == "s3":
        client, bucket = await _s3()
        try:
            obj = await asyncio.to_thread(client.get_object, Bucket=bucket, Key=_safe_rel(path))
        except Exception as e:  # noqa: BLE001
            from core.exceptions import NotFoundError
            raise NotFoundError("File") from e
        body = await asyncio.to_thread(obj["Body"].read)
        return body, obj.get("ContentType") or "application/octet-stream"
    return await asyncio.to_thread(_local_get, await _local_root(), path)


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

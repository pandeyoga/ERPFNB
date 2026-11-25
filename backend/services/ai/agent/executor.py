"""Menjalankan aksi katalog lewat API ERP SENDIRI, sebagai pengguna yang meminta/menyetujui.

Dipanggil in-process (httpx + ASGITransport, tanpa jaringan) dengan token akses berumur pendek milik pengguna,
sehingga semua aturan route berlaku persis seperti di layar: izin, scope brand/toko, validasi, approval matrix,
periode tutup buku, audit. Respons JSON dikembalikan apa adanya (diringkas untuk model); respons file (Excel/PDF/CSV)
disimpan sebagai file agen dan dikembalikan sebagai tautan unduh.
"""
from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Optional
from urllib.parse import quote

import httpx

from core.db import get_db
from core.security import create_access_token

from .catalog import Op

logger = logging.getLogger("aurora.ai.agent")

_APP = None
MAX_ROWS_TO_MODEL = 40
MAX_CHARS_TO_MODEL = 24_000


def set_app(app) -> None:
    global _APP
    _APP = app


def get_app():
    global _APP
    if _APP is None:  # mis. dari skrip/tes yang tidak lewat lifespan server
        from server import app
        _APP = app
    return _APP


class ActionError(Exception):
    def __init__(self, status: int, message: str, detail: Any = None):
        super().__init__(message)
        self.status, self.detail = status, detail


def _resolve_path(op: Op, path_params: dict) -> str:
    path = op.path
    for p in op.path_params:
        name = p["name"]
        if name not in path_params or path_params[name] in (None, ""):
            raise ActionError(400, f"Parameter path '{name}' wajib diisi")
        path = path.replace("{" + name + "}", quote(str(path_params[name]), safe=""))
    return path


async def call(op: Op, user: dict, *, path_params: Optional[dict] = None, query: Optional[dict] = None,
               body: Any = None, scope: Optional[dict] = None, idempotency_key: Optional[str] = None) -> dict:
    """Panggil endpoint. Mengembalikan {"status", "data"|"file"|"error"}; tidak melempar kecuali path invalid."""
    path = _resolve_path(op, path_params or {})
    q = {k: v for k, v in (query or {}).items() if v not in (None, "")}
    # Konteks Brand/Toko dari TopNav — sama seperti lib/api.js: GET membawa brand_id/outlet_id bila belum diisi
    if op.method == "GET" and scope:
        for k in ("brand_id", "outlet_id"):
            if scope.get(k) and k not in q and any(p["name"] == k for p in op.query_params):
                q[k] = scope[k]
    token = create_access_token(user["id"], {"email": user.get("email"), "name": user.get("full_name"),
                                             "via": "ai_agent"})
    headers = {"Authorization": f"Bearer {token}", "X-Request-ID": str(uuid.uuid4()), "X-AI-Agent": "1"}
    if idempotency_key:
        headers["Idempotency-Key"] = idempotency_key
    transport = httpx.ASGITransport(app=get_app())
    async with httpx.AsyncClient(transport=transport, base_url="http://erp.internal", timeout=180.0) as client:
        resp = await client.request(op.method, path, params=q or None, headers=headers,
                                    json=body if op.method in ("POST", "PUT", "PATCH", "DELETE") and body is not None else None)
    ct = resp.headers.get("content-type", "")
    if "application/json" in ct:
        try:
            payload = resp.json()
        except ValueError:
            payload = {"raw": resp.text[:2000]}
        if resp.status_code >= 400 or (isinstance(payload, dict) and payload.get("success") is False):
            errs = (payload or {}).get("errors") if isinstance(payload, dict) else None
            msg = "; ".join(f"{e.get('field') + ': ' if e.get('field') else ''}{e.get('message')}" for e in errs or []) \
                or f"HTTP {resp.status_code}"
            return {"status": resp.status_code, "error": msg, "errors": errs}
        data = payload.get("data") if isinstance(payload, dict) and "success" in payload else payload
        meta = payload.get("meta") if isinstance(payload, dict) else None
        return {"status": resp.status_code, "data": data, "meta": meta}
    if resp.status_code >= 400:
        return {"status": resp.status_code, "error": resp.text[:500] or f"HTTP {resp.status_code}"}
    # respons file (ekspor Excel/PDF/CSV) → simpan sebagai file agen
    fname = _filename(resp.headers.get("content-disposition"), op, ct)
    f = await save_file(resp.content, filename=fname, content_type=ct or "application/octet-stream", user=user,
                        source=f"{op.method} {path}")
    return {"status": resp.status_code, "file": f}


def _filename(cd: Optional[str], op: Op, ct: str) -> str:
    if cd and "filename=" in cd:
        return cd.split("filename=")[-1].strip('"; ')
    ext = {"application/pdf": ".pdf", "text/csv": ".csv"}.get(ct.split(";")[0], ".xlsx" if "sheet" in ct else ".bin")
    return f"{op.id}{ext}"


async def save_file(data: bytes, *, filename: str, content_type: str, user: dict, source: str) -> dict:
    """Simpan file hasil agen (laporan/ekspor) → bisa diunduh pemilik lewat /api/ai/agent/files/{id}."""
    from core.object_storage import APP_NAME, put_object
    fid = str(uuid.uuid4())
    safe = "".join(c if c.isalnum() or c in "._- " else "_" for c in filename)[:120] or "file"
    stored = await put_object(f"{APP_NAME}/private/ai/{datetime.now(timezone.utc):%Y-%m}/{fid}-{safe}", data, content_type)
    doc = {"id": fid, "user_id": user["id"], "filename": safe, "content_type": content_type, "size": len(data),
           "storage_path": stored["path"], "source": source, "created_at": datetime.now(timezone.utc).isoformat()}
    await get_db().ai_files.insert_one(doc)
    return {"file_id": fid, "filename": safe, "content_type": content_type, "size": len(data),
            "url": f"/api/ai/agent/files/{fid}"}


def compact_for_model(result: dict) -> str:
    """Ringkas hasil untuk konteks model: list panjang dipotong, total baris disebut."""
    if "error" in result:
        return json.dumps({"gagal": True, "status": result["status"], "pesan": result["error"],
                           "rincian": result.get("errors")}, ensure_ascii=False, default=str)[:4000]
    if "file" in result:
        return json.dumps({"file": result["file"], "catatan": "File siap diunduh pengguna; sebutkan tautannya."},
                          ensure_ascii=False)
    data = result.get("data")
    note = {}
    if isinstance(data, list) and len(data) > MAX_ROWS_TO_MODEL:
        note = {"total_baris": len(data), "ditampilkan": MAX_ROWS_TO_MODEL,
                "catatan": "Data dipotong; pakai filter/query lebih spesifik atau simpan ke tabel analisis."}
        data = data[:MAX_ROWS_TO_MODEL]
    out = {"data": data}
    if result.get("meta"):
        out["meta"] = result["meta"]
    if note:
        out["potong"] = note
    s = json.dumps(out, ensure_ascii=False, default=str)
    if len(s) > MAX_CHARS_TO_MODEL:
        s = s[:MAX_CHARS_TO_MODEL] + ' …"[terpotong: hasil terlalu besar, persempit filter]"'
    return s

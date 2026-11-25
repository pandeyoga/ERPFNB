"""Perlindungan data pribadi untuk Asisten AI (kesiapan UU PDP No. 27/2022).

- **Samarkan PII** (kebijakan `mask_pii`): data yang dikirim ke model (hasil aksi baca & query data) disamarkan —
  telepon, email, NIK/KTP, NPWP, nomor rekening, alamat — berdasarkan nama field dan pola teks. Angka bisnis tetap.
- **Retensi** (kebijakan `retention_days`): percakapan, run, file hasil AI, dan log pesan WhatsApp yang lebih lama
  dari N hari dihapus terjadwal (job harian `ai_retention`). Memori & dokumen pengetahuan tidak ikut (dikelola manual).
- **Hak subjek data**: pengguna bisa mengunduh & menghapus data AI miliknya (percakapan, memori pribadi, file).
"""
from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone
from typing import Any

from core.db import get_db

PII_KEYS = re.compile(r"(phone|telp|telepon|hp|mobile|whatsapp|wa_number|email|e_mail|nik|ktp|npwp|bank_account|account_number|"
                      r"rekening|no_rek|iban|address|alamat|birth|tanggal_lahir|ibu_kandung|passport|bpjs)", re.I)
_EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.]+")
_PHONE = re.compile(r"(?<!\d)(?:\+?62|0)8\d{7,11}(?!\d)")
_NIK = re.compile(r"(?<!\d)\d{16}(?!\d)")
_NPWP = re.compile(r"\b\d{2}\.\d{3}\.\d{3}\.\d-\d{3}\.\d{3}\b")
_SAFE_KEYS = {"phone_verified", "email_verified", "has_email"}


def _mask_str(s: str) -> str:
    s = _EMAIL.sub(lambda m: m.group(0)[0] + "***@***", s)
    s = _NPWP.sub("**.***.***.*-***.***", s)
    s = _NIK.sub(lambda m: m.group(0)[:4] + "*" * 12, s)
    return _PHONE.sub(lambda m: m.group(0)[:4] + "****" + m.group(0)[-2:], s)


def _mask_value(v: Any) -> Any:
    if v in (None, "", [], {}):
        return v
    if isinstance(v, (int, float)):
        return "***"
    if isinstance(v, str):
        return (v[:2] + "***") if len(v) > 4 else "***"
    return "***"


def mask(obj: Any, _depth: int = 0) -> Any:
    """Salinan obj dengan PII disamarkan (rekursif)."""
    if _depth > 12:
        return obj
    if isinstance(obj, dict):
        return {k: (_mask_value(v) if (isinstance(k, str) and PII_KEYS.search(k) and k not in _SAFE_KEYS
                                       and not isinstance(v, (dict, list, bool))) else mask(v, _depth + 1))
                for k, v in obj.items()}
    if isinstance(obj, list):
        return [mask(x, _depth + 1) for x in obj]
    if isinstance(obj, str):
        return _mask_str(obj)
    return obj


async def enabled() -> bool:
    from services.ai import client as ai_client
    return bool((await ai_client.get_policy()).get("mask_pii"))


async def apply_retention(days: int | None = None) -> dict:
    """Hapus data AI lebih lama dari `days` (default dari kebijakan). None/0 = simpan selamanya."""
    from services.ai import client as ai_client
    days = days if days is not None else (await ai_client.get_policy()).get("retention_days")
    if not days:
        return {"aktif": False}
    cut = (datetime.now(timezone.utc) - timedelta(days=int(days))).isoformat()
    db = get_db()
    out = {"aktif": True, "batas": cut[:10]}
    out["percakapan"] = (await db.ai_sessions.delete_many({"updated_at": {"$lt": cut}})).deleted_count
    out["run"] = (await db.ai_runs.delete_many({"created_at": {"$lt": cut}})).deleted_count
    old_files = await db.ai_files.find({"created_at": {"$lt": cut}}, {"_id": 0, "id": 1, "storage_path": 1}).to_list(5000)
    for f in old_files:
        try:
            from core.object_storage import delete_object
            await delete_object(f["storage_path"])
        except Exception:  # noqa: BLE001 — objek mungkin sudah hilang / storage tanpa delete
            pass
    out["file"] = (await db.ai_files.delete_many({"id": {"$in": [f["id"] for f in old_files]}})).deleted_count
    out["pesan_wa"] = (await db.wa_messages.delete_many({"created_at": {"$lt": cut}})).deleted_count
    out["riwayat_otomasi"] = (await db.ai_automation_runs.delete_many({"started_at": {"$lt": cut}})).deleted_count
    return out


async def export_my_data(user: dict) -> dict:
    db = get_db()
    sessions = await db.ai_sessions.find({"user_id": user["id"], "deleted_at": None},
                                         {"_id": 0, "id": 1, "title": 1, "channel": 1, "created_at": 1, "display": 1}).to_list(2000)
    return {"dibuat": datetime.now(timezone.utc).isoformat(), "user_id": user["id"],
            "percakapan": sessions,
            "memori_pribadi": await db.ai_memories.find({"user_id": user["id"], "scope": "pribadi", "deleted_at": None}, {"_id": 0}).to_list(1000),
            "file": await db.ai_files.find({"user_id": user["id"], "deleted_at": None}, {"_id": 0, "storage_path": 0}).to_list(2000),
            "usulan_aksi": await db.ai_actions.find({"user_id": user["id"]}, {"_id": 0, "id": 1, "title": 1, "status": 1,
                                                                             "method": 1, "path": 1, "created_at": 1}).to_list(5000),
            "umpan_balik": await db.ai_feedback.find({"user_id": user["id"]}, {"_id": 0}).to_list(2000),
            "otomasi": await db.ai_automations.find({"owner_id": user["id"], "deleted_at": None}, {"_id": 0}).to_list(500),
            "whatsapp": await db.wa_links.find({"user_id": user["id"]}, {"_id": 0, "pin_hash": 0, "code_hash": 0}).to_list(20)}


async def delete_my_data(user: dict) -> dict:
    """Hapus percakapan, memori pribadi, file, umpan balik & riwayat pesan WA milik pengguna. Jejak audit usulan aksi
    (ai_actions) disimpan karena bagian dari catatan transaksi perusahaan."""
    db = get_db()
    uid = user["id"]
    now = datetime.now(timezone.utc).isoformat()
    out = {"percakapan": (await db.ai_sessions.delete_many({"user_id": uid})).deleted_count,
           "run": (await db.ai_runs.delete_many({"user_id": uid})).deleted_count,
           "memori": (await db.ai_memories.update_many({"user_id": uid, "scope": "pribadi", "deleted_at": None},
                                                       {"$set": {"deleted_at": now}})).modified_count,
           "file": (await db.ai_files.update_many({"user_id": uid, "deleted_at": None}, {"$set": {"deleted_at": now}})).modified_count,
           "umpan_balik": (await db.ai_feedback.delete_many({"user_id": uid})).deleted_count}
    links = [x["id"] async for x in db.wa_links.find({"user_id": uid}, {"id": 1})]
    out["pesan_wa"] = (await db.wa_messages.delete_many({"link_id": {"$in": links}})).deleted_count if links else 0
    from core.audit import log as audit_log
    await audit_log(user_id=uid, entity_type="ai_privacy", entity_id=uid, action="delete_my_data", after=out)
    return out

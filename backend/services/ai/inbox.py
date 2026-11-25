"""Kotak masuk email Asisten AI (opsional): email khusus dokumen (invoice & price list supplier, ekspor POS/GoFood,
mutasi bank) dibaca lewat IMAP tiap 10 menit → lampiran disimpan sebagai attachment milik pemilik kotak masuk →
daftar di layar Kotak Masuk dengan tebakan jenis dokumen → "Proses dengan AI" membuka Asisten AI dengan lampirannya.

Tidak ada yang dibukukan otomatis: pemrosesan tetap lewat Asisten AI + persetujuan. Setting: INBOX_IMAP_HOST,
INBOX_IMAP_USER, INBOX_IMAP_PASSWORD, INBOX_IMAP_FOLDER, INBOX_OWNER_EMAIL. Isi email = DATA, bukan perintah.
"""
from __future__ import annotations

import asyncio
import email
import imaplib
import logging
import re
import uuid
from datetime import datetime, timezone
from email.header import decode_header, make_header
from email.utils import parseaddr, parsedate_to_datetime
from typing import Optional

from core.db import get_db
from core.exceptions import ForbiddenError, NotFoundError
from core.runtime_config import get_setting

logger = logging.getLogger("aurora.ai.inbox")
MAX_FETCH = 30
DOC_TYPES = [
    ("price_list", r"price ?list|daftar harga|pricelist|penawaran|quotation"),
    ("mutasi_bank", r"mutasi|rekening koran|e-?statement|bank statement|\b(bca|mandiri|bni|bri)\b"),
    ("invoice", r"invoice|faktur|tagihan|\bnota\b|kwitansi|receipt|struk"),
    ("ekspor_penjualan", r"gofood|grabfood|shopeefood|\btransaksi\b|\bsales report\b|penjualan|\bpos\b|moka|majoo|\besb\b|pawoon"),
]
PROMPTS = {
    "mutasi_bank": "Ini mutasi bank dari kotak masuk. Buat sesi rekonsiliasi / impor dan jelaskan yang belum cocok.",
    "ekspor_penjualan": "Ini ekspor penjualan dari kotak masuk. Pratinjau dengan Impor Cerdas, cek duplikasi per hari, lalu usulkan impor.",
    "price_list": "Ini price list supplier dari kotak masuk. Analisis vs harga lama, pasar & supplier lain; beri rekomendasi & draf negosiasi.",
    "invoice": "Ini invoice/struk dari kotak masuk. Baca, cocokkan dengan PO/GR bila ada, dan usulkan jurnal/hutang yang sesuai.",
    "lainnya": "Ini dokumen dari kotak masuk. Jelaskan isinya dan apa yang perlu dilakukan di ERP.",
}


def _dec(s: Optional[str]) -> str:
    try:
        return str(make_header(decode_header(s or "")))
    except Exception:  # noqa: BLE001
        return s or ""


def guess_type(subject: str, filenames: list[str], sender: str = "") -> str:
    """Subjek & nama file lebih menentukan daripada alamat pengirim (mis. sales@supplier mengirim price list)."""
    for hay in (" ".join([subject, *filenames]).lower(), (sender or "").lower()):
        for t, rx in DOC_TYPES:
            if re.search(rx, hay):
                return t
    return "lainnya"


def parse_message(raw: bytes) -> dict:
    msg = email.message_from_bytes(raw)
    atts, body = [], ""
    for part in msg.walk():
        if part.is_multipart():
            continue
        fn = part.get_filename()
        ct = (part.get_content_type() or "").lower()
        if fn:
            data = part.get_payload(decode=True) or b""
            if data:
                atts.append({"filename": _dec(fn)[:200], "content_type": ct, "data": data})
        elif ct == "text/plain" and not body:
            body = (part.get_payload(decode=True) or b"").decode(part.get_content_charset() or "utf-8", "ignore")
    try:
        date = parsedate_to_datetime(msg.get("Date")).astimezone(timezone.utc).isoformat()
    except Exception:  # noqa: BLE001
        date = datetime.now(timezone.utc).isoformat()
    return {"message_id": (msg.get("Message-ID") or "").strip() or str(uuid.uuid4()), "from": parseaddr(msg.get("From") or "")[1],
            "from_name": _dec(parseaddr(msg.get("From") or "")[0]), "subject": _dec(msg.get("Subject"))[:300],
            "date": date, "body": body.strip()[:3000], "attachments": atts}


def _fetch_unseen(host: str, user: str, password: str, folder: str) -> list[bytes]:
    out = []
    m = imaplib.IMAP4_SSL(host, timeout=60)
    try:
        m.login(user, password)
        m.select(folder or "INBOX")
        typ, data = m.search(None, "UNSEEN")
        ids = (data[0] or b"").split()[:MAX_FETCH] if typ == "OK" else []
        for i in ids:
            typ, msg = m.fetch(i, "(RFC822)")       # menandai terbaca (\\Seen)
            if typ == "OK" and msg and isinstance(msg[0], tuple):
                out.append(msg[0][1])
    finally:
        try:
            m.logout()
        except Exception:  # noqa: BLE001
            pass
    return out


async def _owner() -> Optional[dict]:
    from services.wa_bot.service import _load_user
    em = (await get_setting("INBOX_OWNER_EMAIL") or "").strip().lower()
    if not em:
        return None
    u = await get_db().users.find_one({"email": em, "deleted_at": None}, {"_id": 0, "id": 1})
    return await _load_user(u["id"]) if u else None


async def ingest(raw_messages: list[bytes], owner: dict) -> int:
    from services import notification_service, upload_service
    db = get_db()
    n = 0
    for raw in raw_messages:
        p = parse_message(raw)
        if await db.ai_inbox_items.find_one({"message_id": p["message_id"], "owner_id": owner["id"]}):
            continue
        saved, skipped = [], []
        for a in p["attachments"][:10]:
            try:
                att = await upload_service.save_upload(file_bytes=a["data"], filename=a["filename"], content_type=a["content_type"],
                                                       user=owner, category="general", source_type="ai_inbox")
                saved.append({"attachment_id": att["id"], "filename": a["filename"], "content_type": a["content_type"]})
            except Exception as e:  # noqa: BLE001 — jenis file tidak didukung / terlalu besar
                skipped.append(f"{a['filename']}: {str(e)[:80]}")
        doc_type = guess_type(p["subject"], [a["filename"] for a in saved], p["from"])
        item = {"id": str(uuid.uuid4()), "owner_id": owner["id"], "message_id": p["message_id"], "from": p["from"],
                "from_name": p["from_name"], "subject": p["subject"], "received_at": p["date"], "body": p["body"],
                "attachments": saved, "skipped": skipped, "doc_type": doc_type, "status": "baru",
                "created_at": datetime.now(timezone.utc).isoformat()}
        await db.ai_inbox_items.insert_one(item)
        n += 1
        if saved:
            await notification_service.push(user_id=owner["id"], type="ai_inbox", title=f"Dokumen masuk: {p['subject'][:80]}",
                                            body=f"{len(saved)} lampiran dari {p['from']}", link="/ai/inbox",
                                            source_type="ai_inbox", source_id=item["id"])
    return n


async def poll() -> int:
    host = await get_setting("INBOX_IMAP_HOST")
    if not host:
        return 0
    owner = await _owner()
    if not owner:
        logger.warning("kotak masuk AI: INBOX_OWNER_EMAIL belum diisi / akun tidak aktif")
        return 0
    raws = await asyncio.to_thread(_fetch_unseen, host, await get_setting("INBOX_IMAP_USER") or "",
                                   await get_setting("INBOX_IMAP_PASSWORD") or "", await get_setting("INBOX_IMAP_FOLDER") or "INBOX")
    return await ingest(raws, owner)


async def list_items(user: dict, status: Optional[str] = None) -> list[dict]:
    q: dict = {"owner_id": user["id"]}
    if status:
        q["status"] = status
    rows = await get_db().ai_inbox_items.find(q, {"_id": 0}).sort("received_at", -1).to_list(300)
    for r in rows:
        r["saran_prompt"] = PROMPTS.get(r.get("doc_type") or "lainnya")
    return rows


async def set_status(item_id: str, status: str, user: dict) -> dict:
    db = get_db()
    it = await db.ai_inbox_items.find_one({"id": item_id}, {"_id": 0})
    if not it:
        raise NotFoundError("Item kotak masuk")
    if it["owner_id"] != user["id"]:
        raise ForbiddenError("Bukan kotak masuk Anda")
    status = status if status in ("baru", "diproses", "diabaikan") else "baru"
    await db.ai_inbox_items.update_one({"id": item_id}, {"$set": {"status": status}})
    return {**it, "status": status}


async def status_info(user: dict) -> dict:
    owner_email = (await get_setting("INBOX_OWNER_EMAIL") or "").strip().lower()
    return {"aktif": bool(await get_setting("INBOX_IMAP_HOST")), "alamat": await get_setting("INBOX_IMAP_USER") or None,
            "pemilik_saya": bool(owner_email) and owner_email == (user.get("email") or "").lower()}

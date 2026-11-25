"""Bot WhatsApp Asisten AI (owner & manager) — gateway Evolution API (keputusan D2), MVP.

- Menghubungkan nomor: di aplikasi (Asisten AI → WhatsApp) pengguna menekan Hubungkan → kode 6 digit berlaku 10 menit →
  kirim "LINK 123456" dari WhatsApp ke nomor bot. Pengirim (JID nomor HP atau @lid) ditautkan ke akun itu.
- Percakapan memakai agen yang sama dengan web (izin = akun ERP); sesi channel "whatsapp" per nomor.
- Lampiran foto/PDF/Excel diunduh dari gateway → lampiran ERP → dibaca agen (OCR, Impor Cerdas, dll.).
- Persetujuan aksi lewat balasan: "SETUJUI 1" / "TOLAK 1" / "SETUJUI SEMUA", butuh PIN (berlaku 15 menit) — D3;
  aksi bernilai > Rp10 jt hanya disetujui lewat aplikasi.
- Semua pesan masuk/keluar dicatat (wa_messages); admin bisa mencabut akses (wa_links).
"""
from __future__ import annotations

import asyncio
import hashlib
import logging
import re
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from core.db import get_db
from core.exceptions import NotFoundError, ValidationError
from core.runtime_config import get_setting
from core.security import get_user_permissions, hash_password, verify_password

from . import render

logger = logging.getLogger("aurora.wa_bot")
LINK_TTL = timedelta(minutes=10)
PIN_TTL = timedelta(minutes=15)
APPROVE_LIMIT = 10_000_000          # D3: aksi > Rp10 jt hanya lewat aplikasi
RUN_TIMEOUT_S = 480
PERM = "ai.wa.use"
HELP = ("*Asisten AI — WhatsApp*\n"
        "• Tanya apa saja: _sales kemarin per toko_, _PO yang menunggu persetujuan_, _buatkan laporan PDF bulan ini_\n"
        "• Kirim foto struk/invoice, PDF, atau file Excel/CSV (ekspor POS, GoFood, mutasi bank) untuk dibaca & diimpor\n"
        "• *PIN 123456* — buka persetujuan 15 menit\n"
        "• *SETUJUI 1* / *TOLAK 1* / *SETUJUI SEMUA* — putuskan usulan aksi\n"
        "• *BARU* — mulai percakapan baru · *BANTUAN* — pesan ini")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: Optional[datetime] = None) -> str:
    return (dt or _now()).isoformat()


def _code_hash(code: str) -> str:
    return hashlib.sha256(code.encode()).hexdigest()


def _mask(phone: Optional[str]) -> Optional[str]:
    return f"{phone[:4]}••••{phone[-3:]}" if phone and len(phone) > 7 else phone


async def _load_user(user_id: str) -> Optional[dict]:
    u = await get_db().users.find_one({"id": user_id, "deleted_at": None})
    if not u or u.get("is_active") is False or u.get("active") is False:
        return None
    u["permissions"] = sorted(await get_user_permissions(u))
    return u


def _can(user: dict) -> bool:
    p = set(user.get("permissions") or [])
    return "*" in p or PERM in p


# ---------------------------------------------------------------- akun (dari aplikasi)

async def my_status(user: dict) -> dict:
    from services import whatsapp_service
    link = await get_db().wa_links.find_one({"user_id": user["id"], "status": {"$in": ["active", "pending"]}}, {"_id": 0},
                                            sort=[("created_at", -1)])
    return {"configured": await whatsapp_service.is_configured(),
            "provider": ((await get_setting("WHATSAPP_PROVIDER")) or "").lower() or None,
            "bot_number": await get_setting("WHATSAPP_BOT_NUMBER"),
            "status": (link or {}).get("status") or "none", "phone": _mask((link or {}).get("phone")),
            "pin_set": bool((link or {}).get("pin_hash")), "notify": (link or {}).get("notify", True),
            "linked_at": (link or {}).get("linked_at"), "code_expires_at": (link or {}).get("code_expires_at")
            if (link or {}).get("status") == "pending" else None}


async def start_link(user: dict) -> dict:
    db = get_db()
    await db.wa_links.update_many({"user_id": user["id"], "status": "pending"}, {"$set": {"status": "expired"}})
    code = f"{secrets.randbelow(10**6):06d}"
    exp = _now() + LINK_TTL
    active = await db.wa_links.find_one({"user_id": user["id"], "status": "active"}, {"_id": 0, "pin_hash": 1, "notify": 1})
    await db.wa_links.insert_one({"id": str(uuid.uuid4()), "user_id": user["id"], "status": "pending",
                                  "code_hash": _code_hash(code), "code_expires_at": _iso(exp), "jid": None, "phone": None,
                                  "pin_hash": (active or {}).get("pin_hash"), "notify": (active or {}).get("notify", True),
                                  "session_id": None, "created_at": _iso(), "deleted_at": None})
    bot = await get_setting("WHATSAPP_BOT_NUMBER")
    return {"code": code, "expires_at": _iso(exp), "bot_number": bot,
            "instruction": f"Kirim pesan WhatsApp: LINK {code}" + (f" ke nomor {bot}" if bot else " ke nomor bot")}


async def set_pin(user: dict, pin: str) -> dict:
    if not re.fullmatch(r"\d{6}", str(pin or "")):
        raise ValidationError("PIN harus 6 digit angka")
    if len(set(pin)) == 1 or pin in ("123456", "654321", "012345"):
        raise ValidationError("PIN terlalu mudah ditebak")
    r = await get_db().wa_links.update_many({"user_id": user["id"], "status": {"$in": ["active", "pending"]}},
                                            {"$set": {"pin_hash": hash_password(pin), "pin_verified_at": None,
                                                      "pin_fail": 0}})
    if not r.matched_count:
        raise ValidationError("Hubungkan WhatsApp dulu")
    return await my_status(user)


async def update_me(user: dict, *, notify: Optional[bool] = None) -> dict:
    if notify is not None:
        await get_db().wa_links.update_many({"user_id": user["id"], "status": "active"}, {"$set": {"notify": bool(notify)}})
    return await my_status(user)


async def unlink(user: dict) -> None:
    await get_db().wa_links.update_many({"user_id": user["id"], "status": {"$in": ["active", "pending"]}},
                                        {"$set": {"status": "revoked", "revoked_at": _iso(), "revoked_by": user["id"]}})


async def list_links() -> list[dict]:
    db = get_db()
    rows = await db.wa_links.find({"status": {"$in": ["active", "pending"]}},
                                  {"_id": 0, "code_hash": 0, "pin_hash": 0}).sort("created_at", -1).to_list(500)
    names = {u["id"]: u.get("full_name") or u.get("email") async for u in db.users.find(
        {"id": {"$in": [r["user_id"] for r in rows]}}, {"id": 1, "full_name": 1, "email": 1})}
    for r in rows:
        r["user_name"] = names.get(r["user_id"])
        r["phone"] = _mask(r.get("phone"))
        r["messages_7d"] = await db.wa_messages.count_documents({"link_id": r["id"], "created_at": {"$gte": _iso(_now() - timedelta(days=7))}})
    return rows


async def revoke(link_id: str, admin: dict) -> None:
    r = await get_db().wa_links.update_one({"id": link_id}, {"$set": {"status": "revoked", "revoked_at": _iso(), "revoked_by": admin["id"]}})
    if not r.matched_count:
        raise NotFoundError("Tautan WhatsApp")


# ---------------------------------------------------------------- kirim

async def _log(link: Optional[dict], jid: str, direction: str, kind: str, text: str, msg_id: Optional[str] = None) -> bool:
    """Catat pesan; untuk pesan masuk juga mencegah proses ganda (id pesan gateway unik)."""
    db = get_db()
    doc = {"id": msg_id or str(uuid.uuid4()), "link_id": (link or {}).get("id"), "user_id": (link or {}).get("user_id"),
           "jid": jid, "direction": direction, "type": kind, "text": (text or "")[:2000], "created_at": _iso()}
    if msg_id and await db.wa_messages.find_one({"id": msg_id}, {"_id": 1}):
        return False
    await db.wa_messages.insert_one(doc)
    return True


async def send_text(link: Optional[dict], jid: str, text: str) -> None:
    from services import whatsapp_service
    for part in render.chunks(text):
        await whatsapp_service.send_message(jid, part)
        await _log(link, jid, "out", "text", part)
        await asyncio.sleep(0.4)


async def _send_file(link: dict, jid: str, data: bytes, filename: str, mimetype: str, caption: str = "") -> None:
    from services import whatsapp_service
    res = await whatsapp_service.send_media(jid, data, filename=filename, mimetype=mimetype, caption=caption)
    await _log(link, jid, "out", "media", f"[{filename}] {caption}")
    if not res.get("sent"):
        await send_text(link, jid, f"File {filename} siap, tetapi tidak bisa dikirim lewat WA ({res.get('status')}). "
                                   "Unduh dari aplikasi: Asisten AI → Percakapan.")


async def notify(user_id: str, title: str, body: Optional[str] = None) -> None:
    """Notifikasi proaktif (urgent/peringatan) ke WA pengguna yang menautkan nomor & mengizinkan notifikasi."""
    try:
        link = await get_db().wa_links.find_one({"user_id": user_id, "status": "active", "notify": {"$ne": False}}, {"_id": 0})
        if link and link.get("jid"):
            await send_text(link, link["jid"], f"🔔 *{title}*" + (f"\n{body}" if body else ""))
    except Exception:  # noqa: BLE001
        logger.warning("wa notify gagal", exc_info=True)


# ---------------------------------------------------------------- webhook

def _sender(msg: dict) -> tuple[Optional[str], Optional[str]]:
    """→ (jid untuk membalas, nomor HP bila diketahui). JID bisa @s.whatsapp.net atau @lid (nomor tersembunyi)."""
    key = msg.get("key") or {}
    jid = key.get("remoteJid") or msg.get("remoteJid")
    phone = None
    for cand in (jid, key.get("senderPn"), key.get("remoteJidAlt"), key.get("participantPn"), msg.get("senderPn")):
        if cand and str(cand).endswith("@s.whatsapp.net"):
            phone = str(cand).split("@")[0].split(":")[0]
            break
    return jid, phone


def _text_and_media(msg: dict) -> tuple[str, Optional[dict]]:
    m = msg.get("message") or {}
    if "ephemeralMessage" in m:
        m = (m["ephemeralMessage"] or {}).get("message") or m
    text = m.get("conversation") or (m.get("extendedTextMessage") or {}).get("text") or ""
    for k in ("imageMessage", "documentMessage", "documentWithCaptionMessage"):
        node = m.get(k)
        if node:
            if k == "documentWithCaptionMessage":
                node = (node.get("message") or {}).get("documentMessage") or node
            return (text or node.get("caption") or "").strip(), {"kind": k, "mimetype": node.get("mimetype"),
                                                                 "filename": node.get("fileName") or node.get("title")}
    if m.get("audioMessage"):
        return "", {"kind": "audioMessage"}
    return text.strip(), None


async def handle_webhook(payload: dict) -> dict:
    ev = str(payload.get("event") or "").lower().replace("_", ".")
    if ev not in ("messages.upsert",):
        return {"ok": True, "ignored": ev or "tanpa event"}
    data = payload.get("data")
    msgs = data if isinstance(data, list) else (data.get("messages") if isinstance(data, dict) and "messages" in data else [data])
    handled = 0
    for msg in msgs or []:
        if not isinstance(msg, dict):
            continue
        key = msg.get("key") or {}
        jid, phone = _sender(msg)
        if key.get("fromMe") or not jid or jid.endswith("@g.us") or jid.startswith("status@"):
            continue
        text, media = _text_and_media(msg)
        db = get_db()
        link = await db.wa_links.find_one({"status": "active", "$or": [{"jid": jid}, *([{"phone": phone}] if phone else [])]}, {"_id": 0})
        if not await _log(link, jid, "in", (media or {}).get("kind") or "text", text, msg_id=key.get("id")):
            continue                                            # pesan yang sama dikirim ulang oleh gateway
        handled += 1
        asyncio.create_task(_safe(_process(link, jid, phone, msg, text, media)))
    return {"ok": True, "handled": handled}


async def _safe(coro) -> None:
    try:
        await coro
    except Exception:  # noqa: BLE001
        logger.exception("wa bot gagal memproses pesan")


async def _process(link: Optional[dict], jid: str, phone: Optional[str], msg: dict, text: str, media: Optional[dict]) -> None:
    db = get_db()
    m = re.match(r"^\s*(link|hubungkan|tautkan)\s+(\d{6})\s*$", text or "", re.I)
    if m:
        pend = await db.wa_links.find_one({"status": "pending", "code_hash": _code_hash(m.group(2)),
                                           "code_expires_at": {"$gt": _iso()}}, {"_id": 0})
        if not pend:
            await send_text(None, jid, "Kode tidak valid atau sudah kedaluwarsa. Buat kode baru di aplikasi: Asisten AI → WhatsApp.")
            return
        await db.wa_links.update_many({"status": "active", "$or": [{"jid": jid}, {"user_id": pend["user_id"]}]},
                                      {"$set": {"status": "replaced", "revoked_at": _iso()}})
        await db.wa_links.update_one({"id": pend["id"]}, {"$set": {"status": "active", "jid": jid, "phone": phone,
                                                                   "linked_at": _iso(), "code_hash": None}})
        user = await _load_user(pend["user_id"])
        await send_text({**pend, "status": "active"}, jid,
                        f"✅ Terhubung sebagai *{(user or {}).get('full_name') or 'pengguna'}*.\n"
                        + ("" if pend.get("pin_hash") else "Atur PIN 6 digit di aplikasi (Asisten AI → WhatsApp) untuk menyetujui aksi.\n")
                        + "\n" + HELP)
        return
    if not link:
        recent = await db.wa_messages.find_one({"jid": jid, "direction": "out", "created_at": {"$gte": _iso(_now() - timedelta(hours=6))}})
        if not recent:
            await send_text(None, jid, "Nomor ini belum terhubung ke ERP. Buka aplikasi → Asisten AI → WhatsApp → Hubungkan, "
                                       "lalu kirim kode yang muncul (LINK 123456).")
        return
    user = await _load_user(link["user_id"])
    if not user or not _can(user):
        await send_text(link, jid, "Akun Anda tidak punya akses bot WhatsApp. Hubungi admin.")
        return
    await db.wa_links.update_one({"id": link["id"]}, {"$set": {"last_seen_at": _iso()}})
    cmd = (text or "").strip()
    low = cmd.lower()
    if low in ("bantuan", "help", "menu", "?"):
        await send_text(link, jid, HELP)
        return
    if low in ("baru", "reset", "mulai baru"):
        await db.wa_links.update_one({"id": link["id"]}, {"$set": {"session_id": None}})
        await send_text(link, jid, "Percakapan baru dimulai. Silakan bertanya.")
        return
    pm = re.match(r"^pin\s+(\d{4,8})$", low)
    if pm:
        await _verify_pin(link, jid, pm.group(1))
        return
    am = re.match(r"^(setujui|approve|ya|tolak|reject)\s+(semua|all|\d{1,2})(?:\s+(.*))?$", low)
    if am:
        await _decide(link, user, jid, am.group(1) in ("setujui", "approve", "ya"), am.group(2), am.group(3) or "")
        return
    if media and media.get("kind") == "audioMessage":
        await send_text(link, jid, "Pesan suara belum didukung — ketik pertanyaan Anda, ya.")
        return
    await _ask_agent(link, user, jid, msg, cmd, media)


async def _verify_pin(link: dict, jid: str, pin: str) -> None:
    db = get_db()
    if not link.get("pin_hash"):
        await send_text(link, jid, "PIN belum diatur. Atur di aplikasi: Asisten AI → WhatsApp.")
        return
    if (link.get("pin_fail") or 0) >= 5:
        await send_text(link, jid, "PIN salah 5 kali — persetujuan lewat WA dikunci. Atur ulang PIN di aplikasi.")
        return
    if verify_password(pin, link["pin_hash"]):
        await db.wa_links.update_one({"id": link["id"]}, {"$set": {"pin_verified_at": _iso(), "pin_fail": 0}})
        await send_text(link, jid, "🔓 PIN benar — persetujuan aktif 15 menit. Balas *SETUJUI 1* / *TOLAK 1*.")
    else:
        await db.wa_links.update_one({"id": link["id"]}, {"$inc": {"pin_fail": 1}})
        await send_text(link, jid, "PIN salah.")


def _amount_of(action: dict) -> float:
    body = action.get("body") or {}
    vals = []
    for k in ("grand_total", "total", "amount", "total_amount", "nominal", "principal"):
        v = body.get(k) if isinstance(body, dict) else None
        if isinstance(v, (int, float)):
            vals.append(float(v))
    lines = body.get("lines") if isinstance(body, dict) else None
    if isinstance(lines, list):
        s = 0.0
        for ln in lines:
            if isinstance(ln, dict):
                q = ln.get("qty") or ln.get("qty_received") or 1
                p = ln.get("unit_cost") or ln.get("unit_price") or ln.get("price") or 0
                s += float(ln.get("total") or ln.get("amount") or (q * p) or 0)
        vals.append(s)
    return max(vals) if vals else 0.0


async def _pending(link: dict) -> list[dict]:
    if not link.get("session_id"):
        return []
    return await get_db().ai_actions.find({"session_id": link["session_id"], "status": "pending"},
                                          {"_id": 0}).sort("created_at", 1).to_list(50)


async def _decide(link: dict, user: dict, jid: str, approve: bool, which: str, reason: str) -> None:
    from services.ai.agent import actions, runtime
    pend = await _pending(link)
    if not pend:
        await send_text(link, jid, "Tidak ada usulan yang menunggu di percakapan ini.")
        return
    picks = pend if which in ("semua", "all") else ([pend[int(which) - 1]] if 0 < int(which) <= len(pend) else [])
    if not picks:
        await send_text(link, jid, f"Nomor tidak ada. Ada {len(pend)} usulan menunggu.")
        return
    if approve:
        fresh = await get_db().wa_links.find_one({"id": link["id"]}, {"pin_verified_at": 1})
        ver = (fresh or {}).get("pin_verified_at")
        if not ver or datetime.fromisoformat(ver) < _now() - PIN_TTL:
            await send_text(link, jid, "Untuk menyetujui, balas *PIN <6 digit>* dulu (berlaku 15 menit).")
            return
        big = [a for a in picks if _amount_of(a) > APPROVE_LIMIT]
        if big:
            await send_text(link, jid, "Aksi bernilai di atas Rp10 jt harus disetujui lewat aplikasi (Asisten AI → Persetujuan AI): "
                                       + ", ".join(a["title"] for a in big))
            picks = [a for a in picks if a not in big]
            if not picks:
                return
    last = None
    lines = []
    for a in picks:
        try:
            last = await (actions.approve(a["id"], user) if approve else actions.reject(a["id"], user, reason=reason or "via WhatsApp"))
            lines.append(f"{'✅' if last['status'] == 'done' else '❌' if last['status'] == 'failed' else '⏹️'} {a['title']}"
                         + (f" — {last.get('error')}" if last.get("status") == "failed" else ""))
        except Exception as e:  # noqa: BLE001
            lines.append(f"❌ {a['title']} — {str(e)[:150]}")
    await send_text(link, jid, "\n".join(lines))
    if last:
        follow = await runtime.continue_after_decisions(last, user)
        if follow:
            await _deliver_run(link, user, jid, follow["run_id"])


async def _ask_agent(link: dict, user: dict, jid: str, msg: dict, text: str, media: Optional[dict]) -> None:
    from services import upload_service, whatsapp_service
    from services.ai.agent import runtime
    db = get_db()
    attachments = []
    if media:
        got = await whatsapp_service.fetch_media(msg)
        if not got:
            await send_text(link, jid, "Lampiran tidak bisa diunduh dari WhatsApp. Coba kirim ulang.")
            return
        data, mime = got
        ext = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "application/pdf": ".pdf"}.get(mime, "")
        name = media.get("filename") or f"wa-{datetime.now():%Y%m%d-%H%M%S}{ext}"
        try:
            att = await upload_service.save_upload(file_bytes=data, filename=name, content_type=mime, user=user,
                                                   category="general", source_type="whatsapp")
            attachments.append(att["id"])
        except ValidationError as e:
            await send_text(link, jid, f"Lampiran ditolak: {e}")
            return
    try:
        out = await runtime.start_run(user, message=text or ("(lampiran tanpa pesan)" if attachments else ""),
                                      session_id=link.get("session_id"), attachments=attachments,
                                      context={"path": "WhatsApp",
                                               "title": "Chat WhatsApp di HP — jawab ringkas (≤ 15 baris), tabel kecil, "
                                                        "tanpa tombol tautan; file & grafik dikirim terpisah"},
                                      channel="whatsapp")
    except ValidationError as e:
        await send_text(link, jid, str(e))
        return
    if out["session_id"] != link.get("session_id"):
        await db.wa_links.update_one({"id": link["id"]}, {"$set": {"session_id": out["session_id"]}})
        link["session_id"] = out["session_id"]
    await _deliver_run(link, user, jid, out["run_id"])


async def _deliver_run(link: dict, user: dict, jid: str, run_id: str) -> None:
    from services.ai.agent import runtime
    t0 = _now()
    told = False
    while True:
        r = await runtime.get_run(run_id, user)
        if r["status"] != "running":
            break
        if not told and (_now() - t0).total_seconds() > 25:
            await send_text(link, jid, "⏳ Sedang dikerjakan…")
            told = True
        if (_now() - t0).total_seconds() > RUN_TIMEOUT_S:
            await send_text(link, jid, "Permintaan ini lama — hasilnya bisa dilihat di aplikasi (Asisten AI → Percakapan).")
            return
        await asyncio.sleep(1.5)
    ans = r.get("answer") or {}
    if ans.get("text"):
        await send_text(link, jid, render.to_whatsapp(ans["text"]))
    db = get_db()
    for u in ans.get("ui") or []:
        if u.get("type") == "file":
            f = await db.ai_files.find_one({"id": u.get("file_id")})
            if f:
                from core.object_storage import get_object
                data, _ = await get_object(f["storage_path"])
                await _send_file(link, jid, data, f["filename"], f.get("content_type") or "application/octet-stream")
        elif u.get("type") == "chart":
            try:
                png = render.chart_png(u["spec"])
                await _send_file(link, jid, png, "grafik.png", "image/png", u["spec"].get("title") or "")
            except Exception:  # noqa: BLE001
                logger.warning("render grafik WA gagal", exc_info=True)
    acts = [u["action_id"] for u in ans.get("ui") or [] if u.get("type") == "action"]
    if acts:
        pend = await _pending(link)
        if pend:
            lines = ["*Usulan menunggu persetujuan:*"]
            for i, a in enumerate(pend, 1):
                amt = _amount_of(a)
                lines.append(f"{i}. {a['title']} — risiko {a['risk']}" + (f" (≈ Rp {amt:,.0f})".replace(",", ".") if amt else ""))
            lines.append("Balas *PIN <6 digit>* lalu *SETUJUI 1* / *TOLAK 1* / *SETUJUI SEMUA*. "
                         "Aksi > Rp10 jt disetujui lewat aplikasi.")
            await send_text(link, jid, "\n".join(lines))

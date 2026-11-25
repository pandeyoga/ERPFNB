"""/api/wa — bot WhatsApp Asisten AI (Evolution API).

- POST /api/wa/webhook?token=<WHATSAPP_WEBHOOK_SECRET> — dipanggil gateway (event MESSAGES_UPSERT); tanpa login.
- /api/wa/me, /link, /pin — pengguna menautkan nomornya sendiri (izin ai.wa.use).
- /api/wa/links, /test — admin AI (ai.agent.admin): daftar nomor terhubung, cabut akses, kirim pesan uji.
"""
import hmac

from fastapi import APIRouter, Body, Depends, Query, Request

from core.exceptions import ForbiddenError, ValidationError, ok_envelope
from core.runtime_config import get_setting
from core.security import require_perm
from services.wa_bot import service as wa

router = APIRouter(prefix="/api/wa", tags=["whatsapp-bot"])
USE, ADMIN = "ai.wa.use", "ai.agent.admin"


@router.post("/webhook", summary="Webhook pesan masuk dari Evolution API")
async def webhook(request: Request, token: str = Query("")):
    secret = await get_setting("WHATSAPP_WEBHOOK_SECRET")
    if not secret:
        raise ForbiddenError("Webhook WhatsApp belum dikonfigurasi (WHATSAPP_WEBHOOK_SECRET)")
    if not hmac.compare_digest(str(token), str(secret)):
        raise ForbiddenError("Token webhook salah")
    try:
        payload = await request.json()
    except Exception:  # noqa: BLE001
        raise ValidationError("Body bukan JSON")
    return ok_envelope(await wa.handle_webhook(payload if isinstance(payload, dict) else {}))


@router.get("/me", summary="Status WhatsApp saya")
async def me(user: dict = Depends(require_perm(USE))):
    return ok_envelope(await wa.my_status(user))


@router.post("/link", summary="Buat kode untuk menghubungkan nomor WhatsApp")
async def link(user: dict = Depends(require_perm(USE))):
    return ok_envelope(await wa.start_link(user))


@router.post("/pin", summary="Atur PIN persetujuan lewat WhatsApp")
async def pin(payload: dict = Body(...), user: dict = Depends(require_perm(USE))):
    return ok_envelope(await wa.set_pin(user, str(payload.get("pin") or "")))


@router.patch("/me", summary="Ubah pengaturan WhatsApp saya")
async def update_me(payload: dict = Body(...), user: dict = Depends(require_perm(USE))):
    return ok_envelope(await wa.update_me(user, notify=payload.get("notify")))


@router.delete("/me", summary="Putuskan WhatsApp saya")
async def unlink(user: dict = Depends(require_perm(USE))):
    await wa.unlink(user)
    return ok_envelope({"unlinked": True})


@router.get("/links", summary="Daftar nomor WhatsApp terhubung (admin)")
async def links(user: dict = Depends(require_perm(ADMIN))):
    return ok_envelope(await wa.list_links())


@router.delete("/links/{link_id}", summary="Cabut akses nomor WhatsApp (admin)")
async def revoke(link_id: str, user: dict = Depends(require_perm(ADMIN))):
    await wa.revoke(link_id, user)
    return ok_envelope({"revoked": True})


@router.post("/test", summary="Kirim pesan uji WhatsApp (admin)")
async def test(payload: dict = Body(...), user: dict = Depends(require_perm(ADMIN))):
    from services import whatsapp_service
    to, text = str(payload.get("to") or ""), str(payload.get("text") or "Tes dari FnB Group ERP ✅")
    if not to:
        raise ValidationError("Nomor tujuan wajib diisi")
    return ok_envelope(await whatsapp_service.send_message(to, text))

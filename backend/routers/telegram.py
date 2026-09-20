"""Phase 11C — /api/telegram webhook router (public).

Processes incoming Telegram updates. Currently supports:
  - /start — reply with chat_id + instructions
  - /help  — short help text
  - /digest — if user is registered, dispatch digest now
"""
import logging
from fastapi import APIRouter, Body, Header

from core.exceptions import ok_envelope
from core.db import get_db
from services import telegram_service, owner_digest_service

logger = logging.getLogger("aurora.telegram.webhook")

router = APIRouter(prefix="/api/telegram", tags=["telegram"])


@router.post("/webhook")
async def webhook(payload: dict = Body(...),
                   x_telegram_bot_api_secret_token: str | None = Header(None)):
    """Telegram webhook endpoint. Always returns 200 to avoid retry storms."""
    parsed = telegram_service.parse_webhook_update(payload)
    if not parsed:
        return ok_envelope({"ignored": True})
    chat_id = parsed["chat_id"]
    cmd = parsed.get("command")

    if cmd == "/start":
        msg = (
            "👋 *Selamat datang di FnB Group!*\n\n"
            f"*Chat ID Anda:* `{chat_id}`\n\n"
            "Salin chat_id di atas dan paste ke menu *Owner > Digest Settings* di aplikasi FnB ERP.\n"
            "Setelah terdaftar, Anda akan menerima *daily digest* setiap pagi 06:00 WIB "
            "berisi cash position, revenue kemarin, AP jatuh tempo, anomalies, dan pending approvals.\n\n"
            "Ketik /help untuk bantuan."
        )
        await telegram_service.send_message(chat_id, msg)
    elif cmd == "/help":
        msg = (
            "*FnB Group Bot — Help*\n\n"
            "• /start — Tampilkan chat_id (untuk registrasi)\n"
            "• /digest — Kirim daily digest sekarang\n"
            "• /help — Bantuan\n\n"
            "Untuk berhenti menerima notifikasi, hapus subscription di aplikasi FnB ERP."
        )
        await telegram_service.send_message(chat_id, msg)
    elif cmd == "/digest":
        # Look up subscription by target chat_id
        db = get_db()
        sub = await db.digest_subscriptions.find_one({
            "channel": "telegram", "target": str(chat_id),
            "enabled": True, "deleted_at": None,
        })
        if not sub:
            await telegram_service.send_message(
                chat_id,
                "❌ Anda belum terdaftar. Buka aplikasi FnB ERP → Owner → Digest Settings, lalu masukkan chat_id ini.",
            )
        else:
            user = await db.users.find_one({"id": sub["user_id"]})
            if user:
                await owner_digest_service.send_digest_to_user(user)
    else:
        # Friendly default
        await telegram_service.send_message(
            chat_id,
            "🤖 Ketik /start untuk mendapatkan chat_id Anda, atau /help untuk bantuan.",
        )
    return ok_envelope({"handled": True})

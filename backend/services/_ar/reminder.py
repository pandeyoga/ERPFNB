"""AR payment reminders (Telegram / email)."""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from core.db import get_db, serialize

logger = logging.getLogger("aurora.ar")


async def send_reminder(invoice_id: str, channel: str, *, user_id: str) -> dict:
    """Send payment reminder via Telegram or Email."""
    db = get_db()
    invoice = await db.ar_invoices.find_one({"id": invoice_id, "deleted_at": None})
    if not invoice:
        raise ValueError("Invoice not found")

    inv = serialize(invoice)
    msg = (
        f"\U0001f4cb *PENGINGAT PEMBAYARAN*\n"
        f"Invoice: {inv['invoice_no']}\n"
        f"Customer: {inv['customer_name']}\n"
        f"Total: Rp {inv['total_amount']:,.0f}\n"
        f"Outstanding: Rp {inv['outstanding']:,.0f}\n"
        f"Jatuh Tempo: {inv['due_date']}\n"
        f"Status: {inv['status'].upper()}"
    )

    result = {"channel": channel, "sent": False, "message": msg}

    if channel == "telegram":
        try:
            from services.telegram_service import is_configured, send_message
            if not await is_configured():
                result["error"] = "Telegram belum dikonfigurasi (TELEGRAM_BOT_TOKEN)"
            else:
                # AR reminders have no per-customer chat_id; notify the configured
                # finance/admin chat if one is set in system settings.
                chat = await db.system_settings.find_one({"key": "telegram_default_chat_id"})
                chat_id = (chat or {}).get("value")
                if not chat_id:
                    result["error"] = "Telegram default chat belum diset (system setting 'telegram_default_chat_id')"
                else:
                    res = await send_message(chat_id, msg)
                    result["sent"] = bool(res.get("sent"))
                    if not res.get("sent"):
                        result["error"] = res.get("error") or res.get("status") or "Telegram gagal"
        except Exception as e:
            result["error"] = str(e)
    elif channel == "email":
        try:
            from services.email_service import send_email
            customer = await db.ar_customers.find_one({"id": inv.get("customer_id")}) if inv.get("customer_id") else None
            to_email = (customer or {}).get("email") or ""
            if not to_email:
                result["error"] = "Email customer belum diisi"
            else:
                plain = msg.replace("*", "")
                html = "<pre style=\"font-family:inherit;white-space:pre-wrap\">" + plain + "</pre>"
                res = await send_email(
                    to=[to_email],
                    subject=f"Pengingat Pembayaran Invoice {inv['invoice_no']}",
                    html=html,
                    text=plain,
                )
                status = res.get("status")
                result["provider"] = res.get("provider")
                result["to"] = to_email
                if status == "sent":
                    result["sent"] = True
                elif status == "mocked":
                    result["sent"] = False
                    result["error"] = "Email provider belum dikonfigurasi (RESEND_API_KEY) — pengingat dicatat saja"
                else:
                    result["error"] = res.get("error") or "Email gagal terkirim"
        except Exception as e:
            result["error"] = str(e)

    now = datetime.now(timezone.utc).isoformat()
    await db.ar_invoices.update_one(
        {"id": invoice_id},
        {"$inc": {"reminders_sent": 1}, "$set": {"last_reminder_at": now, "updated_at": now}}
    )
    return result

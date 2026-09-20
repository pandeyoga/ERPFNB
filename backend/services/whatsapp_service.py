"""Phase 12C \u2014 WhatsApp messaging service.

Provider-switched WhatsApp send. Supported providers (selected via
`WHATSAPP_PROVIDER` setting):

- **fonnte** (default, easiest for Indonesia, single token)
- **twilio** (Sandbox or paid, requires TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_WHATSAPP_FROM)
- **meta**  (Cloud API, requires META_WHATSAPP_TOKEN + META_PHONE_NUMBER_ID)
- **disabled** (explicit no-op)

If `WHATSAPP_PROVIDER` is unset OR the active provider's required keys are
missing, the service gracefully no-ops and returns
`{sent: False, status: "not_configured"}` so callers can persist meaningful
audit logs without crashing.

NEVER raises \u2014 all errors are returned in the result dict.
"""
from __future__ import annotations

import logging
import re
from typing import Any, Optional

import aiohttp

from core.runtime_config import get_setting

logger = logging.getLogger("aurora.whatsapp")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _normalize_phone(phone: str) -> str:
    """Normalize an Indonesian-friendly phone to international '+62...' format.

    Accepts: '08xxx', '+628xxx', '628xxx', '8xxx', 'whatsapp:+...' (Twilio).
    Returns digits only with leading '+' when international.
    """
    p = (phone or "").strip()
    if not p:
        return p
    # Twilio-formatted address
    if p.lower().startswith("whatsapp:"):
        return p
    # Strip non-digits except leading '+'
    has_plus = p.startswith("+")
    digits = re.sub(r"\D", "", p)
    if not digits:
        return p
    # Indonesian heuristic: '0...' \u2192 '62...'
    if digits.startswith("0"):
        digits = "62" + digits[1:]
    elif digits.startswith("8") and not has_plus:
        digits = "62" + digits
    return "+" + digits


async def is_configured() -> bool:
    """Return True if any provider is fully configured."""
    provider = (await get_setting("WHATSAPP_PROVIDER", default="")) or ""
    provider = provider.strip().lower()
    if not provider or provider == "disabled":
        return False
    if provider == "fonnte":
        return bool(await get_setting("FONNTE_API_TOKEN"))
    if provider == "twilio":
        return bool(
            await get_setting("TWILIO_ACCOUNT_SID")
            and await get_setting("TWILIO_AUTH_TOKEN")
            and await get_setting("TWILIO_WHATSAPP_FROM")
        )
    if provider == "meta":
        return bool(
            await get_setting("META_WHATSAPP_TOKEN")
            and await get_setting("META_PHONE_NUMBER_ID")
        )
    return False


async def get_provider_info() -> dict:
    provider = ((await get_setting("WHATSAPP_PROVIDER")) or "").strip().lower()
    return {
        "provider": provider or "unset",
        "configured": await is_configured(),
    }


# ---------------------------------------------------------------------------
# Send dispatch
# ---------------------------------------------------------------------------
async def send_message(
    to: str,
    text: str,
    *,
    media_url: Optional[str] = None,
) -> dict:
    """Send a WhatsApp message to `to` (phone number).

    Returns:
        {sent, status, provider, provider_message_id?, error?, to}

    Always returns a dict; never raises.
    """
    if not to or not text:
        return {"sent": False, "status": "skipped", "error": "missing to or text", "to": to}

    provider = ((await get_setting("WHATSAPP_PROVIDER")) or "").strip().lower()
    if not provider or provider == "disabled":
        return {"sent": False, "status": "not_configured", "provider": provider or "unset", "to": to}

    normalized = _normalize_phone(to)

    try:
        if provider == "fonnte":
            return await _send_fonnte(normalized, text, media_url=media_url)
        if provider == "twilio":
            return await _send_twilio(normalized, text, media_url=media_url)
        if provider == "meta":
            return await _send_meta(normalized, text, media_url=media_url)
    except Exception as e:  # noqa: BLE001
        logger.exception("whatsapp send_message failed")
        return {"sent": False, "status": "error", "provider": provider, "error": str(e)[:300], "to": normalized}

    return {"sent": False, "status": "unknown_provider", "provider": provider, "to": normalized}


# ---------------------------------------------------------------------------
# Fonnte (https://docs.fonnte.com/)
# ---------------------------------------------------------------------------
async def _send_fonnte(to: str, text: str, *, media_url: Optional[str] = None) -> dict:
    token = await get_setting("FONNTE_API_TOKEN")
    if not token:
        return {"sent": False, "status": "not_configured", "provider": "fonnte", "to": to}
    # Fonnte expects digits without '+'
    target = to.lstrip("+")
    payload: dict[str, Any] = {"target": target, "message": text}
    if media_url:
        payload["url"] = media_url
    try:
        timeout = aiohttp.ClientTimeout(total=15)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.post(
                "https://api.fonnte.com/send",
                data=payload,
                headers={"Authorization": token},
            ) as resp:
                data = await resp.json(content_type=None)
                ok = bool(data.get("status")) if isinstance(data, dict) else False
                return {
                    "sent": ok,
                    "status": "ok" if ok else "fonnte_error",
                    "provider": "fonnte",
                    "provider_message_id": (data or {}).get("id") if ok else None,
                    "error": None if ok else str(data),
                    "to": to,
                }
    except Exception as e:  # noqa: BLE001
        logger.exception("fonnte send failed")
        return {"sent": False, "status": "error", "provider": "fonnte", "error": str(e)[:300], "to": to}


# ---------------------------------------------------------------------------
# Twilio (https://www.twilio.com/docs/whatsapp/api)
# ---------------------------------------------------------------------------
async def _send_twilio(to: str, text: str, *, media_url: Optional[str] = None) -> dict:
    sid = await get_setting("TWILIO_ACCOUNT_SID")
    token = await get_setting("TWILIO_AUTH_TOKEN")
    from_addr = await get_setting("TWILIO_WHATSAPP_FROM")
    if not (sid and token and from_addr):
        return {"sent": False, "status": "not_configured", "provider": "twilio", "to": to}
    # Twilio expects 'whatsapp:+...' addresses
    twilio_to = to if to.lower().startswith("whatsapp:") else f"whatsapp:{to}"
    twilio_from = from_addr if from_addr.lower().startswith("whatsapp:") else f"whatsapp:{from_addr}"
    url = f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json"
    data: dict[str, Any] = {"From": twilio_from, "To": twilio_to, "Body": text}
    if media_url:
        data["MediaUrl"] = media_url
    try:
        timeout = aiohttp.ClientTimeout(total=15)
        auth = aiohttp.BasicAuth(login=sid, password=token)
        async with aiohttp.ClientSession(timeout=timeout, auth=auth) as session:
            async with session.post(url, data=data) as resp:
                body = await resp.json(content_type=None)
                ok = resp.status in (200, 201)
                return {
                    "sent": ok,
                    "status": "ok" if ok else "twilio_error",
                    "provider": "twilio",
                    "provider_message_id": (body or {}).get("sid") if ok else None,
                    "error": None if ok else (body.get("message") if isinstance(body, dict) else str(body))[:300],
                    "to": to,
                }
    except Exception as e:  # noqa: BLE001
        logger.exception("twilio send failed")
        return {"sent": False, "status": "error", "provider": "twilio", "error": str(e)[:300], "to": to}


# ---------------------------------------------------------------------------
# Meta WhatsApp Cloud API
# (https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages)
# ---------------------------------------------------------------------------
async def _send_meta(to: str, text: str, *, media_url: Optional[str] = None) -> dict:
    token = await get_setting("META_WHATSAPP_TOKEN")
    phone_id = await get_setting("META_PHONE_NUMBER_ID")
    if not (token and phone_id):
        return {"sent": False, "status": "not_configured", "provider": "meta", "to": to}
    # Meta wants international digits (no '+') in the `to` field
    target = to.lstrip("+")
    url = f"https://graph.facebook.com/v18.0/{phone_id}/messages"
    payload: dict[str, Any] = {
        "messaging_product": "whatsapp",
        "to": target,
        "type": "text",
        "text": {"body": text},
    }
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    try:
        timeout = aiohttp.ClientTimeout(total=15)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.post(url, json=payload, headers=headers) as resp:
                body = await resp.json(content_type=None)
                ok = resp.status in (200, 201) and isinstance(body, dict) and "messages" in body
                msg_id = None
                if ok:
                    msgs = body.get("messages") or []
                    msg_id = (msgs[0] or {}).get("id") if msgs else None
                return {
                    "sent": ok,
                    "status": "ok" if ok else "meta_error",
                    "provider": "meta",
                    "provider_message_id": msg_id,
                    "error": None if ok else str(body)[:300],
                    "to": to,
                }
    except Exception as e:  # noqa: BLE001
        logger.exception("meta send failed")
        return {"sent": False, "status": "error", "provider": "meta", "error": str(e)[:300], "to": to}

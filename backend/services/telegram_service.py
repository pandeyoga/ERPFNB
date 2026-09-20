"""Phase 11C — Telegram Bot client.

Minimal HTTP client for Telegram Bot API. Used by:
- Owner Daily Digest scheduler job
- Webhook handler for /start to capture chat_id

Token priority (Phase 12C unified):
  1. DB system_settings (set via UI)
  2. OS env TELEGRAM_BOT_TOKEN (legacy / .env-driven)
  3. None — every send becomes a no-op.
"""
import asyncio
import logging
from typing import Optional

import aiohttp

from core.runtime_config import get_setting

logger = logging.getLogger("aurora.telegram")

_API_BASE = "https://api.telegram.org"


async def _token() -> Optional[str]:
    """Resolve token from DB first, then env (via runtime_config)."""
    val = await get_setting("TELEGRAM_BOT_TOKEN", default="")
    return (val or "").strip() or None


async def is_configured() -> bool:
    return bool(await _token())


async def send_message(
    chat_id: str | int,
    text: str,
    *,
    parse_mode: str = "Markdown",
    disable_web_page_preview: bool = True,
) -> dict:
    """Send a message to a chat. Returns {sent, status, telegram_response?, error?}."""
    token = await _token()
    if not token:
        logger.warning("telegram.send_message skipped — token not configured")
        return {"sent": False, "status": "not_configured"}
    url = f"{_API_BASE}/bot{token}/sendMessage"
    payload = {
        "chat_id": str(chat_id),
        "text": text,
        "parse_mode": parse_mode,
        "disable_web_page_preview": disable_web_page_preview,
    }
    try:
        timeout = aiohttp.ClientTimeout(total=10)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.post(url, json=payload) as resp:
                data = await resp.json()
                if not data.get("ok"):
                    logger.error(f"telegram send failed: {data}")
                    return {"sent": False, "status": "telegram_error",
                            "error": data.get("description", "unknown")}
                return {"sent": True, "status": "ok",
                        "telegram_response": data.get("result", {})}
    except asyncio.TimeoutError:
        return {"sent": False, "status": "timeout"}
    except Exception as e:  # noqa: BLE001
        logger.exception("telegram send_message failed")
        return {"sent": False, "status": "error", "error": str(e)}


async def get_me() -> dict:
    token = await _token()
    if not token:
        return {"ok": False, "reason": "not_configured"}
    url = f"{_API_BASE}/bot{token}/getMe"
    try:
        timeout = aiohttp.ClientTimeout(total=8)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get(url) as resp:
                return await resp.json()
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "reason": str(e)}


async def set_webhook(webhook_url: str) -> dict:
    token = await _token()
    if not token:
        return {"ok": False, "reason": "not_configured"}
    url = f"{_API_BASE}/bot{token}/setWebhook"
    try:
        timeout = aiohttp.ClientTimeout(total=10)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.post(url, json={"url": webhook_url}) as resp:
                return await resp.json()
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "reason": str(e)}


def parse_webhook_update(update: dict) -> Optional[dict]:
    """Extract { chat_id, command, text, from_user } from a Telegram update."""
    msg = update.get("message") or update.get("channel_post") or {}
    if not msg:
        return None
    chat_id = (msg.get("chat") or {}).get("id")
    text = (msg.get("text") or "").strip()
    if not chat_id:
        return None
    command = None
    if text.startswith("/"):
        command = text.split()[0].split("@")[0]
    return {
        "chat_id": chat_id,
        "command": command,
        "text": text,
        "from_user": msg.get("from") or {},
        "chat": msg.get("chat") or {},
    }

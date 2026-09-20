"""Email service — Resend integration (Phase 9C).

Replaces Phase 9B mocked PO email with a real send via Resend
https://resend.com/docs

Behavior:
- If RESEND_API_KEY is missing/empty, gracefully falls back to MOCKED mode
  (no external call), so the rest of the app keeps working.
- Always returns a structured dict with status/provider/message_id/error
  so callers can persist a meaningful audit log entry.

Uses asyncio.to_thread to keep the FastAPI event loop non-blocking
(Resend SDK is synchronous).

NOTE: When using Resend's sandbox sender `onboarding@resend.dev`,
emails can ONLY be delivered to the email address that owns the
Resend account. To send to arbitrary recipients (e.g. vendors),
verify a custom domain in the Resend dashboard and override
EMAIL_FROM via env.
"""
from __future__ import annotations

import asyncio
import base64
import logging
import os
from typing import Any

from core.runtime_config import get_setting

logger = logging.getLogger("aurora.email")


async def _resolve_api_key() -> str:
    val = await get_setting("RESEND_API_KEY", default="")
    return (val or "").strip()


async def _has_real_provider() -> bool:
    return bool(await _resolve_api_key())


async def _from_addr() -> str:
    """Build the From: header. If EMAIL_FROM_NAME set, format as 'Name <email>'."""
    email = (await get_setting("EMAIL_FROM", default="onboarding@resend.dev") or "onboarding@resend.dev").strip()
    name = (await get_setting("EMAIL_FROM_NAME", default="") or "").strip()
    if name:
        return f"{name} <{email}>"
    return email


async def _reply_to() -> str | None:
    val = await get_setting("EMAIL_REPLY_TO", default="")
    return val.strip() if val else None


async def send_email(
    to: list[str],
    subject: str,
    html: str,
    *,
    text: str | None = None,
    attachments: list[dict[str, Any]] | None = None,
    cc: list[str] | None = None,
    bcc: list[str] | None = None,
    reply_to: str | None = None,
) -> dict[str, Any]:
    """Send an email. Returns a structured result.

    Args:
        to: list of recipient email addresses
        subject: email subject line
        html: HTML body
        text: optional plain-text body (Resend auto-derives if omitted)
        attachments: list of dicts: {filename, content (bytes), content_type}
            content_type defaults to application/octet-stream.
            Will be base64-encoded for the Resend API.
        cc, bcc: optional cc/bcc recipients
        reply_to: optional Reply-To address

    Returns:
        Dict with keys:
          - status: "sent" | "failed" | "mocked" | "skipped"
          - provider: "resend" | "mock"
          - provider_message_id: Resend message id when sent
          - error: error string when failed
          - to: recipients list (echoed back)

    NEVER raises — all errors are captured and returned in the dict.
    """
    to = [t for t in (to or []) if t]
    cc = [t for t in (cc or []) if t]
    bcc = [t for t in (bcc or []) if t]

    if not to:
        return {"status": "skipped", "provider": "mock", "error": "no recipients", "to": to}

    # Fallback: no API key configured → simulate (mocked mode)
    if not await _has_real_provider():
        logger.warning("RESEND_API_KEY missing — email send is MOCKED (recipients=%d)", len(to))
        return {
            "status": "mocked",
            "provider": "mock",
            "provider_message_id": None,
            "error": None,
            "to": to,
        }

    # Encode attachments for Resend
    enc_attachments: list[dict[str, Any]] = []
    for att in attachments or []:
        try:
            content = att.get("content")
            if isinstance(content, bytes):
                content_b64 = base64.b64encode(content).decode("ascii")
            elif isinstance(content, str):
                # Assume already base64 if a string is passed
                content_b64 = content
            else:
                logger.warning("Skipping attachment with invalid content type: %r", type(content))
                continue
            enc_attachments.append({
                "filename": att.get("filename", "attachment.bin"),
                "content": content_b64,
                "content_type": att.get("content_type", "application/octet-stream"),
            })
        except Exception as e:  # noqa: BLE001
            logger.exception("Attachment encoding failed: %s", e)

    params: dict[str, Any] = {
        "from": await _from_addr(),
        "to": to,
        "subject": subject,
        "html": html,
    }
    if text:
        params["text"] = text
    if cc:
        params["cc"] = cc
    if bcc:
        params["bcc"] = bcc
    rt = reply_to or await _reply_to()
    if rt:
        params["reply_to"] = rt
    if enc_attachments:
        params["attachments"] = enc_attachments

    # Resend SDK is sync — run in thread to avoid blocking event loop
    try:
        import resend  # local import so missing pkg doesn't crash module load

        resend.api_key = await _resolve_api_key()

        def _send_sync():
            return resend.Emails.send(params)

        result = await asyncio.to_thread(_send_sync)
        # Resend returns {"id": "..."} on success
        msg_id = None
        if isinstance(result, dict):
            msg_id = result.get("id") or result.get("data", {}).get("id")
        else:
            # SDK >=2.x sometimes returns object with .id attribute
            msg_id = getattr(result, "id", None)

        if not msg_id:
            logger.error("Resend send returned no id; raw=%r", result)
            return {
                "status": "failed",
                "provider": "resend",
                "provider_message_id": None,
                "error": "no message id returned",
                "to": to,
                "raw": str(result)[:300],
            }

        logger.info("Resend email sent id=%s to=%s subject=%r", msg_id, to, subject[:40])
        return {
            "status": "sent",
            "provider": "resend",
            "provider_message_id": msg_id,
            "error": None,
            "to": to,
        }
    except Exception as e:  # noqa: BLE001
        # Resend raises e.g. resend.exceptions.ResendError with a message
        err = str(e) or e.__class__.__name__
        logger.exception("Resend email send failed: %s", err)
        return {
            "status": "failed",
            "provider": "resend",
            "provider_message_id": None,
            "error": err[:500],
            "to": to,
        }


def is_real_provider_configured() -> bool:
    """Public helper for callers/UI to know if real provider is configured.

    Synchronous helper, kept for backward-compat. Note: only checks env var
    \u2014 use `await is_real_provider_configured_async()` for the DB-aware check.
    """
    return bool(os.environ.get("RESEND_API_KEY", "").strip())


async def is_real_provider_configured_async() -> bool:
    """DB-aware (Phase 12) version of `is_real_provider_configured`."""
    return await _has_real_provider()

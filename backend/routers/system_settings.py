"""/api/system-settings router \u2014 generic configuration mgmt (Phase 11C+ / 12C).

Phase 12 enhancements:
  - /test/resend       \u2014 send a test email via Resend
  - /test/llm          \u2014 minimal LLM round-trip with the configured key/provider
  - /test/whatsapp     \u2014 send a test WhatsApp message via the configured provider
  - /test/* endpoints accept ephemeral tokens so admins can verify BEFORE saving
"""
import logging
import os

from fastapi import APIRouter, Body, Depends, Request

from core.exceptions import ValidationError, ok_envelope
from core.security import require_perm
from services import (
    email_service,
    llm_service,
    system_settings_service,
    telegram_service,
    whatsapp_service,
)

logger = logging.getLogger("aurora.system_settings_router")

router = APIRouter(prefix="/api/system-settings", tags=["system-settings"])


# ---------------------------------------------------------------------------
# Catalog & CRUD
# ---------------------------------------------------------------------------
@router.get("/list")
async def list_settings(user: dict = Depends(require_perm("system.settings.read"))):
    return ok_envelope(await system_settings_service.list_settings())


@router.get("/categories")
async def list_categories(user: dict = Depends(require_perm("system.settings.read"))):
    """Return distinct categories for tab UI."""
    items = await system_settings_service.list_settings()
    cats: dict[str, dict] = {}
    for it in items:
        c = it.get("category", "custom")
        cats.setdefault(c, {"category": c, "count": 0, "configured_count": 0})
        cats[c]["count"] += 1
        if it.get("is_set"):
            cats[c]["configured_count"] += 1
    return ok_envelope(list(cats.values()))


@router.post("/set")
async def set_setting(
    payload: dict = Body(...),
    user: dict = Depends(require_perm("system.settings.manage")),
):
    key = (payload.get("key") or "").strip()
    value = payload.get("value")
    if not key:
        raise ValidationError("key wajib", field="key")
    if value is None:
        raise ValidationError("value wajib", field="value")
    return ok_envelope(await system_settings_service.set_value(
        key, str(value), user=user, description=payload.get("description"),
    ))


@router.delete("/{key}")
async def delete_setting(
    key: str,
    user: dict = Depends(require_perm("system.settings.manage")),
):
    return ok_envelope({"deleted": await system_settings_service.delete_value(key, user=user)})


# ---------------------------------------------------------------------------
# Telegram
# ---------------------------------------------------------------------------
@router.post("/test/telegram")
async def test_telegram(
    payload: dict = Body(default={}),
    user: dict = Depends(require_perm("system.settings.manage")),
):
    """Verify a Telegram bot token by calling getMe.

    Body: { token? } \u2014 if present, test that token without saving.
    """
    test_token = (payload or {}).get("token")
    if test_token:
        old = os.environ.get("TELEGRAM_BOT_TOKEN")
        os.environ["TELEGRAM_BOT_TOKEN"] = str(test_token).strip()
        try:
            from core import runtime_config
            runtime_config.invalidate("TELEGRAM_BOT_TOKEN")
            res = await telegram_service.get_me()
        finally:
            if old is not None:
                os.environ["TELEGRAM_BOT_TOKEN"] = old
            else:
                os.environ.pop("TELEGRAM_BOT_TOKEN", None)
            from core import runtime_config
            runtime_config.invalidate("TELEGRAM_BOT_TOKEN")
    else:
        res = await telegram_service.get_me()
    return ok_envelope({
        "ok": bool(res.get("ok")),
        "bot": res.get("result") if res.get("ok") else None,
        "reason": res.get("reason") or res.get("description"),
    })


@router.post("/telegram/set-webhook")
async def telegram_set_webhook(
    payload: dict = Body(default={}),
    request: Request = None,  # type: ignore[assignment]
    user: dict = Depends(require_perm("system.settings.manage")),
):
    url = (payload or {}).get("url")
    if not url:
        url = await system_settings_service.get_value("TELEGRAM_WEBHOOK_URL")
    if not url:
        raise ValidationError(
            "Webhook URL wajib. Berikan field 'url' atau set TELEGRAM_WEBHOOK_URL terlebih dahulu.",
            field="url",
        )
    if not url.endswith("/api/telegram/webhook"):
        url = url.rstrip("/") + "/api/telegram/webhook"
    res = await telegram_service.set_webhook(url)
    if res.get("ok"):
        await system_settings_service.set_value("TELEGRAM_WEBHOOK_URL", url, user=user)
    return ok_envelope({
        "ok": bool(res.get("ok")),
        "url": url,
        "description": res.get("description"),
        "reason": res.get("reason"),
    })


# ---------------------------------------------------------------------------
# Email (Resend)
# ---------------------------------------------------------------------------
@router.post("/test/resend")
async def test_resend(
    payload: dict = Body(default={}),
    user: dict = Depends(require_perm("system.settings.manage")),
):
    """Send a test email via Resend to current user (or specified `to`).

    Body: { api_key?, to?, from? } \u2014 ephemeral overrides not persisted.
    """
    payload = payload or {}
    ephemeral_key = (payload.get("api_key") or "").strip()
    ephemeral_from = (payload.get("from") or "").strip()
    to = payload.get("to") or user.get("email")
    if not to:
        raise ValidationError("Penerima email wajib (no `to` and current user has no email)", field="to")

    # Apply ephemerals via env override (cleared after)
    old_key = os.environ.get("RESEND_API_KEY")
    old_from = os.environ.get("EMAIL_FROM")
    if ephemeral_key:
        os.environ["RESEND_API_KEY"] = ephemeral_key
    if ephemeral_from:
        os.environ["EMAIL_FROM"] = ephemeral_from

    # Invalidate runtime cache so reads pick up the env override
    try:
        from core import runtime_config
        runtime_config.invalidate("RESEND_API_KEY")
        runtime_config.invalidate("EMAIL_FROM")
    except Exception:  # noqa: BLE001
        pass

    try:
        result = await email_service.send_email(
            to=[to],
            subject="[FnB ERP] Test email \u2014 Integrations Hub",
            html=(
                "<h3>FnB Group \u2014 Test Email</h3>"
                "<p>Email ini dikirim sebagai verifikasi konfigurasi <b>Resend</b>.</p>"
                f"<p>Penerima: <code>{to}</code></p>"
                f"<p>Initiator: <code>{user.get('email')}</code></p>"
            ),
            text=(
                "FnB Group Integrations Hub test email.\n"
                f"Sent to: {to}\nInitiator: {user.get('email')}"
            ),
        )
    finally:
        if old_key is not None:
            os.environ["RESEND_API_KEY"] = old_key
        elif ephemeral_key:
            os.environ.pop("RESEND_API_KEY", None)
        if old_from is not None:
            os.environ["EMAIL_FROM"] = old_from
        elif ephemeral_from:
            os.environ.pop("EMAIL_FROM", None)
        try:
            from core import runtime_config
            runtime_config.invalidate("RESEND_API_KEY")
            runtime_config.invalidate("EMAIL_FROM")
        except Exception:  # noqa: BLE001
            pass

    return ok_envelope({
        "status": result.get("status"),
        "provider": result.get("provider"),
        "provider_message_id": result.get("provider_message_id"),
        "error": result.get("error"),
        "to": result.get("to"),
    })


# ---------------------------------------------------------------------------
# LLM (Emergent + direct providers)
# ---------------------------------------------------------------------------
@router.post("/test/llm")
async def test_llm(
    payload: dict = Body(default={}),
    user: dict = Depends(require_perm("system.settings.manage")),
):
    """Send a tiny LLM prompt and report the result.

    Body: { api_key?, provider?, model?, prompt? } \u2014 ephemeral overrides.
    """
    payload = payload or {}
    ephemeral_key = (payload.get("api_key") or "").strip()
    ephemeral_provider = (payload.get("provider") or "").strip()
    ephemeral_model = (payload.get("model") or "").strip()
    prompt = (payload.get("prompt") or "Reply with the single word: OK").strip()

    overrides = {}
    if ephemeral_key:
        overrides["EMERGENT_LLM_KEY"] = (os.environ.get("EMERGENT_LLM_KEY"), ephemeral_key)
    if ephemeral_provider:
        overrides["LLM_PROVIDER_PRIMARY"] = (os.environ.get("LLM_PROVIDER_PRIMARY"), ephemeral_provider)
    if ephemeral_model:
        overrides["LLM_MODEL_TEXT"] = (os.environ.get("LLM_MODEL_TEXT"), ephemeral_model)
    for k, (_, new_v) in overrides.items():
        os.environ[k] = new_v
    try:
        from core import runtime_config
        for k in overrides:
            runtime_config.invalidate(k)
        res = await llm_service.quick_test(prompt)
    finally:
        for k, (old_v, _) in overrides.items():
            if old_v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = old_v
        try:
            from core import runtime_config
            for k in overrides:
                runtime_config.invalidate(k)
        except Exception:  # noqa: BLE001
            pass
    return ok_envelope(res)


# ---------------------------------------------------------------------------
# WhatsApp
# ---------------------------------------------------------------------------
@router.post("/test/whatsapp")
async def test_whatsapp(
    payload: dict = Body(default={}),
    user: dict = Depends(require_perm("system.settings.manage")),
):
    """Send a test WhatsApp message via the configured provider.

    Body: { to (required), message?, ephemeral_provider?, ephemeral_creds? }
    """
    payload = payload or {}
    to = (payload.get("to") or "").strip()
    if not to:
        raise ValidationError("Field 'to' (nomor tujuan) wajib", field="to")
    text = (payload.get("message") or "[FnB ERP] Test WhatsApp from Integrations Hub.").strip()

    # Optional ephemeral overrides for verifying before save
    ephem_provider = (payload.get("ephemeral_provider") or "").strip()
    ephem_creds: dict = payload.get("ephemeral_creds") or {}

    overrides_applied: dict[str, str | None] = {}
    if ephem_provider:
        overrides_applied["WHATSAPP_PROVIDER"] = os.environ.get("WHATSAPP_PROVIDER")
        os.environ["WHATSAPP_PROVIDER"] = ephem_provider
    for k, v in ephem_creds.items():
        if not isinstance(v, str):
            continue
        overrides_applied[k] = os.environ.get(k)
        os.environ[k] = v
    try:
        from core import runtime_config
        for k in overrides_applied:
            runtime_config.invalidate(k)
        result = await whatsapp_service.send_message(to=to, text=text)
    finally:
        for k, old_v in overrides_applied.items():
            if old_v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = old_v
        try:
            from core import runtime_config
            for k in overrides_applied:
                runtime_config.invalidate(k)
        except Exception:  # noqa: BLE001
            pass
    return ok_envelope(result)


@router.get("/whatsapp/info")
async def whatsapp_info(user: dict = Depends(require_perm("system.settings.read"))):
    return ok_envelope(await whatsapp_service.get_provider_info())

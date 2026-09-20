"""Phase 11C — /api/owner router (cockpit + digest subscriptions)."""
from fastapi import APIRouter, Body, Depends

from core.exceptions import ok_envelope, ValidationError
from core.security import require_perm
from services import owner_digest_service, cash_position_service, telegram_service, daily_briefing_service

router = APIRouter(prefix="/api/owner", tags=["owner"])


@router.get("/cockpit")
async def cockpit(user: dict = Depends(require_perm("owner.cockpit.access"))):
    """Top-level cockpit payload — cash + digest preview + counters."""
    payload = await owner_digest_service.build_digest_payload(user)
    cash_position = await cash_position_service.compute_position()
    return ok_envelope({
        "digest": payload,
        "cash_position": cash_position,
        "telegram_configured": await telegram_service.is_configured(),
    })


@router.get("/daily-briefing")
async def daily_briefing(user: dict = Depends(require_perm("owner.cockpit.access"))):
    """AI-narrated daily briefing — greeting, summary text, urgent actions, voice text."""
    return ok_envelope(await daily_briefing_service.generate_daily_briefing(user))


@router.get("/digest/preview")
async def digest_preview(user: dict = Depends(require_perm("owner.digest.manage"))):
    payload = await owner_digest_service.build_digest_payload(user)
    return ok_envelope({
        "payload": payload,
        "telegram_text": owner_digest_service.render_telegram_text(payload),
        "inapp": owner_digest_service.render_inapp(payload),
    })


@router.post("/digest/send-now")
async def digest_send_now(user: dict = Depends(require_perm("owner.digest.manage"))):
    return ok_envelope(await owner_digest_service.send_digest_to_user(user))


@router.get("/digest/subscriptions")
async def list_subscriptions(user: dict = Depends(require_perm("owner.digest.manage"))):
    return ok_envelope(await owner_digest_service.list_subscriptions(user["id"]))


@router.post("/digest/subscriptions")
async def upsert_subscription(
    payload: dict = Body(...),
    user: dict = Depends(require_perm("owner.digest.manage")),
):
    if "channel" not in payload or "target" not in payload:
        raise ValidationError("channel & target wajib", field="payload")
    return ok_envelope(await owner_digest_service.upsert_subscription(
        user["id"],
        channel=payload["channel"],
        target=payload["target"],
        enabled=bool(payload.get("enabled", True)),
        schedule_cron=payload.get("schedule_cron", "0 6 * * *"),
    ))


@router.delete("/digest/subscriptions/{sub_id}")
async def delete_subscription(
    sub_id: str,
    user: dict = Depends(require_perm("owner.digest.manage")),
):
    return ok_envelope({"deleted": await owner_digest_service.delete_subscription(sub_id, user["id"])})


@router.get("/telegram/info")
async def telegram_info(user: dict = Depends(require_perm("owner.digest.manage"))):
    info = await telegram_service.get_me()
    return ok_envelope({
        "configured": await telegram_service.is_configured(),
        "bot": info,
    })

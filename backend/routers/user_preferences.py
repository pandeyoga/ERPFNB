"""User Preferences router — Sprint F.

Endpoints:
  GET  /api/preferences/me          — get all preferences for current user
  PUT  /api/preferences/me          — bulk-update preferences
  GET  /api/preferences/presets/{portal}        — list available preset definitions
  POST /api/preferences/dashboard-preset        — save chosen preset
"""
from fastapi import APIRouter, Depends
from core.exceptions import ok_envelope, NotFoundError, ValidationError
from core.security import current_user
from services import user_preferences_service as svc

router = APIRouter(prefix="/api/preferences", tags=["preferences"])


@router.get("/me")
async def get_my_prefs(user: dict = Depends(current_user)):
    prefs = await svc.get_preferences(user["id"])
    return ok_envelope(prefs)


@router.put("/me")
async def update_my_prefs(payload: dict, user: dict = Depends(current_user)):
    try:
        prefs = await svc.set_preferences_bulk(user["id"], payload)
    except ValueError as e:
        raise ValidationError(str(e), code="INVALID_PREFERENCE", field="payload")
    return ok_envelope(prefs)


@router.get("/presets/{portal}")
async def list_presets(portal: str, user: dict = Depends(current_user)):
    catalog = svc.PRESET_CATALOG.get(portal)
    if catalog is None:
        raise NotFoundError(f"No presets for portal: {portal}", field="portal")
    return ok_envelope(list(catalog.values()))


@router.post("/dashboard-preset")
async def save_dashboard_preset(payload: dict, user: dict = Depends(current_user)):
    portal = payload.get("portal")
    preset_id = payload.get("preset_id")
    if not portal or not preset_id:
        raise ValidationError("portal and preset_id are required",
                              code="MISSING_FIELDS", field="portal")
    try:
        prefs = await svc.set_dashboard_preset(user["id"], portal, preset_id)
    except ValueError as e:
        raise ValidationError(str(e), code="INVALID_PRESET", field="preset_id")
    return ok_envelope(prefs)

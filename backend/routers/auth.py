"""/api/auth router."""
from fastapi import APIRouter, Body, Depends, Request, Response
from pydantic import BaseModel, EmailStr

from core.config import settings
from core.exceptions import UnauthorizedError, ok_envelope
from core.security import ACCESS_COOKIE, REFRESH_COOKIE, current_user
from services import auth_service

REFRESH_COOKIE_PATH = "/api/auth"


def _set_session_cookies(response: Response, data: dict) -> None:
    """FE-06: tokens live in httpOnly cookies (not readable by JS)."""
    response.set_cookie(ACCESS_COOKIE, data["access_token"], httponly=True, secure=True, samesite="lax",
                        max_age=settings.access_token_minutes * 60, path="/")
    response.set_cookie(REFRESH_COOKIE, data["refresh_token"], httponly=True, secure=True, samesite="lax",
                        max_age=settings.refresh_token_days * 86400, path=REFRESH_COOKIE_PATH)


def _clear_session_cookies(response: Response) -> None:
    response.delete_cookie(ACCESS_COOKIE, path="/", secure=True, httponly=True, samesite="lax")
    response.delete_cookie(REFRESH_COOKIE, path=REFRESH_COOKIE_PATH, secure=True, httponly=True, samesite="lax")

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class RefreshIn(BaseModel):
    refresh_token: str | None = None


class ChangePwdIn(BaseModel):
    old_password: str
    new_password: str


@router.post("/login")
async def login(payload: LoginIn, response: Response):
    data = await auth_service.login(payload.email, payload.password)
    _set_session_cookies(response, data)
    return ok_envelope(data)  # body tokens kept for API/script clients; the web app ignores them


@router.post("/refresh")
async def refresh(request: Request, response: Response, payload: RefreshIn | None = Body(default=None)):
    body_token = payload.refresh_token if payload else None
    token = body_token or request.cookies.get(REFRESH_COOKIE)
    if not token:
        raise UnauthorizedError("Missing refresh token", code="NO_REFRESH")
    data = await auth_service.refresh_session(token)
    _set_session_cookies(response, data)
    if body_token:
        return ok_envelope(data)
    return ok_envelope({"token_type": "cookie", "expires_in": settings.access_token_minutes * 60})


@router.post("/logout")
async def logout(request: Request, response: Response, payload: RefreshIn | None = Body(default=None),
                 user: dict = Depends(current_user)):
    rt = (payload.refresh_token if payload else None) or request.cookies.get(REFRESH_COOKIE)
    await auth_service.logout(user["id"], rt)
    _clear_session_cookies(response)
    return ok_envelope({"message": "Logged out"})


@router.get("/me")
async def me(user: dict = Depends(current_user)):
    return ok_envelope(await auth_service.me(user))


@router.post("/change-password")
async def change_pwd(payload: ChangePwdIn, user: dict = Depends(current_user)):
    await auth_service.change_password(user["id"], payload.old_password, payload.new_password)
    return ok_envelope({"message": "Password changed"})


# --------------- Sprint A12: Removed Google OAuth & Email Verification Scaffolds ---------------
# Scaffold dihapus karena dapat menyebabkan kerentanan XSS via redirect_uri echo.
# Implementasi nyata memerlukan: GOOGLE_OAUTH_CLIENT_ID, CLIENT_SECRET, EMAIL_SERVICE.
# TODO (Sprint B): Implementasi lengkap OAuth jika diperlukan.

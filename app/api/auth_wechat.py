from __future__ import annotations

import json
import logging
import secrets
from urllib.parse import urlencode, quote

import httpx
import jwt as pyjwt
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import RedirectResponse
from datetime import datetime, timedelta, timezone

from app.core.auth import create_token
from app.core.config import get_settings
from app.core.database import get_or_create_user_by_wechat

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/auth/wechat", tags=["auth-wechat"])

# ── State token helpers (JWT-based, no server storage needed) ──

_STATE_EXPIRY_MINUTES = 5


def _create_state_token() -> str:
    """Create a signed, expiring state token for OAuth CSRF protection."""
    settings = get_settings()
    payload = {
        "nonce": secrets.token_hex(16),
        "exp": datetime.now(timezone.utc) + timedelta(minutes=_STATE_EXPIRY_MINUTES),
    }
    return pyjwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def _verify_state_token(state: str) -> bool:
    """Verify a state token is valid and not expired."""
    settings = get_settings()
    try:
        pyjwt.decode(state, settings.jwt_secret, algorithms=["HS256"])
        return True
    except (pyjwt.ExpiredSignatureError, pyjwt.InvalidTokenError):
        return False


# ── WeChat API helpers ──

WECHAT_OPEN_AUTHORIZE_URL = "https://open.weixin.qq.com/connect/qrconnect"
WECHAT_MP_AUTHORIZE_URL = "https://open.weixin.qq.com/connect/oauth2/authorize"
WECHAT_ACCESS_TOKEN_URL = "https://api.weixin.qq.com/sns/oauth2/access_token"
WECHAT_USERINFO_URL = "https://api.weixin.qq.com/sns/userinfo"


def _is_wechat_browser(user_agent: str) -> bool:
    return "micromessenger" in user_agent.lower()


def _get_wechat_credentials(is_mp: bool) -> tuple[str, str]:
    """Return (app_id, app_secret) for the appropriate platform."""
    settings = get_settings()
    if is_mp and settings.wechat_mp_app_id:
        return settings.wechat_mp_app_id, settings.wechat_mp_app_secret
    return settings.wechat_app_id, settings.wechat_app_secret


# ── Endpoints ──


@router.get("/login")
async def wechat_login(request: Request, platform: str = ""):
    """
    Redirect user to WeChat OAuth authorization page.
    - PC browser → open platform QR code login
    - WeChat browser → MP web authorization
    Query param `platform` can force "mp" for WeChat-in-browser.
    """
    settings = get_settings()
    ua = request.headers.get("user-agent", "")
    is_mp = platform == "mp" or _is_wechat_browser(ua)

    app_id, app_secret = _get_wechat_credentials(is_mp)
    if not app_id:
        raise HTTPException(status_code=503, detail="微信登录未配置")

    state = _create_state_token()
    callback_url = f"{settings.app_base_url}/api/v1/auth/wechat/callback"

    if is_mp:
        # WeChat MP web authorization
        params = {
            "appid": app_id,
            "redirect_uri": callback_url,
            "response_type": "code",
            "scope": "snsapi_userinfo",
            "state": state,
        }
        url = f"{WECHAT_MP_AUTHORIZE_URL}?{urlencode(params)}#wechat_redirect"
    else:
        # Open platform QR code login
        params = {
            "appid": app_id,
            "redirect_uri": callback_url,
            "response_type": "code",
            "scope": "snsapi_login",
            "state": state,
        }
        url = f"{WECHAT_OPEN_AUTHORIZE_URL}?{urlencode(params)}#wechat_redirect"

    return RedirectResponse(url=url, status_code=302)


@router.get("/callback")
async def wechat_callback(request: Request, code: str = "", state: str = "", error: str = ""):
    """
    Handle WeChat OAuth callback.
    Exchange code for access_token + openid, fetch user info, create/find user,
    issue JWT, redirect to frontend.
    """
    settings = get_settings()
    frontend_url = settings.frontend_base_url

    # Handle user-denied or error
    if error or not code:
        logger.warning(f"[WeChat OAuth] error={error}, code empty={not code}")
        return RedirectResponse(
            url=f"{frontend_url}/login?error={quote('您已取消微信授权')}", status_code=302
        )

    # Verify state (CSRF protection)
    if not state or not _verify_state_token(state):
        logger.warning("[WeChat OAuth] Invalid or expired state token")
        return RedirectResponse(
            url=f"{frontend_url}/login?error={quote('登录请求异常，请重新操作')}", status_code=302
        )

    # Detect platform from User-Agent to pick correct credentials
    ua = request.headers.get("user-agent", "")
    is_mp = _is_wechat_browser(ua)
    app_id, app_secret = _get_wechat_credentials(is_mp)

    # Exchange code for access_token
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            token_resp = await client.get(
                WECHAT_ACCESS_TOKEN_URL,
                params={
                    "appid": app_id,
                    "secret": app_secret,
                    "code": code,
                    "grant_type": "authorization_code",
                },
            )
            token_data = token_resp.json()

        if "errcode" in token_data and token_data["errcode"] != 0:
            logger.error(f"[WeChat OAuth] token exchange failed: {token_data}")
            return RedirectResponse(
                url=f"{frontend_url}/login?error={quote('微信授权失败，请重试')}", status_code=302
            )

        access_token = token_data["access_token"]
        openid = token_data["openid"]
        unionid = token_data.get("unionid")

    except Exception as e:
        logger.error(f"[WeChat OAuth] token exchange error: {e}")
        return RedirectResponse(
            url=f"{frontend_url}/login?error={quote('微信登录服务暂时不可用')}", status_code=302
        )

    # Fetch user info
    nickname = None
    avatar_url = None
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            info_resp = await client.get(
                WECHAT_USERINFO_URL,
                params={"access_token": access_token, "openid": openid, "lang": "zh_CN"},
            )
            info_data = info_resp.json()

        if "errcode" not in info_data or info_data.get("errcode") == 0:
            nickname = info_data.get("nickname")
            avatar_url = info_data.get("headimgurl")
            if not unionid:
                unionid = info_data.get("unionid")
    except Exception as e:
        logger.warning(f"[WeChat OAuth] userinfo fetch failed (non-fatal): {e}")

    # Create or find user
    user = await get_or_create_user_by_wechat(
        openid=openid,
        unionid=unionid,
        nickname=nickname,
        avatar_url=avatar_url,
    )

    # Issue JWT
    token = create_token(user["id"])

    # Build user info for frontend
    user_info = {
        "id": user["id"],
        "phone": user.get("phone"),
        "nickname": user.get("nickname"),
        "avatar_url": user.get("avatar_url"),
    }
    user_json = quote(json.dumps(user_info, ensure_ascii=False))

    return RedirectResponse(
        url=f"{frontend_url}/auth/callback?token={token}&user={user_json}",
        status_code=302,
    )

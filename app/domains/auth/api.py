"""认证领域 - API路由（手机号 + 微信）"""
from __future__ import annotations

import json
import logging
import secrets
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode, quote

import httpx
import jwt as pyjwt
from fastapi import APIRouter, HTTPException, Request, Depends
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

from app.core.auth import create_token, get_current_user
from app.core.config import get_settings
from app.core.database import get_or_create_user, get_or_create_user_by_wechat, _use_supabase, _get_supabase, _mem_users
from app.core.rate_limiter import RateLimitError, get_rate_limiter

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

MOCK_CODE = "1234"

# ── Request/Response Models ──

class SendCodeRequest(BaseModel):
    phone: str


class VerifyRequest(BaseModel):
    phone: str
    code: str


class AuthResponse(BaseModel):
    token: str
    user: dict


class UserResponse(BaseModel):
    id: str
    phone: str | None = None
    nickname: str | None = None
    avatar_url: str | None = None


# ── Helpers ──

def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


_STATE_EXPIRY_MINUTES = 5


def _create_state_token() -> str:
    settings = get_settings()
    payload = {
        "nonce": secrets.token_hex(16),
        "exp": datetime.now(timezone.utc) + timedelta(minutes=_STATE_EXPIRY_MINUTES),
    }
    return pyjwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def _verify_state_token(state: str) -> bool:
    settings = get_settings()
    try:
        pyjwt.decode(state, settings.jwt_secret, algorithms=["HS256"])
        return True
    except (pyjwt.ExpiredSignatureError, pyjwt.InvalidTokenError):
        return False


def _is_wechat_browser(user_agent: str) -> bool:
    return "micromessenger" in user_agent.lower()


def _get_wechat_credentials(is_mp: bool) -> tuple[str, str]:
    settings = get_settings()
    if is_mp and settings.wechat_mp_app_id:
        return settings.wechat_mp_app_id, settings.wechat_mp_app_secret
    return settings.wechat_app_id, settings.wechat_app_secret


# ── Phone Auth ──

@router.post("/send-code")
async def send_code(body: SendCodeRequest, request: Request):
    """发送验证码"""
    phone = body.phone.strip()
    if not phone or len(phone) < 10:
        raise HTTPException(status_code=400, detail="手机号格式无效")

    ip = _client_ip(request)
    limiter = get_rate_limiter()

    try:
        limiter.check_send_code(phone, ip)
    except RateLimitError as e:
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=429,
            content={"detail": str(e)},
            headers={"Retry-After": str(e.retry_after)},
        )

    logger.info(f"验证码已发送至 {phone[-4:]}")
    return {"message": "验证码已发送", "expires_in": 300}


@router.post("/verify", response_model=AuthResponse)
async def verify_code(body: VerifyRequest, request: Request):
    """验证验证码并返回token"""
    phone = body.phone.strip()
    code = body.code.strip()

    limiter = get_rate_limiter()

    try:
        limiter.check_verify(phone)
    except RateLimitError as e:
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=429,
            content={"detail": str(e)},
            headers={"Retry-After": str(e.retry_after)},
        )

    if code != MOCK_CODE:
        limiter.record_verify_failure(phone)
        raise HTTPException(status_code=400, detail="验证码错误")

    limiter.reset_verify_failures(phone)

    user = await get_or_create_user(phone)
    token = create_token(user["id"])
    return {"token": token, "user": user}


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    """获取当前用户信息"""
    return current_user


# ── WeChat OAuth ──

WECHAT_AUTH_URL = "https://open.weixin.qq.com/connect/oauth2/authorize"
WECHAT_QRCONNECT_URL = "https://open.weixin.qq.com/connect/qrconnect"
WECHAT_TOKEN_URL = "https://api.weixin.qq.com/sns/oauth2/access_token"
WECHAT_USERINFO_URL = "https://api.weixin.qq.com/sns/userinfo"


@router.get("/wechat/login")
async def wechat_login(request: Request):
    """微信登录入口"""
    settings = get_settings()
    if not settings.wechat_app_id:
        raise HTTPException(status_code=503, detail="微信登录未配置")

    user_agent = request.headers.get("user-agent", "")
    is_mp = _is_wechat_browser(user_agent)
    app_id, _ = _get_wechat_credentials(is_mp)

    state = _create_state_token()
    redirect_uri = f"{settings.api_base_url}/api/v1/auth/wechat/callback"

    if is_mp:
        params = urlencode({
            "appid": app_id, "redirect_uri": redirect_uri,
            "response_type": "code", "scope": "snsapi_userinfo",
            "state": state,
        })
        return RedirectResponse(url=f"{WECHAT_AUTH_URL}?{params}#wechat_redirect", status_code=302)
    else:
        params = urlencode({
            "appid": app_id, "redirect_uri": redirect_uri,
            "response_type": "code", "scope": "snsapi_login",
            "state": state,
        })
        return RedirectResponse(url=f"{WECHAT_QRCONNECT_URL}?{params}#wechat_redirect", status_code=302)


@router.get("/wechat/callback")
async def wechat_callback(code: str = "", state: str = "", request: Request = None):
    """微信回调处理"""
    settings = get_settings()
    frontend_url = settings.frontend_url or "http://localhost:3000"

    if not state or not _verify_state_token(state):
        return RedirectResponse(url=f"{frontend_url}/login?error={quote('无效的授权请求')}", status_code=302)

    if not code:
        return RedirectResponse(url=f"{frontend_url}/login?error={quote('授权已取消')}", status_code=302)

    user_agent = request.headers.get("user-agent", "") if request else ""
    is_mp = _is_wechat_browser(user_agent)
    app_id, app_secret = _get_wechat_credentials(is_mp)

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            token_resp = await client.get(WECHAT_TOKEN_URL, params={
                "appid": app_id, "secret": app_secret, "code": code, "grant_type": "authorization_code",
            })
            token_data = token_resp.json()

        if "errcode" in token_data and token_data["errcode"] != 0:
            return RedirectResponse(url=f"{frontend_url}/login?error={quote('微信授权失败，请重试')}", status_code=302)

        access_token = token_data["access_token"]
        openid = token_data["openid"]
        unionid = token_data.get("unionid")
    except Exception:
        return RedirectResponse(url=f"{frontend_url}/login?error={quote('微信登录服务暂时不可用')}", status_code=302)

    nickname = None
    avatar_url = None
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            info_resp = await client.get(WECHAT_USERINFO_URL, params={"access_token": access_token, "openid": openid, "lang": "zh_CN"})
            info_data = info_resp.json()
        if "errcode" not in info_data or info_data.get("errcode") == 0:
            nickname = info_data.get("nickname")
            avatar_url = info_data.get("headimgurl")
            if not unionid:
                unionid = info_data.get("unionid")
    except Exception:
        pass

    user = await get_or_create_user_by_wechat(openid=openid, unionid=unionid, nickname=nickname, avatar_url=avatar_url)
    token = create_token(user["id"])

    user_data = {
        "id": user["id"],
        "phone": user.get("phone"),
        "nickname": user.get("nickname"),
        "avatar_url": user.get("avatar_url"),
    }
    user_json = quote(json.dumps(user_data, ensure_ascii=False))

    return RedirectResponse(url=f"{frontend_url}/auth/callback?token={token}&user={user_json}", status_code=302)

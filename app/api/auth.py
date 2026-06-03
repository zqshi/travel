from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel

from app.core.auth import create_token, get_current_user
from app.core.database import get_or_create_user
from app.core.rate_limiter import RateLimitError, get_rate_limiter, RateLimiter

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

MOCK_CODE = "1234"


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


def _client_ip(request: Request) -> str:
    """Extract real client IP, respecting X-Forwarded-For behind a proxy."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@router.post("/send-code")
async def send_code(body: SendCodeRequest, request: Request):
    phone = body.phone.strip()
    if not phone or len(phone) < 11:
        raise HTTPException(status_code=400, detail="请输入有效的手机号")

    limiter = get_rate_limiter()
    ip = _client_ip(request)

    # IP-level rate limit
    try:
        limiter.check_ip_rate(ip)
    except RateLimitError as e:
        logger.warning(f"[RateLimit] IP {ip} exceeded global limit")
        raise HTTPException(
            status_code=429,
            detail=e.message,
            headers={"Retry-After": str(e.retry_after)},
        )

    # Phone-level send rate limit (interval + daily cap)
    try:
        limiter.check_send_rate(phone)
    except RateLimitError as e:
        logger.warning(f"[RateLimit] Phone {phone} send limited: {e.message}")
        raise HTTPException(
            status_code=429,
            detail=e.message,
            headers={"Retry-After": str(e.retry_after)},
        )

    logger.info(f"[Mock SMS] 向 {phone} 发送验证码: {MOCK_CODE}")
    return {"success": True, "message": "验证码已发送"}


@router.post("/verify", response_model=AuthResponse)
async def verify_code(body: VerifyRequest, request: Request):
    phone = body.phone.strip()
    code = body.code.strip()

    limiter = get_rate_limiter()
    ip = _client_ip(request)

    # IP-level rate limit
    try:
        limiter.check_ip_rate(ip)
    except RateLimitError as e:
        logger.warning(f"[RateLimit] IP {ip} exceeded global limit")
        raise HTTPException(
            status_code=429,
            detail=e.message,
            headers={"Retry-After": str(e.retry_after)},
        )

    # Check if phone is locked due to too many verify failures
    try:
        limiter.check_verify_rate(phone)
    except RateLimitError as e:
        logger.warning(f"[RateLimit] Phone {phone} verify locked: {e.message}")
        raise HTTPException(
            status_code=429,
            detail=e.message,
            headers={"Retry-After": str(e.retry_after)},
        )

    if code != MOCK_CODE:
        limiter.record_verify_failure(phone)
        raise HTTPException(status_code=400, detail="验证码错误")

    # Successful verification — reset verify failure counter
    limiter.reset_verify_failures(phone)

    user = await get_or_create_user(phone)
    token = create_token(user["id"])
    return AuthResponse(
        token=token,
        user={
            "id": user["id"],
            "phone": user.get("phone"),
            "nickname": user.get("nickname"),
            "avatar_url": user.get("avatar_url"),
        },
    )


@router.get("/me", response_model=UserResponse)
async def get_me(user_id: str = Depends(get_current_user)):
    from app.core.database import _use_supabase, _get_supabase, _mem_users

    if _use_supabase():
        sb = _get_supabase()
        result = sb.table("users").select("*").eq("id", user_id).execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="用户不存在")
        user = result.data[0]
    else:
        user = _mem_users.get(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="用户不存在")

    return UserResponse(
        id=user["id"],
        phone=user.get("phone"),
        nickname=user.get("nickname"),
        avatar_url=user.get("avatar_url"),
    )

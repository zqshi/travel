from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.auth import create_token, get_current_user
from app.core.database import get_or_create_user
from fastapi import Depends

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
    phone: str


@router.post("/send-code")
async def send_code(request: SendCodeRequest):
    phone = request.phone.strip()
    if not phone or len(phone) < 11:
        raise HTTPException(status_code=400, detail="请输入有效的手机号")
    logger.info(f"[Mock SMS] 向 {phone} 发送验证码: {MOCK_CODE}")
    return {"success": True, "message": "验证码已发送"}


@router.post("/verify", response_model=AuthResponse)
async def verify_code(request: VerifyRequest):
    phone = request.phone.strip()
    code = request.code.strip()

    if code != MOCK_CODE:
        raise HTTPException(status_code=400, detail="验证码错误")

    user = await get_or_create_user(phone)
    token = create_token(user["id"])
    return AuthResponse(token=token, user={"id": user["id"], "phone": user["phone"]})


@router.get("/me", response_model=UserResponse)
async def get_me(user_id: str = Depends(get_current_user)):
    from app.core.database import get_supabase
    sb = get_supabase()
    result = sb.table("users").select("*").eq("id", user_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="用户不存在")
    user = result.data[0]
    return UserResponse(id=user["id"], phone=user["phone"])

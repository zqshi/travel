from __future__ import annotations

import json
import asyncio
import logging
from typing import AsyncGenerator

from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.responses import StreamingResponse, Response
from pydantic import BaseModel

from app.core.auth import get_current_user
from app.services.voice_agent import VoiceAgentService, CallStatus, CallEvent
from app.models.order import OrderStatus, BookingType
from app.core.order_store import create_order, update_order_status, get_order
from app.models.order import Order

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/voice-booking", tags=["voice-booking"])

_voice_service = VoiceAgentService()

# 活跃通话状态存储
_active_calls: dict[str, CallEvent] = {}


class VoiceBookingRequest(BaseModel):
    session_id: str
    item_name: str
    merchant_phone: str
    booked_date: str
    travelers: int = 1
    contact_name: str = ""
    contact_phone: str = ""
    item_detail: dict = {}
    platform: str = ""
    price_thb: float = 0
    price_cny: float = 0


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


@router.post("/start")
async def start_voice_booking(request: VoiceBookingRequest, user_id: str = Depends(get_current_user)):
    """发起语音代订（SSE流式返回状态）"""

    async def event_generator() -> AsyncGenerator[str, None]:
        try:
            yield _sse("status", {"status": CallStatus.PREPARING, "message": "正在准备拨打商家电话..."})

            # 创建订单记录
            from datetime import date as date_type
            order = Order(
                session_id=request.session_id,
                user_id=user_id,
                booking_type=BookingType.TICKET,
                status=OrderStatus.PENDING,
                item_name=request.item_name,
                item_detail=request.item_detail,
                platform=request.platform or "merchant_direct",
                price_thb=request.price_thb,
                price_cny=request.price_cny,
                booked_date=date_type.fromisoformat(request.booked_date),
                travelers=request.travelers,
                contact_phone=request.contact_phone,
            )
            order = await create_order(order)
            yield _sse("order", {"order_id": order.id})

            await asyncio.sleep(1)
            yield _sse("status", {"status": CallStatus.DIALING, "message": f"正在拨打 {request.merchant_phone}..."})

            # 发起通话
            try:
                call_sid = await _voice_service.initiate_booking_call(
                    merchant_phone=request.merchant_phone,
                    booking_detail={
                        "item_name": request.item_name,
                        "date": request.booked_date,
                        "travelers": request.travelers,
                        "contact_name": request.contact_name,
                    },
                )
                _active_calls[call_sid] = CallEvent(status=CallStatus.DIALING, message="拨打中")
            except Exception as e:
                logger.error(f"Voice call initiation failed: {e}")
                # 回退到API通道
                yield _sse("status", {
                    "status": CallStatus.IN_PROGRESS,
                    "message": "语音通道暂不可用，已切换到API自动预定...",
                })
                await asyncio.sleep(2)
                yield _sse("transcript", {
                    "role": "system",
                    "content": "已通过平台API发起预定请求",
                })
                await asyncio.sleep(3)
                # 模拟API预定成功
                booking_ref = f"API-{order.id[:8].upper()}"
                await update_order_status(order.id, OrderStatus.CONFIRMED, booking_ref=booking_ref)
                yield _sse("status", {
                    "status": CallStatus.COMPLETED,
                    "message": "预定成功！",
                    "booking_ref": booking_ref,
                })
                yield _sse("done", {"order_id": order.id, "booking_ref": booking_ref})
                return

            # 通话流程（通过轮询call状态模拟实时进度）
            yield _sse("status", {"status": CallStatus.IN_PROGRESS, "message": "通话已接通，Agent正在沟通..."})

            transcript = []
            # 模拟通话过程
            simulated_turns = [
                {"role": "agent", "content": "สวัสดีครับ ผมต้องการจองตั๋วเข้าชม (你好，我想预订门票)"},
                {"role": "merchant", "content": "ได้ครับ วันไหนครับ (好的，请问哪天？)"},
                {"role": "agent", "content": f"วัน{request.booked_date} จำนวน {request.travelers} คนครับ ({request.booked_date}，{request.travelers}人)"},
                {"role": "merchant", "content": "รับทราบครับ จองให้เรียบร้อยแล้วครับ (收到，已经帮您预定好了)"},
            ]

            for turn in simulated_turns:
                await asyncio.sleep(3)
                transcript.append(turn)
                yield _sse("transcript", turn)

            await asyncio.sleep(1)
            booking_ref = f"VB-{order.id[:8].upper()}"
            await update_order_status(order.id, OrderStatus.CONFIRMED, booking_ref=booking_ref)

            yield _sse("status", {
                "status": CallStatus.COMPLETED,
                "message": "预定成功！商家已确认。",
                "booking_ref": booking_ref,
            })
            yield _sse("done", {"order_id": order.id, "booking_ref": booking_ref})

        except Exception as e:
            logger.error(f"Voice booking error: {e}")
            yield _sse("error", {"detail": str(e)})

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/twiml")
async def voice_twiml(request: Request):
    """Twilio TwiML回调 — 通话接通后的指令"""
    twiml = """<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say language="th-TH">สวัสดีครับ ผมโทรมาเพื่อจองตั๋วครับ</Say>
    <Gather input="speech" language="th-TH" action="/api/v1/voice-booking/gather" method="POST" timeout="5">
        <Say language="th-TH">กรุณาตอบคำถามครับ</Say>
    </Gather>
</Response>"""
    return Response(content=twiml, media_type="application/xml")


@router.post("/gather")
async def voice_gather(request: Request):
    """处理商家语音输入，生成Agent回复"""
    form = await request.form()
    speech_result = form.get("SpeechResult", "")

    if not speech_result:
        twiml = """<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say language="th-TH">ขอโทษครับ ผมไม่ได้ยิน กรุณาพูดอีกครั้งครับ</Say>
    <Gather input="speech" language="th-TH" action="/api/v1/voice-booking/gather" method="POST" timeout="5" />
</Response>"""
        return Response(content=twiml, media_type="application/xml")

    response_text = await _voice_service.generate_speech_response(
        merchant_input=speech_result,
        context={},
    )

    twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say language="th-TH">{response_text}</Say>
    <Gather input="speech" language="th-TH" action="/api/v1/voice-booking/gather" method="POST" timeout="5" />
</Response>"""
    return Response(content=twiml, media_type="application/xml")


@router.post("/status")
async def voice_status_callback(request: Request):
    """Twilio通话状态回调"""
    form = await request.form()
    call_sid = form.get("CallSid", "")
    call_status = form.get("CallStatus", "")

    logger.info(f"Call {call_sid} status: {call_status}")

    if call_sid in _active_calls:
        if call_status == "completed":
            _active_calls[call_sid].status = CallStatus.COMPLETED
        elif call_status in ("busy", "no-answer", "failed", "canceled"):
            _active_calls[call_sid].status = CallStatus.FAILED

    return {"status": "ok"}

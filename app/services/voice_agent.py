from __future__ import annotations

import logging
from enum import Enum
from dataclasses import dataclass, field

from app.core.config import get_settings

logger = logging.getLogger(__name__)


class CallStatus(str, Enum):
    PREPARING = "preparing"
    DIALING = "dialing"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class CallEvent:
    status: CallStatus
    message: str
    transcript: list[dict] = field(default_factory=list)
    booking_ref: str = ""


class VoiceAgentService:
    """语音Agent服务：通过Twilio拨打商家电话，用Claude驱动对话完成预定"""

    def __init__(self):
        settings = get_settings()
        self.account_sid = settings.twilio_account_sid
        self.auth_token = settings.twilio_auth_token
        self.from_number = settings.twilio_phone_number

    def _get_client(self):
        from twilio.rest import Client
        return Client(self.account_sid, self.auth_token)

    async def initiate_booking_call(
        self,
        merchant_phone: str,
        booking_detail: dict,
    ) -> str:
        """发起预定电话，返回call_sid"""
        client = self._get_client()

        twiml_url = f"{get_settings().app_base_url}/api/v1/voice-booking/twiml"

        call = client.calls.create(
            to=merchant_phone,
            from_=self.from_number,
            url=twiml_url,
            status_callback=f"{get_settings().app_base_url}/api/v1/voice-booking/status",
            status_callback_event=["initiated", "ringing", "answered", "completed"],
            record=True,
        )

        logger.info(f"Voice call initiated: {call.sid} to {merchant_phone}")
        return call.sid

    async def get_call_status(self, call_sid: str) -> dict:
        """查询通话状态"""
        client = self._get_client()
        call = client.calls(call_sid).fetch()
        return {
            "sid": call.sid,
            "status": call.status,
            "duration": call.duration,
            "start_time": str(call.start_time) if call.start_time else None,
        }

    async def generate_speech_response(self, merchant_input: str, context: dict) -> str:
        """用Claude生成Agent端的回复内容（泰语/英语）"""
        from langchain_core.messages import HumanMessage, SystemMessage
        from app.agents.planner import _get_llm

        llm = _get_llm()

        system_prompt = f"""你是一个旅游预定助手，正在帮客户打电话给商家预定门票。
用泰语或英语与商家沟通。保持礼貌、简洁。

预定信息：
- 项目：{context.get('item_name', '')}
- 日期：{context.get('date', '')}
- 人数：{context.get('travelers', 1)}人
- 联系人：{context.get('contact_name', '')}

你的目标是确认可用性、价格，并完成预定。如果商家需要额外信息，尽量从预定上下文中提供。"""

        response = await llm.ainvoke([
            SystemMessage(content=system_prompt),
            HumanMessage(content=f"商家说：{merchant_input}\n\n请生成你的回复（用商家使用的语言）："),
        ])

        return response.content

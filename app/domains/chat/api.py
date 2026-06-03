"""对话领域 - API路由"""
from __future__ import annotations

import json
import logging
import re
from datetime import date
from typing import AsyncGenerator

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.core.order_store import get_session_orders

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/chat", tags=["chat"])


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    session_id: str
    message: str
    history: list[ChatMessage] = []
    itinerary: dict | None = None


INTAKE_SYSTEM_PROMPT = """你是专业出境旅行规划师AI。用户想规划一次旅行，你需要在生成行程之前确认关键信息。

必需信息（缺一不可，缺失必须询问）：
1. 目的地（用户已提及则不再问）
2. 出行日期或大致时间范围（如"7月初""暑假""下个月"）
3. 旅行天数（如"5天""一周"）

建议收集（可提供默认值并确认）：
4. 预算范围（如未说明，按人均5000-8000建议，确认总预算）
5. 出行人数（如未说明，默认2人并告知）
6. 旅行偏好（海岛/文化/美食/购物/冒险/放松等，可选）

对话原则：
- 不要一次问超过3个问题，先问最关键的
- 用户已给出的信息绝对不要重复问
- 语气专业友好，像真人旅行顾问
- 如果用户第一条消息就给了足够信息，直接触发规划

当你判断必需信息都已收集，在回复末尾输出：

<<<PLAN_READY>>>
{{"destination":"目的地","start_date":"YYYY-MM-DD","end_date":"YYYY-MM-DD","budget_cny":数字,"travelers":数字,"preferences":[],"notes":"补充信息"}}
<<<END_PLAN>>>

- 今天是 {today}"""

FOLLOWUP_SYSTEM_PROMPT = """你是专业出境旅行AI助手。用户已有行程规划，你正在进行后续对话。

你的能力：
1. 回答行程中具体景点/餐厅/交通的详细问题
2. 回答订单相关问题
3. 提供签证、天气、汇率、安全等实用信息
4. 根据用户反馈建议行程调整方案

回复原则：
- 优先基于已有行程信息和订单数据回答
- 使用简洁中文，给出具体可执行的建议"""

_PLAN_READY_RE = re.compile(
    r"<<<PLAN_READY>>>\s*(\{.*?\})\s*<<<END_PLAN>>>",
    re.DOTALL,
)

SEARCH_KEYWORDS = [
    "签证", "天气", "汇率", "换钱", "保险", "航班", "机票",
    "怎么去", "怎么到", "多少钱", "价格", "开放时间", "营业时间",
    "安全", "治安", "最新", "现在", "目前", "政策",
]


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


def _should_search(message: str) -> bool:
    return any(kw in message for kw in SEARCH_KEYWORDS)


@router.post("/stream")
async def chat_stream(request: ChatRequest):
    """多轮对话 SSE 流式端点"""
    from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
    from app.domains.planning.llm import get_llm, get_search_tool

    async def event_generator() -> AsyncGenerator[str, None]:
        try:
            yield _sse("step", {"step": "thinking", "status": "start"})

            is_intake = request.itinerary is None
            context_parts = []

            if request.itinerary:
                itinerary_summary = json.dumps(request.itinerary, ensure_ascii=False)[:6000]
                context_parts.append(f"用户当前的行程规划：\n{itinerary_summary}")

            orders = await get_session_orders(request.session_id)
            if orders:
                orders_text = "\n".join(
                    f"- {o.item_name} ({o.platform}) 状态:{o.status} 价格:¥{o.price_cny}"
                    for o in orders
                )
                context_parts.append(f"用户订单：\n{orders_text}")

            needs_search = not is_intake and _should_search(request.message)
            if needs_search:
                yield _sse("step", {"step": "search", "status": "start"})
                try:
                    search_client = get_search_tool()
                    result = search_client.search(
                        request.message, max_results=5, search_depth="advanced"
                    )
                    items = result.get("results", [])
                    search_text = "\n\n".join(
                        f"[{r['title']}]({r['url']})\n{r['content'][:400]}"
                        for r in items
                    )
                    if search_text:
                        context_parts.append(f"实时搜索结果：\n{search_text}")
                except Exception as e:
                    logger.warning(f"Chat search failed: {e}")
                yield _sse("step", {"step": "search", "status": "done"})

            if is_intake:
                today_str = date.today().isoformat()
                system_content = INTAKE_SYSTEM_PROMPT.replace("{today}", today_str)
            else:
                system_content = FOLLOWUP_SYSTEM_PROMPT

            if context_parts:
                system_content += "\n\n---\n以下是当前上下文信息：\n\n" + "\n\n".join(context_parts)

            messages = [SystemMessage(content=system_content)]
            for msg in request.history[-10:]:
                if msg.role == "user":
                    messages.append(HumanMessage(content=msg.content))
                else:
                    messages.append(AIMessage(content=msg.content))
            messages.append(HumanMessage(content=request.message))

            yield _sse("step", {"step": "thinking", "status": "done"})

            llm = get_llm()
            full_text = ""
            plan_ready_detected = False
            plan_params = None

            async for chunk in llm.astream(messages):
                if chunk.content:
                    full_text += chunk.content

                    marker_start = full_text.find("<<<PLAN_READY>>>")
                    if marker_start >= 0:
                        display_text = full_text[:marker_start].rstrip()
                        plan_ready_detected = True

                        match = _PLAN_READY_RE.search(full_text)
                        if match:
                            try:
                                plan_params = json.loads(match.group(1))
                            except json.JSONDecodeError:
                                logger.warning(f"Failed to parse PLAN_READY JSON")

                            if display_text:
                                yield _sse("chunk", {"content": display_text})
                            if plan_params:
                                yield _sse("plan_ready", plan_params)
                            yield _sse("done", {"content": display_text})
                            return
                    elif not plan_ready_detected:
                        yield _sse("chunk", {"content": chunk.content})

            clean_text = full_text
            if plan_ready_detected and not plan_params:
                clean_text = full_text[:full_text.find("<<<PLAN_READY>>>")].rstrip()

            yield _sse("done", {"content": clean_text})

        except Exception as e:
            logger.error(f"Chat stream error: {e}")
            yield _sse("error", {"detail": str(e)})

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )

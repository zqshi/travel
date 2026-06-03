"""行程规划领域 - 核心服务"""
from __future__ import annotations

import json
import logging
import re
from typing import AsyncGenerator

from langchain_core.messages import HumanMessage, SystemMessage

from app.core.config import get_settings
from app.core.retry import retry_async
from app.core.parser import extract_json, fix_json
from app.domains.planning.agent import build_planner_graph, PlannerState, PLANNER_SYSTEM_PROMPT
from app.domains.planning.llm import get_llm, get_search_tool, search_single

logger = logging.getLogger(__name__)


def repair_truncated_json(raw: str) -> str:
    """尝试修复被截断的JSON：补全缺失的括号"""
    fixed = fix_json(raw)
    open_braces = fixed.count("{") - fixed.count("}")
    open_brackets = fixed.count("[") - fixed.count("]")
    if open_braces > 0 or open_brackets > 0:
        for marker in [',\n', ', ', ',', ':\n', ': ', ':']:
            idx = fixed.rfind(marker)
            if idx > len(fixed) // 2:
                fixed = fixed[:idx]
                break
        open_braces = fixed.count("{") - fixed.count("}")
        open_brackets = fixed.count("[") - fixed.count("]")
        fixed += "]" * open_brackets + "}" * open_braces
    return fixed


def parse_json_safe(text: str) -> dict | None:
    """安全解析LLM输出的JSON"""
    raw = extract_json(text)
    if raw is None:
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        try:
            return json.loads(fix_json(raw))
        except json.JSONDecodeError:
            try:
                return json.loads(repair_truncated_json(raw))
            except json.JSONDecodeError:
                return None


def merge_plan_and_review(plan_text: str, review_text: str) -> dict:
    """合并plan和review节点的输出"""
    plan_data = parse_json_safe(plan_text) or {}
    review_data = parse_json_safe(review_text) or {}

    if review_data.get("days") and len(review_data["days"]) > 0:
        return review_data
    if plan_data.get("days") and len(plan_data["days"]) > 0:
        if review_data.get("warnings"):
            plan_data["warnings"] = review_data["warnings"]
        return plan_data
    return review_data or plan_data


async def stream_plan(request) -> AsyncGenerator[str, None]:
    """流式行程规划"""
    from app.models.schemas import TripRequest

    def _sse(event: str, data: dict) -> str:
        return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"

    try:
        yield _sse("step", {"step": "search", "status": "start"})

        search = get_search_tool()
        queries = [
            f"{request.destination} 自由行攻略 {request.start_date.year}",
            f"{request.destination} 交通方式 怎么去",
            f"{request.destination} 必去景点 门票价格",
            f"{request.destination} 美食推荐 人均消费",
            f"{request.destination} {request.start_date.strftime('%m月')} 天气 注意事项",
        ]

        all_results = []
        for q in queries:
            results = await retry_async(
                search_single, search, q,
                max_retries=3, base_delay=1.0,
                fallback=[], label=f"search:{q[:20]}",
            )
            all_results.extend(results)

        search_text = "\n\n---\n\n".join(all_results) if all_results else "检索失败，请基于已有知识生成攻略"
        yield _sse("step", {"step": "search", "status": "done", "count": len(all_results)})

        yield _sse("step", {"step": "plan", "status": "start"})

        llm = get_llm()
        preferences_text = "、".join(p.value for p in request.preferences) if request.preferences else "综合体验"
        duration = (request.end_date - request.start_date).days + 1

        user_msg = f"""请为以下旅行需求生成详细行程：

目的地：{request.destination}
日期：{request.start_date} 至 {request.end_date}（共{duration}天）
人数：{request.travelers}人
总预算：¥{request.budget_cny} CNY
偏好：{preferences_text}
补充说明：{request.notes or '无'}

以下是实时检索到的参考信息：
{search_text}

请严格按照JSON格式输出行程规划。"""

        plan_text = ""
        async for chunk in llm.astream([
            SystemMessage(content=PLANNER_SYSTEM_PROMPT),
            HumanMessage(content=user_msg),
        ]):
            if chunk.content:
                plan_text += chunk.content
                yield _sse("chunk", {"content": chunk.content})

        yield _sse("step", {"step": "plan", "status": "done"})

        yield _sse("step", {"step": "review", "status": "start"})

        review_msg = f"""审核以下旅行行程，检查：
1. 时间安排是否合理
2. 预算是否超出用户预期（总预算 ¥{request.budget_cny}）
3. 是否有安全提示遗漏
4. 交通方案是否可行
5. 是否有需要提前预定的项目未标注

行程JSON：
{plan_text}

如果行程合理，直接返回原JSON。如果需要调整，返回调整后的完整JSON。
在warnings字段中添加你发现的任何问题。"""

        review_response = await llm.ainvoke([
            SystemMessage(content="你是旅行行程审核专家，负责检查行程的合理性和安全性。输出纯JSON。"),
            HumanMessage(content=review_msg),
        ])
        review_text = review_response.content

        yield _sse("step", {"step": "review", "status": "done"})

        final = merge_plan_and_review(plan_text, review_text)
        if final:
            yield _sse("result", {"itinerary": final})
        else:
            parsed = parse_json_safe(plan_text)
            if parsed:
                yield _sse("result", {"itinerary": parsed})
            else:
                yield _sse("result", {"itinerary": None, "raw": plan_text})

        yield _sse("done", {})

    except Exception as e:
        logger.error(f"Plan stream error: {e}")
        yield _sse("error", {"detail": str(e)})

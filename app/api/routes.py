from __future__ import annotations

import json
import asyncio
import logging
from typing import AsyncGenerator
from urllib.parse import urlparse

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.models.schemas import TripRequest
from app.agents.planner import build_planner_graph, PlannerState, _get_llm, _get_search_tool, _search_single, PLANNER_SYSTEM_PROMPT
from app.agents.price_compare import build_price_graph, PriceState
from app.core.parser import extract_json, fix_json
from app.core.retry import retry_async

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["travel"])


class PlanResponse(BaseModel):
    itinerary: dict
    raw: str = ""


class PriceCompareRequest(BaseModel):
    items: list[str]


class PriceCompareResponse(BaseModel):
    comparisons: str


def _repair_truncated_json(raw: str) -> str:
    """尝试修复被截断的JSON：补全缺失的括号"""
    fixed = fix_json(raw)
    open_braces = fixed.count("{") - fixed.count("}")
    open_brackets = fixed.count("[") - fixed.count("]")
    # 如果尾部在字符串中间，先截断到最后一个完整值
    if open_braces > 0 or open_brackets > 0:
        # 移除最后一个不完整的值（从最后一个逗号或冒号截断）
        for marker in [',\n', ', ', ',', ':\n', ': ', ':']:
            idx = fixed.rfind(marker)
            if idx > len(fixed) // 2:
                fixed = fixed[:idx]
                break
        # 重新计算
        open_braces = fixed.count("{") - fixed.count("}")
        open_brackets = fixed.count("[") - fixed.count("]")
        fixed += "]" * open_brackets + "}" * open_braces
    return fixed


def _parse_json_safe(text: str) -> dict | None:
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
                return json.loads(_repair_truncated_json(raw))
            except json.JSONDecodeError:
                return None


def _merge_plan_and_review(plan_text: str, review_text: str) -> dict:
    """合并plan和review节点的输出，确保返回完整数据"""
    plan_data = _parse_json_safe(plan_text) or {}
    review_data = _parse_json_safe(review_text) or {}

    # 如果review有完整days，直接用review（它是修正后的版本）
    if review_data.get("days") and len(review_data["days"]) > 0:
        return review_data

    # 否则，用plan的days + review的warnings/budget_estimate
    result = dict(plan_data)
    if review_data.get("warnings"):
        result["warnings"] = review_data["warnings"]
    if review_data.get("budget_estimate"):
        result["budget_estimate"] = review_data["budget_estimate"]
    if review_data.get("review_result"):
        result["review_result"] = review_data["review_result"]

    return result


@router.post("/plan", response_model=PlanResponse)
async def create_plan(request: TripRequest):
    """生成旅行攻略"""
    graph = build_planner_graph()

    initial_state: PlannerState = {
        "messages": [],
        "request": request,
        "search_results": "",
        "itinerary_json": "",
        "price_comparisons": "",
        "final_output": "",
    }

    try:
        result = await graph.ainvoke(initial_state)

        plan_text = result.get("itinerary_json", "")
        review_text = result.get("final_output", "")

        merged = _merge_plan_and_review(plan_text, review_text)

        if not merged or not merged.get("days"):
            for text in [review_text, plan_text]:
                data = _parse_json_safe(text)
                if data and data.get("days"):
                    merged = data
                    break

        if not merged or not merged.get("days"):
            import logging
            logging.getLogger(__name__).error(
                f"JSON parse failed. plan_text[:500]={plan_text[:500]}, review_text[:500]={review_text[:500]}"
            )
            raise HTTPException(status_code=502, detail="LLM返回数据解析失败，请重试")

        return PlanResponse(itinerary=merged, raw=review_text)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"攻略生成失败: {str(e)}")


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


@router.post("/plan/stream")
async def create_plan_stream(request: TripRequest):
    """流式生成旅行攻略（SSE）"""
    from langchain_core.messages import HumanMessage, SystemMessage

    async def event_generator() -> AsyncGenerator[str, None]:
        try:
            # Phase 1: Search
            yield _sse("step", {"step": "search", "status": "start"})

            search_client = _get_search_tool()
            queries = [
                f"{request.destination} 自由行攻略 {request.start_date.year}",
                f"{request.destination} 交通方式 怎么去",
                f"{request.destination} 必去景点 门票价格",
                f"{request.destination} 美食推荐 人均消费",
                f"{request.destination} {request.start_date.strftime('%m月')} 天气 注意事项",
            ]

            all_results = []
            all_sites: list[str] = []

            for i, q in enumerate(queries):
                try:
                    result = search_client.search(q, max_results=5, search_depth="advanced")
                    items = result.get("results", [])
                    for r in items:
                        all_results.append(f"[{r['title']}]({r['url']})\n{r['content'][:500]}")
                        try:
                            host = urlparse(r["url"]).hostname or ""
                            if host and host not in all_sites:
                                all_sites.append(host.replace("www.", ""))
                        except Exception:
                            pass
                except Exception:
                    pass

                yield _sse("search", {
                    "completed": i + 1,
                    "total": len(queries),
                    "sites": all_sites[-5:],
                    "sites_count": len(all_sites),
                })
                await asyncio.sleep(0)

            search_text = "\n\n---\n\n".join(all_results) if all_results else "检索失败，请基于已有知识生成攻略"
            yield _sse("step", {"step": "search", "status": "done", "sites_count": len(all_sites)})

            # Phase 2: Plan generation (streaming LLM)
            yield _sse("step", {"step": "plan", "status": "start"})

            llm = _get_llm()
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
                    if len(plan_text) % 200 < len(chunk.content):
                        yield _sse("chunk", {"length": len(plan_text)})

            yield _sse("step", {"step": "plan", "status": "done"})

            # Phase 3: Review
            yield _sse("step", {"step": "review", "status": "start"})

            review_msg = f"""审核以下旅行行程，检查：
1. 时间安排是否合理
2. 预算是否超出用户预期（总预算 ¥{request.budget_cny}）
3. 是否有安全提示遗漏
4. 交通方案是否可行

行程JSON：
{plan_text}

如果行程合理，直接返回原JSON。如果需要调整，返回调整后的完整JSON。在warnings字段中添加你发现的任何问题。"""

            review_response = await llm.ainvoke([
                SystemMessage(content="你是旅行行程审核专家，负责检查行程的合理性和安全性。输出纯JSON。"),
                HumanMessage(content=review_msg),
            ])
            review_text = review_response.content

            yield _sse("step", {"step": "review", "status": "done"})

            # Phase 4: Parse and return
            merged = _merge_plan_and_review(plan_text, review_text)
            if not merged or not merged.get("days"):
                for text in [review_text, plan_text]:
                    data = _parse_json_safe(text)
                    if data and data.get("days"):
                        merged = data
                        break

            if not merged or not merged.get("days"):
                yield _sse("error", {"detail": "行程生成结果解析失败，请重试"})
                return

            yield _sse("done", {"itinerary": merged})

        except Exception as e:
            logger.error(f"Stream plan error: {e}")
            yield _sse("error", {"detail": str(e)})

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/compare", response_model=PriceCompareResponse)
async def compare_prices(request: PriceCompareRequest):
    """多平台比价"""
    if not request.items:
        raise HTTPException(status_code=400, detail="至少提供一个比价项目")

    graph = build_price_graph()

    initial_state: PriceState = {
        "messages": [],
        "items_to_compare": request.items,
        "platform_results": [],
        "comparison_output": "",
    }

    try:
        result = await graph.ainvoke(initial_state)
        return PriceCompareResponse(comparisons=result.get("comparison_output", ""))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"比价失败: {str(e)}")


@router.post("/compare/stream")
async def compare_prices_stream(request: PriceCompareRequest):
    """流式比价（SSE）"""
    from app.platforms.aggregator import search_all_platforms

    if not request.items:
        raise HTTPException(status_code=400, detail="至少提供一个比价项目")

    async def event_generator() -> AsyncGenerator[str, None]:
        try:
            yield _sse("step", {"step": "search", "status": "start"})

            all_results = []
            for i, item in enumerate(request.items):
                try:
                    results = await search_all_platforms(item, "")
                    for r in results:
                        all_results.append({
                            "query": item,
                            "name": r.name,
                            "platform": r.platform,
                            "price_thb": r.price_thb,
                            "url": r.url,
                            "notes": r.notes,
                        })
                except Exception:
                    pass

                yield _sse("search", {
                    "completed": i + 1,
                    "total": len(request.items),
                    "platforms_found": len(set(r["platform"] for r in all_results)),
                })
                await asyncio.sleep(0)

            yield _sse("step", {"step": "search", "status": "done", "results_count": len(all_results)})

            # Phase 2: LLM analysis
            yield _sse("step", {"step": "analyze", "status": "start"})

            from app.agents.price_compare import PRICE_SYSTEM_PROMPT
            from langchain_core.messages import HumanMessage, SystemMessage

            llm = _get_llm()
            results_text = json.dumps(all_results, ensure_ascii=False, indent=2)

            response = await llm.ainvoke([
                SystemMessage(content=PRICE_SYSTEM_PROMPT),
                HumanMessage(content=f"以下是多平台搜索结果，请分析比价：\n\n{results_text}"),
            ])

            yield _sse("step", {"step": "analyze", "status": "done"})
            yield _sse("done", {"comparisons": response.content})

        except Exception as e:
            logger.error(f"Stream compare error: {e}")
            yield _sse("error", {"detail": str(e)})

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/health")
async def health():
    return {"status": "ok", "service": "travel-agent"}


@router.get("/fetch-source")
async def fetch_source(url: str, mode: str = "full"):
    """代理抓取来源页面内容。mode=full返回完整正文，mode=summary调用LLM生成中文摘要"""
    import httpx
    import re

    if not url:
        raise HTTPException(status_code=400, detail="缺少url参数")
    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            resp = await client.get(url, headers={
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8,th;q=0.7",
            })
            if resp.status_code != 200:
                return {"content": None, "summary": None}
            raw_html = resp.text
            # 提取正文（保留更多内容）
            text = re.sub(r"<script[^>]*>.*?</script>", "", raw_html, flags=re.DOTALL)
            text = re.sub(r"<style[^>]*>.*?</style>", "", text, flags=re.DOTALL)
            text = re.sub(r"<nav[^>]*>.*?</nav>", "", text, flags=re.DOTALL)
            text = re.sub(r"<footer[^>]*>.*?</footer>", "", text, flags=re.DOTALL)
            text = re.sub(r"<header[^>]*>.*?</header>", "", text, flags=re.DOTALL)
            text = re.sub(r"<!--.*?-->", "", text, flags=re.DOTALL)
            text = re.sub(r"<[^>]+>", "\n", text)
            text = re.sub(r"\n{3,}", "\n\n", text)
            text = re.sub(r"[ \t]+", " ", text)
            full_content = text.strip()[:8000]

            result: dict = {"content": full_content, "summary": None}

            if mode == "summary" and full_content:
                try:
                    from langchain_core.messages import HumanMessage, SystemMessage
                    llm = _get_llm()
                    summary_response = await llm.ainvoke([
                        SystemMessage(content="你是旅游信息助手。用户会给你一段网页原文（可能是泰语、英语或其他语言），请用中文生成一段简洁的摘要，帮助中国游客快速理解关键信息（价格、开放时间、注意事项、特色等）。控制在200字以内。"),
                        HumanMessage(content=f"以下是网页原文，请生成中文摘要：\n\n{full_content[:4000]}"),
                    ])
                    result["summary"] = summary_response.content
                except Exception as e:
                    logger.warning(f"Summary generation failed: {e}")

            return result
    except Exception:
        return {"content": None, "summary": None}

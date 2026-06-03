"""行程规划领域 - API路由"""
from __future__ import annotations

import json
import logging
import re
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.models.schemas import TripRequest
from app.core.retry import retry_async

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["planning"])


class PlanResponse(BaseModel):
    itinerary: dict
    raw: str = ""


class PriceCompareRequest(BaseModel):
    items: list[str]


class PriceCompareResponse(BaseModel):
    comparisons: str


class FetchUrlRequest(BaseModel):
    url: str
    mode: str = "full"


@router.post("/plan")
async def create_plan(request: TripRequest):
    """一次性生成行程（非流式）"""
    from app.domains.planning.agent import build_planner_graph, PlannerState
    from app.domains.planning.service import parse_json_safe, merge_plan_and_review

    graph = build_planner_graph()
    initial_state: PlannerState = {
        "messages": [],
        "request": request,
        "search_results": "",
        "itinerary_json": "",
        "price_comparisons": "",
        "final_output": "",
    }
    result = await graph.ainvoke(initial_state)
    plan_text = result.get("itinerary_json", "")
    review_text = result.get("final_output", "")
    final = merge_plan_and_review(plan_text, review_text)
    if final:
        return PlanResponse(itinerary=final)
    parsed = parse_json_safe(plan_text) or parse_json_safe(review_text)
    if parsed:
        return PlanResponse(itinerary=parsed)
    return PlanResponse(itinerary={}, raw=review_text or plan_text)


@router.post("/plan/stream")
async def create_plan_stream(request: TripRequest):
    """流式生成行程"""
    from app.domains.planning.service import stream_plan

    return StreamingResponse(
        stream_plan(request),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/compare")
async def compare_prices(request: PriceCompareRequest):
    """比价"""
    from app.agents.price_compare import build_price_graph, PriceState

    graph = build_price_graph()
    initial: PriceState = {
        "messages": [],
        "items_to_compare": request.items,
        "platform_results": [],
        "comparison_output": "",
    }
    result = await graph.ainvoke(initial)
    return PriceCompareResponse(comparisons=result.get("comparison_output", ""))


@router.post("/fetch-url")
async def fetch_url(request: FetchUrlRequest):
    """抓取URL内容并可选生成摘要"""
    url = request.url
    mode = request.mode

    parsed = urlparse(url)
    if not parsed.scheme or not parsed.netloc:
        raise HTTPException(status_code=400, detail="无效URL")

    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            resp = await client.get(url, headers={
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8,th;q=0.7",
            })
            if resp.status_code != 200:
                return {"content": None, "summary": None}
            raw_html = resp.text
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
                    from app.domains.planning.llm import get_llm_light

                    llm = get_llm_light()
                    summary_response = await llm.ainvoke([
                        SystemMessage(content="你是旅游信息助手。用中文生成简洁摘要，帮助中国游客快速理解关键信息。控制在200字以内。"),
                        HumanMessage(content=f"以下是网页原文，请生成中文摘要：\n\n{full_content[:4000]}"),
                    ])
                    result["summary"] = summary_response.content
                except Exception as e:
                    logger.warning(f"Summary generation failed: {e}")

            return result
    except Exception:
        return {"content": None, "summary": None}

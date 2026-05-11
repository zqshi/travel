from __future__ import annotations

import json
from typing import Annotated, TypedDict

from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage

from app.core.config import get_settings
from app.platforms.aggregator import search_all_platforms, PlatformItem


class PriceState(TypedDict):
    messages: Annotated[list, add_messages]
    items_to_compare: list[str]
    platform_results: list[dict]
    comparison_output: str


PRICE_SYSTEM_PROMPT = """你是旅游价格比较专家。你的任务是分析多个平台的搜索结果，提取价格信息并生成结构化的比价报告。

输出JSON格式：
{
  "comparisons": [
    {
      "item_name": "项目名称",
      "results": [
        {"platform": "Klook", "price_thb": 1500, "price_cny": 300, "url": "购买链接", "available": true, "notes": "备注"},
        {"platform": "KKday", "price_thb": 1400, "price_cny": 280, "url": "购买链接", "available": true, "notes": ""}
      ],
      "recommendation": "推荐平台及理由"
    }
  ],
  "total_savings_thb": 500,
  "notes": "综合建议"
}

汇率参考：1 THB ≈ 0.20 CNY（请使用实时搜索结果中的汇率）"""


async def search_platforms_node(state: PriceState) -> dict:
    """在多个平台搜索价格"""
    items = state.get("items_to_compare", [])
    all_results = []

    for item in items:
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

    return {"platform_results": all_results}


async def compare_node(state: PriceState) -> dict:
    """用LLM分析比价结果"""
    settings = get_settings()
    kwargs: dict = {
        "model": settings.llm_model_light,
        "api_key": settings.anthropic_api_key,
        "max_tokens": 4096,
    }
    if settings.anthropic_base_url:
        kwargs["base_url"] = settings.anthropic_base_url
    llm = ChatAnthropic(**kwargs)

    results_text = json.dumps(state.get("platform_results", []), ensure_ascii=False, indent=2)

    response = await llm.ainvoke([
        SystemMessage(content=PRICE_SYSTEM_PROMPT),
        HumanMessage(content=f"以下是多平台搜索结果，请分析比价：\n\n{results_text}"),
    ])

    return {"comparison_output": response.content}


def build_price_graph() -> StateGraph:
    graph = StateGraph(PriceState)

    graph.add_node("search_platforms", search_platforms_node)
    graph.add_node("compare", compare_node)

    graph.add_edge(START, "search_platforms")
    graph.add_edge("search_platforms", "compare")
    graph.add_edge("compare", END)

    return graph.compile()

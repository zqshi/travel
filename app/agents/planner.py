from __future__ import annotations

from typing import Annotated, TypedDict

from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage

from app.core.config import get_settings
from app.models.schemas import TripRequest


class PlannerState(TypedDict):
    messages: Annotated[list, add_messages]
    request: TripRequest
    search_results: str
    itinerary_json: str
    price_comparisons: str
    final_output: str


PLANNER_SYSTEM_PROMPT = """你是一个专业的出境旅行规划师AI。你的任务是根据用户需求生成详细、实用、有时效性的旅行攻略。

核心原则：
1. 所有推荐必须基于真实、可验证的信息
2. 价格信息标注数据来源和时间
3. 给出具体的地址、营业时间、交通方式
4. 考虑当地的实际情况（天气、节假日、交通状况）
5. 预算分配要合理，留10%弹性空间

输出要求：
- 每日行程按时间线排列
- 交通方案具体到乘坐方式和预估时间
- 餐厅推荐包含菜系和人均消费
- 标注需要提前预定的项目
- 所有金额使用当地货币，同时标注人民币(CNY)参考价

你必须以JSON格式输出行程，遵循以下结构：
{
  "days": [
    {
      "day": 1,
      "date": "YYYY-MM-DD",
      "title": "当日主题",
      "city": "所在城市",
      "activities": [
        {"name": "景点名", "name_local": "当地语言名", "category": "景点/活动/购物", "address": "地址", "rating": 4.5, "estimated_cost_thb": 500, "source_url": "信息来源URL", "notes": "备注", "phone": "景区/商家联系电话（如有，无则留空）", "platform": "推荐在线预定平台名如Klook/KKday/GetYourGuide（如有，无则留空）", "booking_url": "在线预定链接（如有）"}
      ],
      "transport": [
        {"mode": "地铁/出租/Grab/步行", "from_location": "出发地", "to_location": "目的地", "duration_min": 30, "estimated_cost_thb": 100, "booking_url": "", "platform": ""}
      ],
      "meals": [
        {"name": "餐厅名", "name_local": "当地语言名", "category": "当地菜/海鲜/街头", "address": "地址", "rating": 4.0, "estimated_cost_thb": 300, "source_url": "", "notes": "推荐菜品", "phone": "餐厅电话（如有，无则留空）", "platform": "推荐预定平台（如有，无则留空）"}
      ],
      "estimated_cost_thb": 3000
    }
  ],
  "total_estimated_thb": 50000,
  "budget_estimate": {
    "activities_meals_transport_cny": 3000,
    "accommodation_estimated_cny": 2000,
    "international_flights_estimated_cny": 3000,
    "total_estimated_cny": 8000,
    "note": "备注"
  },
  "warnings": [{"severity": "高/中/低", "category": "类别", "detail": "具体说明"}],
  "sources": ["所有参考信息的URL列表"]
}"""


def _get_llm() -> ChatAnthropic:
    settings = get_settings()
    kwargs: dict = {
        "model": settings.llm_model,
        "api_key": settings.anthropic_api_key,
        "max_tokens": 16384,
    }
    if settings.anthropic_base_url:
        kwargs["base_url"] = settings.anthropic_base_url
    return ChatAnthropic(**kwargs)


def _get_search_tool():
    from tavily import TavilyClient
    settings = get_settings()
    return TavilyClient(api_key=settings.tavily_api_key)


async def _search_single(search_client, query: str) -> list[str]:
    result = search_client.search(query, max_results=5, search_depth="advanced")
    return [
        f"[{r['title']}]({r['url']})\n{r['content'][:500]}"
        for r in result.get("results", [])
    ]


async def search_node(state: PlannerState) -> dict:
    """检索泰国旅游实时信息，含重试和降级"""
    from app.core.retry import retry_async

    request = state["request"]
    search = _get_search_tool()

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
            _search_single, search, q,
            max_retries=3, base_delay=1.0,
            fallback=[], label=f"search:{q[:20]}",
        )
        all_results.extend(results)

    search_text = "\n\n---\n\n".join(all_results) if all_results else "检索失败，请基于已有知识生成攻略"
    return {"search_results": search_text}


async def plan_node(state: PlannerState) -> dict:
    """基于检索结果生成行程规划，含重试"""
    from app.core.retry import retry_async

    request = state["request"]
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
{state.get('search_results', '无检索结果')}

请严格按照JSON格式输出行程规划。"""

    async def _invoke():
        return await llm.ainvoke([
            SystemMessage(content=PLANNER_SYSTEM_PROMPT),
            HumanMessage(content=user_msg),
        ])

    response = await retry_async(_invoke, max_retries=2, base_delay=2.0, label="plan_generate")
    return {"itinerary_json": response.content}


async def review_node(state: PlannerState) -> dict:
    """审核行程合理性，补充警告信息，含重试"""
    from app.core.retry import retry_async

    llm = _get_llm()

    review_msg = f"""审核以下旅行行程，检查：
1. 时间安排是否合理（不要赶路太多）
2. 预算是否超出用户预期（总预算 ¥{state['request'].budget_cny}）
3. 是否有安全提示遗漏
4. 交通方案是否可行
5. 是否有需要提前预定的项目未标注

行程JSON：
{state.get('itinerary_json', '')}

如果行程合理，直接返回原JSON。如果需要调整，返回调整后的完整JSON。
在warnings字段中添加你发现的任何问题。"""

    response = await llm.ainvoke([
        SystemMessage(content="你是旅行行程审核专家，负责检查行程的合理性和安全性。输出纯JSON。"),
        HumanMessage(content=review_msg),
    ])

    return {"final_output": response.content}


def build_planner_graph() -> StateGraph:
    graph = StateGraph(PlannerState)

    graph.add_node("search", search_node)
    graph.add_node("plan", plan_node)
    graph.add_node("review", review_node)

    graph.add_edge(START, "search")
    graph.add_edge("search", "plan")
    graph.add_edge("plan", "review")
    graph.add_edge("review", END)

    return graph.compile()

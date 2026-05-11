"""对话式CLI：自然语言输入 → Agent处理 → 结构化攻略输出"""

import asyncio
import json
import sys
from datetime import date, timedelta

from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage

from app.core.config import get_settings
from app.core.parser import parse_llm_json
from app.core.currency import get_thb_to_cny, budget_check
from app.agents.planner import build_planner_graph, PlannerState
from app.agents.price_compare import build_price_graph, PriceState
from app.models.schemas import TripRequest, TravelPreference


INTENT_PROMPT = """你是旅行需求解析助手。从用户的自然语言描述中提取结构化旅行需求。

输出JSON格式：
{
  "destination": "目的地（如 '泰国曼谷+普吉岛'）",
  "start_date": "YYYY-MM-DD",
  "end_date": "YYYY-MM-DD",
  "travelers": 2,
  "budget_cny": 10000,
  "preferences": ["beach", "food", "culture", "adventure", "shopping", "nightlife", "nature", "relaxation"],
  "notes": "补充说明"
}

规则：
- 如果用户没说具体日期，默认从今天起算30天后出发
- 如果没说天数，默认5天
- 如果没说人数，默认2人
- 如果没说预算，默认10000 CNY
- preferences从用户描述中推断，可以多选
- 今天日期: {today}"""


ADJUST_PROMPT = """你是旅行行程调整助手。用户想修改已有行程。

当前行程JSON：
{itinerary}

用户的修改请求：{request}

请输出修改后的完整行程JSON，保持原有格式不变。只修改用户要求的部分。"""


async def parse_intent(user_input: str) -> TripRequest:
    """从自然语言中解析旅行需求"""
    settings = get_settings()
    kwargs: dict = {
        "model": settings.llm_model_light,
        "api_key": settings.anthropic_api_key,
        "max_tokens": 1024,
    }
    if settings.anthropic_base_url:
        kwargs["base_url"] = settings.anthropic_base_url
    llm = ChatAnthropic(**kwargs)

    today = date.today().isoformat()
    response = await llm.ainvoke([
        SystemMessage(content=INTENT_PROMPT.format(today=today)),
        HumanMessage(content=user_input),
    ])

    data = parse_llm_json(response.content)
    if data is None:
        return TripRequest(
            destination="泰国曼谷",
            start_date=date.today() + timedelta(days=30),
            end_date=date.today() + timedelta(days=35),
            budget_cny=10000,
        )

    prefs = []
    for p in data.get("preferences", []):
        try:
            prefs.append(TravelPreference(p))
        except ValueError:
            continue

    return TripRequest(
        destination=data.get("destination", "泰国曼谷"),
        start_date=date.fromisoformat(data.get("start_date", (date.today() + timedelta(days=30)).isoformat())),
        end_date=date.fromisoformat(data.get("end_date", (date.today() + timedelta(days=35)).isoformat())),
        travelers=data.get("travelers", 2),
        budget_cny=data.get("budget_cny", 10000),
        preferences=prefs,
        notes=data.get("notes", ""),
    )


def print_itinerary(itinerary_json: str, rate: float, budget_cny: int):
    """格式化输出行程"""
    data = parse_llm_json(itinerary_json)
    if data is None:
        print("\n" + itinerary_json)
        return

    print("\n" + "=" * 60)
    print("  📋 旅行攻略")
    print("=" * 60)

    days = data.get("days", [])
    for day in days:
        print(f"\n📅 Day {day.get('day', '?')} — {day.get('title', '')} [{day.get('city', '')}]")
        if day.get("date"):
            print(f"   日期: {day['date']}")
        print("-" * 40)

        for act in day.get("activities", []):
            cost_thb = act.get("estimated_cost_thb", 0) or 0
            cost_cny = round(cost_thb * rate)
            cost_str = f" ฿{cost_thb} (¥{cost_cny})" if cost_thb else ""
            print(f"   🎯 {act.get('name', '')}{cost_str}")
            if act.get("name_local"):
                print(f"      {act['name_local']}")
            if act.get("source_url"):
                print(f"      🔗 {act['source_url']}")

        for tr in day.get("transport", []):
            dur = f" ~{tr['duration_min']}min" if tr.get("duration_min") else ""
            cost_thb = tr.get("estimated_cost_thb", 0) or 0
            cost_str = f" ฿{cost_thb}" if cost_thb else ""
            print(f"   🚗 {tr.get('from_location', '')} → {tr.get('to_location', '')} [{tr.get('mode', '')}]{dur}{cost_str}")

        for meal in day.get("meals", []):
            cost_thb = meal.get("estimated_cost_thb", 0) or 0
            cost_cny = round(cost_thb * rate)
            cost_str = f" ฿{cost_thb}/人 (¥{cost_cny})" if cost_thb else ""
            print(f"   🍜 {meal.get('name', '')}{cost_str}")
            if meal.get("notes"):
                print(f"      💡 {meal['notes']}")

        day_cost = day.get("estimated_cost_thb", 0) or 0
        if day_cost:
            print(f"   💰 当日预估: ฿{day_cost} (¥{round(day_cost * rate)})")

    total_thb = data.get("total_estimated_thb", 0) or 0
    if total_thb:
        budget = budget_check(total_thb, budget_cny, rate)
        print(f"\n{'=' * 60}")
        print(f"  💰 预算概览")
        print(f"  预估总费用: ฿{total_thb:,} (¥{budget['total_cny']:,.0f})")
        print(f"  预算: ¥{budget_cny:,}")
        print(f"  使用率: {budget['usage_pct']}%")
        if budget["status"] == "over_budget":
            print(f"  ⚠️  超出预算 ¥{abs(budget['remaining_cny']):,.0f}")
        elif budget["status"] == "warning":
            print(f"  ⚡ 接近预算上限，剩余 ¥{budget['remaining_cny']:,.0f}")
        else:
            print(f"  ✅ 剩余 ¥{budget['remaining_cny']:,.0f}")

    warnings = data.get("warnings", [])
    if warnings:
        print(f"\n⚠️  注意事项:")
        for w in warnings:
            print(f"   • {w}")

    sources = data.get("sources", [])
    if sources:
        print(f"\n📚 信息来源:")
        for s in sources[:10]:
            print(f"   • {s}")


async def run_cli():
    print("=" * 60)
    print("  🌏 Travel Agent — AI旅行助手")
    print("  输入你的旅行想法，我来帮你规划")
    print("  输入 'quit' 退出 | 'compare' 进入比价模式")
    print("=" * 60)

    rate = await get_thb_to_cny()
    print(f"  当前汇率: 1 THB = {rate:.4f} CNY")

    current_itinerary = None
    current_request = None

    while True:
        try:
            user_input = input("\n🧳 > ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\n再见！祝旅途愉快 ✈️")
            break

        if not user_input:
            continue
        if user_input.lower() == "quit":
            print("再见！祝旅途愉快 ✈️")
            break

        if user_input.lower() == "compare":
            print("输入要比价的项目（逗号分隔）:")
            items_input = input("💰 > ").strip()
            if not items_input:
                continue
            items = [i.strip() for i in items_input.split(",") if i.strip()]

            print(f"\n🔍 正在搜索 {len(items)} 个项目的价格...")
            graph = build_price_graph()
            state: PriceState = {
                "messages": [],
                "items_to_compare": items,
                "platform_results": [],
                "comparison_output": "",
            }
            try:
                result = await graph.ainvoke(state)
                print("\n" + result.get("comparison_output", "比价失败"))
            except Exception as e:
                print(f"\n❌ 比价失败: {e}")
            continue

        # 判断是新需求还是调整已有行程
        if current_itinerary and not any(
            kw in user_input for kw in ["重新", "新的", "换个", "我想去", "帮我规划"]
        ):
            print("\n🔄 正在调整行程...")
            settings = get_settings()
            kwargs: dict = {
                "model": settings.llm_model,
                "api_key": settings.anthropic_api_key,
                "max_tokens": 8192,
            }
            if settings.anthropic_base_url:
                kwargs["base_url"] = settings.anthropic_base_url
            llm = ChatAnthropic(**kwargs)
            try:
                response = await llm.ainvoke([
                    SystemMessage(content="你是旅行行程调整专家，输出完整的修改后JSON行程。"),
                    HumanMessage(content=ADJUST_PROMPT.format(
                        itinerary=current_itinerary,
                        request=user_input,
                    )),
                ])
                current_itinerary = response.content
                print_itinerary(current_itinerary, rate, current_request.budget_cny)
            except Exception as e:
                print(f"\n❌ 调整失败: {e}")
            continue

        # 新需求：解析意图 → 生成攻略
        print("\n📝 正在理解你的需求...")
        try:
            request = await parse_intent(user_input)
        except Exception as e:
            print(f"❌ 需求解析失败: {e}")
            continue

        current_request = request
        duration = (request.end_date - request.start_date).days + 1

        print(f"\n📍 目的地: {request.destination}")
        print(f"📅 日期: {request.start_date} → {request.end_date} ({duration}天)")
        print(f"👥 人数: {request.travelers}")
        print(f"💰 预算: ¥{request.budget_cny}")
        if request.preferences:
            print(f"❤️  偏好: {', '.join(p.value for p in request.preferences)}")
        if request.notes:
            print(f"📌 备注: {request.notes}")

        confirm = input("\n确认以上信息？(y/n/修改内容) > ").strip()
        if confirm.lower() == "n":
            print("请重新输入需求")
            continue
        if confirm.lower() != "y" and confirm:
            print(f"🔄 重新理解: {confirm}")
            try:
                request = await parse_intent(f"{user_input}，{confirm}")
                current_request = request
            except Exception:
                pass

        print("\n🔍 正在检索最新信息...")
        print("📋 正在生成行程规划...")
        print("✅ 正在审核行程合理性...")

        graph = build_planner_graph()
        state: PlannerState = {
            "messages": [],
            "request": request,
            "search_results": "",
            "itinerary_json": "",
            "price_comparisons": "",
            "final_output": "",
        }

        try:
            result = await graph.ainvoke(state)
            current_itinerary = result.get("final_output", "")
            print_itinerary(current_itinerary, rate, request.budget_cny)
            print("\n💡 你可以继续输入来调整行程，比如：")
            print('   "把第三天换成海岛"')
            print('   "加一个夜市"')
            print('   "预算减到8000"')
        except Exception as e:
            print(f"\n❌ 攻略生成失败: {e}")
            current_itinerary = None


def main():
    asyncio.run(run_cli())


if __name__ == "__main__":
    main()

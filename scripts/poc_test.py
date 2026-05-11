"""POC验证脚本：测试攻略生成 + 比价的端到端流程"""

import asyncio
import json
from datetime import date, timedelta

from app.agents.planner import build_planner_graph, PlannerState
from app.agents.price_compare import build_price_graph, PriceState
from app.models.schemas import TripRequest, TravelPreference


async def test_planner():
    print("=" * 60)
    print("测试攻略生成Agent")
    print("=" * 60)

    request = TripRequest(
        destination="泰国曼谷+普吉岛",
        start_date=date.today() + timedelta(days=30),
        end_date=date.today() + timedelta(days=36),
        travelers=2,
        budget_cny=10000,
        preferences=[TravelPreference.BEACH, TravelPreference.FOOD, TravelPreference.CULTURE],
        notes="第一次去泰国，想体验当地文化和海岛",
    )

    graph = build_planner_graph()

    initial_state: PlannerState = {
        "messages": [],
        "request": request,
        "search_results": "",
        "itinerary_json": "",
        "price_comparisons": "",
        "final_output": "",
    }

    print(f"\n输入: {request.destination}, {request.start_date} - {request.end_date}")
    print(f"预算: ¥{request.budget_cny}, 人数: {request.travelers}")
    print(f"偏好: {[p.value for p in request.preferences]}")
    print("\n生成中...\n")

    result = await graph.ainvoke(initial_state)

    print("攻略输出:")
    print("-" * 40)
    output = result.get("final_output", "")
    print(output[:2000])
    if len(output) > 2000:
        print(f"\n... (共{len(output)}字符)")

    return output


async def test_price_compare():
    print("\n" + "=" * 60)
    print("测试比价Agent")
    print("=" * 60)

    items = [
        "曼谷大皇宫门票",
        "曼谷到普吉岛机票",
        "普吉岛浮潜一日游",
    ]

    graph = build_price_graph()

    initial_state: PriceState = {
        "messages": [],
        "items_to_compare": items,
        "platform_results": [],
        "comparison_output": "",
    }

    print(f"\n比价项目: {items}")
    print("\n搜索中...\n")

    result = await graph.ainvoke(initial_state)

    print("比价结果:")
    print("-" * 40)
    output = result.get("comparison_output", "")
    print(output[:2000])

    return output


async def main():
    print("Travel Agent POC 验证")
    print("目的地: 泰国（曼谷+普吉岛）")
    print()

    try:
        itinerary = await test_planner()
    except Exception as e:
        print(f"攻略生成失败: {e}")
        itinerary = None

    try:
        prices = await test_price_compare()
    except Exception as e:
        print(f"比价失败: {e}")
        prices = None

    print("\n" + "=" * 60)
    print("POC 验证总结")
    print("=" * 60)
    print(f"攻略生成: {'✓ 成功' if itinerary else '✗ 失败'}")
    print(f"多平台比价: {'✓ 成功' if prices else '✗ 失败'}")


if __name__ == "__main__":
    asyncio.run(main())

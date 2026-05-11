from __future__ import annotations

import httpx
import logging

logger = logging.getLogger(__name__)

# 备用固定汇率（THB → CNY），当API不可用时使用
FALLBACK_RATE = 0.20


async def get_thb_to_cny() -> float:
    """获取实时 THB → CNY 汇率"""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                "https://open.er-api.com/v6/latest/THB"
            )
            resp.raise_for_status()
            data = resp.json()
            rate = data["rates"].get("CNY", FALLBACK_RATE)
            logger.info(f"实时汇率 1 THB = {rate:.4f} CNY")
            return rate
    except Exception as e:
        logger.warning(f"汇率API调用失败: {e}, 使用备用汇率 {FALLBACK_RATE}")
        return FALLBACK_RATE


def convert_thb_to_cny(amount_thb: float, rate: float) -> float:
    return round(amount_thb * rate, 2)


def budget_check(total_thb: float, budget_cny: float, rate: float) -> dict:
    """预算检查，返回使用情况和预警"""
    total_cny = convert_thb_to_cny(total_thb, rate)
    usage_pct = (total_cny / budget_cny * 100) if budget_cny > 0 else 0
    remaining_cny = budget_cny - total_cny

    status = "ok"
    if usage_pct > 100:
        status = "over_budget"
    elif usage_pct > 90:
        status = "warning"

    return {
        "total_thb": total_thb,
        "total_cny": total_cny,
        "budget_cny": budget_cny,
        "remaining_cny": remaining_cny,
        "usage_pct": round(usage_pct, 1),
        "status": status,
        "rate": rate,
    }

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

from app.core.order_store import get_active_orders, update_order_status
from app.models.order import OrderStatus

logger = logging.getLogger(__name__)

_monitor_task: asyncio.Task | None = None


async def start_order_monitor():
    """启动订单监控后台任务"""
    global _monitor_task
    if _monitor_task and not _monitor_task.done():
        return
    _monitor_task = asyncio.create_task(_monitor_loop())
    logger.info("Order monitor started")


async def stop_order_monitor():
    """停止订单监控"""
    global _monitor_task
    if _monitor_task:
        _monitor_task.cancel()
        _monitor_task = None


async def _monitor_loop():
    """主监控循环：定期检查订单状态变动"""
    from app.api.websocket import push_notification

    while True:
        try:
            orders = await get_active_orders()

            for order in orders:
                changes = await _check_order_changes(order)
                if changes:
                    for change in changes:
                        await push_notification(order.session_id, change)

        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Monitor loop error: {e}")

        await asyncio.sleep(60)


async def _check_order_changes(order) -> list[dict]:
    """检查单个订单的变动（价格/状态/时间变更）"""
    changes = []

    # 检查平台侧的变动（实际场景对接平台webhook或轮询API）
    # 此处预留接口，当平台回调或定时拉取检测到变动时触发
    try:
        platform_status = await _fetch_platform_status(order)
        if platform_status and platform_status != order.status.value:
            old_status = order.status
            new_status = OrderStatus(platform_status) if platform_status in OrderStatus.__members__.values() else None

            if new_status and new_status != old_status:
                await update_order_status(order.id, new_status)
                changes.append({
                    "notification_type": "status_change",
                    "order_id": order.id,
                    "item_name": order.item_name,
                    "old_status": old_status.value,
                    "new_status": new_status.value,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                })
    except Exception:
        pass

    return changes


async def _fetch_platform_status(order) -> str | None:
    """查询平台侧订单最新状态（预留，各平台对接实现）"""
    # TODO: 对接Klook/KKday/Agoda等平台的订单状态API
    # 当前返回None表示无变化
    return None

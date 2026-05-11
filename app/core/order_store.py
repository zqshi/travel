from __future__ import annotations

import uuid
from datetime import datetime, timezone

from app.core.config import get_settings
from app.models.order import Order, OrderStatus


def _use_supabase() -> bool:
    settings = get_settings()
    return bool(settings.supabase_url and settings.supabase_key)


def _get_supabase():
    from supabase import create_client
    settings = get_settings()
    return create_client(settings.supabase_url, settings.supabase_key)


_mem_orders: dict[str, dict] = {}


async def create_order(order: Order) -> Order:
    order.id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    order.created_at = now
    order.updated_at = now

    data = order.model_dump(mode="json")

    if _use_supabase():
        sb = _get_supabase()
        result = sb.table("orders").insert(data).execute()
        return Order(**result.data[0])

    _mem_orders[order.id] = data
    return order


async def get_order(order_id: str) -> Order | None:
    if _use_supabase():
        sb = _get_supabase()
        result = sb.table("orders").select("*").eq("id", order_id).execute()
        if result.data:
            return Order(**result.data[0])
        return None

    data = _mem_orders.get(order_id)
    return Order(**data) if data else None


async def get_user_orders(user_id: str) -> list[Order]:
    if _use_supabase():
        sb = _get_supabase()
        result = (
            sb.table("orders")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )
        return [Order(**d) for d in result.data]

    return [
        Order(**d) for d in _mem_orders.values()
        if d["user_id"] == user_id
    ]


async def get_session_orders(session_id: str) -> list[Order]:
    if _use_supabase():
        sb = _get_supabase()
        result = (
            sb.table("orders")
            .select("*")
            .eq("session_id", session_id)
            .order("created_at", desc=True)
            .execute()
        )
        return [Order(**d) for d in result.data]

    return [
        Order(**d) for d in _mem_orders.values()
        if d["session_id"] == session_id
    ]


async def update_order_status(order_id: str, status: OrderStatus, **kwargs) -> Order | None:
    now = datetime.now(timezone.utc).isoformat()

    if _use_supabase():
        sb = _get_supabase()
        update_data = {"status": status.value, "updated_at": now, **kwargs}
        result = sb.table("orders").update(update_data).eq("id", order_id).execute()
        if result.data:
            return Order(**result.data[0])
        return None

    if order_id not in _mem_orders:
        return None
    _mem_orders[order_id]["status"] = status.value
    _mem_orders[order_id]["updated_at"] = now
    for k, v in kwargs.items():
        _mem_orders[order_id][k] = v
    return Order(**_mem_orders[order_id])


async def get_active_orders() -> list[Order]:
    """获取所有活跃订单（用于监控变动）"""
    active_statuses = [
        OrderStatus.PAID.value,
        OrderStatus.CONFIRMED.value,
    ]

    if _use_supabase():
        sb = _get_supabase()
        result = (
            sb.table("orders")
            .select("*")
            .in_("status", active_statuses)
            .execute()
        )
        return [Order(**d) for d in result.data]

    return [
        Order(**d) for d in _mem_orders.values()
        if d["status"] in active_statuses
    ]

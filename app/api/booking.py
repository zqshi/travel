from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, Depends

from app.models.order import CreateOrderRequest, PaymentRequest, OrderStatus
from app.services.booking import BookingService
from app.core.order_store import get_order, get_session_orders, get_user_orders
from app.core.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["booking"])

_booking_service = BookingService()


@router.post("/booking/create")
async def create_booking(request: CreateOrderRequest, user_id: str = Depends(get_current_user)):
    """创建预定订单"""
    order = await _booking_service.create_booking(user_id, request)
    return order.model_dump(mode="json")


@router.post("/booking/pay")
async def pay_booking(request: PaymentRequest, user_id: str = Depends(get_current_user)):
    """发起支付"""
    order = await get_order(request.order_id)
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")
    if order.user_id != user_id:
        raise HTTPException(status_code=403, detail="无权操作此订单")

    result = await _booking_service.process_payment(request.order_id, request.token)

    if result.success:
        return {"status": "success", "charge_id": result.charge_id}
    elif result.authorize_uri:
        return {"status": "pending", "authorize_uri": result.authorize_uri}
    else:
        raise HTTPException(
            status_code=402,
            detail=result.failure_message or "支付失败",
        )


@router.post("/booking/{order_id}/cancel")
async def cancel_booking(order_id: str, user_id: str = Depends(get_current_user)):
    """取消预定"""
    order = await get_order(order_id)
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")
    if order.user_id != user_id:
        raise HTTPException(status_code=403, detail="无权操作此订单")

    result = await _booking_service.cancel_booking(order_id)
    if not result:
        raise HTTPException(status_code=500, detail="取消失败")
    return result.model_dump(mode="json")


@router.get("/orders")
async def list_orders(user_id: str = Depends(get_current_user)):
    """获取用户所有订单"""
    orders = await get_user_orders(user_id)
    return [o.model_dump(mode="json") for o in orders]


@router.get("/orders/session/{session_id}")
async def list_session_orders(session_id: str, user_id: str = Depends(get_current_user)):
    """获取某会话内的订单"""
    orders = await get_session_orders(session_id)
    return [o.model_dump(mode="json") for o in orders]


@router.get("/orders/{order_id}")
async def get_order_detail(order_id: str, user_id: str = Depends(get_current_user)):
    """获取订单详情"""
    order = await get_order(order_id)
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")
    if order.user_id != user_id:
        raise HTTPException(status_code=403, detail="无权查看此订单")
    return order.model_dump(mode="json")

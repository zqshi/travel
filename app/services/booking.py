from __future__ import annotations

import logging

from app.models.order import Order, OrderStatus, CreateOrderRequest
from app.core.order_store import create_order, update_order_status, get_order
from app.services.payment import PaymentService, ChargeResult

logger = logging.getLogger(__name__)


class BookingService:
    """统一预定服务：管理从创建订单到支付完成的流程"""

    def __init__(self):
        self.payment = PaymentService()

    async def create_booking(self, user_id: str, request: CreateOrderRequest) -> Order:
        """创建预定订单"""
        order = Order(
            session_id=request.session_id,
            user_id=user_id,
            booking_type=request.booking_type,
            status=OrderStatus.PENDING,
            item_name=request.item_name,
            item_detail=request.item_detail,
            platform=request.platform,
            price_thb=request.price_thb,
            price_cny=request.price_cny,
            booked_date=request.booked_date,
            travelers=request.travelers,
            traveler_info=request.traveler_info,
            contact_phone=request.contact_phone,
            contact_email=request.contact_email,
            source_url=request.source_url,
        )
        return await create_order(order)

    async def process_payment(self, order_id: str, token: str) -> ChargeResult:
        """发起支付"""
        order = await get_order(order_id)
        if not order:
            return ChargeResult(success=False, failure_message="订单不存在")
        if order.status != OrderStatus.PENDING:
            return ChargeResult(success=False, failure_message=f"订单状态异常: {order.status}")

        await update_order_status(order_id, OrderStatus.PAYING)

        result = await self.payment.create_charge(
            amount_thb=order.price_thb,
            token=token,
            description=f"Booking: {order.item_name}",
            metadata={"order_id": order_id, "platform": order.platform},
        )

        if result.success:
            await update_order_status(
                order_id,
                OrderStatus.PAID,
                payment_id=result.charge_id,
            )
        elif result.status == "pending":
            await update_order_status(
                order_id,
                OrderStatus.PAYING,
                payment_id=result.charge_id,
            )
        else:
            await update_order_status(order_id, OrderStatus.PENDING)
            logger.warning(f"Payment failed for order {order_id}: {result.failure_message}")

        return result

    async def confirm_booking(self, order_id: str, booking_ref: str) -> Order | None:
        """供应商确认预定（支付成功后调用平台API下单得到确认号）"""
        return await update_order_status(
            order_id,
            OrderStatus.CONFIRMED,
            booking_ref=booking_ref,
        )

    async def cancel_booking(self, order_id: str) -> Order | None:
        """取消预定"""
        order = await get_order(order_id)
        if not order:
            return None

        if order.status == OrderStatus.PAID and order.payment_id:
            await self.payment.create_refund(order.payment_id)
            return await update_order_status(order_id, OrderStatus.REFUNDED)

        return await update_order_status(order_id, OrderStatus.CANCELLED)

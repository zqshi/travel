"""测试 - 预定领域"""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from datetime import date

from app.services.booking import BookingService
from app.models.order import Order, OrderStatus, BookingType, CreateOrderRequest
from app.services.payment import ChargeResult


@pytest.fixture
def booking_service():
    return BookingService()


@pytest.fixture
def sample_order_request():
    return CreateOrderRequest(
        session_id="sess-1",
        booking_type=BookingType.TICKET,
        item_name="大皇宫门票",
        platform="Klook",
        price_thb=500,
        price_cny=100,
        booked_date=date(2025, 8, 1),
        travelers=2,
    )


class TestBookingService:
    @pytest.mark.asyncio
    async def test_create_booking(self, booking_service, sample_order_request):
        with patch("app.services.booking.create_order") as mock_create:
            mock_order = Order(
                id="order-1",
                session_id="sess-1",
                user_id="user-1",
                booking_type=BookingType.TICKET,
                status=OrderStatus.PENDING,
                item_name="大皇宫门票",
                platform="Klook",
                price_thb=500,
                price_cny=100,
                booked_date=date(2025, 8, 1),
                travelers=2,
            )
            mock_create.return_value = mock_order

            result = await booking_service.create_booking("user-1", sample_order_request)
            assert result.item_name == "大皇宫门票"
            assert result.status == OrderStatus.PENDING
            mock_create.assert_called_once()

    @pytest.mark.asyncio
    async def test_process_payment_success(self, booking_service):
        mock_order = Order(
            id="order-1",
            session_id="sess-1",
            user_id="user-1",
            booking_type=BookingType.TICKET,
            status=OrderStatus.PENDING,
            item_name="门票",
            platform="Klook",
            price_thb=500,
            price_cny=100,
            booked_date=date(2025, 8, 1),
        )

        with patch("app.services.booking.get_order", return_value=mock_order), \
             patch("app.services.booking.update_order_status") as mock_update, \
             patch.object(booking_service.payment, "create_charge", return_value=ChargeResult(success=True, charge_id="chrg_1")):

            result = await booking_service.process_payment("order-1", "tok_test")
            assert result.success is True
            assert result.charge_id == "chrg_1"

    @pytest.mark.asyncio
    async def test_process_payment_order_not_found(self, booking_service):
        with patch("app.services.booking.get_order", return_value=None):
            result = await booking_service.process_payment("nonexistent", "tok_test")
            assert result.success is False
            assert "不存在" in result.failure_message

    @pytest.mark.asyncio
    async def test_cancel_booking_with_refund(self, booking_service):
        mock_order = Order(
            id="order-1",
            session_id="sess-1",
            user_id="user-1",
            booking_type=BookingType.TICKET,
            status=OrderStatus.PAID,
            item_name="门票",
            platform="Klook",
            price_thb=500,
            price_cny=100,
            booked_date=date(2025, 8, 1),
            payment_id="chrg_1",
        )
        refunded_order = mock_order.model_copy(update={"status": OrderStatus.REFUNDED})

        with patch("app.services.booking.get_order", return_value=mock_order), \
             patch("app.services.booking.update_order_status", return_value=refunded_order), \
             patch.object(booking_service.payment, "create_refund", return_value={"id": "rfnd_1"}):

            result = await booking_service.cancel_booking("order-1")
            assert result.status == OrderStatus.REFUNDED

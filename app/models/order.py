from __future__ import annotations

from datetime import date, datetime
from enum import Enum
from pydantic import BaseModel, Field


class OrderStatus(str, Enum):
    PENDING = "pending"
    PAYING = "paying"
    PAID = "paid"
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"
    CHANGED = "changed"


class BookingType(str, Enum):
    FLIGHT = "flight"
    HOTEL = "hotel"
    TICKET = "ticket"
    TRANSPORT = "transport"


class TravelerInfo(BaseModel):
    name: str
    name_en: str = ""
    passport_no: str = ""
    phone: str = ""
    email: str = ""


class Order(BaseModel):
    id: str = ""
    session_id: str
    user_id: str
    booking_type: BookingType
    status: OrderStatus = OrderStatus.PENDING
    item_name: str
    item_detail: dict = Field(default_factory=dict)
    platform: str
    price_thb: float = 0
    price_cny: float = 0
    payment_id: str | None = None
    booking_ref: str | None = None
    booked_date: date
    travelers: int = 1
    traveler_info: list[TravelerInfo] = Field(default_factory=list)
    contact_phone: str = ""
    contact_email: str = ""
    source_url: str = ""
    created_at: datetime | None = None
    updated_at: datetime | None = None


class CreateOrderRequest(BaseModel):
    session_id: str
    booking_type: BookingType
    item_name: str
    item_detail: dict = Field(default_factory=dict)
    platform: str
    price_thb: float = 0
    price_cny: float = 0
    booked_date: date
    travelers: int = 1
    traveler_info: list[TravelerInfo] = Field(default_factory=list)
    contact_phone: str = ""
    contact_email: str = ""
    source_url: str = ""


class PaymentRequest(BaseModel):
    order_id: str
    token: str  # Omise card token from frontend


class OrderStatusChange(BaseModel):
    order_id: str
    old_status: OrderStatus
    new_status: OrderStatus
    detail: str = ""
    timestamp: datetime | None = None

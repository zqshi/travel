from __future__ import annotations

from datetime import date
from enum import Enum
from pydantic import BaseModel, Field


class TravelPreference(str, Enum):
    BEACH = "beach"
    CULTURE = "culture"
    FOOD = "food"
    ADVENTURE = "adventure"
    SHOPPING = "shopping"
    NIGHTLIFE = "nightlife"
    NATURE = "nature"
    RELAXATION = "relaxation"


class TripRequest(BaseModel):
    destination: str = Field(description="目的地，如 '泰国曼谷+普吉'")
    start_date: date
    end_date: date
    travelers: int = Field(default=2, ge=1, le=20)
    budget_cny: int = Field(description="总预算（人民币）")
    preferences: list[TravelPreference] = Field(default_factory=list)
    notes: str = Field(default="", description="用户补充说明")


class POI(BaseModel):
    name: str
    name_local: str = ""
    category: str
    address: str = ""
    rating: float | None = None
    estimated_cost_thb: int | None = None
    source_url: str = ""
    notes: str = ""


class TransportOption(BaseModel):
    mode: str
    from_location: str
    to_location: str
    duration_min: int | None = None
    estimated_cost_thb: int | None = None
    booking_url: str = ""
    platform: str = ""


class DayPlan(BaseModel):
    day: int
    date: date
    title: str
    city: str
    activities: list[POI] = Field(default_factory=list)
    transport: list[TransportOption] = Field(default_factory=list)
    meals: list[POI] = Field(default_factory=list)
    estimated_cost_thb: int = 0


class PriceComparison(BaseModel):
    item_name: str
    platform: str
    price_thb: float
    price_cny: float
    url: str
    available: bool = True
    notes: str = ""


class Itinerary(BaseModel):
    request: TripRequest
    days: list[DayPlan] = Field(default_factory=list)
    price_comparisons: list[PriceComparison] = Field(default_factory=list)
    total_estimated_cny: int = 0
    exchange_rate: float = Field(default=0.2, description="THB to CNY")
    warnings: list[str] = Field(default_factory=list)
    sources: list[str] = Field(default_factory=list, description="信息溯源URL")

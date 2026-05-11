import pytest
from app.models.schemas import TripRequest, TravelPreference
from datetime import date, timedelta


def test_trip_request_validation():
    req = TripRequest(
        destination="泰国曼谷",
        start_date=date.today() + timedelta(days=7),
        end_date=date.today() + timedelta(days=14),
        travelers=2,
        budget_cny=10000,
        preferences=[TravelPreference.BEACH],
    )
    assert req.destination == "泰国曼谷"
    assert req.travelers == 2
    assert (req.end_date - req.start_date).days == 7


def test_trip_request_defaults():
    req = TripRequest(
        destination="泰国",
        start_date=date.today(),
        end_date=date.today() + timedelta(days=3),
        budget_cny=5000,
    )
    assert req.travelers == 2
    assert req.preferences == []
    assert req.notes == ""


def test_trip_request_invalid_travelers():
    with pytest.raises(Exception):
        TripRequest(
            destination="泰国",
            start_date=date.today(),
            end_date=date.today() + timedelta(days=3),
            travelers=0,
            budget_cny=5000,
        )

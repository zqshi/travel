from app.core.currency import budget_check, convert_thb_to_cny


def test_convert_thb_to_cny():
    assert convert_thb_to_cny(1000, 0.2) == 200.0
    assert convert_thb_to_cny(0, 0.2) == 0.0


def test_budget_check_ok():
    result = budget_check(25000, 10000, 0.2)
    assert result["status"] == "ok"
    assert result["total_cny"] == 5000
    assert result["usage_pct"] == 50.0


def test_budget_check_warning():
    result = budget_check(47000, 10000, 0.2)
    assert result["status"] == "warning"


def test_budget_check_over():
    result = budget_check(60000, 10000, 0.2)
    assert result["status"] == "over_budget"
    assert result["remaining_cny"] < 0

"""测试 - 行程规划领域（纯逻辑，无外部依赖）"""
import json
import pytest

from app.domains.planning.utils import (
    parse_json_safe,
    repair_truncated_json,
    merge_plan_and_review,
)


class TestParseJsonSafe:
    def test_valid_json(self):
        text = '```json\n{"days": [{"day": 1}]}\n```'
        result = parse_json_safe(text)
        assert result == {"days": [{"day": 1}]}

    def test_json_with_trailing_comma(self):
        text = '{"days": [{"day": 1,}],}'
        result = parse_json_safe(text)
        assert result == {"days": [{"day": 1}]}

    def test_no_json(self):
        result = parse_json_safe("这里没有JSON")
        assert result is None

    def test_json_embedded_in_text(self):
        text = '好的，这是行程规划：\n{"days": [{"day": 1, "title": "到达"}]}\n希望你满意'
        result = parse_json_safe(text)
        assert result["days"][0]["title"] == "到达"


class TestRepairTruncatedJson:
    def test_missing_closing_braces(self):
        raw = '{"days": [{"day": 1'
        result = repair_truncated_json(raw)
        parsed = json.loads(result)
        assert "days" in parsed

    def test_already_valid(self):
        raw = '{"days": []}'
        result = repair_truncated_json(raw)
        assert json.loads(result) == {"days": []}


class TestMergePlanAndReview:
    def test_review_has_days(self):
        plan = '{"days": [{"day": 1}]}'
        review = '{"days": [{"day": 1}, {"day": 2}], "warnings": []}'
        result = merge_plan_and_review(plan, review)
        assert len(result["days"]) == 2

    def test_review_empty_uses_plan(self):
        plan = '{"days": [{"day": 1}]}'
        review = '{"warnings": [{"severity": "低"}]}'
        result = merge_plan_and_review(plan, review)
        assert len(result["days"]) == 1
        assert result.get("warnings") is not None

    def test_both_empty(self):
        result = merge_plan_and_review("not json", "also not json")
        assert result == {}

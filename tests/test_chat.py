"""测试 - 对话领域（纯逻辑，无外部依赖）"""
import pytest

from app.domains.planning.utils import should_search, _PLAN_READY_RE


class TestShouldSearch:
    def test_keyword_match(self):
        assert should_search("泰国签证怎么办") is True
        assert should_search("现在汇率多少") is True
        assert should_search("航班几点到") is True

    def test_no_keyword(self):
        assert should_search("帮我看看第二天行程") is False
        assert should_search("可以换个餐厅吗") is False


class TestPlanReadyRegex:
    def test_parse_valid(self):
        text = """好的，我来帮你规划！

<<<PLAN_READY>>>
{"destination":"曼谷","start_date":"2025-07-15","end_date":"2025-07-20","budget_cny":8000,"travelers":2,"preferences":[],"notes":""}
<<<END_PLAN>>>"""
        match = _PLAN_READY_RE.search(text)
        assert match is not None
        import json
        params = json.loads(match.group(1))
        assert params["destination"] == "曼谷"
        assert params["travelers"] == 2

    def test_no_match(self):
        text = "普通对话，没有标记"
        match = _PLAN_READY_RE.search(text)
        assert match is None

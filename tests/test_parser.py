from app.core.parser import extract_json, fix_json, parse_llm_json


def test_extract_json_from_code_block():
    text = '这是一些文字\n```json\n{"key": "value"}\n```\n后续文字'
    assert extract_json(text) == '{"key": "value"}'


def test_extract_json_bare():
    text = '前面的文字 {"name": "test", "age": 25} 后面的文字'
    result = extract_json(text)
    assert result == '{"name": "test", "age": 25}'


def test_extract_json_nested():
    text = '{"outer": {"inner": [1, 2, 3]}}'
    assert extract_json(text) == text


def test_extract_json_none():
    assert extract_json("no json here") is None


def test_fix_json_trailing_comma():
    raw = '{"a": 1, "b": 2,}'
    assert fix_json(raw) == '{"a": 1, "b": 2}'


def test_parse_llm_json_markdown():
    text = """
    当然，这是你的行程：
    ```json
    {"destination": "泰国", "days": 5}
    ```
    希望你喜欢！
    """
    result = parse_llm_json(text)
    assert result == {"destination": "泰国", "days": 5}


def test_parse_llm_json_with_trailing_comma():
    text = '{"a": 1, "b": [1, 2,],}'
    result = parse_llm_json(text)
    assert result == {"a": 1, "b": [1, 2]}

"""行程规划领域 - 纯逻辑工具函数（无外部依赖）"""
from __future__ import annotations

import json
import re


def fix_json_simple(raw: str) -> str:
    """移除尾逗号等常见问题"""
    fixed = re.sub(r',\s*([}\]])', r'\1', raw)
    return fixed


def extract_json_block(text: str) -> str | None:
    """从文本中提取JSON块"""
    m = re.search(r'```(?:json)?\s*\n?(.*?)\n?```', text, re.DOTALL)
    if m:
        return m.group(1).strip()
    for i, c in enumerate(text):
        if c in ('{', '['):
            depth_b = 0
            depth_s = 0
            for j in range(i, len(text)):
                if text[j] == '{':
                    depth_b += 1
                elif text[j] == '}':
                    depth_b -= 1
                elif text[j] == '[':
                    depth_s += 1
                elif text[j] == ']':
                    depth_s -= 1
                if depth_b == 0 and depth_s == 0 and j > i:
                    return text[i:j+1]
            return text[i:]
    return None


def repair_truncated_json(raw: str) -> str:
    """修复被截断的JSON：用栈跟踪打开的括号，逐个补全。

    策略：
    1. 去除尾逗号
    2. 去除末尾不完整的 key 或 value（截断到最后一个有效token）
    3. 用栈记录打开的 { 和 [，按逆序补全
    """
    fixed = fix_json_simple(raw)

    # 去除末尾悬挂的逗号、冒号、不完整token
    fixed = re.sub(r'[,:\s]+$', '', fixed)

    # 用栈跟踪所有未闭合的括号
    stack = []
    in_string = False
    escape_next = False

    for ch in fixed:
        if escape_next:
            escape_next = False
            continue
        if ch == '\\' and in_string:
            escape_next = True
            continue
        if ch == '"':
            in_string = not in_string
            continue
        if in_string:
            continue
        if ch == '{':
            stack.append('}')
        elif ch == '[':
            stack.append(']')
        elif ch in ('}', ']'):
            if stack and stack[-1] == ch:
                stack.pop()

    # 按栈逆序补全
    stack.reverse()
    fixed += ''.join(stack)
    return fixed


def parse_json_safe(text: str) -> dict | None:
    """安全解析LLM输出的JSON"""
    raw = extract_json_block(text)
    if raw is None:
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        try:
            return json.loads(fix_json_simple(raw))
        except json.JSONDecodeError:
            try:
                return json.loads(repair_truncated_json(raw))
            except json.JSONDecodeError:
                return None


def merge_plan_and_review(plan_text: str, review_text: str) -> dict:
    """合并规划JSON和审核JSON"""
    plan_data = parse_json_safe(plan_text) or {}
    review_data = parse_json_safe(review_text) or {}

    if not plan_data and not review_data:
        return {}

    if review_data.get("days"):
        merged = review_data
        for k, v in plan_data.items():
            if k not in merged:
                merged[k] = v
        return merged

    merged = plan_data.copy()
    for k, v in review_data.items():
        if k not in merged or (k == "warnings" and v):
            merged[k] = v
    return merged


# 对话相关正则
_PLAN_READY_RE = re.compile(
    r"<<<PLAN_READY>>>\s*(.+?)\s*<<<END_PLAN>>>",
    re.DOTALL,
)

_SEARCH_KEYWORDS = [
    "签证", "汇率", "航班", "机票", "天气", "安全", "疫情",
    "入境", "海关", "保险", "交通", "地铁", "火车", "大巴",
]


def should_search(message: str) -> bool:
    """判断消息是否需要搜索"""
    return any(kw in message for kw in _SEARCH_KEYWORDS)

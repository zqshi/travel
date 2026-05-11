from __future__ import annotations

import json
import re
import logging
from typing import TypeVar, Type

from pydantic import BaseModel

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)


def extract_json(text: str) -> str | None:
    """从LLM响应中提取JSON块，处理markdown代码块和混杂文本"""
    # 尝试提取 ```json ... ``` 代码块
    match = re.search(r"```(?:json)?\s*\n?(.*?)\n?\s*```", text, re.DOTALL)
    if match:
        return match.group(1).strip()

    # 尝试找到最外层的 { ... } 或 [ ... ]
    brace_start = text.find("{")
    bracket_start = text.find("[")

    if brace_start == -1 and bracket_start == -1:
        return None

    if bracket_start != -1 and (brace_start == -1 or bracket_start < brace_start):
        start = bracket_start
        open_char, close_char = "[", "]"
    else:
        start = brace_start
        open_char, close_char = "{", "}"

    depth = 0
    in_string = False
    escape = False
    for i in range(start, len(text)):
        c = text[i]
        if escape:
            escape = False
            continue
        if c == "\\":
            escape = True
            continue
        if c == '"':
            in_string = not in_string
            continue
        if in_string:
            continue
        if c == open_char:
            depth += 1
        elif c == close_char:
            depth -= 1
            if depth == 0:
                return text[start : i + 1]

    return text[start:]


def fix_json(raw: str) -> str:
    """修复常见的JSON格式问题"""
    # 移除尾部逗号 (trailing commas)
    raw = re.sub(r",\s*([}\]])", r"\1", raw)
    # 修复单引号为双引号
    raw = raw.replace("'", '"')
    return raw


def parse_llm_json(text: str, model: Type[T] | None = None) -> T | dict | list | None:
    """从LLM输出中解析JSON，支持容错

    Args:
        text: LLM的原始输出文本
        model: 可选的Pydantic模型类，用于验证和解析

    Returns:
        解析后的Pydantic模型实例、dict、list或None
    """
    raw = extract_json(text)
    if raw is None:
        logger.warning("未能从LLM输出中提取JSON")
        return None

    # 第一次尝试：直接解析
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        # 第二次尝试：修复后解析
        try:
            data = json.loads(fix_json(raw))
        except json.JSONDecodeError as e:
            logger.error(f"JSON解析失败: {e}\n原始文本: {raw[:500]}")
            return None

    if model is not None:
        try:
            return model.model_validate(data)
        except Exception as e:
            logger.warning(f"Pydantic验证失败: {e}, 返回原始dict")
            return data

    return data

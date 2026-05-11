from __future__ import annotations

import asyncio
import logging
from typing import Callable, TypeVar, Any

logger = logging.getLogger(__name__)

T = TypeVar("T")


async def retry_async(
    fn: Callable[..., Any],
    *args: Any,
    max_retries: int = 3,
    base_delay: float = 1.0,
    fallback: Any = None,
    label: str = "",
    **kwargs: Any,
) -> Any:
    """带指数退避的异步重试

    Args:
        fn: 要重试的异步函数
        max_retries: 最大重试次数
        base_delay: 基础延迟秒数（指数增长）
        fallback: 所有重试失败后的降级返回值
        label: 日志标识
    """
    last_error = None
    for attempt in range(max_retries):
        try:
            return await fn(*args, **kwargs)
        except Exception as e:
            last_error = e
            if attempt < max_retries - 1:
                delay = base_delay * (2 ** attempt)
                logger.warning(
                    f"[{label}] 第{attempt + 1}次失败: {e}, {delay:.1f}s后重试"
                )
                await asyncio.sleep(delay)
            else:
                logger.error(f"[{label}] {max_retries}次重试全部失败: {e}")

    if fallback is not None:
        logger.info(f"[{label}] 降级到fallback")
        return fallback

    raise last_error

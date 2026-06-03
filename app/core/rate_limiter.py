"""内存级频率限制器

三层防护：
1. 手机号维度 — 发送间隔 + 每日上限
2. 手机号维度 — 验证错误次数锁定
3. IP维度 — 全局请求频率
"""

from __future__ import annotations

import math
import time
import threading
from dataclasses import dataclass, field


class RateLimitError(Exception):
    def __init__(self, message: str, retry_after: int):
        self.message = message
        self.retry_after = retry_after
        super().__init__(message)


@dataclass
class _SendRecord:
    timestamps: list[float] = field(default_factory=list)
    daily_count: int = 0
    daily_date: str = ""  # YYYY-MM-DD


@dataclass
class _VerifyRecord:
    failure_count: int = 0
    locked_until: float = 0.0


@dataclass
class _IPRecord:
    timestamps: list[float] = field(default_factory=list)


class RateLimiter:
    def __init__(
        self,
        send_interval: int = 60,
        daily_send_limit: int = 10,
        verify_max_failures: int = 5,
        verify_lock_seconds: int = 1800,
        ip_max_per_minute: int = 30,
    ):
        self.send_interval = send_interval
        self.daily_send_limit = daily_send_limit
        self.verify_max_failures = verify_max_failures
        self.verify_lock_seconds = verify_lock_seconds
        self.ip_max_per_minute = ip_max_per_minute

        self._send_store: dict[str, _SendRecord] = {}
        self._verify_store: dict[str, _VerifyRecord] = {}
        self._ip_store: dict[str, _IPRecord] = {}
        self._lock = threading.Lock()

    def check_send_rate(self, phone: str) -> None:
        """检查手机号发送频率。通过则无返回，超限则抛 RateLimitError。"""
        now = time.time()
        today = time.strftime("%Y-%m-%d")

        with self._lock:
            rec = self._send_store.get(phone)
            if rec is None:
                rec = _SendRecord()
                self._send_store[phone] = rec

            # 重置每日计数
            if rec.daily_date != today:
                rec.daily_count = 0
                rec.daily_date = today

            # 检查每日上限
            if rec.daily_count >= self.daily_send_limit:
                raise RateLimitError("今日发送次数已达上限", retry_after=0)

            # 检查发送间隔
            if rec.timestamps:
                last_send = rec.timestamps[-1]
                elapsed = now - last_send
                if elapsed < self.send_interval:
                    retry_after = math.ceil(self.send_interval - elapsed)
                    raise RateLimitError(
                        f"请求过于频繁，请{retry_after}秒后重试",
                        retry_after=retry_after,
                    )

            # 通过检查，记录本次发送
            rec.timestamps.append(now)
            rec.daily_count += 1

    def check_verify_rate(self, phone: str) -> None:
        """检查验证码验证是否被锁定。"""
        now = time.time()

        with self._lock:
            rec = self._verify_store.get(phone)
            if rec is None:
                return

            # 锁定已过期
            if rec.locked_until and now >= rec.locked_until:
                rec.failure_count = 0
                rec.locked_until = 0.0
                return

            # 当前被锁定
            if rec.locked_until and now < rec.locked_until:
                retry_after = math.ceil(rec.locked_until - now)
                raise RateLimitError(
                    f"验证错误次数过多，请{retry_after}秒后再试",
                    retry_after=retry_after,
                )

            # 错误次数达到上限，触发锁定
            if rec.failure_count >= self.verify_max_failures:
                rec.locked_until = now + self.verify_lock_seconds
                retry_after = self.verify_lock_seconds
                raise RateLimitError(
                    f"验证错误次数过多，请{retry_after}秒后再试",
                    retry_after=retry_after,
                )

    def record_verify_failure(self, phone: str) -> None:
        """记录一次验证失败。"""
        with self._lock:
            rec = self._verify_store.get(phone)
            if rec is None:
                rec = _VerifyRecord()
                self._verify_store[phone] = rec
            rec.failure_count += 1

    def reset_verify_failures(self, phone: str) -> None:
        """验证成功后重置错误计数。"""
        with self._lock:
            rec = self._verify_store.get(phone)
            if rec:
                rec.failure_count = 0
                rec.locked_until = 0.0

    def check_ip_rate(self, ip: str) -> None:
        """检查IP级请求频率（滑动窗口，1分钟）。"""
        now = time.time()
        window = 60.0

        with self._lock:
            rec = self._ip_store.get(ip)
            if rec is None:
                rec = _IPRecord()
                self._ip_store[ip] = rec

            # 清理窗口外的时间戳
            cutoff = now - window
            rec.timestamps = [t for t in rec.timestamps if t > cutoff]

            if len(rec.timestamps) >= self.ip_max_per_minute:
                oldest = rec.timestamps[0]
                retry_after = math.ceil(oldest + window - now)
                raise RateLimitError(
                    f"请求过于频繁，请{retry_after}秒后重试",
                    retry_after=max(retry_after, 1),
                )

            rec.timestamps.append(now)

    def cleanup(self) -> None:
        """清理过期记录，防止内存泄漏。"""
        now = time.time()
        with self._lock:
            # 清理发送记录：移除超过24小时无活动的
            expired_phones = [
                phone
                for phone, rec in self._send_store.items()
                if rec.timestamps and (now - rec.timestamps[-1]) > 86400
            ]
            for phone in expired_phones:
                del self._send_store[phone]

            # 清理验证记录：已解锁且无失败的
            expired_verify = [
                phone
                for phone, rec in self._verify_store.items()
                if rec.failure_count == 0
                or (rec.locked_until and now >= rec.locked_until)
            ]
            for phone in expired_verify:
                del self._verify_store[phone]

            # 清理IP记录：窗口外无时间戳的
            expired_ips = [
                ip
                for ip, rec in self._ip_store.items()
                if not rec.timestamps or (now - rec.timestamps[-1]) > 60
            ]
            for ip in expired_ips:
                del self._ip_store[ip]

    def _get_store_size(self) -> int:
        """内部方法，用于测试。"""
        return len(self._send_store) + len(self._verify_store) + len(self._ip_store)


# 全局单例
_rate_limiter: RateLimiter | None = None


def get_rate_limiter() -> RateLimiter:
    global _rate_limiter
    if _rate_limiter is None:
        from app.core.config import get_settings
        settings = get_settings()
        _rate_limiter = RateLimiter(
            send_interval=getattr(settings, "rate_limit_send_interval", 60),
            daily_send_limit=getattr(settings, "rate_limit_daily_send", 10),
            verify_max_failures=getattr(settings, "rate_limit_verify_failures", 5),
            verify_lock_seconds=getattr(settings, "rate_limit_verify_lock", 1800),
            ip_max_per_minute=getattr(settings, "rate_limit_ip_per_minute", 30),
        )
    return _rate_limiter

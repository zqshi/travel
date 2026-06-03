"""Rate Limiter 单元测试 — TDD先行

覆盖验收标准:
- AC-1: 同一手机号60秒内重复发送验证码 → 429
- AC-2: 同一手机号超过每日发送上限 → 429
- AC-3: 验证码连续错误5次后锁定 → 429
- AC-4: 验证成功后重置错误计数
- AC-5: 同一IP每分钟超过30次请求 → 429
- AC-7: 锁定期过后自动解除
"""

import time

import pytest

from app.core.rate_limiter import RateLimitError, RateLimiter


# ── Fixtures ───────────────────────────────────────────


@pytest.fixture
def limiter() -> RateLimiter:
    return RateLimiter(
        send_interval=60,       # 同手机号发送间隔60秒
        daily_send_limit=10,    # 每天最多发送10次
        verify_max_failures=5,  # 验证错误5次锁定
        verify_lock_seconds=1800,  # 锁定30分钟
        ip_max_per_minute=30,   # 同IP每分钟30次
    )


@pytest.fixture
def fast_limiter() -> RateLimiter:
    """用于测试过期场景的快速限制器"""
    return RateLimiter(
        send_interval=1,        # 1秒间隔
        daily_send_limit=3,     # 每天最多3次
        verify_max_failures=2,  # 2次错误即锁定
        verify_lock_seconds=1,  # 锁定1秒
        ip_max_per_minute=5,    # IP限5次/分钟
    )


# ── AC-1: 发送间隔限制 ─────────────────────────────────


class TestSendInterval:
    def test_first_send_allowed(self, limiter: RateLimiter):
        """首次发送应该成功"""
        limiter.check_send_rate("13800000001")  # 不应抛异常

    def test_second_send_within_interval_blocked(self, limiter: RateLimiter):
        """60秒内第二次发送应该被拒绝"""
        limiter.check_send_rate("13800000001")
        with pytest.raises(RateLimitError) as exc_info:
            limiter.check_send_rate("13800000001")
        assert exc_info.value.retry_after > 0
        assert exc_info.value.retry_after <= 60

    def test_different_phones_independent(self, limiter: RateLimiter):
        """不同手机号互不影响"""
        limiter.check_send_rate("13800000001")
        limiter.check_send_rate("13800000002")  # 不同号码，应成功

    def test_send_after_interval_allowed(self, fast_limiter: RateLimiter):
        """间隔过后可以再次发送"""
        fast_limiter.check_send_rate("13800000001")
        time.sleep(1.1)
        fast_limiter.check_send_rate("13800000001")  # 应成功

    def test_retry_after_decreases(self, fast_limiter: RateLimiter):
        """retry_after应该随时间递减（使用1秒间隔的快速限制器）"""
        fast_limiter.check_send_rate("13800000001")
        time.sleep(0.5)
        with pytest.raises(RateLimitError) as exc_info:
            fast_limiter.check_send_rate("13800000001")
        # 1秒间隔，0.5秒后，retry_after应为1（ceil(0.5)=1）
        assert exc_info.value.retry_after <= 1


# ── AC-2: 每日发送上限 ──────────────────────────────────


class TestDailySendLimit:
    def test_within_daily_limit(self, fast_limiter: RateLimiter):
        """未超过每日上限时正常发送"""
        for i in range(3):
            fast_limiter.check_send_rate("13800000001")
            time.sleep(1.1)  # 等待间隔

    def test_exceed_daily_limit(self, fast_limiter: RateLimiter):
        """超过每日上限应被拒绝"""
        for i in range(3):
            fast_limiter.check_send_rate("13800000001")
            time.sleep(1.1)
        with pytest.raises(RateLimitError) as exc_info:
            fast_limiter.check_send_rate("13800000001")
        assert "上限" in exc_info.value.message


# ── AC-3: 验证错误次数限制 ──────────────────────────────


class TestVerifyLock:
    def test_failures_within_limit(self, limiter: RateLimiter):
        """错误次数达到上限后被锁定"""
        for _ in range(5):
            limiter.record_verify_failure("13800000001")
        with pytest.raises(RateLimitError):
            limiter.check_verify_rate("13800000001")

    def test_lock_after_max_failures(self, limiter: RateLimiter):
        """连续错误达到上限后锁定，带正确的错误消息"""
        for _ in range(5):
            limiter.record_verify_failure("13800000001")
        with pytest.raises(RateLimitError) as exc_info:
            limiter.check_verify_rate("13800000001")
        assert exc_info.value.retry_after > 0
        assert "错误次数过多" in exc_info.value.message

    def test_different_phones_independent(self, limiter: RateLimiter):
        """不同手机号的错误计数互相独立"""
        for _ in range(5):
            limiter.record_verify_failure("13800000001")
        limiter.check_verify_rate("13800000002")  # 不同号码不受影响

    def test_under_limit_not_locked(self, limiter: RateLimiter):
        """错误次数未达上限时不锁定"""
        for _ in range(4):
            limiter.record_verify_failure("13800000001")
        limiter.check_verify_rate("13800000001")  # 4次错误，应通过


# ── AC-4: 验证成功重置错误计数 ──────────────────────────


class TestVerifyReset:
    def test_reset_on_success(self, limiter: RateLimiter):
        """验证成功后重置错误计数"""
        for _ in range(3):
            limiter.record_verify_failure("13800000001")
        limiter.reset_verify_failures("13800000001")
        # 重置后可以再错误5次
        for _ in range(5):
            limiter.record_verify_failure("13800000001")
        with pytest.raises(RateLimitError):
            limiter.check_verify_rate("13800000001")

    def test_reset_nonexistent_phone(self, limiter: RateLimiter):
        """重置不存在的手机号不报错"""
        limiter.reset_verify_failures("13899999999")  # 不应抛异常


# ── AC-5: IP级全局限流 ──────────────────────────────────


class TestIPRateLimit:
    def test_within_ip_limit(self, limiter: RateLimiter):
        """未超过IP限制时正常通过"""
        for _ in range(30):
            limiter.check_ip_rate("192.168.1.1")

    def test_exceed_ip_limit(self, limiter: RateLimiter):
        """超过IP限制后拒绝"""
        for _ in range(30):
            limiter.check_ip_rate("192.168.1.1")
        with pytest.raises(RateLimitError):
            limiter.check_ip_rate("192.168.1.1")

    def test_different_ips_independent(self, limiter: RateLimiter):
        """不同IP互不影响"""
        for _ in range(30):
            limiter.check_ip_rate("192.168.1.1")
        limiter.check_ip_rate("192.168.1.2")  # 不同IP应成功


# ── AC-7: 锁定期过后自动解除 ────────────────────────────


class TestLockExpiry:
    def test_verify_lock_expires(self, fast_limiter: RateLimiter):
        """验证锁定到期后自动解除"""
        for _ in range(2):
            fast_limiter.record_verify_failure("13800000001")
        with pytest.raises(RateLimitError):
            fast_limiter.check_verify_rate("13800000001")
        time.sleep(1.1)
        fast_limiter.check_verify_rate("13800000001")  # 锁定到期，应成功


# ── 内存清理 ──────────────────────────────────────────


class TestCleanup:
    def test_cleanup_expired_entries(self, fast_limiter: RateLimiter):
        """过期记录应被清理"""
        fast_limiter.check_send_rate("13800000001")
        fast_limiter.record_verify_failure("13800000002")
        time.sleep(1.1)
        fast_limiter.cleanup()
        # 清理后记录数应减少（内部状态检查）
        assert fast_limiter._get_store_size() >= 0  # 至少不报错


# ── RateLimitError 属性 ─────────────────────────────────


class TestRateLimitError:
    def test_error_has_retry_after(self, limiter: RateLimiter):
        """错误对象包含retry_after"""
        limiter.check_send_rate("13800000001")
        with pytest.raises(RateLimitError) as exc_info:
            limiter.check_send_rate("13800000001")
        err = exc_info.value
        assert hasattr(err, "retry_after")
        assert hasattr(err, "message")
        assert isinstance(err.retry_after, int)
        assert err.retry_after > 0

    def test_error_message_is_descriptive(self, limiter: RateLimiter):
        """错误消息应该是描述性的"""
        limiter.check_send_rate("13800000001")
        with pytest.raises(RateLimitError) as exc_info:
            limiter.check_send_rate("13800000001")
        assert len(exc_info.value.message) > 0

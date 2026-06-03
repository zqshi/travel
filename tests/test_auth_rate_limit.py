"""Integration tests for auth endpoints with rate limiting.

Tests the full request/response cycle using FastAPI TestClient,
verifying rate limiting behavior at the HTTP level.
"""

from __future__ import annotations

from unittest.mock import patch

import pytest

from app.core.rate_limiter import RateLimiter, get_rate_limiter


# ─── Fixtures ──────────────────────────────────────────────────────────────


@pytest.fixture(autouse=True)
def fresh_limiter(monkeypatch):
    """Replace the global rate limiter with a fresh instance for each test.
    
    Uses small limits where needed for faster tests, but keeps the same
    interface so we're testing real behavior.
    """
    limiter = RateLimiter(
        send_interval=60,
        daily_send_limit=10,
        verify_max_failures=5,
        verify_lock_seconds=1800,
        ip_max_per_minute=100,  # High IP limit so it doesn't interfere with per-phone tests
    )
    import app.core.rate_limiter as rl_mod
    monkeypatch.setattr(rl_mod, "_rate_limiter", limiter)
    return limiter


@pytest.fixture
def client():
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from app.api.auth import router as auth_router

    test_app = FastAPI()
    test_app.include_router(auth_router)
    return TestClient(test_app)


# ─── Send Code Rate Limiting ──────────────────────────────────────────────


class TestSendCodeRateLimit:
    def test_first_request_succeeds(self, client):
        resp = client.post("/api/v1/auth/send-code", json={"phone": "13800138000"})
        assert resp.status_code == 200
        assert resp.json()["success"] is True

    def test_second_request_within_interval_blocked(self, client):
        resp1 = client.post("/api/v1/auth/send-code", json={"phone": "13800138000"})
        assert resp1.status_code == 200

        resp2 = client.post("/api/v1/auth/send-code", json={"phone": "13800138000"})
        assert resp2.status_code == 429
        assert "频繁" in resp2.json()["detail"] or "上限" in resp2.json()["detail"]
        # Verify Retry-After header is present
        assert "retry-after" in resp2.headers

    def test_different_phones_independent(self, client):
        resp1 = client.post("/api/v1/auth/send-code", json={"phone": "13800138000"})
        assert resp1.status_code == 200

        resp2 = client.post("/api/v1/auth/send-code", json={"phone": "13900139000"})
        assert resp2.status_code == 200

    def test_invalid_phone_rejected(self, client):
        resp = client.post("/api/v1/auth/send-code", json={"phone": "123"})
        assert resp.status_code == 400

    def test_daily_limit_enforced(self, client, fresh_limiter):
        """After daily_send_limit sends, further requests are blocked."""
        # Override to small daily limit for this test
        fresh_limiter.daily_send_limit = 3
        fresh_limiter.send_interval = 0  # disable interval check

        for i in range(3):
            phone = "13800138000"
            resp = client.post("/api/v1/auth/send-code", json={"phone": phone})
            assert resp.status_code == 200, f"Request {i+1} should succeed"

        resp = client.post("/api/v1/auth/send-code", json={"phone": "13800138000"})
        assert resp.status_code == 429
        assert "上限" in resp.json()["detail"]


# ─── Verify Rate Limiting ─────────────────────────────────────────────────


class TestVerifyRateLimit:
    def test_wrong_code_returns_400(self, client):
        resp = client.post(
            "/api/v1/auth/verify",
            json={"phone": "13800138000", "code": "9999"},
        )
        assert resp.status_code == 400

    def test_allows_up_to_failure_limit(self, client):
        """5 wrong attempts should all return 400 (wrong code), not 429."""
        for i in range(5):
            resp = client.post(
                "/api/v1/auth/verify",
                json={"phone": "13800138000", "code": "9999"},
            )
            assert resp.status_code == 400, f"Attempt {i+1} should be 400"

    def test_locks_after_failure_limit(self, client):
        """After 5 wrong attempts, the 6th should return 429."""
        for _ in range(5):
            client.post(
                "/api/v1/auth/verify",
                json={"phone": "13800138000", "code": "9999"},
            )

        resp = client.post(
            "/api/v1/auth/verify",
            json={"phone": "13800138000", "code": "9999"},
        )
        assert resp.status_code == 429
        assert "错误次数过多" in resp.json()["detail"]
        assert "retry-after" in resp.headers

    def test_successful_verify_resets_counter(self, client):
        """After a successful login, the verify failure counter resets."""
        # Use up 4 of 5 attempts
        for _ in range(4):
            client.post(
                "/api/v1/auth/verify",
                json={"phone": "13800138000", "code": "9999"},
            )

        # Successful verify with correct code
        with patch("app.api.auth.get_or_create_user") as mock_user:
            mock_user.return_value = {"id": "user-1", "phone": "13800138000"}
            resp = client.post(
                "/api/v1/auth/verify",
                json={"phone": "13800138000", "code": "1234"},
            )
            assert resp.status_code == 200

        # Counter should be reset — can fail 5 more times before lock
        for i in range(5):
            resp = client.post(
                "/api/v1/auth/verify",
                json={"phone": "13800138000", "code": "9999"},
            )
            assert resp.status_code == 400, f"Post-reset attempt {i+1} should be 400"

    def test_different_phones_independent(self, client):
        """Failure count on one phone doesn't affect another."""
        for _ in range(5):
            client.post(
                "/api/v1/auth/verify",
                json={"phone": "13800138000", "code": "9999"},
            )

        # Different phone should still work
        resp = client.post(
            "/api/v1/auth/verify",
            json={"phone": "13900139000", "code": "9999"},
        )
        assert resp.status_code == 400  # wrong code, not 429


# ─── IP Rate Limiting ─────────────────────────────────────────────────────


class TestIPRateLimit:
    def test_ip_limit_enforced(self, client, fresh_limiter):
        """When IP limit is reached, further requests are blocked."""
        fresh_limiter.ip_max_per_minute = 5
        fresh_limiter.send_interval = 0  # disable phone-level interval
        fresh_limiter.daily_send_limit = 100  # high so it doesn't interfere

        for i in range(5):
            phone = f"1380013{i:04d}"
            resp = client.post("/api/v1/auth/send-code", json={"phone": phone})
            assert resp.status_code == 200, f"Request {i+1} should pass"

        # 6th request from same IP should be blocked
        resp = client.post("/api/v1/auth/send-code", json={"phone": "13800139999"})
        assert resp.status_code == 429


# ─── Response Format ──────────────────────────────────────────────────────


class TestResponseFormat:
    def test_429_response_has_retry_after_header(self, client):
        """429 responses include Retry-After header for client consumption."""
        client.post("/api/v1/auth/send-code", json={"phone": "13800138000"})
        resp = client.post("/api/v1/auth/send-code", json={"phone": "13800138000"})
        assert resp.status_code == 429
        assert "retry-after" in resp.headers
        retry_val = int(resp.headers["retry-after"])
        assert retry_val > 0

    def test_429_response_body_has_detail(self, client):
        """429 response body has human-readable detail message."""
        client.post("/api/v1/auth/send-code", json={"phone": "13800138000"})
        resp = client.post("/api/v1/auth/send-code", json={"phone": "13800138000"})
        assert resp.status_code == 429
        body = resp.json()
        assert "detail" in body
        assert len(body["detail"]) > 0

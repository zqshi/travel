"""Tests for WeChat OAuth login flow."""
from __future__ import annotations

import json
import pytest
from unittest.mock import patch, AsyncMock, MagicMock

# ── State token tests ──

def test_create_and_verify_state_token():
    """AC-6: state token can be created and verified."""
    with patch("app.api.auth_wechat.get_settings") as mock_settings:
        mock_settings.return_value = MagicMock(jwt_secret="test-secret")
        from app.api.auth_wechat import _create_state_token, _verify_state_token

        token = _create_state_token()
        assert token
        assert _verify_state_token(token) is True


def test_invalid_state_token_rejected():
    """AC-6: tampered state token is rejected."""
    with patch("app.api.auth_wechat.get_settings") as mock_settings:
        mock_settings.return_value = MagicMock(jwt_secret="test-secret")
        from app.api.auth_wechat import _verify_state_token

        assert _verify_state_token("garbage.token.here") is False
        assert _verify_state_token("") is False


def test_expired_state_token_rejected():
    """AC-6: expired state token is rejected."""
    import jwt as pyjwt
    from datetime import datetime, timedelta, timezone

    token = pyjwt.encode(
        {"nonce": "abc", "exp": datetime.now(timezone.utc) - timedelta(minutes=1)},
        "test-secret",
        algorithm="HS256",
    )
    with patch("app.api.auth_wechat.get_settings") as mock_settings:
        mock_settings.return_value = MagicMock(jwt_secret="test-secret")
        from app.api.auth_wechat import _verify_state_token

        assert _verify_state_token(token) is False


# ── WeChat browser detection ──

def test_wechat_browser_detection():
    from app.api.auth_wechat import _is_wechat_browser

    assert _is_wechat_browser("Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 MicroMessenger/8.0") is True
    assert _is_wechat_browser("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120") is False
    assert _is_wechat_browser("") is False


# ── User creation by WeChat (in-memory) ──

@pytest.mark.asyncio
async def test_create_new_user_by_wechat():
    """AC-1: new user created on first WeChat login."""
    with patch("app.core.database._use_supabase", return_value=False):
        from app.core.database import get_or_create_user_by_wechat, _mem_users
        _mem_users.clear()

        user = await get_or_create_user_by_wechat(
            openid="wx_open_123",
            unionid="wx_union_456",
            nickname="测试用户",
            avatar_url="https://example.com/avatar.jpg",
        )

        assert user["wechat_openid"] == "wx_open_123"
        assert user["wechat_unionid"] == "wx_union_456"
        assert user["nickname"] == "测试用户"
        assert user["avatar_url"] == "https://example.com/avatar.jpg"
        assert user["phone"] is None
        assert user["id"]


@pytest.mark.asyncio
async def test_find_existing_user_by_openid():
    """AC-2: returning WeChat user is matched by openid."""
    with patch("app.core.database._use_supabase", return_value=False):
        from app.core.database import get_or_create_user_by_wechat, _mem_users
        _mem_users.clear()

        user1 = await get_or_create_user_by_wechat(openid="wx_open_abc")
        user2 = await get_or_create_user_by_wechat(openid="wx_open_abc", nickname="新昵称")

        assert user1["id"] == user2["id"]
        assert user2["nickname"] == "新昵称"


@pytest.mark.asyncio
async def test_find_existing_user_by_unionid():
    """AC-2: returning WeChat user matched by unionid even with different openid."""
    with patch("app.core.database._use_supabase", return_value=False):
        from app.core.database import get_or_create_user_by_wechat, _mem_users
        _mem_users.clear()

        user1 = await get_or_create_user_by_wechat(openid="wx_open_1", unionid="wx_union_shared")
        user2 = await get_or_create_user_by_wechat(openid="wx_open_2", unionid="wx_union_shared")

        assert user1["id"] == user2["id"]
        assert user2["wechat_openid"] == "wx_open_2"  # updated to latest


# ── Phone login still works (regression) ──

@pytest.mark.asyncio
async def test_phone_login_still_works():
    """AC-4: phone login unaffected by WeChat changes."""
    with patch("app.core.database._use_supabase", return_value=False):
        from app.core.database import get_or_create_user, _mem_users
        _mem_users.clear()

        user = await get_or_create_user("13800138000")
        assert user["phone"] == "13800138000"
        assert user["id"]

        # Find again
        user2 = await get_or_create_user("13800138000")
        assert user["id"] == user2["id"]


# ── Login endpoint redirect (no real WeChat needed) ──

def test_login_endpoint_returns_503_when_unconfigured():
    """When wechat_app_id is empty, /login returns 503."""
    from fastapi.testclient import TestClient
    from app.main import app

    with patch("app.api.auth_wechat.get_settings") as mock_settings:
        mock_settings.return_value = MagicMock(
            wechat_app_id="",
            wechat_app_secret="",
            wechat_mp_app_id="",
            wechat_mp_app_secret="",
            jwt_secret="test",
            app_base_url="http://localhost:8000",
        )
        client = TestClient(app, raise_server_exceptions=False)
        resp = client.get("/api/v1/auth/wechat/login", follow_redirects=False)
        assert resp.status_code == 503


def test_login_endpoint_redirects_when_configured():
    """When configured, /login returns 302 to WeChat."""
    from fastapi.testclient import TestClient
    from app.main import app

    with patch("app.api.auth_wechat.get_settings") as mock_settings:
        mock_settings.return_value = MagicMock(
            wechat_app_id="wx_test_app_id",
            wechat_app_secret="wx_test_secret",
            wechat_mp_app_id="",
            wechat_mp_app_secret="",
            jwt_secret="test",
            app_base_url="http://localhost:8000",
        )
        client = TestClient(app, raise_server_exceptions=False)
        resp = client.get("/api/v1/auth/wechat/login", follow_redirects=False)
        assert resp.status_code == 302
        assert "open.weixin.qq.com" in resp.headers["location"]
        assert "wx_test_app_id" in resp.headers["location"]


def test_callback_rejects_missing_state():
    """AC-6: callback without state redirects to login with error."""
    from fastapi.testclient import TestClient
    from app.main import app

    with patch("app.api.auth_wechat.get_settings") as mock_settings:
        mock_settings.return_value = MagicMock(
            jwt_secret="test",
            frontend_base_url="http://localhost:3000",
            app_base_url="http://localhost:8000",
            wechat_app_id="wx_id",
            wechat_app_secret="wx_secret",
            wechat_mp_app_id="",
            wechat_mp_app_secret="",
        )
        client = TestClient(app, raise_server_exceptions=False)
        resp = client.get(
            "/api/v1/auth/wechat/callback?code=test_code&state=invalid",
            follow_redirects=False,
        )
        assert resp.status_code == 302
        assert "error" in resp.headers["location"]
        assert "login" in resp.headers["location"]

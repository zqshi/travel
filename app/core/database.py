from __future__ import annotations

import uuid
from datetime import datetime, timezone
from functools import lru_cache

from app.core.config import get_settings


def _use_supabase() -> bool:
    settings = get_settings()
    return bool(settings.supabase_url and settings.supabase_key)


@lru_cache()
def _get_supabase():
    from supabase import create_client
    settings = get_settings()
    return create_client(settings.supabase_url, settings.supabase_key)


def get_supabase():
    """Public accessor for other modules."""
    return _get_supabase()


# In-memory fallback storage
_mem_users: dict[str, dict] = {}
_mem_sessions: dict[str, dict] = {}
_mem_messages: dict[str, list[dict]] = {}


async def get_or_create_user(phone: str) -> dict:
    if _use_supabase():
        sb = _get_supabase()
        result = sb.table("users").select("*").eq("phone", phone).execute()
        if result.data:
            return result.data[0]
        new_user = sb.table("users").insert({"phone": phone}).execute()
        return new_user.data[0]

    # Memory fallback
    for u in _mem_users.values():
        if u.get("phone") == phone:
            return u
    user_id = str(uuid.uuid4())
    user = {
        "id": user_id,
        "phone": phone,
        "wechat_openid": None,
        "wechat_unionid": None,
        "nickname": None,
        "avatar_url": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    _mem_users[user_id] = user
    return user


async def get_or_create_user_by_wechat(
    openid: str,
    unionid: str | None = None,
    nickname: str | None = None,
    avatar_url: str | None = None,
) -> dict:
    """Find user by wechat unionid/openid, or create a new one."""
    if _use_supabase():
        sb = _get_supabase()
        # Try unionid first (cross-platform match)
        if unionid:
            result = sb.table("users").select("*").eq("wechat_unionid", unionid).execute()
            if result.data:
                # Update openid / profile if changed
                user = result.data[0]
                updates: dict = {}
                if user.get("wechat_openid") != openid:
                    updates["wechat_openid"] = openid
                if nickname and user.get("nickname") != nickname:
                    updates["nickname"] = nickname
                if avatar_url and user.get("avatar_url") != avatar_url:
                    updates["avatar_url"] = avatar_url
                if updates:
                    sb.table("users").update(updates).eq("id", user["id"]).execute()
                    user.update(updates)
                return user

        # Try openid
        result = sb.table("users").select("*").eq("wechat_openid", openid).execute()
        if result.data:
            user = result.data[0]
            updates = {}
            if unionid and not user.get("wechat_unionid"):
                updates["wechat_unionid"] = unionid
            if nickname and user.get("nickname") != nickname:
                updates["nickname"] = nickname
            if avatar_url and user.get("avatar_url") != avatar_url:
                updates["avatar_url"] = avatar_url
            if updates:
                sb.table("users").update(updates).eq("id", user["id"]).execute()
                user.update(updates)
            return user

        # Create new
        new_data = {"wechat_openid": openid}
        if unionid:
            new_data["wechat_unionid"] = unionid
        if nickname:
            new_data["nickname"] = nickname
        if avatar_url:
            new_data["avatar_url"] = avatar_url
        new_user = sb.table("users").insert(new_data).execute()
        return new_user.data[0]

    # Memory fallback
    # Try unionid
    if unionid:
        for u in _mem_users.values():
            if u.get("wechat_unionid") == unionid:
                if nickname:
                    u["nickname"] = nickname
                if avatar_url:
                    u["avatar_url"] = avatar_url
                u["wechat_openid"] = openid
                return u

    # Try openid
    for u in _mem_users.values():
        if u.get("wechat_openid") == openid:
            if unionid and not u.get("wechat_unionid"):
                u["wechat_unionid"] = unionid
            if nickname:
                u["nickname"] = nickname
            if avatar_url:
                u["avatar_url"] = avatar_url
            return u

    # Create new
    user_id = str(uuid.uuid4())
    user = {
        "id": user_id,
        "phone": None,
        "wechat_openid": openid,
        "wechat_unionid": unionid,
        "nickname": nickname,
        "avatar_url": avatar_url,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    _mem_users[user_id] = user
    return user


async def create_session(user_id: str, title: str = "新对话") -> dict:
    if _use_supabase():
        sb = _get_supabase()
        result = sb.table("sessions").insert({"user_id": user_id, "title": title}).execute()
        return result.data[0]

    session_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    session = {"id": session_id, "user_id": user_id, "title": title, "pinned": False, "created_at": now, "updated_at": now}
    _mem_sessions[session_id] = session
    _mem_messages[session_id] = []
    return session


async def get_user_sessions(user_id: str) -> list[dict]:
    if _use_supabase():
        sb = _get_supabase()
        result = sb.table("sessions").select("*").eq("user_id", user_id).order("pinned", desc=True).order("updated_at", desc=True).execute()
        return result.data

    return sorted(
        [s for s in _mem_sessions.values() if s["user_id"] == user_id],
        key=lambda x: (x.get("pinned", False), x["updated_at"]),
        reverse=True,
    )


async def get_session_messages(session_id: str) -> list[dict]:
    if _use_supabase():
        sb = _get_supabase()
        result = sb.table("messages").select("*").eq("session_id", session_id).order("created_at").execute()
        return result.data

    return _mem_messages.get(session_id, [])


async def save_message(session_id: str, role: str, content: str, metadata: dict | None = None) -> dict:
    if _use_supabase():
        sb = _get_supabase()
        data = {"session_id": session_id, "role": role, "content": content}
        if metadata:
            data["metadata"] = metadata
        result = sb.table("messages").insert(data).execute()
        sb.table("sessions").update({"updated_at": "now()"}).eq("id", session_id).execute()
        return result.data[0]

    msg_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    msg = {"id": msg_id, "session_id": session_id, "role": role, "content": content, "metadata": metadata or {}, "created_at": now}
    _mem_messages.setdefault(session_id, []).append(msg)
    if session_id in _mem_sessions:
        _mem_sessions[session_id]["updated_at"] = now
    return msg


async def update_session_title(session_id: str, title: str) -> None:
    if _use_supabase():
        sb = _get_supabase()
        sb.table("sessions").update({"title": title}).eq("id", session_id).execute()
        return

    if session_id in _mem_sessions:
        _mem_sessions[session_id]["title"] = title


async def delete_session(session_id: str) -> None:
    if _use_supabase():
        sb = _get_supabase()
        sb.table("messages").delete().eq("session_id", session_id).execute()
        sb.table("sessions").delete().eq("id", session_id).execute()
        return

    _mem_sessions.pop(session_id, None)
    _mem_messages.pop(session_id, None)


async def update_session_pinned(session_id: str, pinned: bool) -> None:
    if _use_supabase():
        sb = _get_supabase()
        sb.table("sessions").update({"pinned": pinned}).eq("id", session_id).execute()
        return

    if session_id in _mem_sessions:
        _mem_sessions[session_id]["pinned"] = pinned

"""Repository 接口 + 实现 — 消除 database.py 的 if/else 重复模式"""
from __future__ import annotations

import uuid
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Protocol


class UserRepository(ABC):
    @abstractmethod
    async def get_or_create_by_phone(self, phone: str) -> dict: ...

    @abstractmethod
    async def get_or_create_by_wechat(
        self, openid: str, unionid: str | None = None,
        nickname: str | None = None, avatar_url: str | None = None
    ) -> dict: ...


class SessionRepository(ABC):
    @abstractmethod
    async def create(self, user_id: str, title: str = "新对话") -> dict: ...

    @abstractmethod
    async def get_by_user(self, user_id: str) -> list[dict]: ...

    @abstractmethod
    async def get_messages(self, session_id: str) -> list[dict]: ...

    @abstractmethod
    async def save_message(self, session_id: str, role: str, content: str, metadata: dict | None = None) -> dict: ...

    @abstractmethod
    async def update_title(self, session_id: str, title: str) -> None: ...

    @abstractmethod
    async def delete(self, session_id: str) -> None: ...

    @abstractmethod
    async def update_pinned(self, session_id: str, pinned: bool) -> None: ...


# === Supabase 实现 ===

class SupabaseUserRepository(UserRepository):
    def __init__(self, client):
        self._sb = client

    async def get_or_create_by_phone(self, phone: str) -> dict:
        result = self._sb.table("users").select("*").eq("phone", phone).execute()
        if result.data:
            return result.data[0]
        new_user = self._sb.table("users").insert({"phone": phone}).execute()
        return new_user.data[0]

    async def get_or_create_by_wechat(
        self, openid: str, unionid: str | None = None,
        nickname: str | None = None, avatar_url: str | None = None
    ) -> dict:
        sb = self._sb
        # Try unionid first
        if unionid:
            result = sb.table("users").select("*").eq("wechat_unionid", unionid).execute()
            if result.data:
                user = result.data[0]
                updates = self._build_wechat_updates(user, openid, nickname, avatar_url)
                if updates:
                    sb.table("users").update(updates).eq("id", user["id"]).execute()
                    user.update(updates)
                return user

        # Try openid
        result = sb.table("users").select("*").eq("wechat_openid", openid).execute()
        if result.data:
            user = result.data[0]
            updates: dict = {}
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

    @staticmethod
    def _build_wechat_updates(user: dict, openid: str, nickname: str | None, avatar_url: str | None) -> dict:
        updates: dict = {}
        if user.get("wechat_openid") != openid:
            updates["wechat_openid"] = openid
        if nickname and user.get("nickname") != nickname:
            updates["nickname"] = nickname
        if avatar_url and user.get("avatar_url") != avatar_url:
            updates["avatar_url"] = avatar_url
        return updates


class SupabaseSessionRepository(SessionRepository):
    def __init__(self, client):
        self._sb = client

    async def create(self, user_id: str, title: str = "新对话") -> dict:
        result = self._sb.table("sessions").insert({"user_id": user_id, "title": title}).execute()
        return result.data[0]

    async def get_by_user(self, user_id: str) -> list[dict]:
        result = (
            self._sb.table("sessions").select("*")
            .eq("user_id", user_id)
            .order("pinned", desc=True)
            .order("updated_at", desc=True)
            .execute()
        )
        return result.data

    async def get_messages(self, session_id: str) -> list[dict]:
        result = self._sb.table("messages").select("*").eq("session_id", session_id).order("created_at").execute()
        return result.data

    async def save_message(self, session_id: str, role: str, content: str, metadata: dict | None = None) -> dict:
        data = {"session_id": session_id, "role": role, "content": content}
        if metadata:
            data["metadata"] = metadata
        result = self._sb.table("messages").insert(data).execute()
        self._sb.table("sessions").update({"updated_at": "now()"}).eq("id", session_id).execute()
        return result.data[0]

    async def update_title(self, session_id: str, title: str) -> None:
        self._sb.table("sessions").update({"title": title}).eq("id", session_id).execute()

    async def delete(self, session_id: str) -> None:
        self._sb.table("messages").delete().eq("session_id", session_id).execute()
        self._sb.table("sessions").delete().eq("id", session_id).execute()

    async def update_pinned(self, session_id: str, pinned: bool) -> None:
        self._sb.table("sessions").update({"pinned": pinned}).eq("id", session_id).execute()


# === In-Memory 实现 ===

class MemoryUserRepository(UserRepository):
    def __init__(self):
        self._users: dict[str, dict] = {}

    async def get_or_create_by_phone(self, phone: str) -> dict:
        for u in self._users.values():
            if u.get("phone") == phone:
                return u
        user_id = str(uuid.uuid4())
        user = {
            "id": user_id, "phone": phone,
            "wechat_openid": None, "wechat_unionid": None,
            "nickname": None, "avatar_url": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        self._users[user_id] = user
        return user

    async def get_or_create_by_wechat(
        self, openid: str, unionid: str | None = None,
        nickname: str | None = None, avatar_url: str | None = None
    ) -> dict:
        # Try unionid
        if unionid:
            for u in self._users.values():
                if u.get("wechat_unionid") == unionid:
                    if nickname:
                        u["nickname"] = nickname
                    if avatar_url:
                        u["avatar_url"] = avatar_url
                    u["wechat_openid"] = openid
                    return u

        # Try openid
        for u in self._users.values():
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
            "id": user_id, "phone": None,
            "wechat_openid": openid, "wechat_unionid": unionid,
            "nickname": nickname, "avatar_url": avatar_url,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        self._users[user_id] = user
        return user


class MemorySessionRepository(SessionRepository):
    def __init__(self):
        self._sessions: dict[str, dict] = {}
        self._messages: dict[str, list[dict]] = {}

    async def create(self, user_id: str, title: str = "新对话") -> dict:
        session_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        session = {"id": session_id, "user_id": user_id, "title": title, "pinned": False, "created_at": now, "updated_at": now}
        self._sessions[session_id] = session
        self._messages[session_id] = []
        return session

    async def get_by_user(self, user_id: str) -> list[dict]:
        return sorted(
            [s for s in self._sessions.values() if s["user_id"] == user_id],
            key=lambda x: (x.get("pinned", False), x["updated_at"]),
            reverse=True,
        )

    async def get_messages(self, session_id: str) -> list[dict]:
        return self._messages.get(session_id, [])

    async def save_message(self, session_id: str, role: str, content: str, metadata: dict | None = None) -> dict:
        msg_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        msg = {"id": msg_id, "session_id": session_id, "role": role, "content": content, "metadata": metadata or {}, "created_at": now}
        self._messages.setdefault(session_id, []).append(msg)
        if session_id in self._sessions:
            self._sessions[session_id]["updated_at"] = now
        return msg

    async def update_title(self, session_id: str, title: str) -> None:
        if session_id in self._sessions:
            self._sessions[session_id]["title"] = title

    async def delete(self, session_id: str) -> None:
        self._sessions.pop(session_id, None)
        self._messages.pop(session_id, None)

    async def update_pinned(self, session_id: str, pinned: bool) -> None:
        if session_id in self._sessions:
            self._sessions[session_id]["pinned"] = pinned


# === 工厂 ===

_user_repo: UserRepository | None = None
_session_repo: SessionRepository | None = None


def get_user_repository() -> UserRepository:
    global _user_repo
    if _user_repo is None:
        from app.core.config import get_settings
        settings = get_settings()
        if settings.supabase_url and settings.supabase_key:
            from supabase import create_client
            client = create_client(settings.supabase_url, settings.supabase_key)
            _user_repo = SupabaseUserRepository(client)
        else:
            _user_repo = MemoryUserRepository()
    return _user_repo


def get_session_repository() -> SessionRepository:
    global _session_repo
    if _session_repo is None:
        from app.core.config import get_settings
        settings = get_settings()
        if settings.supabase_url and settings.supabase_key:
            from supabase import create_client
            client = create_client(settings.supabase_url, settings.supabase_key)
            _session_repo = SupabaseSessionRepository(client)
        else:
            _session_repo = MemorySessionRepository()
    return _session_repo

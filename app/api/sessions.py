from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.auth import get_current_user
from app.core.database import (
    create_session,
    get_user_sessions,
    get_session_messages,
    save_message,
    update_session_title,
    delete_session,
    update_session_pinned,
)

router = APIRouter(prefix="/api/v1/sessions", tags=["sessions"])


class CreateSessionRequest(BaseModel):
    title: str = "新对话"


class SessionResponse(BaseModel):
    id: str
    user_id: str
    title: str
    pinned: bool = False
    created_at: str
    updated_at: str


class MessageResponse(BaseModel):
    id: str
    session_id: str
    role: str
    content: str | None
    metadata: dict | None = None
    created_at: str


class SaveMessageRequest(BaseModel):
    role: str
    content: str
    metadata: dict | None = None


class UpdateSessionRequest(BaseModel):
    title: str | None = None
    pinned: bool | None = None


@router.get("", response_model=list[SessionResponse])
async def list_sessions(user_id: str = Depends(get_current_user)):
    sessions = await get_user_sessions(user_id)
    return sessions


@router.post("", response_model=SessionResponse)
async def new_session(
    request: CreateSessionRequest,
    user_id: str = Depends(get_current_user),
):
    session = await create_session(user_id, request.title)
    return session


@router.get("/{session_id}/messages", response_model=list[MessageResponse])
async def list_messages(session_id: str, user_id: str = Depends(get_current_user)):
    messages = await get_session_messages(session_id)
    return messages


@router.post("/{session_id}/messages", response_model=MessageResponse)
async def add_message(
    session_id: str,
    request: SaveMessageRequest,
    user_id: str = Depends(get_current_user),
):
    msg = await save_message(session_id, request.role, request.content, request.metadata)
    return msg


@router.delete("/{session_id}")
async def remove_session(
    session_id: str,
    user_id: str = Depends(get_current_user),
):
    await delete_session(session_id)
    return {"success": True}


@router.patch("/{session_id}")
async def patch_session(
    session_id: str,
    request: UpdateSessionRequest,
    user_id: str = Depends(get_current_user),
):
    if request.title is not None:
        await update_session_title(session_id, request.title)
    if request.pinned is not None:
        await update_session_pinned(session_id, request.pinned)
    return {"success": True}

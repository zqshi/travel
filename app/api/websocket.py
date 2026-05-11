from __future__ import annotations

import json
import logging
import asyncio
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.core.auth import verify_token

logger = logging.getLogger(__name__)

router = APIRouter(tags=["websocket"])


class ConnectionManager:
    """WebSocket连接池管理"""

    def __init__(self):
        self._connections: dict[str, list[WebSocket]] = {}

    async def connect(self, session_id: str, websocket: WebSocket):
        await websocket.accept()
        if session_id not in self._connections:
            self._connections[session_id] = []
        self._connections[session_id].append(websocket)
        logger.info(f"WS connected: session={session_id}, total={self.total_connections}")

    def disconnect(self, session_id: str, websocket: WebSocket):
        if session_id in self._connections:
            self._connections[session_id] = [
                ws for ws in self._connections[session_id] if ws != websocket
            ]
            if not self._connections[session_id]:
                del self._connections[session_id]
        logger.info(f"WS disconnected: session={session_id}")

    async def send_to_session(self, session_id: str, message: dict):
        """推送消息到指定会话的所有连接"""
        if session_id not in self._connections:
            return
        dead = []
        for ws in self._connections[session_id]:
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self._connections[session_id].remove(ws)

    async def broadcast_to_user(self, user_id: str, message: dict):
        """推送消息到用户的所有会话（需要user_id→session映射）"""
        for session_id, connections in self._connections.items():
            for ws in connections:
                try:
                    await ws.send_json(message)
                except Exception:
                    pass

    @property
    def total_connections(self) -> int:
        return sum(len(conns) for conns in self._connections.values())

    @property
    def active_sessions(self) -> list[str]:
        return list(self._connections.keys())


manager = ConnectionManager()


@router.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    """WebSocket端点，前端连接后接收实时通知"""
    # 验证token（通过query param）
    token = websocket.query_params.get("token", "")
    try:
        user_id = verify_token(token)
    except Exception:
        await websocket.close(code=4001, reason="Unauthorized")
        return

    await manager.connect(session_id, websocket)
    try:
        while True:
            # 保持连接活跃，接收前端心跳
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(session_id, websocket)
    except Exception:
        manager.disconnect(session_id, websocket)


async def push_notification(session_id: str, notification: dict):
    """供其他服务调用：推送通知到前端"""
    await manager.send_to_session(session_id, {
        "type": "notification",
        **notification,
    })

"use client";

import { useEffect, useRef, useState, useCallback } from "react";

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";

export interface WsNotification {
  type: "notification";
  notification_type: "price_change" | "status_change" | "schedule_change" | "booking_confirmed";
  order_id: string;
  item_name?: string;
  old_status?: string;
  new_status?: string;
  old_price?: number;
  new_price?: number;
  detail?: string;
  booking_ref?: string;
  timestamp?: string;
}

interface UseWebSocketOptions {
  sessionId: string | null;
  token: string | null;
  onNotification?: (notification: WsNotification) => void;
}

export function useWebSocket({ sessionId, token, onNotification }: UseWebSocketOptions) {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const onNotificationRef = useRef(onNotification);
  onNotificationRef.current = onNotification;

  const connect = useCallback(() => {
    if (!sessionId || !token) return;

    const ws = new WebSocket(`${WS_BASE}/ws/${sessionId}?token=${token}`);

    ws.onopen = () => {
      setConnected(true);
      // 心跳
      const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send("ping");
        }
      }, 30000);
      ws.addEventListener("close", () => clearInterval(pingInterval));
    };

    ws.onmessage = (event) => {
      if (event.data === "pong") return;
      try {
        const data = JSON.parse(event.data) as WsNotification;
        if (data.type === "notification") {
          onNotificationRef.current?.(data);
        }
      } catch { /* ignore */ }
    };

    ws.onclose = () => {
      setConnected(false);
      // 自动重连
      reconnectTimer.current = setTimeout(connect, 5000);
    };

    ws.onerror = () => {
      ws.close();
    };

    wsRef.current = ws;
  }, [sessionId, token]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { connected };
}

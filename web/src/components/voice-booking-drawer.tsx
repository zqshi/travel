"use client";

import { useState, useEffect, useRef } from "react";
import { Drawer } from "./drawer";
import { VoiceStatus } from "./voice-status";
import { fetchWithAuth } from "@/lib/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface VoiceBookingItem {
  name: string;
  merchantPhone: string;
  date: string;
  travelers: number;
  contactName: string;
  contactPhone: string;
  platform: string;
  priceThb: number;
  priceCny: number;
  detail?: Record<string, unknown>;
}

interface VoiceBookingDrawerProps {
  open: boolean;
  onClose: () => void;
  item: VoiceBookingItem | null;
  sessionId: string;
  onComplete?: (orderId: string, bookingRef: string) => void;
}

type CallStatus = "preparing" | "dialing" | "in_progress" | "completed" | "failed";

interface Transcript {
  role: "agent" | "merchant" | "system";
  content: string;
}

export function VoiceBookingDrawer({ open, onClose, item, sessionId, onComplete }: VoiceBookingDrawerProps) {
  const [status, setStatus] = useState<CallStatus>("preparing");
  const [message, setMessage] = useState("");
  const [transcript, setTranscript] = useState<Transcript[]>([]);
  const [orderId, setOrderId] = useState("");
  const [bookingRef, setBookingRef] = useState("");
  const [error, setError] = useState("");
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  useEffect(() => {
    if (open && item) {
      startBooking();
    }
    return () => {
      setStatus("preparing");
      setMessage("");
      setTranscript([]);
      setOrderId("");
      setBookingRef("");
      setError("");
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const startBooking = async () => {
    if (!item) return;

    try {
      const res = await fetchWithAuth(`${API_BASE}/api/v1/voice-booking/start`, {
        method: "POST",
        body: JSON.stringify({
          session_id: sessionId,
          item_name: item.name,
          merchant_phone: item.merchantPhone,
          booked_date: item.date,
          travelers: item.travelers,
          contact_name: item.contactName,
          contact_phone: item.contactPhone,
          platform: item.platform,
          price_thb: item.priceThb,
          price_cny: item.priceCny,
          item_detail: item.detail || {},
        }),
      });

      if (!res.ok) {
        throw new Error("发起语音预定失败");
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("无法读取响应流");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        let eventType = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith("data: ") && eventType) {
            try {
              const payload = JSON.parse(line.slice(6));
              handleEvent(eventType, payload);
            } catch { /* skip */ }
            eventType = "";
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "语音预定失败");
      setStatus("failed");
    }
  };

  const handleEvent = (event: string, payload: Record<string, unknown>) => {
    switch (event) {
      case "status":
        setStatus(payload.status as CallStatus);
        setMessage(payload.message as string);
        if (payload.booking_ref) {
          setBookingRef(payload.booking_ref as string);
        }
        break;
      case "order":
        setOrderId(payload.order_id as string);
        break;
      case "transcript":
        setTranscript((prev) => [...prev, {
          role: payload.role as Transcript["role"],
          content: payload.content as string,
        }]);
        break;
      case "done":
        setOrderId(payload.order_id as string);
        setBookingRef(payload.booking_ref as string);
        onComplete?.(payload.order_id as string, payload.booking_ref as string);
        break;
      case "error":
        setError(payload.detail as string);
        setStatus("failed");
        break;
    }
  };

  if (!item) return null;

  return (
    <Drawer open={open} onClose={onClose} title="AI语音代订" width="lg">
      <div className="space-y-5">
        {/* Item info */}
        <div className="p-4 rounded-xl bg-background border border-border">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-sm">{item.name}</h3>
              <p className="text-xs text-muted mt-0.5">{item.date} · {item.travelers}人</p>
            </div>
            <span className="text-sm font-bold text-primary">¥{item.priceCny}</span>
          </div>
        </div>

        {/* Status */}
        <VoiceStatus status={status} message={message} />

        {/* Transcript */}
        {transcript.length > 0 && (
          <div className="p-4 rounded-xl bg-background border border-border overflow-y-auto">
            <h4 className="text-xs font-semibold text-muted mb-3">通话记录</h4>
            <div className="space-y-3">
              {transcript.map((t, i) => (
                <div key={i} className={`flex ${t.role === "agent" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-xl px-3 py-2 text-xs ${
                    t.role === "agent"
                      ? "bg-primary/10 text-primary"
                      : t.role === "system"
                      ? "bg-gray-100 dark:bg-gray-800 text-muted italic"
                      : "bg-card border border-border"
                  }`}>
                    <span className="font-medium block mb-0.5 text-[10px] opacity-60">
                      {t.role === "agent" ? "AI助手" : t.role === "merchant" ? "商家" : "系统"}
                    </span>
                    {t.content}
                  </div>
                </div>
              ))}
              <div ref={transcriptEndRef} />
            </div>
          </div>
        )}

        {/* Success result */}
        {status === "completed" && bookingRef && (
          <div className="p-4 rounded-xl bg-success/10 border border-success/20 text-center">
            <p className="text-sm font-semibold text-success">预定成功</p>
            <p className="text-xs text-muted mt-1">确认号：{bookingRef}</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
            <p className="text-xs text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Close button */}
        {(status === "completed" || status === "failed") && (
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-colors"
          >
            {status === "completed" ? "完成" : "关闭"}
          </button>
        )}
      </div>
    </Drawer>
  );
}

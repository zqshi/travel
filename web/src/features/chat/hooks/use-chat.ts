import { useState, useCallback, useRef, useEffect } from "react";
import { getToken } from "@/lib/auth";
import { useWebSocket, type WsNotification } from "@/hooks/use-websocket";
import type { Message, Mode, ThinkingStep } from "../types";
import { COUNTRY_OPTIONS } from "../constants";
import { createSession } from "../services/session-service";
import { saveMessage } from "../services/session-service";
import { streamChat, streamPlan, streamCompare, type PlanParams } from "../services/chat-service";
import { useSessions } from "./use-sessions";
import { useDrawers } from "./use-drawers";

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([{ type: "guide" }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>("plan");
  const [selectedCountry, setSelectedCountry] = useState("TH");
  const [notifications, setNotifications] = useState<WsNotification[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  const sessionsHook = useSessions();
  const drawersHook = useDrawers(setMessages);

  const token = typeof window !== "undefined" ? getToken() : null;
  useWebSocket({
    sessionId: sessionsHook.currentSessionId,
    token,
    onNotification: (notification) => {
      setNotifications((prev) => [...prev, notification]);
      setMessages((prev) => [...prev, { type: "notification", data: notification }]);
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const updateThinking = useCallback(
    (updater: (steps: ThinkingStep[]) => ThinkingStep[]) => {
      setMessages((prev) =>
        prev.map((m) => (m.type === "thinking" ? { ...m, steps: updater(m.steps) } : m)),
      );
    },
    [],
  );

  const handlePlanWithParams = useCallback(
    async (params: PlanParams, sessionId: string | null) => {
      setMessages((prev) => {
        const withoutLoading = prev.filter((m) => m.type !== "loading");
        return [
          ...withoutLoading,
          {
            type: "thinking" as const,
            steps: [{ id: "search", label: "搜索旅行信息", status: "active" as const }],
            collapsed: false,
          },
        ];
      });

      await streamPlan(params, {
        onThinkingUpdate: updateThinking,
        onDone: async (itinerary) => {
          setMessages((prev) => {
            const updated = prev.map((m) =>
              m.type === "thinking" ? { ...m, collapsed: true } : m,
            );
            return [...updated, { type: "itinerary" as const, data: itinerary }];
          });
          if (sessionId) {
            await saveMessage(sessionId, {
              role: "assistant",
              content: "行程已生成",
              metadata: { itinerary },
            });
          }
        },
        onFail: () => {
          setMessages((prev) => {
            const withoutThinking = prev.filter((m) => m.type !== "thinking");
            return [
              ...withoutThinking,
              { type: "error" as const, content: "行程生成结果解析失败，请重试。" },
            ];
          });
        },
      });
    },
    [updateThinking],
  );

  const handleChatFlow = useCallback(
    async (userText: string, sessionId: string | null) => {
      if (sessionId) {
        await saveMessage(sessionId, { role: "user", content: userText });
      }

      setMessages((prev) => prev.filter((m) => m.type !== "loading"));

      const history = messages
        .filter((m) => m.type === "user" || m.type === "text")
        .slice(-10)
        .map((m) => ({
          role: m.type === "user" ? "user" : "assistant",
          content: (m as { content: string }).content,
        }));

      const lastItinerary = [...messages].reverse().find((m) => m.type === "itinerary");
      const itinerary =
        lastItinerary?.type === "itinerary"
          ? (lastItinerary as { data: Record<string, unknown> }).data
          : null;

      setMessages((prev) => [...prev, { type: "text" as const, content: "" }]);

      const { fullText, planParams } = await streamChat(
        { sessionId: sessionId || "", message: userText, history, itinerary },
        {
          onChunk: (text) => {
            setMessages((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last?.type === "text") {
                updated[updated.length - 1] = { ...last, content: text };
              }
              return updated;
            });
          },
          onError: (detail) => {
            throw new Error(detail);
          },
        },
      );

      if (planParams) {
        if (sessionId && fullText) {
          await saveMessage(sessionId, { role: "assistant", content: fullText });
        }
        await handlePlanWithParams(planParams, sessionId);
      } else if (sessionId && fullText) {
        await saveMessage(sessionId, { role: "assistant", content: fullText });
      }
    },
    [messages, handlePlanWithParams],
  );

  const handleCompareFlow = useCallback(
    async (userText: string, sessionId: string | null) => {
      const items = userText
        .split(/[,，\n]/)
        .map((s) => s.trim())
        .filter(Boolean);

      if (sessionId) {
        await saveMessage(sessionId, { role: "user", content: userText });
      }

      setMessages((prev) => {
        const withoutLoading = prev.filter((m) => m.type !== "loading");
        return [
          ...withoutLoading,
          {
            type: "thinking" as const,
            steps: [{ id: "search", label: "搜索各平台价格", status: "active" as const }],
            collapsed: false,
          },
        ];
      });

      await streamCompare(items, {
        onThinkingUpdate: updateThinking,
        onDone: async (result) => {
          setMessages((prev) => {
            const updated = prev.map((m) =>
              m.type === "thinking" ? { ...m, collapsed: true } : m,
            );
            return [...updated, { type: "compare" as const, content: result }];
          });
          if (sessionId) {
            await saveMessage(sessionId, {
              role: "assistant",
              content: result,
              metadata: { type: "compare" },
            });
          }
        },
        onFail: () => {
          setMessages((prev) => {
            const withoutThinking = prev.filter((m) => m.type !== "thinking");
            return [
              ...withoutThinking,
              { type: "error" as const, content: "比价失败，请重试。" },
            ];
          });
        },
      });
    },
    [updateThinking],
  );

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!input.trim() || loading) return;

      const userText = input.trim();
      setInput("");
      setLoading(true);

      const loadingHint =
        mode === "compare" ? "正在搜索多个平台对比价格..." : "正在思考...";

      setMessages((prev) => {
        const filtered = prev.filter((m) => m.type !== "guide");
        return [
          ...filtered,
          { type: "user", content: userText },
          { type: "loading", hint: loadingHint },
        ];
      });

      let sessionId = sessionsHook.currentSessionId;
      if (!sessionId) {
        try {
          const title =
            mode === "compare" ? `比价：${userText.slice(0, 20)}` : userText.slice(0, 30);
          const session = await createSession(title);
          sessionId = session.id;
          sessionsHook.setCurrentSessionId(sessionId);
          sessionsHook.addSession(session);
        } catch {}
      }

      try {
        if (mode === "compare") {
          await handleCompareFlow(userText, sessionId);
        } else {
          await handleChatFlow(userText, sessionId);
        }
      } catch (err) {
        setMessages((prev) => {
          const cleaned = prev.filter((m) => m.type !== "loading" && m.type !== "thinking");
          return [
            ...cleaned,
            {
              type: "error",
              content: `请求失败：${err instanceof Error ? err.message : "未知错误"}`,
            },
          ];
        });
      } finally {
        setLoading(false);
      }
    },
    [input, loading, mode, sessionsHook, handleChatFlow, handleCompareFlow],
  );

  const handleCountrySelect = useCallback(
    (country: (typeof COUNTRY_OPTIONS)[number]) => {
      setSelectedCountry(country.code);
      setInput(`我想去${country.name}旅行`);
    },
    [],
  );

  const addPreset = useCallback((preset: string) => {
    setInput((prev) => (prev ? `${prev}，${preset}` : preset));
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  const dismissNotification = useCallback((index: number) => {
    setNotifications((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleLoadSession = useCallback(
    async (sessionId: string) => {
      const restoredInput = await sessionsHook.loadSession(
        sessionId,
        input,
        sessionsHook.currentSessionId,
        (msgs) => setMessages(msgs),
        () => {
          drawersHook.resetBookingState();
          setNotifications([]);
        },
      );
      setInput(restoredInput);
    },
    [sessionsHook, input, drawersHook],
  );

  const handleCreateNewSession = useCallback(() => {
    const restoredInput = sessionsHook.createNewSession(
      input,
      sessionsHook.currentSessionId,
      () => {
        setMessages([{ type: "guide" }]);
        setLoading(false);
        drawersHook.resetBookingState();
        setNotifications([]);
      },
    );
    setInput(restoredInput);
  }, [sessionsHook, input, drawersHook]);

  return {
    messages,
    setMessages,
    input,
    setInput,
    loading,
    mode,
    setMode,
    selectedCountry,
    notifications,
    bottomRef,
    sessions: sessionsHook,
    drawers: drawersHook,
    handleSubmit,
    handleKeyDown,
    handleCountrySelect,
    addPreset,
    dismissNotification,
    handleLoadSession,
    handleCreateNewSession,
  };
}

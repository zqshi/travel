import { useState, useCallback, useEffect } from "react";
import type { Message, Session } from "../types";
import {
  fetchSessions as fetchSessionsAPI,
  fetchMessages,
  deleteSessionAPI,
  patchSession,
  sortSessions,
} from "../services/session-service";

export function useSessions() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [inputMap, setInputMap] = useState<Map<string, string>>(new Map());
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("sidebar_open") !== "false";
    }
    return true;
  });

  const toggleSidebar = useCallback((open?: boolean) => {
    setSidebarOpen((prev) => {
      const next = open ?? !prev;
      localStorage.setItem("sidebar_open", String(next));
      return next;
    });
  }, []);

  const loadSessions = useCallback(async () => {
    try {
      const data = await fetchSessionsAPI();
      setSessions(data);
    } catch {}
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const addSession = useCallback((session: Session) => {
    setSessions((prev) => sortSessions([session, ...prev]));
  }, []);

  const loadSession = useCallback(
    async (
      sessionId: string,
      currentInput: string,
      currentSessionKey: string | null,
      onMessages: (msgs: Message[]) => void,
      onReset: () => void,
    ) => {
      setInputMap((prev) => {
        const next = new Map(prev);
        next.set(currentSessionKey || "__new", currentInput);
        return next;
      });
      setCurrentSessionId(sessionId);
      onReset();
      try {
        const msgs = await fetchMessages(sessionId);
        onMessages(msgs.length > 0 ? msgs : [{ type: "text", content: "继续规划你的旅行吧。" }]);
      } catch {}
      return inputMap.get(sessionId) || "";
    },
    [inputMap],
  );

  const createNewSession = useCallback(
    (currentInput: string, currentSessionKey: string | null, onReset: () => void) => {
      setInputMap((prev) => {
        const next = new Map(prev);
        next.set(currentSessionKey || "__new", currentInput);
        return next;
      });
      setCurrentSessionId(null);
      onReset();
      return inputMap.get("__new") || "";
    },
    [inputMap],
  );

  const deleteSession = useCallback(
    async (sessionId: string) => {
      try {
        await deleteSessionAPI(sessionId);
        setSessions((prev) => sortSessions(prev.filter((s) => s.id !== sessionId)));
        if (currentSessionId === sessionId) {
          setCurrentSessionId(null);
          return true;
        }
      } catch {}
      return false;
    },
    [currentSessionId],
  );

  const togglePin = useCallback(
    async (sessionId: string) => {
      const session = sessions.find((s) => s.id === sessionId);
      if (!session) return;
      const newPinned = !session.pinned;
      try {
        await patchSession(sessionId, { pinned: newPinned });
        setSessions((prev) =>
          sortSessions(prev.map((s) => (s.id === sessionId ? { ...s, pinned: newPinned } : s))),
        );
      } catch {}
    },
    [sessions],
  );

  return {
    sessions,
    currentSessionId,
    setCurrentSessionId,
    sidebarOpen,
    toggleSidebar,
    loadSessions,
    addSession,
    loadSession,
    createNewSession,
    deleteSession,
    togglePin,
  };
}

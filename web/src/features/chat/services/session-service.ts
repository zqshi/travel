import { fetchWithAuth } from "@/lib/auth";
import { API_BASE } from "../constants";
import type { Message, Session } from "../types";

export function sortSessions(sessions: Session[]): Session[] {
  return [...sessions].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.updated_at.localeCompare(a.updated_at);
  });
}

export async function fetchSessions(): Promise<Session[]> {
  const res = await fetchWithAuth(`${API_BASE}/api/v1/sessions`);
  if (!res.ok) throw new Error("加载会话列表失败");
  const data = await res.json();
  return sortSessions(
    data.map((s: Record<string, unknown>) => ({ ...s, pinned: s.pinned ?? false })),
  );
}

export async function fetchMessages(sessionId: string): Promise<Message[]> {
  const res = await fetchWithAuth(`${API_BASE}/api/v1/sessions/${sessionId}/messages`);
  if (!res.ok) throw new Error("加载消息失败");
  const data = await res.json();
  const msgs: Message[] = data.map(
    (m: { role: string; content: string; metadata?: Record<string, unknown> }) => {
      if (m.role === "user") return { type: "user" as const, content: m.content };
      if (m.metadata?.itinerary)
        return { type: "itinerary" as const, data: m.metadata.itinerary as Record<string, unknown> };
      if (m.metadata?.type === "compare")
        return { type: "compare" as const, content: m.content };
      return { type: "text" as const, content: m.content };
    },
  );
  return msgs;
}

export async function createSession(title: string): Promise<Session> {
  const res = await fetchWithAuth(`${API_BASE}/api/v1/sessions`, {
    method: "POST",
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error("创建会话失败");
  const session = await res.json();
  return { ...session, pinned: session.pinned ?? false };
}

export async function deleteSessionAPI(sessionId: string): Promise<void> {
  await fetchWithAuth(`${API_BASE}/api/v1/sessions/${sessionId}`, { method: "DELETE" });
}

export async function patchSession(
  sessionId: string,
  data: Partial<Pick<Session, "pinned" | "title">>,
): Promise<void> {
  await fetchWithAuth(`${API_BASE}/api/v1/sessions/${sessionId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function saveMessage(
  sessionId: string,
  msg: { role: string; content: string; metadata?: Record<string, unknown> },
): Promise<void> {
  await fetchWithAuth(`${API_BASE}/api/v1/sessions/${sessionId}/messages`, {
    method: "POST",
    body: JSON.stringify(msg),
  });
}

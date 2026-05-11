import { fetchWithAuth } from "@/lib/auth";
import { API_BASE, PREF_MAP } from "../constants";
import type { ThinkingStep } from "../types";
import { handleSSEEvent, parseSSEStream, parseAPIError } from "./sse-parser";

export interface PlanParams {
  destination: string;
  start_date: string;
  end_date: string;
  budget_cny: number;
  travelers: number;
  preferences?: string[];
  notes?: string;
}

export interface StreamChatCallbacks {
  onChunk: (fullText: string) => void;
  onError: (detail: string) => void;
}

export interface StreamChatResult {
  fullText: string;
  planParams: PlanParams | null;
}

export async function streamChat(
  params: {
    sessionId: string;
    message: string;
    history: { role: string; content: string }[];
    itinerary: Record<string, unknown> | null;
  },
  callbacks: StreamChatCallbacks,
): Promise<StreamChatResult> {
  const res = await fetchWithAuth(`${API_BASE}/api/v1/chat/stream`, {
    method: "POST",
    body: JSON.stringify({
      session_id: params.sessionId || "",
      message: params.message,
      history: params.history,
      itinerary: params.itinerary,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "请求失败" }));
    throw new Error(parseAPIError(err) || `HTTP ${res.status}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("无法读取响应流");

  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";
  let released = false;

  try {
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
            if (eventType === "chunk") {
              fullText += payload.content;
              callbacks.onChunk(fullText);
            } else if (eventType === "plan_ready") {
              released = true;
              reader.releaseLock();
              return { fullText, planParams: payload as PlanParams };
            } else if (eventType === "error") {
              throw new Error(payload.detail);
            }
          } catch (e) {
            if (e instanceof Error && e.message !== "Unexpected end of JSON input") throw e;
          }
          eventType = "";
        }
      }
    }
  } finally {
    if (!released) reader.releaseLock();
  }

  return { fullText, planParams: null };
}

export interface StreamPlanCallbacks {
  onThinkingUpdate: (updater: (steps: ThinkingStep[]) => ThinkingStep[]) => void;
  onDone: (itinerary: Record<string, unknown>) => void | Promise<void>;
  onFail: () => void;
}

export async function streamPlan(
  params: PlanParams,
  callbacks: StreamPlanCallbacks,
): Promise<void> {
  const mappedPrefs = (params.preferences || [])
    .map((p) => PREF_MAP[p] || "")
    .filter(Boolean);

  const res = await fetchWithAuth(`${API_BASE}/api/v1/plan/stream`, {
    method: "POST",
    body: JSON.stringify({
      destination: params.destination,
      start_date: params.start_date,
      end_date: params.end_date,
      travelers: params.travelers,
      budget_cny: params.budget_cny,
      preferences: mappedPrefs,
      notes: params.notes || "",
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "请求失败" }));
    throw new Error(parseAPIError(err) || `HTTP ${res.status}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("无法读取响应流");

  let finalItinerary: Record<string, unknown> | null = null;

  await parseSSEStream(reader, (event, payload) => {
    handleSSEEvent(event, payload, callbacks.onThinkingUpdate, (itinerary) => {
      finalItinerary = itinerary;
    });
  });

  if (finalItinerary) {
    await callbacks.onDone(finalItinerary);
  } else {
    callbacks.onFail();
  }
}

export interface StreamCompareCallbacks {
  onThinkingUpdate: (updater: (steps: ThinkingStep[]) => ThinkingStep[]) => void;
  onDone: (result: string) => void;
  onFail: () => void;
}

export async function streamCompare(
  items: string[],
  callbacks: StreamCompareCallbacks,
): Promise<void> {
  if (items.length === 0) throw new Error("请输入至少一个比价项目");

  const res = await fetchWithAuth(`${API_BASE}/api/v1/compare/stream`, {
    method: "POST",
    body: JSON.stringify({ items }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "请求失败" }));
    throw new Error(parseAPIError(err) || `HTTP ${res.status}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("无法读取响应流");

  let compareResult: string | null = null;

  const decoder = new TextDecoder();
  let buffer = "";

  try {
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
            if (eventType === "step") {
              const step = payload.step as string;
              const status = payload.status as string;
              if (status === "start") {
                const labels: Record<string, string> = {
                  search: "搜索各平台价格",
                  analyze: "分析比价结果",
                };
                callbacks.onThinkingUpdate((steps) => {
                  const exists = steps.find((s) => s.id === step);
                  if (exists)
                    return steps.map((s) =>
                      s.id === step ? { ...s, status: "active" as const } : s,
                    );
                  return [
                    ...steps,
                    { id: step, label: labels[step] || step, status: "active" as const },
                  ];
                });
              } else if (status === "done") {
                callbacks.onThinkingUpdate((steps) =>
                  steps.map((s) =>
                    s.id === step
                      ? {
                          ...s,
                          status: "done" as const,
                          detail: payload.results_count
                            ? `${payload.results_count}条结果`
                            : undefined,
                        }
                      : s,
                  ),
                );
              }
            } else if (eventType === "search") {
              const completed = payload.completed as number;
              const total = payload.total as number;
              const platformsFound = payload.platforms_found as number;
              callbacks.onThinkingUpdate((steps) =>
                steps.map((s) =>
                  s.id === "search"
                    ? { ...s, detail: `${completed}/${total} · ${platformsFound}个平台` }
                    : s,
                ),
              );
            } else if (eventType === "done") {
              compareResult = payload.comparisons as string;
            } else if (eventType === "error") {
              callbacks.onThinkingUpdate((steps) => {
                const last = steps[steps.length - 1];
                if (last)
                  return steps.map((s) =>
                    s.id === last.id
                      ? { ...s, status: "error" as const, detail: payload.detail }
                      : s,
                  );
                return steps;
              });
            }
          } catch {}
          eventType = "";
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  if (compareResult) {
    callbacks.onDone(compareResult);
  } else {
    callbacks.onFail();
  }
}

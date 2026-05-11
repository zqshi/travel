import type { ThinkingStep } from "../types";

export function handleSSEEvent(
  event: string,
  payload: Record<string, unknown>,
  updateThinking: (updater: (steps: ThinkingStep[]) => ThinkingStep[]) => void,
  onDone: (itinerary: Record<string, unknown>) => void,
) {
  switch (event) {
    case "step": {
      const step = payload.step as string;
      const status = payload.status as string;
      if (status === "start") {
        const labels: Record<string, string> = {
          search: "搜索旅行信息",
          plan: "生成行程方案",
          review: "审核行程合理性",
        };
        updateThinking((steps) => {
          const exists = steps.find((s) => s.id === step);
          if (exists) return steps.map((s) => s.id === step ? { ...s, status: "active" as const } : s);
          return [...steps, { id: step, label: labels[step] || step, status: "active" as const }];
        });
      } else if (status === "done") {
        const sitesCount = payload.sites_count as number | undefined;
        updateThinking((steps) => steps.map((s) =>
          s.id === step ? { ...s, status: "done" as const, detail: sitesCount ? `${sitesCount}个来源` : undefined } : s
        ));
      }
      break;
    }
    case "search": {
      const completed = payload.completed as number;
      const total = payload.total as number;
      const sitesCount = payload.sites_count as number;
      const sites = (payload.sites as string[]) || [];
      updateThinking((steps) => steps.map((s) =>
        s.id === "search" ? {
          ...s,
          detail: `${completed}/${total} 已检索 · ${sitesCount}个来源${sites.length ? " · " + sites.slice(0, 3).join(", ") : ""}`,
        } : s
      ));
      break;
    }
    case "chunk":
      break;
    case "done": {
      const itinerary = payload.itinerary as Record<string, unknown>;
      if (itinerary) onDone(itinerary);
      break;
    }
    case "error": {
      updateThinking((steps) => {
        const last = steps[steps.length - 1];
        if (last) return steps.map((s) => s.id === last.id ? { ...s, status: "error" as const, detail: payload.detail as string } : s);
        return steps;
      });
      break;
    }
  }
}

export interface SSEEvent {
  event: string;
  data: Record<string, unknown>;
}

export async function parseSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onEvent: (event: string, data: Record<string, unknown>) => void,
): Promise<void> {
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
            onEvent(eventType, payload);
          } catch {}
          eventType = "";
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export function parseAPIError(err: { detail?: unknown }): string {
  if (Array.isArray(err.detail)) {
    return err.detail.map((d: { msg?: string }) => d.msg || JSON.stringify(d)).join("; ");
  }
  return (err.detail as string) || "请求失败";
}

import { describe, it, expect } from "vitest";
import { handleSSEEvent, parseSSEStream, parseAPIError } from "../sse-parser";
import type { ThinkingStep } from "../../types";

describe("handleSSEEvent", () => {
  const makeUpdater = (steps: ThinkingStep[]) => {
    let current = steps;
    const update = (fn: (s: ThinkingStep[]) => ThinkingStep[]) => {
      current = fn(current);
    };
    return { update, get: () => current };
  };

  it("adds a new step on step/start", () => {
    const { update, get } = makeUpdater([]);
    handleSSEEvent("step", { step: "search", status: "start" }, update, () => {});
    expect(get()).toHaveLength(1);
    expect(get()[0]).toMatchObject({ id: "search", label: "搜索旅行信息", status: "active" });
  });

  it("marks step done on step/done", () => {
    const { update, get } = makeUpdater([{ id: "search", label: "搜索旅行信息", status: "active" }]);
    handleSSEEvent("step", { step: "search", status: "done", sites_count: 5 }, update, () => {});
    expect(get()[0]).toMatchObject({ status: "done", detail: "5个来源" });
  });

  it("sets active on existing step with start", () => {
    const { update, get } = makeUpdater([{ id: "plan", label: "生成行程方案", status: "done" }]);
    handleSSEEvent("step", { step: "plan", status: "start" }, update, () => {});
    expect(get()[0].status).toBe("active");
  });

  it("updates search progress", () => {
    const { update, get } = makeUpdater([{ id: "search", label: "搜索旅行信息", status: "active" }]);
    handleSSEEvent("search", { completed: 2, total: 5, sites_count: 3, sites: ["a", "b", "c", "d"] }, update, () => {});
    expect(get()[0].detail).toContain("2/5");
    expect(get()[0].detail).toContain("3个来源");
  });

  it("calls onDone with itinerary on done event", () => {
    let result: Record<string, unknown> | null = null;
    const { update } = makeUpdater([]);
    handleSSEEvent("done", { itinerary: { days: [] } }, update, (it) => { result = it; });
    expect(result).toEqual({ days: [] });
  });

  it("sets error status on error event", () => {
    const { update, get } = makeUpdater([
      { id: "search", label: "搜索旅行信息", status: "active" },
    ]);
    handleSSEEvent("error", { detail: "timeout" }, update, () => {});
    expect(get()[0]).toMatchObject({ status: "error", detail: "timeout" });
  });

  it("ignores chunk events", () => {
    const { update, get } = makeUpdater([]);
    handleSSEEvent("chunk", { content: "hello" }, update, () => {});
    expect(get()).toHaveLength(0);
  });
});

describe("parseSSEStream", () => {
  function makeReader(chunks: string[]): ReadableStreamDefaultReader<Uint8Array> {
    const encoder = new TextEncoder();
    let index = 0;
    return {
      read: async () => {
        if (index >= chunks.length) return { done: true, value: undefined };
        return { done: false, value: encoder.encode(chunks[index++]) };
      },
      releaseLock: () => {},
      cancel: async () => {},
      closed: Promise.resolve(undefined),
    } as unknown as ReadableStreamDefaultReader<Uint8Array>;
  }

  it("parses multiple events", async () => {
    const events: { event: string; data: Record<string, unknown> }[] = [];
    const reader = makeReader([
      'event: step\ndata: {"step":"search","status":"start"}\n\nevent: done\ndata: {"itinerary":{}}\n\n',
    ]);
    await parseSSEStream(reader, (e, d) => events.push({ event: e, data: d }));
    expect(events).toHaveLength(2);
    expect(events[0].event).toBe("step");
    expect(events[1].event).toBe("done");
  });

  it("buffers incomplete lines across chunks", async () => {
    const events: { event: string; data: Record<string, unknown> }[] = [];
    const reader = makeReader([
      'eve',
      'nt: step\ndata: {"step":"plan","status":"start"}\n\n',
    ]);
    await parseSSEStream(reader, (e, d) => events.push({ event: e, data: d }));
    expect(events).toHaveLength(1);
    expect(events[0].event).toBe("step");
    expect(events[0].data).toEqual({ step: "plan", status: "start" });
  });

  it("skips malformed JSON", async () => {
    const events: { event: string; data: Record<string, unknown> }[] = [];
    const reader = makeReader([
      'event: step\ndata: {broken\n\nevent: done\ndata: {"ok":true}\n\n',
    ]);
    await parseSSEStream(reader, (e, d) => events.push({ event: e, data: d }));
    expect(events).toHaveLength(1);
    expect(events[0].event).toBe("done");
  });
});

describe("parseAPIError", () => {
  it("handles array detail (FastAPI validation)", () => {
    const result = parseAPIError({ detail: [{ msg: "field required" }, { msg: "invalid type" }] });
    expect(result).toBe("field required; invalid type");
  });

  it("handles string detail", () => {
    expect(parseAPIError({ detail: "Not found" })).toBe("Not found");
  });

  it("returns default on empty detail", () => {
    expect(parseAPIError({})).toBe("请求失败");
  });
});

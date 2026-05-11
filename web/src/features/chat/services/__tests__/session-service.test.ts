import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchSessions,
  fetchMessages,
  createSession,
  deleteSessionAPI,
  patchSession,
  saveMessage,
  sortSessions,
} from "../session-service";
import type { Session } from "../../types";

vi.mock("@/lib/auth", () => ({
  fetchWithAuth: vi.fn(),
}));

import { fetchWithAuth } from "@/lib/auth";
const mockFetch = vi.mocked(fetchWithAuth);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("sortSessions", () => {
  it("puts pinned sessions first, then sorts by updated_at desc", () => {
    const sessions: Session[] = [
      { id: "1", title: "A", pinned: false, updated_at: "2024-01-03" },
      { id: "2", title: "B", pinned: true, updated_at: "2024-01-01" },
      { id: "3", title: "C", pinned: false, updated_at: "2024-01-05" },
    ];
    const sorted = sortSessions(sessions);
    expect(sorted.map((s) => s.id)).toEqual(["2", "3", "1"]);
  });
});

describe("fetchSessions", () => {
  it("returns sorted sessions", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [
        { id: "1", title: "A", updated_at: "2024-01-02" },
        { id: "2", title: "B", pinned: true, updated_at: "2024-01-01" },
      ],
    } as Response);

    const sessions = await fetchSessions();
    expect(sessions[0].id).toBe("2");
    expect(sessions[0].pinned).toBe(true);
    expect(sessions[1].pinned).toBe(false);
  });

  it("throws on non-ok response", async () => {
    mockFetch.mockResolvedValue({ ok: false } as Response);
    await expect(fetchSessions()).rejects.toThrow("加载会话列表失败");
  });
});

describe("fetchMessages", () => {
  it("maps messages to correct types", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [
        { role: "user", content: "hello" },
        { role: "assistant", content: "hi", metadata: {} },
        { role: "assistant", content: "trip", metadata: { itinerary: { days: [] } } },
        { role: "assistant", content: "compare", metadata: { type: "compare" } },
      ],
    } as Response);

    const msgs = await fetchMessages("sess1");
    expect(msgs[0]).toEqual({ type: "user", content: "hello" });
    expect(msgs[1]).toEqual({ type: "text", content: "hi" });
    expect(msgs[2]).toEqual({ type: "itinerary", data: { days: [] } });
    expect(msgs[3]).toEqual({ type: "compare", content: "compare" });
  });
});

describe("createSession", () => {
  it("returns session with pinned default", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ id: "new-1", title: "test" }),
    } as Response);

    const session = await createSession("test");
    expect(session.pinned).toBe(false);
    expect(session.id).toBe("new-1");
  });
});

describe("deleteSessionAPI", () => {
  it("calls DELETE endpoint", async () => {
    mockFetch.mockResolvedValue({ ok: true } as Response);
    await deleteSessionAPI("sess1");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/sessions/sess1"),
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});

describe("patchSession", () => {
  it("sends PATCH with data", async () => {
    mockFetch.mockResolvedValue({ ok: true } as Response);
    await patchSession("sess1", { pinned: true });
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/sessions/sess1"),
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ pinned: true }),
      }),
    );
  });
});

describe("saveMessage", () => {
  it("sends POST with message", async () => {
    mockFetch.mockResolvedValue({ ok: true } as Response);
    await saveMessage("sess1", { role: "user", content: "hello" });
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/sessions/sess1/messages"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ role: "user", content: "hello" }),
      }),
    );
  });
});

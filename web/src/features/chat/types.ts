import type { WsNotification } from "@/hooks/use-websocket";

export type Mode = "plan" | "compare";

export interface ThinkingStep {
  id: string;
  label: string;
  status: "active" | "done" | "error";
  detail?: string;
}

export type Message =
  | { type: "user"; content: string }
  | { type: "loading"; hint: string }
  | { type: "thinking"; steps: ThinkingStep[]; collapsed: boolean }
  | { type: "itinerary"; data: Record<string, unknown> }
  | { type: "compare"; content: string }
  | { type: "text"; content: string }
  | { type: "error"; content: string }
  | { type: "booking_success"; orderId: string; itemName: string; platform: string }
  | { type: "notification"; data: WsNotification }
  | { type: "guide" };

export interface Session {
  id: string;
  title: string;
  pinned: boolean;
  updated_at: string;
}

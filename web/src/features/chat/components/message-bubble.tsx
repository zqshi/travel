import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ItineraryView } from "@/components/itinerary-view";
import type { Message } from "../types";
import type { CountryOption } from "../constants";
import { GuideScreen } from "./guide-screen";
import { ThinkingMessage, LoadingDots } from "./thinking-message";
import { CompareResultView } from "./compare-view";

export interface MessageBubbleProps {
  message: Message;
  onCountrySelect: (c: CountryOption) => void;
  onBooking?: (item: {
    name: string;
    nameLocal?: string;
    platform: string;
    priceThb: number;
    priceCny: number;
    category: string;
    sourceUrl?: string;
    date?: string;
  }) => void;
  onVoiceBooking?: (item: {
    name: string;
    platform: string;
    priceThb: number;
    priceCny: number;
    sourceUrl?: string;
    phone?: string;
  }) => void;
  onOpenSource?: (url: string, notes?: string) => void;
  bookedItems?: Set<string>;
  onViewBooking?: (itemName: string) => void;
}

export function MessageBubble({
  message,
  onCountrySelect,
  onBooking,
  onVoiceBooking,
  onOpenSource,
  bookedItems,
  onViewBooking,
}: MessageBubbleProps) {
  switch (message.type) {
    case "guide":
      return <GuideScreen onCountrySelect={onCountrySelect} />;

    case "user":
      return (
        <div className="flex justify-end">
          <div className="max-w-[75%] rounded-2xl px-5 py-3 bg-primary text-white">
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
          </div>
        </div>
      );

    case "loading":
      return (
        <div className="flex justify-start">
          <div className="rounded-2xl px-5 py-4 bg-card border border-border inline-flex items-center gap-3">
            <LoadingDots />
            <span className="text-sm text-muted">{message.hint}</span>
          </div>
        </div>
      );

    case "thinking":
      return <ThinkingMessage steps={message.steps} collapsed={message.collapsed} />;

    case "text":
      return (
        <div className="flex justify-start">
          <div className="max-w-[85%] rounded-2xl px-5 py-3 bg-card border border-border">
            <div className="chat-markdown">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
            </div>
          </div>
        </div>
      );

    case "error":
      return (
        <div className="flex justify-start">
          <div className="max-w-[85%] rounded-2xl px-5 py-3 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30">
            <p className="text-sm text-red-700 dark:text-red-400">{message.content}</p>
          </div>
        </div>
      );

    case "itinerary":
      return (
        <div className="w-full space-y-3">
          <div className="flex items-center gap-2 px-1">
            <span className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1.5 4.5L7 1l5.5 3.5M1.5 4.5v5L7 13M1.5 4.5L7 8m0 5l5.5-3.5v-5M7 13V8m0 0l5.5-3.5" />
              </svg>
            </span>
            <span className="text-sm font-medium">为你生成了以下行程攻略</span>
          </div>
          <ItineraryView
            data={message.data as never}
            onBooking={onBooking}
            onVoiceBooking={onVoiceBooking}
            onOpenSource={onOpenSource}
            bookedItems={bookedItems}
            onViewBooking={onViewBooking}
          />
        </div>
      );

    case "booking_success":
      return (
        <div className="flex justify-start">
          <div className="max-w-[85%] rounded-2xl px-5 py-3 bg-success/10 border border-success/20">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-success" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0Zm3.78 5.22a.75.75 0 0 0-1.06 0L7 8.94 5.28 7.22a.75.75 0 1 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.06 0l4.25-4.25a.75.75 0 0 0 0-1.06Z" />
              </svg>
              <span className="text-sm font-medium text-success">预定成功</span>
            </div>
            <p className="text-xs text-muted mt-1">
              {message.itemName} · {message.platform} · 订单号 {message.orderId.slice(0, 8).toUpperCase()}
            </p>
          </div>
        </div>
      );

    case "notification":
      return (
        <div className="flex justify-start">
          <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2">
              <span className="text-sm">🔔</span>
              <span className="text-xs font-medium">订单通知</span>
            </div>
            <p className="text-xs text-muted mt-1">
              {message.data.item_name && `${message.data.item_name} · `}
              {message.data.notification_type === "status_change" && `状态更新: ${message.data.new_status}`}
              {message.data.notification_type === "price_change" && `价格变动`}
              {message.data.notification_type === "booking_confirmed" && `预定已确认 ${message.data.booking_ref || ""}`}
              {message.data.notification_type === "schedule_change" && `行程变动: ${message.data.detail || ""}`}
            </p>
          </div>
        </div>
      );

    case "compare":
      return <CompareResultView content={message.content} />;
  }
}

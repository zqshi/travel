"use client";

import { useState, useEffect } from "react";
import type { WsNotification } from "@/hooks/use-websocket";

interface NotificationBannerProps {
  notifications: WsNotification[];
  onDismiss: (index: number) => void;
}

export function NotificationBanner({ notifications, onDismiss }: NotificationBannerProps) {
  if (notifications.length === 0) return null;

  return (
    <div className="space-y-2">
      {notifications.map((n, i) => (
        <NotificationItem key={`${n.order_id}-${i}`} notification={n} onDismiss={() => onDismiss(i)} />
      ))}
    </div>
  );
}

function NotificationItem({ notification, onDismiss }: { notification: WsNotification; onDismiss: () => void }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 300);
    }, 10000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const { icon, title, detail, color } = getNotificationDisplay(notification);

  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-xl border transition-all duration-300 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
      } ${color}`}
    >
      <span className="text-sm shrink-0 mt-0.5">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium">{title}</p>
        <p className="text-[11px] text-muted mt-0.5">{detail}</p>
        {notification.item_name && (
          <p className="text-[11px] text-muted mt-0.5">{notification.item_name}</p>
        )}
      </div>
      <button onClick={onDismiss} className="text-muted hover:text-foreground shrink-0 p-0.5">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M3 3l6 6M9 3l-6 6" />
        </svg>
      </button>
    </div>
  );
}

function getNotificationDisplay(n: WsNotification) {
  switch (n.notification_type) {
    case "price_change":
      return {
        icon: "💰",
        title: "价格变动",
        detail: n.old_price && n.new_price
          ? `¥${n.old_price} → ¥${n.new_price}`
          : "订单价格已变动",
        color: "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800",
      };
    case "status_change":
      return {
        icon: "📋",
        title: "订单状态更新",
        detail: `${statusName(n.old_status)} → ${statusName(n.new_status)}`,
        color: "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800",
      };
    case "schedule_change":
      return {
        icon: "📅",
        title: "行程变动",
        detail: n.detail || "您的行程安排有变动",
        color: "bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800",
      };
    case "booking_confirmed":
      return {
        icon: "✅",
        title: "预定已确认",
        detail: n.booking_ref ? `确认号: ${n.booking_ref}` : "商家已确认您的预定",
        color: "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800",
      };
    default:
      return {
        icon: "🔔",
        title: "通知",
        detail: n.detail || "",
        color: "bg-gray-50 dark:bg-gray-800 border-border",
      };
  }
}

function statusName(status?: string): string {
  const map: Record<string, string> = {
    pending: "待支付",
    paying: "支付中",
    paid: "已支付",
    confirmed: "已确认",
    cancelled: "已取消",
    refunded: "已退款",
    changed: "有变动",
  };
  return status ? map[status] || status : "未知";
}

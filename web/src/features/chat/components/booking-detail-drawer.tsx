"use client";

import { useState } from "react";
import { Drawer } from "@/components/drawer";

export interface BookingRecord {
  orderId: string;
  bookingRef: string;
  platform: string;
  priceThb: number;
  priceCny: number;
}

export function BookingDetailDrawer({
  open,
  onClose,
  itemName,
  booking,
  onCancel,
}: {
  open: boolean;
  onClose: () => void;
  itemName: string;
  booking: BookingRecord;
  onCancel: (itemName: string) => void;
}) {
  const [cancelling, setCancelling] = useState(false);

  const handleCancel = async () => {
    setCancelling(true);
    await onCancel(itemName);
    setCancelling(false);
  };

  return (
    <Drawer open={open} onClose={onClose} title="订单详情" width="md">
      <div className="space-y-5">
        <div className="p-4 rounded-xl bg-success/10 border border-success/20">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-5 h-5 text-success" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0Zm3.78 5.22a.75.75 0 0 0-1.06 0L7 8.94 5.28 7.22a.75.75 0 1 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.06 0l4.25-4.25a.75.75 0 0 0 0-1.06Z" />
            </svg>
            <span className="text-sm font-semibold text-success">已预定</span>
          </div>
          <h3 className="font-semibold text-sm mb-2">{itemName}</h3>
        </div>

        <div className="space-y-3">
          <DetailRow label="平台" value={booking.platform} />
          <DetailRow label="订单号" value={booking.orderId.slice(0, 12).toUpperCase()} />
          {booking.bookingRef && <DetailRow label="确认号" value={booking.bookingRef} />}
          <DetailRow label="价格" value={`¥${booking.priceCny} / ฿${booking.priceThb}`} />
        </div>

        <button
          onClick={handleCancel}
          disabled={cancelling}
          className="w-full py-3 rounded-xl border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors disabled:opacity-50"
        >
          {cancelling ? "取消中..." : "取消预定"}
        </button>
      </div>
    </Drawer>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
      <span className="text-xs text-muted">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

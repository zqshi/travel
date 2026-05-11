"use client";

import type { BookingItem } from "../booking-drawer";

interface SuccessStepProps {
  item: BookingItem;
  orderId: string;
  bookedDate: string;
  travelers: number;
  onClose: () => void;
}

export function SuccessStep({ item, orderId, bookedDate, travelers, onClose }: SuccessStepProps) {
  return (
    <div className="text-center space-y-5">
      {/* Success icon */}
      <div className="flex justify-center">
        <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center">
          <svg className="w-8 h-8 text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12l5 5L20 7" />
          </svg>
        </div>
      </div>

      <div>
        <h3 className="font-semibold text-lg">预定成功！</h3>
        <p className="text-sm text-muted mt-1">您的预定已确认</p>
      </div>

      {/* Order details */}
      <div className="p-4 rounded-xl bg-background border border-border text-left space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted">项目</span>
          <span className="text-sm font-medium">{item.name}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted">平台</span>
          <span className="text-sm">{item.platform}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted">日期</span>
          <span className="text-sm">{bookedDate}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted">人数</span>
          <span className="text-sm">{travelers}人</span>
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <span className="text-xs text-muted">支付金额</span>
          <span className="text-sm font-bold text-primary">¥{(item.priceCny * travelers).toLocaleString()}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted">订单号</span>
          <span className="text-xs font-mono text-muted">{orderId.slice(0, 8).toUpperCase()}</span>
        </div>
      </div>

      <p className="text-xs text-muted">
        预定确认信息将发送到您的手机，您也可以在对话中随时查看订单状态。
      </p>

      <button
        onClick={onClose}
        className="w-full py-3 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-colors"
      >
        完成
      </button>
    </div>
  );
}

"use client";

import { useState } from "react";
import type { BookingItem } from "../booking-drawer";

interface ConfirmStepProps {
  item: BookingItem;
  onConfirm: (date: string, travelers: number) => void;
}

export function ConfirmStep({ item, onConfirm }: ConfirmStepProps) {
  // 自动填充：从行程卡片日期 -> 今天+14天 fallback
  const initialDate = item.date || "";
  const [date, setDate] = useState(initialDate);
  const [travelers, setTravelers] = useState(1);

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="space-y-5">
      {/* Item info */}
      <div className="p-4 rounded-xl bg-background border border-border">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold text-sm">{item.name}</h3>
            {item.nameLocal && <p className="text-xs text-muted mt-0.5">{item.nameLocal}</p>}
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                {item.platform}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-muted">
                {item.category === "flight" ? "机票" :
                 item.category === "hotel" ? "酒店" :
                 item.category === "ticket" ? "门票" : "交通"}
              </span>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-lg font-bold text-primary">¥{item.priceCny}</p>
            <p className="text-[10px] text-muted">฿{item.priceThb}</p>
          </div>
        </div>
      </div>

      {/* Date picker - auto-filled from itinerary */}
      <div>
        <label className="block text-xs font-medium mb-1.5">
          出行日期
          {initialDate && <span className="text-muted font-normal ml-1">（已根据行程自动填充）</span>}
        </label>
        <input
          type="date"
          value={date}
          min={today}
          onChange={(e) => setDate(e.target.value)}
          className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>

      {/* Travelers */}
      <div>
        <label className="block text-xs font-medium mb-1.5">人数</label>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setTravelers(Math.max(1, travelers - 1))}
            className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            -
          </button>
          <span className="text-sm font-semibold w-8 text-center">{travelers}</span>
          <button
            onClick={() => setTravelers(Math.min(20, travelers + 1))}
            className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            +
          </button>
          <span className="text-xs text-muted">人</span>
        </div>
      </div>

      {/* Total */}
      <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted">总计</span>
          <span className="text-lg font-bold text-primary">
            ¥{(item.priceCny * travelers).toLocaleString()}
          </span>
        </div>
      </div>

      {/* Submit */}
      <button
        onClick={() => onConfirm(date, travelers)}
        disabled={!date}
        className="w-full py-3 rounded-xl bg-primary text-white font-medium text-sm hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        下一步：填写旅客信息
      </button>
    </div>
  );
}

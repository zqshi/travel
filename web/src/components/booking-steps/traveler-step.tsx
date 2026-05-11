"use client";

import { useState } from "react";
import type { TravelerData } from "../booking-drawer";

interface TravelerStepProps {
  travelers: number;
  data: TravelerData[];
  onSubmit: (data: TravelerData[], phone: string, email: string) => void;
  onBack: () => void;
}

export function TravelerStep({ travelers, data, onSubmit, onBack }: TravelerStepProps) {
  const [travelerData, setTravelerData] = useState<TravelerData[]>(data);
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");

  const updateTraveler = (index: number, field: keyof TravelerData, value: string) => {
    setTravelerData((prev) =>
      prev.map((t, i) => (i === index ? { ...t, [field]: value } : t))
    );
  };

  const canSubmit =
    travelerData.every((t) => t.name && t.nameEn) && contactPhone;

  return (
    <div className="space-y-5">
      {/* Contact info */}
      <div className="p-4 rounded-xl bg-background border border-border space-y-3">
        <h4 className="text-xs font-semibold text-muted uppercase tracking-wider">联系方式</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] text-muted mb-1">手机号 *</label>
            <input
              type="tel"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="138xxxx0000"
              className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div>
            <label className="block text-[11px] text-muted mb-1">邮箱</label>
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="name@email.com"
              className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        </div>
      </div>

      {/* Traveler forms */}
      {travelerData.map((t, i) => (
        <div key={i} className="p-4 rounded-xl bg-background border border-border space-y-3">
          <h4 className="text-xs font-semibold text-muted">
            旅客 {i + 1} / {travelers}
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-muted mb-1">中文姓名 *</label>
              <input
                type="text"
                value={t.name}
                onChange={(e) => updateTraveler(i, "name", e.target.value)}
                placeholder="张三"
                className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="block text-[11px] text-muted mb-1">英文姓名 *</label>
              <input
                type="text"
                value={t.nameEn}
                onChange={(e) => updateTraveler(i, "nameEn", e.target.value)}
                placeholder="ZHANG SAN"
                className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="block text-[11px] text-muted mb-1">护照号</label>
              <input
                type="text"
                value={t.passportNo}
                onChange={(e) => updateTraveler(i, "passportNo", e.target.value)}
                placeholder="E12345678"
                className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="block text-[11px] text-muted mb-1">手机号</label>
              <input
                type="tel"
                value={t.phone}
                onChange={(e) => updateTraveler(i, "phone", e.target.value)}
                placeholder="选填"
                className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>
        </div>
      ))}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 py-3 rounded-xl border border-border text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          返回
        </button>
        <button
          onClick={() => onSubmit(travelerData, contactPhone, contactEmail)}
          disabled={!canSubmit}
          className="flex-1 py-3 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          下一步：支付
        </button>
      </div>
    </div>
  );
}

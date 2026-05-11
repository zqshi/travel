"use client";

import { useState, useEffect } from "react";
import type { BookingItem } from "../booking-drawer";

interface PaymentStepProps {
  item: BookingItem;
  loading: boolean;
  onPay: (token: string) => void;
  onBack: () => void;
}

export function PaymentStep({ item, loading, onPay, onBack }: PaymentStepProps) {
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [cardName, setCardName] = useState("");
  const [omiseReady, setOmiseReady] = useState(false);

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://cdn.omise.co/omise.js";
    script.onload = () => {
      const w = window as unknown as { Omise?: { setPublicKey: (k: string) => void } };
      if (w.Omise) {
        const publicKey = process.env.NEXT_PUBLIC_OMISE_PUBLIC_KEY || "";
        if (publicKey) {
          w.Omise.setPublicKey(publicKey);
        }
        setOmiseReady(true);
      }
    };
    document.head.appendChild(script);
    return () => { document.head.removeChild(script); };
  }, []);

  const handleSubmit = () => {
    const w = window as unknown as {
      Omise?: {
        createToken: (
          type: string,
          data: Record<string, string>,
          cb: (statusCode: number, response: { id?: string; message?: string }) => void
        ) => void;
      };
    };

    if (w.Omise && omiseReady && process.env.NEXT_PUBLIC_OMISE_PUBLIC_KEY) {
      const [expMonth, expYear] = expiry.split("/");
      w.Omise.createToken(
        "card",
        {
          name: cardName,
          number: cardNumber.replace(/\s/g, ""),
          expiration_month: expMonth,
          expiration_year: `20${expYear}`,
          security_code: cvc,
        },
        (status, response) => {
          if (status === 200 && response.id) {
            onPay(response.id);
          }
        }
      );
    } else {
      // 测试模式：直接生成mock token
      onPay(`tokn_test_${Date.now()}`);
    }
  };

  const formatCardNumber = (value: string) => {
    const cleaned = value.replace(/\D/g, "").slice(0, 16);
    return cleaned.replace(/(\d{4})/g, "$1 ").trim();
  };

  const formatExpiry = (value: string) => {
    const cleaned = value.replace(/\D/g, "").slice(0, 4);
    if (cleaned.length >= 3) return `${cleaned.slice(0, 2)}/${cleaned.slice(2)}`;
    return cleaned;
  };

  const canPay = cardNumber.replace(/\s/g, "").length >= 15 && expiry.length >= 4 && cvc.length >= 3 && cardName;

  return (
    <div className="space-y-5">
      {/* Order summary */}
      <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{item.name}</p>
            <p className="text-xs text-muted">{item.platform}</p>
          </div>
          <p className="text-lg font-bold text-primary">¥{item.priceCny}</p>
        </div>
      </div>

      {/* Card form */}
      <div className="space-y-3">
        <div>
          <label className="block text-[11px] text-muted mb-1">持卡人姓名</label>
          <input
            type="text"
            value={cardName}
            onChange={(e) => setCardName(e.target.value)}
            placeholder="ZHANG SAN"
            className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <div>
          <label className="block text-[11px] text-muted mb-1">卡号</label>
          <input
            type="text"
            value={cardNumber}
            onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
            placeholder="4242 4242 4242 4242"
            maxLength={19}
            className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] text-muted mb-1">有效期</label>
            <input
              type="text"
              value={expiry}
              onChange={(e) => setExpiry(formatExpiry(e.target.value))}
              placeholder="MM/YY"
              maxLength={5}
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono"
            />
          </div>
          <div>
            <label className="block text-[11px] text-muted mb-1">CVV</label>
            <input
              type="text"
              value={cvc}
              onChange={(e) => setCvc(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="123"
              maxLength={4}
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono"
            />
          </div>
        </div>
      </div>

      {/* Security note */}
      <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-100 dark:border-green-900">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-green-600 shrink-0">
          <path d="M7 1L3 3.5V6.5C3 9.5 4.8 12.3 7 13C9.2 12.3 11 9.5 11 6.5V3.5L7 1Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
          <path d="M5 7L6.5 8.5L9 5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="text-[11px] text-green-700 dark:text-green-400">
          支付由Omise安全处理，卡信息不经过我们的服务器
        </span>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={onBack}
          disabled={loading}
          className="flex-1 py-3 rounded-xl border border-border text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
        >
          返回
        </button>
        <button
          onClick={handleSubmit}
          disabled={!canPay || loading}
          className="flex-1 py-3 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.3" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              处理中...
            </>
          ) : (
            `支付 ¥${item.priceCny}`
          )}
        </button>
      </div>
    </div>
  );
}

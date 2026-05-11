"use client";

import { useState } from "react";
import { Drawer } from "./drawer";
import { ConfirmStep } from "./booking-steps/confirm-step";
import { TravelerStep } from "./booking-steps/traveler-step";
import { PaymentStep } from "./booking-steps/payment-step";
import { SuccessStep } from "./booking-steps/success-step";
import { fetchWithAuth } from "@/lib/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface BookingItem {
  name: string;
  nameLocal?: string;
  platform: string;
  priceThb: number;
  priceCny: number;
  category: "flight" | "hotel" | "ticket" | "transport";
  sourceUrl?: string;
  detail?: Record<string, unknown>;
  date?: string;
}

export interface TravelerData {
  name: string;
  nameEn: string;
  passportNo: string;
  phone: string;
  email: string;
}

interface BookingDrawerProps {
  open: boolean;
  onClose: () => void;
  item: BookingItem | null;
  sessionId: string;
  onBookingComplete?: (orderId: string) => void;
}

type Step = "confirm" | "traveler" | "payment" | "success";

export function BookingDrawer({ open, onClose, item, sessionId, onBookingComplete }: BookingDrawerProps) {
  const [step, setStep] = useState<Step>("confirm");
  const [bookedDate, setBookedDate] = useState("");
  const [travelers, setTravelers] = useState(1);
  const [travelerData, setTravelerData] = useState<TravelerData[]>([]);
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [orderId, setOrderId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const reset = () => {
    setStep("confirm");
    setBookedDate("");
    setTravelers(1);
    setTravelerData([]);
    setContactPhone("");
    setContactEmail("");
    setOrderId("");
    setError("");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleConfirm = (date: string, count: number) => {
    setBookedDate(date);
    setTravelers(count);
    setTravelerData(
      Array.from({ length: count }, () => ({
        name: "",
        nameEn: "",
        passportNo: "",
        phone: "",
        email: "",
      }))
    );
    setStep("traveler");
  };

  const handleTravelerSubmit = (data: TravelerData[], phone: string, email: string) => {
    setTravelerData(data);
    setContactPhone(phone);
    setContactEmail(email);
    setStep("payment");
  };

  const handlePayment = async (token: string) => {
    if (!item) return;
    setLoading(true);
    setError("");

    try {
      // 创建订单
      const createRes = await fetchWithAuth(`${API_BASE}/api/v1/booking/create`, {
        method: "POST",
        body: JSON.stringify({
          session_id: sessionId,
          booking_type: item.category,
          item_name: item.name,
          item_detail: item.detail || {},
          platform: item.platform,
          price_thb: item.priceThb,
          price_cny: item.priceCny,
          booked_date: bookedDate,
          travelers,
          traveler_info: travelerData.map((t) => ({
            name: t.name,
            name_en: t.nameEn,
            passport_no: t.passportNo,
            phone: t.phone,
            email: t.email,
          })),
          contact_phone: contactPhone,
          contact_email: contactEmail,
          source_url: item.sourceUrl || "",
        }),
      });

      if (!createRes.ok) {
        const err = await createRes.json().catch(() => ({ detail: "创建订单失败" }));
        throw new Error(err.detail);
      }

      const order = await createRes.json();
      setOrderId(order.id);

      // 发起支付
      const payRes = await fetchWithAuth(`${API_BASE}/api/v1/booking/pay`, {
        method: "POST",
        body: JSON.stringify({ order_id: order.id, token }),
      });

      if (!payRes.ok) {
        const err = await payRes.json().catch(() => ({ detail: "支付失败" }));
        throw new Error(err.detail);
      }

      const payResult = await payRes.json();

      if (payResult.status === "success") {
        setStep("success");
        onBookingComplete?.(order.id);
      } else if (payResult.authorize_uri) {
        window.open(payResult.authorize_uri, "_blank");
        setStep("success");
        onBookingComplete?.(order.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "支付失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  if (!item) return null;

  const stepTitle: Record<Step, string> = {
    confirm: "确认预定",
    traveler: "旅客信息",
    payment: "支付",
    success: "预定成功",
  };

  return (
    <Drawer open={open} onClose={handleClose} title={stepTitle[step]} width="lg">
      <div className="relative">
        {/* Progress indicator */}
        <div className="flex items-center gap-2 mb-6">
          {(["confirm", "traveler", "payment", "success"] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  step === s
                    ? "bg-primary text-white"
                    : i < ["confirm", "traveler", "payment", "success"].indexOf(step)
                    ? "bg-success text-white"
                    : "bg-gray-200 dark:bg-gray-700 text-muted"
                }`}
              >
                {i < ["confirm", "traveler", "payment", "success"].indexOf(step) ? "✓" : i + 1}
              </div>
              {i < 3 && (
                <div
                  className={`flex-1 h-0.5 ${
                    i < ["confirm", "traveler", "payment", "success"].indexOf(step)
                      ? "bg-success"
                      : "bg-gray-200 dark:bg-gray-700"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
            <p className="text-xs text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        {step === "confirm" && (
          <ConfirmStep item={item} onConfirm={handleConfirm} />
        )}
        {step === "traveler" && (
          <TravelerStep
            travelers={travelers}
            data={travelerData}
            onSubmit={handleTravelerSubmit}
            onBack={() => setStep("confirm")}
          />
        )}
        {step === "payment" && (
          <PaymentStep
            item={item}
            loading={loading}
            onPay={handlePayment}
            onBack={() => setStep("traveler")}
          />
        )}
        {step === "success" && (
          <SuccessStep
            item={item}
            orderId={orderId}
            bookedDate={bookedDate}
            travelers={travelers}
            onClose={handleClose}
          />
        )}
      </div>
    </Drawer>
  );
}

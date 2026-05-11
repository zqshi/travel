"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { sendCode, verifyCode, isLoggedIn } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isLoggedIn()) {
      router.replace("/chat");
    }
  }, [router]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleSendCode = async () => {
    if (!phone.trim() || phone.length < 11) {
      setError("请输入有效的手机号");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await sendCode(phone);
      setStep("code");
      setCountdown(60);
    } catch (err) {
      setError(err instanceof Error ? err.message : "发送失败");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!code.trim() || code.length < 4) {
      setError("请输入4位验证码");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await verifyCode(phone, code);
      router.replace("/chat");
    } catch (err) {
      setError(err instanceof Error ? err.message : "验证失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-3.5rem)] px-4 relative">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-indigo-50/30 to-cyan-50/50 dark:from-blue-950/20 dark:via-indigo-950/10 dark:to-cyan-950/20" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(59,130,246,0.06),transparent_50%)]" />

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-blue-400 items-center justify-center text-white text-2xl font-bold shadow-lg shadow-primary/20 mb-4">
            T
          </div>
          <h1 className="text-2xl font-bold">登录 TravelAgent</h1>
          <p className="text-sm text-muted mt-2">登录后开始AI智能旅行规划</p>
        </div>

        {/* Form Card */}
        <div className="bg-card/80 backdrop-blur-sm border border-border/60 rounded-2xl p-6 shadow-xl shadow-black/5 space-y-5">
          {/* Phone input */}
          <div>
            <label className="text-xs font-medium text-muted block mb-2">手机号</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted text-sm">+86</span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
                placeholder="请输入手机号"
                maxLength={11}
                disabled={step === "code"}
                className="w-full pl-12 pr-4 py-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 disabled:opacity-50 transition-all"
              />
            </div>
          </div>

          {/* Code input */}
          {step === "code" && (
            <div>
              <label className="text-xs font-medium text-muted block mb-2">验证码</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="输入4位验证码"
                  maxLength={4}
                  className="flex-1 px-4 py-3 rounded-xl border border-border bg-background text-sm tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
                  autoFocus
                />
                <button
                  onClick={handleSendCode}
                  disabled={countdown > 0 || loading}
                  className="px-4 py-3 rounded-xl border border-border text-xs font-medium text-muted hover:text-foreground hover:border-primary/30 transition-all disabled:opacity-50 shrink-0"
                >
                  {countdown > 0 ? `${countdown}s` : "重发"}
                </button>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/50">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-red-500 shrink-0">
                <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5" />
                <path d="M7 4v3M7 9h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Submit button */}
          <button
            onClick={step === "phone" ? handleSendCode : handleVerify}
            disabled={loading}
            className="w-full bg-gradient-to-r from-primary to-blue-500 text-white py-3 rounded-xl font-medium text-sm hover:shadow-lg hover:shadow-primary/25 transition-all disabled:opacity-50 disabled:shadow-none"
          >
            {loading ? "请稍候..." : step === "phone" ? "获取验证码" : "登录"}
          </button>

          {step === "code" && (
            <button
              onClick={() => { setStep("phone"); setCode(""); setError(""); }}
              className="w-full text-xs text-muted hover:text-foreground transition-colors py-1"
            >
              更换手机号
            </button>
          )}
        </div>

        <p className="text-center text-xs text-muted/60 mt-6">
          开发环境验证码: <span className="font-mono font-medium text-muted">1234</span>
        </p>
      </div>
    </div>
  );
}

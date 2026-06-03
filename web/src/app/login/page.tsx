"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { sendCode, verifyCode, isLoggedIn, ApiError, getWeChatLoginUrl, isWeChatBrowser } from "@/lib/auth";

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
    // Show error from OAuth redirect
    const params = new URLSearchParams(window.location.search);
    const oauthError = params.get("error");
    if (oauthError) {
      setError(oauthError);
      // Clean URL
      window.history.replaceState({}, "", "/login");
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
      if (err instanceof ApiError && err.isRateLimited && err.retryAfter) {
        setCountdown(err.retryAfter);
        setStep("code");
      }
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
      if (err instanceof ApiError && err.isRateLimited && err.retryAfter) {
        setError(`验证错误次数过多，请${formatDuration(err.retryAfter)}后再试`);
      } else {
        setError(err instanceof Error ? err.message : "验证失败");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleWeChatLogin = () => {
    const platform = isWeChatBrowser() ? "mp" : "";
    window.location.href = getWeChatLoginUrl(platform || undefined);
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

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted">其他登录方式</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* WeChat Login */}
          <button
            onClick={handleWeChatLogin}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-[#07C160] text-[#07C160] font-medium text-sm hover:bg-[#07C160] hover:text-white transition-all duration-200"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 01.213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 00.167-.054l1.903-1.114a.864.864 0 01.717-.098 10.16 10.16 0 002.837.403c.276 0 .543-.027.811-.05a6.093 6.093 0 01-.253-1.72c0-3.571 3.326-6.47 7.43-6.47.259 0 .499.032.75.049C16.633 4.884 13.045 2.188 8.691 2.188zm-2.35 4.09c.56 0 1.015.46 1.015 1.025 0 .566-.456 1.025-1.015 1.025-.56 0-1.014-.46-1.014-1.025 0-.566.455-1.025 1.014-1.025zm4.707 0c.56 0 1.014.46 1.014 1.025 0 .566-.455 1.025-1.014 1.025-.56 0-1.015-.46-1.015-1.025 0-.566.456-1.025 1.015-1.025zm5.621 3.122c-3.543 0-6.42 2.467-6.42 5.508 0 3.042 2.877 5.508 6.42 5.508a7.346 7.346 0 002.322-.378.636.636 0 01.526.072l1.394.816a.24.24 0 00.122.04.213.213 0 00.213-.217c0-.053-.02-.105-.035-.156l-.286-1.084a.433.433 0 01.156-.488c1.337-.986 2.194-2.448 2.194-4.113 0-3.04-2.878-5.508-6.42-5.508h-.186zm-2.348 2.678c.41 0 .742.336.742.75s-.332.75-.742.75-.742-.336-.742-.75.332-.75.742-.75zm4.696 0c.41 0 .742.336.742.75s-.332.75-.742.75-.742-.336-.742-.75.332-.75.742-.75z"/>
            </svg>
            微信登录
          </button>
        </div>

        <p className="text-center text-xs text-muted/60 mt-6">
          开发环境验证码: <span className="font-mono font-medium text-muted">1234</span>
        </p>
      </div>
    </div>
  );
}

function formatDuration(seconds: number): string {
  if (seconds >= 60) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}分${secs}秒` : `${mins}分钟`;
  }
  return `${seconds}秒`;
}

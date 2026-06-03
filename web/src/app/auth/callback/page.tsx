"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { setToken, setUser } from "@/lib/auth";

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");

  useEffect(() => {
    const token = searchParams.get("token");
    const userParam = searchParams.get("user");
    const errorParam = searchParams.get("error");

    if (errorParam) {
      setError(decodeURIComponent(errorParam));
      setTimeout(() => router.replace(`/login?error=${encodeURIComponent(errorParam)}`), 2000);
      return;
    }

    if (token) {
      setToken(token);

      if (userParam) {
        try {
          const user = JSON.parse(decodeURIComponent(userParam));
          setUser(user);
        } catch {
          // Non-critical: user info will be fetched from /me later
        }
      }

      // Clean URL to avoid token leakage in browser history
      window.history.replaceState({}, "", "/auth/callback");
      router.replace("/chat");
    } else {
      setError("登录失败，请重试");
      setTimeout(() => router.replace("/login"), 2000);
    }
  }, [router, searchParams]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50/30 to-cyan-50/50 dark:from-blue-950/20 dark:via-indigo-950/10 dark:to-cyan-950/20">
      <div className="text-center">
        {error ? (
          <>
            <div className="inline-flex w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/30 items-center justify-center mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-red-500">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            <p className="text-xs text-muted mt-2">正在跳转登录页...</p>
          </>
        ) : (
          <>
            <div className="inline-flex w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin mb-4" />
            <p className="text-sm text-foreground/70">正在登录，请稍候...</p>
          </>
        )}
      </div>
    </div>
  );
}

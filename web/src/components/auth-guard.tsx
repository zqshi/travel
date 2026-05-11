"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isLoggedIn } from "@/lib/auth";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "authed" | "redirecting">("loading");

  useEffect(() => {
    if (!isLoggedIn()) {
      setStatus("redirecting");
      router.replace("/login");
    } else {
      setStatus("authed");
    }
  }, [router]);

  if (status !== "authed") {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-sm text-muted">{status === "redirecting" ? "跳转登录..." : "加载中..."}</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

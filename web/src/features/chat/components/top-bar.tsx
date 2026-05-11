"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";
import { getUser, clearAuth } from "@/lib/auth";

export function TopBar({ onMenuToggle }: { onMenuToggle?: () => void }) {
  const router = useRouter();
  const [user, setUser] = useState<{ phone: string } | null>(null);

  useEffect(() => {
    setUser(getUser());
  }, []);

  const handleLogout = () => {
    clearAuth();
    router.push("/");
  };

  return (
    <div className="h-11 px-4 flex items-center justify-between gap-4 border-b border-border/10 shrink-0">
      <div className="flex items-center gap-2">
        {onMenuToggle && (
          <button onClick={onMenuToggle} className="md:hidden p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-foreground/60">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 5h12M3 9h12M3 13h12" />
            </svg>
          </button>
        )}
        <Link href="/" className="md:hidden flex items-center gap-2">
          <span className="w-6 h-6 rounded-lg bg-gradient-to-br from-primary to-blue-400 flex items-center justify-center text-white text-[10px] font-bold">T</span>
          <span className="text-sm font-semibold tracking-tight">TravelAgent</span>
        </Link>
      </div>
      <div className="flex items-center gap-4">
        {user && (
          <>
            <span className="text-xs text-foreground/40 hidden sm:inline">{user.phone.replace(/(\d{3})\d{4}(\d{4})/, "$1****$2")}</span>
            <button onClick={handleLogout} className="text-xs text-foreground/40 hover:text-error transition-colors">
              退出
            </button>
          </>
        )}
      </div>
    </div>
  );
}

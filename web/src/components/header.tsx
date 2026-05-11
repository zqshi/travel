"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { isLoggedIn, getUser, clearAuth, User } from "@/lib/auth";

export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [mounted, setMounted] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (isLoggedIn()) {
      setUser(getUser());
    }
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleLogout = () => {
    clearAuth();
    setUser(null);
    setMenuOpen(false);
    router.push("/");
  };

  if (pathname === "/chat") return null;

  const loggedIn = mounted && user;

  return (
    <>
    <div className="h-16 shrink-0" />
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl border-b border-border/40 shadow-sm"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 font-bold text-lg tracking-tight">
          <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-blue-400 flex items-center justify-center text-white text-sm shadow-md shadow-primary/20">T</span>
          <span>TravelAgent</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-5 text-sm">
          {loggedIn && (
            <>
              <Link href="/chat" className="text-foreground/60 hover:text-foreground transition-colors">
                规划行程
              </Link>
              <Link href="/compare" className="text-foreground/60 hover:text-foreground transition-colors">
                比价
              </Link>
              <div className="w-px h-4 bg-border/60" />
              <span className="text-xs text-foreground/50">{user.phone.replace(/(\d{3})\d{4}(\d{4})/, "$1****$2")}</span>
              <button
                onClick={handleLogout}
                className="text-xs text-foreground/50 hover:text-error transition-colors"
              >
                退出
              </button>
            </>
          )}
          {mounted && !user && (
            <Link
              href="/login"
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                scrolled
                  ? "bg-primary text-white hover:bg-primary-hover shadow-sm"
                  : "bg-white/20 backdrop-blur-sm text-foreground border border-foreground/10 hover:bg-white/40"
              }`}
            >
              登录
            </Link>
          )}
        </nav>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="md:hidden p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
        >
          {menuOpen ? (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M5 5l10 10M15 5L5 15" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 6h14M3 10h14M3 14h14" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile menu dropdown */}
      {menuOpen && (
        <div className="md:hidden border-t border-border/40 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl px-5 py-4 space-y-3">
          {loggedIn && (
            <>
              <Link href="/chat" onClick={() => setMenuOpen(false)} className="block text-sm text-foreground/70 hover:text-foreground py-1.5">
                规划行程
              </Link>
              <Link href="/compare" onClick={() => setMenuOpen(false)} className="block text-sm text-foreground/70 hover:text-foreground py-1.5">
                比价
              </Link>
              <div className="border-t border-border/40 pt-3 flex items-center justify-between">
                <span className="text-xs text-foreground/50">{user.phone.replace(/(\d{3})\d{4}(\d{4})/, "$1****$2")}</span>
                <button onClick={handleLogout} className="text-xs text-foreground/50 hover:text-error transition-colors">
                  退出
                </button>
              </div>
            </>
          )}
          {mounted && !user && (
            <Link href="/login" onClick={() => setMenuOpen(false)} className="block text-center px-5 py-2 rounded-full bg-primary text-white text-sm font-medium">
              登录
            </Link>
          )}
        </div>
      )}
    </header>
    </>
  );
}

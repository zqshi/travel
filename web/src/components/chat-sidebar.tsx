"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";

interface Session {
  id: string;
  title: string;
  pinned: boolean;
  updated_at: string;
}

interface ChatSidebarProps {
  sessions: Session[];
  currentSessionId: string | null;
  open: boolean;
  onToggle: () => void;
  onNewChat: () => void;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onTogglePin: (id: string) => void;
}

export function ChatSidebar({
  sessions,
  currentSessionId,
  open,
  onToggle,
  onNewChat,
  onSelectSession,
  onDeleteSession,
  onTogglePin,
}: ChatSidebarProps) {
  if (!open) {
    // Desktop collapsed — mobile hidden entirely
    return (
      <div className="hidden md:flex w-[52px] border-r border-border/40 bg-gray-50/80 dark:bg-gray-900/50 flex-col shrink-0">
        <div className="h-14 flex items-center pl-4 border-b border-border/40">
          <Link href="/" className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-blue-400 flex items-center justify-center text-white text-xs font-bold shadow-sm">
            T
          </Link>
        </div>
        <div className="flex flex-col items-center gap-3 pt-3">
          <button
            onClick={onToggle}
            className="p-2 rounded-lg hover:bg-white dark:hover:bg-gray-800 transition-colors text-muted hover:text-foreground"
            title="展开侧栏"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 2l6 6-6 6" />
            </svg>
          </button>
          <button
            onClick={onNewChat}
            className="p-2 rounded-lg hover:bg-primary/10 transition-colors text-primary"
            title="新对话"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 2v12M2 8h12" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  const sidebarContent = (
    <>
      <div className="px-4 h-14 flex items-center justify-between border-b border-border/40">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-blue-400 flex items-center justify-center text-white text-xs font-bold shadow-sm">T</span>
          <span className="font-bold text-sm tracking-tight">TravelAgent</span>
        </Link>
        <button
          onClick={onToggle}
          className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-gray-800 transition-colors text-muted hover:text-foreground"
          title="收起侧栏"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M11 2L5 8l6 6" />
          </svg>
        </button>
      </div>

      <div className="px-3 pt-3 pb-2">
        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-colors shadow-sm shadow-primary/10"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M7 1v12M1 7h12" />
          </svg>
          新对话
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-1 space-y-0.5">
        {sessions.length === 0 && (
          <p className="text-xs text-muted text-center py-10">暂无历史对话</p>
        )}
        {sessions.map((session) => (
          <SessionItem
            key={session.id}
            session={session}
            active={session.id === currentSessionId}
            onSelect={() => onSelectSession(session.id)}
            onDelete={() => onDeleteSession(session.id)}
            onTogglePin={() => onTogglePin(session.id)}
          />
        ))}
      </div>
    </>
  );

  return (
    <>
      {/* Desktop: flex sibling */}
      <div className="hidden md:flex w-[260px] border-r border-border/40 bg-gray-50/80 dark:bg-gray-900/50 flex-col shrink-0">
        {sidebarContent}
      </div>

      {/* Mobile: overlay */}
      <div className="md:hidden fixed inset-0 z-40 flex">
        <div
          className="absolute inset-0 bg-black/30"
          onClick={onToggle}
        />
        <div className="relative w-[280px] max-w-[85vw] bg-gray-50 dark:bg-gray-900 flex flex-col h-full shadow-xl animate-slide-in-left">
          {sidebarContent}
        </div>
      </div>
    </>
  );
}

function SessionItem({
  session,
  active,
  onSelect,
  onDelete,
  onTogglePin,
}: {
  session: Session;
  active: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  return (
    <div className="relative group">
      <button
        onClick={onSelect}
        className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-colors truncate pr-8 ${
          active
            ? "bg-white dark:bg-gray-800 text-primary font-medium shadow-sm"
            : "text-foreground/70 hover:bg-white/70 dark:hover:bg-gray-800/70"
        }`}
      >
        {session.pinned && (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" className="inline-block mr-1.5 text-primary/60 -mt-0.5">
            <path d="M5.5 0.5L7.5 2.5L6.5 5L8 6.5V7H5.5V10H4.5V7H2V6.5L3.5 5L2.5 2.5L4.5 0.5H5.5Z" />
          </svg>
        )}
        {session.title || "新对话"}
      </button>

      <button
        onClick={(e) => {
          e.stopPropagation();
          setMenuOpen(!menuOpen);
        }}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all text-muted hover:text-foreground"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
          <circle cx="7" cy="3" r="1.2" />
          <circle cx="7" cy="7" r="1.2" />
          <circle cx="7" cy="11" r="1.2" />
        </svg>
      </button>

      {menuOpen && (
        <div
          ref={menuRef}
          className="absolute right-0 top-full mt-1 z-50 w-32 rounded-xl border border-border bg-white dark:bg-gray-800 shadow-lg py-1 text-sm"
        >
          <button
            onClick={() => {
              onTogglePin();
              setMenuOpen(false);
            }}
            className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
          >
            <svg width="12" height="12" viewBox="0 0 10 10" fill="currentColor" className="text-muted">
              <path d="M5.5 0.5L7.5 2.5L6.5 5L8 6.5V7H5.5V10H4.5V7H2V6.5L3.5 5L2.5 2.5L4.5 0.5H5.5Z" />
            </svg>
            {session.pinned ? "取消置顶" : "置顶"}
          </button>
          <button
            onClick={() => {
              onDelete();
              setMenuOpen(false);
            }}
            className="w-full text-left px-3 py-2 hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 dark:text-red-400 transition-colors flex items-center gap-2"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M2 3h8M4.5 3V2h3v1M3 3l.5 7h5l.5-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            删除
          </button>
        </div>
      )}
    </div>
  );
}

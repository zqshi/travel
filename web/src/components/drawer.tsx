"use client";

import { useEffect } from "react";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  width?: "sm" | "md" | "lg";
  children: React.ReactNode;
}

const widthMap = {
  sm: "md:w-[320px]",
  md: "md:w-[380px]",
  lg: "md:w-[420px]",
};

export function Drawer({ open, onClose, title, width = "md", children }: DrawerProps) {
  useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [open, onClose]);

  if (!open) return null;

  const header = (
    <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
      <h2 className="font-semibold text-sm truncate">{title || "详情"}</h2>
      <button
        onClick={onClose}
        className="p-1.5 rounded-lg hover:bg-background transition-colors text-muted hover:text-foreground"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 4l8 8M12 4l-8 8" />
        </svg>
      </button>
    </div>
  );

  const content = (
    <div className="flex-1 overflow-y-auto p-5">
      {children}
    </div>
  );

  return (
    <>
      {/* Desktop: push-in flex sibling */}
      <div className={`hidden md:flex ${widthMap[width]} shrink-0 border-l border-border bg-card flex-col h-full animate-slide-in-right`}>
        {header}
        {content}
      </div>

      {/* Mobile: full-screen overlay */}
      <div className="md:hidden fixed inset-0 z-50 flex flex-col bg-card animate-slide-up">
        {header}
        {content}
      </div>
    </>
  );
}

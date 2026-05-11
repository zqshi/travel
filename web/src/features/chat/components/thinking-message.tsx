"use client";

import { useState, useEffect } from "react";
import type { ThinkingStep } from "../types";

export function ThinkingMessage({ steps, collapsed }: { steps: ThinkingStep[]; collapsed: boolean }) {
  const [isCollapsed, setIsCollapsed] = useState(collapsed);

  useEffect(() => {
    if (collapsed) setIsCollapsed(true);
  }, [collapsed]);

  const allDone = steps.every((s) => s.status === "done");
  const hasError = steps.some((s) => s.status === "error");

  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] rounded-2xl border border-border bg-card overflow-hidden">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="w-full flex items-center gap-2.5 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
        >
          {!allDone && !hasError ? (
            <svg className="w-4 h-4 text-primary animate-spin shrink-0" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.3" />
              <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          ) : hasError ? (
            <span className="w-4 h-4 text-red-500 shrink-0">!</span>
          ) : (
            <svg className="w-4 h-4 text-emerald-500 shrink-0" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0Zm3.78 5.22a.75.75 0 0 0-1.06 0L7 8.94 5.28 7.22a.75.75 0 1 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.06 0l4.25-4.25a.75.75 0 0 0 0-1.06Z" />
            </svg>
          )}
          <span className="text-xs font-medium text-foreground/70">
            {hasError ? "生成出错" : allDone ? "已完成分析" : "正在分析..."}
          </span>
          <svg
            className={`w-3.5 h-3.5 text-muted ml-auto transition-transform ${isCollapsed ? "" : "rotate-180"}`}
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M4 6l4 4 4-4" />
          </svg>
        </button>

        {!isCollapsed && (
          <div className="px-4 pb-3 space-y-2 border-t border-border/50 pt-2.5">
            {steps.map((step) => (
              <div key={step.id} className="flex items-center gap-2.5">
                <StepIcon status={step.status} />
                <span className="text-xs text-foreground/80">{step.label}</span>
                {step.detail && (
                  <span className="text-[11px] text-muted ml-auto shrink-0">{step.detail}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StepIcon({ status }: { status: "active" | "done" | "error" }) {
  if (status === "active") {
    return (
      <svg className="w-3.5 h-3.5 text-primary animate-spin shrink-0" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
        <path d="M8 2a6 6 0 0 1 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  if (status === "done") {
    return (
      <svg className="w-3.5 h-3.5 text-emerald-500 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3.5 8.5l3 3 6-6" />
      </svg>
    );
  }
  return (
    <svg className="w-3.5 h-3.5 text-red-500 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

export function LoadingDots() {
  return (
    <div className="flex gap-1">
      <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce [animation-delay:0ms]" />
      <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce [animation-delay:150ms]" />
      <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce [animation-delay:300ms]" />
    </div>
  );
}

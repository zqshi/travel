"use client";

import { useState, useEffect } from "react";
import { Drawer } from "./drawer";

interface SourceDrawerProps {
  open: boolean;
  onClose: () => void;
  url: string;
  notes?: string;
}

export function SourceDrawer({ open, onClose, url, notes }: SourceDrawerProps) {
  const [content, setContent] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [iframeError, setIframeError] = useState(false);

  let hostname = url;
  try {
    hostname = new URL(url).hostname.replace("www.", "");
  } catch { /* keep raw */ }

  useEffect(() => {
    if (!open || !url) return;
    setLoading(true);
    setContent(null);
    setSummary(null);
    setIframeError(false);

    const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    fetch(`${API_BASE}/api/v1/fetch-source?url=${encodeURIComponent(url)}&mode=full`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.content) setContent(data.content);
        if (data?.summary) setSummary(data.summary);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, url]);

  const requestSummary = async () => {
    setSummarizing(true);
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    try {
      const res = await fetch(`${API_BASE}/api/v1/fetch-source?url=${encodeURIComponent(url)}&mode=summary`);
      if (res.ok) {
        const data = await res.json();
        if (data?.summary) setSummary(data.summary);
      }
    } catch { /* ignore */ }
    setSummarizing(false);
  };

  return (
    <Drawer open={open} onClose={onClose} title={`来源: ${hostname}`} width="lg">
      <div className="space-y-4">
        {/* URL */}
        <div className="flex items-center gap-2 p-3 rounded-xl bg-background border border-border">
          <span className="text-xs text-muted truncate flex-1">{url}</span>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline shrink-0"
          >
            新窗口打开
          </a>
        </div>

        {/* AI Summary */}
        {summary && (
          <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900">
            <p className="text-xs font-medium text-muted mb-1">AI 中文摘要</p>
            <p className="text-sm leading-relaxed">{summary}</p>
          </div>
        )}

        {/* Request summary button */}
        {!summary && content && !summarizing && (
          <button
            onClick={requestSummary}
            className="w-full py-2.5 rounded-xl border border-primary/30 text-primary text-xs font-medium hover:bg-primary/5 transition-colors flex items-center justify-center gap-2"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <circle cx="7" cy="7" r="5.5" />
              <path d="M5.5 5.5a1.5 1.5 0 0 1 3 0c0 .83-.67 1-1.5 1.5M7 9.5v0" />
            </svg>
            看不懂？生成AI中文摘要
          </button>
        )}

        {summarizing && (
          <div className="flex items-center justify-center py-3 gap-2">
            <svg className="w-4 h-4 text-primary animate-spin" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.3" />
              <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span className="text-xs text-muted">正在生成中文摘要...</span>
          </div>
        )}

        {/* Itinerary-level notes (from AI planning) */}
        {notes && (
          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900">
            <p className="text-xs font-medium text-muted mb-1">行程备注</p>
            <p className="text-sm leading-relaxed">{notes}</p>
          </div>
        )}

        {/* Original full content */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-sm text-muted">加载原始内容...</div>
          </div>
        )}

        {!loading && content && (
          <div className="p-4 rounded-xl bg-background border border-border">
            <p className="text-xs font-medium text-muted mb-2">原始内容</p>
            <div className="text-sm leading-relaxed whitespace-pre-wrap overflow-y-auto text-foreground/80">
              {content}
            </div>
          </div>
        )}

        {!loading && !content && !iframeError && url && (
          <div className="rounded-xl overflow-hidden border border-border">
            <iframe
              src={url}
              className="w-full h-full min-h-[300px]"
              sandbox="allow-same-origin allow-scripts"
              onError={() => setIframeError(true)}
            />
          </div>
        )}

        {iframeError && (
          <div className="text-center py-8">
            <p className="text-sm text-muted">该来源不支持嵌入预览</p>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline mt-2 inline-block"
            >
              点击在新窗口中查看
            </a>
          </div>
        )}
      </div>
    </Drawer>
  );
}

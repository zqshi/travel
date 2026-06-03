"use client";

interface SourcesSectionProps {
  sources: string[];
  onOpenSource?: (url: string) => void;
}

export function SourcesSection({ sources, onOpenSource }: SourcesSectionProps) {
  if (!sources || sources.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
        <span>📋</span> 参考来源
      </h3>
      <div className="space-y-1.5">
        {sources.map((source, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <span className="text-[10px] text-muted shrink-0">[{idx + 1}]</span>
            <button
              onClick={() => onOpenSource?.(source)}
              className="text-xs text-blue-500 hover:underline truncate"
              title={source}
            >
              {source}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

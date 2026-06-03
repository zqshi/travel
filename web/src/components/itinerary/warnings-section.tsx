"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface WarningsSectionProps {
  warnings: any[];
}

export function WarningsSection({ warnings }: WarningsSectionProps) {
  if (!warnings || warnings.length === 0) return null;

  return (
    <div className="rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 p-4">
      <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
        <span>⚠️</span> 注意事项
      </h3>
      <div className="space-y-2">
        {warnings.map((warning: any, idx: number) => (
          <WarningItem key={idx} warning={warning} />
        ))}
      </div>
    </div>
  );
}

function WarningItem({ warning }: { warning: any }) {
  if (typeof warning === "string") {
    return (
      <div className="flex items-start gap-2">
        <span className="shrink-0 text-amber-500 mt-0.5">•</span>
        <p className="text-xs leading-relaxed">{warning}</p>
      </div>
    );
  }

  const severity = warning.severity || "";
  const category = warning.category || "";
  const detail = warning.detail || warning.message || warning.text || "";

  const severityStyle =
    severity === "高"
      ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
      : severity === "中"
      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
      : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";

  if (detail) {
    return (
      <div className="flex items-start gap-2">
        <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded mt-0.5 ${severityStyle}`}>
          {severity || "提示"}
        </span>
        <div className="min-w-0">
          {category && <span className="text-xs font-semibold">[{category}] </span>}
          <span className="text-xs leading-relaxed text-muted">{detail}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2">
      <span className="shrink-0 text-amber-500 mt-0.5">•</span>
      <div className="text-xs leading-relaxed text-muted space-y-0.5">
        {Object.entries(warning)
          .filter(([k]) => !["severity", "category"].includes(k))
          .map(([key, value]) => (
            <p key={key}>
              <span className="font-medium text-foreground/70">{key}：</span>
              {typeof value === "object" ? Object.values(value as object).join("、") : String(value)}
            </p>
          ))}
      </div>
    </div>
  );
}

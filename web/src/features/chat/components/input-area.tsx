import type { Mode } from "../types";
import { COMPARE_PRESETS_MAP } from "../constants";

export interface InputAreaProps {
  input: string;
  setInput: (v: string) => void;
  loading: boolean;
  mode: Mode;
  setMode: (m: Mode) => void;
  selectedCountry: string;
  anyDrawerOpen: boolean;
  onSubmit: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  addPreset: (preset: string) => void;
}

export function InputArea({
  input,
  setInput,
  loading,
  mode,
  setMode,
  selectedCountry,
  anyDrawerOpen,
  onSubmit,
  onKeyDown,
  addPreset,
}: InputAreaProps) {
  return (
    <div className="border-t border-border bg-card px-4 pt-3 pb-4 md:pb-4 shrink-0" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
      <div className={`mx-auto ${anyDrawerOpen ? "max-w-3xl" : "max-w-4xl"} transition-all`}>
        <div className="flex items-center gap-1.5 mb-3">
          <button
            onClick={() => setMode("plan")}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
              mode === "plan"
                ? "bg-primary text-white shadow-sm shadow-primary/20"
                : "bg-gray-100 dark:bg-gray-800 text-foreground/50 hover:text-foreground/70"
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1.5 4.5L7 1l5.5 3.5M1.5 4.5v5L7 13M1.5 4.5L7 8m0 5l5.5-3.5v-5M7 13V8m0 0l5.5-3.5" />
            </svg>
            规划行程
          </button>
          <button
            onClick={() => setMode("compare")}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
              mode === "compare"
                ? "bg-primary text-white shadow-sm shadow-primary/20"
                : "bg-gray-100 dark:bg-gray-800 text-foreground/50 hover:text-foreground/70"
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M3 11V5M7 11V3M11 11V7" />
            </svg>
            比价
          </button>
        </div>

        {mode === "compare" && (
          <div className="flex flex-wrap gap-2 mb-3">
            {(COMPARE_PRESETS_MAP[selectedCountry] || COMPARE_PRESETS_MAP.TH).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => addPreset(p)}
                className="text-xs px-3 py-1.5 rounded-full border border-border/60 text-foreground/60 hover:bg-primary/5 hover:border-primary/30 hover:text-primary transition-colors"
              >
                + {p}
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-3 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={
              mode === "compare"
                ? "输入比价项目，用逗号分隔..."
                : "描述你的旅行想法..."
            }
            disabled={loading}
            rows={1}
            className="flex-1 px-4 py-3 rounded-2xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50 resize-none max-h-32"
            style={{ minHeight: "44px" }}
          />
          <button
            onClick={onSubmit}
            disabled={loading || !input.trim()}
            className="bg-primary text-white p-3 rounded-full hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            {loading ? (
              <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.3" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path d="M3.105 2.289a.75.75 0 0 1 .82.12l13.5 12.75a.75.75 0 0 1-.46 1.341H3.75a.75.75 0 0 1-.75-.75V2.75a.75.75 0 0 1 .105-.461Z" />
              </svg>
            )}
          </button>
        </div>
        <p className="text-xs text-muted mt-2 text-center hidden sm:block">
          {mode === "compare"
            ? "支持同时比较多个项目，用逗号分隔"
            : "生成后可继续输入调整行程，如「第三天换成海岛」「预算减到8000」"}
        </p>
      </div>
    </div>
  );
}

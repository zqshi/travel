import { COUNTRY_OPTIONS, type CountryOption } from "../constants";

export function GuideScreen({
  onCountrySelect,
}: {
  onCountrySelect: (country: CountryOption) => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 sm:py-20">
      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-blue-400 flex items-center justify-center text-white text-lg font-bold shadow-lg shadow-primary/20 mb-5">
        T
      </div>
      <h2 className="text-lg font-semibold mb-1">你好！我是你的AI旅行助手</h2>
      <p className="text-sm text-muted mb-8">选择一个目的地开始规划，或直接输入你的旅行想法</p>
      <div className="w-full max-w-xl grid grid-cols-2 sm:grid-cols-3 gap-3">
        {COUNTRY_OPTIONS.map((c) => (
          <button
            key={c.code}
            onClick={() => onCountrySelect(c)}
            className="flex flex-col items-center gap-2 px-4 py-5 rounded-2xl border border-border bg-card hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm transition-all group"
          >
            <span className="text-3xl">{c.flag}</span>
            <span className="text-sm font-medium group-hover:text-primary transition-colors">{c.name}</span>
            <span className="text-xs text-muted">{c.desc}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

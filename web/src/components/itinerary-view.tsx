"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface ItineraryViewProps {
  data: Record<string, any>;
  budgetCny?: number;
  onBooking?: (item: { name: string; nameLocal?: string; platform: string; priceThb: number; priceCny: number; category: string; sourceUrl?: string; date?: string }) => void;
  onVoiceBooking?: (item: { name: string; platform: string; priceThb: number; priceCny: number; sourceUrl?: string; phone?: string }) => void;
  onOpenSource?: (url: string, notes?: string) => void;
  bookedItems?: Set<string>;
  onViewBooking?: (itemName: string) => void;
}

export function ItineraryView({ data, budgetCny = 10000, onBooking, onVoiceBooking, onOpenSource, bookedItems, onViewBooking }: ItineraryViewProps) {
  const openSource = (url: string, notes?: string) => {
    onOpenSource?.(url, notes);
  };
  const rate = 0.2;
  const days: any[] = data.days || [];
  const warnings: any[] = data.warnings || [];
  const sources: string[] = data.sources || [];
  const budgetEstimate = data.budget_estimate;
  const totalThb = data.total_estimated_thb || 0;
  const reviewResult: string = typeof data.review_result === "string" ? data.review_result : "";

  if (days.length === 0 && warnings.length === 0) {
    return (
      <div className="rounded-2xl border border-border p-6 bg-card text-center">
        <p className="text-muted">暂无完整行程数据，请重试或调整需求描述。</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Budget Overview */}
      {budgetEstimate && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-2xl p-5 border border-blue-100 dark:border-blue-900">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <span>💰</span> 预算概览
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            {budgetEstimate.activities_meals_transport_cny && (
              <BudgetItem label="活动/餐饮/交通" value={budgetEstimate.activities_meals_transport_cny} />
            )}
            {budgetEstimate.accommodation_estimated_cny && (
              <BudgetItem label="住宿" value={budgetEstimate.accommodation_estimated_cny} />
            )}
            {budgetEstimate.international_flights_estimated_cny && (
              <BudgetItem label="国际机票" value={budgetEstimate.international_flights_estimated_cny} />
            )}
            {budgetEstimate.total_estimated_cny && (
              <BudgetItem label="预估总计" value={budgetEstimate.total_estimated_cny} highlight />
            )}
          </div>
          {budgetEstimate.note && (
            <p className="text-xs text-muted leading-relaxed mt-2">{budgetEstimate.note}</p>
          )}
        </div>
      )}

      {/* Total cost if no budget_estimate */}
      {!budgetEstimate && totalThb > 0 && (
        <div className="rounded-2xl bg-card border border-border p-4 flex items-center justify-between">
          <span className="text-sm font-medium">预估当地花费</span>
          <div className="text-right">
            <span className="font-semibold text-primary">¥{Math.round(totalThb * rate).toLocaleString()}</span>
            <span className="text-xs text-muted ml-2">฿{totalThb.toLocaleString()}</span>
          </div>
        </div>
      )}

      {/* Day Cards */}
      {days.map((day: any, idx: number) => (
        <DayCard key={idx} day={day} dayNumber={idx + 1} rate={rate} onOpenSource={openSource} onBooking={onBooking} onVoiceBooking={onVoiceBooking} bookedItems={bookedItems} onViewBooking={onViewBooking} />
      ))}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 p-5">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <span>⚠️</span> 注意事项 ({warnings.length})
          </h3>
          <div className="space-y-3">
            {warnings.map((w: any, i: number) => (
              <WarningItem key={i} warning={w} />
            ))}
          </div>
        </div>
      )}

      {/* Review Result / Tips */}
      {reviewResult && (
        <div className="rounded-2xl border border-blue-100 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20 p-5">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <span>💡</span> 旅行贴士
          </h3>
          <p className="text-xs leading-relaxed text-foreground/70 whitespace-pre-wrap">{reviewResult}</p>
        </div>
      )}

      {/* Sources */}
      {sources.length > 0 && (
        <div className="rounded-2xl border border-border p-5">
          <h3 className="font-semibold text-xs mb-2 text-muted">📚 信息来源</h3>
          <div className="flex flex-wrap gap-2">
            {sources.slice(0, 10).map((s: string, i: number) => {
              let hostname = s;
              try { hostname = new URL(s).hostname.replace("www.", ""); } catch { /* keep raw */ }
              return (
                <button
                  key={i}
                  onClick={() => openSource(s)}
                  className="text-xs px-2.5 py-1 rounded-full bg-background border border-border text-primary hover:underline truncate max-w-[240px]"
                >
                  {hostname}
                </button>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}

function BudgetItem({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`rounded-xl p-3 ${highlight ? "bg-white dark:bg-gray-800 shadow-sm" : "bg-white/50 dark:bg-gray-800/50"}`}>
      <p className="text-xs text-muted mb-1">{label}</p>
      <p className={`font-semibold ${highlight ? "text-primary text-lg" : "text-sm"}`}>
        ¥{value.toLocaleString()}
      </p>
    </div>
  );
}

function DayCard({ day, dayNumber, rate, onOpenSource, onBooking, onVoiceBooking, bookedItems, onViewBooking }: { day: any; dayNumber: number; rate: number; onOpenSource: (url: string, notes?: string) => void; onBooking?: ItineraryViewProps["onBooking"]; onVoiceBooking?: ItineraryViewProps["onVoiceBooking"]; bookedItems?: Set<string>; onViewBooking?: (itemName: string) => void }) {
  const num = day.day || dayNumber;
  const title = day.title || `第${num}天`;
  const city = day.city || "";
  const dateStr = day.date || "";
  const dayDate = dateStr || "";
  const activities: any[] = day.activities || [];
  const transport: any[] = day.transport || [];
  const meals: any[] = day.meals || [];
  const dayCostThb = day.estimated_cost_thb || 0;
  const dayCostCny = dayCostThb ? Math.round(dayCostThb * rate) : 0;

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border bg-gradient-to-r from-primary/5 to-transparent">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-xs font-bold text-white bg-primary px-2.5 py-1 rounded-lg shrink-0">
              DAY {num}
            </span>
            <div className="min-w-0">
              <h3 className="font-semibold text-sm truncate">{title}</h3>
              <p className="text-xs text-muted">
                {dateStr && `${dateStr} · `}{city}
              </p>
            </div>
          </div>
          {dayCostCny > 0 && (
            <div className="text-right shrink-0">
              <p className="text-sm font-bold text-primary">¥{dayCostCny}</p>
              <p className="text-[10px] text-muted">฿{dayCostThb.toLocaleString()}</p>
            </div>
          )}
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Activities */}
        {activities.length > 0 && (
          <Section icon="🎯" label="景点/活动">
            {activities.map((act: any, i: number) => (
              <POICard key={i} poi={act} rate={rate} colorClass="bg-blue-50 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900" onOpenSource={onOpenSource} onBooking={onBooking} onVoiceBooking={onVoiceBooking} category="ticket" dayDate={dayDate} bookedItems={bookedItems} onViewBooking={onViewBooking} />
            ))}
          </Section>
        )}

        {/* Transport */}
        {transport.length > 0 && (
          <Section icon="🚗" label="交通">
            <div className="space-y-1.5">
              {transport.map((t: any, i: number) => (
                <TransportRow key={i} data={t} onBooking={onBooking} dayDate={dayDate} />
              ))}
            </div>
          </Section>
        )}

        {/* Meals */}
        {meals.length > 0 && (
          <Section icon="🍜" label="美食">
            {meals.map((meal: any, i: number) => (
              <POICard key={i} poi={meal} rate={rate} colorClass="bg-green-50 dark:bg-green-950/20 border-green-100 dark:border-green-900" onOpenSource={onOpenSource} onBooking={onBooking} onVoiceBooking={onVoiceBooking} category="meal" dayDate={dayDate} bookedItems={bookedItems} onViewBooking={onViewBooking} />
            ))}
          </Section>
        )}
      </div>
    </div>
  );
}

function Section({ icon, label, children }: { icon: string; label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-sm">{icon}</span>
        <span className="text-xs font-semibold text-muted uppercase tracking-wider">{label}</span>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function POICard({ poi, rate, colorClass, onOpenSource, onBooking, onVoiceBooking, category, dayDate, bookedItems, onViewBooking }: { poi: any; rate: number; colorClass: string; onOpenSource: (url: string, notes?: string) => void; onBooking?: ItineraryViewProps["onBooking"]; onVoiceBooking?: ItineraryViewProps["onVoiceBooking"]; category?: string; dayDate?: string; bookedItems?: Set<string>; onViewBooking?: (itemName: string) => void }) {
  const name = poi.name || "未知";
  const nameLocal = poi.name_local || "";
  const costThb = poi.estimated_cost_thb || poi.cost_thb || poi.price_thb || 0;
  const costCny = poi.estimated_cost_cny || poi.cost_cny || poi.price_cny || (costThb ? Math.round(costThb * rate) : 0);
  const notes = poi.notes || "";
  const rating = poi.rating;
  const sourceUrl = poi.source_url || poi.booking_url || "";
  const platform = poi.platform || "";
  const phone = poi.phone || poi.contact_phone || "";
  const isBooked = bookedItems?.has(name) ?? false;

  const hasPlatform = platform.trim() !== "";
  const hasPhone = phone.trim() !== "";
  const canBook = hasPlatform && !!onBooking && !isBooked;
  const canVoiceBook = hasPhone && !!onVoiceBooking && !isBooked;

  return (
    <div className={`rounded-xl p-3.5 border ${colorClass}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm">{name}</p>
          {nameLocal && <p className="text-xs text-muted mt-0.5">{nameLocal}</p>}
          {phone && <p className="text-xs text-muted mt-0.5">📞 {phone}</p>}
        </div>
        {costThb > 0 && (
          <span className="shrink-0 text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
            ¥{costCny}
          </span>
        )}
      </div>
      {notes && (
        <p className="text-xs text-muted mt-2 leading-relaxed">{notes}</p>
      )}
      <div className="flex items-center gap-3 mt-2 empty:hidden flex-wrap">
        {rating && <span className="text-xs text-amber-600 font-medium">★ {rating}</span>}
        {sourceUrl && (
          <button onClick={() => onOpenSource(sourceUrl, notes)} className="text-xs text-primary hover:underline">
            查看来源 →
          </button>
        )}
        {canBook && (
          <button
            onClick={() => onBooking!({ name, nameLocal, platform, priceThb: costThb, priceCny: costCny, category: category || "ticket", sourceUrl, date: dayDate })}
            className="text-xs px-2.5 py-1 rounded-full bg-primary text-white hover:bg-primary-hover transition-colors ml-auto"
          >
            预定
          </button>
        )}
        {canVoiceBook && (
          <button
            onClick={() => onVoiceBooking!({ name, platform, priceThb: costThb, priceCny: costCny, sourceUrl, phone })}
            className={`text-xs px-2.5 py-1 rounded-full border border-primary text-primary hover:bg-primary/5 transition-colors ${!canBook ? "ml-auto" : ""}`}
          >
            一键代订
          </button>
        )}
        {isBooked && onViewBooking && (
          <button
            onClick={() => onViewBooking(name)}
            className="text-xs px-2.5 py-1 rounded-full bg-success/10 text-success border border-success/20 hover:bg-success/20 transition-colors"
          >
            查看订单
          </button>
        )}
      </div>
    </div>
  );
}

function TransportRow({ data, onBooking, dayDate }: { data: any; onBooking?: ItineraryViewProps["onBooking"]; dayDate?: string }) {
  const mode = data.mode || "未知";
  const from = data.from_location || "";
  const to = data.to_location || "";
  const duration = data.duration_min;
  const cost = data.estimated_cost_thb || 0;
  const platform = data.platform || "";

  return (
    <div className="flex items-center gap-2 py-2 px-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 text-sm">
      <span className="shrink-0 text-[11px] font-medium bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded-full">
        {mode}
      </span>
      <span className="text-xs text-muted truncate">
        {from} → {to}
      </span>
      <span className="ml-auto flex items-center gap-2 shrink-0">
        {duration && <span className="text-[11px] text-muted">~{duration}min</span>}
        {cost > 0 && <span className="text-[11px] font-medium text-primary">฿{cost}</span>}
      </span>
      {platform && <span className="text-[10px] text-muted">({platform})</span>}
      {(platform || cost > 0) && onBooking && (
        <button
          onClick={() => onBooking({ name: `${from}→${to} ${mode}`, platform: platform || "12Go", priceThb: cost, priceCny: Math.round(cost * 0.2), category: "transport", date: dayDate })}
          className="text-[10px] px-2 py-0.5 rounded-full bg-primary text-white hover:bg-primary-hover transition-colors shrink-0"
        >
          预定
        </button>
      )}
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

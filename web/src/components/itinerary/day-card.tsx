"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface DayCardProps {
  day: any;
  rate: number;
  onBooking?: (item: any) => void;
  onVoiceBooking?: (item: any) => void;
  onOpenSource?: (url: string, notes?: string) => void;
  bookedItems?: Set<string>;
  onViewBooking?: (itemName: string) => void;
}

export function DayCard({ day, rate, onBooking, onVoiceBooking, onOpenSource, bookedItems, onViewBooking }: DayCardProps) {
  const activities: any[] = day.activities || [];
  const dayLabel = day.date || day.day || "";

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      {/* Day header */}
      <div className="px-4 py-3 bg-muted/30 border-b border-border flex items-center justify-between">
        <h3 className="font-semibold text-sm">{dayLabel}</h3>
        {day.theme && <span className="text-xs text-muted">{day.theme}</span>}
      </div>

      {/* Activities */}
      <div className="divide-y divide-border">
        {activities.map((activity: any, idx: number) => (
          <ActivityItem
            key={idx}
            activity={activity}
            rate={rate}
            onBooking={onBooking}
            onVoiceBooking={onVoiceBooking}
            onOpenSource={onOpenSource}
            bookedItems={bookedItems}
            onViewBooking={onViewBooking}
          />
        ))}
      </div>
    </div>
  );
}

function ActivityItem({ activity, rate, onBooking, onVoiceBooking, onOpenSource, bookedItems, onViewBooking }: {
  activity: any;
  rate: number;
  onBooking?: (item: any) => void;
  onVoiceBooking?: (item: any) => void;
  onOpenSource?: (url: string, notes?: string) => void;
  bookedItems?: Set<string>;
  onViewBooking?: (itemName: string) => void;
}) {
  const name = activity.name || activity.activity || "";
  const nameLocal = activity.name_local || "";
  const priceThb = activity.price_thb || activity.cost_thb || 0;
  const priceCny = priceThb ? Math.round(priceThb * rate) : 0;
  const platform = activity.platform || activity.source || "";
  const sourceUrl = activity.source_url || activity.url || "";
  const category = activity.category || activity.type || "";
  const time = activity.time || "";
  const notes = activity.notes || activity.tips || "";
  const isBooked = bookedItems?.has(name);

  return (
    <div className="px-4 py-3 flex items-start gap-3">
      {/* Time */}
      {time && (
        <div className="shrink-0 w-12 text-[11px] text-muted pt-0.5">{time}</div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">{name}</span>
          {nameLocal && <span className="text-xs text-muted">({nameLocal})</span>}
          {category && (
            <span className="text-[10px] px-1.5 py-0.5 bg-muted/50 rounded">{category}</span>
          )}
        </div>
        {notes && <p className="text-xs text-muted mt-1">{notes}</p>}
        {sourceUrl && (
          <button
            onClick={() => onOpenSource?.(sourceUrl, notes)}
            className="text-[11px] text-blue-500 hover:underline mt-1"
          >
            查看来源
          </button>
        )}
      </div>

      {/* Price + Actions */}
      <div className="shrink-0 text-right space-y-1">
        {priceThb > 0 && (
          <div>
            <p className="text-sm font-semibold">¥{priceCny}</p>
            <p className="text-[10px] text-muted">฿{priceThb}</p>
          </div>
        )}
        {platform && !isBooked && onBooking && (
          <button
            onClick={() => onBooking({ name, nameLocal, platform, priceThb, priceCny, category, sourceUrl })}
            className="text-[11px] px-2 py-1 bg-primary text-primary-foreground rounded-md hover:opacity-90"
          >
            预订
          </button>
        )}
        {platform && !isBooked && onVoiceBooking && (
          <button
            onClick={() => onVoiceBooking({ name, platform, priceThb, priceCny, sourceUrl })}
            className="text-[11px] px-2 py-1 border border-border rounded-md hover:bg-muted/50"
          >
            电话订
          </button>
        )}
        {isBooked && (
          <button
            onClick={() => onViewBooking?.(name)}
            className="text-[11px] px-2 py-1 bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 rounded-md"
          >
            已预订 ✓
          </button>
        )}
      </div>
    </div>
  );
}

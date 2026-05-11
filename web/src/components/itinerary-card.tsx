"use client";

import { DayPlan } from "@/types";

interface ItineraryCardProps {
  day: DayPlan;
  exchangeRate?: number;
}

export function ItineraryCard({ day, exchangeRate = 0.2 }: ItineraryCardProps) {
  return (
    <div className="border border-border rounded-xl p-5 bg-card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-lg">
            Day {day.day} — {day.title}
          </h3>
          <p className="text-sm text-muted">
            {day.date} · {day.city}
          </p>
        </div>
        {day.estimated_cost_thb > 0 && (
          <div className="text-right">
            <p className="text-sm font-medium">
              ฿{day.estimated_cost_thb.toLocaleString()}
            </p>
            <p className="text-xs text-muted">
              ≈ ¥{Math.round(day.estimated_cost_thb * exchangeRate).toLocaleString()}
            </p>
          </div>
        )}
      </div>

      {/* Activities */}
      {day.activities.length > 0 && (
        <div className="mb-3">
          {day.activities.map((act, i) => (
            <div key={i} className="flex items-start gap-3 py-2 border-b border-border last:border-0">
              <span className="text-lg mt-0.5">🎯</span>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm">{act.name}</p>
                  {act.estimated_cost_thb ? (
                    <span className="text-xs text-muted">
                      ฿{act.estimated_cost_thb}
                    </span>
                  ) : null}
                </div>
                {act.name_local && (
                  <p className="text-xs text-muted">{act.name_local}</p>
                )}
                {act.source_url && (
                  <a
                    href={act.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline"
                  >
                    查看来源
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Transport */}
      {day.transport.length > 0 && (
        <div className="mb-3">
          {day.transport.map((t, i) => (
            <div key={i} className="flex items-center gap-3 py-1.5 text-sm text-muted">
              <span>🚗</span>
              <span>
                {t.from_location} → {t.to_location}
              </span>
              <span className="text-xs bg-background px-2 py-0.5 rounded-full">
                {t.mode}
              </span>
              {t.duration_min && (
                <span className="text-xs">~{t.duration_min}min</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Meals */}
      {day.meals.length > 0 && (
        <div>
          {day.meals.map((meal, i) => (
            <div key={i} className="flex items-start gap-3 py-2">
              <span className="text-lg">🍜</span>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm">{meal.name}</p>
                  {meal.estimated_cost_thb ? (
                    <span className="text-xs text-muted">
                      ฿{meal.estimated_cost_thb}/人
                    </span>
                  ) : null}
                </div>
                {meal.notes && (
                  <p className="text-xs text-muted mt-0.5">{meal.notes}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

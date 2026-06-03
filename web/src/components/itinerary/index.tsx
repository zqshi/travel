"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { BudgetOverview } from "./budget-overview";
import { DayCard } from "./day-card";
import { WarningsSection } from "./warnings-section";
import { SourcesSection } from "./sources-section";

interface ItineraryViewProps {
  data: Record<string, any>;
  budgetCny?: number;
  onBooking?: (item: any) => void;
  onVoiceBooking?: (item: any) => void;
  onOpenSource?: (url: string, notes?: string) => void;
  bookedItems?: Set<string>;
  onViewBooking?: (itemName: string) => void;
}

export function ItineraryView({
  data,
  budgetCny = 10000,
  onBooking,
  onVoiceBooking,
  onOpenSource,
  bookedItems,
  onViewBooking,
}: ItineraryViewProps) {
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
        <BudgetOverview
          budgetEstimate={budgetEstimate}
          totalThb={totalThb}
          budgetCny={budgetCny}
          rate={rate}
        />
      )}

      {/* Review Summary */}
      {reviewResult && (
        <div className="rounded-2xl border border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20 p-4">
          <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
            <span>✅</span> 审核结果
          </h3>
          <p className="text-xs leading-relaxed text-muted whitespace-pre-wrap">{reviewResult}</p>
        </div>
      )}

      {/* Day Cards */}
      {days.map((day: any, idx: number) => (
        <DayCard
          key={idx}
          day={day}
          rate={rate}
          onBooking={onBooking}
          onVoiceBooking={onVoiceBooking}
          onOpenSource={onOpenSource}
          bookedItems={bookedItems}
          onViewBooking={onViewBooking}
        />
      ))}

      {/* Warnings */}
      <WarningsSection warnings={warnings} />

      {/* Sources */}
      <SourcesSection sources={sources} onOpenSource={(url) => onOpenSource?.(url)} />
    </div>
  );
}

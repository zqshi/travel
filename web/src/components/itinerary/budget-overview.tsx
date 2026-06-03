"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface BudgetOverviewProps {
  budgetEstimate: Record<string, any>;
  totalThb: number;
  budgetCny: number;
  rate: number;
}

function BudgetItem({ label, value }: { label: string; value: number | string }) {
  const display = typeof value === "number" ? `¥${value.toLocaleString()}` : value;
  return (
    <div className="text-center p-2 bg-white/60 dark:bg-white/5 rounded-lg">
      <p className="text-[11px] text-muted mb-0.5">{label}</p>
      <p className="text-sm font-bold">{display}</p>
    </div>
  );
}

export function BudgetOverview({ budgetEstimate, totalThb, budgetCny, rate }: BudgetOverviewProps) {
  const totalCny = Math.round(totalThb * rate);
  const pct = budgetCny > 0 ? Math.min(100, Math.round((totalCny / budgetCny) * 100)) : 0;
  const overBudget = totalCny > budgetCny;

  return (
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
          <BudgetItem label="预估总计" value={budgetEstimate.total_estimated_cny} />
        )}
      </div>
      {/* Progress bar */}
      <div className="mt-2">
        <div className="flex justify-between text-[11px] text-muted mb-1">
          <span>预算使用</span>
          <span className={overBudget ? "text-red-500 font-semibold" : ""}>
            {pct}% {overBudget && "(超出预算)"}
          </span>
        </div>
        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${overBudget ? "bg-red-500" : "bg-blue-500"}`}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

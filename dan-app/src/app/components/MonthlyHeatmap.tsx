"use client";

import { useMemo } from "react";
import type { HeatmapHorizon, MonthlyCell, SymbolMonthlyAnalytics } from "@/lib/monthlyAnalytics";

type MetricMode = "return" | "excess";

type Props = {
  data: SymbolMonthlyAnalytics | undefined;
  metric: MetricMode;
  horizon: HeatmapHorizon;
  highlightDate?: string | null;
  highlightDates?: Set<string> | null;
  onSelectDate?: (date: string) => void;
  hasBenchmark: boolean;
};

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function MonthlyHeatmap(props: Props) {
  const { data, metric, horizon, highlightDate, highlightDates, onSelectDate, hasBenchmark } = props;

  const cellMap = useMemo(() => {
    const map = new Map<string, MonthlyCell>();
    if (!data) return map;
    for (const cell of data.cells) {
      map.set(key(cell.year, cell.month), cell);
    }
    return map;
  }, [data]);

  if (!data || data.cells.length === 0) {
    return (
      <div className="text-sm text-gray-600 dark:text-gray-300">
        Not enough history to render the {horizonLabel(horizon)} heatmap.
      </div>
    );
  }

  const domain = metric === "return" ? data.returnDomain : data.excessDomain ?? data.returnDomain;

  return (
    <div className="w-full overflow-x-auto rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-neutral-900">
      <div className="min-w-[640px]">
        <div
          className="grid text-xs font-medium text-gray-600 dark:text-gray-300 border-b border-black/10 dark:border-white/15"
          style={{ gridTemplateColumns: "80px repeat(12, minmax(32px, 1fr))" }}
        >
          <div className="px-3 py-2">Year</div>
          {MONTH_LABELS.map((label) => (
            <div key={label} className="px-2 py-2 text-center">
              {label}
            </div>
          ))}
        </div>
        {data.years.map((year) => (
          <div
            key={year}
            className="grid border-b border-black/5 dark:border-white/10 last:border-b-0"
            style={{ gridTemplateColumns: "80px repeat(12, minmax(32px, 1fr))" }}
          >
            <div className="px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-200 flex items-center">{year}</div>
            {MONTH_LABELS.map((_, monthIdx) => {
              const cell = cellMap.get(key(year, monthIdx));
              if (!cell) {
                return <div key={monthIdx} className="h-10 border-l border-black/5 dark:border-white/10 bg-transparent" />;
              }
              const metricValue =
                metric === "return"
                  ? cell.returnPct
                  : cell.excessPct ?? (hasBenchmark ? null : cell.returnPct);
              if (metric === "excess" && cell.excessPct == null && hasBenchmark) {
                return <div key={monthIdx} className="h-10 border-l border-black/5 dark:border-white/10 bg-transparent" />;
              }
              const displayValue = metricValue ?? 0;
              const color = valueToColor(displayValue, domain);
              const isHighlighted = highlightDate === cell.date;
              const isRangeHighlighted = highlightDates?.has(cell.date) ?? false;
              const classes = [
                "h-10",
                "border-l",
                "border-black/5",
                "dark:border-white/10",
                "transition",
                "duration-150",
                "ease-in-out",
                "cursor-pointer",
                "relative",
              ];
              if (isHighlighted) {
                classes.push("ring-2", "ring-offset-1", "ring-amber-500", "ring-offset-white", "dark:ring-offset-neutral-900");
              } else if (isRangeHighlighted) {
                classes.push("ring-1", "ring-amber-300/80", "ring-offset-1", "ring-offset-white", "dark:ring-offset-neutral-900");
              }
              return (
                <button
                  key={monthIdx}
                  type="button"
                  className={classes.join(" ")}
                  style={{ backgroundColor: color }}
                  title={buildTooltip(cell, horizon, hasBenchmark)}
                  aria-label={buildTooltip(cell, horizon, hasBenchmark)}
                  onClick={() => {
                    if (typeof onSelectDate === "function") onSelectDate(cell.date);
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function key(year: number, month: number): string {
  return `${year}-${month}`;
}

function horizonLabel(horizon: HeatmapHorizon): string {
  switch (horizon) {
    case "1y":
      return "1-year";
    case "3y":
      return "3-year";
    case "5y":
      return "5-year";
    case "max":
    default:
      return "full history";
  }
}

function buildTooltip(cell: MonthlyCell, horizon: HeatmapHorizon, hasBenchmark: boolean): string {
  const horizonText = horizonLabel(horizon);
  const lines = [
    `Buy: ${cell.date}`,
    `Horizon: ${horizonText}`,
    `Return: ${formatPercent(cell.returnPct)}`,
    `Percentile: ${cell.percentile.toFixed(1)}p`,
  ];
  if (hasBenchmark && cell.excessPct != null) {
    lines.push(`Excess vs SPY: ${formatPercent(cell.excessPct)}`);
  }
  return lines.join(" • ");
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function valueToColor(value: number, domain: { min: number; max: number }): string {
  const maxAbs = Math.max(Math.abs(domain.min), Math.abs(domain.max), 0.01);
  const intensity = Math.min(1, Math.abs(value) / maxAbs);
  const hue = value >= 0 ? 142 : 0;
  const saturation = 60 + intensity * 30;
  const lightness = 92 - intensity * 45;
  return `hsl(${hue}deg ${saturation}% ${lightness}%)`;
}


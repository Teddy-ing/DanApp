"use client";

import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";
import type { HistogramStats, MonthlyCell } from "@/lib/monthlyAnalytics";

type MetricMode = "return" | "excess";

type HistogramRange = { min: number; max: number; dates: string[] };

type Props = {
  cells: MonthlyCell[];
  metric: MetricMode;
  stats: HistogramStats | null;
  onHoverRange?: (range: HistogramRange | null) => void;
};

type BinDatum = {
  index: number;
  start: number;
  end: number;
  mid: number;
  count: number;
  dates: string[];
};

const DEFAULT_DOMAIN = { min: -1, max: 3 };
const BIN_COUNT = 36;

export default function ReturnsHistogram({ cells, metric, stats, onHoverRange }: Props) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const { bins, domain, totalCount } = useMemo(() => buildBins(cells, metric), [cells, metric]);
  const mean = stats?.mean ?? null;
  const median = stats?.median ?? null;
  const p5 = stats?.p5 ?? null;
  const p95 = stats?.p95 ?? null;

  if (totalCount === 0) {
    return <div className="text-sm text-gray-600 dark:text-gray-300">Not enough data to show the distribution.</div>;
  }

  const tooltipFormatter = (value: number) => `${value} months`;
  const labelFormatter = (value: number) => `${(value * 100).toFixed(0)}%`;

  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={bins}
          margin={{ left: 16, right: 16, top: 8, bottom: 8 }}
          onMouseLeave={() => {
            setHoveredIndex(null);
            if (onHoverRange) onHoverRange(null);
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="rgb(0 0 0 / 0.06)" />
          <XAxis
            dataKey="mid"
            tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
            type="number"
            domain={[domain.min, domain.max]}
            tick={{ fontSize: 12 }}
            ticks={generateTicks(domain.min, domain.max)}
          />
          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
          <Tooltip
            formatter={tooltipFormatter}
            labelFormatter={labelFormatter}
            cursor={{ fill: "rgba(148, 163, 184, 0.15)" }}
          />
          <ReferenceLine x={0} stroke="#475569" strokeDasharray="4 4" />
          {mean != null && <ReferenceLine x={mean} stroke="#ef4444" strokeDasharray="3 3" />}
          {median != null && <ReferenceLine x={median} stroke="#22c55e" strokeDasharray="3 3" />}
          <Bar dataKey="count" fill="#60a5fa">
            {bins.map((bin, index) => (
              <Cell
                key={bin.index}
                fill={index === hoveredIndex ? "#2563eb" : "#60a5fa"}
                onMouseEnter={() => {
                  setHoveredIndex(index);
                  if (onHoverRange) onHoverRange({ min: bin.start, max: bin.end, dates: bin.dates });
                }}
                onMouseLeave={() => {
                  setHoveredIndex(null);
                  if (onHoverRange) onHoverRange(null);
                }}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-2 text-xs text-gray-600 dark:text-gray-300 flex flex-wrap gap-4">
        {mean != null && <div>Mean: {formatPercent(mean)}</div>}
        {median != null && <div>Median: {formatPercent(median)}</div>}
        {p5 != null && <div>5th percentile: {formatPercent(p5)}</div>}
        {p95 != null && <div>95th percentile: {formatPercent(p95)}</div>}
        <div>Total: {totalCount} months</div>
      </div>
    </div>
  );
}

function buildBins(cells: MonthlyCell[], metric: MetricMode) {
  const values: Array<{ value: number; date: string }> = [];
  for (const cell of cells) {
    const value = metric === "return" ? cell.returnPct : cell.excessPct;
    if (typeof value === "number" && Number.isFinite(value)) {
      values.push({ value, date: cell.date });
    }
  }

  const domain = values.reduce(
    (acc, { value }) => ({
      min: Math.min(acc.min, value),
      max: Math.max(acc.max, value),
    }),
    { ...DEFAULT_DOMAIN }
  );
  const min = Math.min(domain.min, DEFAULT_DOMAIN.min);
  const max = Math.max(domain.max, DEFAULT_DOMAIN.max);
  const width = (max - min) / BIN_COUNT;

  const bins: BinDatum[] = Array.from({ length: BIN_COUNT }, (_, index) => {
    const start = min + index * width;
    const end = index === BIN_COUNT - 1 ? max : start + width;
    return { index, start, end, mid: (start + end) / 2, count: 0, dates: [] };
  });

  for (const { value, date } of values) {
    const clamped = Math.max(min, Math.min(max, value));
    let idx = Math.floor((clamped - min) / width);
    if (idx >= BIN_COUNT) idx = BIN_COUNT - 1;
    const bin = bins[idx];
    bin.count += 1;
    bin.dates.push(date);
  }

  const totalCount = values.length;
  return { bins, domain: { min, max }, totalCount };
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function generateTicks(min: number, max: number): number[] {
  const step = 0.5;
  const ticks: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max; v += step) {
    ticks.push(Number(v.toFixed(2)));
  }
  return ticks;
}



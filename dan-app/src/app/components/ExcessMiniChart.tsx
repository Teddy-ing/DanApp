"use client";

import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";

type Series = { symbol: string; value: Array<number | null>; pct: Array<number | null> };

type Props = {
  dates: string[];
  series: Series[];
  benchmarkSymbol: string;
  height?: number;
  highlightDate?: string | null;
};

export default function ExcessMiniChart({ dates, series, benchmarkSymbol, height = 200, highlightDate }: Props) {
  const [mode, setMode] = useState<"$" | "%">("%");
  const zeroLineLabel = mode === "$" ? "$0" : "0%";

  const palette = ["#5B8DEF", "#E66E6E", "#6DD3A8", "#F5C26B", "#B388EB"];

  const { data, min, max } = useMemo(() => {
    const rows: Array<Record<string, number | string | null>> = [];
    let min: number | null = null;
    let max: number | null = null;

    for (let i = 0; i < dates.length; i += 1) {
      const row: Record<string, number | string | null> = { date: dates[i] };
      for (const s of series) {
        const rawVal = s.value[i] ?? null;
        const rawPct = s.pct[i] ?? null;
        const nextVal = mode === "$" ? rawVal : (rawPct == null ? null : rawPct * 100);
        const isFiniteNumber = typeof nextVal === "number" && Number.isFinite(nextVal);
        row[s.symbol] = isFiniteNumber ? nextVal : null;
        if (isFiniteNumber) {
          const value = nextVal as number;
          min = min == null ? value : Math.min(min, value);
          max = max == null ? value : Math.max(max, value);
        }
      }
      rows.push(row);
    }

    const finalMin = min ?? 0;
    const finalMax = max ?? 0;

    return { data: rows, min: finalMin, max: finalMax };
  }, [dates, series, mode]);

  const yDomain = useMemo(() => {
    const p = 0.1;
    const R = (1 - p) / p;
    const minData = min;
    const maxData = max;
    if (minData === 0 && maxData === 0) {
      const a = 1;
      return [-a, R * a];
    }
    const yMax = maxData;
    const yMinCandidate = -yMax / R;
    if (minData >= yMinCandidate) {
      return [yMinCandidate, yMax];
    }
    return [minData, yMax];
  }, [min, max]);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2 print:hidden">
        <div className="text-sm text-gray-700 dark:text-gray-300">Excess vs {benchmarkSymbol}</div>
        <div className="inline-flex rounded-md border border-black/10 dark:border-white/15 overflow-hidden">
          <button
            type="button"
            onClick={() => setMode("$")}
            className={`px-3 py-1.5 text-sm ${mode === "$" ? "bg-black text-white dark:bg-white dark:text-black" : "bg-white text-black dark:bg-neutral-900 dark:text-white"}`}
          >
            $
          </button>
          <button
            type="button"
            onClick={() => setMode("%")}
            className={`px-3 py-1.5 text-sm border-l border-black/10 dark:border-white/15 ${mode === "%" ? "bg-black text-white dark:bg-white dark:text-black" : "bg-white text-black dark:bg-neutral-900 dark:text-white"}`}
          >
            %
          </button>
        </div>
      </div>
      <div className="w-full" style={{ height: `${height}px` }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ left: 12, right: 12, top: 8, bottom: 8 }} syncId="excess-returns">
            <CartesianGrid strokeDasharray="3 3" stroke="rgb(0 0 0 / 0.06)" />
            <XAxis dataKey="date" hide tick={{ fontSize: 12 }} />
            <YAxis
              tick={{ fontSize: 12 }}
              domain={[yDomain[0], yDomain[1]]}
              tickFormatter={(v) => (mode === "$" ? `$${Math.round(v as number)}` : `${Math.round(v as number)}%`)}
            />
            {highlightDate ? (
              <ReferenceLine x={highlightDate} stroke="#f59e0b" strokeDasharray="2 2" strokeWidth={2} ifOverflow="extendDomain" />
            ) : null}
            <ReferenceLine
              y={0}
              stroke="rgb(148 163 184 / 0.55)"
              strokeDasharray="4 4"
              label={{ value: zeroLineLabel, position: "left", fill: "#94a3b8", fontSize: 12 }}
            />
            <Tooltip
              formatter={(value: ValueType, name: NameType) => {
                const num = typeof value === "number" ? value : null;
                const display = num == null ? "" : num.toFixed(2);
                return mode === "$" ? [`$${display}`, String(name)] : [`${display}%`, String(name)];
              }}
              labelFormatter={(label) => `${label}`}
            />
            <Legend />
            {series.map((s, index) => (
              <Line
                key={s.symbol}
                type="monotone"
                dataKey={s.symbol}
                dot={false}
                stroke={palette[index % palette.length]}
                strokeWidth={2}
                isAnimationActive={false}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}


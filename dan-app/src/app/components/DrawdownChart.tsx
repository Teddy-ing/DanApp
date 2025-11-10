"use client";

import React, { useMemo } from "react";
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

type Series = { symbol: string; drawdown: Array<number | null> };

type Props = {
  dates: string[];
  series: Series[];
  benchmark?: Series | null;
  height?: number | "full";
  highlightDate?: string | null;
};

export default function DrawdownChart({ dates, series, benchmark, height, highlightDate }: Props) {
  const palette = ["#5B8DEF", "#E66E6E", "#6DD3A8", "#F5C26B", "#B388EB"];

  const benchmarkKey = useMemo(
    () => (benchmark ? `${benchmark.symbol} (benchmark)` : null),
    [benchmark]
  );

  const { data, min, max } = useMemo(() => {
    const rows: Array<Record<string, number | string | null>> = [];
    let minValue: number | null = null;
    let maxValue: number | null = null;

    for (let i = 0; i < dates.length; i += 1) {
      const row: Record<string, number | string | null> = { date: dates[i] };
      for (const s of series) {
        const raw = s.drawdown[i] ?? null;
        const nextVal = typeof raw === "number" && Number.isFinite(raw) ? raw * 100 : null;
        row[s.symbol] = nextVal;
        if (typeof nextVal === "number" && Number.isFinite(nextVal)) {
          minValue = minValue == null ? nextVal : Math.min(minValue, nextVal);
          maxValue = maxValue == null ? nextVal : Math.max(maxValue, nextVal);
        }
      }
      if (benchmark && benchmarkKey) {
        const raw = benchmark.drawdown[i] ?? null;
        const nextVal = typeof raw === "number" && Number.isFinite(raw) ? raw * 100 : null;
        row[benchmarkKey] = nextVal;
        if (typeof nextVal === "number" && Number.isFinite(nextVal)) {
          minValue = minValue == null ? nextVal : Math.min(minValue, nextVal);
          maxValue = maxValue == null ? nextVal : Math.max(maxValue, nextVal);
        }
      }
      rows.push(row);
    }

    return {
      data: rows,
      min: minValue ?? 0,
      max: maxValue ?? 0,
    };
  }, [dates, series, benchmark, benchmarkKey]);

  const yDomain = useMemo(() => {
    const lower = Math.min(min, -1);
    const upper = Math.max(max, 0);
    const padding = Math.max(5, Math.abs(lower) * 0.05);
    return [lower - padding, upper + padding];
  }, [min, max]);

  return (
    <div className="w-full" style={{ height: height === "full" ? "100%" : undefined }}>
      <div className="w-full" style={{ height: height === "full" ? "100%" : `${height ?? 320}px` }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ left: 12, right: 12, top: 8, bottom: 8 }} syncId="sync-returns">
            <CartesianGrid strokeDasharray="3 3" stroke="rgb(0 0 0 / 0.06)" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} minTickGap={32} />
            <YAxis
              tick={{ fontSize: 12 }}
              domain={[yDomain[0], yDomain[1]]}
              tickFormatter={(v) => `${Number(v).toFixed(0)}%`}
            />
            {highlightDate ? (
              <ReferenceLine x={highlightDate} stroke="#f59e0b" strokeDasharray="2 2" strokeWidth={2} ifOverflow="extendDomain" />
            ) : null}
            <ReferenceLine y={0} stroke="rgb(148 163 184 / 0.55)" strokeDasharray="4 4" label={{ value: "0%", position: "left", fill: "#94a3b8", fontSize: 12 }} />
            <Tooltip
              formatter={(value: ValueType, name: NameType) => {
                const num = typeof value === "number" ? value : null;
                const display = num == null ? "" : num.toFixed(2);
                return [`${display}%`, String(name)];
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
            {benchmark && benchmarkKey && (
              <Line
                key={benchmarkKey}
                type="monotone"
                dataKey={benchmarkKey}
                dot={false}
                stroke="#1f2937"
                strokeWidth={2}
                strokeDasharray="6 3"
                isAnimationActive={false}
                connectNulls
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}


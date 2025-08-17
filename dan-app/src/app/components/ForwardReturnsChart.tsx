"use client";

import React, { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';

type Series = { symbol: string; value: Array<number | null>; pct: Array<number | null> };

export default function ForwardReturnsChart(props: { dates: string[]; series: Series[] }) {
  const [mode, setMode] = useState<'$' | '%'>('$');

  const palette = [
    '#5B8DEF',
    '#E66E6E',
    '#6DD3A8',
    '#F5C26B',
    '#B388EB',
  ];

  const data = useMemo(() => {
    const rows: Array<Record<string, number | string | null>> = [];
    const lastIndex = props.dates.length - 1;
    if (lastIndex < 0) return rows;

    // Build rows where each row reflects return from that start date to the final date
    for (let i = 0; i < props.dates.length; i += 1) {
      const row: Record<string, number | string | null> = { date: props.dates[i] };
      for (const s of props.series) {
        const startVal = s.value[i];
        const endVal = s.value[lastIndex];
        if (startVal == null || endVal == null || startVal === 0) {
          row[s.symbol] = null;
          continue;
        }
        if (mode === '$') {
          row[s.symbol] = endVal - startVal;
        } else {
          row[s.symbol] = ((endVal / startVal) - 1) * 100;
        }
      }
      rows.push(row);
    }
    return rows;
  }, [props.dates, props.series, mode]);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-gray-700 dark:text-gray-300">Toggle</div>
        <div className="inline-flex rounded-md border border-black/10 dark:border-white/15 overflow-hidden">
          <button
            type="button"
            onClick={() => setMode('$')}
            className={`px-3 py-1.5 text-sm ${mode === '$' ? 'bg-black text-white dark:bg-white dark:text-black' : 'bg-white text-black dark:bg-neutral-900 dark:text-white'}`}
          >
            $
          </button>
          <button
            type="button"
            onClick={() => setMode('%')}
            className={`px-3 py-1.5 text-sm border-l border-black/10 dark:border-white/15 ${mode === '%' ? 'bg-black text-white dark:bg-white dark:text-black' : 'bg-white text-black dark:bg-neutral-900 dark:text-white'}`}
          >
            %
          </button>
        </div>
      </div>
      <div className="h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ left: 12, right: 12, top: 8, bottom: 8 }} syncId="sync-returns">
            <CartesianGrid strokeDasharray="3 3" stroke="rgb(0 0 0 / 0.06)" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} minTickGap={32} />
            <YAxis
              tick={{ fontSize: 12 }}
              domain={["auto", "auto"]}
              tickFormatter={(v) => (mode === '$' ? `$${Math.round(v as number)}` : `${Math.round(v as number)}%`)}
            />
            <Tooltip
              formatter={(value: ValueType, name: NameType) => {
                const num = typeof value === 'number' ? value : null;
                const display = num == null ? '' : num.toFixed(2);
                return mode === '$' ? [`$${display}`, String(name)] : [`${display}%`, String(name)];
              }}
              labelFormatter={(label) => `${label}`}
            />
            <Legend />
            {props.series.map((s, i) => (
              <Line
                key={s.symbol}
                type="monotone"
                dataKey={s.symbol}
                dot={false}
                stroke={palette[i % palette.length]}
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



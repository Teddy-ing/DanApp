'use client';

import React, { useMemo, useState } from 'react';
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
  ReferenceArea,
} from 'recharts';
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';

type Series = { symbol: string; value: Array<number | null>; pct: Array<number | null> };

export default function ReturnsChart(props: { dates: string[]; series: Series[] }) {
  const [mode, setMode] = useState<'$' | '%'>('$');

  const palette = ['#5B8DEF', '#E66E6E', '#6DD3A8', '#F5C26B', '#B388EB'];

  const { data, min, max, xMin, xMax } = useMemo(() => {
    const rows: Array<Record<string, number | string | null>> = [];
    let min = 0;
    let max = 0;

    for (let i = 0; i < props.dates.length; i += 1) {
      const row: Record<string, number | string | null> = { date: props.dates[i] };
      for (const series of props.series) {
        const rawVal = series.value[i] ?? null;
        const rawPct = series.pct[i] ?? null;
        const nextVal = mode === '$' ? rawVal : (rawPct == null ? null : rawPct * 100);
        const isFiniteNumber = typeof nextVal === 'number' && Number.isFinite(nextVal);
        row[series.symbol] = isFiniteNumber ? nextVal : null;
        if (isFiniteNumber) {
          const value = nextVal as number;
          if (value < min) min = value;
          if (value > max) max = value;
        }
      }
      rows.push(row);
    }

    const xMin = rows[0]?.date as string | undefined;
    const xMax = rows[rows.length - 1]?.date as string | undefined;

    return { data: rows, min, max, xMin, xMax };
  }, [props.dates, props.series, mode]);

  const yDomain = useMemo(() => [Math.min(0, min), Math.max(0, max)], [min, max]);
  const hasDomain = typeof xMin === 'string' && typeof xMax === 'string' && data.length > 0;

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 mb-2">
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
              domain={[yDomain[0], yDomain[1]]}
              tickFormatter={(v) => (mode === '$' ? `$${Math.round(v as number)}` : `${Math.round(v as number)}%`)}
            />
            {hasDomain && max > 0 && (
              <ReferenceArea
                y1={0}
                y2={yDomain[1]}
                x1={xMin}
                x2={xMax}
                fill="#16a34a"
                fillOpacity={0.2}
                strokeOpacity={0}
              />
            )}
            {hasDomain && min < 0 && (
              <ReferenceArea
                y1={yDomain[0]}
                y2={0}
                x1={xMin}
                x2={xMax}
                fill="#dc2626"
                fillOpacity={0.18}
                strokeOpacity={0}
              />
            )}
            <ReferenceLine y={0} stroke="rgb(148 163 184 / 0.55)" strokeDasharray="4 4" />
            <Tooltip
              formatter={(value: ValueType, name: NameType) => {
                const num = typeof value === 'number' ? value : null;
                const display = num == null ? '' : num.toFixed(2);
                return mode === '$' ? [`$${display}`, String(name)] : [`${display}%`, String(name)];
              }}
              labelFormatter={(label) => `${label}`}
            />
            <Legend />
            {props.series.map((series, index) => (
              <Line
                key={series.symbol}
                type="monotone"
                dataKey={series.symbol}
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

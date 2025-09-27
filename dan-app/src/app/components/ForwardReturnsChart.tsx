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
  ReferenceLine,
} from 'recharts';
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';

type Series = { symbol: string; value: Array<number | null>; pct: Array<number | null> };

export default function ForwardReturnsChart(props: { dates: string[]; series: Series[]; base?: number }) {
  const [mode, setMode] = useState<'$' | '%'>('$');

  const palette = ['#5B8DEF', '#E66E6E', '#6DD3A8', '#F5C26B', '#B388EB'];

  const { rows, min, max } = useMemo(() => {
    const rows: Array<Record<string, number | string | null>> = [];
    let min = 0;
    let max = 0;
    const lastIndex = props.dates.length - 1;
    if (lastIndex < 0) return { rows, min, max };

    for (let i = 0; i < props.dates.length; i += 1) {
      const row: Record<string, number | string | null> = { date: props.dates[i] };
      for (const s of props.series) {
        const startVal = s.value[i];
        const endVal = s.value[lastIndex];
        if (startVal == null || endVal == null || startVal === 0) {
          row[s.symbol] = null;
          continue;
        }
        const baseAmount = typeof props.base === 'number' && isFinite(props.base) ? props.base : 1000;
        const rawReturn = endVal / startVal - 1;
        const nextVal = mode === '$' ? baseAmount * rawReturn : rawReturn * 100;
        row[s.symbol] = nextVal;
        if (typeof nextVal === 'number') {
          if (nextVal < min) min = nextVal;
          if (nextVal > max) max = nextVal;
        }
      }
      rows.push(row);
    }
    return { rows, min, max };
  }, [props.dates, props.series, props.base, mode]);

  const yDomain = useMemo(() => [Math.min(0, min), Math.max(0, max)], [min, max]);

  const tintStyle = useMemo(() => {
    if (rows.length === 0) return undefined;
    const plotMargins = { top: 8, right: 12, bottom: 8, left: 12 } as const;
    const baseStyle: React.CSSProperties = {
      pointerEvents: 'none',
      position: 'absolute',
      top: plotMargins.top,
      right: plotMargins.right,
      bottom: plotMargins.bottom,
      left: plotMargins.left,
      borderRadius: 8,
    };
    if (max <= 0) {
      return { ...baseStyle, background: 'rgba(220, 38, 38, 0.32)' };
    }
    if (min >= 0) {
      return { ...baseStyle, background: 'rgba(22, 163, 74, 0.26)' };
    }
    const zeroRatio = max / (max - min);
    const clamp = (value: number) => Math.min(Math.max(value, 0), 1);
    const pct = clamp(zeroRatio) * 100;
    return {
      ...baseStyle,
      background: `linear-gradient(to bottom, rgba(22, 163, 74, 0.26) 0%, rgba(22, 163, 74, 0.26) ${pct}%, rgba(220, 38, 38, 0.32) ${pct}%, rgba(220, 38, 38, 0.32) 100%)`,
    };
  }, [rows.length, min, max]);

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
      <div className="relative h-[320px] w-full">
        {tintStyle && <div style={tintStyle} />}
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ left: 12, right: 12, top: 8, bottom: 8 }} syncId="sync-returns">
            <CartesianGrid strokeDasharray="3 3" stroke="rgb(0 0 0 / 0.06)" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} minTickGap={32} />
            <YAxis
              tick={{ fontSize: 12 }}
              domain={[yDomain[0], yDomain[1]]}
              tickFormatter={(v) => (mode === '$' ? `$${Math.round(v as number)}` : `${Math.round(v as number)}%`)}
            />
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



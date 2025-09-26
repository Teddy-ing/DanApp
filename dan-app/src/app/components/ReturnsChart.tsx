'use client';

import React, { useCallback, useMemo, useState } from 'react';
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
import type { LegendProps } from 'recharts';
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';

type Series = { symbol: string; value: Array<number | null>; pct: Array<number | null> };

export default function ReturnsChart(props: { dates: string[]; series: Series[] }) {
  const [mode, setMode] = useState<'$' | '%'>('$');

  const data = useMemo(() => {
    const rows: Array<Record<string, number | string | null>> = [];
    for (let i = 0; i < props.dates.length; i += 1) {
      const row: Record<string, number | string | null> = { date: props.dates[i] };
      for (const s of props.series) {
        const rawVal = s.value[i] ?? null;
        const rawPct = s.pct[i] ?? null;
        const nextVal = mode === '$' ? rawVal : (rawPct == null ? null : rawPct * 100);
        if (nextVal == null) {
          row[`${s.symbol}__pos`] = null;
          row[`${s.symbol}__neg`] = null;
        } else if (nextVal >= 0) {
          row[`${s.symbol}__pos`] = nextVal;
          row[`${s.symbol}__neg`] = null;
        } else {
          row[`${s.symbol}__pos`] = null;
          row[`${s.symbol}__neg`] = nextVal;
        }
      }
      rows.push(row);
    }
    return rows;
  }, [props.dates, props.series, mode]);

  const legendPayload = useMemo(() => {
    return props.series.map((s) => {
      let color = '#6b7280';
      for (let i = data.length - 1; i >= 0; i -= 1) {
        const posVal = data[i]?.[`${s.symbol}__pos`];
        if (typeof posVal === 'number') {
          color = '#16a34a';
          break;
        }
        const negVal = data[i]?.[`${s.symbol}__neg`];
        if (typeof negVal === 'number') {
          color = '#dc2626';
          break;
        }
      }
      return { value: s.symbol, type: 'square' as const, color };
    });
  }, [data, props.series]);

  const renderLegend = useCallback((legendProps: LegendProps) => {
    if (!legendProps?.payload) return null;
    return (
      <div className="mt-2 flex flex-wrap gap-4 text-sm text-black dark:text-white">
        {legendProps.payload.map((entry) => (
          <span key={entry.value} className="flex items-center gap-2">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: entry.color ?? '#6b7280' }}
            />
            {entry.value}
          </span>
        ))}
      </div>
    );
  }, []);

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
              domain={[(dataMin: number) => Math.min(0, dataMin ?? 0), (dataMax: number) => Math.max(0, dataMax ?? 0)]}
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
            <Legend payload={legendPayload} content={renderLegend} />
            {props.series.map((s) => (
              <React.Fragment key={s.symbol}>
                <Line
                  type="monotone"
                  dataKey={`${s.symbol}__pos`}
                  name={s.symbol}
                  dot={false}
                  stroke="#16a34a"
                  strokeWidth={2}
                  isAnimationActive={false}
                  connectNulls={false}
                  legendType="none"
                />
                <Line
                  type="monotone"
                  dataKey={`${s.symbol}__neg`}
                  name={s.symbol}
                  dot={false}
                  stroke="#dc2626"
                  strokeWidth={2}
                  isAnimationActive={false}
                  connectNulls={false}
                  legendType="none"
                />
              </React.Fragment>
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}



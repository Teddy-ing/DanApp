"use client";

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

type Props = {
  dates: string[];
  series: Series[];
};

export default function ReturnsChart({ dates, series }: Props) {
  const [mode, setMode] = useState<'$' | '%'>('$');
  const zeroLineLabel = mode === '$' ? '$0' : '0%';

  const palette = ['#5B8DEF', '#E66E6E', '#6DD3A8', '#F5C26B', '#B388EB'];

  const { data, min, max, xMin, xMax } = useMemo(() => {
    const rows: Array<Record<string, number | string | null>> = [];
    let min = 0;
    let max = 0;

    for (let i = 0; i < dates.length; i += 1) {
      const row: Record<string, number | string | null> = { date: dates[i] };
      for (const s of series) {
        const rawVal = s.value[i] ?? null;
        const rawPct = s.pct[i] ?? null;
        const nextVal = mode === '$' ? rawVal : (rawPct == null ? null : rawPct * 100);
        const isFiniteNumber = typeof nextVal === 'number' && Number.isFinite(nextVal);
        row[s.symbol] = isFiniteNumber ? nextVal : null;
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
  }, [dates, series, mode]);

  const yDomain = useMemo(() => {
    // Clamped p approach: try to put 0 at p=0.1 from bottom without inflating the top.
    const p = 0.1;
    const R = (1 - p) / p; // 9 when p = 0.1
    const minData = min;
    const maxData = max;
    if (minData === 0 && maxData === 0) {
      const a = 1; // minimal range
      return [-a, R * a];
    }
    // Keep yMax anchored to data; only deepen yMin as needed.
    const yMax = maxData;
    const yMinCandidate = -yMax / R;
    if (minData >= yMinCandidate) {
      // Can keep 0 at exactly p
      return [yMinCandidate, yMax];
    }
    // Negative data exceeds candidate; include it and accept 0 above p.
    return [minData, yMax];
  }, [min, max]);
  const hasDomain = typeof xMin === 'string' && typeof xMax === 'string' && data.length > 0;

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 mb-2 print:hidden">
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
            {hasDomain && (
              <>
                {yDomain[1] <= 0 ? (
                  <ReferenceArea
                    y1={yDomain[0]}
                    y2={yDomain[1]}
                    x1={xMin}
                    x2={xMax}
                    fill="#dc2626"
                    fillOpacity={0.10}
                    strokeOpacity={0}
                    ifOverflow="visible"
                  />
                ) : yDomain[0] >= 0 ? (
                  <ReferenceArea
                    y1={yDomain[0]}
                    y2={yDomain[1]}
                    x1={xMin}
                    x2={xMax}
                    fill="#16a34a"
                    fillOpacity={0.10}
                    strokeOpacity={0}
                    ifOverflow="visible"
                  />
                ) : (
                  <>
                    <ReferenceArea
                      y1={0}
                      y2={yDomain[1]}
                      x1={xMin}
                      x2={xMax}
                      fill="#16a34a"
                      fillOpacity={0.10}
                      strokeOpacity={0}
                      ifOverflow="visible"
                    />
                    <ReferenceArea
                      y1={yDomain[0]}
                      y2={0}
                      x1={xMin}
                      x2={xMax}
                      fill="#dc2626"
                      fillOpacity={0.10}
                      strokeOpacity={0}
                      ifOverflow="visible"
                    />
                  </>
                )}
              </>
            )}
            <ReferenceLine y={0} stroke="rgb(148 163 184 / 0.55)" strokeDasharray="4 4" label={{ value: zeroLineLabel, position: 'left', fill: '#94a3b8', fontSize: 12 }} />
            <Tooltip
              formatter={(value: ValueType, name: NameType) => {
                const num = typeof value === 'number' ? value : null;
                const display = num == null ? '' : num.toFixed(2);
                return mode === '$' ? [`$${display}`, String(name)] : [`${display}%`, String(name)];
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

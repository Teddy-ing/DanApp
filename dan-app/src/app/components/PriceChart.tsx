'use client';

import React, { useMemo } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';

type Candle = { date: string; open: number; high: number; low: number; close: number; volume: number };

export default function PriceChart(props: { items: Array<{ symbol: string; candles: Candle[] }> }) {
  const palette = ['#5B8DEF', '#E66E6E', '#6DD3A8', '#F5C26B', '#B388EB'];

  const merged = useMemo(() => {
    // Merge by date; use close price
    const map = new Map<string, Record<string, number | string | null>>();
    for (const item of props.items) {
      for (const c of item.candles) {
        const key = c.date;
        if (!map.has(key)) map.set(key, { date: key });
        map.get(key)![item.symbol] = c.close;
      }
    }
    const rows = Array.from(map.values());
    rows.sort((a, b) => String(a.date).localeCompare(String(b.date)));
    return rows;
  }, [props.items]);

  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={merged} margin={{ left: 12, right: 12, top: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgb(0 0 0 / 0.06)" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} minTickGap={32} />
          <YAxis tick={{ fontSize: 12 }} domain={['auto', 'auto']} />
          <Tooltip />
          <Legend />
          {props.items.map((s, i) => (
            <Line
              key={s.symbol}
              type="monotone"
              dataKey={s.symbol}
              dot={false}
              stroke={palette[i % palette.length]}
              strokeWidth={1.5}
              isAnimationActive={false}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}



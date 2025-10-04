"use client";

import React, { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import ReturnsChart from "@/app/components/ReturnsChart";
import PriceChart from "@/app/components/PriceChart";
import ForwardReturnsChart from "@/app/components/ForwardReturnsChart";
import ChartLightbox from "@/app/components/ChartLightbox";

export type Horizon = "5y" | "max";
export type CustomRange = { enabled: boolean; start: string; end: string };

export default function ReturnsView(props: {
  symbols: string[];
  base: number;
  horizon: Horizon;
  custom: CustomRange;
  onLightboxOpenChange?: (open: boolean) => void;
}) {
  const { symbols, base, horizon, custom, onLightboxOpenChange } = props;
  const [lightbox, setLightbox] = React.useState<{ open: boolean; which: 'forward' | 'returns' | 'price' | null }>({ open: false, which: null });
  useEffect(() => {
    if (typeof onLightboxOpenChange === 'function') onLightboxOpenChange(lightbox.open);
  }, [lightbox.open, onLightboxOpenChange]);
  const queryKey = useMemo(() => ["returns", { symbols, base, horizon, custom }], [symbols, base, horizon, custom]);
  const enabled = symbols.length > 0;

  const amountDisplay = useMemo(() => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(base), [base]);
  const symbolsDisplay = useMemo(() => symbols.join(", "), [symbols]);

  const returnsQuery = useQuery({
    queryKey,
    enabled,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("symbols", symbols.join(","));
      params.set("horizon", horizon);
      params.set("base", String(base));
      if (typeof document !== "undefined" && custom.enabled) {
        const nowSec = Math.floor(Date.now() / 1000);
        const start = custom.start ? Math.floor(new Date(custom.start + "T00:00:00Z").getTime() / 1000) : undefined;
        const end = custom.end ? Math.floor(new Date(custom.end + "T23:59:59Z").getTime() / 1000) : nowSec;
        if (start) {
          params.set("period1", String(start));
          params.set("period2", String(end));
        }
      }
      const res = await fetch(`/api/returns?${params.toString()}`, { headers: { "accept-encoding": "gzip" }, cache: "no-store" });
      const text = await res.text();
      const data = JSON.parse(text);
      if (!res.ok) throw new Error(data?.error?.message || "Request failed");
      return data as { dates: string[]; series: Array<{ symbol: string; value: (number|null)[]; pct: (number|null)[] }>; };
    },
  });

  const pricesQuery = useQuery({
    queryKey: ["prices", { symbols, horizon, custom }],
    enabled: returnsQuery.isSuccess,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("symbols", symbols.join(","));
      params.set("range", horizon);
      if (typeof document !== "undefined" && custom.enabled) {
        const nowSec = Math.floor(Date.now() / 1000);
        const start = custom.start ? Math.floor(new Date(custom.start + "T00:00:00Z").getTime() / 1000) : undefined;
        const end = custom.end ? Math.floor(new Date(custom.end + "T23:59:59Z").getTime() / 1000) : nowSec;
        if (start) {
          params.set("period1", String(start));
          params.set("period2", String(end));
        }
      }
      const res = await fetch(`/api/prices?${params.toString()}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "Prices request failed");
      return data as { items: Array<{ symbol: string; candles: Array<{ dateUtcSeconds?: number; date?: number; close?: number|null }> }> };
    },
  });


  return (
    <div className="w-full max-w-5xl mx-auto">
      {!lightbox.open && (
      <div className="text-sm mb-2">
        {returnsQuery.isLoading && <span>Loading…</span>}
        {returnsQuery.error && <span className="text-red-600 dark:text-red-400">{(returnsQuery.error as Error).message}</span>}
        {returnsQuery.isSuccess && (
          <span className="text-gray-700 dark:text-gray-300">Loaded {returnsQuery.data.dates.length} dates for {returnsQuery.data.series.length} symbols.</span>
        )}
      </div>
      )}
      {!lightbox.open && returnsQuery.isSuccess && (
        <div className="mb-6">
          <div className="text-sm mb-2">Returns from each date shown to the present (including reinvested dividends)</div>
          <div onDoubleClick={() => setLightbox({ open: true, which: 'forward' })}>
            <ForwardReturnsChart dates={returnsQuery.data.dates} series={returnsQuery.data.series} base={base} />
          </div>
        </div>
      )}
      {!lightbox.open && returnsQuery.isSuccess && (
        <div className="mb-6">
          <div className="text-sm mb-2">{`Total Return at the present from ${amountDisplay} invested ${symbols.length > 1 ? `in each of ${symbolsDisplay}` : `in ${symbolsDisplay}`} at ${returnsQuery.data.dates[0]}`}</div>
          <div onDoubleClick={() => setLightbox({ open: true, which: 'returns' })}>
            <ReturnsChart dates={returnsQuery.data.dates} series={returnsQuery.data.series} />
          </div>
        </div>
      )}
      {!lightbox.open && pricesQuery.isSuccess && (
        <div>
          <div className="text-sm mb-2">{symbols.length > 1 ? `Prices of ${symbolsDisplay}` : `Price of ${symbolsDisplay}`}</div>
          <div onDoubleClick={() => setLightbox({ open: true, which: 'price' })}>
          <PriceChart
            items={pricesQuery.data.items.map((i) => ({
              symbol: i.symbol,
              candles: i.candles.map((c) => ({
                dateUtcSeconds: typeof c.dateUtcSeconds === 'number' ? c.dateUtcSeconds : (typeof c.date === 'number' ? c.date : 0),
                close: typeof c.close === 'number' ? c.close : null,
              })),
            }))}
          />
          </div>
        </div>
      )}
      <ChartLightbox
        open={lightbox.open}
        onClose={() => setLightbox({ open: false, which: null })}
        title={lightbox.which === 'forward' ? 'Forward Returns' : lightbox.which === 'returns' ? 'Returns' : lightbox.which === 'price' ? 'Price' : undefined}
        subtitle={symbolsDisplay}
      >
        {lightbox.which === 'forward' && returnsQuery.isSuccess && (
          <ForwardReturnsChart dates={returnsQuery.data.dates} series={returnsQuery.data.series} base={base} />
        )}
        {lightbox.which === 'returns' && returnsQuery.isSuccess && (
          <ReturnsChart dates={returnsQuery.data.dates} series={returnsQuery.data.series} />
        )}
        {lightbox.which === 'price' && pricesQuery.isSuccess && (
          <PriceChart
            items={pricesQuery.data.items.map((i) => ({
              symbol: i.symbol,
              candles: i.candles.map((c) => ({
                dateUtcSeconds: typeof c.dateUtcSeconds === 'number' ? c.dateUtcSeconds : (typeof c.date === 'number' ? c.date : 0),
                close: typeof c.close === 'number' ? c.close : null,
              })),
            }))}
          />
        )}
      </ChartLightbox>
    </div>
  );
}



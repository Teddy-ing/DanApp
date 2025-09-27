"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import ReturnsChart from "@/app/components/ReturnsChart";
import PriceChart from "@/app/components/PriceChart";
import ForwardReturnsChart from "@/app/components/ForwardReturnsChart";

export type Horizon = "5y" | "max";
export type CustomRange = { enabled: boolean; start: string; end: string };

export default function ReturnsView(props: {
  symbols: string[];
  base: number;
  horizon: Horizon;
  custom: CustomRange;
}) {
  const { symbols, base, horizon, custom } = props;
  const queryKey = useMemo(() => ["returns", { symbols, base, horizon, custom }], [symbols, base, horizon, custom]);
  const enabled = symbols.length > 0;

  const amountDisplay = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: Number.isInteger(base) ? 0 : 2,
        maximumFractionDigits: Number.isInteger(base) ? 0 : 2,
      }).format(base),
    [base],
  );
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
      <div className="text-sm mb-2">
        {returnsQuery.isLoading && <span>Loading…</span>}
        {returnsQuery.error && <span className="text-red-600 dark:text-red-400">{(returnsQuery.error as Error).message}</span>}
        {returnsQuery.isSuccess && (
          <span className="text-gray-700 dark:text-gray-300">Loaded {returnsQuery.data.dates.length} dates for {returnsQuery.data.series.length} symbols.</span>
        )}
      </div>
      {returnsQuery.isSuccess && (
        <div className="mb-6">
          <div className="text-sm mb-2">Returns from each start date to present (incl. dividends)</div>
          <ForwardReturnsChart dates={returnsQuery.data.dates} series={returnsQuery.data.series} base={base} />
        </div>
      )}
      {returnsQuery.isSuccess && (
        <div className="mb-6">
          <div className="text-sm mb-2">Returns from {amountDisplay} in {symbolsDisplay} at {returnsQuery.data.dates[0]}</div>
          <ReturnsChart dates={returnsQuery.data.dates} series={returnsQuery.data.series} />
        </div>
      )}
      {pricesQuery.isSuccess && (
        <div>
          <div className="text-sm mb-2">Price of {symbolsDisplay}</div>
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
      )}
    </div>
  );
}



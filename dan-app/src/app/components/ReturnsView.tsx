"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import ReturnsChart from "@/app/components/ReturnsChart";
import PriceChart from "@/app/components/PriceChart";

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

  const amountDisplay = useMemo(() => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(base), [base]);
  const symbolsDisplay = useMemo(() => symbols.join(", "), [symbols]);
  const usdFormatter = useMemo(() => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }), []);

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
      await new Promise((r) => setTimeout(r, 800));
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

  const dividendsQuery = useQuery({
    queryKey: ["dividends", { symbols, horizon, custom }],
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
      const res = await fetch(`/api/dividends?${params.toString()}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "Dividends request failed");
      return data as { items: Array<{ symbol: string; range: string; dividends: Array<{ dateIso: string; amount: number }> }> };
    },
  });

  const [expandedSymbols, setExpandedSymbols] = useState<Record<string, boolean>>({});
  const toggleExpanded = (symbol: string) => {
    setExpandedSymbols((prev) => ({ ...prev, [symbol]: !prev[symbol] }));
  };

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
          <div className="text-sm mb-2">Returns from {amountDisplay} in {symbolsDisplay} at {returnsQuery.data.dates[0]}</div>
          <ReturnsChart dates={returnsQuery.data.dates} series={returnsQuery.data.series} />
        </div>
      )}
      {dividendsQuery.isLoading && (
        <div className="text-sm mb-4">Loading dividends…</div>
      )}
      {dividendsQuery.error && (
        <div className="text-sm text-red-600 dark:text-red-400 mb-4">{(dividendsQuery.error as Error).message}</div>
      )}
      {dividendsQuery.isSuccess && dividendsQuery.data.items.length > 0 && (
        <div className="mb-6">
          <div className="text-sm mb-2">Dividends</div>
          <div className="space-y-3">
            {dividendsQuery.data.items.map((item) => {
              const sorted = [...(item.dividends || [])].sort((a, b) => String(b.dateIso).localeCompare(String(a.dateIso)));
              const isExpanded = Boolean(expandedSymbols[item.symbol]);
              const visible = isExpanded ? sorted : sorted.slice(0, 20);
              const hasMore = sorted.length > 20;
              return (
                <div key={item.symbol}>
                  <div className="text-sm font-medium mb-1">{item.symbol}</div>
                  <ul className="text-sm text-gray-700 dark:text-gray-300">
                    {visible.map((d) => (
                      <li key={`${item.symbol}-${d.dateIso}-${d.amount}`} className="flex items-center justify-between py-0.5">
                        <span>{d.dateIso}</span>
                        <span>{usdFormatter.format(d.amount)}</span>
                      </li>
                    ))}
                  </ul>
                  {hasMore && (
                    <button
                      type="button"
                      onClick={() => toggleExpanded(item.symbol)}
                      className="mt-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {isExpanded ? "Show less" : `Show more (${sorted.length - 20} more)`}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
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



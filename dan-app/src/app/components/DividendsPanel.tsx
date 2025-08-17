"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

type Horizon = "5y" | "max";
type CustomRange = { enabled: boolean; start: string; end: string };

export default function DividendsPanel(props: { symbols: string[]; horizon: Horizon; custom: CustomRange }) {
  const { symbols, horizon, custom } = props;
  const enabled = symbols.length > 0;

  const usdFormatter = useMemo(() => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }), []);

  const dividendsQuery = useQuery({
    queryKey: ["dividends", { symbols, horizon, custom }],
    enabled,
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
    <section className="w-full rounded-xl border border-black/10 dark:border-white/15 p-4 sm:p-5 bg-white dark:bg-neutral-900">
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-medium">Dividends</h3>
        {dividendsQuery.isLoading && <div className="text-sm">Loading…</div>}
        {dividendsQuery.error && (
          <div className="text-sm text-red-600 dark:text-red-400">{(dividendsQuery.error as Error).message}</div>
        )}
        {dividendsQuery.isSuccess && dividendsQuery.data.items.length === 0 && (
          <div className="text-sm text-gray-600 dark:text-gray-400">No dividends in range.</div>
        )}
        {dividendsQuery.isSuccess && dividendsQuery.data.items.length > 0 && (
          <div className="space-y-3">
            {dividendsQuery.data.items.map((item) => {
              const sorted = [...(item.dividends || [])].sort((a, b) => String(b.dateIso).localeCompare(String(a.dateIso)));
              const isExpanded = Boolean(expandedSymbols[item.symbol]);
              const visible = isExpanded ? sorted : sorted.slice(0, 20);
              const hasMore = sorted.length > 20;
              return (
                <div key={item.symbol}>
                  <div className="text-sm mb-1">{item.symbol}</div>
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
        )}
      </div>
    </section>
  );
}



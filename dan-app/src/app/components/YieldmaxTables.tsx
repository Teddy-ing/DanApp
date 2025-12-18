"use client";

import type { ReactNode } from "react";
import { useQuery } from '@tanstack/react-query';

type RateInfo = { value: number | null; overMonths?: number };
type YieldmaxTicker = { symbol: string; name: string; roc: number | null; rate: RateInfo };
type YieldmaxCategory = { title: string; items: YieldmaxTicker[] };
type ApiResponse = {
  fetchedAtIso: string;
  source: { fromCache: boolean; warning?: string };
  rateErrors?: string[];
  categories: YieldmaxCategory[];
};

export default function YieldmaxTables() {
  const query = useQuery<ApiResponse>({
    queryKey: ["yieldmax"],
    queryFn: async () => {
      const res = await fetch("/api/yieldmax", { cache: "no-store" });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to load YieldMax data");
      }
      return res.json();
    },
  });

  if (query.isLoading) {
    return (
      <div className="rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-neutral-900 shadow-sm p-6">
        <p className="text-sm text-gray-600 dark:text-gray-300">Loading YieldMax data…</p>
      </div>
    );
  }

  if (query.error || !query.data) {
    return (
      <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/60 p-4 text-sm text-red-800 dark:text-red-200">
        Unable to load YieldMax data right now. Please try again in a moment.
      </div>
    );
  }

  const { categories, source, rateErrors } = query.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 text-sm text-gray-600 dark:text-gray-300">
        <p>Data refreshed on demand from YieldMax (ROC) and Yahoo Finance (rate).</p>
        {source.warning ? (
          <p className="text-amber-700 dark:text-amber-300">Note: {source.warning}</p>
        ) : null}
        {rateErrors && rateErrors.length > 0 ? (
          <p className="text-amber-700 dark:text-amber-300">
            Some rate lookups failed: {rateErrors.slice(0, 3).join("; ")}
            {rateErrors.length > 3 ? "…" : ""}
          </p>
        ) : null}
      </div>
      <div className="space-y-6">
        {categories.map((category) => (
          <section key={category.title} className="rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-neutral-900 shadow-sm">
            <div className="px-4 py-3 border-b border-black/10 dark:border-white/15">
              <h2 className="text-lg font-semibold">{category.title}</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 dark:bg-neutral-800">
                  <tr className="text-left text-gray-700 dark:text-gray-200">
                    <th className="px-4 py-2">Ticker</th>
                    <th className="px-4 py-2">ETF Name</th>
                    <th className="px-4 py-2">Rate (1y or max available)</th>
                    <th className="px-4 py-2">ROC</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/10 dark:divide-white/10">
                  {category.items.map((item) => (
                    <tr key={item.symbol} className="text-gray-900 dark:text-gray-100">
                      <td className="px-4 py-2 font-semibold">{item.symbol}</td>
                      <td className="px-4 py-2">{item.name}</td>
                      <td className="px-4 py-2">
                        {renderRate(item.rate)}
                      </td>
                      <td className="px-4 py-2">{renderPercent(item.roc)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function renderPercent(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "N/A";
  return `${value.toFixed(2)}%`;
}

function renderRate(rate: RateInfo): ReactNode {
  if (rate.value == null || !Number.isFinite(rate.value)) return <span>N/A</span>;
  return (
    <div className="flex flex-col">
      <span>{rate.value.toFixed(2)}%</span>
      {rate.overMonths && rate.overMonths < 12 ? (
        <span className="text-xs text-gray-600 dark:text-gray-400">Rate over {rate.overMonths} months</span>
      ) : null}
    </div>
  );
}


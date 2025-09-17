'use client';

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

type Horizon = "5y" | "max";
type CustomRange = { enabled: boolean; start: string; end: string };

type StatsBucket = {
  close: number | null;
  intradayVariation: number | null;
  returnsFrom: { d1: number | null; d5: number | null; d10: number | null; d15: number | null; d20: number | null; d40: number | null; d60: number | null; d90: number | null };
};

type StatsAgg = {
  average?: StatsBucket;
  min: StatsBucket;
  max: StatsBucket;
  std: StatsBucket;
  var: StatsBucket;
};

type SymbolStats = {
  current: StatsBucket;
  lastYear: StatsAgg;
  allTime: StatsAgg;
};

export default function StatsPanel(props: { symbols: string[]; horizon: Horizon; custom: CustomRange }) {
  const { symbols, horizon, custom } = props;
  const enabled = symbols.length > 0;

  const pct = (v: number | null) => (v == null ? "—" : `${(v * 100).toFixed(1)}%`);
  const usd = useMemo(() => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }), []);

  const query = useQuery({
    queryKey: ["stats", { symbols, horizon, custom }],
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
      const res = await fetch(`/api/stats?${params.toString()}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "Stats request failed");
      return data as { items: Array<{ symbol: string; stats: SymbolStats }> };
    },
  });

  return (
    <section className="w-full rounded-xl border border-black/10 dark:border-white/15 p-4 sm:p-5 bg-white dark:bg-neutral-900">
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-medium">Stats</h3>
        {query.isLoading && <div className="text-sm">Loading…</div>}
        {query.error && <div className="text-sm text-red-600 dark:text-red-400">{(query.error as Error).message}</div>}
        {query.isSuccess && query.data.items.map((it) => (
          <div key={it.symbol} className="">
            <div className="text-sm mb-1">{it.symbol}</div>
            <table className="w-full text-sm border-collapse table-fixed border border-black/10 dark:border-white/15">
              <thead>
                <tr>
                  <th className="text-left pr-4 py-1 border border-black/10 dark:border-white/15"></th>
                  <th className="text-right pr-3 py-1 w-[12%] border border-black/10 dark:border-white/15">Close</th>
                  <th className="text-right pr-3 py-1 w-[14%] border border-black/10 dark:border-white/15">Intraday Var</th>
                  <th className="text-right pr-3 py-1 w-[12%] border border-black/10 dark:border-white/15">Ret 1d</th>
                  <th className="text-right pr-3 py-1 w-[12%] border border-black/10 dark:border-white/15">Ret 5d</th>
                  <th className="text-right pr-3 py-1 w-[12%] border border-black/10 dark:border-white/15">Ret 10d</th>
                  <th className="text-right pr-3 py-1 w-[12%] border border-black/10 dark:border-white/15">Ret 15d</th>
                  <th className="text-right pr-3 py-1 w-[12%] border border-black/10 dark:border-white/15">Ret 20d</th>
                  <th className="text-right pr-3 py-1 w-[12%] border border-black/10 dark:border-white/15">Ret 40d</th>
                  <th className="text-right pr-3 py-1 w-[12%] border border-black/10 dark:border-white/15">Ret 60d</th>
                  <th className="text-right pr-0 py-1 w-[12%] border border-black/10 dark:border-white/15">Ret 90d</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="pr-4 py-1 border border-black/10 dark:border-white/15">CURRENT</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{it.stats.current.close == null ? "—" : usd.format(it.stats.current.close)}</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.current.intradayVariation)}</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.current.returnsFrom.d1)}</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.current.returnsFrom.d5)}</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.current.returnsFrom.d10)}</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.current.returnsFrom.d15)}</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.current.returnsFrom.d20)}</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.current.returnsFrom.d40)}</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.current.returnsFrom.d60)}</td>
                  <td className="text-right pr-0 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.current.returnsFrom.d90)}</td>
                </tr>
                <tr>
                  <td className="pr-4 py-1 border border-black/10 dark:border-white/15">Average last year</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{it.stats.lastYear.average?.close == null ? "—" : usd.format(it.stats.lastYear.average.close)}</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.lastYear.average?.intradayVariation ?? null)}</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.lastYear.average?.returnsFrom.d1 ?? null)}</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.lastYear.average?.returnsFrom.d5 ?? null)}</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.lastYear.average?.returnsFrom.d10 ?? null)}</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.lastYear.average?.returnsFrom.d15 ?? null)}</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.lastYear.average?.returnsFrom.d20 ?? null)}</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.lastYear.average?.returnsFrom.d40 ?? null)}</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.lastYear.average?.returnsFrom.d60 ?? null)}</td>
                  <td className="text-right pr-0 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.lastYear.average?.returnsFrom.d90 ?? null)}</td>
                </tr>
                <tr>
                  <td className="pr-4 py-1 border border-black/10 dark:border-white/15">MIN last year</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{it.stats.lastYear.min.close == null ? "—" : usd.format(it.stats.lastYear.min.close)}</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.lastYear.min.intradayVariation)}</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.lastYear.min.returnsFrom.d1)}</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.lastYear.min.returnsFrom.d5)}</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.lastYear.min.returnsFrom.d10)}</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.lastYear.min.returnsFrom.d15)}</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.lastYear.min.returnsFrom.d20)}</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.lastYear.min.returnsFrom.d40)}</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.lastYear.min.returnsFrom.d60)}</td>
                  <td className="text-right pr-0 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.lastYear.min.returnsFrom.d90)}</td>
                </tr>
                <tr>
                  <td className="pr-4 py-1 border border-black/10 dark:border-white/15">MAX last year</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{it.stats.lastYear.max.close == null ? "—" : usd.format(it.stats.lastYear.max.close)}</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.lastYear.max.intradayVariation)}</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.lastYear.max.returnsFrom.d1)}</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.lastYear.max.returnsFrom.d5)}</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.lastYear.max.returnsFrom.d10)}</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.lastYear.max.returnsFrom.d15)}</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.lastYear.max.returnsFrom.d20)}</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.lastYear.max.returnsFrom.d40)}</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.lastYear.max.returnsFrom.d60)}</td>
                  <td className="text-right pr-0 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.lastYear.max.returnsFrom.d90)}</td>
                </tr>
                <tr>
                  <td className="pr-4 py-1 border border-black/10 dark:border-white/15">STD last year</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{it.stats.lastYear.std.close == null ? "—" : usd.format(it.stats.lastYear.std.close)}</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.lastYear.std.intradayVariation)}</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.lastYear.std.returnsFrom.d1)}</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.lastYear.std.returnsFrom.d5)}</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.lastYear.std.returnsFrom.d10)}</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.lastYear.std.returnsFrom.d15)}</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.lastYear.std.returnsFrom.d20)}</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.lastYear.std.returnsFrom.d40)}</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.lastYear.std.returnsFrom.d60)}</td>
                  <td className="text-right pr-0 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.lastYear.std.returnsFrom.d90)}</td>
                </tr>
                <tr>
                  <td className="pr-4 py-1 border border-black/10 dark:border-white/15">VAR last year</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{it.stats.lastYear.var.close == null ? "—" : usd.format(it.stats.lastYear.var.close)}</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.lastYear.var.intradayVariation)}</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.lastYear.var.returnsFrom.d1)}</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.lastYear.var.returnsFrom.d5)}</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.lastYear.var.returnsFrom.d10)}</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.lastYear.var.returnsFrom.d15)}</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.lastYear.var.returnsFrom.d20)}</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.lastYear.var.returnsFrom.d40)}</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.lastYear.var.returnsFrom.d60)}</td>
                  <td className="text-right pr-0 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.lastYear.var.returnsFrom.d90)}</td>
                </tr>
                <tr>
                  <td className="pr-4 py-1 border border-black/10 dark:border-white/15">MIN all time</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{it.stats.allTime.min.close == null ? "—" : usd.format(it.stats.allTime.min.close)}</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.allTime.min.intradayVariation)}</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.allTime.min.returnsFrom.d1)}</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.allTime.min.returnsFrom.d5)}</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.allTime.min.returnsFrom.d10)}</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.allTime.min.returnsFrom.d15)}</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.allTime.min.returnsFrom.d20)}</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.allTime.min.returnsFrom.d40)}</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.allTime.min.returnsFrom.d60)}</td>
                  <td className="text-right pr-0 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.allTime.min.returnsFrom.d90)}</td>
                </tr>
                <tr>
                  <td className="pr-4 py-1 border border-black/10 dark:border-white/15">MAX all time</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{it.stats.allTime.max.close == null ? "—" : usd.format(it.stats.allTime.max.close)}</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.allTime.max.intradayVariation)}</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.allTime.max.returnsFrom.d1)}</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.allTime.max.returnsFrom.d5)}</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.allTime.max.returnsFrom.d10)}</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.allTime.max.returnsFrom.d15)}</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.allTime.max.returnsFrom.d20)}</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.allTime.max.returnsFrom.d40)}</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.allTime.max.returnsFrom.d60)}</td>
                  <td className="text-right pr-0 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.allTime.max.returnsFrom.d90)}</td>
                </tr>
                <tr>
                  <td className="pr-4 py-1 border border-black/10 dark:border-white/15">STD all time</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{it.stats.allTime.std.close == null ? "—" : usd.format(it.stats.allTime.std.close)}</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.allTime.std.intradayVariation)}</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.allTime.std.returnsFrom.d1)}</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.allTime.std.returnsFrom.d5)}</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.allTime.std.returnsFrom.d10)}</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.allTime.std.returnsFrom.d15)}</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.allTime.std.returnsFrom.d20)}</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.allTime.std.returnsFrom.d40)}</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.allTime.std.returnsFrom.d60)}</td>
                  <td className="text-right pr-0 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.allTime.std.returnsFrom.d90)}</td>
                </tr>
                <tr>
                  <td className="pr-4 py-1 border border-black/10 dark:border-white/15">VAR all time</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{it.stats.allTime.var.close == null ? "—" : usd.format(it.stats.allTime.var.close)}</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.allTime.var.intradayVariation)}</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.allTime.var.returnsFrom.d1)}</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.allTime.var.returnsFrom.d5)}</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.allTime.var.returnsFrom.d10)}</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.allTime.var.returnsFrom.d15)}</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.allTime.var.returnsFrom.d20)}</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.allTime.var.returnsFrom.d40)}</td>
                  <td className="text-right pr-3 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.allTime.var.returnsFrom.d60)}</td>
                  <td className="text-right pr-0 py-1 border border-black/10 dark:border-white/15">{pct(it.stats.allTime.var.returnsFrom.d90)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ))}
        {query.isSuccess && (
          <div className="mt-4 rounded-xl border border-black/10 dark:border-white/15 p-4 sm:p-5 bg-white dark:bg-neutral-900">
            <div className="text-sm font-medium mb-2">Definitions</div>
            <ul className="text-sm text-gray-700 dark:text-gray-300 list-disc pl-5 space-y-1">
              <li><span className="font-medium">Close</span>: latest available daily close (falls back to adjusted close if needed).</li>
              <li><span className="font-medium">Intraday Var</span>: (high − low) ÷ close for each day, shown as a percentage. Aggregations summarize this per-day series.</li>
              <li><span className="font-medium">Ret Nd</span>: percentage change of close from N trading days earlier: close[t] ÷ close[t−N] − 1.</li>
              <li><span className="font-medium">CURRENT</span>: most recent values in the series (today/last trading day).</li>
              <li><span className="font-medium">Average last year</span>: mean of the last ~255 trading days.</li>
              <li><span className="font-medium">MIN/ MAX last year</span>: minimum/maximum within the last ~255 trading days.</li>
              <li><span className="font-medium">STD last year</span>: population standard deviation over the last ~255 trading days.</li>
              <li><span className="font-medium">VAR last year</span>: population variance over the last ~255 trading days.</li>
              <li><span className="font-medium">MIN/ MAX all time</span>: minimum/maximum across all loaded data for the selected range.</li>
              <li><span className="font-medium">STD/ VAR all time</span>: population standard deviation/variance across all loaded data for the selected range.</li>
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}



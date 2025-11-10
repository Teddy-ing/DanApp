"use client";

import React, { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import ReturnsChart from "@/app/components/ReturnsChart";
import PriceChart from "@/app/components/PriceChart";
import ForwardReturnsChart from "@/app/components/ForwardReturnsChart";
import ChartLightbox from "@/app/components/ChartLightbox";
import ExcessMiniChart from "@/app/components/ExcessMiniChart";
import DrawdownChart from "@/app/components/DrawdownChart";
import MonthlyHeatmap from "@/app/components/MonthlyHeatmap";
import ReturnsHistogram from "@/app/components/ReturnsHistogram";
import { buildMonthlyAnalytics, type HeatmapHorizon } from "@/lib/monthlyAnalytics";

export type Horizon = "5y" | "max";
export type CustomRange = { enabled: boolean; start: string; end: string };

type ReturnsSeries = { symbol: string; value: (number | null)[]; pct: (number | null)[]; drawdown: (number | null)[] };
type ExcessSeries = { symbol: string; value: (number | null)[]; pct: (number | null)[] };
type ReturnsResponse = {
  meta: { symbols: string[]; base: number; horizon: Horizon; benchmark?: string | null };
  dates: string[];
  series: ReturnsSeries[];
  benchmark: ReturnsSeries | null;
  excess: ExcessSeries[];
};

export default function ReturnsView(props: {
  symbols: string[];
  base: number;
  horizon: Horizon;
  custom: CustomRange;
  onLightboxOpenChange?: (open: boolean) => void;
}) {
  const { symbols, base, horizon, custom, onLightboxOpenChange } = props;
  const [lightbox, setLightbox] = React.useState<{ open: boolean; which: 'forward' | 'returns' | 'drawdown' | 'price' | null }>({ open: false, which: null });
  const wasOpenRef = React.useRef<boolean>(false);
  const [heatmapHorizon, setHeatmapHorizon] = React.useState<HeatmapHorizon>("5y");
  const [metricMode, setMetricMode] = React.useState<"return" | "excess">("return");
  const [selectedSymbol, setSelectedSymbol] = React.useState<string | null>(null);
  const [highlightDate, setHighlightDate] = React.useState<string | null>(null);
  const [hoverState, updateHoverState] = React.useState<{ key: string; value: Set<string> | null }>({ key: "", value: null });
  useEffect(() => {
    if (typeof onLightboxOpenChange === 'function') onLightboxOpenChange(lightbox.open);
    wasOpenRef.current = wasOpenRef.current || lightbox.open;
    return () => {
      if (wasOpenRef.current && typeof onLightboxOpenChange === 'function') onLightboxOpenChange(false);
    };
  }, [lightbox.open, onLightboxOpenChange]);
  useEffect(() => {
    if (lightbox.open && lightbox.which == null) {
      setLightbox((prev) => ({ ...prev, which: 'returns' }));
    }
  }, [lightbox.open, lightbox.which]);
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
      return data as ReturnsResponse;
    },
  });

  useEffect(() => {
    if (!returnsQuery.isSuccess) return;
    const primarySymbol = returnsQuery.data.series[0]?.symbol ?? null;
    setSelectedSymbol((prev) => {
      if (prev && returnsQuery.data.series.some((series) => series.symbol === prev)) return prev;
      return primarySymbol;
    });
    if (!returnsQuery.data.benchmark && metricMode === "excess") {
      setMetricMode("return");
    }
  }, [returnsQuery.data, returnsQuery.isSuccess, metricMode]);

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

  const monthlyAnalytics = useMemo(() => {
    if (!returnsQuery.isSuccess) return null;
    return buildMonthlyAnalytics({
      dates: returnsQuery.data.dates,
      series: returnsQuery.data.series.map((s) => ({ symbol: s.symbol, value: s.value })),
      benchmark: returnsQuery.data.benchmark ? { symbol: returnsQuery.data.benchmark.symbol, value: returnsQuery.data.benchmark.value } : undefined,
      horizon: heatmapHorizon,
    });
  }, [returnsQuery.data, returnsQuery.isSuccess, heatmapHorizon]);

  const activeSymbol = selectedSymbol ?? monthlyAnalytics?.symbols[0] ?? null;
  const activeData = activeSymbol ? monthlyAnalytics?.bySymbol.get(activeSymbol) : undefined;
  const canShowExcess = monthlyAnalytics?.hasBenchmark ?? false;
  const hoverContextKey = React.useMemo(
    () => `${activeSymbol ?? "none"}|${heatmapHorizon}|${metricMode}`,
    [activeSymbol, heatmapHorizon, metricMode],
  );
  const hoveredRangeDates = hoverState.key === hoverContextKey ? hoverState.value : null;
  const setHoveredRangeDates = React.useCallback(
    (next: Set<string> | null) => {
      updateHoverState({ key: hoverContextKey, value: next });
    },
    [hoverContextKey],
  );


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
            <ForwardReturnsChart dates={returnsQuery.data.dates} series={returnsQuery.data.series} base={base} highlightDate={highlightDate} />
          </div>
        </div>
      )}
      {!lightbox.open && returnsQuery.isSuccess && (
        <div className="mb-6">
          <div className="text-sm mb-2">{`Total Return at the present from ${amountDisplay} invested ${symbols.length > 1 ? `in each of ${symbolsDisplay}` : `in ${symbolsDisplay}`} at ${returnsQuery.data.dates[0]}`}</div>
          <div onDoubleClick={() => setLightbox({ open: true, which: 'returns' })}>
            <ReturnsChart dates={returnsQuery.data.dates} series={returnsQuery.data.series} benchmark={returnsQuery.data.benchmark} highlightDate={highlightDate} />
          </div>
        </div>
      )}
      {!lightbox.open && returnsQuery.isSuccess && (
        <div className="mb-6">
          <div className="text-sm mb-2">Drawdown from prior peak (reinvested dividends)</div>
          <div onDoubleClick={() => setLightbox({ open: true, which: 'drawdown' })}>
            <DrawdownChart
              dates={returnsQuery.data.dates}
              series={returnsQuery.data.series.map((s) => ({ symbol: s.symbol, drawdown: s.drawdown }))}
              benchmark={
                returnsQuery.data.benchmark
                  ? { symbol: returnsQuery.data.benchmark.symbol, drawdown: returnsQuery.data.benchmark.drawdown }
                  : undefined
              }
              highlightDate={highlightDate}
            />
          </div>
        </div>
      )}
      {!lightbox.open && returnsQuery.isSuccess && returnsQuery.data.benchmark && returnsQuery.data.excess.length > 0 && (
        <div className="mb-6">
          <div className="text-sm mb-2">Excess return versus {returnsQuery.data.benchmark.symbol}</div>
          <ExcessMiniChart dates={returnsQuery.data.dates} series={returnsQuery.data.excess} benchmarkSymbol={returnsQuery.data.benchmark.symbol} highlightDate={highlightDate} />
        </div>
      )}
      {!lightbox.open && returnsQuery.isSuccess && activeData && (
        <div className="mt-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3">
            <div>
              <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">Monthly Heatmap & Distribution</h4>
              <div className="text-xs text-gray-600 dark:text-gray-400">Click a month to highlight the forward returns chart. Hover a bar to spotlight matching months.</div>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              {monthlyAnalytics && monthlyAnalytics.symbols.length > 1 && (
                <div className="inline-flex rounded-md border border-black/10 dark:border-white/15 overflow-hidden text-xs">
                  {monthlyAnalytics.symbols.map((symbolOption) => (
                    <button
                      key={symbolOption}
                      type="button"
                      onClick={() => setSelectedSymbol(symbolOption)}
                      className={`px-3 py-1.5 transition ${symbolOption === activeSymbol ? 'bg-black text-white dark:bg-white dark:text-black' : 'bg-white text-black dark:bg-neutral-900 dark:text-white'}`}
                    >
                      {symbolOption}
                    </button>
                  ))}
                </div>
              )}
              <div className="inline-flex rounded-md border border-black/10 dark:border-white/15 overflow-hidden text-xs">
                {(["1y", "3y", "5y"] as HeatmapHorizon[]).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setHeatmapHorizon(option)}
                    className={`px-3 py-1.5 transition ${heatmapHorizon === option ? 'bg-black text-white dark:bg-white dark:text-black' : 'bg-white text-black dark:bg-neutral-900 dark:text-white'}`}
                  >
                    {option.toUpperCase()}
                  </button>
                ))}
              </div>
              <div className="inline-flex rounded-md border border-black/10 dark:border-white/15 overflow-hidden text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setMetricMode("return");
                    setHoveredRangeDates(null);
                  }}
                  className={`px-3 py-1.5 transition ${metricMode === 'return' ? 'bg-black text-white dark:bg-white dark:text-black' : 'bg-white text-black dark:bg-neutral-900 dark:text-white'}`}
                >
                  Return
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!canShowExcess) return;
                    setMetricMode("excess");
                    setHoveredRangeDates(null);
                  }}
                  className={`px-3 py-1.5 border-l border-black/10 dark:border-white/15 transition ${metricMode === 'excess' ? 'bg-black text-white dark:bg-white dark:text-black' : canShowExcess ? 'bg-white text-black dark:bg-neutral-900 dark:text-white' : 'bg-neutral-200 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-500'}`}
                  disabled={!canShowExcess}
                >
                  Excess
                </button>
              </div>
            </div>
          </div>
          <MonthlyHeatmap
            data={activeData}
            metric={metricMode}
            horizon={heatmapHorizon}
            highlightDate={highlightDate}
            highlightDates={hoveredRangeDates}
            onSelectDate={(date) => {
              setHighlightDate(date);
            }}
            hasBenchmark={canShowExcess}
          />
          <div className="mt-4">
            <ReturnsHistogram
              cells={activeData.cells}
              metric={metricMode}
              stats={metricMode === "return" ? activeData.returnStats : activeData.excessStats}
              onHoverRange={(range) => {
                if (!range) {
                  setHoveredRangeDates(null);
                  return;
                }
                setHoveredRangeDates(new Set(range.dates));
              }}
            />
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
        title={
          lightbox.which === 'forward'
            ? 'Forward Returns'
            : lightbox.which === 'returns'
            ? 'Returns'
            : lightbox.which === 'drawdown'
            ? 'Drawdown'
            : lightbox.which === 'price'
            ? 'Price'
            : undefined
        }
        subtitle={symbolsDisplay}
      >{(forPrint) => (
        <>
          {lightbox.which === 'forward' && returnsQuery.isSuccess && (
            <div className={forPrint ? 'print:!h-full print:!w-full h-[82vh] w-[92vw]' : 'h-full w-full'}>
              <ForwardReturnsChart dates={returnsQuery.data.dates} series={returnsQuery.data.series} base={base} highlightDate={highlightDate} height={'full'} />
            </div>
          )}
          {lightbox.which === 'returns' && returnsQuery.isSuccess && (
            <div className={forPrint ? 'print:!h-full print:!w-full h-[82vh] w-[92vw]' : 'h-full w-full'}>
              <ReturnsChart dates={returnsQuery.data.dates} series={returnsQuery.data.series} benchmark={returnsQuery.data.benchmark} highlightDate={highlightDate} height={'full'} />
            </div>
          )}
          {lightbox.which === 'drawdown' && returnsQuery.isSuccess && (
            <div className={forPrint ? 'print:!h-full print:!w-full h-[82vh] w-[92vw]' : 'h-full w-full'}>
              <DrawdownChart
                dates={returnsQuery.data.dates}
                series={returnsQuery.data.series.map((s) => ({ symbol: s.symbol, drawdown: s.drawdown }))}
                benchmark={
                  returnsQuery.data.benchmark
                    ? { symbol: returnsQuery.data.benchmark.symbol, drawdown: returnsQuery.data.benchmark.drawdown }
                    : undefined
                }
                highlightDate={highlightDate}
                height={'full'}
              />
            </div>
          )}
          {lightbox.which === 'price' && pricesQuery.isSuccess && (
            <div className={forPrint ? 'print:!h-full print:!w-full h-[82vh] w-[92vw]' : 'h-full w-full'}>
              <PriceChart
                items={pricesQuery.data.items.map((i) => ({
                  symbol: i.symbol,
                  candles: i.candles.map((c) => ({
                    dateUtcSeconds: typeof c.dateUtcSeconds === 'number' ? c.dateUtcSeconds : (typeof c.date === 'number' ? c.date : 0),
                    close: typeof c.close === 'number' ? c.close : null,
                  })),
                }))}
                height={'full'}
              />
            </div>
          )}
        </>
      )}</ChartLightbox>
    </div>
  );
}



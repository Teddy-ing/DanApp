export type HistogramStats = {
  mean: number | null;
  median: number | null;
  p5: number | null;
  p95: number | null;
};

export type MonthlyCell = {
  date: string;
  year: number;
  month: number;
  returnPct: number;
  excessPct: number | null;
  percentile: number;
};

export type SymbolMonthlyAnalytics = {
  symbol: string;
  cells: MonthlyCell[];
  years: number[];
  returnValues: number[];
  excessValues: number[];
  returnStats: HistogramStats;
  excessStats: HistogramStats | null;
  returnDomain: { min: number; max: number };
  excessDomain: { min: number; max: number } | null;
};

export type MonthlyAnalyticsResult = {
  symbols: string[];
  bySymbol: Map<string, SymbolMonthlyAnalytics>;
  hasBenchmark: boolean;
};

type Series = { symbol: string; value: Array<number | null> };

type BuildParams = {
  dates: string[];
  series: Series[];
  benchmark?: Series | null;
  horizon: HeatmapHorizon;
};

const MONTHS = Array.from({ length: 12 }, (_, i) => i);

export type HeatmapHorizon = "1y" | "3y" | "5y" | "max";

const HORIZON_YEARS: Record<HeatmapHorizon, number> = {
  "1y": 1,
  "3y": 3,
  "5y": 5,
  max: 0,
};

export function buildMonthlyAnalytics(params: BuildParams): MonthlyAnalyticsResult {
  const { dates, series, benchmark, horizon } = params;
  const symbols = series.map((s) => s.symbol);
  const bySymbol = new Map<string, SymbolMonthlyAnalytics>();
  const hasBenchmark = Boolean(benchmark);
  const lastIndex = dates.length - 1;
  if (lastIndex < 0) {
    return { symbols, bySymbol, hasBenchmark };
  }
  const lastDate = parseIsoDate(dates[lastIndex]);
  const horizonYears = HORIZON_YEARS[horizon];

  for (const s of series) {
    const analytics = computeForSymbol({
      symbol: s.symbol,
      dates,
      values: s.value,
      benchmarkValues: benchmark?.value ?? null,
      lastIndex,
      lastDate,
      horizonYears,
    });
    bySymbol.set(s.symbol, analytics);
  }

  return { symbols, bySymbol, hasBenchmark };
}

function computeForSymbol(params: {
  symbol: string;
  dates: string[];
  values: Array<number | null>;
  benchmarkValues: Array<number | null> | null;
  lastIndex: number;
  lastDate: Date;
  horizonYears: number;
}): SymbolMonthlyAnalytics {
  const { symbol, dates, values, benchmarkValues, lastIndex, lastDate, horizonYears } = params;
  const cells: MonthlyCell[] = [];
  const seenMonthKeys = new Set<string>();
  const endValue = values[lastIndex];
  const endBenchmarkValue = benchmarkValues ? benchmarkValues[lastIndex] : null;
  if (endValue == null || (benchmarkValues && endBenchmarkValue == null)) {
    return emptyAnalytics(symbol);
  }

  for (let i = 0; i <= lastIndex; i += 1) {
    const startValue = values[i];
    if (!(typeof startValue === "number" && Number.isFinite(startValue) && startValue > 0)) continue;
    const dateIso = dates[i];
    const parsed = parseIsoDate(dateIso);
    const year = parsed.getUTCFullYear();
    const month = parsed.getUTCMonth();
    const monthKey = `${year}-${month}`;
    if (seenMonthKeys.has(monthKey)) continue;

    if (!MONTHS.includes(month)) continue;
    if (horizonYears > 0 && yearsBetween(parsed, lastDate) >= horizonYears) continue;

    const returnPct = safeRatio(endValue, startValue);
    if (returnPct == null) continue;

    let excessPct: number | null = null;
    if (benchmarkValues) {
      const benchStartValue = benchmarkValues[i];
      if (typeof benchStartValue === "number" && Number.isFinite(benchStartValue) && benchStartValue > 0 && endBenchmarkValue != null) {
        const benchmarkReturn = safeRatio(endBenchmarkValue, benchStartValue);
        if (benchmarkReturn != null) {
          excessPct = returnPct - benchmarkReturn;
        }
      }
    }

    cells.push({
      date: dateIso,
      year,
      month,
      returnPct,
      excessPct,
      percentile: 0,
    });
    seenMonthKeys.add(monthKey);
  }

  cells.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const years = Array.from(new Set(cells.map((cell) => cell.year))).sort((a, b) => b - a);

  const returnValues = cells.map((cell) => cell.returnPct).filter((v) => Number.isFinite(v));
  const returnStats = computeStats(returnValues);
  const returnDomain = computeDomain(returnValues);

  const excessValues = cells
    .map((cell) => cell.excessPct)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  const excessStats = excessValues.length > 0 ? computeStats(excessValues) : null;
  const excessDomain = excessValues.length > 0 ? computeDomain(excessValues) : null;

  if (returnValues.length > 0) {
    const sorted = [...returnValues].sort((a, b) => a - b);
    for (const cell of cells) {
      cell.percentile = percentileRank(cell.returnPct, sorted);
    }
  }

  return {
    symbol,
    cells,
    years,
    returnValues,
    excessValues,
    returnStats,
    excessStats,
    returnDomain,
    excessDomain,
  };
}

function emptyAnalytics(symbol: string): SymbolMonthlyAnalytics {
  return {
    symbol,
    cells: [],
    years: [],
    returnValues: [],
    excessValues: [],
    returnStats: { mean: null, median: null, p5: null, p95: null },
    excessStats: null,
    returnDomain: { min: 0, max: 0 },
    excessDomain: null,
  };
}

function parseIsoDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

function yearsBetween(from: Date, to: Date): number {
  const diffMs = to.getTime() - from.getTime();
  return diffMs / (365.25 * 24 * 60 * 60 * 1000);
}

function safeRatio(endValue: number, startValue: number): number | null {
  if (!(Number.isFinite(endValue) && Number.isFinite(startValue) && startValue !== 0)) return null;
  return endValue / startValue - 1;
}

function computeStats(values: number[]): HistogramStats {
  if (values.length === 0) {
    return { mean: null, median: null, p5: null, p95: null };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = sorted.reduce((sum, value) => sum + value, 0) / n;
  const median = n % 2 === 1 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
  const p5 = percentile(sorted, 0.05);
  const p95 = percentile(sorted, 0.95);
  return { mean, median, p5, p95 };
}

function percentile(sorted: number[], fraction: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * fraction)));
  return sorted[index];
}

function computeDomain(values: number[]): { min: number; max: number } {
  if (values.length === 0) {
    return { min: 0, max: 0 };
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  return { min, max };
}

function percentileRank(value: number, sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const idx = upperBound(sorted, value);
  const percentile = (idx / sorted.length) * 100;
  return Math.max(0, Math.min(100, Number(percentile.toFixed(1))));
}

function upperBound(sorted: number[], target: number): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (sorted[mid] <= target) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return lo;
}



import { computeDripSeries } from "./drip";
import { createRedisClient } from "./redis";
import { validateUsTickerFormat } from "./ticker";
import { fetchDailyCandles, fetchSplitsAndDividends } from "../providers/yahoo";

const PRECOMPUTE_VERSION = 1;
const PRECOMPUTE_BASE = 1000;
const PRECOMPUTE_TTL_SECONDS = 60 * 60 * 6; // 6 hours

export type PrecomputeHorizon = "1y" | "3y" | "5y" | "max";

export type StoredPrecompute = {
  v: number;
  symbol: string;
  horizon: PrecomputeHorizon;
  base: number;
  generatedAt: string;
  dates: string[];
  growth: Array<number | null>;
  drawdown: Array<number | null>;
};

type BuildOptions = {
  rapidApiKey: string;
  horizon: PrecomputeHorizon;
  symbol: string;
  base?: number;
};

type RunOptions = {
  symbols: string[];
  horizons?: PrecomputeHorizon[];
  rapidApiKey: string;
};

const DEFAULT_HORIZONS: PrecomputeHorizon[] = ["5y", "max"];

function buildRedisKey(symbol: string, horizon: PrecomputeHorizon): string {
  return `precomp:${symbol}:${horizon}`;
}

function computeDrawdownSeries(growth: Array<number | null>): Array<number | null> {
  let peak: number | null = null;
  return growth.map((point) => {
    if (point == null || !Number.isFinite(point)) {
      return null;
    }
    if (peak == null || point > peak) {
      peak = point;
      return 0;
    }
    if (peak === 0) return 0;
    return point / peak - 1;
  });
}

export function mapGrowthToValueAndPct(
  growth: Array<number | null>,
  base: number
): { value: Array<number | null>; pct: Array<number | null> } {
  const value: Array<number | null> = [];
  const pct: Array<number | null> = [];
  for (const point of growth) {
    if (point == null || !Number.isFinite(point)) {
      value.push(null);
      pct.push(null);
      continue;
    }
    const v = point * base;
    value.push(v);
    pct.push(point - 1);
  }
  return { value, pct };
}

export async function loadPrecomputed(symbol: string, horizon: PrecomputeHorizon): Promise<StoredPrecompute | null> {
  const normalized = validateUsTickerFormat(symbol);
  const redis = createRedisClient();
  const payload = await redis.getJson<StoredPrecompute>(buildRedisKey(normalized, horizon));
  if (!payload) return null;
  if (payload.v !== PRECOMPUTE_VERSION) return null;
  if (!Array.isArray(payload.dates) || !Array.isArray(payload.growth) || !Array.isArray(payload.drawdown)) {
    return null;
  }
  return payload;
}

async function storePrecomputed(snapshot: StoredPrecompute): Promise<void> {
  const redis = createRedisClient();
  await redis.setJson(buildRedisKey(snapshot.symbol, snapshot.horizon), snapshot, PRECOMPUTE_TTL_SECONDS);
}

async function buildPrecomputedSnapshot(options: BuildOptions): Promise<StoredPrecompute> {
  const base = options.base ?? PRECOMPUTE_BASE;
  const normalized = validateUsTickerFormat(options.symbol);
  const horizon = options.horizon;

  const [{ splits, dividends }, candles] = await Promise.all([
    fetchSplitsAndDividends(normalized, horizon, { rapidApiKey: options.rapidApiKey }),
    fetchDailyCandles(normalized, horizon, { rapidApiKey: options.rapidApiKey }),
  ]);

  const drip = computeDripSeries(
    [
      {
        symbol: normalized,
        candles,
        splits: splits ?? [],
        dividends: dividends ?? [],
      },
    ],
    { base, horizon }
  );

  const series = drip.series[0];
  if (!series) {
    return {
      v: PRECOMPUTE_VERSION,
      symbol: normalized,
      horizon,
      base,
      generatedAt: new Date().toISOString(),
      dates: drip.dates,
      growth: [],
      drawdown: [],
    };
  }

  const growth = series.value.map((val) => {
    if (val == null || !Number.isFinite(val)) return null;
    return val / base;
  });

  return {
    v: PRECOMPUTE_VERSION,
    symbol: normalized,
    horizon,
    base,
    generatedAt: new Date().toISOString(),
    dates: drip.dates,
    growth,
    drawdown: computeDrawdownSeries(growth),
  };
}

export async function getOrComputePrecomputed(
  symbol: string,
  horizon: PrecomputeHorizon,
  rapidApiKey: string
): Promise<StoredPrecompute> {
  const cached = await loadPrecomputed(symbol, horizon);
  if (cached) return cached;
  const snapshot = await buildPrecomputedSnapshot({ symbol, horizon, rapidApiKey });
  await storePrecomputed(snapshot);
  return snapshot;
}

export async function runPrecomputeJob(options: RunOptions): Promise<{
  results: Array<{ symbol: string; horizon: PrecomputeHorizon; ok: boolean; message?: string }>;
}> {
  const horizons = options.horizons && options.horizons.length > 0 ? options.horizons : DEFAULT_HORIZONS;
  const results: Array<{ symbol: string; horizon: PrecomputeHorizon; ok: boolean; message?: string }> = [];
  for (const rawSymbol of options.symbols) {
    for (const horizon of horizons) {
      try {
        await storePrecomputed(
          await buildPrecomputedSnapshot({
            symbol: rawSymbol,
            horizon,
            rapidApiKey: options.rapidApiKey,
          })
        );
        results.push({ symbol: validateUsTickerFormat(rawSymbol), horizon, ok: true });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        results.push({ symbol: rawSymbol, horizon, ok: false, message });
      }
    }
  }
  return { results };
}

export function computeDrawdownFromGrowth(growth: Array<number | null>): Array<number | null> {
  return computeDrawdownSeries(growth);
}


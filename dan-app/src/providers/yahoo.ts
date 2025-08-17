import { z } from "zod";
import { createRedisClient } from "../lib/redis";
import { validateUsTickerFormat } from "../lib/ticker";
import { fetchWithTimeout } from "../lib/http";

// Types and schemas for Yahoo Finance via RapidAPI
// We model three data domains needed by the app: daily candles, splits, dividends.

export type RapidApiAuth = {
  rapidApiKey: string;
};

// Chart candles response (simplified to the fields we rely on)
const chartResultSchema = z.object({
  timestamp: z.array(z.number()).optional(),
  indicators: z.object({
    quote: z
      .array(
        z.object({
          open: z.array(z.number().nullable()).optional(),
          high: z.array(z.number().nullable()).optional(),
          low: z.array(z.number().nullable()).optional(),
          close: z.array(z.number().nullable()).optional(),
          volume: z.array(z.number().nullable()).optional(),
        })
      )
      .optional(),
    adjclose: z
      .array(
        z.object({
          adjclose: z.array(z.number().nullable()).optional(),
        })
      )
      .optional(),
  }),
});

const chartResponseSchema = z.object({
  chart: z.object({
    result: z.array(chartResultSchema).nullable(),
    error: z.any().nullable().optional(),
  }),
});

export type DailyCandle = {
  dateUtcSeconds: number;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
  adjClose: number | null;
};

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRetry(status: number | undefined): boolean {
  if (!status) return true; // network errors
  return status === 429 || status >= 500;
}

async function fetchRapidApiWithBackoff(
  url: string,
  area: "candles" | "events",
  headers: Record<string, string>,
  attemptLimit: number = 4
): Promise<Response> {
  let lastStatus: number | undefined;
  let lastBody = "";
  for (let attempt = 1; attempt <= attemptLimit; attempt += 1) {
    try {
      const res = await fetchWithTimeout(url, { timeoutMs: 8000, headers, cache: "no-store" });
      if (res.ok) return res;
      lastStatus = res.status;
      try { lastBody = await res.text(); } catch { lastBody = ""; }
      if (!shouldRetry(res.status)) {
        throw buildProviderError(area, res.status, lastBody);
      }
    } catch (e) {
      // network/timeout or thrown above
      if (lastStatus && !shouldRetry(lastStatus)) throw e as Error;
    }
    // exponential backoff with jitter
    const base = 600; // ms
    const backoff = Math.min(base * 2 ** (attempt - 1), 4000);
    const jitter = Math.floor(Math.random() * 250);
    await delay(backoff + jitter);
  }
  // Exhausted
  throw buildProviderError(area, lastStatus ?? 502, lastBody);
}

const RAPID_HOST = process.env.RAPIDAPI_YF_HOST ?? "apidojo-yahoo-finance-v1.p.rapidapi.com";
const BASE_URL = `https://apidojo-yahoo-finance-v1.p.rapidapi.com`;

export async function fetchDailyCandles(
  symbol: string,
  span: { period1: number; period2?: number } | ("5y" | "max" | "1y") = "5y",
  auth: RapidApiAuth
): Promise<DailyCandle[]> {
  const validSymbol = validateUsTickerFormat(symbol);
  const url = `${BASE_URL}/stock/v3/get-chart`;
  const params = new URLSearchParams({ symbol: validSymbol, interval: "1d", region: "US" });
  if (typeof span === "string") {
    params.set("range", span);
  } else {
    params.set("period1", String(span.period1));
    if (span.period2) params.set("period2", String(span.period2));
  }

  // Cache key per PRD: yf:{symbol}:prices:v1 (24h)
  const redis = createRedisClient();
  const cacheKey = `yf:${validSymbol}:prices:v1`;
  const cached = await redis.getJson<DailyCandle[]>(cacheKey);
  if (cached) return cached;

  const res = await fetchRapidApiWithBackoff(
    `${url}?${params.toString()}`,
    "candles",
    {
      "x-rapidapi-key": auth.rapidApiKey,
      "x-rapidapi-host": RAPID_HOST,
    }
  );

  const json = await res.json();
  const parsed = chartResponseSchema.safeParse(json);
  if (!parsed.success || !parsed.data.chart.result || parsed.data.chart.result.length === 0) {
    throw buildParseError("candles", parsed.success ? undefined : parsed.error);
  }

  const r = parsed.data.chart.result[0];
  const timestamps = r.timestamp ?? [];
  const quote = r.indicators.quote?.[0];
  const adj = r.indicators.adjclose?.[0];

  const open = quote?.open ?? [];
  const high = quote?.high ?? [];
  const low = quote?.low ?? [];
  const close = quote?.close ?? [];
  const volume = quote?.volume ?? [];
  const adjclose = adj?.adjclose ?? [];

  const length = Math.max(
    timestamps.length,
    open.length,
    high.length,
    low.length,
    close.length,
    volume.length,
    adjclose.length
  );

  const candles: DailyCandle[] = [];
  for (let i = 0; i < length; i += 1) {
    candles.push({
      dateUtcSeconds: timestamps[i] ?? 0,
      open: sanitizeNum(open[i]),
      high: sanitizeNum(high[i]),
      low: sanitizeNum(low[i]),
      close: sanitizeNum(close[i]),
      volume: sanitizeNum(volume[i]),
      adjClose: sanitizeNum(adjclose[i]),
    });
  }
  // Store for 24 hours
  await redis.setJson(cacheKey, candles, 60 * 60 * 24);
  return candles;
}

// Splits & dividends live in events endpoint
const eventsResponseSchema = z.object({
  chart: z.object({
    result: z
      .array(
        z.object({
          events: z
            .object({
              splits: z
                .record(
                  z.object({
                    date: z.number(),
                    numerator: z.number().optional(),
                    denominator: z.number().optional(),
                    splitRatio: z.string().optional(),
                  })
                )
                .optional()
                .nullable(),
              dividends: z
                .record(
                  z.object({
                    date: z.number(),
                    amount: z.number(),
                  })
                )
                .optional()
                .nullable(),
            })
            .optional(),
        })
      )
      .nullable(),
  }),
});

export type SplitEvent = {
  dateUtcSeconds: number;
  ratio: number; // shares multiplier, e.g., 2 for 2-for-1
};

export type DividendEvent = {
  dateUtcSeconds: number; // payment date per Yahoo event
  amount: number; // cash per share in USD
};

export async function fetchSplitsAndDividends(
  symbol: string,
  span: { period1: number; period2?: number } | ("5y" | "max" | "1y") = "max",
  auth: RapidApiAuth
): Promise<{ splits: SplitEvent[]; dividends: DividendEvent[] }> {
  const validSymbol = validateUsTickerFormat(symbol);
  const url = `${BASE_URL}/stock/v3/get-chart`;
  const params = new URLSearchParams({ symbol: validSymbol, interval: "1d", region: "US", events: "div,splits" });
  if (typeof span === "string") {
    params.set("range", span);
  } else {
    params.set("period1", String(span.period1));
    if (span.period2) params.set("period2", String(span.period2));
  }

  // Cache key per PRD: yf:{symbol}:divs:v1 (24h)
  const redis = createRedisClient();
  const cacheKey = `yf:${validSymbol}:divs:v1`;
  const cached = await redis.getJson<{ splits: SplitEvent[]; dividends: DividendEvent[] }>(cacheKey);
  if (cached) return cached;

  const res = await fetchRapidApiWithBackoff(
    `${url}?${params.toString()}`,
    "events",
    {
      "x-rapidapi-key": auth.rapidApiKey,
      "x-rapidapi-host": RAPID_HOST,
    }
  );

  const json = await res.json();
  const parsed = eventsResponseSchema.safeParse(json);
  if (!parsed.success || !parsed.data.chart.result || parsed.data.chart.result.length === 0) {
    throw buildParseError("events", parsed.success ? undefined : parsed.error);
  }

  type SplitRecordEntry = { date: number; numerator?: number; denominator?: number; splitRatio?: string };
  type DividendRecordEntry = { date: number; amount: number };

  const events = parsed.data.chart.result[0].events;
  const splitsMap = (events?.splits ?? {}) as Record<string, SplitRecordEntry>;
  const dividendsMap = (events?.dividends ?? {}) as Record<string, DividendRecordEntry>;

  const splits: SplitEvent[] = Object.values(splitsMap).map((s: SplitRecordEntry) => {
    const ratio = s.splitRatio
      ? parseSplitRatio(s.splitRatio)
      : computeRatioFromNumeratorDenominator(s.numerator, s.denominator);
    return { dateUtcSeconds: s.date, ratio };
  });

  const dividends: DividendEvent[] = Object.values(dividendsMap).map((d: DividendRecordEntry) => ({
    dateUtcSeconds: d.date,
    amount: d.amount,
  }));

  // Sort chronologically
  splits.sort((a, b) => a.dateUtcSeconds - b.dateUtcSeconds);
  dividends.sort((a, b) => a.dateUtcSeconds - b.dateUtcSeconds);

  const payload = { splits, dividends };
  await redis.setJson(cacheKey, payload, 60 * 60 * 24);
  return payload;
}

function parseSplitRatio(text?: string): number {
  if (!text) return 1;
  const parts = text.split(":");
  if (parts.length !== 2) return 1;
  const numerator = Number(parts[0]);
  const denominator = Number(parts[1]);
  if (!isFinite(numerator) || !isFinite(denominator) || denominator === 0) return 1;
  return numerator / denominator;
}

function computeRatioFromNumeratorDenominator(
  numerator?: number,
  denominator?: number
): number {
  if (!isFinite(numerator ?? NaN) || !isFinite(denominator ?? NaN) || !denominator) return 1;
  return numerator! / denominator!;
}

function sanitizeNum(value: number | null | undefined): number | null {
  return typeof value === "number" && isFinite(value) ? value : null;
}

// kept for potential future logging needs
async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

// using shared fetchWithTimeout from lib/http

export class ProviderError extends Error {
  public readonly providerArea: "candles" | "events" | "symbol";
  public readonly status: number;
  public readonly bodySnippet: string | undefined;

  constructor(area: "candles" | "events" | "symbol", status: number, message: string, bodySnippet?: string) {
    super(message);
    this.name = "ProviderError";
    this.providerArea = area;
    this.status = status;
    this.bodySnippet = bodySnippet;
  }
}

function buildProviderError(area: "candles" | "events", status: number, body: string): ProviderError {
  const snippet = body?.slice(0, 300);
  return new ProviderError(area, status, `Yahoo provider ${area} request failed (${status})`, snippet);
}

function buildParseError(area: "candles" | "events", zerr?: z.ZodError<unknown>): ProviderError {
  const detail = zerr ? zerr.errors.map((e: z.ZodIssue) => e.message).join(", ") : "Empty or malformed response";
  return new ProviderError(area, 502, `Yahoo provider ${area} parse error: ${detail}`);
}



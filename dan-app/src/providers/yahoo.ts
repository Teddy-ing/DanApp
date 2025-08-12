import { z } from "zod";

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

export async function fetchDailyCandles(
  symbol: string,
  range: "5y" | "max" | "1y" = "5y",
  auth: RapidApiAuth
): Promise<DailyCandle[]> {
  const url = `https://yh-finance.p.rapidapi.com/stock/v3/get-chart`;
  const params = new URLSearchParams({ symbol, interval: "1d", range });

  const res = await fetch(`${url}?${params.toString()}`, {
    headers: {
      "x-rapidapi-key": auth.rapidApiKey,
      "x-rapidapi-host": "yh-finance.p.rapidapi.com",
    },
    // Conservative timeout via AbortController left to callers if needed
    cache: "no-store",
  });

  if (!res.ok) {
    throw buildProviderError("candles", res.status, await safeText(res));
  }

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
              splits: z.record(
                z.object({
                  date: z.number(),
                  numerator: z.number().optional(),
                  denominator: z.number().optional(),
                  splitRatio: z.string().optional(),
                })
              )
                .optional()
                .nullable(),
              dividends: z.record(
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
  range: "5y" | "max" | "1y" = "max",
  auth: RapidApiAuth
): Promise<{ splits: SplitEvent[]; dividends: DividendEvent[] }> {
  const url = `https://yh-finance.p.rapidapi.com/stock/v3/get-chart`;
  const params = new URLSearchParams({ symbol, interval: "1d", range, events: "div,splits" });

  const res = await fetch(`${url}?${params.toString()}`, {
    headers: {
      "x-rapidapi-key": auth.rapidApiKey,
      "x-rapidapi-host": "yh-finance.p.rapidapi.com",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw buildProviderError("events", res.status, await safeText(res));
  }

  const json = await res.json();
  const parsed = eventsResponseSchema.safeParse(json);
  if (!parsed.success || !parsed.data.chart.result || parsed.data.chart.result.length === 0) {
    throw buildParseError("events", parsed.success ? undefined : parsed.error);
  }

  const events = parsed.data.chart.result[0].events;
  const splitsMap = events?.splits ?? {};
  const dividendsMap = events?.dividends ?? {};

  const splits: SplitEvent[] = Object.values(splitsMap).map((s) => {
    const ratio = s.splitRatio
      ? parseSplitRatio(s.splitRatio)
      : computeRatioFromNumeratorDenominator(s.numerator, s.denominator);
    return { dateUtcSeconds: s.date, ratio };
  });

  const dividends: DividendEvent[] = Object.values(dividendsMap).map((d) => ({
    dateUtcSeconds: d.date,
    amount: d.amount,
  }));

  // Sort chronologically
  splits.sort((a, b) => a.dateUtcSeconds - b.dateUtcSeconds);
  dividends.sort((a, b) => a.dateUtcSeconds - b.dateUtcSeconds);

  return { splits, dividends };
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

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

export class ProviderError extends Error {
  public readonly providerArea: "candles" | "events";
  public readonly status: number;
  public readonly bodySnippet: string | undefined;

  constructor(area: "candles" | "events", status: number, message: string, bodySnippet?: string) {
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

function buildParseError(area: "candles" | "events", zerr?: z.ZodError<any>): ProviderError {
  const detail = zerr ? zerr.errors.map((e) => e.message).join(", ") : "Empty or malformed response";
  return new ProviderError(area, 502, `Yahoo provider ${area} parse error: ${detail}`);
}



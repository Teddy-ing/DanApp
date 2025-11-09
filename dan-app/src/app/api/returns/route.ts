import { NextRequest, NextResponse } from "next/server";
import { fetchDailyCandles, fetchSplitsAndDividends } from "@/providers/yahoo";
import { parseSymbols } from "@/lib/ticker";
import { computeDripSeries } from "@/lib/drip";
import { gzipSync } from "zlib";
import { toApiError } from "@/lib/errors";
import { auth } from "@/auth";
import { resolveRapidApiKey, RapidApiKeyMissingError } from "@/lib/userKey";
import { checkRateLimit } from "@/lib/rateLimit";
import { getOrComputePrecomputed, mapGrowthToValueAndPct } from "@/lib/precompute";

type Horizon = "5y" | "max";
type CustomSpan = { period1: number; period2?: number };

type ReturnsPayload = {
  meta: { symbols: string[]; base: number; horizon: Horizon };
  dates: string[];
  series: Array<{ symbol: string; value: Array<number | null>; pct: Array<number | null> }>;
};

function parseHorizon(input: string | null): Horizon {
  const v = (input || "").toLowerCase();
  return v === "max" ? "max" : "5y";
}

function parseBase(input: string | null): number {
  const n = Number(input);
  if (Number.isFinite(n) && n > 0) return n;
  return 1000;
}


function jsonError(status: number, message: string, details?: unknown) {
  return NextResponse.json(
    { error: { message, details } },
    { status }
  );
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  // Require auth and inject stored RapidAPI key
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return jsonError(401, "Unauthorized");
  let rapidApiKey: string;
  try {
    const { key } = await resolveRapidApiKey(userId);
    rapidApiKey = key;
  } catch (e) {
    if (e instanceof RapidApiKeyMissingError) {
      if (e.reason === "shared_missing") {
        return jsonError(500, "Server misconfiguration: configure RAPIDAPI_SHARED_KEY or enable user RapidAPI keys.");
      }
      return jsonError(400, "RapidAPI key not set. Save your key first.");
    }
    const code = (e as Error)?.message || '';
    if (code === 'MISCONFIG_SECRET') {
      return jsonError(500, 'Server misconfiguration: missing AUTH_SECRET/NEXTAUTH_SECRET');
    }
    return jsonError(400, 'RapidAPI key not set. Save your key first.');
  }

  const { allowed, retryAfterSeconds } = await checkRateLimit(
    "returns",
    `user:${userId}`
  );
  if (!allowed) {
    return NextResponse.json(
      { error: { message: "Rate limit exceeded", details: { retryAfterSeconds } } },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds ?? 60) } }
    );
  }

  const symbols = parseSymbols(url.searchParams.get("symbols"));
  if (symbols.length === 0) {
    return jsonError(400, "Query param 'symbols' is required (comma-separated), e.g., symbols=AAPL,MSFT");
  }
  if (symbols.length > 5) {
    return jsonError(400, "A maximum of 5 symbols is supported");
  }

  const horizon = parseHorizon(url.searchParams.get("horizon"));
  const base = parseBase(url.searchParams.get("base"));
  const period1 = url.searchParams.get("period1");
  const period2 = url.searchParams.get("period2");
  const customSpan = period1 ? { period1: Number(period1), period2: period2 ? Number(period2) : undefined } : undefined;

  let payload: ReturnsPayload;
  try {
    if (!customSpan) {
      try {
        payload = await buildPrecomputedPayload({ symbols, horizon, base, rapidApiKey });
      } catch {
        payload = await computeOnDemandPayload({ symbols, horizon, base, rapidApiKey });
      }
    } else {
      payload = await computeOnDemandPayload({ symbols, horizon, base, rapidApiKey, customSpan });
    }
  } catch (err: unknown) {
    const { status, payload: errorPayload } = toApiError(err);
    return new NextResponse(JSON.stringify(errorPayload), {
      status,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }

  const gz = gzipSync(Buffer.from(JSON.stringify(payload)));
  const body = new Uint8Array(gz);
  return new NextResponse(body, {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-encoding": "gzip",
      "cache-control": "no-store",
    },
  });
}

async function computeOnDemandPayload(params: {
  symbols: string[];
  horizon: Horizon;
  base: number;
  rapidApiKey: string;
  customSpan?: CustomSpan;
}): Promise<ReturnsPayload> {
  const seriesInputs = await Promise.all(
    params.symbols.map(async (symbol) => {
      const span = params.customSpan ?? params.horizon;
      const candles = await fetchDailyCandles(symbol, span, { rapidApiKey: params.rapidApiKey });
      const events = await fetchSplitsAndDividends(symbol, span, { rapidApiKey: params.rapidApiKey });
      return { symbol, candles, splits: events.splits, dividends: events.dividends };
    })
  );

  const drip = computeDripSeries(seriesInputs, { base: params.base, horizon: params.horizon });
  return {
    meta: { symbols: params.symbols, base: params.base, horizon: params.horizon },
    dates: drip.dates,
    series: drip.series,
  };
}

async function buildPrecomputedPayload(params: {
  symbols: string[];
  horizon: Horizon;
  base: number;
  rapidApiKey: string;
}): Promise<ReturnsPayload> {
  const snapshots = await Promise.all(
    params.symbols.map((symbol) => getOrComputePrecomputed(symbol, params.horizon, params.rapidApiKey))
  );

  const unionSet = new Set<string>();
  snapshots.forEach((snapshot) => {
    snapshot.dates.forEach((date) => unionSet.add(date));
  });
  const dates = Array.from(unionSet).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  const series = snapshots.map((snapshot, index) => {
    const growthByDate = new Map<string, number | null>();
    snapshot.dates.forEach((date, idx) => {
      const value = snapshot.growth[idx];
      growthByDate.set(date, value == null || !Number.isFinite(value) ? null : value);
    });
    const alignedGrowth = dates.map((date) => {
      if (!growthByDate.has(date)) return null;
      const value = growthByDate.get(date);
      return value == null || !Number.isFinite(value) ? null : value;
    });
    const { value, pct } = mapGrowthToValueAndPct(alignedGrowth, params.base);
    return { symbol: params.symbols[index], value, pct };
  });

  return {
    meta: { symbols: params.symbols, base: params.base, horizon: params.horizon },
    dates,
    series,
  };
}

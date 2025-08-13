import { NextRequest, NextResponse } from "next/server";
import { fetchDailyCandles, fetchSplitsAndDividends } from "@/providers/yahoo";
import { validateUsTickerFormat } from "@/lib/ticker";
import { computeDripSeries } from "@/lib/drip";
import { gzipSync } from "zlib";
import { checkRateLimit } from "@/lib/rateLimit";
import { toApiError } from "@/lib/errors";
import { auth } from "@/auth";
import { getDecryptedRapidApiKey } from "@/lib/userKey";

type Horizon = "5y" | "max";

function parseHorizon(input: string | null): Horizon {
  const v = (input || "").toLowerCase();
  return v === "max" ? "max" : "5y";
}

function parseBase(input: string | null): number {
  const n = Number(input);
  if (Number.isFinite(n) && n > 0) return n;
  return 1000;
}

function parseSymbols(param: string | null): string[] {
  if (!param) return [];
  const parts = param
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const normalized: string[] = [];
  for (const raw of parts) {
    const valid = validateUsTickerFormat(raw);
    if (!normalized.includes(valid)) normalized.push(valid);
  }
  return normalized;
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
  const rapidApiKey = await getDecryptedRapidApiKey(userId);
  if (!rapidApiKey) return jsonError(400, "RapidAPI key not set. Save your key first.");

  const rl = await checkRateLimit("returns", userId, 30, 60);
  if (!rl.allowed) {
    return new NextResponse(JSON.stringify({ error: { message: "Rate limit exceeded", retryAfterSeconds: rl.retryAfterSeconds } }), {
      status: 429,
      headers: { "content-type": "application/json; charset=utf-8", "retry-after": String(rl.retryAfterSeconds ?? 60) },
    });
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

  try {
    const seriesInputs = await Promise.all(
      symbols.map(async (symbol) => {
        const [candles, events] = await Promise.all([
          fetchDailyCandles(symbol, horizon, { rapidApiKey }),
          fetchSplitsAndDividends(symbol, horizon, { rapidApiKey }),
        ]);
        return {
          symbol,
          candles,
          splits: events.splits,
          dividends: events.dividends,
        };
      })
    );

    const drip = computeDripSeries(seriesInputs, { base, horizon });

    const payload = {
      meta: { symbols, base, horizon },
      dates: drip.dates,
      series: drip.series,
    };

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
  } catch (err: unknown) {
    const { status, payload } = toApiError(err);
    return new NextResponse(JSON.stringify(payload), {
      status,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
}



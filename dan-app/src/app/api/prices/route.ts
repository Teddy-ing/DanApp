import { NextRequest, NextResponse } from "next/server";
import { fetchDailyCandles, fetchSplitsAndDividends } from "@/providers/yahoo";
import { validateUsTickerFormat } from "@/lib/ticker";
import { checkRateLimit, extractUserId } from "@/lib/rateLimit";
import { toApiError } from "@/lib/errors";

type Range = "5y" | "1y" | "max";

function parseRange(input: string | null): Range {
  const value = (input || "").toLowerCase();
  if (value === "1y" || value === "5y" || value === "max") return value;
  return "5y";
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
  const rapidApiKey = req.headers.get("x-rapidapi-key");
  if (!rapidApiKey) {
    return jsonError(400, "Missing required header: x-rapidapi-key");
  }

  const userId = extractUserId(req.headers);
  const rl = await checkRateLimit("prices", userId, 30, 60);
  if (!rl.allowed) {
    return new NextResponse(JSON.stringify({ error: { message: "Rate limit exceeded", retryAfterSeconds: rl.retryAfterSeconds } }), {
      status: 429,
      headers: { "content-type": "application/json; charset=utf-8", "retry-after": String(rl.retryAfterSeconds ?? 60) },
    });
  }

  const range = parseRange(url.searchParams.get("range"));
  const symbols = parseSymbols(url.searchParams.get("symbols"));

  if (symbols.length === 0) {
    return jsonError(400, "Query param 'symbols' is required (comma-separated), e.g., symbols=AAPL,MSFT");
  }
  if (symbols.length > 5) {
    return jsonError(400, "A maximum of 5 symbols is supported");
  }

  try {
    const results = await Promise.all(
      symbols.map(async (symbol) => {
        const [candles, events] = await Promise.all([
          fetchDailyCandles(symbol, range, { rapidApiKey }),
          fetchSplitsAndDividends(symbol, range, { rapidApiKey }),
        ]);
        return {
          symbol,
          range,
          candles,
          splits: events.splits,
        };
      })
    );

    return NextResponse.json({ items: results });
  } catch (err: any) {
    const { status, payload } = toApiError(err);
    return new NextResponse(JSON.stringify(payload), {
      status,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
}



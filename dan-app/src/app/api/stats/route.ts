import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDecryptedRapidApiKey } from "@/lib/userKey";
import { checkRateLimit, extractUserId } from "@/lib/rateLimit";
import { toApiError } from "@/lib/errors";
import { parseSymbols } from "@/lib/ticker";
import { fetchDailyCandles } from "@/providers/yahoo";
import { computeSymbolStats } from "@/lib/stats";

function jsonError(status: number, message: string, details?: unknown) {
  return NextResponse.json({ error: { message, details } }, { status });
}

type Range = "5y" | "max" | "1y";

function parseRange(input: string | null): Range {
  const v = (input || "").toLowerCase();
  if (v === "1y") return "1y";
  if (v === "max") return "max";
  return "5y";
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);

  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return jsonError(401, "Unauthorized");
  let rapidApiKey: string;
  try {
    const key = await getDecryptedRapidApiKey(userId);
    if (!key) return jsonError(400, "RapidAPI key not set. Save your key first.");
    rapidApiKey = key;
  } catch (e) {
    const code = (e as Error)?.message || "";
    if (code === "MISCONFIG_SECRET") {
      return jsonError(500, "Server misconfiguration: missing AUTH_SECRET/NEXTAUTH_SECRET");
    }
    return jsonError(400, "RapidAPI key not set. Save your key first.");
  }

  const { allowed, retryAfterSeconds } = await checkRateLimit(
    "stats",
    extractUserId(req.headers)
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

  const range = parseRange(url.searchParams.get("range"));
  const period1 = url.searchParams.get("period1");
  const period2 = url.searchParams.get("period2");
  const customSpan = period1 ? { period1: Number(period1), period2: period2 ? Number(period2) : undefined } : undefined;

  try {
    const results = await Promise.all(
      symbols.map(async (symbol) => {
        const candles = await fetchDailyCandles(symbol, customSpan ?? range, { rapidApiKey });
        const stats = computeSymbolStats(candles);
        return { symbol, stats };
      })
    );

    return NextResponse.json({ items: results });
  } catch (err: unknown) {
    const { status, payload } = toApiError(err);
    return new NextResponse(JSON.stringify(payload), {
      status,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
}



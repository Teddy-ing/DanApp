import { NextRequest, NextResponse } from "next/server";
import { fetchDailyCandles, fetchSplitsAndDividends } from "@/providers/yahoo";
import { parseSymbols } from "@/lib/ticker";
import { toApiError } from "@/lib/errors";
import { auth } from "@/auth";
import { getDecryptedRapidApiKey } from "@/lib/userKey";

type Range = "5y" | "1y" | "max";

function parseRange(input: string | null): Range {
  const value = (input || "").toLowerCase();
  if (value === "1y" || value === "5y" || value === "max") return value;
  return "5y";
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
    const key = await getDecryptedRapidApiKey(userId);
    if (!key) return jsonError(400, "RapidAPI key not set. Save your key first.");
    rapidApiKey = key;
  } catch (e) {
    const code = (e as Error)?.message || '';
    if (code === 'MISCONFIG_SECRET') {
      return jsonError(500, 'Server misconfiguration: missing AUTH_SECRET/NEXTAUTH_SECRET');
    }
    return jsonError(400, 'RapidAPI key not set. Save your key first.');
  }

  // Rate limiting disabled per product decision: requests bill against the user's RapidAPI key

  const range = parseRange(url.searchParams.get("range"));
  const period1 = url.searchParams.get("period1");
  const period2 = url.searchParams.get("period2");
  const customSpan = period1 ? { period1: Number(period1), period2: period2 ? Number(period2) : undefined } : undefined;
  const symbols = parseSymbols(url.searchParams.get("symbols"));

  if (symbols.length === 0) {
    return jsonError(400, "Query param 'symbols' is required (comma-separated), e.g., symbols=AAPL,MSFT");
  }
  if (symbols.length > 5) {
    return jsonError(400, "A maximum of 5 symbols is supported");
  }

  try {
    const items = await Promise.all(
      symbols.map(async (symbol) => {
        const candles = await fetchDailyCandles(symbol, customSpan ?? range, { rapidApiKey });
        const events = await fetchSplitsAndDividends(symbol, customSpan ?? range, { rapidApiKey });
        return { symbol, range, candles, splits: events.splits };
      })
    );

    return NextResponse.json({ items });
  } catch (err: unknown) {
    const { status, payload } = toApiError(err);
    return new NextResponse(JSON.stringify(payload), {
      status,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
}



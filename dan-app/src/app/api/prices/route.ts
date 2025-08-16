import { NextRequest, NextResponse } from "next/server";
import { fetchDailyCandles, fetchSplitsAndDividends } from "@/providers/yahoo";
import { validateUsTickerFormat } from "@/lib/ticker";
import { toApiError } from "@/lib/errors";
import { auth } from "@/auth";
import { getDecryptedRapidApiKey } from "@/lib/userKey";

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
        const candles = await fetchDailyCandles(symbol, range, { rapidApiKey });
        await new Promise((r) => setTimeout(r, 300));
        const events = await fetchSplitsAndDividends(symbol, range, { rapidApiKey });
        return {
          symbol,
          range,
          candles,
          splits: events.splits,
        };
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



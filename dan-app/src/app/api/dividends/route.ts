import { NextRequest, NextResponse } from "next/server";
import { fetchSplitsAndDividends } from "@/providers/yahoo";
import { toNyDateString } from "@/lib/calendar";
import { isYieldmaxBundleSymbols, isYieldmaxKeyword, parseSymbols, YIELDMAX_SYMBOLS } from "@/lib/ticker";
import { toApiError } from "@/lib/errors";
import { auth } from "@/auth";
import { resolveRapidApiKey, RapidApiKeyMissingError } from "@/lib/userKey";

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
    const { key } = await resolveRapidApiKey(userId);
    rapidApiKey = key;
  } catch (e) {
    if (e instanceof RapidApiKeyMissingError) {
      if (e.reason === "shared_missing") {
        return jsonError(500, "Server misconfiguration: configure RAPIDAPI_SHARED_KEY or enable user RapidAPI keys.");
      }
      return jsonError(400, "RapidAPI key not set. Save your key first.");
    }
    const code = (e as Error)?.message || "";
    if (code === "MISCONFIG_SECRET") {
      return jsonError(500, "Server misconfiguration: missing AUTH_SECRET/NEXTAUTH_SECRET");
    }
    return jsonError(400, "RapidAPI key not set. Save your key first.");
  }

  

  const range = parseRange(url.searchParams.get("range"));
  const symbolsParam = url.searchParams.get("symbols");
  const symbolsFromParam = parseSymbols(symbolsParam);
  const useYieldmaxBundle = isYieldmaxKeyword(symbolsParam) || isYieldmaxBundleSymbols(symbolsFromParam);
  const symbols = useYieldmaxBundle ? [...YIELDMAX_SYMBOLS] : symbolsFromParam;
  if (symbols.length === 0) {
    return jsonError(400, "Query param 'symbols' is required (comma-separated), e.g., symbols=AAPL,MSFT");
  }
  if (!useYieldmaxBundle && symbols.length > 5) {
    return jsonError(400, "A maximum of 5 symbols is supported");
  }

  try {
    const items = await Promise.all(
      symbols.map(async (symbol) => {
        const { dividends } = await fetchSplitsAndDividends(symbol, range, { rapidApiKey });
        const merged = dividends.map((d) => ({ dateIso: toNyDateString(d.dateUtcSeconds), amount: d.amount }));
        merged.sort((a, b) => a.dateIso.localeCompare(b.dateIso));
        return { symbol, range, dividends: merged };
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



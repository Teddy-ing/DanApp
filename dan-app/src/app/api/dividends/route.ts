import { NextRequest, NextResponse } from "next/server";
import { fetchSplitsAndDividends } from "@/providers/yahoo";
import { toNyDateString } from "@/lib/calendar";
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
  const rapidApiKey = await getDecryptedRapidApiKey(userId);
  if (!rapidApiKey) return jsonError(400, "RapidAPI key not set. Save your key first.");

  

  const range = parseRange(url.searchParams.get("range"));
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



import { NextRequest, NextResponse } from "next/server";
import { fetchSplitsAndDividends } from "@/providers/yahoo";
import { toNyDateString, nyTodayDateString } from "@/lib/calendar";
import { scrapeIssuerDividends } from "@/scrapers/ir";
import { validateUsTickerFormat } from "@/lib/ticker";
import { checkRateLimit } from "@/lib/rateLimit";
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

function parseIrBases(params: URLSearchParams, symbols: string[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const symbolSet = new Set(symbols);
  for (const [key, value] of params) {
    const m = key.match(/^ir\[([A-Z0-9-]{1,7})\]$/i);
    if (!m) continue;
    const raw = m[1];
    let sym: string;
    try {
      sym = validateUsTickerFormat(raw);
    } catch {
      continue;
    }
    if (!symbolSet.has(sym)) continue;
    if (!out[sym]) out[sym] = [];
    if (value && !out[sym].includes(value)) out[sym].push(value);
  }
  return out;
}

function jsonError(status: number, message: string, details?: unknown) {
  return NextResponse.json(
    { error: { message, details } },
    { status }
  );
}

function isoToDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

function daysBetweenIso(a: string, b: string): number {
  const ms = Math.abs(isoToDate(b).getTime() - isoToDate(a).getTime());
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function computeGapNeeded(dividendDatesIso: string[]): boolean {
  const todayNy = nyTodayDateString();
  const startIso = `${String(Number(todayNy.slice(0, 4)) - 2)}${todayNy.slice(4)}`;
  const recent = dividendDatesIso.filter((d) => d >= startIso).sort();
  if (recent.length <= 1) return true;
  for (let i = 1; i < recent.length; i += 1) {
    if (daysBetweenIso(recent[i - 1], recent[i]) > 180) return true;
  }
  return false;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  // Require auth and inject stored RapidAPI key
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return jsonError(401, "Unauthorized");
  const rapidApiKey = await getDecryptedRapidApiKey(userId);
  if (!rapidApiKey) return jsonError(400, "RapidAPI key not set. Save your key first.");

  const rl = await checkRateLimit("dividends", userId, 30, 60);
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
  const irBases = parseIrBases(url.searchParams, symbols);

  try {
    const items = await Promise.all(
      symbols.map(async (symbol) => {
        const { dividends } = await fetchSplitsAndDividends(symbol, range, { rapidApiKey });
        const yahooDivs = dividends.map((d) => ({ dateIso: toNyDateString(d.dateUtcSeconds), amount: d.amount }));
        const yahooDates = yahooDivs.map((d) => d.dateIso);
        const merged = [...yahooDivs];

        const needGapFill = computeGapNeeded(yahooDates);
        const bases = irBases[symbol] || [];
        if (needGapFill && bases.length > 0) {
          const ir = await scrapeIssuerDividends(symbol, bases);
          if (ir && ir.dividends.length > 0) {
            const existing = new Set(merged.map((d) => d.dateIso));
            for (const d of ir.dividends) {
              if (!existing.has(d.dateIso)) {
                merged.push({ dateIso: d.dateIso, amount: d.amount });
              }
            }
          }
        }

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



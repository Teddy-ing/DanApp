import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { parseSymbols } from "@/lib/ticker";
import { resolveRapidApiKey, RapidApiKeyMissingError } from "@/lib/userKey";
import { checkRateLimit } from "@/lib/rateLimit";
import { getOrComputePrecomputed } from "@/lib/precompute";

const HORIZON_DEFS = [
  { id: "1y", years: 1 },
  { id: "3y", years: 3 },
  { id: "5y", years: 5 },
] as const;

type HorizonId = (typeof HORIZON_DEFS)[number]["id"];

type PercentileStat = {
  percentile: number | null;
  currentReturn: number | null;
  sampleSize: number;
};

type PercentileResponseItem = {
  symbol: string;
  horizons: Record<HorizonId, PercentileStat>;
};

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }

  const symbols = parseSymbols(url.searchParams.get("symbols"));
  if (symbols.length === 0) {
    return NextResponse.json(
      { error: { message: "Query param 'symbols' is required (comma-separated), e.g., symbols=AAPL,MSFT" } },
      { status: 400 }
    );
  }
  if (symbols.length > 5) {
    return NextResponse.json(
      { error: { message: "A maximum of 5 symbols is supported" } },
      { status: 400 }
    );
  }

  let rapidApiKey: string;
  try {
    const { key } = await resolveRapidApiKey(userId);
    rapidApiKey = key;
  } catch (e) {
    if (e instanceof RapidApiKeyMissingError) {
      if (e.reason === "shared_missing") {
        return NextResponse.json(
          { error: { message: "Server misconfiguration: configure RAPIDAPI_SHARED_KEY or enable user RapidAPI keys." } },
          { status: 500 }
        );
      }
      return NextResponse.json({ error: { message: "RapidAPI key not set. Save your key first." } }, { status: 400 });
    }
    const code = (e as Error)?.message || "";
    if (code === "MISCONFIG_SECRET") {
      return NextResponse.json(
        { error: { message: "Server misconfiguration: missing AUTH_SECRET/NEXTAUTH_SECRET" } },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: { message: "RapidAPI key not set. Save your key first." } }, { status: 400 });
  }

  const { allowed, retryAfterSeconds } = await checkRateLimit("stats.percentile", `user:${userId}`);
  if (!allowed) {
    return NextResponse.json(
      { error: { message: "Rate limit exceeded", details: { retryAfterSeconds } } },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds ?? 60) } }
    );
  }

  const requestedHorizonIds = normalizeHorizons(url.searchParams.get("horizons"));
  const horizons = requestedHorizonIds.length > 0 ? requestedHorizonIds : HORIZON_DEFS.map((h) => h.id);

  try {
    const items: PercentileResponseItem[] = [];
    for (const symbol of symbols) {
      const snapshot = await getOrComputePrecomputed(symbol, "max", rapidApiKey);
      items.push({
        symbol,
        horizons: computePercentiles(snapshot.dates, snapshot.growth, horizons),
      });
    }
    return NextResponse.json({ items });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to compute percentiles";
    return NextResponse.json({ error: { message } }, { status: 500 });
  }
}

function normalizeHorizons(raw: string | null): HorizonId[] {
  if (!raw) return [];
  const parts = raw.split(",").map((s) => s.trim().toLowerCase());
  const normalized: HorizonId[] = [];
  for (const part of parts) {
    const match = HORIZON_DEFS.find((h) => h.id === part);
    if (match && !normalized.includes(match.id)) {
      normalized.push(match.id);
    }
  }
  return normalized;
}

function computePercentiles(
  dates: string[],
  growth: Array<number | null>,
  horizonIds: HorizonId[]
): Record<HorizonId, PercentileStat> {
  const result = {} as Record<HorizonId, PercentileStat>;
  const lastIndex = dates.length - 1;
  if (lastIndex < 0) {
    for (const id of horizonIds) {
      result[id] = { percentile: null, currentReturn: null, sampleSize: 0 };
    }
    return result;
  }

  const lastGrowth = growth[lastIndex];
  const lastDate = dates[lastIndex];

  for (const horizon of HORIZON_DEFS) {
    if (!horizonIds.includes(horizon.id)) continue;
    const samples = collectWindowReturns(dates, growth, horizon.years, lastIndex);
    const startIndex = findIndexAtOrAfter(dates, shiftYears(lastDate, -horizon.years));
    let currentReturn: number | null = null;
    if (startIndex !== -1) {
      const startGrowth = growth[startIndex];
      if (isFinitePositive(lastGrowth) && isFinitePositive(startGrowth)) {
        currentReturn = lastGrowth! / startGrowth! - 1;
      }
    }
    let percentile: number | null = null;
    if (currentReturn != null && samples.length > 0) {
      const count = samples.filter((value) => value <= currentReturn!).length;
      percentile = (count / samples.length) * 100;
    }
    result[horizon.id] = {
      percentile: percentile == null ? null : Math.max(0, Math.min(100, Number(percentile.toFixed(1)))),
      currentReturn: currentReturn == null ? null : Number((currentReturn * 100).toFixed(2)) / 100,
      sampleSize: samples.length,
    };
  }

  return result;
}

function collectWindowReturns(
  dates: string[],
  growth: Array<number | null>,
  years: number,
  maxIndex: number
): number[] {
  const returns: number[] = [];
  if (dates.length === 0 || maxIndex <= 0) return returns;
  const limitDate = shiftYears(dates[maxIndex], -years);
  for (let i = 0; i <= maxIndex; i += 1) {
    const date = dates[i];
    if (date > limitDate) break;
    const startGrowth = growth[i];
    if (!isFinitePositive(startGrowth)) continue;
    const targetDate = shiftYears(date, years);
    const endIndex = findIndexAtOrAfter(dates, targetDate, i + 1);
    if (endIndex === -1 || endIndex > maxIndex) continue;
    const endGrowth = growth[endIndex];
    if (!isFinitePositive(endGrowth)) continue;
    returns.push(endGrowth! / startGrowth! - 1);
  }
  return returns;
}

function findIndexAtOrAfter(dates: string[], target: string, startIndex: number = 0): number {
  let lo = startIndex;
  let hi = dates.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (dates[mid] >= target) {
      ans = mid;
      hi = mid - 1;
    } else {
      lo = mid + 1;
    }
  }
  return ans;
}

function shiftYears(isoDate: string, years: number): string {
  if (typeof isoDate !== "string") return isoDate;
  const parts = isoDate.split("-");
  if (parts.length !== 3) return isoDate;
  const [yearStr, monthStr, dayStr] = parts;
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return isoDate;
  }
  let targetDay = day;
  const targetYear = year + years;
  let date = new Date(Date.UTC(targetYear, month - 1, targetDay));
  while (date.getUTCMonth() !== month - 1) {
    targetDay -= 1;
    if (targetDay < 1) {
      targetDay = 1;
      break;
    }
    date = new Date(Date.UTC(targetYear, month - 1, targetDay));
  }
  return formatIso(date);
}

function formatIso(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isFinitePositive(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}


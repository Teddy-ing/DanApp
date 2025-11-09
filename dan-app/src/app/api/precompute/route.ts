import { NextRequest, NextResponse } from "next/server";
import { runPrecomputeJob, PrecomputeHorizon } from "@/lib/precompute";
import { getSharedRapidApiKey } from "@/lib/userKey";
import { parseSymbols, validateUsTickerFormat } from "@/lib/ticker";

const AUTH_HEADER = "authorization";
const PRECOMPUTE_TOKEN = process.env.PRECOMPUTE_CRON_TOKEN;
const VALID_HORIZONS: ReadonlyArray<PrecomputeHorizon> = ["1y", "3y", "5y", "max"];

function unauthorized(message = "Unauthorized") {
  return NextResponse.json({ error: { message } }, { status: 401 });
}

function badRequest(message: string) {
  return NextResponse.json({ error: { message } }, { status: 400 });
}

function serverMisconfig(message: string) {
  return NextResponse.json({ error: { message } }, { status: 500 });
}

function ensureAuthorized(req: NextRequest): NextResponse | null {
  if (!PRECOMPUTE_TOKEN) {
    return serverMisconfig("PRECOMPUTE_CRON_TOKEN is not configured");
  }
  const header = req.headers.get(AUTH_HEADER);
  if (header !== `Bearer ${PRECOMPUTE_TOKEN}`) {
    return unauthorized();
  }
  return null;
}

function normalizeHorizons(raw?: string[] | string | null): PrecomputeHorizon[] {
  if (!raw) return [];
  const arr = Array.isArray(raw) ? raw : raw.split(",");
  const normalized: PrecomputeHorizon[] = [];
  for (const entry of arr) {
    const value = entry?.toString().trim().toLowerCase();
    if (!value) continue;
    const match = VALID_HORIZONS.find((h) => h === value);
    if (match && !normalized.includes(match)) normalized.push(match);
  }
  return normalized;
}

function normalizeSymbolsFromArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const collected: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    try {
      const normalized = validateUsTickerFormat(item);
      if (!collected.includes(normalized)) {
        collected.push(normalized);
      }
    } catch {
      // ignore invalid entries
    }
  }
  return collected;
}

async function runJob(symbols: string[], horizons: PrecomputeHorizon[] | undefined) {
  const rapidApiKey = getSharedRapidApiKey();
  if (!rapidApiKey) {
    throw new Error("Shared RapidAPI key not configured (RAPIDAPI_SHARED_KEY or RAPIDAPI_KEY)");
  }
  return runPrecomputeJob({
    symbols,
    horizons,
    rapidApiKey,
  });
}

export async function GET(req: NextRequest) {
  const authError = ensureAuthorized(req);
  if (authError) return authError;

  const url = new URL(req.url);
  const symbolsParam = url.searchParams.get("symbols");
  if (!symbolsParam) {
    return badRequest("Query param 'symbols' is required (comma-separated)");
  }
  const symbols = parseSymbols(symbolsParam);
  if (symbols.length === 0) {
    return badRequest("No valid symbols provided");
  }
  const horizons = normalizeHorizons(url.searchParams.get("horizons"));

  try {
    const result = await runJob(symbols, horizons.length > 0 ? horizons : undefined);
    return NextResponse.json({ ok: true, results: result.results });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to run precompute job";
    return serverMisconfig(message);
  }
}

export async function POST(req: NextRequest) {
  const authError = ensureAuthorized(req);
  if (authError) return authError;

  let symbols: string[] = [];
  let horizons: PrecomputeHorizon[] | undefined;
  try {
    const body = await req.json();
    symbols =
      Array.isArray(body?.symbols) && body.symbols.length > 0
        ? normalizeSymbolsFromArray(body.symbols)
        : parseSymbols(typeof body?.symbols === "string" ? body.symbols : null);
    const parsedHorizons = normalizeHorizons(body?.horizons);
    horizons = parsedHorizons.length > 0 ? parsedHorizons : undefined;
  } catch {
    return badRequest("Invalid JSON body");
  }

  if (!symbols || symbols.length === 0) {
    return badRequest("Body must include 'symbols' as a non-empty array or comma-separated string");
  }

  try {
    const result = await runJob(symbols, horizons);
    return NextResponse.json({ ok: true, results: result.results });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to run precompute job";
    return serverMisconfig(message);
  }
}


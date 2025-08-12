import { load } from "cheerio";
import { createRedisClient } from "../lib/redis";

export type IrDividend = {
  dateIso: string; // YYYY-MM-DD, payment date if available
  amount: number; // USD per share
  sourceUrl: string;
};

export type IrScrapeResult = {
  symbol: string;
  fetchedAtIso: string;
  dividends: IrDividend[];
};

// Very conservative: we attempt a few common IR paths and parse simple tables.
// This is a heuristic fallback used only when Yahoo series have holes.
const COMMON_IR_PATHS = [
  "/investors/dividends", // many issuers
  "/investors/dividend-history",
  "/investors/stock-and-dividends",
  "/investors/stock-information/dividends",
  "/stock/dividends",
];

export async function scrapeIssuerDividends(
  symbol: string,
  issuerBaseUrls: string[]
): Promise<IrScrapeResult | null> {
  const redis = createRedisClient();
  const cacheKey = `ir:${symbol}:divs:v1`;
  const cached = await redis.getJson<IrScrapeResult>(cacheKey);
  if (cached) return cached;

  // politeness: 1 request/symbol per 7 days enforced by cache; we attempt at most one successful fetch
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  let result: IrScrapeResult | null = null;
  try {
    for (const base of issuerBaseUrls) {
      for (const path of COMMON_IR_PATHS) {
        const url = new URL(path, base).toString();
        try {
          const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
          if (!res.ok) continue;
          const html = await res.text();
          const divs = parseDividendTable(html, url);
          if (divs.length > 0) {
            result = { symbol, fetchedAtIso: new Date().toISOString(), dividends: divs };
            break;
          }
        } catch {
          // swallow and continue to next candidate url
        }
      }
      if (result) break;
    }
  } finally {
    clearTimeout(timeoutId);
  }

  if (result) {
    // cache for 7 days
    await redis.setJson(cacheKey, result, 60 * 60 * 24 * 7);
  }
  return result;
}

// A simple parser that looks for tables with columns that resemble Date/Dividend/Amount.
// This is heuristic; in MVP we focus on common formats.
function parseDividendTable(html: string, sourceUrl: string): IrDividend[] {
  const $ = load(html);
  const candidates: IrDividend[] = [];

  $("table").each((_, table) => {
    const headers = $(table)
      .find("thead th, tr:first-child th")
      .map((_, th) => $(th).text().trim().toLowerCase())
      .get();

    const looksLikeDividend = headers.some((h) => /dividend/.test(h)) || headers.some((h) => /amount|cash/.test(h));
    const looksLikeDate = headers.some((h) => /date|payment/.test(h));
    if (!looksLikeDividend || !looksLikeDate) return;

    $(table)
      .find("tbody tr, tr")
      .each((_, tr) => {
        const cells = $(tr)
          .find("td")
          .map((__, td) => $(td).text().trim())
          .get();
        if (cells.length < 2) return;

        const maybeDate = cells.find((t) => /\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2}/.test(t) || /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i.test(t));
        const maybeAmount = cells.find((t) => /\$\s*\d|\d+\.\d{2}/.test(t));
        if (!maybeDate || !maybeAmount) return;

        const iso = normalizeDateToIso(maybeDate);
        const amt = normalizeAmountToNumber(maybeAmount);
        if (iso && isFinite(amt)) {
          candidates.push({ dateIso: iso, amount: amt, sourceUrl });
        }
      });
  });

  // Deduplicate by date, prefer latest amount
  const byDate = new Map<string, IrDividend>();
  for (const d of candidates) byDate.set(d.dateIso, d);
  return Array.from(byDate.values()).sort((a, b) => a.dateIso.localeCompare(b.dateIso));
}

function normalizeDateToIso(text: string): string | null {
  // try YYYY-MM-DD first
  const iso = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  // try MM/DD/YYYY or MM/DD/YY
  const us = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (us) {
    const year = us[3].length === 2 ? `20${us[3]}` : us[3];
    const mm = us[1].padStart(2, "0");
    const dd = us[2].padStart(2, "0");
    return `${year}-${mm}-${dd}`;
  }
  // try Month DD, YYYY
  const m = text.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+(\d{1,2}),\s*(\d{4})/i);
  if (m) {
    const months = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
    const monthIndex = months.findIndex((x) => x === m[1].slice(0,3).toLowerCase());
    const mm = String(monthIndex + 1).padStart(2, "0");
    const dd = m[2].padStart(2, "0");
    return `${m[3]}-${mm}-${dd}`;
  }
  return null;
}

function normalizeAmountToNumber(text: string): number {
  // Remove currency symbols and commas
  const cleaned = text.replace(/[^0-9.]/g, "");
  return Number(cleaned);
}



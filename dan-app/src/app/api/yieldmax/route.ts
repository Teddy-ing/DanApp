import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createRedisClient } from "@/lib/redis";
import { RapidApiKeyMissingError, resolveRapidApiKey } from "@/lib/userKey";
import { fetchDailyCandles, fetchSplitsAndDividends } from "@/providers/yahoo";
import { toApiError } from "@/lib/errors";
import {
  YIELDMAX_CANONICAL,
  type YieldmaxCategory,
  type YieldmaxTicker,
  scrapeYieldmaxRoc,
} from "@/scrapers/yieldmax";

type RateInfo = { value: number | null; overMonths?: number };
type YieldmaxResponse = {
  fetchedAtIso: string;
  source: { fromCache: boolean; warning?: string };
  rateErrors?: string[];
  categories: Array<
    YieldmaxCategory & {
      items: Array<YieldmaxTicker & { rate: RateInfo }>;
    }
  >;
};

const SCRAPE_CACHE_KEY = "yieldmax:scrape:v1";
const RATE_CACHE_PREFIX = "yieldmax:rate";

export async function GET() {
  // Auth
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return jsonError(401, "Unauthorized");
  }

  let rapidApiKey: string;
  try {
    const { key } = await resolveRapidApiKey(userId);
    rapidApiKey = key;
  } catch (e) {
    if (e instanceof RapidApiKeyMissingError) {
      if (e.reason === "shared_missing") {
        return jsonError(
          500,
          "Server misconfiguration: configure RAPIDAPI_SHARED_KEY or enable user RapidAPI keys."
        );
      }
      return jsonError(400, "RapidAPI key not set. Save your key first.");
    }
    const { status, payload } = toApiError(e);
    return NextResponse.json(payload, { status });
  }

  const redis = createRedisClient();
  const cachedScrape = await redis.getJson<{ fetchedAtIso: string; categories: YieldmaxCategory[] }>(SCRAPE_CACHE_KEY);

  let scrapeCategories: YieldmaxCategory[] | null = null;
  let fetchedAtIso: string | null = null;
  let scrapeWarning: string | undefined;

  try {
    const scraped = await scrapeYieldmaxRoc();
    scrapeCategories = scraped.categories;
    fetchedAtIso = scraped.fetchedAtIso;
    await redis.setJson(SCRAPE_CACHE_KEY, scraped, 60 * 60 * 24);
  } catch (err) {
    if (cachedScrape) {
      scrapeCategories = cachedScrape.categories;
      fetchedAtIso = cachedScrape.fetchedAtIso;
      scrapeWarning = "Live ROC scrape failed; showing last cached data.";
    } else {
      const { status, payload } = toApiError(err);
      return NextResponse.json(
        {
          error: { message: "Unable to load YieldMax data right now.", details: payload.error?.details },
        },
        { status: status === 200 ? 502 : status }
      );
    }
  }

  const mergedCategories = mergeWithCanonical(scrapeCategories ?? []);
  const tickers = Array.from(
    new Set(mergedCategories.flatMap((c) => c.items.map((i) => i.symbol)))
  );

  const rateResults = await mapWithConcurrency(tickers, 4, async (symbol) =>
    computeRate(symbol, rapidApiKey, redis)
  );
  const rateBySymbol = new Map<string, RateInfo>();
  const rateErrors: string[] = [];
  rateResults.forEach(({ symbol, rate, error }) => {
    rateBySymbol.set(symbol, rate);
    if (error) rateErrors.push(`${symbol}: ${error}`);
  });

  const categoriesWithRates = mergedCategories.map((cat) => ({
    ...cat,
    items: cat.items.map((item) => ({
      ...item,
      rate: rateBySymbol.get(item.symbol) ?? { value: null },
    })),
  }));

  const payload: YieldmaxResponse = {
    fetchedAtIso: fetchedAtIso ?? new Date().toISOString(),
    source: { fromCache: Boolean(scrapeWarning), warning: scrapeWarning },
    rateErrors: rateErrors.length > 0 ? rateErrors : undefined,
    categories: categoriesWithRates,
  };

  return NextResponse.json(payload);
}

function jsonError(status: number, message: string, details?: unknown) {
  return NextResponse.json(
    { error: { message, details } },
    { status }
  );
}

function mergeWithCanonical(scraped: YieldmaxCategory[]): YieldmaxCategory[] {
  const bySymbol = new Map<string, { categoryTitle: string; item: YieldmaxTicker }>();
  scraped.forEach((cat) => {
    cat.items.forEach((item) => {
      const symbol = item.symbol.toUpperCase();
      bySymbol.set(symbol, { categoryTitle: cat.title, item: { ...item, symbol } });
    });
  });

  return YIELDMAX_CANONICAL.map((canonicalCat) => {
    const items = canonicalCat.items.map<YieldmaxTicker>((canonicalItem) => {
      const scrapedItem = bySymbol.get(canonicalItem.symbol);
      if (scrapedItem) {
        return {
          symbol: canonicalItem.symbol,
          name: scrapedItem.item.name || canonicalItem.name,
          roc: scrapedItem.item.roc ?? null,
          rocRaw: scrapedItem.item.rocRaw ?? null,
        };
      }
      return { ...canonicalItem, roc: null, rocRaw: null };
    });
    // Include any scraped extras that weren't in the canonical list but share the same title
    scraped
      .find((cat) => cat.title === canonicalCat.title)
      ?.items.forEach((item) => {
        if (!items.find((x) => x.symbol === item.symbol)) {
          items.push({ ...item, symbol: item.symbol.toUpperCase() });
        }
      });
    return { title: canonicalCat.title, items };
  });
}

async function computeRate(
  symbol: string,
  rapidApiKey: string,
  redis: ReturnType<typeof createRedisClient>
): Promise<{ symbol: string; rate: RateInfo; error?: string }> {
  const cacheKey = `${RATE_CACHE_PREFIX}:${symbol}:v1`;
  const cached = await redis.getJson<RateInfo>(cacheKey);
  if (cached) {
    return { symbol, rate: cached };
  }

  try {
    const [events, candles] = await Promise.all([
      fetchSplitsAndDividends(symbol, "1y", { rapidApiKey }),
      fetchDailyCandles(symbol, "1y", { rapidApiKey }),
    ]);

    const lastClose = findLastNonNull(candles.map((c) => c.close));
    if (lastClose == null || !events.dividends || events.dividends.length === 0) {
      return { symbol, rate: { value: null }, error: "Missing price or dividends" };
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const yearAgoSec = nowSec - 365 * 24 * 60 * 60;
    const recentDivs = events.dividends.filter((d) => d.dateUtcSeconds >= yearAgoSec);
    if (recentDivs.length === 0) {
      return { symbol, rate: { value: null }, error: "No dividends in the last year" };
    }

    const total = recentDivs.reduce((sum, d) => sum + d.amount, 0);
    const windowStart = Math.min(...recentDivs.map((d) => d.dateUtcSeconds));
    const months = Math.max(1, Math.round((nowSec - windowStart) / (30 * 24 * 60 * 60)));

    const rateValue = total / lastClose;
    const rate: RateInfo = { value: Number.isFinite(rateValue) ? rateValue * 100 : null };
    if (months < 12) {
      rate.overMonths = months;
    }

    await redis.setJson(cacheKey, rate, 60 * 60 * 6); // 6h TTL
    return { symbol, rate };
  } catch (err) {
    const { payload } = toApiError(err);
    return {
      symbol,
      rate: { value: null },
      error: payload.error?.message || "Rate lookup failed",
    };
  }
}

function findLastNonNull(values: Array<number | null>): number | null {
  for (let i = values.length - 1; i >= 0; i -= 1) {
    const v = values[i];
    if (v != null && Number.isFinite(v)) return v;
  }
  return null;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  let idx = 0;

  async function next(): Promise<void> {
    if (idx >= items.length) return;
    const current = idx;
    idx += 1;
    results[current] = await worker(items[current]);
    return next();
  }

  const runners = Array.from({ length: Math.min(limit, items.length) }, () => next());
  await Promise.all(runners);
  return results;
}


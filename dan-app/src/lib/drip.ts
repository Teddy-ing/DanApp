import type { DailyCandle, DividendEvent, SplitEvent } from "../providers/yahoo";
import { buildTradingCalendar, nyTodayDateString, toNyDateString } from "./calendar";
import { z } from "zod";

export type DripInputSeries = {
  symbol: string;
  candles: DailyCandle[];
  splits: SplitEvent[];
  dividends: DividendEvent[];
};

export type DripOptions = {
  base: number;
  horizon: "5y" | "max";
};

export type DripOutput = {
  dates: string[];
  series: Array<{
    symbol: string;
    value: (number | null)[];
    pct: (number | null)[];
  }>;
};

function clampIsoToValidDate(isoYmd: string): string {
  // Handles cases like 2019-02-29 → 2019-02-28
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoYmd);
  if (!m) return isoYmd;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const jsDate = new Date(Date.UTC(year, month - 1, day));
  const valid = jsDate.getUTCFullYear() === year && jsDate.getUTCMonth() === month - 1 && jsDate.getUTCDate() === day;
  if (valid) return isoYmd;
  // fallback: decrement day until valid
  let d = day;
  while (d > 28) {
    const test = new Date(Date.UTC(year, month - 1, d));
    if (test.getUTCMonth() === month - 1 && test.getUTCDate() === d) {
      const mm = String(month).padStart(2, "0");
      const dd = String(d).padStart(2, "0");
      return `${year}-${mm}-${dd}`;
    }
    d -= 1;
  }
  const mm = String(month).padStart(2, "0");
  return `${year}-${mm}-28`;
}

function nyFiveYearsAgoBoundaryIso(nyTodayIso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(nyTodayIso);
  if (!m) return nyTodayIso;
  const year = Number(m[1]);
  const month = m[2];
  const day = m[3];
  const boundary = `${String(year - 5).padStart(4, "0")}-${month}-${day}`;
  return clampIsoToValidDate(boundary);
}

function toMapByNyDate<T extends { dateUtcSeconds: number }>(items: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const it of items) {
    const key = toNyDateString(it.dateUtcSeconds);
    const arr = map.get(key);
    if (arr) arr.push(it);
    else map.set(key, [it]);
  }
  return map;
}

function toCandleByNyDate(candles: DailyCandle[]): Map<string, DailyCandle> {
  const map = new Map<string, DailyCandle>();
  for (const c of candles) {
    const key = toNyDateString(c.dateUtcSeconds);
    // prefer later non-null data if duplicates occur
    const prev = map.get(key);
    if (!prev || (prev.close == null && c.close != null)) {
      map.set(key, c);
    }
  }
  return map;
}

function roundShares4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

// Runtime guards (lenient): coerce where possible, skip invalid
const zCandle = z.object({
  dateUtcSeconds: z.coerce.number().finite().positive(),
  open: z.coerce.number().finite().optional().nullable(),
  high: z.coerce.number().finite().optional().nullable(),
  low: z.coerce.number().finite().optional().nullable(),
  close: z.coerce.number().finite().optional().nullable(),
  volume: z.coerce.number().finite().optional().nullable(),
  adjClose: z.coerce.number().finite().optional().nullable(),
});

const zSplit = z.object({
  dateUtcSeconds: z.coerce.number().finite().positive(),
  ratio: z.coerce.number().finite().positive(),
});

const zDividend = z.object({
  dateUtcSeconds: z.coerce.number().finite().positive(),
  amount: z.coerce.number().finite(),
});

function sanitizeCandles(input: DailyCandle[] | undefined | null): DailyCandle[] {
  const out: DailyCandle[] = [];
  for (const c of input ?? []) {
    const parsed = zCandle.safeParse(c as unknown);
    if (!parsed.success) continue;
    const v = parsed.data;
    out.push({
      dateUtcSeconds: v.dateUtcSeconds,
      open: Number.isFinite(v.open as number) ? (v.open as number) : null,
      high: Number.isFinite(v.high as number) ? (v.high as number) : null,
      low: Number.isFinite(v.low as number) ? (v.low as number) : null,
      close: Number.isFinite(v.close as number) ? (v.close as number) : null,
      volume: Number.isFinite(v.volume as number) ? (v.volume as number) : null,
      adjClose: Number.isFinite(v.adjClose as number) ? (v.adjClose as number) : null,
    });
  }
  return out;
}

function sanitizeSplits(input: SplitEvent[] | undefined | null): SplitEvent[] {
  const out: SplitEvent[] = [];
  for (const s of input ?? []) {
    const parsed = zSplit.safeParse(s as unknown);
    if (!parsed.success) continue;
    out.push({ dateUtcSeconds: parsed.data.dateUtcSeconds, ratio: parsed.data.ratio });
  }
  return out;
}

function sanitizeDividends(input: DividendEvent[] | undefined | null): DividendEvent[] {
  const out: DividendEvent[] = [];
  for (const d of input ?? []) {
    const parsed = zDividend.safeParse(d as unknown);
    if (!parsed.success) continue;
    // Silently ignore non-positive amounts
    if (!(parsed.data.amount > 0)) continue;
    out.push({ dateUtcSeconds: parsed.data.dateUtcSeconds, amount: parsed.data.amount });
  }
  return out;
}

export function computeDripSeries(inputs: DripInputSeries[], options: DripOptions): DripOutput {
  const baseInvestment = options.base;
  if (!(baseInvestment > 0)) {
    throw new Error("Base must be a positive number");
  }

  const nyToday = nyTodayDateString();
  const startBoundaryIso = options.horizon === "5y" ? nyFiveYearsAgoBoundaryIso(nyToday) : undefined;

  // Sanitize inputs per symbol (lenient)
  const sanitized = inputs.map((s) => ({
    symbol: s.symbol,
    candles: sanitizeCandles(s.candles),
    splits: sanitizeSplits(s.splits),
    dividends: sanitizeDividends(s.dividends),
  }));

  // Build union trading calendar across symbols based on provider data
  const calendar = buildTradingCalendar(
    sanitized.map((s) => s.candles),
    { startDate: startBoundaryIso, endDate: nyToday }
  );

  if (calendar.length === 0) {
    return {
      dates: [],
      series: sanitized.map((s) => ({ symbol: s.symbol, value: [], pct: [] })),
    };
  }

  // Precompute lookups per symbol
  type Prepared = {
    symbol: string;
    byDate: Map<string, DailyCandle>;
    splitsByDate: Map<string, SplitEvent[]>;
    sortedDividends: Array<{ dateIso: string; amount: number }>;
  };

  const prepared: Prepared[] = sanitized.map((s) => ({
    symbol: s.symbol,
    byDate: toCandleByNyDate(s.candles),
    splitsByDate: toMapByNyDate(s.splits ?? []),
    sortedDividends: (s.dividends ?? [])
      .map((d) => ({ dateIso: toNyDateString(d.dateUtcSeconds), amount: d.amount }))
      .sort((a, b) => (a.dateIso < b.dateIso ? -1 : a.dateIso > b.dateIso ? 1 : 0)),
  }));

  const seriesOutputs: DripOutput["series"] = [];

  for (const p of prepared) {
    const values: (number | null)[] = [];
    const pcts: (number | null)[] = [];

    let started = false;
    let shares = 0;
    let sharesAtPriorClose = 0; // shares at the end of the previous trading day
    let pendingCash = 0; // dividend cash waiting for next available open
    let divIdx = 0;

    for (const d of calendar) {
      const candle = p.byDate.get(d);
      const openPrice = candle?.open ?? null;
      const closePrice = candle?.close ?? null;

      if (!started && closePrice != null) {
        // Initialize on the first available close on/after the boundary
        shares = roundShares4(baseInvestment / closePrice);
        started = true;
      }

      // Process dividends with pay date <= current trading date.
      while (divIdx < p.sortedDividends.length && p.sortedDividends[divIdx].dateIso <= d) {
        const dv = p.sortedDividends[divIdx];
        divIdx += 1;
        if (started) {
          const amt = dv.amount;
          if (typeof amt === "number" && isFinite(amt) && amt > 0) {
            // Cash computed using shares at the previous trading day's close
            pendingCash += sharesAtPriorClose * amt;
          }
        }
      }

      if (started) {
        // 1) Apply splits effective on d
        const splitsToday = p.splitsByDate.get(d);
        if (splitsToday && splitsToday.length > 0) {
          for (const s of splitsToday) {
            if (typeof s.ratio === "number" && isFinite(s.ratio) && s.ratio > 0) {
              shares = roundShares4(shares * s.ratio);
            }
          }
        }

        // 2) Execute any pending reinvestment at the next trading-day open when available
        if (pendingCash > 0 && openPrice != null) {
          const addedShares = roundShares4(pendingCash / openPrice);
          if (addedShares > 0) {
            shares = roundShares4(shares + addedShares);
          }
          pendingCash = 0;
        }
      }

      // 4) Valuation at close
      if (started && closePrice != null) {
        const value = shares * closePrice;
        values.push(value);
        pcts.push((value - baseInvestment) / baseInvestment);
      } else {
        values.push(null);
        pcts.push(null);
      }

      // Update prior-close shares snapshot for the next iteration
      sharesAtPriorClose = started ? shares : 0;
    }

    seriesOutputs.push({ symbol: p.symbol, value: values, pct: pcts });
  }

  return { dates: calendar, series: seriesOutputs };
}



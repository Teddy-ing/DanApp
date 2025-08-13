import type { DailyCandle, DividendEvent, SplitEvent } from "../providers/yahoo";
import { buildTradingCalendar, nyTodayDateString, toNyDateString } from "./calendar";

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

export function computeDripSeries(inputs: DripInputSeries[], options: DripOptions): DripOutput {
  const baseInvestment = options.base;
  if (!(baseInvestment > 0)) {
    throw new Error("Base must be a positive number");
  }

  const nyToday = nyTodayDateString();
  const startBoundaryIso = options.horizon === "5y" ? nyFiveYearsAgoBoundaryIso(nyToday) : undefined;

  // Build union trading calendar across symbols based on provider data
  const calendar = buildTradingCalendar(
    inputs.map((s) => s.candles),
    { startDate: startBoundaryIso, endDate: nyToday }
  );

  // Precompute lookups per symbol
  type Prepared = {
    symbol: string;
    byDate: Map<string, DailyCandle>;
    splitsByDate: Map<string, SplitEvent[]>;
    dividendsByDate: Map<string, DividendEvent[]>;
  };

  const prepared: Prepared[] = inputs.map((s) => ({
    symbol: s.symbol,
    byDate: toCandleByNyDate(s.candles),
    splitsByDate: toMapByNyDate(s.splits ?? []),
    dividendsByDate: toMapByNyDate(s.dividends ?? []),
  }));

  const seriesOutputs: DripOutput["series"] = [];

  for (const p of prepared) {
    const values: (number | null)[] = [];
    const pcts: (number | null)[] = [];

    let started = false;
    let shares = 0;
    let pendingCash = 0; // dividend cash waiting for next available open

    for (const d of calendar) {
      const candle = p.byDate.get(d);
      const openPrice = candle?.open ?? null;
      const closePrice = candle?.close ?? null;

      if (!started && closePrice != null) {
        // Initialize on the first available close on/after the boundary
        shares = roundShares4(baseInvestment / closePrice);
        started = true;
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

        // 3) If dividend payment occurs on d, accrue cash to reinvest on the next trading day
        const divsToday = p.dividendsByDate.get(d);
        if (divsToday && divsToday.length > 0) {
          for (const dv of divsToday) {
            const amt = dv.amount;
            if (typeof amt === "number" && isFinite(amt) && amt > 0) {
              pendingCash += shares * amt;
            }
          }
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
    }

    seriesOutputs.push({ symbol: p.symbol, value: values, pct: pcts });
  }

  return { dates: calendar, series: seriesOutputs };
}



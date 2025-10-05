import { describe, it, expect } from "vitest";
import { computeDripSeries } from "../drip";
import type { DailyCandle, DividendEvent, SplitEvent } from "../../providers/yahoo";
import * as TSLA from "./drip.tsla.fixture";
import * as NVDA from "./drip.nvda.fixture";
import * as GOOG from "./drip.goog.fixture";
import * as AAPL from "./drip.aapl.fixture";
import * as SPY from "./drip.spy.fixture";

function runSingle(symbol: string, candles: DailyCandle[], dividends: DividendEvent[], splits: SplitEvent[]) {
  return computeDripSeries([
    { symbol, candles, dividends, splits },
  ], { base: 1000, horizon: "5y" });
}

function centsEqual(actual: number[], expected: number[]) {
  expect(actual.map((v) => Number(v.toFixed(2)))).toEqual(expected.map((v) => Number(v.toFixed(2))));
}

function expectedNoDividend(candles: { close: number | null }[]) {
  const start = candles.find((c) => c.close != null)!.close as number;
  const shares = Math.round((1000 / start) * 10000) / 10000;
  return candles.map((c) => (c.close == null ? NaN : shares * (c.close as number)));
}

function expectedSingleDividend(
  dates: string[],
  candles: { open: number | null; close: number | null }[],
  divDateIso: string,
  divAmount: number
) {
  const shares0 = Math.round((1000 / (candles[0].close as number)) * 10000) / 10000;
  let shares = shares0;
  let cash = 0;
  const values: number[] = [];
  let prevCloseShares = shares0;
  for (let i = 0; i < candles.length; i += 1) {
    const iso = dates[i];
    // dividend cash accrues at pay date using shares at prior close
    if (iso === divDateIso) {
      cash += prevCloseShares * divAmount;
    }
    // reinvest at next available open
    if (cash > 0 && candles[i].open != null) {
      shares = Math.round((shares + cash / (candles[i].open as number)) * 10000) / 10000;
      cash = 0;
    }
    const close = candles[i].close as number;
    values.push(shares * close);
    prevCloseShares = shares;
  }
  return values;
}

describe("DRIP multi-symbol checks", () => {
  it("TSLA no-div window matches cents", () => {
    const out = runSingle("TSLA", TSLA.CANDLES, TSLA.DIVIDENDS, TSLA.SPLITS);
    const expected = expectedNoDividend(TSLA.CANDLES);
    centsEqual(out.series[0].value.slice(0, TSLA.DATES.length) as number[], expected);
  });

  it("NVDA no-div window matches cents", () => {
    const out = runSingle("NVDA", NVDA.CANDLES, NVDA.DIVIDENDS, NVDA.SPLITS);
    const expected = expectedNoDividend(NVDA.CANDLES);
    centsEqual(out.series[0].value.slice(0, NVDA.DATES.length) as number[], expected);
  });

  it("GOOG no-div window matches cents", () => {
    const out = runSingle("GOOG", GOOG.CANDLES, GOOG.DIVIDENDS, GOOG.SPLITS);
    const expected = expectedNoDividend(GOOG.CANDLES);
    centsEqual(out.series[0].value.slice(0, GOOG.DATES.length) as number[], expected);
  });

  it("AAPL single dividend reinvests at next open to cents", () => {
  const out = runSingle("AAPL", AAPL.CANDLES, AAPL.DIVIDENDS, AAPL.SPLITS);
  const expected = expectedSingleDividend(AAPL.DATES, AAPL.CANDLES as Array<Pick<DailyCandle,'open'|'close'>>, "2024-08-08", 0.25);
    centsEqual(out.series[0].value.slice(0, AAPL.DATES.length) as number[], expected);
  });

  it("SPY single distribution reinvests at next open to cents", () => {
  const out = runSingle("SPY", SPY.CANDLES, SPY.DIVIDENDS, SPY.SPLITS);
  const expected = expectedSingleDividend(SPY.DATES, SPY.CANDLES as Array<Pick<DailyCandle,'open'|'close'>>, "2024-12-20", 1.00);
    centsEqual(out.series[0].value.slice(0, SPY.DATES.length) as number[], expected);
  });
});



import { describe, it, expect } from "vitest";
import { computeDripSeries } from "../drip";
import { CANDLES, DIVIDENDS, SPLITS, DATES } from "./drip.mstr.fixture";

// Helper: run computeDripSeries with fixed base and 5y horizon (unused for custom dates)
function run(base: number = 1000) {
  return computeDripSeries(
    [
      {
        symbol: "MSTR",
        candles: CANDLES,
        dividends: DIVIDENDS,
        splits: SPLITS,
      },
    ],
    { base, horizon: "5y" }
  );
}

// Ground-truth model for expected values used in assertions:
// Rationale: Yahoo "chart" candles are historically split-adjusted.
// Therefore, shares should be constant through a split; the split ratio
// should NOT multiply shares again. Dollar value each day is simply
// shares0 * close(d), where shares0 = base / close(first-trading-day).
function expectedValues(base: number): number[] {
  const startClose = CANDLES.find((c) => c.close != null)!.close as number;
  const shares0 = Math.round((base / startClose) * 10000) / 10000; // match roundShares4
  return CANDLES.map((c) => (c.close == null ? NaN : shares0 * (c.close as number)));
}

describe("computeDripSeries — MSTR Aug 2024 split continuity", () => {
  it("matches ground-truth per-day dollar values to the cent", () => {
    const base = 1000;
    const out = run(base);
    expect(out.series).toHaveLength(1);
    const { value } = out.series[0];
    // Sanity: align dates to fixture
    expect(out.dates.slice(0, DATES.length)).toEqual(DATES);

    const expected = expectedValues(base).map((v) => Number(v.toFixed(2)));
    const actual = value.slice(0, DATES.length).map((v) => Number((v ?? NaN).toFixed(2)));

    // Strong assertion: identical cents for every date.
    expect(actual).toEqual(expected);
  });
});



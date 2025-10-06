import { describe, it, expect } from "vitest";
import { computeDripSeries } from "../drip";
import * as FX from "./drip.unadjusted.fixture";

describe("Unadjusted split detection", () => {
  it("applies split to shares when prices drop by ratio", () => {
    const out = computeDripSeries([
      { symbol: "SYNTH", candles: FX.CANDLES, dividends: FX.DIVIDENDS, splits: FX.SPLITS },
    ], { base: 1000, horizon: "5y" });
    const values = out.series[0].value.slice(0, FX.DATES.length) as number[];
    // Base at first close 100 → shares 10. After 2-for-1 split with unadjusted prices (51),
    // detector should double shares to ~20 so value continuity holds around 51*20 ≈ 1020.
    const afterSplitIdx = FX.DATES.indexOf("2024-03-06");
    const vBefore = Number((values[afterSplitIdx - 1]!).toFixed(2));
    const vAfter = Number((values[afterSplitIdx]!).toFixed(2));
    expect(Math.abs(vAfter - vBefore) < 15).toBe(true); // allow small discontinuity due to rounding
  });
});



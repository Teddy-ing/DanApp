import { describe, it, expect } from "vitest";
import { computeDripSeries } from "../drip";
import * as FX from "./drip.reverse.fixture";

describe("Unadjusted reverse split detection", () => {
  it("applies reverse split to shares when prices jump by inverse ratio", () => {
    const out = computeDripSeries([
      { symbol: "REV", candles: FX.CANDLES, dividends: FX.DIVIDENDS, splits: FX.SPLITS },
    ], { base: 1000, horizon: "5y" });
    const values = out.series[0].value.slice(0, FX.DATES.length) as number[];
    const idx = FX.DATES.indexOf("2024-04-04");
    const vBefore = Number((values[idx - 1]!).toFixed(2));
    const vAfter = Number((values[idx]!).toFixed(2));
    // Value continuity across reverse split (allow small difference)
    expect(Math.abs(vAfter - vBefore) < 25).toBe(true);
  });
});



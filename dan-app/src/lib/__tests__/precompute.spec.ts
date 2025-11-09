import { describe, expect, it } from "vitest";
import { computeDrawdownFromGrowth, mapGrowthToValueAndPct } from "../precompute";

describe("mapGrowthToValueAndPct", () => {
  it("converts growth ratios into value and pct arrays", () => {
    const growth = [null, 1, 1.5, 0.9];
    const { value, pct } = mapGrowthToValueAndPct(growth, 1000);
    expect(value).toEqual([null, 1000, 1500, 900]);
    expect(pct).toEqual([null, 0, 0.5, -0.09999999999999998]);
  });
});

describe("computeDrawdownFromGrowth", () => {
  it("returns drawdown percentages relative to prior peaks", () => {
    const growth = [null, 1, 1.5, 1.2, 1.6, 1.4];
    const result = computeDrawdownFromGrowth(growth);
    expect(result[0]).toBeNull();
    expect(result[1]).toBe(0);
    expect(result[2]).toBe(0);
    expect(result[3]).toBeCloseTo(-0.2);
    expect(result[4]).toBe(0);
    expect(result[5]).toBeCloseTo(-0.125);
  });

  it("handles flat or zero peaks safely", () => {
    const growth = [0, 0, 0.5, 0.25];
    const result = computeDrawdownFromGrowth(growth);
    expect(result).toEqual([0, 0, 0, -0.5]);
  });
});


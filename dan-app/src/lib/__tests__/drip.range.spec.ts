import { describe, it, expect } from "vitest";
import { computeDripSeries } from "../drip";
import type { DailyCandle } from "../../providers/yahoo";

function makeCandle(iso: string, price: number): DailyCandle {
  const seconds = Math.floor(new Date(`${iso}T21:00:00Z`).getTime() / 1000);
  return {
    dateUtcSeconds: seconds,
    open: price,
    high: price,
    low: price,
    close: price,
    volume: 1,
    adjClose: price,
  };
}

describe("computeDripSeries range override", () => {
  it("clips the calendar to the override window", () => {
    const candles: DailyCandle[] = [
      makeCandle("2020-12-31", 10),
      makeCandle("2021-01-04", 11),
      makeCandle("2021-06-01", 12),
      makeCandle("2022-01-03", 13),
    ];

    const out = computeDripSeries(
      [{ symbol: "TEST", candles, splits: [], dividends: [] }],
      {
        base: 1000,
        horizon: "max",
        rangeOverride: { start: "2021-01-01", end: "2021-12-31" },
      }
    );

    expect(out.dates).toEqual(["2021-01-04", "2021-06-01"]);
    expect(out.series[0].value.length).toBe(2);
  });
});



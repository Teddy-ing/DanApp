import { describe, expect, it } from "vitest";
import { buildMonthlyAnalytics } from "../monthlyAnalytics";

describe("buildMonthlyAnalytics horizon filtering", () => {
  const dates = [
    "2023-12-01",
    "2024-01-01",
    "2024-02-01",
    "2024-03-01",
    "2024-06-01",
    "2025-01-01",
  ];
  const series = [
    {
      symbol: "AAA",
      value: [100, 110, 120, 130, 140, 200],
    },
  ];

  it("keeps only months within the selected horizon window", () => {
    const analytics = buildMonthlyAnalytics({ dates, series, horizon: "1y" });
    const cells = analytics.bySymbol.get("AAA")?.cells ?? [];
    expect(cells.map((cell) => cell.date)).toEqual(["2024-02-01", "2024-03-01", "2024-06-01", "2025-01-01"]);
  });

  it("includes all months when horizon is max", () => {
    const analytics = buildMonthlyAnalytics({ dates, series, horizon: "max" });
    const cells = analytics.bySymbol.get("AAA")?.cells ?? [];
    expect(cells.map((cell) => cell.date)).toEqual(dates);
  });
});


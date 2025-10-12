import type { DailyCandle, DividendEvent, SplitEvent } from "../../providers/yahoo";

// Fixture: MSTR closes and opens for 2024-08-01..2024-08-13 inclusive.
// Values provided by user; we set open equal to close to isolate split logic.
// No dividends in this window.

export const DATES: string[] = [
  "2024-08-01",
  "2024-08-02",
  "2024-08-05",
  "2024-08-06",
  "2024-08-07", // split effective date (10-for-1)
  "2024-08-08",
  "2024-08-09",
  "2024-08-13",
];

// Helper to create a UTC seconds timestamp for 16:00 NY close. We only need ordering.
function ts(iso: string): number {
  // 20:00 UTC during EDT close; precision not important for ordering
  return Math.floor(new Date(`${iso}T20:00:00.000Z`).getTime() / 1000);
}

// Close prices from the report
const CLOSES: number[] = [151.1, 144.7, 130.9, 136.9, 124.6, 135.9, 135.4, 135.4];

export const CANDLES: DailyCandle[] = DATES.map((d, i) => ({
  dateUtcSeconds: ts(d),
  open: CLOSES[i],
  high: CLOSES[i],
  low: CLOSES[i],
  close: CLOSES[i],
  volume: 0,
  adjClose: CLOSES[i],
}));

// 10-for-1 split on 2024-08-07
export const SPLITS: SplitEvent[] = [
  { dateUtcSeconds: ts("2024-08-07"), ratio: 10 },
];

export const DIVIDENDS: DividendEvent[] = [];



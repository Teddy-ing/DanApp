import type { DailyCandle, DividendEvent, SplitEvent } from "../../providers/yahoo";

// Synthetic fixture to simulate an unadjusted price series around a 2-for-1 split.
// Prices drop by ~2x on the split date; our detector should multiply shares by 2.

export const DATES = [
  "2024-03-01",
  "2024-03-04",
  "2024-03-05",
  "2024-03-06", // split day
  "2024-03-07",
  "2024-03-08",
];

function ts(iso: string): number { return Math.floor(new Date(`${iso}T20:00:00Z`).getTime()/1000); }

// Unadjusted closes: 100, 102, 101, 51, 52, 53 (approx half)
const CLOSES = [100, 102, 101, 51, 52, 53];
const OPENS  = [100, 101, 101, 50, 51, 52];

export const CANDLES: DailyCandle[] = DATES.map((d, i) => ({
  dateUtcSeconds: ts(d),
  open: OPENS[i],
  high: CLOSES[i],
  low: CLOSES[i],
  close: CLOSES[i],
  volume: 0,
  adjClose: CLOSES[i],
}));

export const SPLITS: SplitEvent[] = [
  { dateUtcSeconds: ts("2024-03-06"), ratio: 2 },
];

export const DIVIDENDS: DividendEvent[] = [];



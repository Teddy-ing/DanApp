import type { DailyCandle, DividendEvent, SplitEvent } from "../../providers/yahoo";

// Synthetic reverse split 1-for-10: prices jump ~10x on split day in unadjusted data.

export const DATES = [
  "2024-04-01",
  "2024-04-02",
  "2024-04-03",
  "2024-04-04", // reverse split day
  "2024-04-05",
];

function ts(iso: string): number { return Math.floor(new Date(`${iso}T20:00:00Z`).getTime()/1000); }

// Unadjusted closes: 1.00, 1.05, 1.00, 10.2, 10.5
const CLOSES = [1.00, 1.05, 1.00, 10.2, 10.5];
const OPENS  = [1.00, 1.04, 1.01, 10.0, 10.3];

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
  { dateUtcSeconds: ts("2024-04-04"), ratio: 0.1 }, // 1-for-10 reverse split → ratio 0.1
];

export const DIVIDENDS: DividendEvent[] = [];



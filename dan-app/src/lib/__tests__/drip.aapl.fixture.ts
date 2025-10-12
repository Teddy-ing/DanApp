import type { DailyCandle, DividendEvent, SplitEvent } from "../../providers/yahoo";

export const DATES = [
  "2024-08-01",
  "2024-08-02",
  "2024-08-05",
  "2024-08-06",
  "2024-08-07",
  "2024-08-08",
  "2024-08-09",
  "2024-08-12",
  "2024-08-13",
];

function ts(iso: string): number { return Math.floor(new Date(`${iso}T20:00:00Z`).getTime()/1000); }

// AAPL closes (approx). Dividend $0.25 paid 2024-08-08.
const CLOSES = [216.3, 209.3, 205.0, 205.3, 200.7, 212.6, 211.6, 212.2, 213.4];
const OPENS  = [216.0, 210.0, 206.0, 204.7, 202.0, 212.0, 212.0, 212.1, 212.8];

export const CANDLES: DailyCandle[] = DATES.map((d, i) => ({
  dateUtcSeconds: ts(d),
  open: OPENS[i],
  high: CLOSES[i],
  low: CLOSES[i],
  close: CLOSES[i],
  volume: 0,
  adjClose: CLOSES[i],
}));

export const SPLITS: SplitEvent[] = [];
export const DIVIDENDS: DividendEvent[] = [
  { dateUtcSeconds: ts("2024-08-08"), amount: 0.25 },
];



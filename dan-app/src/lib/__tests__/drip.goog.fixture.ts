import type { DailyCandle, DividendEvent, SplitEvent } from "../../providers/yahoo";

export const DATES = [
  "2024-08-01",
  "2024-08-02",
  "2024-08-05",
  "2024-08-06",
  "2024-08-07",
  "2024-08-08",
  "2024-08-09",
  "2024-08-13",
];

function ts(iso: string): number { return Math.floor(new Date(`${iso}T20:00:00Z`).getTime()/1000); }

// GOOG closes (approx)
const CLOSES = [169.2, 165.7, 164.3, 164.0, 161.2, 162.3, 160.9, 163.1];

export const CANDLES: DailyCandle[] = DATES.map((d, i) => ({
  dateUtcSeconds: ts(d),
  open: CLOSES[i],
  high: CLOSES[i],
  low: CLOSES[i],
  close: CLOSES[i],
  volume: 0,
  adjClose: CLOSES[i],
}));

export const SPLITS: SplitEvent[] = [];
export const DIVIDENDS: DividendEvent[] = [];



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

// NVDA closes (approx)
const CLOSES = [117.7, 110.0, 108.8, 110.8, 107.5, 116.3, 111.8, 114.8];

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



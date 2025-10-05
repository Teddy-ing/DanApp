import type { DailyCandle, DividendEvent, SplitEvent } from "../../providers/yahoo";

export const DATES = [
  "2024-12-16",
  "2024-12-17",
  "2024-12-18",
  "2024-12-19",
  "2024-12-20", // dividend pay date example (~quarterly)
  "2024-12-23",
  "2024-12-24",
  "2024-12-26",
];

function ts(iso: string): number { return Math.floor(new Date(`${iso}T20:00:00Z`).getTime()/1000); }

// Synthetic but realistic: close/open around December; dividend $1.00 per share 12-20.
const CLOSES = [565, 567, 570, 572, 568, 570, 571, 573];
const OPENS  = [564, 566, 569, 571, 567, 569, 570, 572];

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
  { dateUtcSeconds: ts("2024-12-20"), amount: 1.00 },
];



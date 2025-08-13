import type { DailyCandle } from "../providers/yahoo";

// Helpers for America/New_York date handling and trading-day calendar derivation

const NY_TIME_ZONE = "America/New_York";

function formatDatePartsToIso(year: string, month: string, day: string): string {
  return `${year}-${month}-${day}`;
}

function formatDateToNyIso(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: NY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((p) => p.type === "year")?.value ?? "0000";
  const month = parts.find((p) => p.type === "month")?.value ?? "00";
  const day = parts.find((p) => p.type === "day")?.value ?? "00";
  return formatDatePartsToIso(year, month, day);
}

export function toNyDateString(dateUtcSeconds: number): string {
  const date = new Date(Math.floor(dateUtcSeconds) * 1000);
  return formatDateToNyIso(date);
}

export function nyTodayDateString(): string {
  return formatDateToNyIso(new Date());
}

function isIsoDateString(value: string): boolean {
  return /^(\d{4})-(\d{2})-(\d{2})$/.test(value);
}

function toNyIsoFromUnknown(input: string | number | Date): string {
  if (typeof input === "string") {
    if (isIsoDateString(input)) return input;
    const parsed = new Date(input);
    return formatDateToNyIso(parsed);
  }
  if (typeof input === "number") {
    const seconds = input > 1e12 ? Math.floor(input / 1000) : Math.floor(input);
    return toNyDateString(seconds);
  }
  return formatDateToNyIso(input);
}

export type BuildCalendarOptions = {
  startDate?: string | number | Date;
  endDate?: string | number | Date;
};

function normalizeToSeriesArray(
  input: ReadonlyArray<DailyCandle> | ReadonlyArray<ReadonlyArray<DailyCandle>>
): ReadonlyArray<ReadonlyArray<DailyCandle>> {
  if (Array.isArray(input) && input.length > 0 && Array.isArray(input[0])) {
    return input as ReadonlyArray<ReadonlyArray<DailyCandle>>;
  }
  return [input as ReadonlyArray<DailyCandle>];
}

export function buildTradingCalendar(
  candleSeries: ReadonlyArray<DailyCandle> | ReadonlyArray<ReadonlyArray<DailyCandle>>,
  options: BuildCalendarOptions = {}
): string[] {
  const seriesArray = normalizeToSeriesArray(candleSeries);
  const nyDateSet = new Set<string>();

  for (const series of seriesArray) {
    for (const candle of series) {
      const ts = candle?.dateUtcSeconds ?? 0;
      if (typeof ts === "number" && ts > 0) {
        nyDateSet.add(toNyDateString(ts));
      }
    }
  }

  if (nyDateSet.size === 0) {
    // No provider data → nothing to derive
    return [];
  }

  const allDates = Array.from(nyDateSet);
  allDates.sort();

  const inferredStart = allDates[0];
  const startIso = options.startDate ? toNyIsoFromUnknown(options.startDate) : inferredStart;
  const endIso = options.endDate ? toNyIsoFromUnknown(options.endDate) : nyTodayDateString();

  // Filter union of provider trading dates to the requested window [startIso, endIso]
  const inRange = allDates.filter((d) => d >= startIso && d <= endIso);
  inRange.sort();
  return inRange;
}



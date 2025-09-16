import type { DailyCandle } from "@/providers/yahoo";

export type StatsBucket = {
  close: number | null;
  intradayVariation: number | null; // 0..1
  returnsFrom: { d1: number | null; d5: number | null; d10: number | null; d15: number | null; d20: number | null };
};

export type StatsAgg = {
  average?: StatsBucket; // present for lastYear only
  min: StatsBucket;
  max: StatsBucket;
  std: StatsBucket; // population std
  var: StatsBucket; // population var
};

export type SymbolStats = {
  current: StatsBucket;
  lastYear: StatsAgg;
  allTime: StatsAgg;
};

function lastDefined<T>(arr: Array<T | null | undefined>): T | null {
  for (let i = arr.length - 1; i >= 0; i -= 1) {
    const v = arr[i];
    if (v !== null && v !== undefined) return v as T;
  }
  return null;
}

function computeIntradayVariationPerRow(candles: DailyCandle[]): Array<number | null> {
  return candles.map((c) => {
    if (c.high == null || c.low == null || c.close == null || c.close === 0) return null;
    return (c.high - c.low) / c.close;
  });
}

function computeReturnSeries(close: Array<number | null>, window: number): Array<number | null> {
  const out: Array<number | null> = new Array(close.length).fill(null);
  for (let i = 0; i < close.length; i += 1) {
    const j = i - window;
    if (j >= 0 && close[i] != null && close[j] != null && (close as number[])[j] !== 0) {
      const curr = close[i] as number;
      const past = close[j] as number;
      out[i] = past === 0 ? null : curr / past - 1;
    } else {
      out[i] = null;
    }
  }
  return out;
}

function tail<T>(arr: T[], n: number): T[] {
  if (n <= 0) return [];
  return arr.slice(Math.max(0, arr.length - n));
}

function pickCurrent<T>(arr: Array<T | null>): T | null {
  return lastDefined<T>(arr);
}

function avg(values: Array<number | null>): number | null {
  const xs = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (xs.length === 0) return null;
  const s = xs.reduce((a, b) => a + b, 0);
  return s / xs.length;
}

function minVal(values: Array<number | null>): number | null {
  const xs = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (xs.length === 0) return null;
  return Math.min(...xs);
}

function maxVal(values: Array<number | null>): number | null {
  const xs = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (xs.length === 0) return null;
  return Math.max(...xs);
}

function variancePopulation(values: Array<number | null>): number | null {
  const xs = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (xs.length === 0) return null;
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  const sse = xs.reduce((acc, x) => acc + (x - m) * (x - m), 0);
  return sse / xs.length;
}

function stdPopulation(values: Array<number | null>): number | null {
  const v = variancePopulation(values);
  return v == null ? null : Math.sqrt(v);
}

function buildAgg(windowValues: {
  close: Array<number | null>;
  intraday: Array<number | null>;
  d1: Array<number | null>;
  d5: Array<number | null>;
  d10: Array<number | null>;
  d15: Array<number | null>;
  d20: Array<number | null>;
}, includeAverage: boolean): StatsAgg {
  const average: StatsBucket | undefined = includeAverage ? {
    close: avg(windowValues.close),
    intradayVariation: avg(windowValues.intraday),
    returnsFrom: {
      d1: avg(windowValues.d1),
      d5: avg(windowValues.d5),
      d10: avg(windowValues.d10),
      d15: avg(windowValues.d15),
      d20: avg(windowValues.d20),
    },
  } : undefined;

  return {
    average,
    min: {
      close: minVal(windowValues.close),
      intradayVariation: minVal(windowValues.intraday),
      returnsFrom: {
        d1: minVal(windowValues.d1),
        d5: minVal(windowValues.d5),
        d10: minVal(windowValues.d10),
        d15: minVal(windowValues.d15),
        d20: minVal(windowValues.d20),
      },
    },
    max: {
      close: maxVal(windowValues.close),
      intradayVariation: maxVal(windowValues.intraday),
      returnsFrom: {
        d1: maxVal(windowValues.d1),
        d5: maxVal(windowValues.d5),
        d10: maxVal(windowValues.d10),
        d15: maxVal(windowValues.d15),
        d20: maxVal(windowValues.d20),
      },
    },
    std: {
      close: stdPopulation(windowValues.close),
      intradayVariation: stdPopulation(windowValues.intraday),
      returnsFrom: {
        d1: stdPopulation(windowValues.d1),
        d5: stdPopulation(windowValues.d5),
        d10: stdPopulation(windowValues.d10),
        d15: stdPopulation(windowValues.d15),
        d20: stdPopulation(windowValues.d20),
      },
    },
    var: {
      close: variancePopulation(windowValues.close),
      intradayVariation: variancePopulation(windowValues.intraday),
      returnsFrom: {
        d1: variancePopulation(windowValues.d1),
        d5: variancePopulation(windowValues.d5),
        d10: variancePopulation(windowValues.d10),
        d15: variancePopulation(windowValues.d15),
        d20: variancePopulation(windowValues.d20),
      },
    },
  };
}

export function computeSymbolStats(candles: DailyCandle[]): SymbolStats {
  // Assumption: candles are chronological ascending
  const close = candles.map((c) => c.close);
  const intraday = computeIntradayVariationPerRow(candles);
  const d1 = computeReturnSeries(close, 1);
  const d5 = computeReturnSeries(close, 5);
  const d10 = computeReturnSeries(close, 10);
  const d15 = computeReturnSeries(close, 15);
  const d20 = computeReturnSeries(close, 20);

  const current: StatsBucket = {
    close: pickCurrent(close),
    intradayVariation: pickCurrent(intraday),
    returnsFrom: {
      d1: pickCurrent(d1),
      d5: pickCurrent(d5),
      d10: pickCurrent(d10),
      d15: pickCurrent(d15),
      d20: pickCurrent(d20),
    },
  };

  const lastYearWindow = 255; // rows like the workbook uses ~1y of trading days
  const ly = {
    close: tail(close, lastYearWindow),
    intraday: tail(intraday, lastYearWindow),
    d1: tail(d1, lastYearWindow),
    d5: tail(d5, lastYearWindow),
    d10: tail(d10, lastYearWindow),
    d15: tail(d15, lastYearWindow),
    d20: tail(d20, lastYearWindow),
  };

  const at = {
    close,
    intraday,
    d1,
    d5,
    d10,
    d15,
    d20,
  };

  const lastYear = buildAgg(ly, true);
  const allTime = buildAgg(at, false);

  return { current, lastYear, allTime };
}



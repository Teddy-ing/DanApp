export class TickerValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TickerValidationError";
  }
}

// US equities ticker basic validation per project scope
// Allows 1-5 uppercase letters, optional class suffix like BRK-B / BF-B
const US_TICKER_REGEX = /^[A-Z]{1,5}(?:-[A-Z]{1,2})?$/;

export function validateUsTickerFormat(raw: string): string {
  const normalized = raw.trim().toUpperCase();
  if (!normalized) {
    throw new TickerValidationError("Ticker is required");
  }
  if (!US_TICKER_REGEX.test(normalized)) {
    throw new TickerValidationError(
      "Invalid US ticker format. Use 1-5 letters, optional class suffix like BRK-B"
    );
  }
  return normalized;
}

export function parseSymbols(param: string | null): string[] {
  if (!param) return [];
  const parts = param
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const normalized: string[] = [];
  for (const raw of parts) {
    const valid = validateUsTickerFormat(raw);
    if (!normalized.includes(valid)) normalized.push(valid);
  }
  return normalized;
}



This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Project notes

- Providers: Added `src/providers/yahoo.ts` with Zod-validated fetchers for daily candles, splits, and dividends via RapidAPI Yahoo Finance. Expects a per-user `X-RapidAPI-Key` supplied at call sites (not stored in client).
  - Caching: Uses Upstash Redis via `src/lib/redis.ts` with TTLs per PRD (`yf:{symbol}:prices:v1`, `yf:{symbol}:divs:v1`, 24h).
  - IR Fallback: `src/scrapers/ir.ts` scrapes common issuer IR dividend pages (5s timeout, 1 retry strategy implicit via multi-path attempts), cached 7 days under `ir:{symbol}:divs:v1`.
  - Validation: `src/lib/ticker.ts` validates US tickers (supports class suffix like `BRK-B`) and normalizes to uppercase.

## API

### GET `/api/prices`

- Headers: `x-rapidapi-key: <YOUR_RAPIDAPI_KEY>`
- Query: `symbols=AAPL,MSFT` (1–5 symbols), `range=5y|1y|max` (default `5y`)
- Response:

```json
{
  "items": [
    {
      "symbol": "AAPL",
      "range": "5y",
      "candles": [ { "dateUtcSeconds": 1704067200, "open": 100, "high": 101, "low": 99, "close": 100.5, "volume": 123, "adjClose": 100.5 } ],
      "splits": [ { "dateUtcSeconds": 1598832000, "ratio": 4 } ]
    }
  ]
}
```

Notes: Intended for orchestration/testing. Uses cached provider data when available.
Rate limiting: All endpoints enforce 30 requests/minute per user (user derived from `x-user-id` or client IP). On exceed, respond `429` with `Retry-After` seconds.

Errors: Endpoints return structured errors with codes and, in development, details. In production, messages are generic and internals are hidden.

### GET `/api/dividends`

- Headers: `x-rapidapi-key: <YOUR_RAPIDAPI_KEY>`
- Query: `symbols=AAPL,MSFT` (1–5), optional `range=5y|1y|max` (default `5y`), optional per-symbol IR bases: `ir[AAPL]=https://investor.apple.com`
- Behavior: Retrieves Yahoo dividends; if a gap > 180 days exists within the last 2 years and `ir[...]` is provided, merges issuer IR data to fill missing dates.
- Response:

```json
{
  "items": [
    {
      "symbol": "AAPL",
      "range": "5y",
      "dividends": [ { "dateIso": "2024-03-01", "amount": 0.24 } ]
    }
  ]
}
```

### GET `/api/returns`

- Headers: `x-rapidapi-key: <YOUR_RAPIDAPI_KEY>`
- Query: `symbols=AAPL,MSFT` (1–5), optional `horizon=5y|max` (default `5y`), optional `base=number` (default `1000`)
- Behavior: Orchestrates prices + dividends per symbol and runs DRIP total return. Response is gzipped.
- Response:

```json
{
  "meta": { "symbols": ["AAPL","MSFT"], "base": 1000, "horizon": "5y" },
  "dates": ["2021-01-04", "2021-01-05"],
  "series": [
    { "symbol": "AAPL", "value": [1000, 1003.2], "pct": [0, 0.0032] }
  ]
}
```

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

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
  - Auth integration: API routes now inject the authenticated user’s RapidAPI key server-side; the client should not send `x-rapidapi-key`.
  - Caching: Uses Upstash Redis via `src/lib/redis.ts` with TTLs per PRD (`yf:{symbol}:prices:v1`, `yf:{symbol}:divs:v1`, 24h).
  - IR Fallback: `src/scrapers/ir.ts` scrapes common issuer IR dividend pages (5s timeout, 1 retry strategy implicit via multi-path attempts), cached 7 days under `ir:{symbol}:divs:v1`.
  - Validation: `src/lib/ticker.ts` validates US tickers (supports class suffix like `BRK-B`) and normalizes to uppercase.
  
### UI

- Returns/Price charts now include labels:
  - Returns chart: "Returns from {amount} in {symbols} at {starting point}" where amount is USD-formatted, symbols are comma-joined, and starting point is the first date of the series.
  - Price chart: "Price of {symbols}" using the same symbol display.
  - Implemented in `src/app/components/ReturnsView.tsx`.

### Front page (marketing)

- Concept A implemented for unauthenticated users: text-first hero, blue/indigo accents, single primary CTA (Google sign-in), usage-based free tier note.
- Anchored sections: `#methodology`, `#reliability`, `#security`, `#faq` (includes `#pricing-usage`).
- Centralized copy in `src/lib/marketingCopy.ts` for consistent messaging (scope, exclusions, usage, security, disclaimers).
- Footer includes Terms/Privacy placeholders and “Data from Yahoo Finance via RapidAPI. For informational purposes only. Not investment advice. Data may be delayed.”

### Excel export (XLSX)

- Server-side export (ExcelJS) with an "Export to Excel" button in the header.
- One sheet per symbol (all dates in New York time): Date, Open, Close, Dividend/Share, Split Ratio, Shares (pre), Reinvested Shares, Total Shares, Value, Return %.
- DRIP implemented as live Excel formulas: splits applied first; dividend cash accrues at pay date and is reinvested at the next trading-day open; valuation uses close. No fees/costs modeled.
- Summary sheet includes parameters and per-symbol Start/End, Final Value, Total Return, and CAGR.
- File name pattern: `{SYMBOL1, SYMBOL2, ...} {YYYY-MM-DD} returns.xlsx` (client honors server-provided Content-Disposition name).

### RapidAPI host

- Default host: `apidojo-yahoo-finance-v1.p.rapidapi.com` (override with env `RAPIDAPI_YF_HOST` if you prefer another provider that supports `GET /stock/v3/get-chart`).
- Required endpoints used by this app: `GET /stock/v3/get-chart` with `interval=1d`, `range=5y|max`, and `events=div,splits`.

## Auth

- NextAuth v5 with Google provider is configured in `src/auth.ts` and exposed at `app/api/auth/[...nextauth]/route.ts`.
- Required env vars (either naming scheme works):
  - `AUTH_GOOGLE_ID` or `GOOGLE_CLIENT_ID`
  - `AUTH_GOOGLE_SECRET` or `GOOGLE_CLIENT_SECRET`
  - `AUTH_SECRET` or `NEXTAUTH_SECRET`
  - `NEXTAUTH_URL`/`AUTH_URL` (Vercel often auto-sets)
- Google OAuth redirect URI: `<your-domain>/api/auth/callback/google`
- Session cookie is httpOnly, sameSite=lax, and secure in production.

## API

### GET `/api/prices` (auth required)

- No headers required; the server uses the stored key for the logged-in user.
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

### POST `/api/user/key` (auth required)

- Body: `{ "rapidapiKey": "..." }`
- Behavior: Encrypts the key with AES-GCM (HKDF-derived key from `AUTH_SECRET`, salt=user id) and stores it in Redis under `user:{id}:rapidapiKey`.
- Response: `{ "ok": true }` on success.
- Never returns the key.

### GET `/api/user/key` (auth required)

- Response: `{ "hasKey": true | false }` indicating only whether a RapidAPI key is stored for the user. Does not reveal or decrypt the key.

Errors: Endpoints return structured errors with codes and, in development, details. In production, messages are generic and internals are hidden.

### GET `/api/dividends` (auth required)

- No headers required; the server uses the stored key for the logged-in user.
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

### GET `/api/returns` (auth required)

- No headers required; the server uses the stored key for the logged-in user.
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

## Analytics

- This app uses `@vercel/analytics` for privacy-friendly page analytics.
- Collection is enabled only when `VERCEL_ENV` is `production` (Vercel Production deployments).
- Component is mounted in `dan-app/src/app/layout.tsx`.
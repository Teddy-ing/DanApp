This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

Preferred package manager: pnpm

```bash
pnpm dev
# or
npm run dev
# or
yarn dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Tech Stack

- Framework & Language: Next.js 15 (App Router, Turbopack dev), React 19, TypeScript 5
- Styling: Tailwind CSS 4, next/font (Geist)
- Data Fetching/State: TanStack Query 5
- Auth: NextAuth v5 (Google)
- Data Provider: Yahoo Finance via RapidAPI
- Caching/Storage: Upstash Redis
- Validation: Zod
- Charts: Recharts
- Excel Export: ExcelJS
- Scraping Fallback: Cheerio
- Analytics: @vercel/analytics
- Testing: Vitest
- Linting/Build: ESLint 9, eslint-config-next
- Package Manager: pnpm

## RapidAPI key & usage policy

- **Shared key first:** Set `RAPIDAPI_SHARED_KEY` (and optionally `RAPIDAPI_KEY` for backward compatibility) in your environment. All data routes fall back to this shared key so every signed-in user can fetch data without extra setup.
- **Personal override (optional):** Users can still save their own RapidAPI key via `/api/user/key`; the saved value overrides the shared key only for that user. Keys remain encrypted at rest in Upstash.
- **Missing keys:** If neither a shared key nor a personal key exists, API routes return `400` instructing the user to add a key. Configure the shared key in every environment to avoid this path.
- **Billing deferred:** Stripe/Whop plan gating is paused. All features remain open while the billing backlog (see below) is reworked.
- **Cron considerations:** The precompute job (see below) uses the shared key. Configure it in Preview and Production so scheduled runs succeed.

## Precompute job

- **Endpoint:** `POST /api/precompute` (also accepts `GET`). Requires `Authorization: Bearer ${PRECOMPUTE_CRON_TOKEN}`.
- **Body:** `{ "symbols": ["AAPL","MSFT"], "horizons": ["5y","max"] }`. Horizons default to `["5y","max"]`; `"1y"` and `"3y"` are recognized for percentile workflows.
- **Behavior:** Fetches Yahoo Finance data for each symbol/horizon with the shared RapidAPI key, computes DRIP growth + drawdown, and stores a snapshot under `precomp:{SYMBOL}:{horizon}` with a 6‑hour TTL.
- **Usage:** Hook this route up to a Vercel Cron job (daily or as needed). Keep the symbol list targeted to stay within RapidAPI quotas.
- **Cron considerations:** The precompute job (see below) uses the shared key. Configure it in Preview and Production so scheduled runs succeed.

## Project notes

- Providers: Added `src/providers/yahoo.ts` with Zod-validated fetchers for daily candles, splits, and dividends via RapidAPI Yahoo Finance. Server reads `RAPIDAPI_SHARED_KEY` by default and falls back to a user-stored key when present (never exposing it client-side).
  - Auth integration: API routes resolve the RapidAPI key server-side; the client should not send `x-rapidapi-key`.
  - Caching: Uses Upstash Redis via `src/lib/redis.ts` with TTLs per PRD (`yf:{symbol}:prices:v1`, `yf:{symbol}:divs:v1`, 24h).
  - IR Fallback: `src/scrapers/ir.ts` scrapes common issuer IR dividend pages (5s timeout, 1 retry strategy implicit via multi-path attempts), cached 7 days under `ir:{symbol}:divs:v1`.
  - Validation: `src/lib/ticker.ts` validates US tickers (supports class suffix like `BRK-B`) and normalizes to uppercase.
  
### UI

- Returns/Price charts now include labels:
  - Returns chart: "Returns from {amount} in {symbols} at {starting point}" where amount is USD-formatted, symbols are comma-joined, and starting point is the first date of the series.
  - Price chart: "Price of {symbols}" using the same symbol display.
- Implemented in `src/app/components/ReturnsView.tsx`.
- Chart order updated: Forward Returns, Returns, then Price.
- Returns view now overlays a benchmark line (default `SPY`, override via the `benchmark` query) and adds a compact excess-return mini chart so users can judge absolute performance plus beat/lag at a glance (≈58 words).
- Monthly analytics section adds a clickable heatmap (1y/3y/5y horizons) and linked histogram—hover bins to spotlight cells, click a month to highlight the forward-returns chart, and toggle excess vs SPY when the benchmark overlay is present.
- Drawdown view: new chart plots per-symbol peak-to-trough drawdowns (with optional benchmark overlay) and syncs with the highlight state used by the returns and heatmap views.
- Inputs: Button handlers validate pending input and block duplicates/over-limit; buttons no longer stay disabled after a validation error.
  - Fix: Removed error-based disabled state so users can retry immediately.
- Charts: When embedded in the lightbox, `ReturnsChart` and `ForwardReturnsChart` correctly respect `height="full"`.
  - Fix: Top-level wrappers now take 100% height to satisfy `ResponsiveContainer` requirements.
  - Fix: Y-axis bounds now seed from the first finite data point rather than 0 to avoid incorrect domains when data is entirely positive or negative.
- Lightbox: Improved click/drag behavior (only left-click toggles zoom), and print layout.
- Left panel: SSR-safe default; syncs with localStorage and media query after mount to avoid hydration issues.
- Dividends panel: starts open on SSR and syncs with stored preference after mount to avoid hydration mismatches while preserving the saved open/closed state.
- Yieldmax tables: render helper now returns a React node type to satisfy TS/JSX typing.

### Lightbox (chart enlarge, print)

- Double-click any chart to open a full-screen lightbox overlay.
- Interactions: left-click toggles zoom (1x/2x), wheel zoom adjusts smoothly, drag to pan, double-click background resets, Esc or backdrop click closes.
- Print button in the top-right prints the enlarged chart (title/subtitle/legend are included; overlay controls are hidden in print).
- Fix: Lightbox chart wrappers now use `h-full w-full` (non-print) so charts rendered with `height="full"` receive an explicit height from the container and display correctly.

### Front page (marketing)

- Concept A implemented for unauthenticated users: text-first hero, blue/indigo accents, single primary CTA (Google sign-in), with copy explaining that billing is deferred and everyone currently has full access.
- Anchored sections: `#methodology`, `#reliability`, `#security`, `#faq` (includes `#pricing-usage`).
- Centralized copy in `src/lib/marketingCopy.ts` for consistent messaging (scope, exclusions, interim usage note, security, disclaimers).
- Footer includes Terms/Privacy placeholders and “Data from Yahoo Finance via RapidAPI. For informational purposes only. Not investment advice. Data may be delayed.”

### Theme toggle

- Removed the theme toggle button and related logic. The app now follows the default theme only.
  - Rationale: Simplify UI; avoid confusion. No functional impact on returns/prices.

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
- Optional stub login: set `AUTH_ENABLE_TEST_USER=true` to surface a "Continue as Test User" button that signs in through a credentials provider for local or automated testing without Google.

### Quick test login workflow

1. `cd dan-app`
2. `set AUTH_ENABLE_TEST_USER=true` (PowerShell) or `export AUTH_ENABLE_TEST_USER=true` (Unix shells)
3. `pnpm dev`
4. Visit `http://localhost:3000/login` and click **Continue as Test User** to bypass Google OAuth locally.

## API

### GET `/api/prices` (auth required)

- No headers required; the server uses the shared key (`RAPIDAPI_SHARED_KEY`) or the user’s override if one is saved.
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

### POST `/api/user/key` (auth required, optional override)

- Body: `{ "rapidapiKey": "..." }`
- Behavior: Encrypts the key with AES-GCM (HKDF-derived key from `AUTH_SECRET`, salt=user id) and stores it in Redis under `user:{id}:rapidapiKey`. When present, this key overrides the shared key for that user only.
- Response: `{ "ok": true }` on success. Never returns the key.

### GET `/api/user/key` (auth required, optional override)

- Response: `{ "hasKey": true | false }` indicating only whether a personal RapidAPI key is stored for the user. Does not reveal or decrypt the key.

Errors: Endpoints return structured errors with codes and, in development, details. In production, messages are generic and internals are hidden.

### GET `/api/dividends` (auth required)

- No headers required; the server uses the shared key or the user’s override if present.
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

- No headers required; the server uses the shared key or the user’s override if present.
- Query: `symbols=AAPL,MSFT` (1–5), optional `horizon=5y|max` (default `5y`), optional `base=number` (default `1000`), optional `benchmark=SPY|none|{ticker}` (default `SPY`)
- Behavior: Orchestrates prices + dividends per symbol, runs DRIP total return, aligns an optional benchmark overlay, and computes excess (symbol minus benchmark) series. Response is gzipped.
- Response:

```json
{
  "meta": { "symbols": ["AAPL", "MSFT"], "base": 1000, "horizon": "5y", "benchmark": "SPY" },
  "dates": ["2021-01-04", "2021-01-05"],
  "series": [
    { "symbol": "AAPL", "value": [1000, 1003.2], "pct": [0, 0.0032], "drawdown": [0, -0.0025] }
  ],
  "benchmark": { "symbol": "SPY", "value": [1000, 1001.1], "pct": [0, 0.0011], "drawdown": [0, -0.0012] },
  "excess": [
    { "symbol": "AAPL", "value": [0, 2.1], "pct": [0, 0.0021] }
  ]
}
```

### GET `/api/stats/percentile` (auth required)

- Query: `symbols=AAPL,MSFT` (1–5), optional `horizons=1y,3y,5y`
- Behavior: Computes the percentile rank of the current forward-to-today DRIP return for each requested horizon using precomputed snapshots.
- Response:

```json
{
  "items": [
    {
      "symbol": "AAPL",
      "horizons": {
        "1y": { "percentile": 78.4, "currentReturn": 0.123, "sampleSize": 246 },
        "3y": { "percentile": 65.1, "currentReturn": 0.412, "sampleSize": 620 },
        "5y": { "percentile": 59.7, "currentReturn": 0.728, "sampleSize": 890 }
      }
    }
  ]
}
```

### POST `/api/precompute` (cron, bearer auth)

- Header: `Authorization: Bearer ${PRECOMPUTE_CRON_TOKEN}`
- Body: `{ "symbols": ["AAPL","MSFT"], "horizons": ["5y","max"] }` (symbols required; horizons optional)
- Behavior: Refreshes Redis snapshots (`precomp:{SYMBOL}:{horizon}`) used by `/api/returns` and upcoming percentile/drawdown features.
- Response: `{ "ok": true, "results": [{ "symbol": "AAPL", "horizon": "5y", "ok": true }, ...] }` with per-item status.
- GET works similarly with query params `?symbols=AAPL,MSFT&horizons=5y,max`.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Billing backlog

- Stripe checkout, subscription webhooks, and Whop plan linking are deferred. See tasks `B1` (Stripe) and `B2` (Whop) in `tasks/tasks-phase-2.md` before re-enabling plan gating or upsell copy.
- While the backlog is open, keep `RAPIDAPI_SHARED_KEY` configured and leave all feature gates disabled.

## Analytics

- This app uses `@vercel/analytics` for privacy-friendly page analytics.
- Collection is enabled only when `VERCEL_ENV` is `production` (Vercel Production deployments).
- Component is mounted in `dan-app/src/app/layout.tsx`.
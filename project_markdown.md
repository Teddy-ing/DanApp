# Stock Total-Return Visualizer
**Version:** 0.4 (Aug 7, 2025)  
**Owner:** Theodore Ingberman

Let users enter **one–five U.S. stock tickers** and see, for every historical trading day (or last 5y, whichever is longer), the **$ value** and **% return** of a user-chosen **base investment** (default $1,000) made on that day **with dividends reinvested** at the **next market-open VWAP**. Multi-symbol comparison on the same chart.

---

## 0) Finalized Decisions

- **Front end:** Next.js (React) on Vercel  
- **Auth:** Google OAuth via NextAuth.js  
- **Data:** Yahoo Finance via RapidAPI (**user supplies their own RapidAPI key**)  
- **Market scope:** **U.S. equities only (USD)**  
- **Dividends:** If Yahoo records are incomplete → **scrape issuer Investor-Relations site** as fallback  
- **DRIP model:** Reinvest **on payment date at next trading-day open**; fractional shares; adjust for **splits**  
- **Spin-offs:** **Excluded in MVP** (documented limitation)  
- **History horizon:** Full history; **pad missing days with nulls**  
- **Refresh:** **User-triggered** (no cron)  
- **Charts:** Multi-symbol overlay; toggle between **$** and **%**  
- **Base amount:** **User input** (default $1,000)  
- **Caching:** Upstash Redis (REST) – prices/splits/dividends 24h, IR scrape 7d  
- **Errors:** Developer-friendly stack traces (user-facing toasts in prod)  
- **Disclaimer:** Footer – “Data provided by Yahoo Finance via RapidAPI. For informational purposes only. Not investment advice.”

---

## 1) Architecture

- **UI:** Next.js app (pages/app router) with Tailwind; React Query for data fetching  
- **API routes (TS, server-only):**  
  - `/api/prices` — adjusted daily candles + splits  
  - `/api/dividends` — dividend history  
  - `/api/returns` — orchestrates prices+dividends and runs DRIP calc  
  - `/api/user/key` — save/get user RapidAPI key (encrypted at rest)
- **Adapters:** `providers/yahoo.ts` (RapidAPI), `scrapers/ir.ts` (Cheerio)  
- **Core math:** `lib/drip.ts` (pure, unit-tested)  
- **Cache:** Upstash Redis (global) with TTLs (see §3.3)  
- **Auth/session:** NextAuth Google; session cookie (or Redis session later if needed)

```mermaid
flowchart LR
  UI[Next.js UI] -- symbols, base, horizon --> RET[/api/returns/]
  RET --> PR[/api/prices/]
  RET --> DV[/api/dividends/]
  PR --> R((Upstash Redis))
  DV --> R
  PR -- miss --> YF[(Yahoo via RapidAPI<br/>(user's key))]
  DV -- miss/gap --> IR[Issuer IR Scraper]
  YF --> R
  IR --> R
  RET --> DRIP[lib/drip.ts]
  DRIP --> UI
2) API Contracts
2.1 GET /api/returns
Query: symbols=AAPL,MSFT&horizon=5y|max&base=1000

symbols (1–5 U.S. tickers), horizon defaults to 5y, base defaults to 1000 (USD)

200 Response

json
Copy
Edit
{
  "meta": {
    "baseInvestment": 1000,
    "currency": "USD",
    "timezone": "America/New_York",
    "horizon": "5y",
    "market": "US"
  },
  "dates": ["2021-01-04", "..."],
  "series": [
    { "symbol": "AAPL", "value": [1000, 1008.4, null, ...], "pct": [0, 0.0084, null, ...] },
    { "symbol": "MSFT", "value": [1000, 1006.1, 1002.7, ...], "pct": [0, 0.0061, 0.0027, ...] }
  ]
}
Notes: dates are aligned across symbols; missing data yields null entries.

2.2 POST /api/user/key (auth required)
Body: { "rapidapiKey": "…" }

Stored as AES-GCM ciphertext in Redis: user:{id}:rapidapiKey

Never returned to the client after save

2.3 GET /api/prices / GET /api/dividends
Internal API from UI is discouraged; UI should call /api/returns only

These exist for modular testing and orchestration

3) Data & Caching
3.1 Yahoo via RapidAPI (user key)
Endpoints: daily adjusted candles, splits, dividends

Header: X-RapidAPI-Key set to the logged-in user’s stored key

Reject obviously invalid tickers early (regex + provider 404 check)

3.2 IR Dividend Scraper (fallback)
Triggered only when Yahoo dividend series has holes/inconsistencies

Heuristics: search common IR paths; parse “Dividend History” tables

Politeness: 1 req/symbol per 7 days (cache), 5s timeout, 1 retry max

3.3 Cache Keys & TTLs
Prices/splits: yf:{symbol}:prices:v1 — 24h

Dividends (YF): yf:{symbol}:divs:v1 — 24h

IR scrape: ir:{symbol}:divs:v1 — 7d

User key: user:{id}:rapidapiKey — no TTL

Rate-limit counters: rl:{userId}:{window} — sliding window

:v1 suffix enables safe invalidation if schemas change.

4) DRIP / Total-Return Logic
4.1 Assumptions
Base investment: user input (USD)

U.S. trading calendar & exchange timezone alignment

Splits multiplicatively adjust shares

Spin-offs/special distributions: not modeled in MVP

Taxes and interim cash yield: ignored in MVP (future toggles)

4.2 Algorithm (edge-aware)
Fetch adjusted daily OHLC, splits, dividends for symbol.

Build trading calendar from start to today (provider trading days).

Initialize shares0 = base / close(startDay).

For each day d:

Apply splits effective on d: shares *= ratio.

If a dividend payment was on d-1:

cash = shares * dividendAmount

Find next trading day dOpen (skip weekends/holidays)

Execute DRIP at open(dOpen): shares += cash / open(dOpen) (4dp fractional)

Compute value[d] = shares * close(d) and pct[d] = (value[d] - base)/base

If data missing on d → push null for that symbol to keep arrays aligned.

5) UI/UX
Multi-symbol chip input (max 5); base amount numeric input (default 1000); horizon toggle (5y / max). Input panel keeps current tickers visible after the layout shifts into the two-column view post-query. Charts label the zero baseline as $0 or 0% based on the active mode.

Recharts multi-line chart with $ and % view toggle
  - Y-axis & tint: target 0 at 10% from the bottom with clamped p (top bound anchored to data; bottom deepens only as needed). Tint regions (green/red) are driven by the current axis domain: if domain is all ≥0 → full green; all ≤0 → full red; otherwise split at 0. This avoids flicker with small date-window shifts.
  - Baseline label: 0-line label is displayed on the left side of the chart.

UX toggles
- Left panel (Symbols/Inputs + Dividends) supports a master collapse with chevron + “Hide/Show” text. Defaults: open on desktop (md+), closed on mobile. State persists via localStorage (`ui.leftPanel.open`).
- Dividends card is individually collapsible with chevron + “Hide/Show”; state persists via localStorage (`ui.dividends.open`).

Tooltip: date + per-symbol $ and %; optional markers for dividend reinvests (later)

States:

Not logged in → Google Sign-In

No RapidAPI key → guided modal to paste/save key

Footer: attribution & disclaimer

A11y: keyboard navigation, high-contrast palette, dark-mode support

6) Security, Limits & Performance
RapidAPI key: AES-GCM encrypt before storing in Redis; never log; never return to client

Rate limit: 30 requests / minute per user (sliding window in Redis)

Symbols per call: ≤ 5 enforced server-side

Payload size: gzip responses; prefer 5y default horizon to keep JSON < ~1–2 MB

Latency targets: cold p95 < 400 ms; warm p95 < 150 ms (cache hits)

7) Testing
Unit (Vitest)

lib/drip.ts: splits, weekend/paydate alignment, missing-day nulls, varying base amounts

Provider adapters: schema guards; date/number parsing

Integration (mocked network)

/api/returns happy path; Yahoo dividend gap triggers IR merge

Smoke (manual)

Login → save key → run AAPL/MSFT with base = 1500 → verify chart & cache warm

8) Deployment & Ops (non-code checklist)
Vercel project + env vars:

NEXTAUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN

Upstash: create Global Redis; copy REST URL/TOKEN

Google Cloud: OAuth consent (External), Web Client with redirect …/api/auth/callback/google
  Note: App links directly to provider at `/api/auth/signin/google?callbackUrl=/` to skip the generic provider page. The Google OAuth redirect URI in GCP remains `/api/auth/callback/google`.

GitHub Actions: CI (install → test) + deploy to Vercel on main

Monitoring: Vercel logs (optional Sentry DSN)

9) Legal
Footer:

Data provided by Yahoo Finance via RapidAPI.
For informational purposes only. Not investment advice.

10) Front page (marketing)
- Concept A (text-first) for unauthenticated users with a single primary CTA (Google sign-in).
- Anchors: `#methodology`, `#reliability`, `#security`, `#faq` including `#pricing-usage` for the Pricing link.
- Copy centralized in `src/lib/marketingCopy.ts`; scope/exclusions and usage note (50 one-time actions; pressing "Fetch returns" is an action).
- Footer links placeholders: `/terms`, `/privacy`.

Scraping: respect robots.txt; IR fallback cached 7 days to minimize load.


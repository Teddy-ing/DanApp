# Stock Total-Return Visualizer
**Version:** 0.4 (Aug 7, 2025)  
**Owner:** Theodore Ingberman

**Update (Dec 18, 2025):** Added a hidden `YIELDMAX` keyword that expands to the full YieldMax ticker bundle server-side, bypassing the 5-symbol cap only for that keyword to keep the rest of the flow unchanged.
**Update (Dec 15, 2025):** Added a protected `/yieldmax` page mirroring YieldMax ETF groups with ROC scrape (24h Redis cache) and dividend-rate calculations via Yahoo Finance; shared header now links Returns ↔ YieldMax.
**Update (Nov 11, 2025, later):** Reflowed the returns histogram so its summary stats sit below the chart, preventing overlap with the price panel.
**Update (Nov 11, 2025):** Deferred effect-driven state updates to microtasks to keep React Compiler happy (lightbox, returns shell/view) and trimmed unused theme toggle stub.
**Update (Nov 10, 2025, late pm):** Corrected monthly heatmap horizon filter so 1y/3y views stay within range and added regression test.
**Update (Nov 10, 2025, pm):** Restored pnpm workspace config and squashed React lint regressions in chart panels so installs and builds run cleanly.
**Update (Nov 10, 2025):** Custom-span DRIP requests now honor their exact date window, preventing out-of-range returns from skewing forward-return stats or charts.
**Update (Nov 8, 2025):** Login now routes through a confirmation screen before Google OAuth; dedicated Terms and Privacy pages outline The RND Group’s policies for better transparency.

Let users enter **one–five U.S. stock tickers** and see, for every historical trading day (or last 5y, whichever is longer), the **$ value** and **% return** of a user-chosen **base investment** (default $1,000) made on that day **with dividends reinvested** at the **next market-open VWAP**. Multi-symbol comparison on the same chart.

---

## 0) Finalized Decisions

- **Front end:** Next.js (React) on Vercel  
- **Auth:** Google OAuth via NextAuth.js  
- **Data:** Yahoo Finance via RapidAPI (**shared `RAPIDAPI_SHARED_KEY`; users can optionally store a personal override via `/api/user/key`**)  
- **Market scope:** **U.S. equities only (USD)**  
- **Dividends:** If Yahoo records are incomplete → **scrape issuer Investor-Relations site** as fallback  
- **DRIP model:** Reinvest **on payment date at next trading-day open**; fractional shares; adjust for **splits**  
- **Spin-offs:** **Excluded in MVP** (documented limitation)  
- **History horizon:** Full history; **pad missing days with nulls**  
- **Refresh:** **User-triggered** (no cron)  
- **Charts:** Multi-symbol overlay; toggle between **$** and **%**  
- **Base amount:** **User input** (default $1,000)  
- **Caching:** Upstash Redis (REST) – prices/splits/dividends 24h, IR scrape 7d  
- **YieldMax ROC/Rate:** ROC scraped from yieldmaxetfs.com (24h cache, hardcoded group fallback); Rate = last 12m dividends ÷ latest price via Yahoo Finance (cached 6h per symbol)
- **Errors:** Developer-friendly stack traces (user-facing toasts in prod)  
- **Disclaimer:** Footer – “Data provided by Yahoo Finance via RapidAPI. For informational purposes only. Not investment advice.”

---

## 1) Architecture

- **UI:** Next.js app (pages/app router) with Tailwind; React Query for data fetching  
- **API routes (TS, server-only):**  
  - `/api/prices` — adjusted daily candles + splits  
  - `/api/dividends` — dividend history  
  - `/api/returns` — orchestrates prices+dividends and runs DRIP calc  
  - `/api/user/key` — save/get optional personal RapidAPI key (encrypted at rest; overrides shared key)
  - `/api/stats/percentile` — percentile ranks for 1y/3y/5y DRIP returns
  - `/api/precompute` — Vercel cron endpoint to warm DRIP caches (`precomp:{symbol}:{horizon}`)
  - `/api/yieldmax` — YieldMax ROC scrape (24h Redis cache) + dividend-rate lookup via Yahoo Finance
- **Adapters:** `providers/yahoo.ts` (RapidAPI), `scrapers/ir.ts` (Cheerio)  
- **Core math:** `lib/drip.ts` (pure, unit-tested)  
- **Cache:** Upstash Redis (global) with TTLs (see §3.3)  
- **Auth/session:** NextAuth Google; session cookie (or Redis session later if needed); `/returns` is a protected route

```mermaid
flowchart LR
  UI[Next.js UI] -- symbols, base, horizon --> RET[/api/returns/]
  RET --> PR[/api/prices/]
  RET --> DV[/api/dividends/]
  PR --> R((Upstash Redis))
  DV --> R
  PR -- miss --> YF[(Yahoo via RapidAPI<br/>(shared key or user override))]
  DV -- miss/gap --> IR[Issuer IR Scraper]
  YF --> R
  IR --> R
  RET --> DRIP[lib/drip.ts]
  DRIP --> UI
2) API Contracts
2.1 GET /api/returns
Query: symbols=AAPL,MSFT&horizon=5y|max&base=1000&benchmark=SPY|none|{ticker}

symbols (1–5 U.S. tickers), horizon defaults to 5y, base defaults to 1000 (USD), benchmark defaults to SPY (set `benchmark=none` to skip)

200 Response

```json
{
  "meta": {
    "symbols": ["AAPL", "MSFT"],
    "base": 1000,
    "horizon": "5y",
    "benchmark": "SPY"
  },
  "dates": ["2021-01-04", "..."],
  "series": [
    { "symbol": "AAPL", "value": [1000, 1008.4, null], "pct": [0, 0.0084, null] },
    { "symbol": "MSFT", "value": [1000, 1006.1, 1002.7], "pct": [0, 0.0061, 0.0027] }
  ],
  "benchmark": {
    "symbol": "SPY",
    "value": [1000, 1004.9, 1001.5],
    "pct": [0, 0.0049, 0.0015]
  },
  "excess": [
    { "symbol": "AAPL", "value": [0, 3.5, null], "pct": [0, 0.0035, null] },
    { "symbol": "MSFT", "value": [0, 1.2, 1.2], "pct": [0, 0.0012, 0.0012] }
  ]
}
```
Notes: dates are aligned across symbols and the benchmark; missing data yields null entries. Excess rows subtract benchmark values/returns from each symbol.

2.2 POST /api/user/key (auth required)
Body: { "rapidapiKey": "…" }

Stored as AES-GCM ciphertext in Redis: user:{id}:rapidapiKey

Never returned to the client after save

2.3 GET /api/prices / GET /api/dividends
Internal API from UI is discouraged; UI should call /api/returns only

These exist for modular testing and orchestration

3) Data & Caching
3.1 Yahoo via RapidAPI (shared key with optional user override)
Endpoints: daily adjusted candles, splits, dividends

Header: X-RapidAPI-Key set to `RAPIDAPI_SHARED_KEY` unless the user has saved a personal key (override)

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

YieldMax scrape: yieldmax:scrape:v1 — 24h  
YieldMax rate: yieldmax:rate:{symbol}:v1 — 6h

Precompute snapshots: precomp:{symbol}:{horizon} — 6h

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
Note: Yahoo chart candles are historically split-adjusted; do not multiply
shares by split ratios again if prices are already adjusted. Tests enforce
continuity across split dates.

Compute value[d] = shares * close(d) and pct[d] = (value[d] - base)/base

If data missing on d → push null for that symbol to keep arrays aligned.

5) UI/UX
Multi-symbol chip input (max 5); base amount numeric input (default 1000); horizon toggle (5y / max). Input panel keeps current tickers visible after the layout shifts into the two-column view post-query. Charts label the zero baseline as $0 or 0% based on the active mode.

Recharts multi-line chart with $ and % view toggle and benchmark overlay
  - Y-axis & tint: target 0 at 10% from the bottom with clamped p (top bound anchored to data; bottom deepens only as needed). Tint regions (green/red) are driven by the current axis domain: if domain is all ≥0 → full green; all ≤0 → full red; otherwise split at 0. This avoids flicker with small date-window shifts.
  - Baseline label: 0-line label is displayed on the left side of the chart.
  - Benchmark line: returns chart draws a dashed overlay for the selected benchmark (default SPY) and a companion mini chart highlights per-symbol excess vs the benchmark in $/% toggles.
- Monthly analytics: 1y/3y/5y heatmap (first trading day per month) and linked histogram live in `ReturnsView`. Clicking a cell syncs the forward returns chart; hovering a bin highlights its months; an excess-vs-SPY toggle appears when the benchmark overlay is active.
- Drawdown chart: `ReturnsView` renders a dedicated peak-to-trough drawdown line chart (with optional SPY overlay) driven by the enhanced `/api/returns` payload.

UX toggles
- Left panel (Symbols/Inputs + Dividends) supports a master collapse with chevron + “Hide/Show” text. Defaults: open on desktop (md+), closed on mobile. State persists via localStorage (`ui.leftPanel.open`). The panel remains mounted; width animates from 320px to a slim 12px gutter for smooth chart resizing.
- Dividends card is individually collapsible with chevron + “Hide/Show”; state persists via localStorage (`ui.dividends.open`). Chevron shows ▴ when open and ▾ when closed.
- When the left panel is collapsed, the “Show panel” control appears on the left as a small button.

Tooltip: date + per-symbol $ and %; optional markers for dividend reinvests (later)

States:

Not logged in → Google Sign-In

Shared key active → modal optional if user wants to save their own RapidAPI key override

Footer: attribution & disclaimer

A11y: keyboard navigation, high-contrast palette, dark-mode support

6) Security, Limits & Performance
RapidAPI key: AES-GCM encrypt before storing in Redis; never log; never return to client

Rate limit: 30 requests / minute per user (sliding window in Redis)

Symbols per call: ≤ 5 enforced server-side (except the hidden `YIELDMAX` bundle keyword)

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

RAPIDAPI_SHARED_KEY, NEXTAUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN, PRECOMPUTE_CRON_TOKEN

Upstash: create Global Redis; copy REST URL/TOKEN

Google Cloud: OAuth consent (External), Web Client with redirect …/api/auth/callback/google
  Note: App links directly to provider at `/api/auth/signin/google?callbackUrl=/returns` to skip the generic provider page. The Google OAuth redirect URI in GCP remains `/api/auth/callback/google`.

GitHub Actions: CI (install → test) + deploy to Vercel on main

Monitoring: Vercel logs (optional Sentry DSN)

9) Legal
Footer:

Data provided by Yahoo Finance via RapidAPI.
For informational purposes only. Not investment advice.

10) Front page (marketing)
- Concept A (text-first) for unauthenticated users with a single primary CTA (Google sign-in).
- Primary CTA routes to `/login`, which presents a “Continue with Google” flow and terms acknowledgement.
- Anchors: `#methodology`, `#reliability`, `#security`, `#faq` including `#pricing-usage` for the Pricing link.
- Copy centralized in `src/lib/marketingCopy.ts`; scope/exclusions and interim usage note explaining that billing is deferred and all features remain open.
- Footer links point to live `/terms` and `/privacy` pages describing The RND Group policies.

Scraping: respect robots.txt; IR fallback cached 7 days to minimize load.

11) Precompute job
- `lib/precompute.ts` builds DRIP growth + drawdown snapshots (base 1000) and stores them under `precomp:{symbol}:{horizon}` with a 6-hour TTL.
- `/api/precompute` (GET/POST) accepts `symbols` (required) and optional `horizons` (`1y`,`3y`,`5y`,`max`). Requires `Authorization: Bearer ${PRECOMPUTE_CRON_TOKEN}`.
- Schedule a Vercel Cron (daily) that hits this route with the shared RapidAPI key configured so `/api/returns` can serve from cache and populate percentiles later.

12) Billing backlog (deferred)
- Stripe checkout, subscription lifecycle webhooks, and plan gating are paused (tracked as task `B1`).
- Whop OAuth/webhooks, plan precedence, and UI affordances remain TODO (task `B2`).
- Keep `RAPIDAPI_SHARED_KEY` configured in every environment and leave upsell copy disabled until billing work resumes.


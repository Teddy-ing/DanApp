## Relevant Files



### Notes



## Tasks

- [ ] 1.0 Data providers and caching
  - [x] 1.1 Implement `providers/yahoo.ts` to fetch adjusted daily candles, splits, and dividends via RapidAPI using the per-user `X-RapidAPI-Key`; add schema validation and error normalization.
  - [ ] 1.2 Add Upstash Redis caching for prices/splits and dividends with keys `yf:{symbol}:prices:v1` and `yf:{symbol}:divs:v1` (TTL 24h).
  - [ ] 1.3 Implement `scrapers/ir.ts` (Cheerio) to fetch issuer IR “Dividend History” as fallback; throttle to 1 req/symbol per 7 days; 5s timeout; 1 retry max; cache at `ir:{symbol}:divs:v1` (TTL 7d).
  - [ ] 1.4 Validate tickers early (regex + provider 404 check) and fail fast with actionable errors.
  - [ ] 1.5 Ensure secrets are never logged; centralize HTTP client with sensible timeouts and headers; wrap provider errors.

- [ ] 2.0 DRIP total-return engine
  - [ ] 2.1 Create trading-day calendar from start date to today based on provider data; align to `America/New_York` timezone.
  - [ ] 2.2 Implement `lib/drip.ts` with a pure function to compute aligned `dates`, `value[]`, and `pct[]` given prices, splits, dividends, base, and horizon; pad missing days with `null`.
  - [ ] 2.3 Apply splits multiplicatively on effective dates; maintain fractional shares (4 dp).
  - [ ] 2.4 Reinvest dividends at the next trading-day open after payment; skip weekends/holidays.
  - [ ] 2.5 Add runtime schema guards and edge-case handling (no dividends, no splits, sparse data).

- [ ] 3.0 API endpoints and security
  - [ ] 3.1 Implement `GET /api/prices` to return adjusted candles and splits (primarily for internal orchestration/testing).
  - [ ] 3.2 Implement `GET /api/dividends` to return dividend series; when gaps detected, merge IR fallback data.
  - [ ] 3.3 Implement `GET /api/returns` to orchestrate prices + dividends per symbol and run DRIP; enforce 1–5 symbols, `horizon` default `5y`, `base` default `1000`; gzip responses.
  - [ ] 3.4 Add Redis sliding-window rate limiting: 30 requests/minute per user; return `429` with retry hint when exceeded.
  - [ ] 3.5 Standardize success payload to match PRD (`meta`, `dates`, `series`) and structured error responses; hide internals in prod while preserving developer stack traces in dev.

- [ ] 4.0 Auth and user key management
  - [ ] 4.1 Configure NextAuth Google provider; secure session cookie; set required env vars.
  - [ ] 4.2 Implement `POST /api/user/key` to accept `{ rapidapiKey }`, encrypt with AES-GCM, and store at `user:{id}:rapidapiKey` in Redis.
  - [ ] 4.3 Implement `GET /api/user/key` to return presence-only status (e.g., `{ hasKey: true }`) without revealing the key.
  - [ ] 4.4 Inject the stored RapidAPI key into provider requests server-side; never send the key to the client.
  - [ ] 4.5 Protect API routes requiring auth; add minimal UI state to handle unauthenticated access.

- [ ] 5.0 UI and visualization
  - [ ] 5.1 Require Google sign-in; when not logged in, show Sign-In view.
  - [ ] 5.2 Add guided modal to paste and save the RapidAPI key; call `/api/user/key`; show success/error toasts.
  - [ ] 5.3 Build inputs: multi-symbol chip input (1–5), base amount numeric input (default 1000), and horizon toggle (`5y`/`max`).
  - [ ] 5.4 Integrate React Query to call `/api/returns`; handle loading, errors, and refetch; user-triggered refresh only.
  - [ ] 5.5 Render Recharts multi-line chart with $/% toggle; tooltip includes date and per-symbol $/% values; align datasets.
  - [ ] 5.6 Footer with attribution/disclaimer; a11y: keyboard navigation, high-contrast palette, dark mode.

- [ ] 6.0 Testing and developer experience
  - [ ] 6.1 Set up Vitest for unit and integration tests; ensure TS support; add `pnpm` scripts.
  - [ ] 6.2 Unit tests for `lib/drip.ts`: splits, weekend/paydate alignment, null padding, varying base amounts.
  - [ ] 6.3 Adapter tests: provider schema guards; date/number parsing; cache behavior and TTL adherence.
  - [ ] 6.4 Integration tests (mocked network): `/api/returns` happy path; Yahoo dividend gap triggers IR merge.
  - [ ] 6.5 Document local setup and env vars; brief deployment instructions in `README.md`.

- [ ] 7.0 Deployment and ops (non-code checklist)
  - [ ] 7.1 Configure Vercel project env vars: `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.
  - [ ] 7.2 Provision Upstash Global Redis; copy REST URL/TOKEN; verify connectivity.
  - [ ] 7.3 Configure Google OAuth consent and redirect to `/api/auth/callback/google`.
  - [ ] 7.4 Set up GitHub Actions CI (install → test) and Vercel deploy on `main`.
  - [ ] 7.5 Confirm monitoring via Vercel logs; optionally wire Sentry DSN.



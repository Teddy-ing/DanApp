## Relevant Files

- `dan-app/src/lib/calendar.ts` — New helpers: `toNyDateString`, `nyTodayDateString`, `buildTradingCalendar` (union of trading days across symbols; NY timezone; end defaults to today)
- `dan-app/src/lib/drip.ts` — New pure DRIP engine `computeDripSeries` producing aligned `dates`, per‑symbol `value[]` and `pct[]`; applies splits on date; reinvests dividends at next trading-day open; pads with nulls
- `dan-app/src/auth.ts` — NextAuth v5 config with Google provider; reads `AUTH_*` with fallback to `GOOGLE_CLIENT_*` and `NEXTAUTH_SECRET`; secure cookie options.
- `dan-app/src/app/api/auth/[...nextauth]/route.ts` — Exposes NextAuth handlers (GET/POST).
- `dan-app/src/app/page.tsx` — Gated home route: shows full-page sign-in card when unauthenticated; normal content when signed in.
- `dan-app/src/app/components/KeyModal.tsx` — Client modal to connect RapidAPI key; POST to `/api/user/key`; shows current key status.
- `dan-app/src/app/components/InputsPanel.tsx` — Client inputs: multi-symbol chip input (deduped, max 5), base amount (default 1000), horizon toggle (5y/max).
- `dan-app/src/app/components/ReturnsChart.tsx` — Recharts multi-line chart with $/% toggle and custom tooltip.
- `dan-app/src/app/components/PriceChart.tsx` — Recharts price chart showing close prices under returns chart.
- `dan-app/src/app/page.tsx` — Footer with attribution/disclaimer; main content anchor for skip link.
- `dan-app/src/app/layout.tsx` — Adds skip link for a11y and wraps with QueryProvider.
- `dan-app/src/app/globals.css` — Focus-visible, skip-link, and high-contrast tweaks.
- `dan-app/src/app/QueryProvider.tsx` — React Query provider with Devtools; disables auto-refetch.
- `dan-app/src/app/layout.tsx` — Wrap app with `QueryProvider`.
- `tasks/tasks-project_markdown.md` — Updated to mark task 4.1 complete and list relevant files
### Notes
2 charts - the one showing the thing and another being normal
front page should later make it known of the 1 week trial


## Tasks

- [x] 1.0 Data providers and caching
  - [x] 1.1 Implement `providers/yahoo.ts` to fetch adjusted daily candles, splits, and dividends via RapidAPI using the per-user `X-RapidAPI-Key`; add schema validation and error normalization.
  - [x] 1.2 Add Upstash Redis caching for prices/splits and dividends with keys `yf:{symbol}:prices:v1` and `yf:{symbol}:divs:v1` (TTL 24h).
  - [x] 1.3 Implement `scrapers/ir.ts` (Cheerio) to fetch issuer IR “Dividend History” as fallback; throttle to 1 req/symbol per 7 days; 5s timeout; 1 retry max; cache at `ir:{symbol}:divs:v1` (TTL 7d). Leave as a utility invoked only when Yahoo dividend gaps are detected.
  - [x] 1.4 Validate tickers early (regex + provider 404 check) and fail fast with actionable errors.
  - [x] 1.5 Ensure secrets are never logged; centralize HTTP client with sensible timeouts and headers; wrap provider errors.

- [x] 2.0 DRIP total-return engine
  - [x] 2.1 Create trading-day calendar from start date to today based on provider data; align to `America/New_York` timezone.
  - [x] 2.2 Implement `lib/drip.ts` with a pure function to compute aligned `dates`, `value[]`, and `pct[]` given prices, splits, dividends, base, and horizon; pad missing days with `null`.
  - [x] 2.3 Apply splits multiplicatively on effective dates; maintain fractional shares (4 dp).
  - [x] 2.4 Reinvest dividends at the next trading-day open after payment; skip weekends/holidays.
  - [x] 2.5 Add runtime schema guards and edge-case handling (no dividends, no splits, sparse data).

- [x] 3.0 API endpoints and security
  - [x] 3.1 Implement `GET /api/prices` to return adjusted candles and splits (primarily for internal orchestration/testing).
  - [x] 3.2 Implement `GET /api/dividends` to return dividend series; when gaps detected, merge IR fallback data.
  - [x] 3.3 Implement `GET /api/returns` to orchestrate prices + dividends per symbol and run DRIP; enforce 1–5 symbols, `horizon` default `5y`, `base` default `1000`; gzip responses.
  - [x] 3.4 Add Redis sliding-window rate limiting: 30 requests/minute per user; return `429` with retry hint when exceeded.
  - [x] 3.5 Standardize success payload to match PRD (`meta`, `dates`, `series`) and structured error responses; hide internals in prod while preserving developer stack traces in dev.

- [x] 4.0 Auth and user key management
  - [x] 4.1 Configure NextAuth Google provider; secure session cookie; set required env vars.
  - [x] 4.2 Implement `POST /api/user/key` to accept `{ rapidapiKey }`, encrypt with AES-GCM, and store at `user:{id}:rapidapiKey` in Redis.
  - [x] 4.3 Implement `GET /api/user/key` to return presence-only status (e.g., `{ hasKey: true }`) without revealing the key.
  - [x] 4.4 Inject the stored RapidAPI key into provider requests server-side; never send the key to the client.
  - [x] 4.5 Protect API routes requiring auth; add minimal UI state to handle unauthenticated access.

- [ ] 5.0 UI and visualization
  - [x] 5.1 Require Google sign-in; when not logged in, show Sign-In view.
  - [x] 5.2 Add guided modal to paste and save the RapidAPI key; call `/api/user/key`; show success/error toasts.
  - [x] 5.3 Build inputs: multi-symbol chip input (1–5), base amount numeric input (default 1000), and horizon toggle (`5y`/`max`).
  - [x] 5.4 Integrate React Query to call `/api/returns`; handle loading, errors, and refetch; user-triggered refresh only.
  - [x] 5.5 Render Recharts multi-line chart with $/% toggle; tooltip includes date and per-symbol $/% values; align datasets.
  - [x] 5.6 Footer with attribution/disclaimer; a11y: keyboard navigation, high-contrast palette, dark mode.

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



## Monetization and Freemium

### Decision summary
- Stripe Checkout + Billing Portal; single monthly price with 7-day free trial.
- No card required to start trial; price: $7.50 USD/month.
- Keep Google-only sign-in; rely on Google `email_verified`.
- Replace per-user RapidAPI keys with one server-managed `RAPIDAPI_KEY`.
- Auto-start trial on first sign-in and clearly message on/around the front page.
- Soft anti-abuse: per-user and per-IP rate limits; device cookie; optional CAPTCHA on spikes.

### Why this matters (≤80 words)
Removes user friction of supplying keys, enables predictable costs via a single platform key, and introduces revenue with a simple 7‑day free trial then subscription. Server-side gating prevents client leaks and supports soft abuse controls. Stripe Checkout/Portal keeps payment UX secure and offsite. This change aligns the product with a sustainable freemium model while preserving existing charts and workflows.

### Access model and statuses
- Statuses: `trialing` (until `trialEndsAt`), `active` (Stripe subscription), `expired` (trial ended or subscription inactive).
- Gating: All data endpoints (e.g., `GET /api/returns`) call a server util `assertAccessAllowed(userId)` to allow only `trialing` or `active`.
- Rate limits: `trialing` 30 rpm/user; `active` 120 rpm/user; global per-IP soft caps.

### Data stored (Redis)
- `user:{id}`: `trialStartedAt`, `trialEndsAt`, `status`, `stripeCustomerId`, `subscriptionId`, `currentPeriodEnd`, `cancelAtPeriodEnd`, `lastSeenAt`.
- `abuse:{ip}` and `abuse:{deviceId}` counters for soft abuse prevention.

### Endpoints and server updates
- Add `POST /api/billing/checkout` → returns Stripe Checkout URL for subscription.
- Add `POST /api/billing/portal` → returns Stripe Billing Portal URL.
- Add `POST /api/stripe/webhooks` → handle `checkout.session.completed`, `customer.subscription.created|updated|deleted` and update user status.
- Add `GET /api/user/status` → `{ status, trialEndsAt, currentPeriodEnd, canAccess }`.
- Update existing `GET /api/*` to call `assertAccessAllowed(userId)`.
- Remove `/api/user/key` endpoints (no longer needed).

### UI updates
- Replace `KeyModal` with a lightweight Access panel:
  - Trialing: show days remaining and a “Subscribe” button (to Checkout).
  - Active: show a “Manage billing” button (to Billing Portal).
  - Expired: show “Subscribe to continue”.
- Front page: pre-sign-in note that a 7‑day free trial starts on first sign-in.

### Env/config additions
- `RAPIDAPI_KEY` (shared provider key; server-only).
- `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`.
- `STRIPE_PRICE_ID` (monthly $7.50; currency `usd`).
- `STRIPE_WEBHOOK_SECRET`.

### Outside-of-repo setup (owner actions)
1) Stripe (test mode first)
   - Create Stripe account and enable Billing/Checkout.
   - Create Product (e.g., “DanApp Pro”) and recurring Price: $7.50 USD/month.
   - Ensure Price has a 7-day free trial (no card required to start).
   - In Developers → API keys: copy Secret and Publishable keys.
   - In Developers → Webhooks: add endpoint `https://your-vercel-domain.com/api/stripe/webhooks` with events:
     - `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`.
   - Copy the webhook signing secret.
   - Configure Billing Portal (Business settings → Customer portal) and allow plan cancel/manage.

2) Vercel environment
   - Set env vars on the project: `RAPIDAPI_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`.
   - Ensure existing vars remain set: `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.
   - Redeploy to apply env changes.

3) RapidAPI plan
   - Ensure the account plan supports expected paid usage; monitor quotas and cost caps.

4) DNS/URLs
   - Decide on production domain; update Stripe webhook URL if domain changes.

5) Monitoring
   - Watch Vercel logs and Stripe dashboard events when enabling live mode.

### Implementation steps (sequenced)
1. Server: add `assertAccessAllowed(userId)` and trial initializer on first authenticated hit.
2. Server: add `GET /api/user/status`.
3. Server: implement Stripe Checkout/Portal endpoints.
4. Server: implement Stripe webhook handler and status transitions.
5. Server: swap data providers to use shared `RAPIDAPI_KEY` only.
6. Server: remove `/api/user/key` routes and related code; purge stored user keys.
7. UI: add Access panel and pre-sign-in trial messaging; remove `KeyModal`.
8. Gating: apply `assertAccessAllowed` in `GET /api/returns` (and related routes).
9. Rate limits: parameterize by status and add per-IP counters + device cookie.
10. Docs: update `README.md` with env/Stripe steps and note the freemium model.

---

- [ ] 8.0 Monetization and billing
  - [ ] 8.1 Remove per-user key flow: delete `/api/user/key` and `KeyModal`; purge `user:{id}:rapidapiKey`.
  - [ ] 8.2 Inject shared `RAPIDAPI_KEY` in providers; never expose to client.
  - [ ] 8.3 Add trial init on first sign-in; store `trialStartedAt` and `trialEndsAt` (+7 days).
  - [ ] 8.4 Implement `assertAccessAllowed(userId)` and gate `GET /api/returns` (etc.).
  - [ ] 8.5 Add `POST /api/billing/checkout` and `POST /api/billing/portal`.
  - [ ] 8.6 Add `POST /api/stripe/webhooks` with subscription lifecycle handling.
  - [ ] 8.7 Add `GET /api/user/status` for client UI.
  - [ ] 8.8 UI: Access panel + pre-sign-in trial message; remove key UI.
  - [ ] 8.9 Rate limits: 30 rpm trial, 120 rpm paid; per-IP soft caps; device cookie.
  - [ ] 8.10 Docs: update `README.md` and `PROJECT.md` with envs and setup.

## Phase 0–5 Plan (Tailored to DanApp)

This document supersedes the earlier trial model for future work. Phase 0 replaces the 7‑day trial with freemium plan gating at the API layer. Phases 1–5 expand product value and operability in sequenced steps.

### Phase 0 — Switch to Freemium (foundation)

#### Pricing & Plans
- Free: 1 symbol, 3‑year max history, no exports, no alerts, watermark, rate‑limited
- Pro: $12/mo (monthly only)

#### Entitlements & Quotas (config)
- Free: `symbols_max=1`, `history_years=3`, `alerts_max=0`, `exports=none`, `cohorts_level=none`, `watermark_on=true`
- Pro: `symbols_max=5`, `history=full`, `alerts_max=10`, `exports=PNG,CSV,XLSX`, `cohorts_level=basic`, `watermark_on=false`

#### Access Control
- Replace time‑based trial with plan checks enforced server‑side for all data endpoints (e.g., `GET /api/returns`).
- Add per‑account and per‑IP rate limiting; add soft device fingerprint (hashed UA+TZ+canvas) with privacy notice.

#### Billing (Stripe)
- Implement Stripe product/price: Pro (monthly only, $12). Configure automatic proration.
- Upgrade/downgrade flows via Billing Portal; document refund policy (pro‑rata credit via Stripe defaults).

### Phase 1 — Make the USP “decision‑ready”

#### Percentile/Ranks
- Compute rolling percentile for current forward‑to‑today return at horizons 1y/3y/5y.
- UI: compact badges with tooltip showing percentile and sample size.

#### Benchmark & Excess Return
- Overlay benchmark (default SPY; user‑selectable) on the forward curve.
- Add “excess forward return” mini‑chart (security minus benchmark).

#### Distribution + Heatmap
- Histogram of forward‑to‑today outcomes (selectable horizon).
- Monthly start‑date heatmap; click synchronizes crosshairs on main chart.

#### Drawdown/Underwater
- Secondary chart showing drawdowns for the base‑amount series.

### Phase 2 — Operability (retention makers)

#### Save/Share
- Saved Views (symbols, horizon, benchmark, toggles).
- Permalinks with watermark for Free.

#### Alerts
- Conditions: percentile thresholds, excess return thresholds.
- Channels: email initially; push later. Enforce quotas by plan.

#### Exports
- PNG (charts), CSV (series, stats), XLSX (existing) and zipped bundles for multi‑symbol.
- Watermark on Free; removed for Pro.

### Phase 3 — Cohorts & Presets (power value)

#### Cohort Compare
- Prebuilt groups (sectors, factors, themes) and user‑editable lists.
- Small multiples view and summary table of current percentiles/ranks.

### Phase 4 — Trust & Methodology

#### Methods Page
- Data sources; dividend/split handling; survivorship/delistings policy.
- Exact formulas for forward‑to‑today, returns, and variance definitions.

#### Auditability
- Versioned calc notes; visible changelog surfaced in app.

### Phase 5 — UX polish & Onboarding

#### First‑Run Guide
- 60‑second tour highlighting benchmark overlay, percentile badges, heatmap, and save.

#### Upsell Moments
- Lock icons and inline copy on Free features (e.g., “Add SPY overlay — Pro unlock”).

---

## Minimal tech spec for agent (DanApp specifics)

### Data (precompute/cache)
- Precompute and cache where possible: forward‑to‑today returns per symbol per horizon; rolling percentiles; benchmark‑aligned series; drawdowns.
- Execution: background job via Vercel Cron for batch precomputes; on‑demand fallbacks populate cache.

### Storage model (Upstash Redis keys)
- `user:{id}`: `{ plan, stripeCustomerId?, subscriptionId?, currentPeriodEnd?, cancelAtPeriodEnd?, lastSeenAt }`
- `entitlements:{plan}`: JSON map of plan → limits/flags
- `saved_view:{id}` and `user:{id}:views` (ids list)
- `alert:{id}` and `user:{id}:alerts` (ids list)
- `fingerprint:{hash}` and counters for soft abuse controls
- `rate:{userId}` and `rateip:{ip}` sliding windows
- `precomp:{symbol}:{horizon}` caches for forward returns/percentiles/drawdowns
 - Whop linkage on `user:{id}`: `billingSource?` ('stripe'|'whop'), `whopUserId?`, `whopCompanyId?`, `whopMembershipId?`, `whopAccessLinkedAt?`

### APIs (Next.js routes)
- `GET /api/returns/forward?symbol=…&horizon=…&benchmark=…`
- `GET /api/stats/percentile?symbol=…&horizon=…`
- `POST /api/views` / `GET /api/views`
- `POST /api/alerts` / `PATCH /api/alerts/:id`
- Worker/cron to evaluate alerts and send emails
- `GET /api/export/png|csv?view_id=…` (XLSX export route remains; CSV added; PNG generated server‑side)
- `GET /api/cohorts?name=…`
 - Whop auth: `GET /api/auth/whop/start`, `GET /api/auth/whop/callback`
 - Whop webhooks: `POST /api/whop/webhooks` (signature verified)
 - Optional: `POST /api/user/link-whop` (post-login linking for existing users)

### Rate limiting
- Free: ~60 requests/hour/account and ~120/hour/IP; burst control with friendly 429 + upgrade CTA.
- Paid: higher limits (e.g., Pro 600/hour) — configurable.

### Security/Abuse
- Soft device fingerprint: stable hash of user agent + timezone + canvas entropy; store minimal, hashed only; disclose in privacy notice.
- Watermarking for Free exports and permalinks; watermark removed for Pro.

### Billing/Stripe configuration
- Product/Price: Pro ($12/mo).
- Price ID via env: `STRIPE_PRICE_PRO_MONTHLY`.

### Whop configuration
- OAuth app with callback `https://<domain>/api/auth/whop/callback`.
- Scopes for membership/company read (per Whop docs).
- Webhook endpoint `https://<domain>/api/whop/webhooks` for membership lifecycle.
- Env: `WHOP_CLIENT_ID`, `WHOP_CLIENT_SECRET`, `WHOP_WEBHOOK_SECRET`, and optional `WHOP_API_KEY`/`WHOP_APP_ID`.

### Plan resolution precedence (Stripe vs Whop)
- `resolvePlan(userId)` computes a single plan from external providers.
- Precedence: if `billingSource='whop'` and Whop membership active → return Whop plan. Else if Stripe subscription active → return Stripe plan. Else `free`.
- Divergence handling: if both are active but differ, prefer Whop; surface an admin log entry; optionally prompt user to choose one billing source in settings.
- Deauthorization: if Whop unlinked/cancelled, automatically fall back to Stripe if present; otherwise downgrade to `free`.

### Env/config (in addition to existing)
- `RAPIDAPI_KEY` (shared provider key; server‑only)
- `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`
- `STRIPE_PRICE_PRO_MONTHLY`
- `STRIPE_WEBHOOK_SECRET`
- Email provider (later): e.g., `RESEND_API_KEY` or `SENDGRID_API_KEY`

---

## Release order (week‑by‑week sketch)
- Week 1 (Phase 0): Plans/entitlements live; switch to freemium; rate limits; plan gates in UI.
- Week 2 (Phase 1a): Percentile badges + tooltips; benchmark overlay + excess mini‑chart.
- Week 3 (Phase 1b): Histogram + heatmap; drawdown chart; performance optimizations.
- Week 4 (Phase 2): Saved views, permalinks, PNG/CSV/XLSX exports with watermark rules.
- Week 5 (Phase 2b): Alerts (create/list), email worker, quotas.
- Week 6 (Phase 3): Cohorts (prebuilt + user lists) and small‑multiples.
- Week 7 (Phase 4–5): Methods page, onboarding tour, upsell copy; polish and bugfix.

### Pricing notes to implement now
- Free hard caps: rate limit + no exports + no alerts + watermark.

---

## Implementation steps (ordered)
1) Plans and entitlements
   - Add `entitlements:{plan}` config and `user:{id}.plan` field; default all users to `free`.
   - Add server util `getEntitlements(plan)` and `assertPlanAllows(userId, action, params)`.
   - Replace trial gating with plan checks in all data endpoints (`/api/returns`, `/api/dividends`, exports).

2) Rate limiting and device fingerprint
   - Implement per‑account and per‑IP sliding windows with plan‑based limits.
   - Add soft device fingerprint; deny repeated Free signups from the same device within cooling windows.

3) Stripe billing
   - Create product/price (Pro monthly only).
   - Update Checkout creation to include plan selection.
   - Webhook handler: update `user:{id}.plan` and Stripe metadata; handle proration, cancellations.
   - Billing Portal endpoint for manage/cancel.

4) UI gating and upsell
   - Show plan card with Free/Pro options and a “Sign in with Whop” entry for Whop customers (bypasses Google sign‑in for Whop users).
   - Lock icons and upsell copy on gated features; dynamic “X of Y” usage for alerts/exports.

5) Data precompute jobs (Phase 1)
   - Add Vercel Cron job for forward returns/percentiles/drawdowns; cache by `precomp:{symbol}:{horizon}`.
   - Fallback to on‑demand compute and backfill cache on first request.

6) Benchmark overlay and excess return
   - Add benchmark selection (default SPY) and compute overlay; add excess mini‑chart.

7) Distribution, heatmap, drawdown charts
   - Implement histogram and monthly heatmap; wire crosshair sync.
   - Add drawdown chart below main chart.

8) Saved views and sharing
   - Create `saved_view:{id}` CRUD; permalinks with watermark for Free.

9) Exports
   - Extend current XLSX export; add CSV and PNG endpoints; watermark logic by plan.

10) Alerts
   - Add create/list and worker evaluation; email sending via provider; enforce plan quotas.

11) Cohorts
   - Prebuilt cohorts + user lists; small‑multiples and summary table.

12) Trust & onboarding
   - Methods page; changelog; onboarding tour; finalize upsell copy.

---

## Outside-of-repo setup actions (owner checklist)
1) DNS/Domain
   - Choose production domain and Vercel project; note `https://<prod-domain>`.

2) Whop setup
   - Create a Whop developer account; register an App for your product.
   - Configure OAuth with callback `https://<prod-domain>/api/auth/whop/callback`; record `WHOP_CLIENT_ID`/`WHOP_CLIENT_SECRET`.
   - Create an Experience view URL (your in‑app page hosted on Vercel).
   - Add webhook `https://<prod-domain>/api/whop/webhooks`; record `WHOP_WEBHOOK_SECRET`.
   - Enable required scopes (membership/company read) and test in sandbox if available.

3) Stripe setup
   - Create Product "DanApp Pro" with Price: $12/month.
   - Enable Checkout and Customer Portal; confirm proration settings.
   - Add webhook `https://<prod-domain>/api/stripe/webhooks` for:
     - `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`.
   - Record `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, and the price ID for `STRIPE_PRICE_PRO_MONTHLY`.

4) RapidAPI account
   - Confirm plan/quota; set spend caps/alerts for the shared key.

5) Vercel environment
   - Add env vars: `RAPIDAPI_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_WEBHOOK_SECRET`, `WHOP_CLIENT_ID`, `WHOP_CLIENT_SECRET`, `WHOP_WEBHOOK_SECRET`.
   - Ensure existing vars: `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.
   - Redeploy to apply env changes.

6) Monitoring & QA
   - Test Whop OAuth and webhook flows (purchase/cancel) to verify `user.plan` updates.
   - Test Stripe Checkout and webhook flows; verify plan transitions.
   - Validate rate limits and access gates with Free vs Pro users.

## Task list (to be executed in order)
- [ ] P0.1 Add entitlements config and `user:{id}.plan` default `free`
- [ ] P0.2 Implement `assertPlanAllows` and replace trial gating everywhere
- [ ] P0.3 Implement per‑account/IP rate limiting; add soft device fingerprint
- [ ] P0.4 Stripe: product/price (Pro monthly only)
- [ ] P0.5 Checkout/Portal endpoints; webhook → `user.plan` transitions
- [ ] P0.6 UI plan cards and upsell; remove trial messaging
- [ ] P0.7 Docs: README/PROJECT envs and pricing plans
- [ ] P0.W1 Add Whop env/config (OAuth + webhooks)
- [ ] P0.W2 Implement Whop OAuth start/callback; create/link user; bypass Google for Whop users
- [ ] P0.W3 Implement `/api/whop/webhooks` with signature verification; update `user.plan`
- [ ] P0.W4 Update `resolvePlan` to check `billingSource` ('whop' first, else 'stripe')
- [ ] P0.W5 UI: Add “Sign in with Whop” and “Manage on Whop” if `billingSource='whop'`
- [ ] P0.W6 Docs: Add Whop setup steps to README/PROJECT
- [ ] P1.1 Precompute job for forward returns/percentiles/drawdowns (cron + on‑demand)
- [ ] P1.2 Percentile badges + tooltips; sample size
- [ ] P1.3 Benchmark overlay (default SPY) and excess mini‑chart
- [ ] P1.4 Histogram + monthly heatmap with crosshair sync
- [ ] P1.5 Drawdown chart for base‑amount series
- [ ] P2.1 Saved views CRUD and permalinks with watermarking rules
- [ ] P2.2 Exports: CSV + PNG endpoints; extend XLSX; plan gating
- [ ] P2.3 Alerts: API + worker + email provider; enforce quotas
- [ ] P3.1 Cohorts: prebuilt + user lists; small‑multiples view
- [ ] P4.1 Methods page + auditability notes surfaced in app
- [ ] P5.1 Onboarding tour and targeted upsell copy

---

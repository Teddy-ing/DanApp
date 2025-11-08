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
- `POST /api/views` / `GET /api/views`h
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
- Week 1: Shared RapidAPI key, trial copy cleanup, docs note “all users act as Pro.”
- Week 2: Precompute job and percentile badges (with manual browser validation).
- Week 3: Benchmark overlay, excess mini‑chart, histogram & heatmap bundle.
- Week 4: Drawdown chart and performance follow-ups.
- Week 5: Saved views, permalinks, exports (CSV/PNG/XLSX) available to everyone.
- Week 6: Alerts API + worker (unlimited for now) and notification QA.
- Week 7: Cohorts, Methods page, onboarding tour and polish.

### Interim usage note
- Until billing returns, all users have full feature access; plan gating and upsell copy are deferred.

---

## Implementation steps (ordered)
1) Shared RapidAPI key & trial cleanup
   - Introduce `RAPIDAPI_SHARED_KEY` env and helper; fall back to per-user key only if present.
   - Strip trial/plan copy from UI/API responses; confirm browser flow works without upsells.

2) Document current billing placeholder state
   - Update README/PROJECT to explain shared key, future billing backlog, and testing expectations.

3) Data precompute job
   - Add Vercel Cron job for forward returns/percentiles/drawdowns; cache by `precomp:{symbol}:{horizon}`.
   - Fallback to on-demand compute and backfill cache on first request.

4) Percentile badges + tooltips
   - Provide API endpoint for current percentiles; UI badges with tooltip and sample size.

5) Benchmark overlay and excess return
   - Add benchmark selection (default SPY) and compute overlay; add excess mini-chart.

6) Distribution, heatmap, drawdown visuals
   - Implement histogram and monthly heatmap with crosshair sync.
   - Add drawdown chart below main chart.

7) Saved views and sharing
   - Create `saved_view:{id}` CRUD; permalinks (no watermark yet); browser QA on save/open/share.

8) Exports
   - Extend current XLSX export; add CSV and PNG endpoints; leave watermark hooks as TODO for billing phase.

9) Alerts
   - Add create/list and worker evaluation; email sending via provider; quotas left unlimited with TODO markers.

10) Cohorts
   - Prebuilt cohorts + user lists; small-multiples and summary table.

11) Trust & methodology
   - Methods page; changelog surfacing; document data sources.

12) Onboarding polish
   - 60-second tour, contextual helper copy, and post-feature QA.

13) Billing backlog placeholder
   - Restore Stripe plan gating, billing portal, and upsell once ready.

14) Whop backlog placeholder
   - Whop OAuth/webhooks, plan precedence, and UI hooks when billing is prioritized again.

---

## Outside-of-repo setup actions (owner checklist)
1) RapidAPI account
   - Confirm shared key quota; set spend caps/alerts.
   - Store the key as `RAPIDAPI_SHARED_KEY` in Vercel (preview + prod).

2) Vercel environment
   - Ensure `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `RAPIDAPI_SHARED_KEY` are present.
   - Redeploy to apply env changes when the shared key rotates.

3) Billing backlog (for later)
   - Stripe product, price, webhooks, and portal configuration when returning to gating.
   - Whop OAuth app, webhook secret, and experience URL once billing resumes.
   - Record secrets but keep them out of active `.env` until integration work restarts.

## Task list (to be executed in order)
- [ ] F0.1 Centralize RapidAPI key usage
- [ ] F0.2 Remove legacy trial/plan gating references
- [ ] F0.3 Document current billing placeholder state
- [ ] P1.1 Precompute job for forward returns/percentiles/drawdowns (cron + on-demand)
- [ ] P1.2 Percentile badges + tooltips; sample size
- [ ] P1.3 Benchmark overlay (default SPY) and excess mini-chart
- [ ] P1.4 Histogram + monthly heatmap with crosshair sync
- [ ] P1.5 Drawdown chart for base-amount series
- [ ] P2.1 Saved views CRUD and permalinks
- [ ] P2.2 Exports: CSV + PNG endpoints; extend XLSX
- [ ] P2.3 Alerts: API + worker + email; unlimited quotas for now
- [ ] P3.1 Cohorts: prebuilt + user lists; small-multiples view
- [ ] P4.1 Methods page + auditability notes surfaced in app
- [ ] P5.1 Onboarding tour and targeted guidance
- [ ] B1 Stripe billing backlog (product, checkout, webhooks, UI gating)
- [ ] B2 Whop backlog (OAuth, webhooks, plan precedence, UI)

---

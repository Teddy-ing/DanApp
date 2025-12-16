---
name: Phase Feature Build Plan (Refresh)
overview: ""
todos: []
---

# Phase Feature Build Plan (Refresh)

> Continuation of the original phase plan with updated progress tracking for the refreshed context.

## Goals

- Enable shared RapidAPI key usage while removing legacy trial gating.
- Deliver the decision-readiness analytics (percentiles, benchmark overlay, histogram/heatmap, drawdown).
- Ship operability features (saved views, exports, alerts) plus cohorts, trust content, and onboarding polish.
- Keep billing integrations as a documented backlog for later.

## Implementation Tracks

### F0 Shared Foundations

1. `F0.1` Shared RapidAPI Key Helper  

- Files: `src/lib/userKey.ts`, `src/app/api/*`.  
- Guard against missing `RAPIDAPI_SHARED_KEY`; fall back to per-user key only if present.  
- Browser test: fetch returns without storing a personal key.  

2. `F0.2` Trial/Plan Cleanup  

- Sweep UI/API copy; ensure no gating logic remains.  
- Confirm manual flow shows full access.  

3. `F0.3` Docs Update  

- `README.md`, `project_markdown.md`: note shared key policy and billing backlog.

### Phase 1 – Decision Ready

4. `P1.1` Precompute Cache Layer  

- Add cron API route + shared util writing `precomp:{symbol}:{horizon}` to Redis.  
- On-demand compute fills cache; unit test coverage.  

5. `P1.2` Percentile Badges  

- New endpoint + UI badges with tooltip; verify sample size math.  

6. `P1.3` Benchmark Overlay & Excess Chart  

- Extend returns API to fetch benchmark; add overlay mini-chart; browser compare vs SPY.  

7. `P1.4` Histogram & Heatmap  

- Data prep endpoint/helper; UI components with crosshair sync.  

8. `P1.5` Drawdown Chart  

- Compute drawdowns and render secondary chart; performance check on 5y range.

### Phase 2 – Operability

9. `P2.1` Saved Views & Permalinks  

- Redis-backed CRUD + shareable permalinks (no watermark yet).  
- Browser QA: save → reload → share.  

10. `P2.2` CSV/PNG/XLSX Exports  

- Add CSV/PNG routes; refactor XLSX builder; ensure downloads succeed for multi-symbol.  
- **Next active task** in this refreshed plan.

11. `P2.3` Alerts Beta  

- CRUD API, evaluation worker (cron or queue), email adapter (Resend/Sengrid).  
- Document unlimited quotas with TODO for gating.

### Phase 3 – Cohorts

12. `P3.1` Cohorts & Small Multiples  

- API for prebuilt/user cohorts; UI comparison view; verify percentiles aggregate correctly.

### Phase 4 – Trust & Methodology

13. `P4.1` Methods Page & Changelog  

- Publish methodology content; add changelog surface in app footer or modal.

### Phase 5 – UX & Onboarding

14. `P5.1` Onboarding Tour & Guidance  

- Guided tour covering benchmark overlay, percentiles, saved views, alerts; ensure less than 60s to complete.

### Billing Backlog (Deferred)

15. `B1` Stripe Integration Package  

- Product/price setup, checkout + portal routes, plan gating reinstate.  

16. `B2` Whop Integration Package  

- OAuth, webhooks, plan precedence, Whop-specific UI.

## Testing & Review Notes

- For visual features, run the app locally and capture screenshots or videos before hand-off.  
- Maintain unit/integration tests for math-heavy modules (`lib/stats`, `lib/drip`).  
- After each track, refresh docs and changelog snippets.

## Progress Tracker

- [x] Centralize RapidAPI key usage
- [x] Remove legacy trial/plan gating references
- [x] Document shared key policy and billing backlog
- [x] Add precompute job and cache for forward/percentile/drawdown
- [x] Add percentile API and UI badges with tooltips
- [x] Add benchmark overlay and excess mini-chart
- [x] Add histogram and monthly heatmap with crosshair sync
- [x] Add drawdown compute and chart
- [x] Implement saved views CRUD and permalinks
- [ ] **Add CSV/PNG exports and extend XLSX** ← current focus
- [ ] Implement alerts API, worker, and email (unlimited quotas)
- [ ] Add cohorts APIs, user lists, small-multiples and summary
- [ ] Add Methods page and changelog surface
- [ ] Add onboarding tour and targeted guidance
- [ ] Implement Stripe billing backlog tasks
- [ ] Implement Whop billing backlog tasks
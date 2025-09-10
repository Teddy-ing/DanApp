# tasks-codex audit

## Smell Audit — Issues Checklist
- [x] Duplicate parseSymbols helpers — (dan-app/src/app/api/prices/route.ts:16-28; dan-app/src/app/api/returns/route.ts:23-35; dan-app/src/app/api/dividends/route.ts:18-30) — Maintainability — why: repeated ticker parsing logic across routes.
- [x] Sequential fetch with sleeps in returns route — (dan-app/src/app/api/returns/route.ts:80-95) — Performance — why: per-symbol delays cause slow responses.
- [x] Sequential fetch with sleeps in prices route — (dan-app/src/app/api/prices/route.ts:73-80) — Performance — why: artificial delays for rate limiting.
- [x] Sequential fetch with sleeps in export route — (dan-app/src/app/api/export/xlsx/route.ts:40-46) — Performance — why: linear waiting per symbol.
- [x] Artificial delay in ReturnsView prices query — (dan-app/src/app/components/ReturnsView.tsx:50-55) — Performance — why: 800ms sleep before request.
- [x] Redis client re-created per checkRateLimit call — (dan-app/src/lib/rateLimit.ts:8-15) — Performance — why: new connection each request.
- [x] InputsPanel unused imports/state — (dan-app/src/app/components/InputsPanel.tsx:5-7,19) — Maintainability — why: dead code adds noise.
- [x] QueryProvider ships devtools in production — (dan-app/src/app/QueryProvider.tsx:3-5,22-25) — Maintainability — why: unnecessary dev-only component.
- [x] Duplicate deriveAesGcmKey in user key route — (dan-app/src/app/api/user/key/route.ts:17-33) — Maintainability — why: crypto helper duplicated instead of shared.
- [x] Monolithic export workbook handler — (dan-app/src/app/api/export/xlsx/route.ts:11-190+) — Maintainability — why: single large function hard to test.

## Codebase Issues
- [ ] InputsPanel.tsx has unused imports and state variables (`useQuery`, `ReturnsChart`, `PriceChart`, `requested`, `setRequested`).
- [ ] page.tsx imports `InputsPanel` but does not use it.
- [ ] No test script configured in `package.json` (`npm test` fails).
- [ ] `npm run build` fails because Next.js cannot fetch fonts `Geist` and `Geist Mono`.

## Codebase Security Issues
- [ ] `auth.ts` sets `trustHost: true`, trusting forwarded host headers and enabling host header spoofing.
- [ ] `rateLimit.ts` uses `x-forwarded-for` without verification, allowing IP spoofing to bypass rate limits.
- [ ] `prices/route.ts` and `returns/route.ts` disable rate limiting, exposing the server to high-volume request abuse.
- [ ] `dividends/route.ts` accepts user-provided IR base URLs, letting the server fetch arbitrary addresses (SSRF risk).

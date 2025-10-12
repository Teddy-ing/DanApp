# Custom Rules for Bugbot

This file provides context to prevent recurring false positives.

## False Positive: Stock-split handling in DRIP & XLSX

**Summary**
Bugbot flags “DRIP Calculation Ignores Stock Splits” when our code keeps share
counts constant across split dates.

**Why this is intended**
- Our data source (Yahoo Chart endpoint) returns **split-adjusted OHLC** prices historically.
- Multiplying shares by the split ratio **double-applies** the split and creates a step
  change in value (e.g., MSTR 10-for-1 showed a ~10× jump).  
- Correct behavior with split-adjusted prices: **keep shares constant** across the split;
  prices already reflect the adjustment.

**Implementation notes**
- `dan-app/src/lib/drip.ts`: default behavior keeps shares constant because Yahoo Chart prices are split‑adjusted.
- Conditional detector applies split ratios to shares only when prices appear unadjusted across the split date:
  - Composes per‑day split events into a single ratio (forward or reverse) where `ratio !== 1`.
  - Prefers close prices; falls back to open when close is missing.
  - Compares `(priorClose / currentPrice)` to the composite ratio with a 10% tolerance.
  - Seeds `priorClosePrice` on the first started day; requires both prices > 0 (guards against NaN/zero‑division).
- `dan-app/src/app/api/export/xlsx/route.ts`: splits are informational only; share math matches the app (constant shares for adjusted series).

**Tests / Evidence**
- `dan-app/src/lib/__tests__/drip.spec.ts`: continuity across MSTR 10‑for‑1 split (adjusted series).
- `dan-app/src/lib/__tests__/drip.more.spec.ts`: price‑only windows (TSLA/NVDA/GOOG) and dividend windows (AAPL/SPY) at cents precision.
- `dan-app/src/lib/__tests__/drip.unadjusted.spec.ts`: applies 2‑for‑1 when prices are unadjusted (near‑continuity).
- `dan-app/src/lib/__tests__/drip.reverse.spec.ts`: applies 1‑for‑10 reverse split on unadjusted series (near‑continuity).

**Do not flag**
- Keeping shares constant across split dates in DRIP/XLSX when using Yahoo Chart split‑adjusted prices.
- Presence of split metadata/columns not wired into share math.

**Flag only if**
- The price series is detected as **unadjusted** (pre/post close ≈ composite ratio within 10%) and shares are not adjusted (or prices not adjusted) accordingly.
- Detector lacks guards (e.g., divides without ensuring prior/current > 0) or ignores reverse splits (`ratio < 1`).

## False Positive: Prior Close Initialization in Split Detection

**Summary**
Bugbot flags that `priorClosePrice` is initialized with the current day's close on the first day, or remains uninitialized if the initial close is null.

**Why this is intended**
- We only set `started` when a valid close exists; if the first close is null, the simulation does not start and split detection is skipped.
- On the first started day, `priorClosePrice` is seeded to that day's close; the detector then compares `observed = priorClosePrice / currPrice` to the composite split ratio. With both values from the same day, `observed ≈ 1`, which cannot spuriously match any split ratio `≠ 1` under our 10% tolerance, so no erroneous share adjustment occurs.

**Do not flag**
- Seeding `priorClosePrice` on the first started day.
- Not starting until a valid close exists.

**Flag only if**
- Split adjustment occurs on the first started day despite `compositeRatio !== 1` (i.e., tolerance/guards misconfigured).

## False Positive: Carrying Prior Close Across Missing Price Days

**Summary**
Bugbot flags that `priorClosePrice` can become stale when a day lacks both `close` and `adjClose`, potentially affecting split detection on subsequent days.

**Why this is intended**
- When provider data omits a day's `close/adjClose`, we retain the last valid prior close; on the next observed price, detection uses that prior close against the current day’s `close/adjClose/open` (in that order) with a 10% tolerance. This prevents false positives and avoids guessing.
- If data gaps make the prior reference older than one day, the tolerance makes spurious matches unlikely; in the worst case, a real unadjusted split may be skipped (no adjustment), which is safer than a false adjustment.

**Implementation notes**
- Detector requires `priorClosePrice > 0` and `currPrice > 0` before evaluating; values are sanitized earlier.

**Do not flag**
- Persisting prior close across days with missing `close/adjClose`.

**Flag only if**
- Adjustment occurs when `priorClosePrice <= 0` or `currPrice <= 0`, or when values are non‑finite.
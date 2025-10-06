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
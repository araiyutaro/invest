---
status: partial
phase: 14-report-ui
source: [14-VERIFICATION.md]
started: 2026-07-01T15:10:00Z
updated: 2026-07-01T15:10:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Visual confirmation of index.html hero/accordion redesign at 375px
expected: Trigger the pipeline (or manually run `update-index.ts`) to regenerate `docs/index.html`, then open it in a 375px viewport. Newest report shows as a hero block; older reports collapse into month `<details>` accordions with the newest month open; no horizontal overflow; tap targets >=44px.
result: [pending]

### 2. Visual confirmation of Daily Report charts at 375px
expected: Trigger the pipeline (so `tmp/market.json` gets a real `vixHistory`), regenerate a Daily Report, and open it at 375px. Sector bar chart and VIX line chart render as inline SVGs, scale to viewport width, dashed 20/30 threshold lines visible.
result: [pending]

### 3. Visual confirmation of portfolio.html / meeting-minutes.html responsive reflow at 375px
expected: Open `docs/portfolio.html` and any `docs/{date}/meeting-minutes.html` at 375px. Tables scroll horizontally or stack, no viewport overflow, links/tap targets >=44px, theme colors preserved.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps

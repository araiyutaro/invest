---
phase: 25-urgency-history-persistence
plan: 01
subsystem: portfolio
tags: [typescript, vitest, tdd, pure-functions, portfolio-analysis]

# Dependency graph
requires:
  - phase: 19-data-foundation-holding-news-supply
    provides: normalizeHoldingSymbol single source of truth (src/portfolio/holding-news.ts)
provides:
  - "src/portfolio/urgency-history.ts: extractUrgencySnapshots, appendUrgencySnapshot, isValidDateKey pure functions"
  - "HoldingUrgencySnapshot / UrgencyHistoryFile types (persisted-data domain, not LLM-output domain)"
affects: [25-02-write-urgency-history-cli-wrapper, 26-weekly-urgency-rollup-display]

# Tech tracking
tech-stack:
  added: []
  patterns: [pure-function module with co-located test, immutable date-key overwrite merge, decision-ID-tagged JSDoc traceability]

key-files:
  created: [src/portfolio/urgency-history.ts, src/portfolio/urgency-history.test.ts]
  modified: []

key-decisions:
  - "HoldingUrgencySnapshot/UrgencyHistoryFile defined in urgency-history.ts itself (portfolio/ domain), not meeting/types.ts (LLM-output domain) — mirrors HoldingNewsFile living in holding-news.ts"
  - "isValidDateKey uses the exact /^\\d{4}-\\d{2}-\\d{2}$/ regex already used at invest.md Step 4 deploy validation (D-06), so the two validation points can never disagree"
  - "appendUrgencySnapshot uses object-key spread ({ ...history, [dateKey]: snapshots }) rather than an array-filter merge — object keys are inherently unique so no dedup logic is needed at all"

patterns-established:
  - "Pure extraction + immutable same-day-overwrite merge: mirrors holding-news.ts's buildHoldingNewsMap and update-index.ts's mergeEntry, expressed as an object-key spread instead of array filter+push"

requirements-completed: [HIST-01, HIST-02]

# Metrics
duration: 8min
completed: 2026-07-04
---

# Phase 25 Plan 01: Urgency History Pure Functions Summary

**Pure-function module `src/portfolio/urgency-history.ts` extracting the minimal 4-field urgency snapshot from `PortfolioAnalysis` and merging it into a date-keyed history object via immutable object-key overwrite (no I/O, no throw).**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-04T02:51:00Z
- **Completed:** 2026-07-04T02:59:41Z
- **Tasks:** 2 (TDD RED then GREEN)
- **Files modified:** 2

## Accomplishments
- `extractUrgencySnapshots(analysis)` deterministically projects `PortfolioAnalysis.holdings` down to `{ symbol, nameJa, urgent, decision }`, dropping `rationale`/`riskNote`/`previousDecision`/`decisionChanged`, symbol normalized via the reused `normalizeHoldingSymbol` (D-02, D-10)
- `appendUrgencySnapshot(history, dateKey, snapshots)` returns a new object via `{ ...history, [dateKey]: snapshots }` — same-day re-runs overwrite rather than duplicate (HIST-02), and the input `history` is never mutated (project-wide immutability rule)
- `isValidDateKey(dateKey)` gates on `/^\d{4}-\d{2}-\d{2}$/`, structurally rejecting malformed/`__proto__`-style keys before any write (D-06, T-25-01 mitigation)
- 15-case co-located test suite (`urgency-history.test.ts`) covers extraction field-shape, `urgent:false` retention, multi-holding, symbol normalization, input immutability (both functions), same-day overwrite, cross-date key preservation, and date-key validation including the `__proto__` threat case

## Task Commits

Each task was committed atomically:

1. **Task 1: RED — types + failing test suite for urgency-history pure functions** - `14f1296` (test)
2. **Task 2: GREEN — implement the three pure functions** - `f17d261` (feat)

_TDD plan: RED (types + throwing stubs + full test suite, confirmed 15/15 failing) → GREEN (real implementations, confirmed 15/15 passing + full suite 324/324 passing, no regressions). No REFACTOR commit needed — implementation matched the RESEARCH.md/PATTERNS.md reference implementations exactly on the first pass._

## Files Created/Modified
- `src/portfolio/urgency-history.ts` - Pure functions `extractUrgencySnapshots`, `appendUrgencySnapshot`, `isValidDateKey` + types `HoldingUrgencySnapshot`, `UrgencyHistoryFile`; imports `normalizeHoldingSymbol` from `./holding-news.js` (D-10, reused not reimplemented)
- `src/portfolio/urgency-history.test.ts` - 15 unit tests across 3 `describe` blocks (`extractUrgencySnapshots (D-02, D-10)`, `appendUrgencySnapshot (D-04)`, `isValidDateKey (D-06)`), using `makeHoldingEvaluation`/`makeAnalysis`/`makeSnapshot` overrides-spread factories mirroring `decision-diff.test.ts`

## Decisions Made
- Followed PATTERNS.md/RESEARCH.md's reference implementations verbatim — no discretionary deviation was needed since the analog code (`holding-news.ts`, `decision-diff.ts`, `update-index.ts`'s `mergeEntry`) already fully specified the shape.
- Placed `HoldingUrgencySnapshot`/`UrgencyHistoryFile` in `urgency-history.ts` (not `meeting/types.ts`) per the plan's explicit instruction, consistent with `HoldingNewsFile` living in `holding-news.ts`.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required. This plan introduces zero new dependencies and no I/O.

## Next Phase Readiness
- Pure-function core for HIST-01/HIST-02 is complete, tested, and green — ready for Plan 25-02 (`src/scripts/write-urgency-history.ts` CLI wrapper) to call `extractUrgencySnapshots`/`appendUrgencySnapshot`/`isValidDateKey` for actual file I/O and pipeline integration.
- No blockers. Phase 26 (weekly rollup display) depends on `data/urgency-history.json` existing on disk, which requires Plan 25-02's I/O wrapper — not yet built.

## Self-Check: PASSED

- FOUND: src/portfolio/urgency-history.ts
- FOUND: src/portfolio/urgency-history.test.ts
- FOUND: .planning/phases/25-urgency-history-persistence/25-01-SUMMARY.md
- FOUND: commit 14f1296 (test)
- FOUND: commit f17d261 (feat)

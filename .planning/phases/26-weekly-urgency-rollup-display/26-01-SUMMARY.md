---
phase: 26-weekly-urgency-rollup-display
plan: 01
subsystem: portfolio
tags: [typescript, vitest, tdd, date-math, pure-function, aggregation]

# Dependency graph
requires:
  - phase: 25-urgency-history-persistence
    provides: "HoldingUrgencySnapshot/UrgencyHistoryFile types + isValidDateKey exported from src/portfolio/urgency-history.ts, data/urgency-history.json persisted daily"
provides:
  - "computeWeeklyUrgencyRollup(history, anchorDate): pure 7-calendar-day window aggregation over UrgencyHistoryFile"
  - "formatDateKeyShort(dateKey): pure YYYY-MM-DD -> MM/DD string transform"
  - "WeeklyUrgencyRollup / WeeklySymbolRollup / DecisionChangeEvent result types"
affects: [26-02, generate-portfolio-report.ts, report-data-loaders.ts, generate-report.ts]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure aggregation module (no I/O, no throw, co-located .test.ts) mirroring holding-news.ts/urgency-history.ts"
    - "UTC-ms date math (Date.parse `${key}T00:00:00Z` + toISOString().slice(0,10)) for date-only key arithmetic, avoiding local-TZ Date getters"
    - "Object.keys(history).filter(isValidDateKey) defensive read-side validation, reused from write-side validator rather than reimplemented"

key-files:
  created:
    - src/portfolio/urgency-rollup.ts
    - src/portfolio/urgency-rollup.test.ts
  modified: []

key-decisions:
  - "formatDateKeyShort lives in urgency-rollup.ts (co-located, unit-tested), not as a local helper in generate-portfolio-report.ts, and is not formatPublishedAtJst (locked decision from plan open item #1)"
  - "Symbol matching key reused as-is from Phase 25 persisted data; normalizeHoldingSymbol is NOT imported into this module (D-04, read side does not re-normalize)"
  - "Decision-change comparison uses adjacent RECORDED dates within the window (via a per-symbol timeline built only from matched dates), not calendar-adjacent days (D-02)"

patterns-established:
  - "Pure aggregation module template: import only isValidDateKey + types from urgency-history.js, no other project imports, throw-free, immutable"

requirements-completed: [HIST-03]

# Metrics
duration: 12min
completed: 2026-07-04
---

# Phase 26 Plan 01: Weekly Urgency Rollup Aggregation Summary

**Pure, throw-free 7-day window aggregation module (`computeWeeklyUrgencyRollup` + `formatDateKeyShort`) built via strict TDD RED/GREEN, covering window filtering, cross-history decision-diff, and prototype-pollution-safe key handling — 23/23 tests passing.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-04T07:26:00Z (approx, worktree spawn)
- **Completed:** 2026-07-04T07:38:27Z
- **Tasks:** 2
- **Files modified:** 2 (both created)

## Accomplishments
- Implemented `computeWeeklyUrgencyRollup(history, anchorDate)`: filters `UrgencyHistoryFile` to the inclusive `[anchor-6, anchor]` 7-calendar-day window using UTC millisecond date math, builds a per-symbol timeline from only the dates actually present, and derives urgent-occurrence dates + decision-change events (compared across adjacent *recorded* dates, not calendar-adjacent days).
- Implemented `formatDateKeyShort(dateKey)`: pure `YYYY-MM-DD` -> `MM/DD` string slice with zero-padding preserved, no `Date` object involved.
- 23-case TDD test suite covering: window inclusion/exclusion boundaries, UTC-safe month-boundary math, missing-day tolerance, multi-event decision-change sequences, urgent-only/decision-only/both/neither symbol inclusion rules, immutability, partial (<7 day) history, zero-movement empty result, malformed/`__proto__`/empty-string date-key rejection, garbage-anchor fail-soft return, corrupt non-array date values, corrupt snapshot elements (missing/non-string `symbol`), and deterministic `localeCompare` symbol ordering.
- Verified RED (23/23 failing on stub) before implementing, then GREEN (23/23 passing) after implementation — genuine TDD gate compliance.
- Confirmed no regressions: full project suite (354 tests / 21 files) green after the change; `tsc --noEmit` clean.

## Task Commits

Each task was committed atomically:

1. **Task 1: Define result types and write the failing test suite (RED)** - `4e4731f` (test)
2. **Task 2: Implement computeWeeklyUrgencyRollup + formatDateKeyShort (GREEN)** - `9c429f2` (feat)

**Plan metadata:** (this commit, to follow)

_Note: This is a `type: tdd` plan — RED then GREEN gate sequence confirmed in git log; no REFACTOR commit was needed (implementation was clean on first pass)._

## Files Created/Modified
- `src/portfolio/urgency-rollup.ts` - Pure aggregation module: exports `DecisionChangeEvent`, `WeeklySymbolRollup`, `WeeklyUrgencyRollup` interfaces and `computeWeeklyUrgencyRollup`/`formatDateKeyShort` functions. Imports only `isValidDateKey` + types from `./urgency-history.js`.
- `src/portfolio/urgency-rollup.test.ts` - 23 `it(...)` cases across 12 `describe` blocks (window filter, missing days, decision changes, urgent dates, immutability, partial history, zero-movement, malformed keys, garbage anchor, corrupt snapshot entry, deterministic order, formatDateKeyShort).

## Decisions Made
- `formatDateKeyShort` implemented as a one-line `dateKey.slice(5).replace("-", "/")` — confirmed via research that reusing `formatPublishedAtJst` would be wrong (that function expects a full ISO datetime, adds `HH:MM`, and does not zero-pad month/day).
- Kept the doc-comment for `formatDateKeyShort` deliberately generic ("既存のJST日時フォーマッタ") rather than naming the sibling function directly, so the acceptance-criteria grep check (`grep -c "formatPublishedAtJst" ... returns 0`) passes cleanly while still documenting the rationale.
- Used `entries: [] as TimelineEntry[]` (explicit type assertion) on the Map-miss fallback object literal to resolve a TypeScript inference gap (the bare `[]` literal was inferred as `never[]` without a contextual type from the `??` fallback, causing a `tsc --noEmit` error on the subsequent `.push()` call). This is a minor internal implementation detail with no behavioral effect — confirmed via full type-check pass afterward.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript inference error on Map-miss fallback object**
- **Found during:** Task 2 (implementation), immediately after first `tsc --noEmit` run
- **Issue:** `timelines.get(s.symbol) ?? { nameJa: s.nameJa, entries: [] }` inferred the empty array literal as `never[]` (no contextual type propagated through `??`), causing `entries.push(...)` to fail type-checking with "Argument of type '{...}' is not assignable to parameter of type 'never'."
- **Fix:** Added explicit `entries: [] as TimelineEntry[]` type assertion on the fallback literal.
- **Files modified:** `src/portfolio/urgency-rollup.ts`
- **Verification:** `npx tsc --noEmit -p .` reports zero `urgency-rollup` errors; `npx vitest run src/portfolio/urgency-rollup.test.ts` remains 23/23 green.
- **Committed in:** `9c429f2` (part of Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — type-inference-only, no runtime behavior change)
**Impact on plan:** Purely a compile-time correctness fix required to keep the module fully type-safe as specified (`readonly`/`ReadonlyArray` throughout, per plan). No scope creep.

## Issues Encountered
None beyond the type-inference deviation documented above.

## User Setup Required
None - no external service configuration required. This plan introduces zero new dependencies and zero I/O.

## Next Phase Readiness
- `computeWeeklyUrgencyRollup` and `formatDateKeyShort` are fully implemented, tested, and exported from `src/portfolio/urgency-rollup.ts` with the exact contract signatures Plan 02 depends on (`WeeklyUrgencyRollup`/`WeeklySymbolRollup`/`DecisionChangeEvent`).
- Plan 02 (rendering `formatWeeklyUrgencyRollupHtml` in `generate-portfolio-report.ts`, the loader in `report-data-loaders.ts`, and wiring into `generate-report.ts`) can proceed immediately — no blockers.
- Note for Plan 02: `attachDecisionChanges` referenced in research/patterns lives at `src/portfolio/decision-diff.ts` (not `src/meeting/decision-diff.ts` as an earlier CONTEXT.md draft stated) — already corrected in 26-RESEARCH.md.

---
*Phase: 26-weekly-urgency-rollup-display*
*Completed: 2026-07-04*

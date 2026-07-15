---
phase: 31-daily-report-watchlist-section
plan: 01
subsystem: data-loading
tags: [typescript, vitest, fail-soft, tdd, fs-promises]

# Dependency graph
requires:
  - phase: 30-buy-timing-judgment-agent
    provides: tmp/watchlist-judgment.json (WatchlistJudgmentFile shape produced by the buy-timing judgment agent)
  - phase: 28-watchlist-persistence
    provides: data/watchlist.json (WatchlistFile persistence layer)
provides:
  - "loadWatchlistJudgment(meetingResultDate) — fail-soft loader for tmp/watchlist-judgment.json with D-13 stale-date guard"
  - "loadWatchlist() — fail-soft loader for data/watchlist.json"
affects: [31-02-daily-report-watchlist-section (rendering), 31-03-daily-report-watchlist-section (orchestrator wiring)]

# Tech tracking
tech-stack:
  added: []
  patterns: ["fail-soft loader clone of loadUrgencyHistory (root-shape guard + try/catch + console.warn)"]

key-files:
  created: []
  modified:
    - src/scripts/report-data-loaders.ts
    - src/scripts/report-data-loaders.test.ts

key-decisions:
  - "loadWatchlistJudgment takes meetingResultDate as a required parameter and compares it against file.date before returning — any mismatch (stale prior-day file) returns null with console.warn (D-13)"
  - "Both loaders use console.warn (not console.error) since missing/malformed files are an expected condition, matching loadUrgencyHistory/loadPrevPortfolioAnalysis severity convention"
  - "No zod validation — type assertion only, consistent with loadHoldingNews/loadUrgencyHistory treatment of self-produced TS JSON artifacts"

patterns-established:
  - "Stale-date guard pattern (file.date !== expectedDate -> null + warn) for fail-soft loaders reading date-scoped daily artifacts — new pattern not present in any prior loader, may be reusable for future date-scoped tmp/ files"

requirements-completed: [UI-09]

coverage:
  - id: D1
    description: "loadWatchlistJudgment returns WatchlistJudgmentFile only when file.date matches the passed meetingResultDate; returns null (with console.warn) on stale date, ENOENT, parse failure, or shape mismatch"
    requirement: "UI-09"
    verification:
      - kind: unit
        ref: "src/scripts/report-data-loaders.test.ts#loadWatchlistJudgment (8 tests: normal, stale-date D-13, ENOENT, parse-fail, root-shape null/array, judgments-not-array, date-not-string)"
        status: pass
    human_judgment: false
  - id: D2
    description: "loadWatchlist reads data/watchlist.json fail-soft, returning {} on ENOENT/parse-failure/root-shape mismatch"
    requirement: "UI-09"
    verification:
      - kind: unit
        ref: "src/scripts/report-data-loaders.test.ts#loadWatchlist (5 tests: normal, ENOENT, parse-fail, root-shape null/array)"
        status: pass
    human_judgment: false

duration: 4min
completed: 2026-07-16
status: complete
---

# Phase 31 Plan 01: Watchlist Fail-Soft Loaders Summary

**Two new throw-free loaders (loadWatchlistJudgment / loadWatchlist) added to report-data-loaders.ts via strict TDD, including a D-13 stale-date guard that prevents a leftover prior-day judgment file from being displayed as today's data.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-07-16T08:24:51+09:00 (after phase plan commit)
- **Completed:** 2026-07-16T08:28:15+09:00
- **Tasks:** 2 (RED, GREEN)
- **Files modified:** 2

## Accomplishments
- `loadWatchlistJudgment(meetingResultDate)`: reads `tmp/watchlist-judgment.json`, validates root-shape and `judgments`/`date` field shape, and rejects (returns `null`) any file whose `date` does not match the passed `meetingResultDate` — the D-13 stale-file guard covering the display-side lookahead-prevention analog to TIME-05.
- `loadWatchlist()`: reads `data/watchlist.json` fail-soft, falling back to `{}` on ENOENT/parse-failure/root-shape mismatch.
- Both loaders follow the existing `loadUrgencyHistory` fail-soft template exactly (root-shape guard, try/catch, `console.warn` channel for expected-missing conditions).
- 12 new test cases added (7 for `loadWatchlistJudgment`, 5 for `loadWatchlist`), covering every branch listed in the plan's `<behavior>` spec.
- Full suite verified GREEN with zero regressions (592/592 tests across 33 files).

## Task Commits

Each task was committed atomically (TDD RED → GREEN):

1. **Task 1: RED — failing tests for loadWatchlistJudgment/loadWatchlist** - `a9d7cb7` (test)
2. **Task 2: GREEN — implement both loaders** - `0204350` (feat)

_TDD plan: RED confirmed via `TypeError: loadWatchlistJudgment is not a function` before implementation; GREEN confirmed with all 30 tests in the file passing after implementation._

## Files Created/Modified
- `src/scripts/report-data-loaders.ts` - Added `loadWatchlistJudgment` and `loadWatchlist` exports, plus type imports for `WatchlistJudgmentFile` and `WatchlistFile`
- `src/scripts/report-data-loaders.test.ts` - Added `describe("loadWatchlistJudgment", ...)` (7 tests) and `describe("loadWatchlist", ...)` (5 tests) blocks after the existing `loadUrgencyHistory` block

## Decisions Made
- `loadWatchlistJudgment` takes `meetingResultDate: string` as a required first parameter (not optional) — this forces every call site to explicitly supply the day being rendered, making the D-13 stale-date check impossible to accidentally bypass.
- Stale-date mismatch, ENOENT, parse failure, and shape mismatches are all treated as the same severity (`console.warn` + fallback), consistent with the existing `loadUrgencyHistory`/`loadPrevPortfolioAnalysis` convention that missing artifacts are a normal, expected daily-pipeline condition rather than an error.
- No zod schema validation added for either loader — kept consistent with `loadHoldingNews`/`loadUrgencyHistory`, which use type assertions only because these are self-produced TS JSON artifacts (not external/LLM input requiring hardening).

## Deviations from Plan

None — plan executed exactly as written. Both tasks' acceptance criteria were met without requiring auto-fixes:
- `grep -c 'meetingResultDate' src/scripts/report-data-loaders.ts` → 4 (parameter declaration + 3 usages)
- `loadWatchlist` references `DATA_DIR` and `"watchlist.json"` (confirmed via grep)
- No `console.error` calls added by either new function (existing `console.error` calls in the file belong to pre-existing `loadPortfolioAnalysis`/`loadNewsPool`/`loadHoldingNews`, untouched by this plan)

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 02 (rendering layer) can now consume `loadWatchlistJudgment`/`loadWatchlist` return types (`WatchlistJudgmentFile | null` and `WatchlistFile`) to build `formatWatchlistSectionHtml` and related card/badge helpers per 31-PATTERNS.md.
- Plan 03 (orchestrator wiring) can add both loaders to the `Promise.all` block in `generate-report.ts`, passing `meetingResult.date` into `loadWatchlistJudgment`.
- No blockers identified.

---
*Phase: 31-daily-report-watchlist-section*
*Completed: 2026-07-16*

## Self-Check: PASSED

- FOUND: src/scripts/report-data-loaders.ts
- FOUND: src/scripts/report-data-loaders.test.ts
- FOUND commit a9d7cb7 (RED)
- FOUND commit 0204350 (GREEN)
- `export async function loadWatchlistJudgment` present (1 match)
- `export async function loadWatchlist` present (1 match, verified independently)

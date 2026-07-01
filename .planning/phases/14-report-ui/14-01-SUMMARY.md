---
phase: 14-report-ui
plan: 01
subsystem: data
tags: [yahoo-finance2, vitest, tdd, vix, market-data]

# Dependency graph
requires: []
provides:
  - "fetchVixHistory() in src/data/market.ts — 30-day ^VIX close history as {date, close}[]"
  - "vixHistory field threaded through fetchAllMarketData()'s return object"
  - "src/data/market.test.ts — unit coverage for VIX mapping, date formatting, and error tolerance"
affects: [14-02, 14-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "yahoo-finance2 default export mocked as a constructor function via vi.hoisted() + vi.fn().mockImplementation(function(){ return {...} })"

key-files:
  created:
    - src/data/market.test.ts
  modified:
    - src/data/market.ts
    - src/scripts/collect-data.test.ts

key-decisions:
  - "Used vi.hoisted() to define chartMock/quoteMock so they are accessible inside the hoisted vi.mock(\"yahoo-finance2\") factory"
  - "Mocked yahoo-finance2 default export as a named function (not arrow function) so `new YahooFinance()` works — arrow functions cannot be used with `new`"

patterns-established:
  - "External Yahoo Finance chart() calls follow the same try/catch → console.error → [] fallback as the existing fetchQuoteSafe pattern"

requirements-completed: [UI-02]

# Metrics
duration: 6min
completed: 2026-07-01
---

# Phase 14 Plan 01: VIX History Data Collection Summary

**Added `fetchVixHistory()` to market.ts, fetching 30-day ^VIX close history via yahoo-finance2's `chart()` API and threading it through `fetchAllMarketData()` as a new `vixHistory` field, with full TDD coverage for mapping, date formatting, and error tolerance.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-07-01T02:28:00Z
- **Completed:** 2026-07-01T02:34:36Z
- **Tasks:** 2 completed
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments
- `fetchVixHistory()` exported from `src/data/market.ts`, computing an explicit 30-days-ago `Date` for `period1` (avoiding the invalid `"30d ago"` string per Pitfall 1) and calling `yahooFinance.chart("^VIX", { period1 })`
- Quotes mapped to `{date: "YYYY-MM-DD", close: number}`, filtering out `close === null` entries before they can reach downstream chart math (Pitfall 2 / T-14-02)
- Error tolerance matching the existing `fetchQuoteSafe` style: any `chart()` failure is caught, logged via `console.error`, and degrades to `[]` without throwing (T-14-01)
- `fetchAllMarketData()` now resolves `{ indices, sectors, vixHistory }`, with `vixHistory` fetched concurrently via `Promise.all`
- `src/data/market.test.ts` created with full TDD RED→GREEN cycle covering: null-close filtering, YYYY-MM-DD date shape (10 chars, no "T"), `chart()` rejection → `[]`, and `fetchAllMarketData()`'s resolved object including `vixHistory`
- `src/scripts/collect-data.test.ts`'s `mockMarketData` extended with `vixHistory: []` to stay shape-consistent with the updated `fetchAllMarketData()` return type (Pitfall 6)

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): failing tests for fetchVixHistory + vixHistory** - `be93dce` (test)
2. **Task 1 (GREEN): fetchVixHistory + vixHistory implementation** - `3319486` (feat)
3. **Task 2: collect-data.test.ts mock consistency** - `a840e58` (test)

_TDD gate compliance: RED commit (`be93dce`) precedes GREEN commit (`3319486`) in git history — verified via `git log --oneline`._

## Files Created/Modified
- `src/data/market.ts` - Added `VixHistoryPoint` interface, `fetchVixHistory()`, and extended `fetchAllMarketData()` to include `vixHistory`
- `src/data/market.test.ts` - New unit test file covering mapping, date format, and error-tolerance behavior for `fetchVixHistory()` and `fetchAllMarketData()`
- `src/scripts/collect-data.test.ts` - Added `vixHistory: []` to `mockMarketData` object literal for type/shape consistency

## Decisions Made
- Mocked `yahoo-finance2`'s default export using `vi.hoisted()` to declare `chartMock`/`quoteMock` before the hoisted `vi.mock()` factory runs, then implemented the mock as a named `function` (not an arrow function) returning `{ chart, quote }`, since `new YahooFinance()` requires a real constructor — arrow functions throw `TypeError: ... is not a constructor` when invoked with `new`.

## Deviations from Plan

None - plan executed exactly as written. The only adjustment was fixing the mock's constructor form (arrow function -> named function) during RED-phase debugging, which is implementation detail internal to Task 1's TDD cycle, not a deviation from the plan's specified behavior or files.

## Issues Encountered

During the RED phase, the first test run failed with `TypeError: () => ({...}) is not a constructor` instead of the intended `fetchVixHistory is not a function` — the initial mock factory used an arrow function, which cannot be invoked with `new`. Fixed by switching to a named `function` expression that returns the mock object explicitly (a standard JS constructor-return pattern). Re-ran to confirm the tests then failed for the correct reason (`fetchVixHistory` did not yet exist) before proceeding to GREEN.

Additionally, a full-suite run (`npx vitest run`, not part of this plan's own verification scope) surfaced one pre-existing, unrelated failure in `src/scripts/validate-meeting.test.ts` (`portfolioAnalysisSchema` decision validation). This file was not touched by either task in this plan and the failure is unrelated to VIX/market-data work; logged to `.planning/phases/14-report-ui/deferred-items.md` per the scope-boundary rule rather than fixed here.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

`tmp/market.json` will carry a `vixHistory: [{date, close}]` array once the daily pipeline runs `fetchAllMarketData()`, unblocking Plan 02/03's VIX line chart rendering work (`renderVixLineChart(vixHistory)`). No blockers for downstream plans in this phase.

---
*Phase: 14-report-ui*
*Completed: 2026-07-01*

## Self-Check: PASSED

- FOUND: src/data/market.ts
- FOUND: src/data/market.test.ts
- FOUND: src/scripts/collect-data.test.ts
- FOUND: .planning/phases/14-report-ui/14-01-SUMMARY.md
- FOUND: be93dce (test commit)
- FOUND: 3319486 (feat commit)
- FOUND: a840e58 (test commit)

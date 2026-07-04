---
phase: 26-weekly-urgency-rollup-display
plan: 02
subsystem: reporting
tags: [typescript, vitest, tdd, html-rendering, fail-soft]

# Dependency graph
requires:
  - phase: 26-weekly-urgency-rollup-display
    plan: 01
    provides: "computeWeeklyUrgencyRollup(history, anchorDate) + formatDateKeyShort(dateKey) + WeeklyUrgencyRollup/WeeklySymbolRollup/DecisionChangeEvent types, from src/portfolio/urgency-rollup.ts"
provides:
  - "formatWeeklyUrgencyRollupHtml(rollup, totalHistoryEntries): bespoke renderer for the weekly rollup section, 3-tier empty/partial fallback"
  - "generatePortfolioReportHtml 4th param urgencyHistory: UrgencyHistoryFile = {} (backward compatible)"
  - "weeklyRollupHtml rendered in BOTH null-portfolioAnalysis and non-null branches (fail-soft, D-14)"
affects: [generate-report.ts, report-data-loaders.ts]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Compute view-model HTML (weeklyRollupHtml) before a branch-determining null check so it can be shared across both branches — same technique could be reused for future fail-soft sections"
    - "3-tier empty/partial fallback ladder (0 history / 0 movement / <7 days) implemented as sequential early-returns inside a single renderer, matching the locked UI-SPEC decision tree verbatim"

key-files:
  created: []
  modified:
    - src/scripts/generate-portfolio-report.ts
    - src/scripts/generate-report.test.ts

key-decisions:
  - "weeklyRollupHtml is computed unconditionally at the top of generatePortfolioReportHtml (before the portfolioAnalysis === null check), since its only dependencies are urgencyHistory + result.date — both available regardless of portfolioAnalysis outcome"
  - "formatDateKeyShort (imported from urgency-rollup.ts, Plan 01) used for all date display; formatPublishedAtJst is NOT used anywhere in the new renderer (existing pre-Phase-26 usage in formatHoldingNewsItemHtml is untouched, unrelated code)"
  - "escapeHtml applied to symbol, nameJa, and decision from/to strings in the per-symbol card; MM/DD date strings are not escaped (pure string-slice output, no HTML-significant characters possible)"

patterns-established:
  - "New format*Html renderer functions in generate-portfolio-report.ts stay bespoke per section (no shared card-builder abstraction) — consistent with existing formatUrgentBadgeHtml/formatDecisionChangedBadgeHtml/formatHoldingEvaluationsHtml style"

requirements-completed: [HIST-03]

# Metrics
duration: 5min
completed: 2026-07-04
---

# Phase 26 Plan 02: Weekly Urgency Rollup Display Summary

**Rendered the weekly urgency rollup section into portfolio-report.html via a new bespoke `formatWeeklyUrgencyRollupHtml` renderer, wired through a backward-compatible 4th parameter, and made it appear in both the null- and non-null-`portfolioAnalysis` branches per the fail-soft design (D-14).**

## Performance

- **Duration:** 5 min (commit-to-commit)
- **Started:** 2026-07-04T07:40:39Z (base commit)
- **Completed:** 2026-07-04T07:44:53Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Added a new `describe("Weekly urgency rollup (HIST-03)")` block to `generate-report.test.ts` with 9 tests covering: 2-arg/3-arg backward compat, Tier 1 empty-history state, Tier 2 zero-movement state, Tier 3 partial footnote (both `<7` days-with-correct-N and `===7`-days-no-footnote cases), per-symbol card rendering (urgent-flag line + decision-change line + exact colors), `<script>` escaping, `portfolioAnalysis === null` fail-soft rendering, and section ordering (rollup after 総括コメント, before 保有銘柄 個別評価).
- Confirmed RED before implementation (7/9 new tests failed as expected; 2 trivially passed on `not.toContain` assertions since nothing rendered yet — consistent with pre-implementation state).
- Implemented `formatWeeklyUrgencyRollupHtml(rollup, totalHistoryEntries)` in `generate-portfolio-report.ts`, following the locked UI-SPEC decision tree exactly: always emits the `<h2>今週の緊急・判断変更ロールアップ</h2>` heading; Tier 1 (`totalHistoryEntries === 0`) renders the locked history-empty message; Tier 2 (`rollup.symbols.length === 0`) renders the locked zero-movement message plus the `<7`-day footnote if applicable; otherwise renders one `.agent-card` per symbol (urgent-flag `<p>` only if `urgentDates.length > 0`, one decision-change `<p>` per event) plus a trailing footnote `<p>` if `daysCovered < 7`.
- Added the 4th parameter `urgencyHistory: UrgencyHistoryFile = {}` to `generatePortfolioReportHtml`, mirroring the existing 3rd-parameter backward-compat convention (Test 38 pattern).
- Computed `weeklyRollupHtml` unconditionally before the `portfolioAnalysis === null` check and interpolated it into both the null-branch minimal template and the non-null full template (between `overallCommentHtml` and `holdingEvaluationsHtml`, per D-08 placement), satisfying the RESEARCH.md Pitfall 4 fail-soft recommendation.
- Confirmed GREEN: all 61 tests in `generate-report.test.ts` pass; full project suite (363 tests / 21 files) green; `tsc --noEmit` reports zero errors in the two files touched by this plan.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add failing tests for the rollup section + 4th-arg backward compat (RED)** - `8810afa` (test)
2. **Task 2: Implement formatWeeklyUrgencyRollupHtml + 4th param + both-branch insertion (GREEN)** - `1830353` (feat)

_Note: This plan's tasks are individually `tdd="false"` (`type="auto"`) rather than a `type: tdd` plan, but Task 1/Task 2 were executed as a manual RED/GREEN pair per the plan's explicit `<action>`/`<verify>` structure — RED confirmed via `-t "rollup"` filter before GREEN implementation._

## Files Created/Modified

- `src/scripts/generate-portfolio-report.ts` - Added `formatWeeklyUrgencyRollupHtml` (new bespoke renderer), imports of `computeWeeklyUrgencyRollup`/`formatDateKeyShort` (from `../portfolio/urgency-rollup.js`) and `UrgencyHistoryFile` type (from `../portfolio/urgency-history.js`), 4th param `urgencyHistory: UrgencyHistoryFile = {}` on `generatePortfolioReportHtml`, and `weeklyRollupHtml` computed before the null-check and interpolated into both templates.
- `src/scripts/generate-report.test.ts` - New `describe("Weekly urgency rollup (HIST-03)")` block (9 tests) plus 3 fixture constants (`historyWithMovement`, `historyFullWeekMovement`, `historyZeroMovement`) anchored on `validMeetingResult.date` ("2026-06-24", window `[2026-06-18, 2026-06-24]`).

## Decisions Made

- Kept `formatWeeklyUrgencyRollupHtml` as a bespoke, unexported local function (like every other `format*Html` helper in this file) rather than extracting a shared card-builder — consistent with the file's existing style and the plan's explicit instruction not to reuse `formatUrgentBadgeHtml`/`formatDecisionChangedBadgeHtml`.
- Did not re-sort `rollup.symbols` in the renderer (already ascending `localeCompare` order from Plan 01's `computeWeeklyUrgencyRollup`), per plan instruction.

## Deviations from Plan

### Acceptance-criterion note (no code change required)

**1. [Documentation-only] `grep -c "formatPublishedAtJst" src/scripts/generate-portfolio-report.ts` returns 1, not 0**

- **Found during:** Task 2 acceptance-criteria verification
- **Detail:** The plan's acceptance criteria state this grep should return 0. In practice `formatPublishedAtJst` still appears twice in the file: once in the pre-existing (pre-Phase-26) `import` statement at the top (used by the unrelated `formatHoldingNewsItemHtml` function for holding-news timestamps, lines 1 and 36) and once in this plan's new Japanese doc-comment explaining *why* the rollup renderer does not use it. The new `formatWeeklyUrgencyRollupHtml` function itself contains zero calls to `formatPublishedAtJst` and uses `formatDateKeyShort` exclusively for all date display, which is the actual intent behind the acceptance criterion.
- **Why no fix was applied:** Removing or renaming the pre-existing `formatPublishedAtJst` import/usage in `formatHoldingNewsItemHtml` would be out of scope for this plan (unrelated holding-news feature, exercised by Tests 34/35/36) and would violate the Scope Boundary rule (only auto-fix issues directly caused by this plan's changes). The literal grep-count-0 criterion appears to have assumed no pre-existing usage existed in the file, which is incorrect per the live source (confirmed at plan-read time, `generate-portfolio-report.ts` L1/L33).
- **Verification:** `grep -c "今週の緊急・判断変更ロールアップ" src/scripts/generate-portfolio-report.ts` = 1 (satisfied); the new renderer's own source contains no `formatPublishedAtJst` reference; all `generate-report.test.ts` date-format assertions for both the rollup (`MM/DD`) and holding-news (`M/D HH:MM`) sections pass unchanged.
- **Impact on plan:** None — the functional intent (rollup dates use `formatDateKeyShort`, not `formatPublishedAtJst`) is fully met; only the literal grep-count-0 phrasing of the acceptance criterion could not be satisfied without breaking unrelated, already-shipped functionality.

**Total deviations:** 1 (documentation-only note, no code change, no scope creep).

## Issues Encountered

None beyond the acceptance-criterion phrasing note documented above.

## User Setup Required

None — no external service configuration required. Zero new dependencies, zero new I/O in this plan (the loader wiring into `generate-report.ts`/`report-data-loaders.ts` mentioned in RESEARCH.md's architecture diagram is out of scope for this plan and belongs to a subsequent plan/wave).

## Next Phase Readiness

- `formatWeeklyUrgencyRollupHtml` and the 4th `urgencyHistory` parameter are fully implemented, tested, and backward compatible.
- The section renders correctly in both the non-null and `portfolioAnalysis === null` branches, closing RESEARCH.md's Pitfall 4 / Open Question 1.
- Remaining phase work (per 26-RESEARCH.md's architecture diagram): a `loadUrgencyHistory()` fail-soft loader in `report-data-loaders.ts` and wiring it into `generate-report.ts`'s `Promise.all` loader batch + `generatePortfolioReportHtml` call site — not part of this plan's scope, needed before the rollup receives real `data/urgency-history.json` content in production.

---
*Phase: 26-weekly-urgency-rollup-display*
*Completed: 2026-07-04*

## Self-Check: PASSED

- FOUND: src/scripts/generate-portfolio-report.ts
- FOUND: src/scripts/generate-report.test.ts
- FOUND: .planning/phases/26-weekly-urgency-rollup-display/26-02-SUMMARY.md
- FOUND commit: 8810afa (test - RED)
- FOUND commit: 1830353 (feat - GREEN)
- FOUND commit: dd37d58 (docs - SUMMARY)

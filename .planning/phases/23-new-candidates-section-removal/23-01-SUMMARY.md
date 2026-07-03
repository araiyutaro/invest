---
phase: 23-new-candidates-section-removal
plan: 01
subsystem: ui
tags: [vitest, tdd, html-rendering, portfolio-report]

# Dependency graph
requires:
  - phase: 19-data-foundation-holding-news-supply
    provides: highlightedStocks/PORT-01 data still flows to portfolio-analyst prompt (untouched by this removal)
provides:
  - Portfolio Report renderer with the duplicate "新規組入候補" (new-candidates) section fully removed
  - Inverted regression tests (Test 30/31) proving the section's structural absence on both the normal and fallback HTML paths
affects: [report-ui, portfolio-report]

# Tech tracking
tech-stack:
  added: []
  patterns: [TDD RED->GREEN via test inversion (existence assertion -> not.toContain assertion) for a deletion-only task]

key-files:
  created: []
  modified:
    - src/scripts/generate-report.test.ts
    - src/scripts/generate-portfolio-report.ts

key-decisions:
  - "Inverted Test 30 rather than deleting it, to keep discriminating power against future regressions (a non-empty highlightedStocks fixture is required so the assertion isn't a false-pass against an empty-array early return)"
  - "Removed scoreColor/verdictColor from the generate-portfolio-report.ts import only; left their definitions in report-utils.ts untouched since generate-daily-report.ts still consumes them"

patterns-established:
  - "Deletion-only UI change verified via git diff --stat emptiness checks on adjacent untouched files (invest.md, types.ts, schemas.ts, report-utils.ts) as a structural regression guard"

requirements-completed: [UI-08]

# Metrics
duration: 6min
completed: 2026-07-04
---

# Phase 23 Plan 01: New-Candidates Section Removal Summary

**Deleted `formatNewCandidatesHtml` and both of its call sites from `generate-portfolio-report.ts`, with Test 30/31 inverted to assert structural absence of the "新規組入候補" section on both the normal and fallback (portfolioAnalysis === null) rendering paths.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-07-03T23:56:00Z (approx)
- **Completed:** 2026-07-04T08:56:41+09:00
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Portfolio Report HTML no longer renders the "新規組入候補（Daily Report より転載）" section on either the normal or fallback path, ending duplication with Daily Report's scoring matrix.
- Confirmed via TDD: Test 30 was RED against the un-removed renderer (proving it discriminates), then GREEN after the function/call-sites were deleted.
- `highlightedStocks` passthrough into the portfolio-analyst prompt (invest.md Step 3d) remains structurally verified as unchanged (regression guard).

## Task Commits

Each task was committed atomically:

1. **Task 1: Invert Test 30 to non-existence and add fallback-path assertion to Test 31 (RED)** - `261b1c1` (test)
2. **Task 2: Remove formatNewCandidatesHtml renderer and call sites (GREEN)** - `c9974a3` (feat)

_Note: This plan followed an explicit test-then-implementation TDD structure (RED in Task 1, GREEN in Task 2) per the plan's `tdd="true"` Task 1._

## Files Created/Modified
- `src/scripts/generate-report.test.ts` - Test 30 inverted to `not.toContain("新規組入候補")` + `not.toContain("Daily Reportのアナリストミーティングで推奨された銘柄です")` (normal path); Test 31 gained a `not.toContain("新規組入候補")` assertion (fallback path)
- `src/scripts/generate-portfolio-report.ts` - Deleted `formatNewCandidatesHtml` function body, its call (`newCandidatesHtml` const), both `${newCandidatesHtml}` embeds (fallback + normal branch), and removed unused `scoreColor`/`verdictColor` from the report-utils import

## Decisions Made
- Kept `validMeetingResult`'s non-empty `highlightedStocks` fixture (PLTR / 8.2 / 強気) as the Test 30/31 input rather than substituting an empty array, per the plan's D-05 Pitfall-1 guidance — an empty-array fixture would make the un-removed code's early-return path a false discriminator.
- Left `report-utils.ts`'s `scoreColor`/`verdictColor` function bodies untouched since `generate-daily-report.ts` still uses them; only removed them from this file's import list.

## Deviations from Plan

None - plan executed exactly as written. All acceptance criteria (grep counts, import line, git diff emptiness on invest.md/types.ts/schemas.ts/report-utils.ts) verified as specified in the plan.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- UI-08 is the final Active requirement for the v2.5 milestone (per PROJECT.md); phase 23 was planned as the last phase.
- All 286 tests in the full `npm run test` suite pass, including Test 4 (Daily Report highlightedStocks display, unaffected per D-07) and the regression-guard checks for invest.md/types.ts/schemas.ts/report-utils.ts (all `git diff --stat` empty).
- Pre-existing `tsc --noEmit` errors in `src/scripts/collect-data.test.ts` (implicit `any` on `call`/`msg` params, lines 297/299/358/360) are unrelated to this plan's files and were not introduced or touched by this change (out of scope, logged here for visibility rather than fixed).

---
*Phase: 23-new-candidates-section-removal*
*Completed: 2026-07-04*

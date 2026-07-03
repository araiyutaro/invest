---
phase: 22-portfolio-analyst-re-evaluation
plan: 04
subsystem: reporting

tags: [zod, portfolio-report, decision-diff, fail-soft-loader, html-badge]

# Dependency graph
requires:
  - phase: 22-01
    provides: "HoldingEvaluation.urgent (required boolean) + optional previousDecision/decisionChanged, alias-transform hardening in holdingEvaluationSchema"
  - phase: 22-03
    provides: "attachDecisionChanges pure function in src/portfolio/decision-diff.ts"
provides:
  - "loadPrevPortfolioAnalysis() fail-soft loader reading tmp/prev-portfolio-analysis.json (console.warn severity, D-15)"
  - "generate-report.ts main() wiring: prev snapshot parallel-loaded, enrichedPortfolioAnalysis assembled via attachDecisionChanges and passed to renderer"
  - "Pitfall 7 debt payoff: loadWebSearchResults/loadReevalResults per-file inner catches now console.warn instead of silently swallowing"
  - "formatUrgentBadgeHtml / formatDecisionChangedBadgeHtml pure renderer helpers with strict === true / !== true gating"
affects: [23-new-candidates-section-removal, invest.md-step-3d-prompt-wiring]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fail-soft loader severity distinction: console.error for hard-required data (loadPortfolioAnalysis), console.warn for expected-missing edge data (loadPrevPortfolioAnalysis) — same try/catch/return-null shape"
    - "Pill badge convention extended: two new inline-block pills (red urgent, amber decision-changed) following the 社名一致 badge precedent in generate-portfolio-report.ts"
    - "Strict boolean gating for TS-computed optional fields: `if (x !== true) return \"\"` instead of `if (!x)` to distinguish undefined (incomparable) from false (compared, unchanged)"

key-files:
  created: []
  modified:
    - src/scripts/report-data-loaders.ts
    - src/scripts/report-data-loaders.test.ts
    - src/scripts/generate-report.ts
    - src/scripts/generate-report.test.ts
    - src/scripts/generate-portfolio-report.ts

key-decisions:
  - "loadPrevPortfolioAnalysis reuses portfolioAnalysisSchema (no new schema) since prev snapshot has identical shape to today's analysis"
  - "console.warn (not console.error) for missing/malformed prev-portfolio-analysis.json — distinguishes expected first-run/edge condition from hard failure (D-15)"
  - "Badge insertion point in <h4> is symbol/nameJa first, then urgent badge, then decisionChanged badge, before the float:right decision span — matches D-16/D-17 ordering"
  - "border-left-color computation untouched by badge logic — decisionColor(h.decision) remains the single source for the card's left border (D-18)"

patterns-established:
  - "TDD RED/GREEN per task within a single execute plan: 3 test-then-feat commit pairs (6 total task commits)"

requirements-completed: [PORT-05, UI-07]

# Metrics
duration: 17min
completed: 2026-07-03
---

# Phase 22 Plan 04: Report Wiring + Urgency/Change Badges Summary

**Wired `attachDecisionChanges` into `generate-report.ts` main() via a new `loadPrevPortfolioAnalysis` fail-soft loader, and added red "⚠ 緊急" / amber "判断変更: X → Y" pill badges to portfolio holding cards, closing out PORT-05 and UI-07.**

## Performance

- **Duration:** ~17 min
- **Started:** 2026-07-03T11:42:19Z (approx, per STATE.md session marker)
- **Completed:** 2026-07-03T11:58:44Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- New `loadPrevPortfolioAnalysis()` loader in `report-data-loaders.ts` reads `tmp/prev-portfolio-analysis.json`, fail-soft (null + `console.warn`, severity distinct from the hard-required `loadPortfolioAnalysis`'s `console.error`)
- `generate-report.ts` `main()` now parallel-loads the prev snapshot (10-item `Promise.all`) and assembles `enrichedPortfolioAnalysis` via `attachDecisionChanges(portfolioAnalysis.holdings, prevPortfolioAnalysis?.holdings ?? null)` before rendering — the PORT-05 convergence point
- Pitfall 7 debt paid off: `loadWebSearchResults`/`loadReevalResults` per-file inner `catch` blocks now `console.warn` the failing filename instead of silently swallowing
- `generate-portfolio-report.ts` gained `formatUrgentBadgeHtml` (red `⚠ 緊急` pill) and `formatDecisionChangedBadgeHtml` (amber `判断変更: {前日} → {当日}` pill, strict `!== true` gate distinguishing undefined from false per D-14)
- `border-left-color` on holding cards remains driven solely by `decisionColor(h.decision)` — unaffected by badge presence (D-18)
- Resolved the deferred `urgent: false` fixture gap tracked since 22-03: `npx tsc --noEmit` is now clean for `src/scripts/generate-report.test.ts`

## Task Commits

Each task followed TDD RED → GREEN:

1. **Task 1: loadPrevPortfolioAnalysis loader**
   - `ea84a82` test(22-04): add failing test for loadPrevPortfolioAnalysis (D-15)
   - `0501db0` feat(22-04): add loadPrevPortfolioAnalysis loader (D-15)
2. **Task 2: generate-report.ts wiring + Pitfall 7 backfill + Test 39 extension**
   - `0cd19ae` test(22-04): add failing tests for prev-portfolio wiring + Pitfall 7 backfill
   - `089d0e1` feat(22-04): wire prev-portfolio-analysis loading + attachDecisionChanges
3. **Task 3: urgent/decisionChanged badges**
   - `c34ac7e` test(22-04): add failing tests for urgent/decisionChanged badges (D-16/D-17)
   - `cf6e10f` feat(22-04): add urgent + decisionChanged badges to holding cards (D-16/D-17/UI-07)

**Plan metadata:** committed with this SUMMARY (see final commit)

_Note: All three tasks used the RED (failing test) → GREEN (implementation) cycle per `tdd="true"` frontmatter._

## Files Created/Modified
- `src/scripts/report-data-loaders.ts` - Added `loadPrevPortfolioAnalysis()` sibling to `loadPortfolioAnalysis`, reusing `portfolioAnalysisSchema`
- `src/scripts/report-data-loaders.test.ts` - Added `describe("loadPrevPortfolioAnalysis", ...)` with 3 cases (success, ENOENT, parse-failure)
- `src/scripts/generate-report.ts` - 10-item `Promise.all` (added `loadPrevPortfolioAnalysis()`), `enrichedPortfolioAnalysis` assembly via `attachDecisionChanges`, `console.warn` backfill in `loadWebSearchResults`/`loadReevalResults` inner catches
- `src/scripts/generate-report.test.ts` - Extended Test 39 (prev-portfolio-analysis.json call assertion), added Tests 44-45 (Pitfall 7 warn coverage) and Tests 40-43 (badge behavior), added `urgent: false` to `validPortfolioAnalysis` fixture holdings
- `src/scripts/generate-portfolio-report.ts` - Added `formatUrgentBadgeHtml`/`formatDecisionChangedBadgeHtml` pure functions, wired into `formatHoldingEvaluationsHtml`'s `<h4>` output

## Decisions Made
- Reused `portfolioAnalysisSchema` for the prev-snapshot loader rather than introducing a parallel schema — the prev snapshot has identical shape to today's `portfolio-analysis.json`.
- Kept `console.warn` vs `console.error` as the sole severity signal distinguishing "expected missing" (prev snapshot, first-run/skip-day) from "hard failure" (today's required analysis) loaders, matching D-15's intent without adding new abstractions.
- Test 46 (originally drafted to assert badge text end-to-end through `main()`) was dropped in favor of task-scoped Tests 40-43 operating directly on `generatePortfolioReportHtml` — keeps each task's TDD RED/GREEN cycle scoped to its own behavior rather than spanning Task 2 and Task 3 concerns.

## Deviations from Plan

None — plan executed exactly as written. The `urgent: false` fixture fix mentioned as a known follow-up in the plan's `<additional_context>` was already anticipated by Task 3's action block ("validPortfolioAnalysis fixture の各 holding に urgent: false を追加"), so it was resolved as planned work, not an unplanned deviation.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- PORT-05 (TS-side decision diff wired into the report pipeline) and UI-07 (urgent/change badges) are both complete and test-covered.
- `.claude/commands/invest.md` Step 3d prompt wiring (writing `tmp/prev-portfolio-analysis.json` from the prior day's `portfolio-analysis.json`, D-12) is owned by 22-02 (per `22-PATTERNS.md`'s file classification), not this plan — verify at phase close that 22-02's prompt changes actually produce `tmp/prev-portfolio-analysis.json` in the shape `loadPrevPortfolioAnalysis()` expects, since without that file the loader fail-softs to `null` and no badges render (no crash, but silent no-op).
- Full suite: 273/273 tests green (was 264/264 at wave start, +9 new tests across the 3 tasks).
- `npx tsc --noEmit` clean for all files touched by this plan; only pre-existing unrelated `TS7006` errors in `src/scripts/collect-data.test.ts` remain (out of scope, tracked in `deferred-items.md`).

---
*Phase: 22-portfolio-analyst-re-evaluation*
*Completed: 2026-07-03*

## Self-Check: PASSED

All 5 modified source files and the SUMMARY.md itself verified present on disk. All 6 task commits (ea84a82, 0501db0, 0cd19ae, 089d0e1, c34ac7e, cf6e10f) verified present in git log.

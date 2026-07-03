---
phase: 22-portfolio-analyst-re-evaluation
plan: 03
subsystem: portfolio-analysis
tags: [typescript, vitest, tdd, pure-function, decision-diff]

# Dependency graph
requires:
  - phase: 22-01
    provides: HoldingEvaluation with urgent (required) + previousDecision?/decisionChanged? (optional) fields, holdingEvaluationSchema strip-by-omission for LLM-provided decisionChanged/previousDecision
provides:
  - src/portfolio/decision-diff.ts exporting attachDecisionChanges(holdings, prevHoldings) — deterministic decision-change detection, no LLM self-report
affects: [22-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Primary-loop / secondary-lookup pure function shape (mirrors resolvePortfolioHoldingNews): iterate the caller-owned primary collection, build a Map from the secondary collection for O(1) lookup, never loop the secondary first"
    - "undefined vs false distinction for 'could not compare' vs 'compared, no change' (D-14) — enforced by omitting the key entirely rather than setting it to undefined"

key-files:
  created:
    - src/portfolio/decision-diff.ts
    - src/portfolio/decision-diff.test.ts
  modified: []

key-decisions:
  - "No separate DecisionDiffResult interface — HoldingEvaluation already carries optional previousDecision/decisionChanged from 22-01, so attachDecisionChanges returns ReadonlyArray<HoldingEvaluation> directly, per PATTERNS.md guidance"
  - "REFACTOR step skipped — implementation was already minimal (single Map construction, no duplication) after GREEN, matching the pattern map exactly"

patterns-established:
  - "attachDecisionChanges as the canonical TS-computed (never-LLM-self-reported) diff pattern for PORT-05, ready for 22-04 to wire into generate-report.ts alongside loadPrevPortfolioAnalysis"

requirements-completed: [PORT-05]

# Metrics
duration: 2min
completed: 2026-07-03
---

# Phase 22 Plan 03: Deterministic Decision-Diff Detection Summary

**Pure function `attachDecisionChanges` in `src/portfolio/decision-diff.ts` computes `decisionChanged` from strict decision-enum inequality against a prior-day snapshot, never trusting LLM self-reported change flags.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-07-03T20:50:58+09:00
- **Completed:** 2026-07-03T20:52:00+09:00
- **Tasks:** 1 (TDD feature: RED + GREEN)
- **Files modified:** 2 (both new)

## Accomplishments
- `attachDecisionChanges(holdings, prevHoldings)` implemented as a pure, throw-free, I/O-free function
- Today's holdings always drive the loop (matches `resolvePortfolioHoldingNews`'s fail-soft structural precedent) — no today's-holding is ever dropped even when the holdings list changed since yesterday
- `previousDecision`/`decisionChanged` are omitted entirely (not `undefined`-valued) when `prevHoldings === null` or the symbol has no prior-day match, correctly distinguishing "couldn't compare" from "compared, no change" (D-14)
- Symbol matching reuses `normalizeHoldingSymbol` from `holding-news.ts` (imported, not reimplemented) — tolerant of whitespace/case mismatches between snapshots
- 6 unit tests covering all required cases from the plan's `<behavior>` block, all green

## Task Commits

Each task was committed atomically following the RED -> GREEN TDD gate sequence:

1. **RED: failing test for attachDecisionChanges** - `b4b9446` (test)
2. **GREEN: implement attachDecisionChanges deterministic diff** - `bc3e076` (feat)

_REFACTOR skipped: the GREEN implementation already matched the pattern map's confirmed shape with no duplication to extract._

## Files Created/Modified
- `src/portfolio/decision-diff.ts` - `attachDecisionChanges` pure function; imports `normalizeHoldingSymbol` from `./holding-news.js` and `HoldingEvaluation` type from `../meeting/types.js`
- `src/portfolio/decision-diff.test.ts` - 6 unit tests (prev-null, same-decision, different-decision, symbol-not-in-prev/D-14, normalizeHoldingSymbol case/whitespace tolerance, today's-holdings-always-in-output)

## Decisions Made
- No separate `DecisionDiffResult` export — `HoldingEvaluation` already carries the optional fields from 22-01, so the return type is `ReadonlyArray<HoldingEvaluation>` (simpler, matches PATTERNS.md's explicit note that a wrapper interface would be redundant)
- Followed the `resolvePortfolioHoldingNews` structural precedent exactly: primary/today's collection drives `.map()`, secondary/prev collection is pre-indexed once into a `Map` for O(1) lookup

## Deviations from Plan

None — plan executed exactly as written. All 6 required behavior cases from the `<behavior>` block were implemented in RED and passed in GREEN on the first implementation attempt.

## Issues Encountered

**Pre-existing out-of-scope tsc errors (not fixed, logged to deferred-items.md):** A full-project `npx tsc --noEmit` run surfaced 9 pre-existing `TS2345` errors in `src/scripts/generate-report.test.ts` — its `validPortfolioAnalysis` fixture is missing the now-required `urgent: boolean` field on `HoldingEvaluation` (introduced by 22-01, which merged into this worktree's base commit before this plan started). This file is not in 22-03's `files_modified` scope and is explicitly owned by 22-04-PLAN.md's Task 4 ("`urgent: false` を追加して 22-01 の必須 urgent 型と整合させる"). Per the scope-boundary rule, this was logged to `.planning/phases/22-portfolio-analyst-re-evaluation/deferred-items.md` rather than fixed here. `src/portfolio/decision-diff.ts`/`.test.ts` themselves type-check cleanly and all tests in `src/portfolio/` (33 total, including the 27 pre-existing `holding-news.test.ts` tests) pass.

## Next Phase Readiness
- `attachDecisionChanges` is ready to be imported and wired into `src/scripts/generate-report.ts` by 22-04, alongside `loadPrevPortfolioAnalysis` (22-02) and the `urgent`/`decisionChanged` HTML badges (22-04's own badge task)
- 22-04 must also apply the `urgent: false` fixture fix in `generate-report.test.ts` noted above before that file's test suite will pass `npx tsc --noEmit`

---
*Phase: 22-portfolio-analyst-re-evaluation*
*Completed: 2026-07-03*

## Self-Check: PASSED

- FOUND: src/portfolio/decision-diff.ts
- FOUND: src/portfolio/decision-diff.test.ts
- FOUND: .planning/phases/22-portfolio-analyst-re-evaluation/22-03-SUMMARY.md
- FOUND commit: b4b9446 (test)
- FOUND commit: bc3e076 (feat)

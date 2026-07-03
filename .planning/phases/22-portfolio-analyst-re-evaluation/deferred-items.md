# Deferred Items — Phase 22

## Out-of-scope tsc errors observed during 22-03 execution

**Found during:** 22-03 (`npx tsc --noEmit` full-project check after implementing `decision-diff.ts`)

**Issue:** `src/scripts/generate-report.test.ts` has 9 pre-existing `TS2345` errors — the `validPortfolioAnalysis` fixture's `holdings` entries are missing the now-required `urgent: boolean` field on `HoldingEvaluation`. This type requirement was introduced by wave 1 (22-01, merged into this worktree's base commit `1310dde`), not by 22-03.

**Scope boundary:** `src/scripts/generate-report.test.ts` is explicitly owned by 22-04-PLAN.md (Task 4: "validPortfolioAnalysis fixture の各 holding に `urgent: false` を追加して 22-01 の必須 urgent 型と整合させる"). 22-03's `files_modified` is limited to `src/portfolio/decision-diff.ts` and `src/portfolio/decision-diff.test.ts`, which do not touch this file. Not fixed here per scope-boundary rule (only auto-fix issues directly caused by the current task's changes).

**Action:** No action needed from 22-03. Verify resolved when 22-04 executes.

**Resolved:** 22-04 Task 3 added `urgent: false` to each `validPortfolioAnalysis.holdings` entry in `src/scripts/generate-report.test.ts` (the same task that adds the urgent-badge tests). `npx tsc --noEmit` is now clean for `src/scripts/generate-report.test.ts` (verified 2026-07-03). The remaining `TS7006` errors in `src/scripts/collect-data.test.ts` are unrelated pre-existing issues outside 22-04's `files_modified` scope — not fixed here.

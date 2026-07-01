# Deferred Items — Phase 14 (report-ui)

Out-of-scope discoveries logged during plan execution (not fixed, per Scope Boundary rule).

## Resolved: `src/scripts/validate-meeting.test.ts` pre-existing failure

- **Test:** `portfolioAnalysisSchema > decision must be one of 保持/買増/一部売却/全売却`
- **Symptom:** `portfolioAnalysisSchema.parse()` accepted invalid `decision` values (e.g.
  `"ホールド"`) instead of throwing, because `rawHoldingSchema` typed `decision`/`action` as
  free-form `z.string()` and cast the result with `as` instead of validating.
- **Origin:** Pre-existing on `main` before Phase 14 (Phase 07, commit `17f2158`).
  Independently observed by Plan 14-01, Plan 14-02, Plan 14-04, Plan 14-05 (all 2026-07-01)
  as out of scope for their individual plans.
- **Fix:** Constrained `decision`/`action` in `src/meeting/schemas.ts` to
  `z.enum(["保持", "買増", "一部売却", "全売却"])`, removing the unchecked `as` cast. Fixed
  during the Phase 14 post-merge test gate at the orchestrator's request (blocking wave 2).

## Deferred: pre-existing `tsc --noEmit` errors unrelated to Plan 14-03

- **Files:** `src/data/news/finnhub.ts:43` (callback param type mismatch), `src/scripts/collect-data.test.ts:297,299,334,336` (implicit `any` params).
- **Observed during:** Plan 14-03 verification (`npx tsc --noEmit` run after Task 1/2).
- **Status:** Out of scope — neither file is touched by Plan 14-03 (`generate-daily-report.ts`,
  `generate-report.ts`, `generate-report.test.ts`). Not fixed per Scope Boundary rule.

# Deferred Items — Phase 14 (report-ui)

Out-of-scope discoveries found during plan execution. Not fixed per scope boundary rule.

## From Plan 14-01

- **File:** `src/scripts/validate-meeting.test.ts`
- **Test:** `portfolioAnalysisSchema > decision must be one of 保持/買増/一部売却/全売却`
- **Issue:** `expect(() => portfolioAnalysisSchema.parse(invalid)).toThrow()` fails — the schema
  does not reject the invalid decision value `"ホールド"` as expected.
- **Status:** Pre-existing failure, unrelated to VIX history / market.ts changes in this plan.
  Not touched by Task 1 or Task 2 of 14-01.
- **Deferred at:** 2026-07-01 (Plan 14-01 execution)

# Deferred Items — Phase 14 (report-ui)

Out-of-scope discoveries logged during plan execution (not fixed, per Scope Boundary rule).

## Pre-existing failing test: `src/scripts/validate-meeting.test.ts`

- **Test:** `portfolioAnalysisSchema > decision must be one of 保持/買増/一部売却/全売却`
- **Symptom:** `expect(() => portfolioAnalysisSchema.parse(invalid)).toThrow()` does not throw
  for the invalid decision value `"ホールド"` as expected
  (`expected [Function] to throw an error`).
- **Scope decision:** Pre-existing failure on `main`/current HEAD, unrelated to any Phase 14
  changes. File was last modified in an unrelated Phase 07 commit (`17f2158`); confirmed
  pre-existing via `git log --oneline -1 -- src/scripts/validate-meeting.test.ts`. Out of scope
  for Phase 14 — not fixed.
- **Action needed:** Investigate `portfolioAnalysisSchema` enum validation in a future
  phase/plan touching `src/scripts/validate-meeting.ts`.
- **Independently observed by:** Plan 14-01, Plan 14-02, Plan 14-05 (all 2026-07-01).

# Deferred Items — Phase 14 (report-ui)

Out-of-scope discoveries logged during plan execution (not fixed, per Scope Boundary rule).

## Pre-existing failing test: `src/scripts/validate-meeting.test.ts`

- **Test:** `portfolioAnalysisSchema > decision must be one of 保持/買増/一部売却/全売却`
- **Issue:** `expect(() => portfolioAnalysisSchema.parse(invalid)).toThrow()` fails — the schema
  does not reject the invalid decision value `"ホールド"` as expected
  (`expected [Function] to throw an error`).
- **Status:** Pre-existing failure on `main`/current HEAD, unrelated to any Phase 14 changes.
  File was last modified in an unrelated Phase 07 commit (`17f2158`); confirmed pre-existing via
  `git log --oneline -1 -- src/scripts/validate-meeting.test.ts`. Out of scope for Phase 14 —
  not fixed.
- **Independently observed by:** Plan 14-01 (2026-07-01), Plan 14-02 (2026-07-01).

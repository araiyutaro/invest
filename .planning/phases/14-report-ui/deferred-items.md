# Deferred Items — Phase 14 Report UI

Out-of-scope discoveries logged during plan execution (not fixed, per Scope Boundary rule).

## From Plan 14-02

- **Pre-existing failing test:** `src/scripts/validate-meeting.test.ts` >
  `portfolioAnalysisSchema` > `decision must be one of 保持/買増/一部売却/全売却` fails on
  `main`/current HEAD (`expected [Function] to throw an error`). File was last modified in an
  unrelated Phase 07 commit (`17f2158`) and is untouched by Plan 14-02's changes
  (`src/scripts/report-charts.ts` / `report-charts.test.ts`). Confirmed pre-existing via
  `git log --oneline -1 -- src/scripts/validate-meeting.test.ts`. Out of scope for this plan —
  not fixed.

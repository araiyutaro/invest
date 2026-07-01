# Deferred Items — Phase 14 (report-ui)

## Pre-existing test failure (out of scope for 14-05)

- **File:** `src/scripts/validate-meeting.test.ts`
- **Test:** `portfolioAnalysisSchema > decision must be one of 保持/買増/一部売却/全売却`
- **Symptom:** `expect(() => portfolioAnalysisSchema.parse(invalid)).toThrow()` does not throw for `decision: "ホールド"`.
- **Found during:** Plan 14-05, Task 1 full-suite verification (`npx vitest run`).
- **Scope decision:** Not caused by 14-05 changes (report-utils.ts / responsive CSS). File last modified in Phase 07 (commit `17f2158`), unrelated domain (portfolio decision schema validation vs. report styling). Left unfixed per executor scope-boundary rule.
- **Action needed:** Investigate `portfolioAnalysisSchema` enum validation in a future phase/plan touching `src/scripts/validate-meeting.ts`.

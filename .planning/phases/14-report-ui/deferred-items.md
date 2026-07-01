# Deferred Items — Phase 14 (report-ui)

## Pre-existing test failure (out of scope for 14-04)

- **File:** `src/scripts/validate-meeting.test.ts`
- **Test:** `portfolioAnalysisSchema > decision must be one of 保持/買増/一部売却/全売却`
- **Symptom:** `expect(() => portfolioAnalysisSchema.parse(invalid)).toThrow()` does not throw for `decision: "ホールド"`.
- **Found during:** Plan 14-04 full-suite run (`npx vitest run`), unrelated to `update-index.ts` changes.
- **Status:** Not fixed — outside the scope boundary of plan 14-04 (no files in `src/scripts/validate-meeting.ts` or its test were touched by this plan). Confirmed pre-existing via `git status --short` showing no local changes to that file.

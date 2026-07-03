# Deferred Items — Phase 20

Items discovered during execution that are out of scope for the current plan(s).

## Pre-existing tsc errors (out of scope)

- **File:** `src/scripts/collect-data.test.ts`
- **Lines:** 297, 299, 358, 360
- **Error:** `TS7006: Parameter 'call'/'msg' implicitly has an 'any' type.`
- **Found during:** 20-01 Task 1 verification (`npx tsc --noEmit`)
- **Status:** Not fixed — file not touched by this plan's tasks, pre-exists prior to Phase 20 (confirmed via `git log` on the file, last modified in Phase 15 commit cfe6b3b). Out of scope per executor scope-boundary rule.

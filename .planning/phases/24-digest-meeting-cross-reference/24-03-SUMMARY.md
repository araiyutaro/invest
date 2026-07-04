---
phase: 24-digest-meeting-cross-reference
plan: 03
subsystem: pipeline
tags: [pipeline-integration, fail-soft, zod, vitest, invest-md, stderr-signal]

# Dependency graph
requires:
  - phase: 24-digest-meeting-cross-reference (plan 01)
    provides: "buildDigestCrossRefMap pure matcher (src/meeting/digest-crossref.ts)"
  - phase: 24-digest-meeting-cross-reference (plan 02)
    provides: "generateNewsDigestHtml(curation, date, crossRefMap?) 3-arg renderer"
provides:
  - "write-news-digest.ts wires buildDigestCrossRefMap into the pipeline entry point inside an isolated nested try/catch"
  - "[digest-crossref] OK|FAIL:<reason> stderr signal convention for pipeline observability"
  - "invest.md Step 3e dedicated [STEP:digest-crossref:OK|FAIL:...] marker, independent of [STEP:news-digest:*]"
affects: [pipeline-observability, xrep-02-fail-soft]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Isolated nested try/catch for a non-critical enrichment step: failure is contained (empty result), never rethrown, never touches process.exit/process.exitCode, and never triggers the primary failure fallback path"
    - "stderr string convention for cross-process signalling: script emits a distinct console.error() line; the orchestrator command inspects prior command output and echoes its own independent STEP marker"

key-files:
  created: []
  modified:
    - src/scripts/write-news-digest.ts
    - src/scripts/write-news-digest.test.ts
    - .claude/commands/invest.md

key-decisions:
  - "D-13: crossref computation lives in a nested try/catch INSIDE the existing outer digest try, but fully isolated from it — a crossref exception only leaves crossRefMap={}, it never reaches the outer catch's null-fallback + process.exit(1) path"
  - "D-14: crossref success/failure is signalled via stderr string convention ([digest-crossref] OK / FAIL:<reason>), not a new file/pipeline-metrics field — invest.md Step 3e observes this and echoes a dedicated [STEP:digest-crossref:*] marker, kept strictly separate from [STEP:news-digest:*] and never [PIPELINE:FAIL] (OPS-04)"
  - "Reused the already-read meetingRaw string for validateMeetingResult instead of re-reading meeting-result.json a second time (Pitfall 3)"

requirements-completed: [XREP-02]

# Metrics
duration: 6min
completed: 2026-07-04
---

# Phase 24 Plan 03: Pipeline Wiring for Digest-Meeting Cross-Reference (fail-soft) Summary

**Wired the Plan 01 cross-reference matcher into `write-news-digest.ts` behind an isolated try/catch so a crossref exception never affects the digest's exit code or triggers the null-fallback page, and added a dedicated `[STEP:digest-crossref:*]` marker to `invest.md` Step 3e, independent of the existing news-digest marker.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-07-04T01:52Z (approx)
- **Completed:** 2026-07-04T01:58Z
- **Tasks:** 2/2 completed
- **Files modified:** 3

## Accomplishments
- `write-news-digest.ts` now computes `crossRefMap` via `buildDigestCrossRefMap(curation, validateMeetingResult(...))` inside a nested try/catch that is fully independent of the existing outer digest try/catch — any exception (e.g. `validateMeetingResult` rejecting a malformed `meeting-result.json`) leaves `crossRefMap = {}` without calling `process.exit`, setting `process.exitCode`, or rethrowing, and never reaches the `curation === null` fallback render path.
- `generateNewsDigestHtml(curation, date)` calls updated to the 3-arg form `generateNewsDigestHtml(curation, date, crossRefMap)`.
- Added `[digest-crossref] OK` / `[digest-crossref] FAIL:<reason>` stderr signal lines for pipeline observability (D-14, Option a — stderr string convention).
- `invest.md` Step 3e: added a surgical, additive block immediately after the existing `[STEP:news-digest:OK|FAIL]` echo that inspects the just-run command's output for the crossref signal and echoes a dedicated `[STEP:digest-crossref:OK]` or `[STEP:digest-crossref:FAIL:<短い理由>]` marker. Explicit text added stating `[PIPELINE:FAIL]` must never be emitted and that crossref failure never blocks the existing 3 reports/deploy (OPS-04).
- New integration tests (RED then GREEN): crossref-exception isolation (digest still writes, `process.exit` not called with 1, no null-fallback text), crossref-success signal, both verified against the unmodified existing 3 test cases (which continue to pass).

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend integration tests — crossref isolation, no null-fallback, exit unaffected (RED)** - `be7ad7b` (test)
2. **Task 2: Implement isolated crossref try/catch + STEP marker signal + invest.md Step 3e (GREEN)** - `70cad7a` (feat)

_TDD cycle: RED (be7ad7b) → GREEN (70cad7a). No REFACTOR commit needed — implementation was minimal and clean on first pass._

## Files Created/Modified
- `src/scripts/write-news-digest.ts` - Added isolated crossref try/catch (imports `buildDigestCrossRefMap`, `validateMeetingResult`), 3-arg `generateNewsDigestHtml` call, stderr signal lines
- `src/scripts/write-news-digest.test.ts` - Added `describe("crossref fail-soft isolation (XREP-02, D-13)")` block with 2 new test cases (Test 4: exception isolation, Test 5: success signal); existing Test 1-3 unmodified
- `.claude/commands/invest.md` - Step 3e: added dedicated `[STEP:digest-crossref:OK|FAIL:...]` echo block, separate from `[STEP:news-digest:*]`, with explicit `[PIPELINE:FAIL]` prohibition and OPS-04 non-blocking note

## Decisions Made
- Followed the plan's locked decisions D-13 (isolated nested try/catch) and D-14 (stderr string convention) exactly as specified — no deviation.
- Constructed the crossref-exception test fixture as a `meeting-result.json` with a valid `date` field but missing all other required `MeetingResult` fields, causing `validateMeetingResult`'s zod parse to throw — this is the "inverse" of the existing curation-corruption tests (Test 2/3), which corrupt `news-curation.json` instead.

## Deviations from Plan

None - plan executed exactly as written. Both locked design decisions (D-13, D-14) were implemented as specified; no architectural changes, no new packages, no scope expansion.

## Issues Encountered

None. `PATTERNS.md` referenced in the plan's `read_first` sections was not present in this worktree's phase directory (only PLAN/RESEARCH/CONTEXT/DISCUSSION-LOG/UI-SPEC/VALIDATION files exist), but sufficient detail was available directly in `24-03-PLAN.md`'s `<interfaces>` block, `24-RESEARCH.md`'s Pitfall 2/3 sections, and the existing `write-news-digest.ts`/`generate-news-digest.ts` source to implement without needing that file.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Requirement XREP-02 (fail-soft cross-reference wiring) is complete. All 3 plans of phase 24 (matcher, renderer, pipeline wiring) are now implemented and verified:
- `npx vitest run src/scripts/write-news-digest.test.ts` exits 0 (5/5 tests pass, including the 2 new crossref cases).
- `npm test` full suite exits 0 (18 files, 306 tests).
- Manual verification of the `[STEP:digest-crossref:*]` marker in a live `launchd` pipeline run is deferred per `24-VALIDATION.md` (requires an actual daily pipeline execution, out of scope for this plan's automated verification).

No blockers for closing out phase 24.

---
*Phase: 24-digest-meeting-cross-reference*
*Completed: 2026-07-04*

## Self-Check: PASSED

- FOUND: src/scripts/write-news-digest.ts
- FOUND: src/scripts/write-news-digest.test.ts
- FOUND: .claude/commands/invest.md
- FOUND: .planning/phases/24-digest-meeting-cross-reference/24-03-SUMMARY.md
- FOUND commit: be7ad7b (test)
- FOUND commit: 70cad7a (feat)
- FOUND commit: f0f13e7 (docs)

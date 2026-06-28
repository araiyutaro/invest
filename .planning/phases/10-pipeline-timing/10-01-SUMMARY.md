---
phase: 10-pipeline-timing
plan: "01"
subsystem: pipeline-timing
tags: [performance, metrics, timing, tdd]
dependency_graph:
  requires: []
  provides: [pipeline-metrics-json, timing-display]
  affects: [collect-data.ts, invest.md]
tech_stack:
  added: []
  patterns: [performance.now(), Date.now(), read-merge-write JSON, TDD red-green]
key_files:
  created: []
  modified:
    - src/scripts/collect-data.ts
    - src/scripts/collect-data.test.ts
    - .claude/commands/invest.md
decisions:
  - "performance.now() for collect-data timing (ms-accurate, excludes tsx startup overhead)"
  - "Date.now() for inter-process timestamps in invest.md node -e blocks (separate processes)"
  - "read-merge-write pattern for pipeline-metrics.json (preserves prior step data)"
  - "fmt() isNaN guard returns 'スキップ' for missing/NaN values (prevents NaN display)"
metrics:
  duration: "~10 minutes"
  completed: "2026-06-28"
  tasks_completed: 2
  files_modified: 3
---

# Phase 10 Plan 01: Pipeline Timing Measurement Summary

## One-liner

`performance.now()` timing in collect-data.ts + 12-step `Date.now()` boundary timestamps in invest.md + D-03 Pipeline Timing display block added.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| Task 1 RED | Add failing tests for pipeline-metrics.json write (METR-01) and fmt function (METR-02) | 58f90ca |
| Task 1 GREEN | Implement performance.now() timing + pipeline-metrics.json write in collect-data.ts | a924637 |
| Task 2 | Add 12-step timestamp recording + Pipeline Timing display block to invest.md | 3c7acd7 |

## What Was Built

### Task 1: collect-data.ts (METR-01)

- Added `readFile` to imports from `node:fs/promises`
- Added `const t0 = performance.now()` at start of `main()`
- At end of `main()`: computes `durationMs = Math.round(performance.now() - t0)`, reads existing `pipeline-metrics.json` (ENOENT is silently ignored), merges `collectData: { durationMs }`, and writes back
- 2 new tests added: METR-01 (pipeline-metrics.json write + durationMs >= 0) and METR-02 (fmt function format assertions)
- All 83 tests pass (13 in collect-data.test.ts, 70 others)

### Task 2: invest.md (METR-01/METR-02)

- **pipelineStart**: Step 1 initialization block clears pipeline-metrics.json with `{ pipelineStart: Date.now() }`
- **12 step boundaries**: round1Start/End, tickerExtractStart/End, round2Start/End, moderatorIssuesStart/End, round3Start/End, moderatorFinalStart/End, validationStart/End, webSearchStart/End, portfolioStart/End, reportStart/End, deployStart/End, pipelineEnd
- **Pipeline Timing display block**: Added after completion summary in `## パイプライン完了` section
  - fmt() with `isNaN(ms)` guard returns "スキップ" for missing steps
  - try/catch returns "(タイミングデータなし)" if file missing
  - Step 1 uses `m.collectData.durationMs` (performance.now() value, not Date.now() delta)
  - Total uses `pipelineEnd - pipelineStart` in Xm YYs format

## Verification Results

1. `npx vitest run src/scripts/collect-data.test.ts` — 13/13 passed
2. `npx vitest run` — 83/83 passed (no regressions)
3. `grep -c "pipeline-metrics.json" .claude/commands/invest.md` — 48 (>= 25)
4. `grep -c "Pipeline Timing" .claude/commands/invest.md` — 2 (>= 1)

## Deviations from Plan

None - plan executed exactly as written.

## Threat Surface Scan

No new network endpoints, auth paths, or trust boundary crossings introduced. Changes are local file I/O only (tmp/pipeline-metrics.json). Consistent with plan's threat model (T-10-01: local tmp file, accept).

## Self-Check: PASSED

- src/scripts/collect-data.ts: modified with performance.now() + pipeline-metrics.json write
- src/scripts/collect-data.test.ts: 2 new tests (METR-01, METR-02)
- .claude/commands/invest.md: 327 lines added (24 node -e blocks + display block)
- Commits: 58f90ca (test RED), a924637 (feat GREEN), 3c7acd7 (feat invest.md)

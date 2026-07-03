---
phase: 21-portfolio-websearch-research
plan: 02
subsystem: pipeline
tags: [invest-md, claude-code-agents, websearch, fail-soft, pipeline-metrics]

# Dependency graph
requires:
  - phase: 21-portfolio-websearch-research (plan 01)
    provides: "webSearchResultSchema alias-transform hardening + validate-portfolio-research.ts (schema contract this step's output must satisfy)"
provides:
  - "Step 3-P section in invest.md: 12-holding parallel WebSearch research pipeline step, positioned before the highlightedStocks 0-count branch"
  - "tmp/portfolio-research/{symbol}.json write contract (isolated from tmp/websearch/ and tmp/reeval/)"
  - "[STEP:portfolio-research:START/OK/FAIL] fail-soft marker vocabulary + pipeline-metrics portfolioResearchStart/End timing"
affects: [22-portfolio-analyst-reevaluation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Step 3-P: new pipeline step inserted between Step 3.0 prep and the highlightedStocks 0-count branch, iterating a fixed holdings list independent of daily candidate count"
    - "Dual query template (English ticker+company-name vs Japanese nameJa) selected per-holding inside the same parallel Agent round"
    - "Entity-verification instruction + prompt-injection defense instruction attached to every research Agent prompt (copied forward into new Agent-based WebFetch code, not present in the Step 3a template it was copied from)"

key-files:
  created: []
  modified:
    - ".claude/commands/invest.md"

key-decisions:
  - "Step 3-P placed between meeting-result.json read and the highlightedStocks 0-count branch so portfolio research always runs regardless of daily candidate count (D-01)"
  - "Dedicated rm -rf + mkdir for tmp/portfolio-research/ kept separate from Step 3.0's shared tmp/websearch tmp/reeval mkdir line (D-11)"
  - "Verbatim reuse of the Step 3e non-blocking-FAIL instruction sentence for Step 3-P, to guarantee Claude Code never emits [PIPELINE:FAIL] on partial/full research failure (D-13/D-14, OPS-05)"
  - "Added a one-line prompt-injection defense instruction to the Step 3-P Agent prompt that Step 3a (the template it's copied from) lacks, per 21-RESEARCH.md's explicit recommendation not to propagate the known gap into new code"

patterns-established:
  - "Dedicated-directory fail-soft research step: clean+mkdir its own tmp/ subdirectory, write per-symbol JSON (with fallback JSON for invalid Agent output) for every item regardless of success/failure, emit START/OK/FAIL markers, never emit [PIPELINE:FAIL]"

requirements-completed: [PORT-02, OPS-05]

duration: 15min
completed: 2026-07-03
---

# Phase 21 Plan 02: Step 3-P Pipeline Wiring Summary

**Wired a new Step 3-P pipeline step into invest.md that runs 12 parallel WebSearch research Agents over the fixed portfolio holdings list (not the daily candidate list), saving isolated per-symbol JSON with fail-soft STEP markers and pipeline-metrics timing.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-07-03T09:16:00Z (approx.)
- **Completed:** 2026-07-03T09:31:29Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Inserted `### Step 3-P: 保有銘柄WebSearchリサーチ（12銘柄並列）` between the `meeting-result.json` read and the `highlightedStocks` 0-count branch, so the step runs unconditionally on every pipeline execution (D-01)
- Implemented 12-Agent single-message parallel fan-out over `PORTFOLIO_HOLDINGS` (not `highlightedStocks`), with dual English/Japanese query templates, entity-verification instructions, and a prompt-injection defense instruction not present in the Step 3a template it was adapted from
- Implemented fail-soft marker semantics (`START`/`OK`/`FAIL` with failed-ticker enumeration) and the verbatim "never emit `[PIPELINE:FAIL]`" instruction copied from the Step 3e news-digest precedent
- Added `portfolioResearchStart`/`portfolioResearchEnd` pipeline-metrics timestamps and a matching "ポートフォリオリサーチ" row in the final Pipeline Timing display block

## Task Commits

Each task was committed atomically:

1. **Task 1: Step 3-P（保有銘柄WebSearchリサーチ）セクションを invest.md へ挿入** - `a6228c8` (feat)
2. **Task 2: Pipeline Timing 表示に「ポートフォリオリサーチ」行を追加** - `95656d0` (feat)

**Plan metadata:** (pending — orchestrator merges worktree; SUMMARY.md itself is committed as part of this plan's final commit)

## Files Created/Modified
- `.claude/commands/invest.md` - Added Step 3-P section (12-holding parallel WebSearch research, fail-soft markers, metrics) and one Pipeline Timing display row

## Decisions Made
- See `key-decisions` in frontmatter. No decisions departed from the plan's `<decisions>` (D-01 through D-16 in 21-CONTEXT.md) — this plan implemented the locked decisions as specified.

## Deviations from Plan

None - plan executed exactly as written. One clarifying addition within Rule 2 (auto-add missing critical functionality) scope: the plan's action point (7) explicitly called for a prompt-injection defense instruction to be added to the Agent prompt (a gap 21-RESEARCH.md identified as pre-existing in the Step 3a template this section was adapted from, but non-blocking to propagate into new code). This was implemented verbatim as specified in the plan, using the same phrasing style already established in the existing `portfolio-analyst` prompt (Step 3d) for consistency — not a deviation, but noting it here since it diverges from the Step 3a precedent it otherwise copies.

## Issues Encountered

The first automated verification pass for Task 1 failed on the `tmp/portfolio-research` grep-line-count threshold (`-ge 3`) because the initial draft only referenced the directory path on 2 distinct lines (the `rm -rf`/`mkdir` command and the save-destination bullet). Fixed by extending the tmp/websearch and tmp/reeval prohibition sentence to also name `tmp/portfolio-research/` explicitly as the step's own output directory, which both satisfied the verification threshold and improved clarity of the isolation boundary (D-10). Re-ran verification — passed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Step 3-P is fully wired and self-contained; the next consumer is Phase 22 (portfolio-analyst prompt injection using `tmp/portfolio-research/{symbol}.json` written by this step)
- Live-execution verification (12 files written, schema conformance via `validate-portfolio-research.ts` from Plan 01, EE/NXT entity spot-check, START/OK-or-FAIL marker in real pipeline logs, Daily Report unaffected) remains a phase-gate item per this plan's `<verification>` section and is not part of this plan's automated scope — deferred to phase verification/live pipeline run.
- No blockers.

---
*Phase: 21-portfolio-websearch-research*
*Completed: 2026-07-03*

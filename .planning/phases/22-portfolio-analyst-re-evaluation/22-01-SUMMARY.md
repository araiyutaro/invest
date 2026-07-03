---
phase: 22-portfolio-analyst-re-evaluation
plan: 01
subsystem: api
tags: [zod, schema-validation, typescript, portfolio-analysis]

# Dependency graph
requires:
  - phase: 21-portfolio-websearch-research
    provides: rawHoldingSchema / holdingEvaluationSchema alias-transform pattern precedent (rawWebSearchResultSchema)
provides:
  - "HoldingEvaluation type extended with urgent (required boolean), previousDecision? and decisionChanged? (TS-assigned optionals)"
  - "holdingEvaluationSchema alias-transform hardened to absorb urgent/urgency/isUrgent/urgentFlag with default false"
  - "Explicit-object-literal strip of LLM-injected decisionChanged/previousDecision proven by test (PORT-05 core control)"
affects: [22-02-plan-prompt-integration, 22-03-decision-diff, 22-04-report-rendering]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "4-way alias absorption on a single boolean field (urgent/urgency/isUrgent/urgentFlag) coalesced via ?? chain, mirroring the existing 2-3-way string/array alias precedent in rawWebSearchResultSchema"
    - "TS-only fields (previousDecision/decisionChanged) declared optional on the domain type but deliberately excluded from the schema transform's explicit object literal, achieving strip-by-omission with zero extra code"

key-files:
  created: []
  modified:
    - src/meeting/types.ts
    - src/meeting/schemas.ts
    - src/meeting/schemas.test.ts

key-decisions:
  - "D-08/D-10 implemented as spec'd: urgent is LLM-output, alias-normalized, defaults to false when omitted"
  - "D-11 implemented via explicit object literal return (no ...raw spread) — decisionChanged/previousDecision are structurally unreachable in the schema output even if the LLM emits them"
  - "D-14 encoded at the type level only in this plan (decisionChanged?: boolean as optional, distinct from a hypothetical non-optional default-false) — actual undefined-vs-false computation deferred to 22-03 decision-diff"

patterns-established:
  - "Boolean alias hardening: when adding a new LLM-controlled boolean field, add all known aliases as z.boolean().optional() on the raw schema and coalesce with ?? in the transform, defaulting to false as the last fallback"

requirements-completed: [PORT-04, PORT-05]

# Metrics
duration: 5min
completed: 2026-07-03
---

# Phase 22 Plan 01: LLM Output Contract — urgent flag + decisionChanged/previousDecision strip Summary

**HoldingEvaluation gains an alias-hardened `urgent: boolean` (LLM output, 4-alias normalized, default false) and TS-only `previousDecision?`/`decisionChanged?` fields that the schema transform structurally strips from any LLM-injected values via explicit-object-literal return.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-07-03T11:43:00Z
- **Completed:** 2026-07-03T11:45:15Z
- **Tasks:** 2 completed
- **Files modified:** 3

## Accomplishments
- `HoldingEvaluation` interface extended with `urgent: boolean` (required), `previousDecision?` and `decisionChanged?` (optional, TS-assigned), each documented with its provenance and semantics (undefined vs false distinction for decisionChanged per D-14)
- `rawHoldingSchema` hardened to absorb `urgent`/`urgency`/`isUrgent`/`urgentFlag` as `z.boolean().optional()`, coalesced in `holdingEvaluationSchema.transform()` with a `false` default
- New `describe("holdingEvaluationSchema", ...)` test block (6 cases) covering default-false, all 4 aliases, and strip of LLM-injected `decisionChanged`/`previousDecision` — TDD RED→GREEN cycle followed

## Task Commits

Each task was committed atomically:

1. **Task 1: HoldingEvaluation 型に urgent / previousDecision / decisionChanged を追加** - `662996e` (feat)
2. **Task 2 (RED): failing tests for holdingEvaluationSchema urgent alias + strip** - `9b9f9c9` (test)
3. **Task 2 (GREEN): urgent alias normalization implementation** - `a120a74` (feat)

**Plan metadata:** committed separately by worktree-mode SUMMARY commit (see below)

_TDD task produced 2 commits (test → feat); no refactor commit needed — implementation was minimal and clean on first pass._

## Files Created/Modified
- `src/meeting/types.ts` - `HoldingEvaluation` interface: added `readonly urgent: boolean`, `readonly previousDecision?`, `readonly decisionChanged?` with doc comments on provenance/semantics
- `src/meeting/schemas.ts` - `rawHoldingSchema`: added `urgent`/`urgency`/`isUrgent`/`urgentFlag` as optional booleans; `holdingEvaluationSchema.transform()`: added `urgent: raw.urgent ?? raw.urgency ?? raw.isUrgent ?? raw.urgentFlag ?? false` to the explicit return literal
- `src/meeting/schemas.test.ts` - new `describe("holdingEvaluationSchema", ...)` block (6 tests: default false, 4 alias acceptance cases, strip of decisionChanged/previousDecision); added `holdingEvaluationSchema` to the schemas.js import

## Decisions Made
- Followed the plan's explicit instruction to keep `...raw` spread out of the transform return — this is what makes the strip in D-11 hold structurally rather than requiring an explicit `delete` or omit-list, and the plan's acceptance criteria required grep-verifying its absence
- Did not create a separate `DecisionDiffResult` type — per plan instruction, 22-03 will return `ReadonlyArray<HoldingEvaluation>` directly, so no wrapper type was introduced in this plan

## Deviations from Plan

None - plan executed exactly as written. `22-PATTERNS.md`, referenced in the plan's `<read_first>` sections, does not exist in this worktree; the plan's own inline `<interfaces>` block (current field/line references for types.ts and schemas.ts) contained sufficient detail to execute both tasks without it, and both tasks' `<action>` sections were self-contained.

## Issues Encountered
- `npx tsc --noEmit` (run as an extra manual check beyond the plan's mandated `vitest` verification) surfaces pre-existing type errors in `src/scripts/generate-report.test.ts` (6 call sites) because making `urgent` a required field on `HoldingEvaluation` means literal fixture objects lacking `urgent` no longer satisfy `PortfolioAnalysis`. This is expected and explicitly out of scope for this plan (`files_modified` for 22-01 is limited to `types.ts`/`schemas.ts`/`schemas.test.ts`); confirmed against `22-04-PLAN.md` Task 2, which already plans to add `urgent: false` to the `validPortfolioAnalysis` fixture "to align with 22-01's required urgent type" (22-04-PLAN.md line 164). The project's `npm test` script runs `vitest run` only (no `tsc --noEmit` gate), so this does not affect `npm test` / CI status — all 258 tests across 16 files pass.

## Next Phase Readiness
- 22-02 (prompt integration) and 22-03 (decision-diff) can now rely on `HoldingEvaluation.urgent`/`previousDecision`/`decisionChanged` being present on the type
- 22-04 (report rendering) is aware it must add `urgent: false` to its test fixtures (already planned) before its own type-checks will pass
- No blockers for downstream plans

## Self-Check: PASSED

All created/modified files and commit hashes verified present:
- `src/meeting/types.ts` - FOUND
- `src/meeting/schemas.ts` - FOUND
- `src/meeting/schemas.test.ts` - FOUND
- `.planning/phases/22-portfolio-analyst-re-evaluation/22-01-SUMMARY.md` - FOUND
- `662996e` (Task 1 feat) - FOUND
- `9b9f9c9` (Task 2 RED test) - FOUND
- `a120a74` (Task 2 GREEN feat) - FOUND
- `59e7c3d` (docs summary) - FOUND
</content>

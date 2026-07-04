---
phase: 25-urgency-history-persistence
plan: 02
subsystem: pipeline
tags: [typescript, vitest, tdd, cli-wrapper, fail-soft, invest-md, git-deploy]

# Dependency graph
requires:
  - phase: 25-urgency-history-persistence
    plan: 01
    provides: "src/portfolio/urgency-history.ts: extractUrgencySnapshots, appendUrgencySnapshot, isValidDateKey pure functions"
provides:
  - "src/scripts/write-urgency-history.ts: fail-soft CLI wrapper that persists data/urgency-history.json"
  - "invest.md Step 3f: dedicated pipeline step running the wrapper with [STEP:urgency-history:*] markers"
  - "invest.md Step 4: git add docs/ data/ (data/urgency-history.json now committed/pushed alongside docs/)"
affects: [26-weekly-urgency-rollup-display]

# Tech tracking
tech-stack:
  added: []
  patterns: [fail-soft CLI wrapper with mkdir-first ordering, STEP-marker pipeline step never emitting PIPELINE:FAIL, plain-JSON self-generated-artifact read (no zod)]

key-files:
  created: [src/scripts/write-urgency-history.ts, src/scripts/write-urgency-history.test.ts]
  modified: [.claude/commands/invest.md]

key-decisions:
  - "loadExistingHistory's ENOENT/corrupted distinction checks both error.code === 'ENOENT' and error.message.includes('ENOENT'), because this codebase's established test-mock convention (write-news-digest.test.ts) simulates ENOENT via a plain Error(message) with no .code property — checking .code alone would misclassify the mocked missing-file case as corrupted"
  - "Step 3f inserted as a new step (no renumbering) directly between Step 3e and Step 4, mirroring Step 3e's exact template with urgency-history substituted for news-digest"
  - "Step 4's git add docs/ data/ is guarded by a belt-and-suspenders existsSync('data') + mkdirSync, on top of write-urgency-history.ts's own unconditional mkdir(DATA_DIR) — defense-in-depth against the verified exit-128 git add pathspec failure"

requirements-completed: [HIST-01, HIST-02]

# Metrics
duration: 10min
completed: 2026-07-04
---

# Phase 25 Plan 02: Urgency History CLI Wrapper + Pipeline Wiring Summary

**Thin fail-soft CLI wrapper `write-urgency-history.ts` (mkdir-first, dateKey from meeting-result.json, D-13/D-14/D-06 fail-soft branches) plus invest.md Step 3f + Step 4 `git add docs/ data/` wiring, completing HIST-01/HIST-02 end-to-end persistence to git.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-07-04T03:00:00Z (approx)
- **Completed:** 2026-07-04T03:08:23Z
- **Tasks:** 3 (TDD RED, GREEN, then invest.md wiring)
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments

- `src/scripts/write-urgency-history.ts` implements `main()` mirroring `write-news-digest.ts`'s fail-soft shape: `await mkdir(DATA_DIR, { recursive: true })` runs as the unconditional first statement (verified via grep and a dedicated test), guaranteeing `data/` exists on disk before Step 4's `git add docs/ data/` regardless of any downstream skip/fail branch
- dateKey is read exclusively from `tmp/meeting-result.json`'s `date` field (not `portfolioAnalysis.date`, not a fresh JST re-derivation), keeping the history entry aligned with Step 4's `docs/{date}/` directory and commit message (D-05, Pitfall 2)
- All three fail-soft branches implemented and tested: missing/0-holding `tmp/portfolio-analysis.json` skips silently and exits 0 (D-13); a corrupted existing `data/urgency-history.json` is preserved (no overwrite) and exits 1 (D-14); an invalid dateKey (fails `isValidDateKey`) performs no write and exits 1 (D-06)
- `data/urgency-history.json` is read/written via plain `readFile`/`JSON.parse`/`JSON.stringify` (no zod), matching `loadHoldingNews`'s self-generated-artifact convention — distinct from the zod-validated `loadPortfolioAnalysis()` used elsewhere
- `.claude/commands/invest.md` gained a new `### Step 3f: 緊急度履歴の追記` block (inserted between Step 3e and Step 4, no renumbering) that runs the wrapper and emits `[STEP:urgency-history:OK]` / `[STEP:urgency-history:FAIL:...]`, explicitly never `[PIPELINE:FAIL]`
- Step 4's deploy `node -e` block now stages both directories: `if (!fs.existsSync('data')) fs.mkdirSync('data', { recursive: true }); execSync('git add docs/ data/', { stdio: 'inherit' });` — a defense-in-depth guard on top of the wrapper's own `mkdir`, directly mitigating the verified `git add` exit-128-on-missing-pathspec pitfall
- 7-case co-located test suite (`write-urgency-history.test.ts`) covers normal write (all 12 holdings under the correct dateKey), same-day overwrite (HIST-02, no duplication), skip on ENOENT, skip on 0-holdings, corrupted-history preservation, invalid-dateKey rejection, and mkdir-called-first ordering

## Task Commits

Each task was committed atomically:

1. **Task 1: RED — failing test suite for write-urgency-history CLI wrapper** - `481abdb` (test)
2. **Task 2: GREEN — implement fail-soft write-urgency-history CLI wrapper** - `b68e03b` (feat)
3. **Task 3: invest.md Step 3f insertion + Step 4 git add extension** - `5e31cea` (feat)

_TDD plan: RED (throwing stub + full 7-test suite, confirmed 7/7 failing) → GREEN (real `main()` implementation, confirmed 7/7 passing + full suite 331/331 passing, no regressions) → wire (invest.md pipeline integration, non-TDD config edit). No REFACTOR commit needed._

## Files Created/Modified

- `src/scripts/write-urgency-history.ts` - Fail-soft CLI wrapper: `main()` (mkdir-first, loadExistingHistory with ENOENT/corrupted distinction, D-13/D-14/D-06 branches, extractUrgencySnapshots/appendUrgencySnapshot/isValidDateKey calls, writeFile), `if (process.argv[1] === fileURLToPath(import.meta.url))` run-guard
- `src/scripts/write-urgency-history.test.ts` - 7 tests across normal write, same-day overwrite, ENOENT skip, empty-holdings skip, corrupted preserve, invalid dateKey, mkdir-first ordering, using `vi.mock("node:fs/promises")` + path-substring readFile routing
- `.claude/commands/invest.md` - New `### Step 3f: 緊急度履歴の追記` block between Step 3e and Step 4; Step 4's `git add docs/` extended to `git add docs/ data/` with an `existsSync('data')` guard

## Decisions Made

- **ENOENT detection via message, not just `.code`:** The plan's RESEARCH.md/PATTERNS.md reference implementation checked `(error as NodeJS.ErrnoException).code === "ENOENT"`. During GREEN, this failed 3 of 7 tests because the codebase's established test-mock convention (copied from `write-news-digest.test.ts`'s `readFile: vi.fn().mockRejectedValue(new Error("ENOENT"))`) produces a plain `Error` with no `.code` property — only a message. Fixed by checking both `error.code === "ENOENT"` (real Node fs behavior) and `error.message.includes("ENOENT")` (this codebase's test-mock convention and also matches real Node's ENOENT message text, e.g. `"ENOENT: no such file or directory, open '...'"`). Tracked as `[Rule 1 - Bug]` below.
- Followed PATTERNS.md/RESEARCH.md's Step 3f/Step 4 diff targets verbatim — no discretionary deviation needed for the invest.md wiring.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed ENOENT-vs-corrupted misclassification in `loadExistingHistory`**
- **Found during:** Task 2 (GREEN) — 3 of 7 tests failed on first implementation pass
- **Issue:** The RESEARCH.md reference implementation checked only `(error as NodeJS.ErrnoException).code === "ENOENT"` to distinguish a missing history file (normal, first-run) from a corrupted one (D-14, preserve + exit 1). This codebase's test-mock convention for simulating fs ENOENT (established in `write-news-digest.test.ts` and reused verbatim in this plan's own `write-urgency-history.test.ts`) uses a plain `new Error("ENOENT")` with no `.code` property, so the `.code`-only check misclassified the mocked "missing file" case as "corrupted," causing the normal-write and both skip tests to fail (early `process.exit(1)` before ever reaching the write/skip logic).
- **Fix:** Extended the check to `(error as NodeJS.ErrnoException).code === "ENOENT" || (error instanceof Error && error.message.includes("ENOENT"))`. Real Node fs ENOENT errors satisfy the `.code` check; the mocked test errors satisfy the `.message` check; real Node ENOENT error messages also happen to contain the substring "ENOENT" so both checks agree in production too.
- **Files modified:** `src/scripts/write-urgency-history.ts`
- **Commit:** `b68e03b` (folded into the GREEN commit — was fixed before the co-located suite went green, per the RED→GREEN task boundary)

Or: N/A (see above — the corrected implementation matches the RESEARCH.md reference in every other respect).

## Issues Encountered

None beyond the Rule 1 fix documented above, resolved within the GREEN task's normal fix-until-green loop.

## User Setup Required

None. This plan uses only existing dependencies (`vitest`, Node.js built-ins) and modifies a Claude Code command markdown file; no external service configuration is required. HIST-01/HIST-02 will take effect automatically on the next full `invest.md` pipeline run (Step 3f runs, `data/urgency-history.json` is created and committed via Step 4).

## Next Phase Readiness

- HIST-01 (daily persistence + git commit/push) and HIST-02 (same-day overwrite reaching disk) are both complete, tested, and wired into the pipeline — Phase 25 is done.
- `data/urgency-history.json` will not exist on disk until the next `invest.md` run executes Step 3f for the first time; Phase 26 (weekly urgency rollup display) can safely assume the file exists once that first run completes, and should itself fail-soft (empty rollup) if the file is somehow still absent.
- No blockers.

## Self-Check: PASSED

- FOUND: src/scripts/write-urgency-history.ts
- FOUND: src/scripts/write-urgency-history.test.ts
- FOUND: .claude/commands/invest.md (Step 3f + Step 4 edits present via grep)
- FOUND: commit 481abdb (test)
- FOUND: commit b68e03b (feat)
- FOUND: commit 5e31cea (feat)

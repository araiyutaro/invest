---
phase: 27-etf-exclusion
plan: 02
subsystem: portfolio
tags: [typescript, vitest, tdd, yahoo-finance2, quoteType, fail-soft-cli, etf-classification]

# Dependency graph
requires:
  - phase: 27-etf-exclusion (Plan 01)
    provides: "filterEtfStocks pure function, QuoteTypeLookup/EtfExclusionResult types"
provides:
  - "filter-etf-stocks.ts fail-soft CLI that reads tmp/meeting-result.json, batch-fetches quoteType via yahoo-finance2, and rewrites the file with ETFs excluded"
  - "fetchQuoteTypes() single-batch quote() helper (D-05) as the reusable batch-fetch pattern for future ticker classification needs"
affects: [27-03-invest-md-wiring, 28-watchlist-persistence]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fail-soft CLI wrapper owns all I/O + network; pure function (Plan 01) owns classification logic — mirrors urgency-history.ts/write-urgency-history.ts split"
    - "Single batched yahooFinance.quote([...tickers]) call instead of per-ticker Promise.all (first use of true batching in this codebase, D-05)"
    - "Mechanism-level failure (read/parse/batch-quote exception) => skip writeFile entirely, process.exitCode=1, never throw — original file preserved untouched (D-02, Pitfall 4)"

key-files:
  created:
    - src/scripts/filter-etf-stocks.ts
    - src/scripts/filter-etf-stocks.test.ts
  modified: []

key-decisions:
  - "fetchQuoteTypes() lets batch quote() exceptions propagate to main()'s try/catch rather than swallowing them internally, so the mechanism-level failure (D-02, whole-script fail-soft) can be cleanly separated from per-ticker lookup failure (D-01, fail-closed) at the call site"
  - "console.log reserved for per-exclusion D-13 audit lines (ETF除外: ... / lookup失敗); console.error reserved for STEP-level OK/FAIL status lines — matches write-urgency-history.ts's channel convention"
  - "writeFile is only reached after successful in-memory computation of kept/excluded; any earlier failure branch returns before constructing the updated object, structurally preventing Pitfall 4 (partial/garbage overwrite of tmp/meeting-result.json)"

patterns-established:
  - "RESEARCH.md Pattern 2 (fetchQuoteTypes) and Code Examples CLI skeleton used verbatim as the implementation shape"

requirements-completed: [ETF-02]

coverage:
  - id: D1
    description: "filter-etf-stocks main() reads tmp/meeting-result.json, does a single batched quote() call, and rewrites the file with ETFs excluded (kept=EQUITY only)"
    requirement: "ETF-02"
    verification:
      - kind: unit
        ref: "src/scripts/filter-etf-stocks.test.ts#Test A: 正常フィルタ -- ETF(SPY, 1306.T)を除外しEQUITY(AAPL, 7203.T)のみでwriteFileが1回呼ばれる"
        status: pass
    human_judgment: false
  - id: D2
    description: "Individual ticker lookup failures (missing from batch response) are fail-closed excluded without throwing, and processing continues for the remaining tickers"
    requirement: "ETF-02"
    verification:
      - kind: unit
        ref: "src/scripts/filter-etf-stocks.test.ts#Test B: partial lookup失敗で継続 -- 応答に欠けたtickerはfail-closedで除外されthrowしない"
        status: pass
    human_judgment: false
  - id: D3
    description: "Whole-mechanism failures (batch quote() rejection, file read failure) are fail-soft: writeFile is never called, process.exitCode is set non-zero, no throw, original tmp/meeting-result.json is preserved"
    requirement: "ETF-02"
    verification:
      - kind: unit
        ref: "src/scripts/filter-etf-stocks.test.ts#Test C: batch quote() reject で fail-soft -- writeFileが呼ばれずprocess.exitCodeが非0、throwしない"
        status: pass
      - kind: unit
        ref: "src/scripts/filter-etf-stocks.test.ts#Test D: 読み込み失敗で fail-soft -- writeFileが呼ばれずprocess.exitCodeが非0、throwしない"
        status: pass
    human_judgment: false
  - id: D4
    description: "highlightedStocks=[] is a normal no-op path: quote() is never called and writeFile is never called, exiting cleanly"
    requirement: "ETF-02"
    verification:
      - kind: unit
        ref: "src/scripts/filter-etf-stocks.test.ts#Test E: highlightedStocks 0件でスキップ -- quote()を呼ばずwriteFileもせず正常終了"
        status: pass
    human_judgment: false
  - id: D5
    description: "Excluded tickers are logged to stdout with reason distinguished between ETF classification and lookup failure (D-13 audit format)"
    requirement: "ETF-02"
    verification:
      - kind: unit
        ref: "src/scripts/filter-etf-stocks.test.ts#Test F: D-13監査ログ -- ETF除外とlookup失敗除外がstdoutに区別されて記録される"
        status: pass
    human_judgment: false
  - id: D6
    description: "quoteType lookup uses exactly one batched quote() call with an array argument, never per-ticker sequential calls (D-05, rate-limit avoidance)"
    requirement: "ETF-02"
    verification:
      - kind: unit
        ref: "src/scripts/filter-etf-stocks.test.ts#Test G: single batch call (D-05) -- quoteMockが配列を第1引数として厳密に1回だけ呼ばれる"
        status: pass
    human_judgment: false

duration: 2min
completed: 2026-07-15
status: complete
---

# Phase 27 Plan 02: ETF Exclusion CLI Wrapper Summary

**filter-etf-stocks.ts fail-soft CLI wrapper built via TDD: single batched yahoo-finance2 quote() call classifies highlightedStocks tickers, then rewrites tmp/meeting-result.json with ETFs deterministically excluded**

## Performance

- **Duration:** 2 min
- **Started:** 2026-07-15T01:27:40Z
- **Completed:** 2026-07-15T01:29:29Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- `filter-etf-stocks.ts` fail-soft CLI wrapper built, wrapping Plan 01's pure `filterEtfStocks` function with the network + file I/O boundary (D-06 separation of concerns)
- `fetchQuoteTypes()` performs the codebase's first true single-batched `yahooFinance.quote([...tickers])` call (D-05), replacing the per-ticker `Promise.all` idiom used elsewhere (`market.ts`, `technicals.ts`) — structurally caps Yahoo Finance API calls to 1 per pipeline run regardless of ticker count
- Fail-closed (D-01, per-ticker lookup failure) and fail-soft (D-02, whole-mechanism failure) are structurally separated: only successful read + successful batch quote() reach the `writeFile` call; any earlier failure returns before the write, preserving the original `tmp/meeting-result.json` untouched (Pitfall 4 avoidance, directly tested)
- D-13 audit logging distinguishes "ETF除外: SPY (quoteType=ETF)" from "ETF除外: XYZ (quoteType取得失敗, fail-closed)" via `console.log`, while STEP-level OK/FAIL status uses `console.error` (matches `write-urgency-history.ts` channel convention)
- Full 7-test matrix (Test A-G) covers: normal filter + rewrite, partial lookup-failure continuation, batch quote() rejection fail-soft, read failure fail-soft, empty-input skip, D-13 log format, and single-batch-call enforcement

## Task Commits

Each task was committed atomically:

1. **Task 1: filter-etf-stocks CLI の fail-soft/fail-closed テストを作成する（RED）** - `c4a9c48` (test)
2. **Task 2: filter-etf-stocks.ts fail-soft CLI ラッパーを実装しテストをGREENにする** - `2b26426` (feat)

_TDD gate sequence verified: test(c4a9c48) → feat(2b26426)._

## Files Created/Modified
- `src/scripts/filter-etf-stocks.ts` - Fail-soft CLI wrapper: `fetchQuoteTypes()` (single batch quote()), `main()` (read/filter/write/log orchestration), entry-point guard
- `src/scripts/filter-etf-stocks.test.ts` - 7 unit tests covering D-01/D-02/D-05/D-13 (vi.hoisted mocks for yahoo-finance2 + node:fs/promises)

## Decisions Made
- `fetchQuoteTypes()` deliberately does not catch its own `quote()` exceptions — it lets them propagate to `main()`'s try/catch, keeping the D-02 (mechanism failure) and D-01 (per-ticker failure) boundaries at a single, auditable call site rather than duplicating error-handling logic across two layers
- `console.log` is reserved exclusively for per-exclusion D-13 audit lines; `console.error` is reserved for STEP-level `[filter-etf-stocks] OK/FAIL` status lines — this mirrors `write-urgency-history.ts`'s existing channel convention exactly, so launchd log parsing tooling (if any is added later) can rely on a consistent split
- The `updated` object (spread + `highlightedStocks: kept`) is only constructed and written after both the read and the batch quote() call succeed in memory — this is a structural guarantee (not just a test assertion) that a mid-flight failure can never partially overwrite `tmp/meeting-result.json`

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None for this plan's scope. Both tasks completed on first attempt: RED confirmed via `Cannot find module` import failure (main() not yet implemented), then GREEN confirmed with all 7 new tests passing and zero regressions across the full 437-test suite (`npm test`).

**Out-of-scope note (not fixed, per Scope Boundary rule):** `npx tsc --noEmit` reports 4 pre-existing type errors in `src/scripts/collect-data.test.ts` (implicit `any` on `call`/`msg` parameters, introduced in commits `a840e58`/`cfe6b3b` predating this phase). These are unrelated to `filter-etf-stocks.ts`, which has zero type errors. Not fixed per the executor's scope boundary (only auto-fix issues directly caused by the current task's changes).

## TDD Gate Compliance

RED gate: `c4a9c48` (`test(27-02): add failing tests for filter-etf-stocks CLI (D-01/D-02/D-05/D-13)`) — confirmed RED via `Cannot find module '/src/scripts/filter-etf-stocks.js'` import failure across all 7 tests.
GREEN gate: `2b26426` (`feat(27-02): implement filter-etf-stocks fail-soft CLI wrapper (D-01/D-02/D-05)`) — confirmed GREEN, all 7 tests passing, full suite (437 tests) green with no regressions.
No REFACTOR commit was needed (implementation matched RESEARCH.md Pattern 2 + Code Examples CLI skeleton verbatim on first pass, no cleanup required).

## User Setup Required

None - no external service configuration required. `yahoo-finance2@3.13.2` is already installed and in active use elsewhere in this codebase; zero new dependencies this phase.

## Next Phase Readiness
- `filter-etf-stocks.ts` is executable via `npx tsx src/scripts/filter-etf-stocks.ts` and ready for Plan 03 to wire into `.claude/commands/invest.md` Step 2g (immediately before `validate-meeting.ts`), per D-07
- STEP marker convention (`[STEP:etf-exclusion:OK]` / `[STEP:etf-exclusion:FAIL:<reason>]`) is Plan 03's responsibility to emit in invest.md prose — this plan's script only emits the underlying `[filter-etf-stocks] OK/FAIL:` console.error lines that Plan 03's echo logic will summarize
- No blockers. This plan's scope was intentionally limited to the CLI wrapper (D-06's separation of concerns); invest.md prompt-block insertion (ETF-01, D-10/D-11) and pipeline wiring (D-07/D-08) remain Plan 03's responsibility

---
*Phase: 27-etf-exclusion*
*Completed: 2026-07-15*

## Self-Check: PASSED

- FOUND: src/scripts/filter-etf-stocks.ts
- FOUND: src/scripts/filter-etf-stocks.test.ts
- FOUND: .planning/phases/27-etf-exclusion/27-02-SUMMARY.md
- FOUND commit: c4a9c48
- FOUND commit: 2b26426

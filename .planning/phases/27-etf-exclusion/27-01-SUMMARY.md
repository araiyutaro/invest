---
phase: 27-etf-exclusion
plan: 01
subsystem: portfolio
tags: [typescript, vitest, tdd, pure-function, quoteType, etf-classification]

# Dependency graph
requires: []
provides:
  - "filterEtfStocks pure function (D-01 fail-closed lookup failure, D-04 EQUITY allowlist)"
  - "QuoteTypeLookup discriminated union type (ok/failed states)"
  - "EtfExclusionResult type (kept/excluded with reason breakdown)"
affects: [27-02-filter-etf-stocks-cli, 28-watchlist-persistence]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure classification module + fail-soft CLI wrapper split (mirrors urgency-history.ts / write-urgency-history.ts)"
    - "Discriminated union for lookup result (status: 'ok'|'failed') to distinguish 'not EQUITY' from 'lookup failed' (Pitfall 3 avoidance)"
    - "ReadonlyMap<string, QuoteTypeLookup> instead of plain object for ticker-keyed lookups (prototype-pollution defense, T-27-01)"

key-files:
  created:
    - src/portfolio/etf-exclusion.ts
    - src/portfolio/etf-exclusion.test.ts
  modified: []

key-decisions:
  - "allowlist implemented as quoteType !== ALLOWED_QUOTE_TYPE (never a hardcoded denylist), so unknown future quoteType values remain fail-closed per D-01"
  - "quoteTypeByTicker parameter typed ReadonlyMap (not Record/plain object) to structurally prevent prototype pollution via adversarial ticker strings (T-27-01 mitigation)"

patterns-established:
  - "Pattern 1 from 27-RESEARCH.md used verbatim as the etf-exclusion.ts implementation shape"

requirements-completed: [ETF-02]

coverage:
  - id: D1
    description: "filterEtfStocks excludes US ETF (SPY) and JP ETF (1306.T) via quoteType allowlist, independent of .T suffix"
    requirement: "ETF-02"
    verification:
      - kind: unit
        ref: "src/portfolio/etf-exclusion.test.ts#米国ETF（SPY: quoteType=ETF）は excluded に入り reason='etf' quoteType='ETF' を持つ（D-04）"
        status: pass
      - kind: unit
        ref: "src/portfolio/etf-exclusion.test.ts#日本ETF（1306.T: quoteType=ETF）は excluded に入り、日本個別株（7203.T: quoteType=EQUITY）は kept に残る（.T サフィックス非依存, D-04）"
        status: pass
    human_judgment: false
  - id: D2
    description: "filterEtfStocks keeps US equity (AAPL) and JP equity (7203.T) in kept array"
    requirement: "ETF-02"
    verification:
      - kind: unit
        ref: "src/portfolio/etf-exclusion.test.ts#米国個別株（AAPL: quoteType=EQUITY）は kept に残り excluded に入らない"
        status: pass
      - kind: unit
        ref: "src/portfolio/etf-exclusion.test.ts#日本個別株（7203.T: quoteType=EQUITY）は kept に残る"
        status: pass
    human_judgment: false
  - id: D3
    description: "filterEtfStocks fail-closed excludes tickers with missing or failed quoteType lookup (D-01)"
    requirement: "ETF-02"
    verification:
      - kind: unit
        ref: "src/portfolio/etf-exclusion.test.ts#quoteTypeByTicker に該当エントリが無い銘柄は excluded に入り reason='lookup-failed' を持つ（fail-closed, D-01）"
        status: pass
      - kind: unit
        ref: "src/portfolio/etf-exclusion.test.ts#status:'failed' の lookup を持つ銘柄も excluded reason='lookup-failed'（fail-closed, D-01）"
        status: pass
    human_judgment: false
  - id: D4
    description: "filterEtfStocks excludes all non-EQUITY quoteTypes (MUTUALFUND, INDEX) via allowlist, not a hardcoded denylist"
    requirement: "ETF-02"
    verification:
      - kind: unit
        ref: "src/portfolio/etf-exclusion.test.ts#quoteType が MUTUALFUND / INDEX の銘柄はすべて excluded reason='etf'（非EQUITY allowlist, D-04）"
        status: pass
    human_judgment: false
  - id: D5
    description: "filterEtfStocks does not mutate its input stocks array; kept/excluded reason breakdown correct on mixed input"
    requirement: "ETF-02"
    verification:
      - kind: unit
        ref: "src/portfolio/etf-exclusion.test.ts#呼び出し後、入力 stocks 配列が不変（イミュータビリティ）"
        status: pass
      - kind: unit
        ref: "src/portfolio/etf-exclusion.test.ts#EQUITY + ETF + lookup失敗を混ぜた入力で kept が EQUITY のみ・excluded が正しい reason 分けになる（混在ケース）"
        status: pass
    human_judgment: false

duration: 2min
completed: 2026-07-15
status: complete
---

# Phase 27 Plan 01: ETF Exclusion Pure Function Summary

**filterEtfStocks pure classification function (D-01 fail-closed + D-04 EQUITY allowlist) built via TDD, mirroring the urgency-history.ts pure-module pattern**

## Performance

- **Duration:** 2 min
- **Started:** 2026-07-15T01:23:17Z
- **Completed:** 2026-07-15T01:24:44Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- `filterEtfStocks` pure function built with zero I/O, no throw, immutable kept/excluded array construction
- `QuoteTypeLookup` discriminated union (`status: "ok"|"failed"`) cleanly separates "lookup failed" from "quoteType not EQUITY" per D-13 audit-log requirements
- `EtfExclusionResult` type exported for downstream Plan 02 (CLI wrapper) and Phase 28 (watchlist admission) reuse
- Full D-15 test matrix covered: US ETF (SPY), JP ETF (1306.T proving `.T` suffix independence), US equity (AAPL), JP equity (7203.T), lookup-missing, lookup-failed, non-EQUITY allowlist (MUTUALFUND/INDEX), immutability, and mixed-input classification

## Task Commits

Each task was committed atomically:

1. **Task 1: filterEtfStocks 純関数の失敗テストを先に作成する（RED）** - `1bf2115` (test)
2. **Task 2: etf-exclusion.ts 純関数を実装しテストをGREENにする** - `6aa86a7` (feat)

_TDD gate sequence verified: test(1bf2115) → feat(6aa86a7)._

## Files Created/Modified
- `src/portfolio/etf-exclusion.ts` - Pure function `filterEtfStocks`, `QuoteTypeLookup`/`EtfExclusionResult` types, `ALLOWED_QUOTE_TYPE` constant
- `src/portfolio/etf-exclusion.test.ts` - 9 unit tests covering D-15's full classification matrix + immutability

## Decisions Made
- Allowlist implemented strictly as `quoteType !== ALLOWED_QUOTE_TYPE` rather than a hardcoded denylist array, so any future/unknown Yahoo Finance `quoteType` value remains fail-closed (excluded) by default, consistent with D-01's safety-first philosophy
- `quoteTypeByTicker` parameter typed as `ReadonlyMap<string, QuoteTypeLookup>` rather than a plain object/Record, structurally preventing prototype-pollution via adversarial ticker strings like `"__proto__"` (mitigates threat T-27-01 from the plan's threat model)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. Both tasks completed on first attempt: RED confirmed via import-resolution failure (module not yet created), then GREEN confirmed with all 9 tests passing and zero regressions across the full 430-test suite (`npm test`).

## TDD Gate Compliance

RED gate: `1bf2115` (`test(27-01): add failing tests for filterEtfStocks (D-01/D-04)`) — confirmed RED via `Cannot find module './etf-exclusion.js'` import failure.
GREEN gate: `6aa86a7` (`feat(27-01): implement filterEtfStocks pure function (D-01/D-04)`) — confirmed GREEN, all 9 tests passing.
No REFACTOR commit was needed (implementation matched RESEARCH.md Pattern 1 verbatim on first pass, no cleanup required).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `filterEtfStocks`, `QuoteTypeLookup`, and `EtfExclusionResult` are ready for Plan 02 to import into `src/scripts/filter-etf-stocks.ts` (the fail-soft CLI wrapper that owns the batched `yahooFinance.quote()` call and `tmp/meeting-result.json` read/write)
- No blockers. This plan's scope was intentionally limited to the pure classification function per D-06's separation of concerns; CLI wiring and pipeline STEP-marker integration remain Plan 02's responsibility

---
*Phase: 27-etf-exclusion*
*Completed: 2026-07-15*

## Self-Check: PASSED

- FOUND: src/portfolio/etf-exclusion.ts
- FOUND: src/portfolio/etf-exclusion.test.ts
- FOUND: .planning/phases/27-etf-exclusion/27-01-SUMMARY.md
- FOUND commit: 1bf2115
- FOUND commit: 6aa86a7

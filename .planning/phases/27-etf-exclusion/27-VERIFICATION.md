---
phase: 27-etf-exclusion
verified: 2026-07-15T11:00:00Z
status: human_needed
score: 4/4 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "翌営業日の launchd 実行後、tmp/round-1/*.json の picks と tmp/meeting-result.json の highlightedStocks に ETF が含まれないことを確認する"
    expected: "全アナリストの picks、モデレーターの highlightedStocks いずれにも ETF/投信/インデックスファンドのtickerが含まれない"
    why_human: "LLM出力（Layer 1プロンプト効果）は静的検証不能。実際のライブパイプライン実行が必要"
  - test: "翌営業日の launchd ログで [STEP:etf-exclusion:OK]（または FAIL の場合の fail-soft継続）を確認する"
    expected: "filter-etf-stocks.ts が validate-meeting.ts の直前に実行され、STEPマーカーが出力される。失敗時も [PIPELINE:FAIL] は出力されず後続ステップが継続する"
    why_human: "パイプライン統合の実行順序・fail-soft継続はライブ実行でのみ確認可能（ユニットテストはCLIロジックをモック環境で検証済みだが、invest.md からの実呼び出しは未検証）"
---

# Phase 27: ETF Exclusion Verification Report

**Phase Goal:** アナリストが推奨する銘柄候補（picks / highlightedStocks）からETFが構造的に排除され、ウォッチリストや各レポートのハイライト銘柄に一切ETFが混入しない
**Verified:** 2026-07-15T11:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth (Roadmap Success Criteria) | Status | Evidence |
|---|---------|--------|----------|
| 1 | 全5アナリストエージェントのプロンプトに、ETFを推奨銘柄（picks）から除外する明示的指示が含まれている | VERIFIED | `grep -c "ETF・投資信託・インデックスファンド（例: SPY, QQQ, 1306.T等）は picks に含めないこと" .claude/commands/invest.md` == 5 (invest.md:191,237,283,329,375). Placement confirmed directly after existing "注意: picksのtickerは必ず英数字ティッカー形式" line in each of the 5 analyst blocks (fundamentals, ten-bagger, macro, technical, risk) without altering that existing line (still 5 occurrences) |
| 2 | meeting-result確定後、TS側で`yahoo-finance2`の`quote().quoteType`照合により、米国ETF・日本ETF両方がhighlightedStocksから決定論的に除外される | VERIFIED | `src/portfolio/etf-exclusion.ts`: `ALLOWED_QUOTE_TYPE = "EQUITY"` allowlist (line 29), `filterEtfStocks` excludes any `quoteType !== "EQUITY"` with `reason: "etf"` (lines 55-58). `src/scripts/filter-etf-stocks.ts`: single batch `await yahooFinance.quote([...tickers])` call (line 27), never per-ticker. Unit tests confirm SPY (US ETF) and 1306.T (JP ETF) both excluded, AAPL/7203.T (equities) kept, independent of `.T` suffix |
| 3 | 個別銘柄のquoteType lookupに失敗した場合でもパイプラインがthrowせず、安全側（除外）で処理が継続する | VERIFIED | `filterEtfStocks` fail-closed excludes on missing map entry or `status:"failed"` (etf-exclusion.ts:50-54, `reason: "lookup-failed"`). CLI wraps all I/O in try/catch with no throw path reaching the entry-point guard's `.catch` under normal failure modes; `main()` sets `process.exitCode=1` and returns early, never calling `writeFile`, preserving the original file (D-02 fail-soft). Code-review WR-01 (malformed `highlightedStocks` bypassing try/catch — `TypeError` risk) and WR-02 (empty batch-quote response conflated with fail-closed, silently emptying `highlightedStocks`) were both flagged in 27-REVIEW.md and are **confirmed present as fixes in the current codebase**: `Array.isArray(meetingResult.highlightedStocks)` guard at filter-etf-stocks.ts:63-72, and `quoteTypeByTicker.size === 0` mechanism-failure guard at filter-etf-stocks.ts:93-104 (commit `8f4d2ac`, verified via `git log` and direct file read — not just SUMMARY claim) |
| 4 | 除外ロジックの単体テストが米国ETF・日本ETF・個別株それぞれの分類を正しく検証している | VERIFIED | `src/portfolio/etf-exclusion.test.ts`: 9 tests (`grep -c "  it("` == 9) covering US ETF/JP ETF/US equity/JP equity/lookup-missing/lookup-failed/non-EQUITY allowlist/immutability/mixed-input. `src/scripts/filter-etf-stocks.test.ts`: 9 tests (Test A–G plus 2 review-fix regression tests) covering fail-soft/fail-closed/partial-continuation/rewrite/audit-log/single-batch. Full suite run directly by verifier (not trusting SUMMARY claim): `npx vitest run` → **439/439 tests passing, 27 test files** |

**Score:** 4/4 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/portfolio/etf-exclusion.ts` | Pure function `filterEtfStocks`, `QuoteTypeLookup`/`EtfExclusionResult` types, zero I/O | VERIFIED | Exists, substantive (64 lines, real allowlist logic, no stubs), no try/catch/throw (pure), exported and wired (imported by filter-etf-stocks.ts) |
| `src/portfolio/etf-exclusion.test.ts` | 5-category unit test coverage + immutability | VERIFIED | Exists, 9 `it()` blocks, uses `new Map` (ReadonlyMap pattern), all 9 passing |
| `src/scripts/filter-etf-stocks.ts` | Fail-soft CLI wrapper: network + file I/O, imports Plan 01's filterEtfStocks | VERIFIED | Exists, substantive (129 lines), imports `filterEtfStocks` from `../portfolio/etf-exclusion.js`, entry-point guard present, both WR-01/WR-02 review fixes present in code |
| `src/scripts/filter-etf-stocks.test.ts` | fail-soft/fail-closed/partial-failure/rewrite verification with yahoo-finance2 + fs/promises mocks | VERIFIED | Exists, 9 `it()` blocks (Test A–G + 2 review-fix tests), `vi.mock` used for both yahoo-finance2 and fs/promises, `try/finally` present for `process.exitCode` restoration (IN-04 also fixed) |
| `.claude/commands/invest.md` (edited) | Step 2a 5-block + Step 2f + Step 2g wiring | VERIFIED | 5 analyst blocks confirmed (line 191/237/283/329/375), moderator block confirmed (line 1082), Step 2g wiring confirmed (filter-etf-stocks.ts at line 1173, before validate-meeting.ts at line 1197) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `filter-etf-stocks.ts` | `etf-exclusion.ts` | `import { filterEtfStocks } from "../portfolio/etf-exclusion.js"` | WIRED | Confirmed at filter-etf-stocks.ts:5, called at line 106 with real `quoteTypeByTicker` from `fetchQuoteTypes()` |
| `invest.md` Step 2g | `filter-etf-stocks.ts` | `cd /Users/arai/invest && npx tsx src/scripts/filter-etf-stocks.ts` | WIRED | invest.md:1173, positioned before validate-meeting.ts (line 1197) via awk line-order check |
| `invest.md` Step 2g | STEP marker output | `[STEP:etf-exclusion:OK]` / `[STEP:etf-exclusion:FAIL:<reason>]` | WIRED | invest.md:1183, 1189 both present; `[PIPELINE:FAIL]` explicitly prohibited in prose at line 1192 |
| `filter-etf-stocks.ts` | `tmp/meeting-result.json` | `readFile`/`writeFile` with `updated = {...meetingResult, highlightedStocks: kept}` | WIRED | Schema-preserving rewrite confirmed (line 118), write only reached after successful read + successful batch quote (D-09/D-02 structural guarantee) |

### Data-Flow Trace (Level 4)

Not applicable in the traditional UI-rendering sense (no dynamic-data component in this phase). The equivalent trace for a CLI/pipeline phase is: `tmp/meeting-result.json` (LLM-generated highlightedStocks) → `fetchQuoteTypes()` (real yahoo-finance2 batch API call, not a static stub — confirmed no hardcoded/static quote responses in production code) → `filterEtfStocks()` (real classification, not a passthrough) → `writeFile` back to the same schema-preserving path. Data flow confirmed genuine at each hop; no disconnected/hollow props found.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full unit test suite passes (439/439 claimed in SUMMARY/task prompt) | `npx vitest run` (run once, directly by verifier) | `Test Files 27 passed (27)`, `Tests 439 passed (439)` | PASS |
| `etf-exclusion.test.ts` test count matches plan's 9-test requirement | `grep -c "  it(" src/portfolio/etf-exclusion.test.ts` | `9` | PASS |
| `filter-etf-stocks.test.ts` test count | `grep -c "  it(" src/scripts/filter-etf-stocks.test.ts` | `9` | PASS |
| No pre-existing type errors introduced by this phase's files | `npx tsc --noEmit \| grep -E "etf-exclusion\|filter-etf-stocks"` | no output (no matches) | PASS |

### Probe Execution

Not applicable — no `scripts/*/tests/probe-*.sh` convention used in this project; phase's own verification relies on vitest + grep/awk static checks as declared in PLAN frontmatter, all of which were re-run directly above.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| ETF-01 | 27-03-PLAN.md | アナリストの推奨銘柄からETFを除外するプロンプト指示が全アナリストエージェントに適用される | SATISFIED | 5 analyst blocks + moderator block confirmed in invest.md (Truth #1 above) |
| ETF-02 | 27-01, 27-02, 27-03 PLAN.md | meeting-result確定後、TS側でquoteType照合によりETFを決定論的に除外（米国・日本両対応、lookup失敗時fail-closed） | SATISFIED | `etf-exclusion.ts` + `filter-etf-stocks.ts` + Step 2g wiring, all confirmed (Truths #2/#3 above) |

No orphaned requirements: `.planning/REQUIREMENTS.md` maps exactly ETF-01 and ETF-02 to Phase 27, both declared in PLAN frontmatter (27-01/27-02 declare `[ETF-02]`, 27-03 declares `[ETF-01, ETF-02]`), both marked `Complete` in the REQUIREMENTS.md phase-status table.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | none found | — | `grep -E "TBD\|FIXME\|XXX"` and `grep -E "TODO\|HACK\|PLACEHOLDER"` return zero matches across all 4 phase-27 files (etf-exclusion.ts/.test.ts, filter-etf-stocks.ts/.test.ts) |

Code review (27-REVIEW.md) identified 2 warnings (WR-01, WR-02) — both confirmed fixed in the current codebase (commit `8f4d2ac`, verified directly by reading the file, not the SUMMARY's claim). 4 info-level findings (IN-01 ticker case-normalization, IN-02 macro-analyst analysis-template wording, IN-03 `validateResult` schema-strictness, IN-04 test exitCode restoration) remain — IN-04 was also fixed (try/finally present in filter-etf-stocks.test.ts:210-248). IN-01/IN-02/IN-03 are explicitly info-level (not warning/critical), non-blocking per the review's own disposition, and orthogonal to the roadmap Success Criteria — they do not gate phase completion.

### Human Verification Required

### 1. Live pipeline prompt-layer effect (ETF-01, Layer 1)

**Test:** After the next scheduled launchd run (next business day), inspect `tmp/round-1/*.json` picks and `tmp/meeting-result.json` highlightedStocks.
**Expected:** No ETF/mutual-fund/index-fund tickers appear in any analyst's picks or in the moderator's highlightedStocks.
**Why human:** LLM prompt-following behavior cannot be statically verified — this is the explicitly-acknowledged Layer 1 (best-effort) half of the two-layer defense; Layer 2 (deterministic TS filter) is what structurally guarantees the phase goal regardless of Layer 1's outcome.

### 2. Live pipeline wiring / STEP marker output (ETF-02, Layer 2 integration)

**Test:** After the next scheduled launchd run, check the log for `[STEP:etf-exclusion:OK]` (or a `FAIL:<reason>` variant with fail-soft continuation, never `[PIPELINE:FAIL]`).
**Expected:** `filter-etf-stocks.ts` executes before `validate-meeting.ts` in the real pipeline invocation (not just in the invest.md source text), and the STEP marker reflects the actual run outcome.
**Why human:** Unit tests mock yahoo-finance2 and fs/promises — they verify the CLI script's internal logic correctly, but the actual invocation from within a live Claude Code pipeline run (invest.md prose being followed by an LLM at Step 2g) is inherently a runtime behavior that only a real pipeline execution can confirm.

### Gaps Summary

No gaps found. All 4 roadmap Success Criteria are verified against the actual codebase (not SUMMARY claims): source code was read directly, the two code-review warnings (WR-01/WR-02) were independently confirmed present as fixes by reading `filter-etf-stocks.ts` at the cited line numbers, git log confirms the fix commit `8f4d2ac` exists in history, and the full 439-test suite was re-run directly by the verifier (not accepted from SUMMARY text) and passed. The phase's own 27-VALIDATION.md explicitly and correctly scopes live-pipeline behavior as Manual-Only (not automatable), which is why overall status is `human_needed` rather than `passed` — this reflects the two human-verification items above, not any deficiency in the implementation.

---

_Verified: 2026-07-15T11:00:00Z_
_Verifier: Claude (gsd-verifier)_

---
phase: 25-urgency-history-persistence
verified: 2026-07-04T12:30:00Z
status: passed
score: 3/3 must-haves verified
overrides_applied: 0
---

# Phase 25: Urgency History Persistence Verification Report

**Phase Goal:** 保有銘柄の緊急度フラグと判断が、日次実行のたびに監査可能な履歴としてリポジトリ内に永続化され、同日の再実行によって履歴が壊れない
**Verified:** 2026-07-04T12:30:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | パイプライン実行後、data/urgency-history.json に当日の日付キーで保有12銘柄それぞれの urgent フラグと decision が記録される | VERIFIED | `src/portfolio/urgency-history.ts` `extractUrgencySnapshots` maps every holding to `{symbol, nameJa, urgent, decision}` (includes `urgent:false`, symbol normalized via `normalizeHoldingSymbol`). `src/scripts/write-urgency-history.ts` `main()` reads `tmp/portfolio-analysis.json`, calls `extractUrgencySnapshots`, sources `dateKey` from `tmp/meeting-result.json`'s `.date`, and writes `data/urgency-history.json` via `writeFile(HISTORY_PATH, JSON.stringify(updated, null, 2))`. Test `write-urgency-history.test.ts` Test 1 asserts the written `"2026-07-04"` key has length 12. |
| 2 | data/urgency-history.json は git commit/push フローに含まれ、非公開の data/（docs/ ではない）に永続化される | VERIFIED | `.claude/commands/invest.md` Step 4 deploy block: `if (!fs.existsSync('data')) fs.mkdirSync('data', { recursive: true }); execSync('git add docs/ data/', { stdio: 'inherit' });` — stages `data/` into the same commit/push as `docs/`. `.gitignore` only ignores `tmp/` (line 28), not `data/` — confirmed by reading full `.gitignore` (no `data/` entry). Path is `data/urgency-history.json` (private), distinct from `docs/` (public GitHub Pages). |
| 3 | 同日中に複数回実行しても同日エントリは重複追加されず上書きされる | VERIFIED | `appendUrgencySnapshot` returns `{ ...history, [dateKey]: snapshots }` — object-key assignment structurally prevents duplication (second call for same key replaces value, `Object.keys` length stays 1). Unit test `appendUrgencySnapshot (D-04)` "同一 dateKey で2回呼ぶと2回目のスナップショットのみが残る" asserts this directly. CLI-level test `write-urgency-history.test.ts` Test 2 ("同日上書き") confirms the same behavior reaches disk: existing history with `"2026-07-04": [oldSnapshot]` is overwritten with new 12-snapshot array, old snapshot absent, single key. |

**Score:** 3/3 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/portfolio/urgency-history.ts` | Pure functions extractUrgencySnapshots, appendUrgencySnapshot, isValidDateKey + types | VERIFIED | All 3 functions + 2 types exported exactly as specified. No I/O imports, no throw, no console.log. `isValidDateKey` uses `/^\d{4}-\d{2}-\d{2}$/`, identical to invest.md Step 4's validation regex. |
| `src/portfolio/urgency-history.test.ts` | Unit tests for HIST-01/HIST-02 pure-function behavior | VERIFIED | 15 tests across 3 describe blocks, covering extraction shape, urgent:false retention, multi-holding, symbol normalization, immutability (both functions), same-day overwrite, cross-date preservation, and `__proto__` rejection. |
| `src/scripts/write-urgency-history.ts` | Fail-soft CLI wrapper: reads tmp inputs, merges via pure functions, writes data/urgency-history.json | VERIFIED | `main()` exported; `mkdir(DATA_DIR, {recursive:true})` is the unconditional first statement; dateKey sourced from `meeting-result.json`; D-13 skip, D-14 corrupted-preserve, D-06 invalid-date branches all present and gate `writeFile`. |
| `src/scripts/write-urgency-history.test.ts` | vi.mock('node:fs/promises') tests for normal/skip/corrupted/invalid-date paths | VERIFIED | 7 tests: normal write (12 holdings), same-day overwrite, ENOENT skip, empty-holdings skip, corrupted preserve (exit 1), invalid dateKey (exit 1), mkdir-called-first ordering. |
| `.claude/commands/invest.md` | Step 3f pipeline step + Step 4 git add extension | VERIFIED | `### Step 3f: 緊急度履歴の追記` present between Step 3e and Step 4; runs `npx tsx src/scripts/write-urgency-history.ts`; emits `[STEP:urgency-history:OK]` / `[STEP:urgency-history:FAIL:...]`; explicit `[PIPELINE:FAIL] は絶対に出力しないこと` note. Step 4 contains `existsSync('data')` guard + `git add docs/ data/`. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `src/portfolio/urgency-history.ts` | `src/portfolio/holding-news.ts` | `import normalizeHoldingSymbol` | WIRED | `import { normalizeHoldingSymbol } from "./holding-news.js";` at top of file; called inside `extractUrgencySnapshots`. |
| `src/scripts/write-urgency-history.ts` | `src/portfolio/urgency-history.ts` | import extract/append/isValidDateKey | WIRED | `import { extractUrgencySnapshots, appendUrgencySnapshot, isValidDateKey } from "../portfolio/urgency-history.js";` all three used in `main()`. |
| `src/scripts/write-urgency-history.ts` | `tmp/meeting-result.json` | dateKey source | WIRED | `readFile(join(TMP_DIR, "meeting-result.json"), ...)` → `{ date: dateKey }`; NOT sourced from `portfolioAnalysis.date` (matches D-05/Pitfall 2 requirement). |
| `.claude/commands/invest.md` | `data/` | `git add docs/ data/` | WIRED | Confirmed by direct read of Step 4 block; `existsSync('data')` guard precedes it. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `write-urgency-history.ts` `main()` | `snapshots` | `extractUrgencySnapshots(analysis)` where `analysis` = `JSON.parse(readFile(tmp/portfolio-analysis.json))` | Yes — reads the actual pipeline-generated analysis artifact, no static/hardcoded fallback | FLOWING |
| `write-urgency-history.ts` `main()` | `dateKey` | `JSON.parse(readFile(tmp/meeting-result.json)).date` | Yes — real upstream pipeline artifact, validated via `isValidDateKey` before use | FLOWING |
| `write-urgency-history.ts` `main()` | `updated` (written to disk) | `appendUrgencySnapshot(existingHistory, dateKey, snapshots)` | Yes — merges real existing file content (or `{}` on legitimate ENOENT) with real new snapshots | FLOWING |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| HIST-01 | 25-01, 25-02 | 日次実行ごとに保有銘柄の緊急度フラグ（urgent）と判断（decision）が data/urgency-history.json に追記保存され、git commit/push フローで永続化される | SATISFIED | extractUrgencySnapshots + write-urgency-history.ts writeFile + invest.md Step 4 git add docs/ data/. No orphaned scope — REQUIREMENTS.md marks HIST-01 `[x]` and traceability table lists "Phase 25 | Complete". |
| HIST-02 | 25-01, 25-02 | 同日に複数回実行しても履歴が重複しない（同日エントリは上書き） | SATISFIED | appendUrgencySnapshot object-key spread + unit test + CLI-level same-day overwrite test (Test 2). REQUIREMENTS.md marks HIST-02 `[x]` and "Phase 25 | Complete". |

No orphaned requirements found — REQUIREMENTS.md maps only HIST-01/HIST-02 to Phase 25, and both are declared in both plans' frontmatter `requirements:` field.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/portfolio/urgency-history.ts:27-36` (via `holding-news.ts` `.trim()`) | — | `extractUrgencySnapshots` can throw a `TypeError` if a holding lacks a string `symbol` (contradicts its "no-throw" doc comment) | INFO (advisory, from 25-REVIEW.md WR-01) | Does not break any Success Criterion under normal pipeline operation (portfolio-analysis.json is self-generated and always has valid `symbol` fields in practice). On malformed input, the failure surfaces as a generic `Fatal error:` exit 1 via the top-level `main().catch()` handler rather than the documented `[urgency-history] FAIL:` signal — Step 3f still correctly treats any non-zero exit as fail-soft (does not halt pipeline), just with a less-specific log message. Not a goal blocker. |
| `src/scripts/write-urgency-history.ts:63-64` | — | `meeting-result.json` read/parse is unguarded (no try/catch), unlike the other two reads | INFO (advisory, from 25-REVIEW.md WR-02) | Same fail-soft-signal-quality issue as above — a missing/corrupt `meeting-result.json` still exits non-zero and existing history is preserved (no data loss), it just prints `Fatal error:` instead of `[urgency-history] FAIL:`. Step 3f's fail-soft contract (never emit `[PIPELINE:FAIL]`, always proceed to Step 4) is unaffected since it only depends on exit code, not message content. Not a goal blocker. |

No blocker-level anti-patterns (no TBD/FIXME/XXX, no unreferenced debt markers, no console.log, no in-place mutation, no hardcoded empty stub returns) found in any of the 5 files reviewed.

### Human Verification Required

None. All 3 Success Criteria are structurally verified via code inspection + passing unit/integration tests. The end-to-end "next real pipeline run persists and commits data/urgency-history.json" behavior is inherently a runtime/production concern (the file legitimately does not exist yet on disk since Step 3f has not executed in production), but this is expected per 25-02-SUMMARY.md's own "Next Phase Readiness" note and does not block verification — the wiring, git-add staging, and fail-soft contract are all confirmed present and correct in the source.

### Gaps Summary

No gaps. All 3 ROADMAP Success Criteria verified against actual source code (not SUMMARY.md claims). Both HIST-01 and HIST-02 requirements satisfied. Full test suite green: 331/331 tests passing (`npx vitest run`), matching the SUMMARY.md claim exactly. The two advisory warnings from 25-REVIEW.md (WR-01, WR-02) concern fail-soft signal-message quality on malformed/adversarial input edge cases, not the three Success Criteria — they do not prevent the goal from being achieved under normal pipeline operation and are appropriately left as advisory (not re-litigated as blockers here per the phase's own code-review disposition of 0 critical / 2 warning / 4 info, all warnings, no criticals).

---

_Verified: 2026-07-04T12:30:00Z_
_Verifier: Claude (gsd-verifier)_

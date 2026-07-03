---
phase: 22-portfolio-analyst-re-evaluation
verified: 2026-07-03T21:30:00Z
status: human_needed
score: 10/10 automatable must-haves verified
overrides_applied: 0
human_verification:
  - test: "ライブパイプライン実行後、保有銘柄別リサーチ結果・関連ニュースが存在する銘柄の rationale を目視確認する"
    expected: "rationale がその具体的内容（材料名）に明示的に言及している（PORT-03、22-02 の rationale 明示言及指示が実際の LLM 出力に反映されているか）"
    why_human: "LLM散文出力の内容品質は静的解析・grep では判定不能。invest.md のプロンプト指示（1784行）はテキストとして存在するが、実際に portfolio-analyst が指示に従うかはライブラン結果でしか確認できない"
  - test: "ライブパイプライン実行時に tmp/portfolio-research/・tmp/prev-portfolio-analysis.json の有無に応じて invest.md Step 3d の条件付きセクション（保有銘柄別リサーチ結果／前日の判断）が正しく出現・省略されるか確認する"
    expected: "ディレクトリ/ファイルが存在する日は該当セクションが含まれ、存在しない日（初回実行等）は該当セクション全体が省略される"
    why_human: "invest.md は markdown プロンプトで vitest ハーネス外。条件分岐の実行時解釈は Claude Code のプロンプト実行結果でしか検証できない"
  - test: "複数日（3日以上）レポートを観測し、decisionChanged===true の比率が全銘柄で常時 false（0%）になっていないか確認する"
    expected: "妥当な範囲で decisionChanged が true になるケースが時々発生する（全銘柄常時 false はアンカリングバイアスにより前日判断へ引きずられている疑いを示す、D-07）"
    why_human: "単発テストでは検証不能。複数日分のライブ実行データの傾向観測が必要"
---

# Phase 22: Portfolio-Analyst Re-Evaluation Verification Report

**Phase Goal:** 保有銘柄の売却・保有判断が、ニュース・リサーチ結果を踏まえた再考であることがレポート上で確認でき、重大材料と前日からの判断変化が視覚的に強調される
**Verified:** 2026-07-03T21:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 (ROADMAP SC1) | 保有銘柄に関連ニュース・リサーチ結果が存在する場合、rationaleがその内容へ明示的に言及している | ✓ VERIFIED (contract) / ? UNCERTAIN (live behavior) | invest.md:1784 の明示言及指示 + 1807行の rationale 300文字化・言及指示は静的に確認済み。実際の LLM 出力内容は human verification item #1 で追跡 |
| 2 (ROADMAP SC2) | 重大材料検知銘柄に urgent フラグが付与され、カード上に赤/アンバー系の視覚的強調として表示される | ✓ VERIFIED | `src/meeting/schemas.ts:191-229` urgent 4-alias absorb + lenientBoolean + default false。`src/scripts/generate-portfolio-report.ts:48-51` `formatUrgentBadgeHtml` が背景色 `#ef4444`（赤）の `⚠ 緊急` ピルを描画。Test 40 で `toContain("⚠ 緊急")` / `toContain("#ef4444")` 確認 |
| 3 (ROADMAP SC3) | 前日スナップショットとの差分がTS側で決定論的に計算され（LLM自己申告ではない）、判断変化銘柄にバッジが表示される | ✓ VERIFIED | `src/portfolio/decision-diff.ts` `attachDecisionChanges` は decision enum の厳密等値比較のみ（LLM出力の decisionChanged は schemas.ts の explicit object literal で strip 済み、`...raw` 不使用）。`generate-report.ts:137-145` で main() に配線済み。`generate-portfolio-report.ts:58-65` `formatDecisionChangedBadgeHtml` がアンバー `#f59e0b` バッジを描画。Test 41-42 で true/undefined 分岐確認 |
| 4 (22-01) | HoldingEvaluation型がurgent（必須）・previousDecision?・decisionChanged?を持つ | ✓ VERIFIED | `src/meeting/types.ts:121,126,131` — `readonly urgent: boolean`、`readonly previousDecision?`、`readonly decisionChanged?` |
| 5 (22-01) | LLM出力のdecisionChanged/previousDecisionがスキーマtransformでstripされる | ✓ VERIFIED | `schemas.ts:216-224` transform の return は explicit object literal（`...raw`なし）。`schemas.test.ts:506-513`, `582行`(fail-soft経路含む)で strip テスト green |
| 6 (22-02) | Step 3d冒頭で前日データが上書き前にprev-portfolio-analysis.jsonへ退避される | ✓ VERIFIED | `invest.md:1699-1719` — node -e スニペットが読み込みリスト(1721行)より前・Step3d見出し(1683行)より後に位置。try/catchでスキップ、同日ガード付き（WR-02後付） |
| 7 (22-02) | リサーチ結果セクション（keyArticles非注入・全12銘柄列挙）が条件付きで含まれる | ✓ VERIFIED | `invest.md:1767-1774` — `## 保有銘柄別リサーチ結果` 見出し、researchSummary/positiveFindings/negativeFindingsのみ、keyArticles除外指示、プロンプトインジェクション注意書きあり |
| 8 (22-02) | 前日判断セクションが末尾・independent-then-compare構成で含まれる | ✓ VERIFIED | `invest.md:1786-1791` — 判断基準(1776行)の後・JSONフォーマット指示(1793行)の前に配置。「まず本日の材料のみに基づいて...独立に判断」文言あり |
| 9 (22-03) | attachDecisionChangesが決定論的にdecisionChangedを計算し、prev null/銘柄不一致でundefined(false と区別) | ✓ VERIFIED | `decision-diff.ts:19-40`。6テスト全green（`decision-diff.test.ts`）、normalizeHoldingSymbol経由のキー一致、当日ループ駆動 |
| 10 (22-04) | loadPrevPortfolioAnalysis fail-soft + console.warn、main()配線、Pitfall7 backfill、バッジ描画、border-left維持 | ✓ VERIFIED | `report-data-loaders.ts:93-103`（console.warn）、`generate-report.ts:100-145`（配線+resolvePrevHoldingsForDiff同日ガード）、`generate-portfolio-report.ts:47-82`（バッジ+border-left不変）。全117関連テスト green、フルスイート286/286 green |

**Score:** 10/10 automatable truths verified. 1 truth (#1, PORT-03 rationale content quality) has its static/contract layer verified but its live-LLM-output layer routed to human verification.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/meeting/types.ts` | HoldingEvaluation + urgent/previousDecision/decisionChanged | ✓ VERIFIED | Lines 121, 126, 131 |
| `src/meeting/schemas.ts` | urgent alias hardening + strip + per-holding fail-soft | ✓ VERIFIED | Lines 191-282; includes WR-01 post-review fix (lenientBoolean, lenientHoldingsSchema) |
| `src/meeting/schemas.test.ts` | holdingEvaluationSchema test block | ✓ VERIFIED | `describe("holdingEvaluationSchema")` at line 473, 10+ test cases incl. WR-01 fail-soft cases |
| `.claude/commands/invest.md` | Step 3d prev snapshot + 2 sections + urgent contract | ✓ VERIFIED | Lines 1699-1832; includes WR-02 post-review same-day JST guard |
| `src/portfolio/decision-diff.ts` | attachDecisionChanges pure function | ✓ VERIFIED | Exports `attachDecisionChanges`, 40 lines, imports `normalizeHoldingSymbol` |
| `src/portfolio/decision-diff.test.ts` | Full case coverage | ✓ VERIFIED | 6 tests, all green |
| `src/scripts/report-data-loaders.ts` | loadPrevPortfolioAnalysis | ✓ VERIFIED | Exported, console.warn fail-soft (line 93-103); WR-03 post-review adds console.warn to loadRound1/2/3 catches (lines 23, 47, 71) |
| `src/scripts/generate-report.ts` | prev parallel load + attachDecisionChanges wiring + Pitfall7 backfill | ✓ VERIFIED | 10-item Promise.all (line 132), enrichedPortfolioAnalysis assembly (137-145), console.warn backfill (lines 37, 60); WR-02 adds `resolvePrevHoldingsForDiff` (line 100-119) |
| `src/scripts/generate-portfolio-report.ts` | formatUrgentBadgeHtml / formatDecisionChangedBadgeHtml | ✓ VERIFIED | Lines 47-65, wired into `<h4>` output (lines 79-83), border-left untouched |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `schemas.ts` transform | `types.ts` HoldingEvaluation | explicit object literal output shape | ✓ WIRED | `urgent` present in return; `decisionChanged`/`previousDecision` absent (strip) |
| `invest.md` Step 3d snippet | `tmp/prev-portfolio-analysis.json` | node -e writeFileSync (pre-overwrite) | ✓ WIRED | Positioned before Read-list; same-day JST guard added |
| `invest.md` research section | `tmp/portfolio-research/{symbol}.json` | conditional Read→embed | ✓ WIRED | keyArticles excluded, all 12 symbols enumerated |
| `decision-diff.ts` | `holding-news.ts` normalizeHoldingSymbol | import (not reimplemented) | ✓ WIRED | `import { normalizeHoldingSymbol } from "./holding-news.js"` |
| `generate-report.ts main()` | `decision-diff.ts attachDecisionChanges` | enrichedPortfolioAnalysis assembly | ✓ WIRED | Line 141-144, fed `resolvePrevHoldingsForDiff` output |
| `generate-portfolio-report.ts formatHoldingEvaluationsHtml` | `h.urgent`/`h.decisionChanged`/`h.previousDecision` | badge rendering via escapeHtml | ✓ WIRED | Lines 79-83; escapeHtml confirmed on previousDecision/decision in badge string |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `formatHoldingEvaluationsHtml` badges | `h.urgent`, `h.decisionChanged`, `h.previousDecision` | `enrichedPortfolioAnalysis.holdings` ← `attachDecisionChanges(portfolioAnalysis.holdings, resolvePrevHoldingsForDiff(...))` ← `loadPortfolioAnalysis()` (today, schema-validated, LLM JSON) + `loadPrevPortfolioAnalysis()` (yesterday, schema-validated, file-based) | Yes — both loaders parse real JSON files via `portfolioAnalysisSchema`; `attachDecisionChanges` computes from real enum comparison, not static/empty fallback | ✓ FLOWING |
| `invest.md` rationale content | LLM free-text `rationale` field | portfolio-analyst prompt embeds real `tmp/holding-news.json` + `tmp/portfolio-research/*.json` content (not hardcoded) | Prompt-level: Yes (real file content embedded). LLM-adherence: unverified statically | ⚠️ STATIC (contract) / human-verify (adherence) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| PORT-03 | 22-02 | rationale がニュース・リサーチへ明示言及 | ? NEEDS HUMAN (contract verified, live output unverified) | invest.md rationale instruction present; LLM adherence is a human verification item |
| PORT-04 | 22-01, 22-02 | 重大材料検知銘柄への urgent フラグ付与 | ✓ SATISFIED | urgent type + alias-transform + prompt contract + prompt anti-abuse instruction all present and tested |
| PORT-05 | 22-01, 22-02, 22-03, 22-04 | 前日判断のTS側決定論的差分検出（LLM自己申告でない） | ✓ SATISFIED | Full chain verified: schema strip → prompt snapshot injection → attachDecisionChanges pure function → main() wiring |
| UI-07 | 22-04 | 緊急度フラグの視覚的強調 + 変化バッジ | ✓ SATISFIED | Red/amber badges rendered and tested (Test 40-43), border-left preserved |

**Note (documentation gap, non-blocking):** `.planning/REQUIREMENTS.md` still shows `PORT-04`, `PORT-05`, and `UI-07` as unchecked (`[ ]`) with traceability status "Pending" (lines 18-19, 25, 65-66, 69). This text was written by commit `744a424` mid-phase (after only 22-02 had landed) and was never updated after 22-01/22-03/22-04 completed, even though `.planning/ROADMAP.md` correctly marks Phase 22 and all 4 of its plans `[x]` complete. This is a documentation-tracking gap, not a code/functionality gap — all four requirement IDs are fully satisfied by code evidence above. Recommend updating REQUIREMENTS.md checkboxes and traceability table as a follow-up (does not block this phase).

### Anti-Patterns Found

No blocking anti-patterns. No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers found in any of the 11 files modified by this phase.

Non-blocking info items (already documented and accepted in `22-REVIEW.md`, not re-litigated here):
- IN-01: `loadNewsPool`/`loadHoldingNews` unguarded type assertions (pre-existing, low risk, out of phase scope)
- IN-02: duplicate `style` attribute in `formatNewCandidatesHtml` header cells (pre-existing display bug, out of phase scope — will be moot after Phase 23 removes the section)
- IN-03: 12-symbol holdings list triple-hardcoded in invest.md + holdings.ts (pre-existing maintenance debt)
- IN-04: `urgent: true` → riskNote required only by prompt convention, not schema-enforced (accepted risk, prompt instruction present at invest.md:1818)
- IN-05: prev holding missing `decision`/`action` defaults to "保持" and could theoretically fabricate a changed badge (low probability given alias coverage + prompt discipline)

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full test suite green | `npm test` | 286/286 passed, 17 files | ✓ PASS |
| Scoped test files green | `npx vitest run src/meeting/schemas.test.ts src/portfolio/decision-diff.test.ts src/scripts/report-data-loaders.test.ts src/scripts/generate-report.test.ts` | 117/117 passed, 4 files | ✓ PASS |
| Post-review fix commits present in git log | `git log --oneline` | `5f13df4` (WR-01), `bee5303` (WR-02), `393f5b0` (WR-03) all present | ✓ PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` files found and no probe references in PLAN/SUMMARY files for this phase. Step 7c: SKIPPED (no probes declared or found).

### Human Verification Required

### 1. rationale の実際のニュース・リサーチ言及品質（PORT-03 ライブ動作）

**Test:** 通常のパイプライン実行（invest.md）を1回実行し、生成された `docs/{date}/portfolio-report.html` を開いて、`tmp/holding-news.json` または `tmp/portfolio-research/{symbol}.json` に実データがある銘柄の rationale を確認する。
**Expected:** その銘柄の rationale が、関連ニュース・リサーチの具体的な材料名（決算内容、訴訟名、規制変更内容など）に言及している。ニュース・リサーチが存在しない銘柄は、既存材料のみで判断し、存在しない情報への言及がない。
**Why human:** LLM自由テキスト出力の内容品質判定は静的解析・grepでは不可能。プロンプト契約（invest.md:1784）は確認済みだが、実際の遵守はライブラン結果でしか確認できない。

### 2. invest.md 条件付きセクションの実行時分岐動作

**Test:** `tmp/portfolio-research/` ディレクトリと `tmp/prev-portfolio-analysis.json` が (a) 両方存在する日、(b) 両方存在しない日（例: 初回実行）の2パターンでパイプラインを実行し、portfolio-analyst への実際のプロンプト内容（またはその出力傾向）を確認する。
**Expected:** (a) では「## 保有銘柄別リサーチ結果」と「## 前日の判断（参考情報）」の両セクションが含まれる。(b) では両セクションが完全に省略され、エラーやプレースホルダテキストが出力されない。
**Why human:** invest.md は markdown プロンプトであり vitest ハーネス外。Claude Code のプロンプト解釈・条件分岐実行はライブランでしか確認できない。

### 3. decisionChanged 比率の複数日健全性観測（アンカリングバイアス検知、D-07）

**Test:** 3日以上、日次でパイプラインを実行し、各日の `docs/{date}/portfolio-report.html` 上でアンバー「判断変更」バッジが表示される銘柄数・比率を記録する。
**Expected:** 全日程・全銘柄で decisionChanged が常時 false（バッジ0件）にならない。妥当な範囲で判断変化が時々観測される（LLMが前日判断に過度にアンカリングされていない証拠）。
**Why human:** 単発の静的テストでは検証不能。複数日分のライブデータの傾向観測が必要（D-07が定義する健全性シグナル）。

### Gaps Summary

No code-level gaps found. All 4 plans' must-haves are implemented, wired, and test-covered; the 3 post-review WARNING fixes (WR-01 per-holding fail-soft, WR-02 same-day guard, WR-03 round-loader console.warn) are confirmed present in the codebase via direct grep/read (not just SUMMARY claims). Full test suite is green at 286/286.

The phase is functionally complete at the code level. It is held at `human_needed` (not `passed`) solely because 3 behaviors are inherently unverifiable by static analysis (LLM prose content quality, live prompt conditional-section execution, and multi-day anchoring-bias observation) — these were already anticipated and explicitly deferred to human verification by the phase's own `22-VALIDATION.md` "Manual-Only Verifications" section, so this is expected, not a regression.

One non-blocking documentation gap was found: `.planning/REQUIREMENTS.md` traceability table/checkboxes for PORT-04, PORT-05, UI-07 are stale (still "Pending" from a mid-phase commit), while `.planning/ROADMAP.md` correctly shows Phase 22 complete. Recommend a follow-up doc update; does not affect phase pass/fail.

---

*Verified: 2026-07-03T21:30:00Z*
*Verifier: Claude (gsd-verifier)*

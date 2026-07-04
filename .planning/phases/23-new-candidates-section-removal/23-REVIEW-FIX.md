---
phase: 23-new-candidates-section-removal
fixed_at: 2026-07-04T00:06:30Z
review_path: .planning/phases/23-new-candidates-section-removal/23-REVIEW.md
iteration: 1
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 23: Code Review Fix Report

**Fixed at:** 2026-07-04T00:06:30Z
**Source review:** .planning/phases/23-new-candidates-section-removal/23-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 2 (Critical: 0, Warning: 2 / IN-01・IN-02 はスコープ外)
- Fixed: 2
- Skipped: 0

## Fixed Issues

### WR-01: Test 30/31 の非存在アサーションが見出し文言のみに依存し、highlightedStocks データの流出再発を検出できない

**Files modified:** `src/scripts/generate-report.test.ts`
**Commit:** 59d1624
**Applied fix:** Test 30（通常パス）に `expect(html).not.toContain("PLTR")` と `expect(html).not.toContain("スコアリングマトリクス")` を追加。Test 31（フォールバックパス）に `expect(html).not.toContain("PLTR")` と説明文の非存在アサーションを追加し Test 30 と対称化。適用前に `generate-portfolio-report.ts` / `report-utils.ts` / `holding-news.ts` を grep し、通常パス・フォールバックパスの生成 HTML に "PLTR"・"スコアリングマトリクス" が現れないこと（validPortfolioAnalysis は MRNA/HII/POWL のみ）を検証済み。

### WR-02: `vi.restoreAllMocks()` がモジュールレベルのモック実装を破壊し、テストの順序依存を生んでいる

**Files modified:** `src/scripts/generate-report.test.ts`
**Commit:** 6b78bb2
**Applied fix:** `"3-report output"` describe の `afterEach` を `vi.restoreAllMocks()` から `vi.clearAllMocks()` に置換（意図を説明するコメント付き）。適用前に既存テストの restore 依存を確認: Tests 44/45 と `resolvePrevHoldingsForDiff` describe の `console.warn` スパイは各テスト内で `warnSpy.mockRestore()` を自前で呼んでおり、afterEach の restore に依存するスパイは存在しない。`clearAllMocks` は呼び出し履歴のみクリアし、`vi.mock` ファクトリの fs モック実装とモジュールトップレベルの `process.exit` スパイを維持する。

## Verification

- 各修正後: `npx vitest run src/scripts/generate-report.test.ts` → 52/52 passed
- 全修正後: `npm run test` → 17 files / 286 tests passed

## Additional Commits

- 10528a6 `docs(23): mark review findings fixed` — 23-REVIEW.md の WR-01/WR-02 に `**Status:** fixed (commit ...)` を追記

---

_Fixed: 2026-07-04T00:06:30Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_

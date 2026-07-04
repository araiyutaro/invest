---
phase: 23-new-candidates-section-removal
reviewed: 2026-07-04T00:01:07Z
depth: standard
files_reviewed: 2
files_reviewed_list:
  - src/scripts/generate-portfolio-report.ts
  - src/scripts/generate-report.test.ts
findings:
  critical: 0
  warning: 2
  info: 2
  total: 4
status: issues_found
---

# Phase 23: Code Review Report

**Reviewed:** 2026-07-04T00:01:07Z
**Depth:** standard
**Files Reviewed:** 2
**Status:** issues_found

## Summary

Phase 23（新規組入候補セクション削除、コミット 261b1c1 / c9974a3）の diff と対象ファイル全体をレビューした。

削除自体の正確性は検証済み:
- `formatNewCandidatesHtml()` 本体、通常パス・フォールバックパス両方の呼び出し箇所（`${newCandidatesHtml}`）が完全に削除されている
- 不要になった `scoreColor` / `verdictColor` の import が削除されている。両関数は `generate-daily-report.ts` / `generate-meeting-minutes.ts` で引き続き使用されており、`report-utils.ts` からの export 削除は不要（正しい判断）
- `src/` 全体を grep した結果、`formatNewCandidatesHtml` / `newCandidates` への残存参照はゼロ（テスト内の非存在アサーションを除く）
- `npx tsc --noEmit` で対象ファイルに型エラーなし（`collect-data.test.ts` の TS7006 エラー4件は本フェーズのスコープ外・既存）
- テストスイートは 52/52 パス

Critical 該当なし。ただし、削除の退行検出を担う Test 30/31 のアサーションが見出し文言のみに依存しており、データ流出の再発を検出できない弱点がある（WR-01）。また既存のテストモック管理に順序依存の脆弱性がある（WR-02）。

## Warnings

### WR-01: Test 30/31 の非存在アサーションが見出し文言のみに依存し、highlightedStocks データの流出再発を検出できない

**Status:** fixed (commit 59d1624)
**File:** `src/scripts/generate-report.test.ts:360-374`
**Issue:** Test 30 は `"新規組入候補"` と説明文 `"Daily Reportのアナリストミーティングで推奨された銘柄です"` の非存在のみを検証している。将来、見出し文言を変えて候補テーブル（`highlightedStocks` 由来の PLTR ティッカーやスコアマトリクス）が再導入された場合、このテストは素通しになる。削除前の Test 30 が検証していた `"PLTR"` / `"8.2"` はフィクスチャ上ポートフォリオ保有銘柄（MRNA/HII/POWL）と重複しないため、データ自体の非存在を直接アサートできる。Test 31（フォールバックパス）も `"新規組入候補"` のみで、説明文・データの非存在チェックがなく Test 30 と非対称。
**Fix:**
```typescript
// Test 30 に追加（validPortfolioAnalysis は PLTR を含まないため安全に非存在を検証できる）
expect(html).not.toContain("PLTR");
expect(html).not.toContain("スコアリングマトリクス");

// Test 31 にも同様に追加
expect(html).not.toContain("PLTR");
expect(html).not.toContain("Daily Reportのアナリストミーティングで推奨された銘柄です");
```
（注: `"8.2"` の非存在チェックは `timestamp` が非決定的なため推奨しない。文字列ベースの `"PLTR"` / `"スコアリングマトリクス"` が安全。）

### WR-02: `vi.restoreAllMocks()` がモジュールレベルのモック実装を破壊し、テストの順序依存を生んでいる（既存問題）

**Status:** fixed (commit 6b78bb2)
**File:** `src/scripts/generate-report.test.ts:11, 524-526`
**Issue:** `"3-report output"` describe 内の `afterEach(() => vi.restoreAllMocks())` は、(1) 11行目のモジュールトップレベルで作成した `process.exit` スパイ、(2) `vi.mock("node:fs/promises")` ファクトリで設定した `mockRejectedValue` / `mockResolvedValue` の実装、の両方を最初のテスト終了時点でリセットする。以降のテストは各テスト内で `readFile` / `readdir` を再設定しているため現状はパスするが、`writeFile` / `mkdir` はファクトリ設定が消えた状態（`undefined` を返す）で動作しており、`main()` が `process.exit` を呼ぶ経路が将来追加された場合や、fs モックに依存する新規テストが describe 末尾に追加された場合に、原因の分かりにくい順序依存の失敗を引き起こす。本フェーズの変更起因ではないが、Test 30/31 を含むこのスイートの信頼性に直結する。
**Fix:** `vi.restoreAllMocks()` を `vi.clearAllMocks()` に置き換える（呼び出し履歴のみクリアし、実装とスパイを維持）。または `process.exit` スパイと fs モック実装を describe の `beforeEach` で毎回再設定する。

## Info

### IN-01: `generatePortfolioReportHtml` の第1引数 `result: MeetingResult` の実使用が `result.date` のみに縮退

**File:** `src/scripts/generate-portfolio-report.ts:102-103`
**Issue:** `formatNewCandidatesHtml(result)` の削除により、`MeetingResult` 全体を受け取る理由が `result.date`（タイトル・見出し）だけになった。会議結果全体への結合が残っており、シグネチャが実態より広い。呼び出し側は `generate-report.ts:152` の1箇所のみ。
**Fix:** 将来のリファクタリング候補として、第1引数を `date: string` に絞るか、`Pick<MeetingResult, "date">` にする。本フェーズでの必須対応ではない。

### IN-02: `decisionColor` が未知の decision 文字列に対して緑（保持と同色）を返す

**File:** `src/scripts/generate-portfolio-report.ts:12`
**Issue:** `default: return "#10b981"` により、LLM 出力の表記揺れで未知の decision が来た場合に「保持」と同じポジティブな緑で描画される。テキスト自体は表示されるため実害は小さいが、視覚的に誤解を招く余地がある（既存コード、本フェーズ起因ではない）。
**Fix:** default をニュートラル色（例: `#9ca3af`）にするか、型を `HoldingEvaluation["decision"]` に絞って exhaustive switch にする。

---

_Reviewed: 2026-07-04T00:01:07Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

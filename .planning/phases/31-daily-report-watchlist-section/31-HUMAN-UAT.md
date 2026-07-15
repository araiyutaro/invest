---
status: pending
phase: 31-daily-report-watchlist-section
source: [31-03-PLAN.md Task 2]
started: 2026-07-16T08:40:00Z
updated: 2026-07-16T08:40:00Z
---

## Current Test

[1: ウォッチリストセクションの挿入順序確認]

## Tests

### 1. ウォッチリストセクションの挿入順序確認
expected: 生成された `docs/{date}/daily-report.html` で「注目銘柄スコアリングマトリクス」セクションの直後・「WebSearch リサーチ結果」の前に「ウォッチリスト 買いタイミング判定」セクションが表示される（D-01 挿入順序）。
result: pending — 実機実行待ち（次回パイプライン実行後の docs/{date}/daily-report.html で確認。2026-07-16 分は本プラン配線前に生成済みのため対象外）

### 2. buy/wait バッジの強度非対称確認
expected: buy 銘柄に緑（#10b981）の「今日買うべき」バッジ、wait 銘柄に控えめなグレー（#9ca3af）の「待ち」ラベルが表示され、buy バッジだけが目に飛び込む（D-09）。
result: pending — 実機実行待ち

### 3. as-of注記・判定理由・signalsピル・登録日メタ確認
expected: 各銘柄に as-of 注記（US=「前日終値時点」/ JP=「寄付き前時点」）・判定理由の段落・signals ピル・登録日メタが表示される（D-05/D-06/D-08）。
result: pending — 実機実行待ち

### 4. 前日比変化バッジ確認
expected: 前日から変化した銘柄があれば、待ち→買いは緑「シグナル点灯: 待ち → 買い」、買い→待ちはアンバー（#f59e0b）「買い → 待ち」バッジが表示される（UI-10）。
result: pending — 2日連続の実機実行が必要（翌日以降の launchd 実行待ち。前日スナップショットとの比較が必要なため単発実行では確認不可）

### 5. skipped銘柄の表示確認
expected: skipped 銘柄があればグレー系（opacity 0.7）の「判定不能（データ不足）」表示になっている（D-07）。
result: pending — 実機実行待ち（skipped 判定が発生する日の実行が必要）

### 6. 会社名表示フォーマット確認
expected: 会社名が「ティッカー — 会社名」形式で表示され、watchlist に無い銘柄はティッカーのみになる（D-04）。
result: pending — 実機実行待ち

### 7. 既存4レポート非ブロック確認
expected: 他の3+1レポート（meeting-minutes / portfolio-report / news-digest）が従来どおり生成・表示されている（fail-soft、OPS-06）。
result: pending — 実機実行待ち

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0
blocked: 0

## Gaps

- 全7項目が静的解析では確認不能な実機（launchd 朝8時実行 or 手動パイプライン実行）検証待ち。Phase 21/22/24/29/30 の確立済み前例に従い、コードレベルは Plan 01/02/03 の VERIFICATION（単体テスト 610/610 GREEN）で検証済みのため、本ファイルは実行時のブラウザ目視挙動のみを追跡する。
- 2026-07-16 の docs/2026-07-16/daily-report.html は本プラン（31-03）の配線コミット前に生成されたものであり、ウォッチリストセクションを含まない。次回パイプライン実行（2026-07-17 朝の launchd 実行、または手動 `/invest` 実行）で生成される daily-report.html が初回の検証対象となる。
- 項目4（変化バッジ）は前日スナップショットとの比較を要するため、2日以上の連続実行後でないと完全には検証できない。1日目実行後に項目1-3・5-7を確認し、2日目実行後に項目4を確認する2段階の検証を想定。

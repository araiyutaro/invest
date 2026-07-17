---
status: complete
phase: 31-daily-report-watchlist-section
source: [31-03-PLAN.md Task 2]
started: 2026-07-16T08:40:00Z
updated: 2026-07-17T10:25:00Z
---

## Current Test

[testing complete]

## Tests

### 1. ウォッチリストセクションの挿入順序確認
expected: 生成された `docs/{date}/daily-report.html` で「注目銘柄スコアリングマトリクス」セクションの直後・「WebSearch リサーチ結果」の前に「ウォッチリスト 買いタイミング判定」セクションが表示される（D-01 挿入順序）。
result: pass

### 2. buy/wait バッジの強度非対称確認
expected: buy 銘柄に緑（#10b981）の「今日買うべき」バッジ、wait 銘柄に控えめなグレー（#9ca3af）の「待ち」ラベルが表示され、buy バッジだけが目に飛び込む（D-09）。
result: pass

### 3. as-of注記・判定理由・signalsピル・登録日メタ確認
expected: 各銘柄に as-of 注記（US=「前日終値時点」/ JP=「寄付き前時点」）・判定理由の段落・signals ピル・登録日メタが表示される（D-05/D-06/D-08）。
result: pass

### 4. 前日比変化バッジ確認
expected: 前日から変化した銘柄があれば、待ち→買いは緑「シグナル点灯: 待ち → 買い」、買い→待ちはアンバー（#f59e0b）「買い → 待ち」バッジが表示される（UI-10）。
result: pass
note: "2026-07-17 に合成テストで検証。実データでは検証不可だったため（07-17 朝の会議で ASML/GPC が中立降格→ウォッチリスト除外、新規 JNJ には前日判定なし）、合成前日データ（JNJ=buy）を一時配置し write-watchlist-judgment.ts → generate-report.ts の実コードパスで actionChanged=true を算出させ、アンバー（#f59e0b）「買い → 待ち」バッジの描画をブラウザで目視確認（pass）。確認後、実データを復元しレポートをデプロイ済み状態に戻した。緑「シグナル点灯: 待ち → 買い」方向は単体テストでカバー済み。"

### 5. skipped銘柄の表示確認
expected: skipped 銘柄があればグレー系（opacity 0.7）の「判定不能（データ不足）」表示になっている（D-07）。
result: pass

### 6. 会社名表示フォーマット確認
expected: 会社名が「ティッカー — 会社名」形式で表示され、watchlist に無い銘柄はティッカーのみになる（D-04）。
result: pass

### 7. 既存4レポート非ブロック確認
expected: 他の3+1レポート（meeting-minutes / portfolio-report / news-digest）が従来どおり生成・表示されている（fail-soft、OPS-06）。
result: pass

## Summary

total: 7
passed: 7
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

- 全7項目が静的解析では確認不能な実機（launchd 朝8時実行 or 手動パイプライン実行）検証待ち。Phase 21/22/24/29/30 の確立済み前例に従い、コードレベルは Plan 01/02/03 の VERIFICATION（単体テスト 610/610 GREEN）で検証済みのため、本ファイルは実行時のブラウザ目視挙動のみを追跡する。
- ~~2026-07-16 の docs/2026-07-16/daily-report.html は本プラン（31-03）の配線コミット前に生成されたものであり、ウォッチリストセクションを含まない。~~ → 2026-07-16 09:00、既存 tmp データ（watchlist-judgment.json 等）を入力に generate-report.ts を再実行し、配線済みコードで docs/2026-07-16/daily-report.html を再生成した。項目1・5・6・7 はこの再生成レポートで検証可能。
- 【検証環境の制約】2026-07-16 朝のパイプライン実行では Step 3-J.2（銘柄別判定 Agent）が実行されず（tmp/watchlist-judgment-raw/ 不存在）、テクニカルデータは存在するにもかかわらず全アクティブ銘柄（ASML/GPC）が fail-soft で status:skipped 合成された。これは Phase 30 パイプライン実行時の問題であり Phase 31 のコード不具合ではない。**翌日以降の launchd 実行で Step 3-J.2 が正しく実行されるか要監視。**
- 2026-07-16 14:45（JST）、UAT セッション内で Step 3-J をピンポイント再実行（判定 Agent 2体並列 → write-watchlist-judgment.ts: 判定2件/skip0件/降格0件 → generate-report.ts 再生成）。ASML=buy（signals 5件）、GPC=wait となり、項目2・3 が検証可能になった。項目5（skipped 表示）は再実行前の skipped 状態のレポートで pass 済み。
- 項目4（変化バッジ）は前日スナップショットとの比較を要するため、2日以上の連続実行後でないと完全には検証できない。1日目実行後に項目1-3・5-7を確認し、2日目実行後に項目4を確認する2段階の検証を想定。

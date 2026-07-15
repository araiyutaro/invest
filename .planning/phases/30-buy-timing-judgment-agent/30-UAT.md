---
status: testing
phase: 30-buy-timing-judgment-agent
source: [30-VERIFICATION.md]
started: 2026-07-15T21:40:00Z
updated: 2026-07-15T21:40:00Z
---

## Current Test

number: 1
name: Step 3-J 実行時の STEP マーカー出力
expected: |
  実パイプライン実行（launchd 毎朝8時実行、または手動 /invest 実行。ウォッチリストにアクティブ銘柄がある日）で、stderr に [STEP:watchlist-judgment:OK]（または部分失敗時 [STEP:watchlist-judgment:FAIL:{N}/{M}銘柄失敗（...）]）が1行出力される。[PIPELINE:FAIL] は出力されない。
awaiting: user response

## Tests

### 1. Step 3-J 実行時の STEP マーカー出力
expected: 実パイプライン実行で Step 3-J が判定を生成し、stderr に [STEP:watchlist-judgment:OK]（または部分失敗マーカー）が1行出る。[PIPELINE:FAIL] は出ない（launchd 実行または手動実行が必要。静的解析環境では実行不能）
result: [pending]

### 2. tmp/watchlist-judgment.json の有効 JSON 形状 + confluence ゲート
expected: 各銘柄に todayAction（buy/wait）・rationale（日本語）・signals 配列・market（US/JP）・asOf を持つ有効 JSON が生成される。buy 判定の銘柄は signals が2件以上（実データでの Agent 出力と CLI 後処理の組み合わせはライブでしか確認できない）
result: [pending]

### 3. market/asOf の LLM エコー不採用スポットチェック
expected: tmp/watchlist-judgment-raw/{ticker}.json の生 Agent 出力に market/asOf/previousAction/actionChanged が含まれていても、最終 tmp/watchlist-judgment.json の同フィールドは TS 決定論由来の値である（実 LLM（sonnet）出力サンプルでの確認が必要）
result: [pending]

### 4. 前日退避 + 判定変化検出（2日連続実行）
expected: 2日目の実行後、tmp/prev-watchlist-judgment.json が前日分で生成され、判定変化銘柄に actionChanged: true・previousAction が付与される（2日間にわたる連続実機実行が必要）
result: [pending]

### 5. 同日再実行ガード
expected: 同日内の再実行で prev が破壊されない（date ガードにより退避スキップされ、既存 prev が保持される）（実機での同日複数回実行が必要）
result: [pending]

### 6. 既存4レポート非ブロック（fail-soft 配線）
expected: Step 3-J の成否に関わらず daily/meeting-minutes/portfolio/news-digest の4レポートが通常どおり docs/{date}/ に生成・デプロイされる（実パイプライン全体のフル実行結果を要する）
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps

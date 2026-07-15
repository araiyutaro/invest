---
status: testing
phase: 29-daily-tracking-data-supply
source: [29-VERIFICATION.md]
started: 2026-07-15T04:45:00Z
updated: 2026-07-15T04:45:00Z
---

## Current Test

number: 1
name: Step 2i 実行時の STEP マーカー出力
expected: |
  launchd 毎朝8時実行（または手動 `cd /Users/arai/invest && npx tsx src/scripts/collect-watchlist-data.ts` 実行）で、Step 2h 直後・Step 3 より前のタイミングに stderr へ [STEP:watchlist-data:OK]（または :FAIL:<reason>）が出力される
awaiting: user response

## Tests

### 1. Step 2i 実行時の STEP マーカー出力
expected: launchd/手動実行で Step 2h 直後に Step 2i が実行され、stderr に [STEP:watchlist-data:OK]（または :FAIL:<reason>）が出力される（静的解析では実プロセスの stderr 出力タイミングと LLM オーケストレーターの実行順序を確認できないため実機確認が必要）
result: [pending]

### 2. 出力2ファイルの実運用生成
expected: 実行後、tmp/watchlist-technicals.json が {generatedAt, snapshots:[...]} 形状の有効JSON、tmp/watchlist-news.json がアクティブ銘柄キーを持つ有効JSON（HoldingNewsFile）で生成される（実際の Yahoo Finance API 応答・実運用 watchlist.json での動作は実機でしか確認できない）
result: [pending]

### 3. 既存4レポートの継続生成・デプロイ（fail-soft 配線）
expected: Step 2i の成功・失敗にかかわらず [PIPELINE:FAIL] が出ず、既存4レポート（daily/portfolio/meeting-minutes/news-digest）が通常どおり docs/{date}/ に生成・デプロイされる（invest.md は LLM が解釈する自然言語スクリプトのため、実行ログでの fail-soft 動作確認が必要）
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps

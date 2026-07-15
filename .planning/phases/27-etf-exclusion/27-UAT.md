---
status: testing
phase: 27-etf-exclusion
source: [27-VERIFICATION.md]
started: 2026-07-15T02:00:00Z
updated: 2026-07-15T02:00:00Z
---

## Current Test

number: 1
name: Layer 1（プロンプト層）の実効性 — ライブ実行でETFがpicksに現れない
expected: |
  翌営業日の launchd 実行後、tmp/round-1/*.json の picks および
  tmp/meeting-result.json の highlightedStocks にETF・投資信託・
  インデックスファンドのティッカーが含まれない
awaiting: user response

## Tests

### 1. Layer 1（プロンプト層）の実効性 — ライブ実行でETFがpicksに現れない
expected: 翌営業日の launchd 実行後、tmp/round-1/*.json の picks と tmp/meeting-result.json の highlightedStocks にETFが含まれない（LLM出力は静的検証不能。仮にETFが混入しても第2層のTS決定論フィルタが除外することを合わせて確認）
result: [pending]

### 2. Layer 2（パイプライン統合）の実行順序とSTEPマーカー出力
expected: 翌営業日の実行ログに `[STEP:etf-exclusion:OK]` が出力され、filter-etf-stocks.ts が validate-meeting.ts より前に実行されている。失敗時も `[PIPELINE:FAIL]` は出力されず既存4レポートの生成・デプロイが継続する
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps

---
status: complete
phase: 27-etf-exclusion
source: [27-VERIFICATION.md]
started: 2026-07-15T02:00:00Z
updated: 2026-07-17T09:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Layer 1（プロンプト層）の実効性 — ライブ実行でETFがpicksに現れない
expected: 翌営業日の launchd 実行後、tmp/round-1/*.json の picks と tmp/meeting-result.json の highlightedStocks にETFが含まれない（LLM出力は静的検証不能。仮にETFが混入しても第2層のTS決定論フィルタが除外することを合わせて確認）
result: pass

### 2. Layer 2（パイプライン統合）の実行順序とSTEPマーカー出力
expected: 翌営業日の実行ログに `[STEP:etf-exclusion:OK]` が出力され、filter-etf-stocks.ts が validate-meeting.ts より前に実行されている。失敗時も `[PIPELINE:FAIL]` は出力されず既存4レポートの生成・デプロイが継続する
result: pass
evidence: logs/invest-2026-07-17_070003.log — filter-etf-stocks.ts (EXIT:0, ETF 2件除外: AWM, LNP) → [STEP:etf-exclusion:OK] → validate-meeting.ts (EXIT_VALIDATE:0)。[PIPELINE:FAIL] の実発出なし。後続ステップ完走・レポートデプロイ済み (commit 138c2e8)

## Summary

total: 2
passed: 2
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

---
status: partial
phase: 03-report-builder-websearch-research
source: [03-VERIFICATION.md]
started: 2026-06-24T17:48:00Z
updated: 2026-06-24T17:48:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. WebSearch + WebFetch ツール実動作確認
expected: `/invest` 実行時に `tmp/websearch/{ticker}.json` に実際のリサーチ結果が生成される。WebSearch で定性情報を取得し、WebFetch で詳細記事を取得する。定量データ（株価等）は WebSearch 対象外。
result: [pending]

### 2. エンドツーエンド パイプライン実行確認
expected: `/invest` 実行後に `reports/YYYY-MM-DD/daily-report.html` が生成され、Bloomberg 風ダークテーマ（#0f0f1a 背景、agent-card クラス）が正しく表示される。レポートに5アナリスト分析 + モデレーター統合見解 + WebSearch リサーチ + 再評価ラウンド結果が含まれる。
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps

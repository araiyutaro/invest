---
status: testing
phase: 28-watchlist-persistence
source: [28-VERIFICATION.md]
started: 2026-07-15T03:17:54Z
updated: 2026-07-15T03:17:54Z
---

## Current Test

number: 1
name: launchd 実行ログでの [STEP:watchlist:OK] 出力確認
expected: |
  翌朝の launchd 日次実行ログで、Step 2h 相当の `[STEP:watchlist:OK]` マーカーが
  `[STEP:etf-exclusion:*]`（filter-etf-stocks）および validate-meeting の実行後・
  Step 3（レポート生成）の前に出力されている。
awaiting: user response

## Tests

### 1. launchd 実行ログでの [STEP:watchlist:OK] 出力確認
expected: 翌朝の launchd 日次実行ログで、Step 2h 相当の `[STEP:watchlist:OK]` が filter-etf-stocks / validate-meeting の後・Step 3 の前に出力される（失敗時も `[STEP:watchlist:FAIL:<理由>]` で fail-soft 継続し `[PIPELINE:FAIL]` は出ない）
result: [pending]

### 2. 実パイプラインでの data/watchlist.json 更新・自動コミット確認
expected: 実パイプライン実行後、当日 `verdict: 強気` の銘柄（ETF除外後・保有銘柄除外後）が `data/watchlist.json` に addedDate/lastVerdictDate・社名付きで登録され、Step 4 の `git add docs/ docs_old/ data/` により自動コミットされている
result: [pending]

### 3. 既存4レポートの生成・デプロイへの無影響確認（fail-soft, OPS-06 分担）
expected: Step 2h 追加後も daily-report / portfolio-report / meeting-minutes / news-digest の4レポートが従来どおり生成・デプロイされる（watchlist ステップの成否に関わらず）
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps

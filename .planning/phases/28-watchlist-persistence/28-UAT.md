---
status: complete
phase: 28-watchlist-persistence
source: [28-VERIFICATION.md]
started: 2026-07-15T03:17:54Z
updated: 2026-07-17T09:30:00Z
---

## Current Test

[testing complete]

## Tests

### 1. launchd 実行ログでの [STEP:watchlist:OK] 出力確認
expected: 翌朝の launchd 日次実行ログで、Step 2h 相当の `[STEP:watchlist:OK]` が filter-etf-stocks / validate-meeting の後・Step 3 の前に出力される（失敗時も `[STEP:watchlist:FAIL:<理由>]` で fail-soft 継続し `[PIPELINE:FAIL]` は出ない）
result: pass
source: automated
evidence: logs/invest-2026-07-17_070003.log の実出力順序 — [STEP:etf-exclusion:OK] → Validation passed (EXIT_VALIDATE:0) → [watchlist] active=1件, removed=2件 → [STEP:watchlist:OK] (EXIT_WATCHLIST:0) → [STEP:watchlist-data:OK] → [STEP:report-generation:START]。watchlist:FAIL / PIPELINE:FAIL の実発出なし

### 2. 実パイプラインでの data/watchlist.json 更新・自動コミット確認
expected: 実パイプライン実行後、当日 `verdict: 強気` の銘柄（ETF除外後・保有銘柄除外後）が `data/watchlist.json` に addedDate/lastVerdictDate・社名付きで登録され、Step 4 の `git add docs/ docs_old/ data/` により自動コミットされている
result: pass
source: automated
evidence: data/watchlist.json — JNJ (Johnson & Johnson) が addedDate/lastVerdictDate=2026-07-17 で登録、ASML は purchased・GPC は downgraded として removedDate=2026-07-17 の理由付き history へ移動。commit 138c2e8（自動デプロイコミット）に data/watchlist.json が含まれ origin/master へ push 済み

### 3. 既存4レポートの生成・デプロイへの無影響確認（fail-soft, OPS-06 分担）
expected: Step 2h 追加後も daily-report / portfolio-report / meeting-minutes / news-digest の4レポートが従来どおり生成・デプロイされる（watchlist ステップの成否に関わらず）
result: pass
source: automated
evidence: docs/2026-07-17/ に daily-report.html / meeting-minutes.html / news-digest.html / portfolio-report.html の4件が生成され、commit 138c2e8 で origin/master へデプロイ済み

## Summary

total: 3
passed: 3
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

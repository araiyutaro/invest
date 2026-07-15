---
status: pending
phase: 30-buy-timing-judgment-agent
source: [30-03-PLAN.md Task 2]
started: 2026-07-15T12:04:16Z
updated: 2026-07-15T12:04:16Z
---

## Current Test

[1: STEP マーカー出力確認]

## Tests

### 1. STEP マーカー出力確認
expected: パイプライン実行の stderr に `[STEP:watchlist-judgment:OK]`（または部分失敗時 `[STEP:watchlist-judgment:FAIL:{N}/{M}銘柄失敗（...）]`）が1行出力される。`[PIPELINE:FAIL]` は出力されない。
result: pending — 実機実行待ち（launchd 朝8時実行、または手動 Step 3-J 実行後にログ確認）

### 2. tmp/watchlist-judgment.json の有効 JSON 形状 + confluence ゲート確認
expected: `cat tmp/watchlist-judgment.json` が有効 JSON で、各銘柄に `todayAction`（buy/wait）・`rationale`（日本語）・`signals` 配列・`market`（US/JP）・`asOf` を持つ。buy 判定の銘柄は signals が2件以上（confluence ≥2 ゲート適用済み）。
result: pending — 実機実行待ち

### 3. market/asOf の LLM エコー不採用スポットチェック
expected: `tmp/watchlist-judgment-raw/{任意のticker}.json` の生 Agent 出力に `market`/`asOf`/`previousAction`/`actionChanged` が仮に含まれていても、最終 `tmp/watchlist-judgment.json` の同フィールドは TS 側決定論由来の値であること（LLM エコー不採用）。
result: pending — 実機実行待ち（raw ファイルと最終ファイルの該当フィールドを突き合わせ確認）

### 4. 前日退避 + 判定変化検出（2日目実行）
expected: 2日目の実行後、`tmp/prev-watchlist-judgment.json` が前日分で生成され、判定が変化した銘柄に `actionChanged: true`・`previousAction` が付く。
result: pending — 2日連続の実機実行が必要（翌朝以降の launchd 実行待ち）

### 5. 同日再実行ガード確認
expected: 同日内に Step 3-J を再実行しても、既存の `tmp/prev-watchlist-judgment.json` が破壊されない（date ガードにより退避スキップ、「同日データのため退避スキップ」ログが出る）。
result: pending — 同日複数回実行の実機検証待ち

### 6. 既存4レポート非ブロック確認
expected: 既存4レポート（daily-report / meeting-minutes / portfolio-report / news-digest）が Step 3-J の成否に関わらず通常どおり生成・デプロイされる。判定失敗時も `[PIPELINE:FAIL]` は出ずレポート生成がブロックされない。
result: pending — 実機実行待ち（正常系・意図的失敗系の両方で確認が望ましい）

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps

- 全6項目が静的解析では確認不能な実機（launchd 朝8時実行 or 手動パイプライン実行）検証待ち。Phase 21/22/24/29 の確立済み前例（21-HUMAN-UAT.md 等）に従い、コードレベルは Plan 01/02/03 の VERIFICATION で検証済みのため、本ファイルは実行時挙動のみを追跡する。
- 項目4/5は2日以上にわたる連続実行が必要なため、単発の翌朝実行では完全に検証できない可能性がある。1日目実行後に項目1-3・6を確認し、2日目実行後に項目4-5を確認する2段階の検証を想定。

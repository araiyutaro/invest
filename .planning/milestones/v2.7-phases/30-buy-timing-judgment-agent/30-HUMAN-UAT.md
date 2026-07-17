---
status: complete
phase: 30-buy-timing-judgment-agent
source: [30-03-PLAN.md Task 2]
started: 2026-07-15T12:04:16Z
updated: 2026-07-17T10:30:00Z
---

## Current Test

[testing complete]

## Tests

### 1. STEP マーカー出力確認
expected: パイプライン実行の stderr に `[STEP:watchlist-judgment:OK]`（または部分失敗時 `[STEP:watchlist-judgment:FAIL:{N}/{M}銘柄失敗（...）]`）が1行出力される。`[PIPELINE:FAIL]` は出力されない。
result: pass
source: automated
evidence: 2026-07-17 launchd 実行ログ 07:57 JST — `[watchlist-judgment] 判定=1件, skip=0件, 降格=0件` → `[STEP:watchlist-judgment:OK]`。[PIPELINE:FAIL] 実発出なし（詳細は 30-UAT.md）

### 2. tmp/watchlist-judgment.json の有効 JSON 形状 + confluence ゲート確認
expected: `cat tmp/watchlist-judgment.json` が有効 JSON で、各銘柄に `todayAction`（buy/wait）・`rationale`（日本語）・`signals` 配列・`market`（US/JP）・`asOf` を持つ。buy 判定の銘柄は signals が2件以上（confluence ≥2 ゲート適用済み）。
result: pass
source: automated
evidence: JNJ: todayAction=wait・日本語 rationale・signals 4件・market=US・asOf=2026-07-16。buy サンプルは前日実出力 ASML buy（signals 5件 ≥2）で充足

### 3. market/asOf の LLM エコー不採用スポットチェック
expected: `tmp/watchlist-judgment-raw/{任意のticker}.json` の生 Agent 出力に `market`/`asOf`/`previousAction`/`actionChanged` が仮に含まれていても、最終 `tmp/watchlist-judgment.json` の同フィールドは TS 側決定論由来の値であること（LLM エコー不採用）。
result: pass
source: automated
evidence: raw/JNJ.json は ticker/todayAction/rationale/signals のみ。最終ファイルの market/asOf は TS 決定論由来（asOf=2026-07-16 = 米国市場前営業日）

### 4. 前日退避 + 判定変化検出（2日目実行）
expected: 2日目の実行後、`tmp/prev-watchlist-judgment.json` が前日分で生成され、判定が変化した銘柄に `actionChanged: true`・`previousAction` が付く。
result: pass
source: automated
evidence: `[前日判定] 2銘柄分の前日判定を保存` 出力、prev に 2026-07-16 分（ASML/GPC）退避済み。当日は前日銘柄が全て除外済み・JNJ 新規のため変化対象なし（非付与が正しい挙動）

### 5. 同日再実行ガード確認
expected: 同日内に Step 3-J を再実行しても、既存の `tmp/prev-watchlist-judgment.json` が破壊されない（date ガードにより退避スキップ、「同日データのため退避スキップ」ログが出る）。
result: pass
source: automated
evidence: 2026-07-17 に 07:57（launchd）と 10:24（手動 3-J.2 再実行）の同日2回実行が発生し、再実行後も prev の内容は前日 2026-07-16 分のまま保持

### 6. 既存4レポート非ブロック確認
expected: 既存4レポート（daily-report / meeting-minutes / portfolio-report / news-digest）が Step 3-J の成否に関わらず通常どおり生成・デプロイされる。判定失敗時も `[PIPELINE:FAIL]` は出ずレポート生成がブロックされない。
result: pass
source: automated
evidence: docs/2026-07-17/ に4レポート生成、commit 138c2e8 でデプロイ済み。[PIPELINE:FAIL] 実発出なし

## Summary

total: 6
passed: 6
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

（2026-07-17 実機検証で全6項目解消。旧記載の「2日連続実行が必要」な項目4/5も、07-16→07-17 の連続実行および 07-17 同日2回実行の実績により検証完了）

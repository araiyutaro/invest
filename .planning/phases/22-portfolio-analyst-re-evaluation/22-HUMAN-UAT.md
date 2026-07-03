---
status: partial
phase: 22-portfolio-analyst-re-evaluation
source: [22-VERIFICATION.md]
started: 2026-07-03T12:25:00Z
updated: 2026-07-03T12:25:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. rationale のニュース・リサーチ内容への明示言及（PORT-03）
expected: ライブ実行後、関連ニュースまたはリサーチ結果が存在する保有銘柄の rationale が、その具体的内容（材料名）に言及している。ニュース・リサーチのない銘柄は材料に言及していない（幻覚言及がない）
result: [pending]

### 2. invest.md 条件付きセクションのライブ動作
expected: tmp/portfolio-research/ 存在時のみリサーチセクションが、tmp/prev-portfolio-analysis.json 存在時のみ前日判断セクションがプロンプトに含まれる。初回実行（prev なし）ではセクション省略で正常動作。同日再実行では prev が同日データに汚染されない（WR-02 ガード動作）
result: [pending]

### 3. decisionChanged 比率の複数日健全性観測（D-07 アンカリング検知）
expected: 数日〜数週間のライブ実行で decisionChanged: true が一度も出ない状態が続かない（毎日全銘柄 false はアンカリングバイアス疑い）。判断変化があった日はカードにアンバー「判断変更: 前日 → 当日」バッジ、重大材料検知時に赤「⚠ 緊急」バッジが表示される
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps

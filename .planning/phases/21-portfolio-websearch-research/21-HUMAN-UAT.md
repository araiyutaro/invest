---
status: partial
phase: 21-portfolio-websearch-research
source: [21-VERIFICATION.md]
started: 2026-07-03T19:00:00Z
updated: 2026-07-03T19:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. ライブ実行での12ファイル生成とエンティティ衝突スポットチェック

/invest を実行し、tmp/portfolio-research/*.json が12ファイル生成されることを確認する。

expected: PORTFOLIO_HOLDINGS の12銘柄すべてに対応する {symbol}.json が tmp/portfolio-research/ に存在し、`npx tsx src/scripts/validate-portfolio-research.ts` が 12/12 passed で終了する。EE.json / NXT.json の内容が Excelerate Energy / Nextpower に関するものであり、英通信 EE Limited や英小売 NEXT plc の情報が混入していないことを目視確認する。
result: [pending]

why_human: Agent ツールと WebSearch/WebFetch はライブパイプライン実行時のみ動作し、静的コード解析では実際のリサーチ結果内容やエンティティ衝突混入の有無を検証できない。

### 2. STEPマーカー出力とfail-softパイプライン継続

/invest 実行ログで [STEP:portfolio-research:START] / [STEP:portfolio-research:OK または FAIL:...] マーカーが出力され、一部/全部失敗時も後続の Step 3a〜3e・4レポート生成・デプロイが継続することを確認する。

expected: マーカーが実行ログに出力され、[PIPELINE:FAIL] が出力されないこと。リサーチ失敗があってもポートフォリオレポートを含む4レポートが生成・デプロイされること。
result: [pending]

why_human: STEP マーカーと実際のパイプライン継続動作は invest.md の実行ログにのみ現れ、静的コードレビューでは指示文の存在は確認できてもランタイムの実際の分岐動作は検証できない。

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps

---
status: partial
phase: 24-digest-meeting-cross-reference
source: [24-VERIFICATION.md]
started: 2026-07-04
updated: 2026-07-04
---

## Current Test

[awaiting human testing —消化予定: 翌朝の launchd 日次パイプライン実行後]

## Tests

### 1. crossref チップのブラウザ描画確認
expected: 実 `meeting-result.json`（当日ミーティングと重複するティッカー/セクターを持つ）で生成された `news-digest.html` の注記付き記事カードで、`🗣 ミーティング言及: <SYMBOL> <verdict>` または `🗣 関連テーマ: <keyword>` チップが、ソース・時刻行の下・解説文の上にパープルのピルとして描画される。verdict は `verdictColor()` に従い色分け（強気=緑/弱気=赤/中立=琥珀）、レイアウト崩れなし、絵文字が正しく描画される。0一致記事にはチップ行が出ない。
why_human: CSSはgrepでテキスト検証済みだが未描画。視覚レイアウト・絵文字フォントフォールバック・狭幅ビューポートでのピル折り返しは目視が必要。
result: [pending]

### 2. ライブパイプラインの STEP マーカー可観測性
expected: 実日次パイプライン（`invest.md` skill）実行で、オペレーターログに `[STEP:digest-crossref:OK]` / `[STEP:digest-crossref:FAIL:...]` / `[STEP:digest-crossref:SKIP:...]` のいずれかが1回だけ出力され、`[STEP:news-digest:*]` とは独立し、crossref の成否に関わらず `[PIPELINE:FAIL]` は一切出ない。
why_human: `invest.md` Step 3e はエージェント解釈のオーケストレーション散文（LLM が直前コマンド出力を読みマーカーをechoする）であり、静的解析・スクリプトでは実行検証不能。ディスク上の `docs/2026-07-04/news-digest.html` は本フェーズのコミット（~10:40-11:20 JST）より前（07:55:58 JST生成）のため、フェーズ後のライブ実行はまだ発生していない。
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps

（機能ギャップなし。15/15 must-have は静的検証で全て確認済み。本UATの2項目はランタイム/視覚のライブ確認であり、翌朝の launchd 実行で消化予定。Phase 20/21/22 と同じ運用パターン。）

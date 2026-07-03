---
status: partial
phase: 20-holding-card-news-display
source: [20-VERIFICATION.md]
started: 2026-07-03T18:12:00Z
updated: 2026-07-03T18:12:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. 実データパイプライン再実行後のポートフォリオレポート目視確認

本フェーズのコード完成後（2026-07-03 17:30時点）に collect-data.ts / generate-report.ts のパイプラインを再実行し、生成された docs/YYYY-MM-DD/portfolio-report.html をブラウザで開く。

expected: 各保有銘柄カードの rationale/riskNote 直下に「関連ニュース」見出しが常に表示され、ニュースがある銘柄は最大5件の箇条書き（見出しリンク・ソース名・JST日時、name/alias一致のみ「社名一致」バッジ）が、ニュースが0件の銘柄（日本株小型株等）は「本日の関連ニュースなし」が表示され、エラーやレイアウト崩れがない。ニュースリンクのクリック先が正しい記事に遷移する。
result: [pending]

why_human: 本日 08:41 実行の collect-data.ts は Phase 19 の holding-news.json 生成ロジックを含まない版で動いており、tmp/holding-news.json が現在ディスク上に存在しない。docs/2026-07-03/portfolio-report.html も 09:17 生成で本フェーズのコードより前の状態。「関連ニュース」セクションを含む実データでのライブ描画は一度も目視確認されていない（20-VALIDATION.md Manual-Only Verifications / 20-02-PLAN.md verification 節に明記）。

## Summary

total: 1
passed: 0
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps

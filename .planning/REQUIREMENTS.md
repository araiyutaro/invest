# Requirements: Investment Agent

**Defined:** 2026-06-30
**Core Value:** 毎日の投資判断に必要な多角的分析を、複数AIアナリストの議論形式で提供すること

## v2.3 Requirements

Requirements for Analysis Quality & Operational Stability. ニュース品質・分析品質・運用安定性・レポートUIの総合的な底上げ。

### News Quality

- [x] **NEWS-01**: Finnhub APIがポートフォリオ保有銘柄のティッカー別ニュースを取得し、汎用ニュースと統合される
- [x] **NEWS-02**: ニュース記事に時間帯重み付け（直近6h以内の記事が優先スコアを持つ）が適用される
- [x] **NEWS-03**: 英語と日本語で同内容のニュース記事がクロス言語重複排除される

### Analysis Quality

- [x] **ANLQ-01**: 前日のmeeting-result.jsonがアナリストのRound 1プロンプトに注入され、前日の推奨銘柄の追跡・見解変化が議論される
- [x] **ANLQ-02**: Round 3スコアリングが専用の並列エージェントとして実行され、Round 2完了を待って起動される

### Operational Stability

- [x] **OPS-01**: 自動実行（launchd）でパイプラインが途中失敗した場合、失敗ステップを特定するエラーログが出力される
- [x] **OPS-02**: docs/index.htmlおよびdocs/portfolio.htmlがスクリプト以外から変更されない保護機構が実装される
- [x] **OPS-03**: 自動実行の開始/完了/失敗がmacOS通知で報告される（実装済み、動作検証）

### Report UI

- [ ] **UI-01**: index.htmlがモダンなデザインに刷新され、モバイルレスポンシブで閲覧できる
- [ ] **UI-02**: Daily ReportにセクターパフォーマンスやVIX推移のインラインチャートが表示される

## Future Requirements

Deferred to v2.4+. Tracked but not in current roadmap.

### News Curation

- **CURA-01**: ニュースキュレーションHTML（news-digest.html）が4紙目のレポートとして生成される

## Out of Scope

| Feature | Reason |
|---------|--------|
| MinHash/LSH重複排除 | 160件/日にはO(n²)で十分、過剰な複雑さ |
| ML/LLMベース関連性スコアリング | 1記事ごとのAPI呼び出しはコスト面で非現実的 |
| 新規アナリスト追加 | 既存5+1構成で十分 |
| リアルタイム株価ストリーミング | 日次バッチで十分 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| NEWS-01 | Phase 11 | Complete |
| NEWS-02 | Phase 11 | Complete |
| NEWS-03 | Phase 11 | Complete |
| ANLQ-01 | Phase 12 | Complete |
| ANLQ-02 | Phase 12 | Complete |
| OPS-01 | Phase 13 | Complete |
| OPS-02 | Phase 13 | Complete |
| OPS-03 | Phase 13 | Complete |
| UI-01 | Phase 14 | Pending |
| UI-02 | Phase 14 | Pending |

**Coverage:**
- v2.3 requirements: 10 total
- Mapped to phases: 10 ✓
- Unmapped: 0

---
*Requirements defined: 2026-06-30*

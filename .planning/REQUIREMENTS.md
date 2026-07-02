# Requirements: Investment Agent v2.4 News Curation Report

**Defined:** 2026-07-02
**Core Value:** 毎日の投資判断に必要な多角的分析を、複数AIアナリストの議論形式で提供すること
**Milestone Goal:** AIが厳選したニュースダイジェスト（news-digest.html）を4紙目のレポートとして日次パイプラインに追加する

## v2.4 Requirements

### News Curation (CURA)

- [ ] **CURA-01**: ニュースキュレーションHTML（news-digest.html）が4紙目のレポートとして docs/YYYY-MM-DD/ に生成される
- [x] **CURA-02**: AIキュレーションステップがフィルタ済み記事プール（20〜80件）から重要記事10〜15件をID参照方式で選定する（URLはTS側で照合、幻覚URL防止）
- [ ] **CURA-03**: 各記事に見出し・ソース名・公開時刻・元記事へのリンクが表示される
- [ ] **CURA-04**: 各記事に日本語の「なぜ重要か」解説コメント（1〜2文）が付与される
- [x] **CURA-05**: 記事が市場別（米国株 / 日本株 / グローバル）にグルーピングされる（zod enumで分類値を制約）
- [ ] **CURA-06**: 各グループ内で記事が重要度順に配列される
- [ ] **CURA-07**: 各記事に重要度バッジ（High / Medium / Low）が表示される（重要度順配列と同一のスコアから導出）
- [ ] **CURA-08**: 各記事に関連ティッカータグが表示される（既存tickerフィールド + キュレーション時のタイトル/サマリーからの抽出）
- [ ] **CURA-09**: ページ冒頭に「今日の市場を動かすもの」リード文（2〜3文の総括パラグラフ）が表示される

### UI Integration (UI)

- [ ] **UI-03**: news-digest.html が既存3レポートと同じBloomberg風ダークテーマ・モバイル対応CSS・レポート間ナビゲーションを備える
- [ ] **UI-04**: index.html の日付エントリに news-digest.html へのリンクがファイル実在時のみ追加される（欠落日は404リンクを生成しない）

### Operational Stability (OPS)

- [ ] **OPS-04**: キュレーションステップの失敗時も既存3レポートの生成・デプロイが継続する（fail-soft設計、独自STEPマーカーによる失敗可視化）

## Future Requirements (v2.5+)

Deferred. Tracked but not in current roadmap.

### Cross-Report Integration

- **XREP-01**: ダイジェスト記事に当日ミーティングで議論されたテーマへの関連注記を表示（パイプライン順序依存が生じるためコア検証後に導入）

## Out of Scope

| Feature | Reason |
|---------|--------|
| 記事ごとのセンチメント数値スコア | LLM由来の疑似定量値は誤った精度感を与える（High/Medium/Lowの定性バッジで代替） |
| 記事本文のAIフルパラフレーズ | 幻覚リスク面積の拡大、既存アナリスト散文と重複（1〜2文コメント+元記事リンクで代替） |
| ダイジェスト専用の新規ニュース取得パイプライン | 既存 filter.ts 出力の再利用で十分（PROJECT.md制約） |
| イントラデイ更新 | 日次バッチで十分（既存Out of Scope決定を踏襲） |
| 読者パーソナライズ設定（トピックフィルタ等） | 単一ユーザーの静的HTMLツールに設定基盤は過剰 |
| EN/JP言語トグル | 全コメント日本語固定（既存レポートと同一慣例） |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CURA-01 | Phase 17 | Pending |
| CURA-02 | Phase 15 | Complete |
| CURA-03 | Phase 16 | Pending |
| CURA-04 | Phase 16 | Pending |
| CURA-05 | Phase 15 | Complete |
| CURA-06 | Phase 16 | Pending |
| CURA-07 | Phase 16 | Pending |
| CURA-08 | Phase 16 | Pending |
| CURA-09 | Phase 16 | Pending |
| UI-03 | Phase 16 | Pending |
| UI-04 | Phase 18 | Pending |
| OPS-04 | Phase 17 | Pending |

---
*Last updated: 2026-07-02 — roadmap created (Phases 15-18)*

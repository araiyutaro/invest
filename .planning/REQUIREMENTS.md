# Requirements: Investment Agent

**Defined:** 2026-06-26
**Core Value:** 毎日の投資判断に必要な多角的分析を、複数AIアナリストの議論形式で提供すること

## v2.2 Requirements

Requirements for News Quality & Pipeline Metrics. ニュース収集の品質改善とパイプライン実行時間の計測。

### News Deduplication

- [ ] **DEDUP-01**: Finnhub / Google News / RSS間でURL完全一致による重複記事が排除される
- [ ] **DEDUP-02**: タイトルのNFKC正規化（全角→半角、【速報】等プレフィックス除去）後のJaccard類似度による重複記事が排除される
- [ ] **DEDUP-03**: 既存rss-sources.tsの50文字プレフィックスdedupがタイトル正規化Jaccardに置換される

### News Filtering

- [ ] **FILT-01**: 非投資記事（スポーツ、芸能、天気等）がキーワードdenylistにより除外される
- [ ] **FILT-02**: 全ニュースソースに統一の24時間以内時間フィルタが適用される
- [ ] **FILT-03**: フィルタ処理前後の記事数統計（生→dedup後→フィルタ後）がログに出力される
- [ ] **FILT-04**: フィルタ後の記事数にフロア（MIN=20）とシーリング（MAX=80）が設けられる

### Pipeline Integration

- [ ] **INTG-01**: collect-data.tsがフィルタ済み記事のみをtmp/news.jsonに書き込む
- [ ] **INTG-02**: invest.mdの50件ハードコード上限が除去され、フィルタ済み全記事がアナリストに渡される

### Pipeline Metrics

- [ ] **METR-01**: パイプライン全体の実行時間が最終出力に表示される
- [ ] **METR-02**: ステップ別内訳（データ収集、各分析ラウンド、レポート生成、デプロイ）が表示される

## Future Requirements

Deferred to v2.3+. Tracked but not in current roadmap.

### Enhanced News

- **ENH-04**: Finnhubのポートフォリオティッカー別ニュース取得
- **ENH-05**: 時間帯重み付け（直近6h優先）
- **ENH-06**: クロス言語（英↔日）重複排除（埋め込みモデル必須）

### Enhanced Analysis (from v2.1)

- **ENH-01**: スコアリングラウンドを専用並列サブエージェントで実行
- **ENH-02**: 前日レポートの注入によるクロスセッション分析記憶
- **ENH-03**: スキル自動起動のチューニング

## Out of Scope

| Feature | Reason |
|---------|--------|
| MinHash/LSH重複排除 | 160件/日にはO(n²)で十分、過剰な複雑さ |
| ML/LLMベース関連性スコアリング | 1記事ごとのAPI呼び出しはコスト面で非現実的 |
| アナリスト別記事パーソナライズ | 全アナリスト共通フィードで十分、v2.2スコープ外 |
| allowlist方式フィルタ | 54%の正規投資記事を誤除外するリスク（Reuters実証） |
| チャート画像生成 | テキストベースで十分、Claude Code内で画像生成不可 |
| 新規アナリスト追加 | 既存5+1構成で十分 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DEDUP-01 | Phase 8 | Pending |
| DEDUP-02 | Phase 8 | Pending |
| DEDUP-03 | Phase 8 | Pending |
| FILT-01 | Phase 8 | Pending |
| FILT-02 | Phase 8 | Pending |
| FILT-03 | Phase 9 | Pending |
| FILT-04 | Phase 9 | Pending |
| INTG-01 | Phase 9 | Pending |
| INTG-02 | Phase 9 | Pending |
| METR-01 | Phase 10 | Pending |
| METR-02 | Phase 10 | Pending |

**Coverage:**
- v2.2 requirements: 11 total
- Mapped to phases: 11
- Unmapped: 0 ✓

---
*Requirements defined: 2026-06-26*
*Last updated: 2026-06-26 — traceability mapped after roadmap creation*

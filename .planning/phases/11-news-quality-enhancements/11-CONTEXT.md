# Phase 11: News Quality Enhancements - Context

**Gathered:** 2026-06-30
**Status:** Ready for planning

<domain>
## Phase Boundary

アナリストに供給されるニュースの品質を向上させる。Finnhubティッカー別カンパニーニュース取得・時間帯重み付けスコアリング・クロス言語（英日）重複排除の3機能を実装し、既存のニュースパイプライン（collect-data.ts → filter.ts → tmp/news.json）に統合する。

</domain>

<decisions>
## Implementation Decisions

### ティッカー別ニュース取得 (NEWS-01)
- **D-01:** Finnhub `/api/v1/company-news` エンドポイントで**米国銘柄のみ**を対象とする（MRNA, JOBY, HII, POWL, FLNC, EE, NXT, BWMX の8銘柄）。日本銘柄（.T系4銘柄）はFinnhub非対応のためRSSでカバー済み
- **D-02:** ティッカー別ニュースと汎用ニュース（general/merger）は**フラット統合**して同じ allArticles 配列に入れる。既存のURL dedup + Jaccard title dedupが重複を自動除去する
- **D-03:** `RawNewsArticle` 型にオプショナルな `ticker?: string` フィールドを追加。Finnhub company-news経由の記事にはティッカーシンボルを付与し、汎用ニュース・RSS記事は undefined

### 時間帯重み付け (NEWS-02)
- **D-04:** 数値スコアを計算して記事のソート順を決定する。時間帯ティア: 0-6h → 1.0, 6-12h → 0.7, 12-24h → 0.4
- **D-05:** ポートフォリオ保有銘柄のティッカー別ニュースには**ボーナススコア**（+0.2程度）を加算。時間スコアと加算で組み合わせる
- **D-06:** スコアは**ソート専用**で使用。RawNewsArticle の型にはスコアフィールドを追加しない。filter パイプライン内でスコア計算→ソート→MAX=80キャップの順で処理し、アナリストにはスコア順に並んだ記事が届く

### クロス言語dedup (NEWS-03)
- **D-07:** **固有名詞＋日付近接**ヒューリスティックで実装する。英語・日本語タイトルから数値・英字固有名詞（企業名、経済指標名など）を抽出し、発行日時が6時間以内なら同一記事と判定
- **D-08:** **保守的**アプローチ — 確実に同一と判断できるもののみ統合。同内容の英日記事が残ることは許容し、重要な記事を誤って落とすリスクを排除する
- **D-09:** クロス言語重複が検出された場合、**summaryが長い方**を残す（既存の同一言語dedup D-02ルールと一貫性を保つ）
- **D-10:** npm依存はゼロ（v2.2からの方針継続）。固有名詞抽出はネイティブ正規表現ベースで実装

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### ニュースパイプライン
- `src/data/news/finnhub.ts` — 現在のFinnhub API統合。company-newsエンドポイント追加の起点
- `src/data/news/filter.ts` — 既存のdedup・フィルタロジック（URL dedup, Jaccard title dedup, denylist, time filter）。クロス言語dedup・スコアリングの追加先
- `src/data/news/types.ts` — RawNewsArticle型定義。tickerフィールド追加先
- `src/data/news/rss-sources.ts` — RSS取得ロジック（日本語ニュースソース）
- `src/data/news/google-news.ts` — Google News Japan RSS取得
- `src/scripts/collect-data.ts` — ニュース統合・フィルタ適用・tmp/news.json出力のメインフロー

### ポートフォリオ
- `src/portfolio/holdings.ts` — ポートフォリオ銘柄リスト（company-news対象ティッカーの参照元）

### テスト
- `src/data/news/filter.test.ts` — 既存のフィルタテスト。新機能のテスト追加先

### 先行フェーズの決定事項
- `.planning/REQUIREMENTS.md` — NEWS-01, NEWS-02, NEWS-03 の要件定義
- `.planning/STATE.md` — v2.2からの引き継ぎ決定事項（Jaccard閾値0.75、二層dedup構造、npm依存ゼロ）

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `filterNewsArticles()` (filter.ts): 4パスフィルタパイプライン。クロス言語dedup・スコアリングの追加パスを挿入可能
- `normalizeTitle()` / `tokenize()` / `jaccardSimilarity()` (filter.ts): 既存のテキスト処理ユーティリティ。固有名詞抽出の基盤として活用可能
- `isJapaneseTitle()` (filter.ts): 言語判定ロジック。クロス言語dedupのペア検出に使用
- `fetchNewsByCategory()` (finnhub.ts): Finnhub API呼び出しパターン。company-newsエンドポイントも同様のパターンで実装

### Established Patterns
- **二層dedup**: URL dedup → Title Jaccard dedupの順。クロス言語dedupは新しい第3層として挿入
- **グレースフルデグラデーション**: API失敗時は空配列を返却（finnhub.ts L59-66）
- **イミュータブルデータ**: readonly型、新オブジェクト生成パターン
- **MAX=80 / MIN=20 キャップ**: collect-data.ts L46-54のフィルタ後記事数制限

### Integration Points
- `collect-data.ts L32-42`: `fetchAllFinnhubNews()` 呼び出し。company-news取得を追加
- `collect-data.ts L37-41`: allArticles 配列構築。ティッカー別ニュースを統合
- `collect-data.ts L43`: `filterNewsArticles()` 呼び出し。スコアリング→ソートをこの前後に統合
- `filter.ts L179-197`: `filterNewsArticles()` パイプライン。クロス言語dedupパスを追加

</code_context>

<specifics>
## Specific Ideas

- 時間スコアのティア: 0-6h = 1.0, 6-12h = 0.7, 12-24h = 0.4（連続関数ではなく離散ティア）
- ティッカーボーナス: +0.2（目安、研究・計画フェーズで調整可）
- クロス言語dedup: Reuters英語版↔ロイター日本語版のような典型ケースを想定したテストケース作成

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 11-News Quality Enhancements*
*Context gathered: 2026-06-30*

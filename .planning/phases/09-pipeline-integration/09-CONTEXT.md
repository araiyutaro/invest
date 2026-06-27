# Phase 9: Pipeline Integration - Context

**Gathered:** 2026-06-28
**Status:** Ready for planning

<domain>
## Phase Boundary

filter.ts を collect-data.ts と invest.md に統合し、フィルタ済み記事（MIN=20, MAX=80件）のみが tmp/news.json に書き込まれ、アナリストに供給される。

</domain>

<decisions>
## Implementation Decisions

### 記事供給方式 (invest.md)
- **D-01:** 50件ハードキャップを除去し、フィルタ済み**全記事**をアナリストに供給する。MAX=80なのでトークン増加は最大60%程度で許容範囲内

### フロア/シーリング挙動
- **D-02:** MIN=20フォールバック戦略、MAX=80超過時のトリミング基準、MIN/MAX制御の配置（filter.ts内 vs collect-data.ts側）はすべてClaude裁量

### 統計ログ
- **D-03:** コンソールに出力する統計ログのフォーマット・粒度はClaude裁量。Success Criteria は「生記事数 → dedup後 → フィルタ後」の3段階を要求しているが、filterNewsArticles() の stats は5段階を返す。どのレベルで集約するかは実装時に判断

### invest.md 表記変更
- **D-04:** 「最新50件」表記の具体的な書き換え方（「全件」表記 vs 表記削除 vs 動的件数）はClaude裁量

### Claude's Discretion
- MIN=20 未満時の対応方針（そのまま進行 / フィルタ緩和 / 警告ログのみ）
- MAX=80 超過時のトリミング基準（時間順 / ソース多様性確保）
- MIN/MAX制御ロジックの配置先（filter.ts vs collect-data.ts）
- 統計ログの出力フォーマット・粒度
- invest.md の「最新50件」表記の書き換え方

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### フィルタモジュール
- `src/data/news/filter.ts` — filterNewsArticles() ピュア関数、Phase 8 で構築済み。統合時の呼び出し元
- `src/data/news/types.ts` — RawNewsArticle型、NewsFilterResult型の定義

### 統合対象ファイル
- `src/scripts/collect-data.ts` — filter.ts を import して allArticles に適用する変更対象（INTG-01, FILT-03, FILT-04）
- `.claude/commands/invest.md` — 「最新50件」ハードキャップの除去対象（INTG-02）。5箇所で「最新50件」を参照中

### Phase 8 コンテキスト
- `.planning/phases/08-news-filter-module/08-CONTEXT.md` — filter.ts の設計決定（D-01〜D-08）

### 要件定義
- `.planning/REQUIREMENTS.md` — INTG-01, INTG-02, FILT-03, FILT-04 の要件定義

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `filterNewsArticles()` (filter.ts): 入力 ReadonlyArray<RawNewsArticle> → 出力 NewsFilterResult { articles, stats }。そのまま collect-data.ts で呼び出し可能
- `NewsFilterResult.stats`: raw, afterUrlDedup, afterTitleDedup, afterRelevance, final の5段階統計が返却済み。FILT-03 のログ出力にそのまま使える
- `normalizeUrl()`, `normalizeTitle()`, `tokenize()`, `jaccardSimilarity()`, `isDenylisted()`, `filterByRelevance()`, `filterByTime()`: 個別エクスポート済み、統合テストでの直接アサート可能

### Established Patterns
- **tmp/ JSON 境界**: TSスクリプトは tmp/*.json に書き出し、invest.md の Claude がそれを読む
- **console.log によるログ出力**: 集中ロガーなし、直接 console.log/error を使用
- **Promise.all による並列フェッチ**: collect-data.ts は既に3ソースを並列取得済み
- **イミュータブルデータ構造**: readonly型、関数はコピーを返す

### Integration Points
- `collect-data.ts main()` 内の allArticles 結合直後（L35-40）が filter.ts 呼び出しポイント
- `invest.md` 内の5箇所の「最新50件」表記（L72, L94-95, L130-131, L166-167, L202-203, L238-239）が変更対象
- filter.ts はピュア関数のみ（I/Oなし）なので、collect-data.ts からの呼び出しは副作用なし

</code_context>

<specifics>
## Specific Ideas

- Phase 8 CONTEXT.md の D-04 により、rss-sources.ts の50文字プレフィックスdedupは既に削除済み。Phase 9 は filter.ts の呼び出し統合のみに集中
- allArticles が既に publishedAt: Date を持っているが、JSON.stringify で文字列化される。invest.md 側では文字列として読むだけなので問題なし（フィルタは collect-data.ts 側で適用済み）

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 9-Pipeline Integration*
*Context gathered: 2026-06-28*

# Phase 8: News Filter Module - Context

**Gathered:** 2026-06-26
**Status:** Ready for planning

<domain>
## Phase Boundary

クロスソース重複排除・関連性フィルタ・時間フィルタを一元管理するピュア関数モジュール `src/data/news/filter.ts` をTDDで構築する。既存の `rss-sources.ts` 内の50文字プレフィックスdedupを完全に置換し、全ソース横断のフィルタリングを実現する。

</domain>

<decisions>
## Implementation Decisions

### 重複排除 (Deduplication)
- **D-01:** Jaccard類似度の閾値は **0.75** に設定する（NFKC正規化後のトークンJaccard）。0.70は積極的すぎ、0.80は保守的すぎるためバランスを取る
- **D-02:** 重複記事が見つかった場合、**summaryが長い方を残す**（アナリストへの情報量を最大化するため）
- **D-03:** クロス言語（英↔日）重複排除は**行わない**。同一言語グループ内のみでdedup
- **D-04:** 既存 `rss-sources.ts` の50文字プレフィックスdedup（155-161行目）は**完全削除**し、filter.tsに一元化する。二層構造にはしない

### 関連性フィルタ (Relevance Filtering)
- **D-05:** マッチング方式は**除外+例外ルール**方式を採用する。denylistキーワードにマッチしても、投資関連キーワード（株、決算、上場、金利 等）が同時に存在すれば記事を通す
- **D-06:** 除外対象カテゴリは**娯楽・スポーツ・天気**の3ジャンル。政治・社会は除外しない（政策・規制は投資に影響するため）
- **D-07:** フィルタ方式は**denylist（ブロックリスト）のみ**。allowlist方式は54%の正規投資記事を誤除外するリスクがあるため使用しない

### 時間フィルタ (Time Filter)
- **D-08:** 全ソースに統一の24時間以内フィルタを適用する（現状はFinnhubのみ）

### Claude's Discretion
- denylistの具体的なキーワードリストの策定（実データの傾向を見て調整可能）
- NFKC正規化の詳細実装（【速報】等のブラケットプレフィックス除去パターン）
- URL正規化の具体的な方法（Google Newsリダイレクト等の処理）
- `NewsFilterResult` / `NewsFilterStats` の型設計

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### ニュースデータ型・収集ロジック
- `src/data/news/types.ts` — RawNewsArticle型定義（filter.tsの入出力型）
- `src/data/news/rss-sources.ts` — 既存dedup（155-161行目）の削除対象、RSSソース定義
- `src/data/news/finnhub.ts` — Finnhub 24hフィルタの参考実装
- `src/data/news/google-news.ts` — Google Newsフェッチャー

### パイプライン統合
- `src/scripts/collect-data.ts` — filter.tsの呼び出し元（Phase 9で統合）
- `.claude/commands/invest.md` — 50件ハードキャップの除去対象（Phase 9）

### リサーチ成果
- `.planning/research/SUMMARY.md` — 全リサーチの統合サマリー
- `.planning/research/STACK.md` — Dice/Jaccard実装例
- `.planning/research/FEATURES.md` — テーブルステークス・アンチフィーチャー定義
- `.planning/research/PITFALLS.md` — 実装時の落とし穴

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `RawNewsArticle` 型（types.ts）: filter.tsの入出力型としてそのまま使用可能
- Finnhubの24h時間フィルタ（finnhub.ts 39-42行目）: 時間フィルタのパターン参考
- rss-sources.tsの `stripHtmlTags` / `decodeHtmlEntities`: タイトル正規化の前段階

### Established Patterns
- **Immutable data structures**: readonly型アノテーション必須
- **null返却パターン**: 失敗時はthrowではなくnull返却 + filter
- **ESM**: `.js` 拡張子のインポート
- **console.log/error**: 集中ロガーなし、直接console使用

### Integration Points
- `collect-data.ts` の `main()` 内で全フェッチャーの結果を結合した直後に filter.ts を呼び出す（Phase 9で統合）
- filter.ts 自体はI/Oを持たないピュア関数のみ — 単体テストが容易

</code_context>

<specifics>
## Specific Ideas

- Jaccard類似度は実データで閾値の妥当性を確認する（Phase 8完了後にtmp/news.jsonで検証）
- denylistは初期リストを小さめにし、実運用で偽陽性・偽陰性を確認しながら調整する方針

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 8-News Filter Module*
*Context gathered: 2026-06-26*

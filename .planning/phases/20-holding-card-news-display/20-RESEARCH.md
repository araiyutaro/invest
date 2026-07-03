# Phase 20: Holding-Card News Display — リサーチ

**調査日:** 2026-07-03
**フェーズ:** 20 — Holding-Card News Display
**要件:** UI-05, UI-06

## サマリー

本フェーズは新規技術・新規ライブラリを必要としない。v2.4 news-digest で確立した3パターン（`resolveNewsCuration` のID参照解決、`loadPortfolioAnalysis` 型の fail-soft ローダー、`formatArticleCardHtml` / `formatPublishedAtJst` のニュースHTML描画）をポートフォリオレポートに移植する作業である。Phase 19 の成果物 `tmp/holding-news.json`（ID参照+マッチメタ）を `tmp/news.json` と照合解決し、`formatHoldingEvaluationsHtml()` にニュースサブセクションを追加する。

## 確立済みパターン

### 1. ID参照解決（v2.4 `resolveNewsCuration` — src/meeting/schemas.ts:243、使用元 src/scripts/write-news-digest.ts）
- LLM出力はIDのみ、URL/タイトルはTS側で `tmp/news.json` から照合取得
- 見つからないIDはスキップ+ログ（throw しない）
- Phase 20 では `resolvePortfolioHoldingNews()` として `src/portfolio/holding-news.ts` に同型実装

### 2. fail-soft ローダー（`loadPortfolioAnalysis` — src/scripts/report-data-loaders.ts）
- zod parse + 失敗時 null 返却 + console.error、レポート生成継続
- holding-news.json / news.json の読み込みで踏襲（D-09）

### 3. ニュースHTML描画（`formatArticleCardHtml` / `formatPublishedAtJst` — src/scripts/generate-news-digest.ts:31,65）
- リンク淡色（#93c5fd / visited #c4b5fd）+ `target="_blank" rel="noopener noreferrer"`
- `escapeHtml()` を title / source に適用
- 公開日時は `formatPublishedAtJst()` と同方式: publishedAt 文字列のみから JST 絶対時刻を導出（実行時刻依存の相対時刻APIは使わない — アーカイブ整合性、news-digest D-02）

## 推奨アーキテクチャ

1. **リゾルバー:** `resolvePortfolioHoldingNews(holdingNews: HoldingNewsFile | null, articles: NewsArticleWithId[] | null): Map<string, ResolvedHoldingNews[]>` を `src/portfolio/holding-news.ts` に純粋関数で追加（TDD）。ID→記事の Map を先に構築し O(N+M) で解決。銘柄間ID混入は「その銘柄のエントリ由来のIDのみ解決」で構造的に防止し、テストでカバー
2. **ローダー:** `report-data-loaders.ts` に `loadHoldingNewsResolved()` を追加（内部で holding-news.json + news.json を読み、リゾルバーを呼ぶ。どちらか欠損で空 Map）
3. **描画:** `formatHoldingEvaluationsHtml(evaluations, resolvedNewsByTicker?: Map<string, ResolvedHoldingNews[]>)` にシグネチャ拡張。rationale/riskNote の下に「関連ニュース」サブセクション（h4級の小見出し+ul）。0件時は「本日の関連ニュースなし」ミュートグレー1行（D-08）。name/alias マッチには小さなグレーバッジ「社名一致」（D-07）
4. **統合:** `generate-report.ts:101-110` の `Promise.all` に `loadHoldingNewsResolved()` を追加し、`generatePortfolioReportHtml()` へ受け渡し。portfolioAnalysis null パスでは news も自然にスキップ（変更不要、確認のみ）

## 落とし穴（PITFALLS）

- UI側で再絞り込み・並べ替えをしない（D-04/D-05 — 供給順=表示順、透明性原則）
- `escapeHtml()` 漏れ（title/source/バッジ文言すべてに適用）
- URL は照合結果からのみ取得（LLM出力のURLフィールドが将来追加されても無視する設計を維持）
- 公開日時は JST 変換して簡潔表示（`formatPublishedAtJst`（generate-news-digest.ts:31）の方式を踏襲。相対時刻は不使用）
- 空セクション省略は不可（「ニュースなし」と「機能故障」の区別 — PITFALLS.md）

## Validation Architecture

**Framework:** vitest ^4.0.18（package.json devDependencies で確認済み）
**Config:** なし（vitest デフォルト設定。専用 config ファイルは存在しない）
**Quick run:** `npx vitest run src/portfolio/holding-news.test.ts`
**Full suite:** `npm test`（= `vitest run`）
**Estimated runtime:** quick ~2s / full ~15s

**要件別テストマッピング:**

| 要件 | 検証対象 | テスト種別 | 内容 |
|------|---------|-----------|------|
| UI-05 | resolvePortfolioHoldingNews | unit (TDD) | ID照合解決・欠損IDスキップ・銘柄間ID混入防止・上限5件パススルー |
| UI-05 | formatHoldingEvaluationsHtml | unit | 見出し/ソース/リンクhref が news.json 由来値と一致、escapeHtml 適用、バッジ表示条件 |
| UI-06 | formatHoldingEvaluationsHtml | unit | 0件銘柄で「本日の関連ニュースなし」出力、カード構造維持（agent-card クラス保持） |
| UI-05/06 | loadHoldingNewsResolved | unit | ファイル欠損/パース失敗で空 Map + エラーログ、レポート生成継続 |
| UI-05/06 | ライブ描画 | manual | 実データで日本株0件銘柄カードの正常描画・リンク遷移を目視確認 |

**Wave 0:** 不要 — 既存テスト基盤（vitest + 既存 holding-news.test.ts / generate-report.test.ts の流儀）で全要件カバー可能。

**サンプリング:** タスクコミット毎に quick、プランwave毎に full。

## オープン確認事項

なし（ブロッカーなし。CONTEXT.md D-01〜D-10 はすべて既存パターンで実装可能）

---

*Phase: 20-holding-card-news-display*
*Researched: 2026-07-03*

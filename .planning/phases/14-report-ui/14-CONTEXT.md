# Phase 14: Report UI - Context

**Gathered:** 2026-07-01
**Status:** Ready for planning

<domain>
## Phase Boundary

index.htmlをモバイルレスポンシブ対応に刷新し、Daily ReportにVIX推移・セクターパフォーマンスのインラインチャートを追加する。全HTMLレポート（daily-report, meeting-minutes, portfolio-report）もモバイル対応する。

</domain>

<decisions>
## Implementation Decisions

### index.html リデザイン (UI-01)
- **D-01:** 最新レポートをヒーローセクションとして大きく表示し、過去のレポートは月別のアコーディオン（`<details>/<summary>`）でグループ化する。JS不要のCSS/HTMLのみ実装
- **D-02:** 最新月のアコーディオンはデフォルトで展開（`open` 属性）、それ以前の月は折りたたみ状態にする
- **D-03:** 既存のBloomberg風ダークテーマ（`#0f0f1a` 背景、`#3b82f6` アクセント）を維持しながらモダンなデザインに刷新する

### チャート実装 (UI-02)
- **D-04:** インラインSVG生成方式を採用。generate-report.ts（または generate-daily-report.ts）がデータからSVGタグを直接生成してHTMLに埋め込む。外部ライブラリ不要、オフライン表示可能
- **D-05:** セクターパフォーマンスチャートは横バーチャート形式。プラスが緑系（`#10b981`）、マイナスが赤系（`#ef4444`）。market.json の sectors データ（11セクター分の changePercent）を使用
- **D-06:** VIX推移チャートは折れ線グラフ形式。yahoo-finance2 の chart() API で過去30日分の ^VIX データを取得し、collect-data.ts の market.json に `vixHistory` フィールドとして追加

### VIXデータ取得 (UI-02)
- **D-07:** collect-data.ts に VIX 履歴取得を追加。yahoo-finance2 の `chart("^VIX", { period1: "30d ago" })` 相当で過去30日分の日次終値を取得
- **D-08:** 取得したVIXデータは market.json の `vixHistory: [{date, close}]` 形式で保存

### モバイルレスポンシブ (UI-01)
- **D-09:** 全HTMLファイル（index.html, daily-report, meeting-minutes, portfolio-report, portfolio.html）にレスポンシブCSSを適用
- **D-10:** 375px幅（iPhone SE相当）をブレークポイントとして、テーブルの横スクロール防止、フォントサイズ調整、ボタンのタップ領域拡大を行う
- **D-11:** `@media (max-width: 768px)` でカラム幅・パディング・フォントサイズを調整する

### Claude's Discretion
- SVGチャートの具体的なサイズ・レイアウト・アニメーションの有無は実装時に判断
- index.html のヒーローセクションの具体的なデザイン要素（アイコン、サマリー情報等）は実装時に判断
- レスポンシブCSS の具体的なブレークポイント値とスタイル調整の詳細は実装時に判断

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### レポート生成パイプライン
- `src/scripts/generate-report.ts` — レポート生成エントリポイント。3ファイル出力の制御
- `src/scripts/generate-daily-report.ts` — Daily Report HTML生成。チャートSVG挿入先
- `src/scripts/collect-data.ts` — 市場データ収集。VIX履歴取得の追加先

### 対象HTMLファイル
- `docs/index.html` — レポート一覧ランディングページ（リデザイン対象・Phase 13で保護対象）
- `docs/portfolio.html` — ポートフォリオ一覧ページ（モバイル対応対象・Phase 13で保護対象）

### データ
- `tmp/market.json` — 市場データ。indices[] と sectors[] を含む。VIX履歴の追加先

### 要件
- `.planning/REQUIREMENTS.md` — UI-01, UI-02 の要件定義

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Bloomberg風ダークテーマCSS: `#0f0f1a` 背景、`#3b82f6` アクセント、`#1e1e2e` カード背景 — 全HTMLで統一済み
- `viewport` メタタグ: 全HTMLに既存（`width=device-width, initial-scale=1.0`）
- `generate-daily-report.ts`: HTML文字列をテンプレートリテラルで構築するパターン — SVG生成もこのパターンに統合可能

### Established Patterns
- HTMLレポートは `generate-report.ts` → 個別ジェネレータ → docs/YYYY-MM-DD/ に出力
- index.html は generate-report.ts が `<!-- REPORT_ENTRIES -->` マーカーの直前に新エントリを挿入する方式
- market.json は yahoo-finance2 v3 (`new YahooFinance()`) で取得、JSON.stringify で保存

### Integration Points
- index.html 更新: generate-report.ts の `updateIndexHtml()` 関数
- Daily Report HTML: `generateDailyReportHtml()` の戻り値にSVGチャートセクションを追加
- market.json: collect-data.ts の `collectMarketData()` にVIX履歴取得を追加

</code_context>

<specifics>
## Specific Ideas

- セクターパフォーマンスは横バーチャートで、値の大きい順にソートして表示
- VIX推移は30日間の折れ線グラフで、20/30のしきい値ラインを点線で表示するとリスク水準が直感的に分かる

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 14-report-ui*
*Context gathered: 2026-07-01*

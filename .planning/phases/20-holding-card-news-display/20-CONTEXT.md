# Phase 20: Holding-Card News Display - Context

**Gathered:** 2026-07-03
**Status:** Ready for planning

<domain>
## Phase Boundary

レポート閲覧者が、ポートフォリオレポートの各保有銘柄カード上で、判断根拠となった関連ニュース（見出し・ソース名・元記事リンク）を直接確認できる。

具体的な成果物:
1. `tmp/holding-news.json`（Phase 19 成果物、ID参照 + マッチメタ情報）を `tmp/news.json` と照合解決する決定論的リゾルバー（TS側でURL解決、LLM出力のURLは一切信用しない。UI-05）
2. `src/scripts/generate-portfolio-report.ts` の保有銘柄カード（`formatHoldingEvaluationsHtml`）への関連ニュースサブセクション追加（銘柄あたり最大5件。UI-05）
3. 関連ニュース0件の銘柄（日本株小型株等）の明示的な空状態表示と、レイアウト崩れのない正常描画（UI-06）

判断根拠（rationale）へのニュース反映・緊急度フラグ・変化バッジは Phase 22、WebSearchリサーチは Phase 21、新規組入候補セクション削除は Phase 23 の対象であり本フェーズには含まない。

</domain>

<decisions>
## Implementation Decisions

**注:** ユーザーは本フェーズの実装判断を全面的に Claude に委任した（「全部おまかせします」）。以下は Claude が既存パターン・前フェーズ決定・リサーチ文書に基づいて確定した推奨決定。

### カード内レイアウト
- **D-01:** ニュースは各カードの rationale（+ riskNote）の下に**常時表示のコンパクトリスト**として組み込む。折りたたみ（`<details>`）は不採用 — 最大5件なら常時表示で一覧性が高く、印刷・スクリーンショットでも情報が失われない
- **D-02:** サブセクションは小さな見出し（例:「関連ニュース」）+ 箇条書きリスト。**テーブルは不採用**（LLM生成の長文と相性が悪い既存知見を踏襲。ここは決定論的データだが、モバイル表示と統一感のためリストを維持）
- **D-03:** リンクはダークテーマ用の**明示的な淡色指定**（#93c5fd / visited #c4b5fd — 過去フィードバックの踏襲）。`target="_blank" rel="noopener noreferrer"` で外部遷移

### 表示件数と並び順
- **D-04:** `holding-news.json` の全エントリ（最大5件）を**そのまま全件表示**。別の絞り込みは行わない — Phase 19 D-09 の透明性原則「カードに見えているニュース = portfolio-analyst の判断に使われたニュース」を厳密に維持する
- **D-05:** 並び順は holding-news.json の**供給順を踏襲**（ticker一致優先 → 優先度スコア降順。Phase 19 D-10 の順序）。公開日時での並べ替えは行わない — 確実性の高いマッチが常に上位に見える

### 各ニュースのメタ情報
- **D-06:** 各項目は **見出し（リンク）・ソース名・公開日時（JST、簡潔表示）** を表示。優先度スコアは内部値のため非表示
- **D-07:** **社名一致・エイリアス一致の記事にのみ**控えめなグレーのバッジ（例:「社名一致」）を付与。ticker一致は無印（デフォルト）。Phase 19 の deferred「社名フォールバックの実測誤マッチ監査」をレポート上で目視可能にする、ノイズ最小の設計

### 空状態・欠損時の表現
- **D-08:** 0件銘柄も「関連ニュース」見出しは出し、その下にミュートグレーの1行「本日の関連ニュースなし」を表示。**セクション自体の省略は不採用** — 「ニュースがない」と「機能が壊れている」を閲覧者が区別できるようにする（PITFALLS.md の推奨に従う）
- **D-09:** `tmp/holding-news.json` が欠損・パース失敗の場合は**全銘柄0件と同じ扱い**でレポート生成を継続（fail-soft、console.error でログ）。レポート生成を throw で止めない
- **D-10:** ID照合で `tmp/news.json` に存在しないIDは**そのエントリのみスキップ**（ログ出力）。解決できたものだけ描画 — 幻覚URL防止の最終ガード。加えて、リゾルバーは記事IDがその銘柄のマッチ済みサブセットに属することを前提とし、銘柄間のID混入を検証テストでカバーする（PITFALLS.md 検証チェックリスト項目）

### Claude's Discretion
- リゾルバー関数の配置と命名（リサーチ SUMMARY.md は `resolvePortfolioHoldingNews()` を示唆。v2.4 の `resolveNewsCuration` パターン踏襲が自然）
- 「関連ニュース」見出しの正確な文言・フォントサイズ・余白等のスタイル詳細
- 公開日時のフォーマット（相対 or 絶対。既存レポートの表記と統一）
- generate-report.ts / report-data-loaders.ts への読み込み処理の組み込み方（既存の loadPortfolioAnalysis パターン踏襲が自然）
- ユニットテストの構成（既存の generate-report.test.ts / holding-news.test.ts の流儀に従う）

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 要件・ロードマップ
- `.planning/REQUIREMENTS.md` — UI-05 / UI-06 の正確な要件文言（ID参照方式・3〜5件上限・0件正常描画）
- `.planning/ROADMAP.md` §Phase 20 — Success Criteria 2項目（ID照合解決ニュース表示・0件銘柄の明示的空状態）

### 前フェーズの決定（データ供給側の契約）
- `.planning/phases/19-data-foundation-holding-news-supply/19-CONTEXT.md` — D-05（ID参照+マッチメタ）、D-07（URL非注入）、D-09（供給上限5件=UI表示と同一集合）、D-10（ticker優先ソート）。Phase 20 はこの契約の消費側

### v2.5 マイルストーンリサーチ
- `.planning/research/SUMMARY.md` §Phase 2 — 本フェーズ相当の推奨実装（`resolvePortfolioHoldingNews()` 決定論的解決、LLM由来URLを信用しない、明示的空状態）
- `.planning/research/PITFALLS.md` — 空セクション無説明問題（「本日関連ニュースなし」明示の推奨）、検証チェックリスト（日本株保有銘柄のライブ描画確認、銘柄間ID混入の検証）

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/scripts/generate-portfolio-report.ts` の `formatHoldingEvaluationsHtml()` — 保有銘柄カードのレンダラー。ニュースサブセクションの追加先
- `src/portfolio/holding-news.ts` の `HoldingNewsFile` / `HoldingNewsEntry` 型 — holding-news.json の形状（`{id, matchType, score}`、matchType: "ticker" | "name" | "alias"）。リゾルバーの入力型
- `src/data/news/article-id.ts` の `NewsArticleWithId` 型 — news.json の記事形状（id / title / source / url / publishedAt）。ID照合解決先
- `src/scripts/report-utils.ts` の `escapeHtml` / `generateBaseStyles` — 既存のHTMLエスケープ・スタイル基盤
- `src/scripts/report-data-loaders.ts` の `loadPortfolioAnalysis()` — tmp JSON の zod パース + null フォールバックの読み込みパターン。holding-news / news の読み込みで踏襲

### Established Patterns
- ID参照方式の照合解決（v2.4 news-digest の `resolveNewsCuration`）: TS側でIDをnews.jsonと照合し、URLは常に照合結果から取得 → D-10 が踏襲
- fail-soft: 読み込み失敗時は null / 空を返してレポート生成を継続 → D-09 が踏襲
- ダークテーマリンクの明示的淡色（#93c5fd / #c4b5fd）→ D-03 が踏襲
- TDD + 純粋関数切り出し: holding-news.ts / write-news-digest.ts はテストファースト済み → リゾルバーも同様
- カードは `agent-card` クラス + `border-left-color` によるステータス色分け → ニュースサブセクションもこの構造内に収める

### Integration Points
- `src/scripts/generate-report.ts:101-110` — `loadPortfolioAnalysis()` との並列読み込みに holding-news / news の読み込みを追加し、`generatePortfolioReportHtml()` へ解決済みニュースを渡す（シグネチャ拡張）
- `tmp/holding-news.json` + `tmp/news.json` — Phase 19 が生成するデータ境界。本フェーズは読み取りのみ（書き込み側は変更しない）
- portfolioAnalysis が null のフォールバックパス（generate-portfolio-report.ts:87-107）— カード自体が描画されないため、ニュース表示もスキップされる（変更不要の想定だが、planner はこのパスの整合を確認すること）

</code_context>

<specifics>
## Specific Ideas

- 空状態の文言イメージ: 「本日の関連ニュースなし」（ミュートグレー、Phase 19 D-11 のプロンプト文言と対をなす表現）
- マッチ方式バッジのイメージ: 社名/エイリアス一致の記事にのみ小さなグレー文字で「社名一致」— 誤マッチをレポート上で目視監査できるようにする
- カードに見えるニュース = 判断に使われたニュース、という1対1対応を崩さない（絞り込み・並べ替えを挟まない）

</specifics>

<deferred>
## Deferred Ideas

- 緊急度フラグ付きカードの視覚的強調・前日比較の変化バッジ（UI-07）— Phase 22
- ニュース・リサーチ内容への rationale の明示的言及（PORT-03）— Phase 22
- 「ニュースなし銘柄のカードの視覚的デエンファシス」（PITFALLS.md 提案）— Phase 22 の変化バッジ設計と合わせて検討する方が一貫する。本フェーズは空状態の明示のみ
- 社名フォールバックの実測誤マッチ率の集計監査 — D-07 のバッジで目視は可能になる。定量集計はマイルストーン監査時

</deferred>

---

*Phase: 20-Holding-Card News Display*
*Context gathered: 2026-07-03*

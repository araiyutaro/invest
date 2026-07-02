# Phase 16: Report Generator (HTML Rendering) - Context

**Gathered:** 2026-07-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 15の契約（`NewsCuration | null`）を入力に、news-digest.htmlの本文HTML文字列を返すピュア関数レンダラー `src/scripts/generate-news-digest.ts`（+ `.test.ts`）を実装する。記事一覧（見出しリンク・ソース・時刻・解説コメント）、市場別グルーピング、重要度バッジ、ティッカータグ、リード文を、既存3レポートと同一のBloomberg風ダークテーマ・モバイル対応CSSで描画する。`report-utils.ts` への4色目アクセントカラー追加を含む。対象要件: CURA-03, CURA-04, CURA-06, CURA-07, CURA-08, CURA-09, UI-03。

パイプライン統合・Agentステップ・ファイル書き出しのオーケストレーション（Phase 17）、index.htmlの条件付きリンク（Phase 18）は含まない。

</domain>

<decisions>
## Implementation Decisions

### 記事カードのレイアウト
- **D-01:** 見出し自体を元記事リンクにする（`<a href target="_blank">`）。別途「元記事→」リンクは置かない。hrefはTS側でID照合済みの実URLを使い、`escapeHtml()` を通す（Pitfall 2/5）。
- **D-02:** 公開時刻は絶対時刻JST表示（例: 「7/2 06:30」）。静的HTMLなので相対表示（「3時間前」）は不採用 — アーカイブ閲覧時に嘘になる。レンダリングはピュア関数内で完結（`Date.now()` 不使用、publishedAt文字列から導出）。
- **D-03:** カード内の情報階層は「1行目: バッジ+見出し / 2行目: ソース・時刻・ティッカーのメタ行 / 3行目: 解説コメント」の新聞的スキャン構成。
- **D-04:** ティッカーはシンボルのみでなく**会社名を併記**する（例: 「NVDA エヌビディア」）。社名はキュレーションAgentが選定時に出力する — Phase 15契約にオプショナルな社名フィールドを**加法的に追加**（例: tickersを `{symbol, name?}` 構造にするか、並列の `tickerNames` を追加。既存テストを壊さない形は planner/executor 判断）。社名欠落時はシンボルのみ表示にフォールバック。Agentプロンプト側の指示追加はPhase 17スコープだが、契約変更自体はPhase 16で行う。

### 市場グループの見せ方
- **D-05:** セクション順は固定で 米国株 → 日本株 → グローバル。ポートフォリオ構成（約80%米国）と朝8時の閲覧文脈（米国市場引け後）に合わせる。
- **D-06:** 記事0件の市場グループも見出しを表示し「本日の該当記事なし」を出す（3セクション常時表示、レイアウト毎日一定）。※キュレーション全体が正常0件（空配列）の場合は「本日は厳選記事なし」の全体グレースフル表示（Phase 15 D-05を踏襲）。
- **D-07:** グループ内の記事順は importance enum（high→medium→low）の安定ソート（Phase 15 D-06のバッジ階層→配列順ソートを踏襲）。

### バッジ・タグ・アクセント色
- **D-08:** 重要度バッジの配色: High=赤(#ef4444) / Medium=アンバー(#f59e0b) / Low=グレー(#6b7280)。既存 `decisionColor()` と同系パレット。
- **D-09:** ティッカー+会社名タグはプレーンテキストのピル形タグ（リンクなし）。外部リンクは見出しに集約し誤タップを防ぐ。
- **D-10:** news-digest のアクセントカラーはパープル #8b5cf6。`report-utils.ts` の `ACCENT_VARIANTS` に light/lighter バリアントを追加する（既存3色: 青・アンバー・緑と重複しない）。

### ナビとフォールバック表示
- **D-11:** ページ内ナビゲーションは追加しない。既存3レポートと同じくindex.html経由のみ（UI-03の「同じナビゲーション」= 現状と同一の構造、の解釈で確定）。4レポート間ナビバーの新設は不採用。
- **D-12:** `NewsCuration` が null（キュレーション失敗）の場合も、既存テーマ付きの完全なHTMLページを生成し、本文に「本日のニュースキュレーションは生成できませんでした」を表示する。`generate-portfolio-report.ts` の null フォールバックと同パターン。空文字列返却・ファイル非生成方式は不採用。
- **D-13:** ページタイトルは既存慣例に合わせ英語「News Digest - YYYY-MM-DD」、ヘッダー内に日本語副題「AI厳選ニュースダイジェスト」を添える。

### Claude's Discretion
- グループ見出しの件数表示の有無、リード文（CURA-09「今日の市場を動かすもの」）ブロックの具体的な配置・装飾 — 既存レポートのセクションスタイルと整合させる形で判断（リード文はページ冒頭付近であること自体は要件）
- カード/メタ行の具体的なCSSクラス設計・フォントサイズ・レスポンシブブレークポイント（既存 `generateBaseStyles` の枠内で）
- テストfixtureの具体設計（正常系・null・空配列・0件グループ・社名欠落ティッカーをカバーすること）
- 社名フィールドの契約上の正確な形状（`{symbol, name?}` vs 並列配列）— 既存スキーマテストを壊さない加法的変更であること

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### v2.4 リサーチ（レンダリング指針・ピットフォール）
- `.planning/research/SUMMARY.md` — Phase 2（本フェーズ）の推奨アプローチ: `generate-portfolio-report.ts` ミラー、Pitfall 5（HTMLインジェクション — href含む全補間の escapeHtml）
- `.planning/research/PITFALLS.md` — ピットフォールの行レベル根拠
- `.planning/research/ARCHITECTURE.md` — Pattern 2（ピュア関数ジェネレーター + null フォールバック）、Pattern 3（分類はLLM著作・TSは描画のみ）

### 上流契約（Phase 15成果物 — 本フェーズの入力型）
- `.planning/phases/15-curation-contract-schema/15-CONTEXT.md` — D-05（null vs 空配列のセマンティクス区別）、D-06（バッジ→配列順ソート）、D-07（フラット配列・グルーピングはPhase 16側）
- `src/meeting/types.ts` — `CuratedArticle` / `NewsCuration` 型（tickers社名フィールドの加法的追加先）
- `src/meeting/schemas.ts` — `newsCurationSchema` / 検証・解決関数（社名フィールド追加時に更新）

### レンダリング実装の直接の手本
- `src/scripts/generate-portfolio-report.ts` — ピュア関数ジェネレーターの構成・nullフォールバック・カード描画の手本（132行）
- `src/scripts/report-utils.ts` — `escapeHtml` / `generateBaseStyles(accentColor)` / `ACCENT_VARIANTS`（パープル追加先）
- `src/scripts/generate-report.ts` — 生成HTMLの書き出しオーケストレーション（Phase 17で統合されるが、レンダラーの呼び出し規約の参考）

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `report-utils.ts` の `escapeHtml()` / `generateBaseStyles(accentColor)`: 全補間・テーマCSSをそのまま再利用
- `generate-portfolio-report.ts` の構成（小さな format*Html 関数群 + トップレベル generateXxxHtml）: ファイル構成の直接の手本
- `.agent-card` スタイル: 記事カードのベースとして再利用可能
- vitest + fixture ベースのテスト慣例（`*.test.ts` 同居、`generate-report.test.ts` / `report-utils.test.ts` が前例）

### Established Patterns
- ピュア関数 `(data | null) => string`: レンダラーはI/Oを持たない（書き出しは Phase 17 の generate-report.ts 側）
- 既存3レポートのHTMLには `<a>` タグ・ページ内ナビが存在しない — news-digest の見出しリンクはこのコードベース初の `<a href>` 描画（escapeHtml の href 適用が新規の注意点）
- readonly / ReadonlyArray、イミュータブル操作（`[...articles].sort()`）
- タイトルは英語 + `escapeHtml(result.date)` の `<title>` 慣例

### Integration Points
- `src/scripts/generate-news-digest.ts`（新規） — `generateNewsDigestHtml(curation: NewsCuration | null): string` をエクスポート
- `src/scripts/report-utils.ts` — `ACCENT_VARIANTS` へ #8b5cf6 エントリ追加
- `src/meeting/types.ts` / `src/meeting/schemas.ts` — ティッカー社名フィールドの加法的契約変更
- Phase 17 が消費: `generate-report.ts` から独立try/catchで呼び出し・書き出し

</code_context>

<specifics>
## Specific Ideas

- 「ティッカーだけ書いてあってもどの会社か判別できない。なるべく会社名を書いてほしい」— ユーザーの明確な要望（レポート全般に通じる嗜好。本フェーズではnews-digestに適用、既存レポートへの展開は保留アイデア）
- 時刻の相対表示は静的HTMLでは「後で見ると嘘になる」ため避ける
- ダイジェストは「選ばれたものだけ見せる」思想だが、市場セクション自体は毎日同じ構造で出す（0件でも見出し表示）— 定位置で読める安心感を優先

</specifics>

<deferred>
## Deferred Ideas

- **既存3レポート（daily-report / meeting-minutes / portfolio-report）でもティッカーに会社名を併記する改善** — ユーザーの一般要望だが既存レポートの変更はPhase 16スコープ外。将来フェーズ / v2.5+ バックログ候補。

</deferred>

---

*Phase: 16-Report Generator (HTML Rendering)*
*Context gathered: 2026-07-02*

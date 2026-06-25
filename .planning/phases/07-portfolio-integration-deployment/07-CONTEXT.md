# Phase 7: Portfolio Integration & Deployment - Context

**Gathered:** 2026-06-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Portfolio Report のプレースホルダー（Phase 6 で作成済み）を完全実装する。AI エージェントが保有銘柄の個別評価（保持/買増/一部売却/全売却）とリバランス提案を生成し、Daily Report の推奨銘柄を「新規組入候補」として転載する。レポート生成後に `git add docs/ && git commit && git push` を自動実行し、GitHub Pages にデプロイする。invest.md スキルコマンドをデータ収集→分析→3レポート生成→デプロイの全パイプラインとして完成させる。

</domain>

<decisions>
## Implementation Decisions

### Portfolio 分析の生成方式
- **D-01:** 単一 opus AI エージェントが保有銘柄の評価・新規組入候補・リバランス提案を一括生成する。invest.md に Step 3d（Portfolio Analysis）を追加し、`portfolio.json` + `meeting-result.json` を入力として `tmp/portfolio-analysis.json` に出力する。
- **D-02:** エージェントモデルは `opus` を使用。ポートフォリオ全体の整合性を取る必要があるため、銘柄ごとの並列分割は行わない。
- **D-03:** `generate-portfolio-report.ts` は `tmp/portfolio-analysis.json` を読み込み、HTML にレンダリングする（AI 分析 → TS レンダリングのハイブリッド方式、既存パターンに準拠）。

### 新規組入候補の評価
- **D-04:** Daily Report の `highlightedStocks`（推奨銘柄）のスコア・判定をそのまま Portfolio Report の「新規組入候補」セクションに転載する。追加の AI 分析は行わない。
- **D-05:** データソースは `meeting-result.json` の `highlightedStocks` 配列。既存の `formatHighlightedStocksHtml()` のサブセットを流用可能。

### 自動デプロイ
- **D-06:** invest.md の末尾に Step 4: 自動デプロイを追加する。Claude が Bash ツールで `git add docs/ && git commit && git push` を実行する。
- **D-07:** push 前のユーザー確認は入れない（完全自動）。日次実行を想定した設計。
- **D-08:** コミットメッセージは `report: YYYY-MM-DD daily update` 形式。push 先は `origin master`。

### 保有比率データ
- **D-09:** holdings.ts への保有比率（targetWeight）追加の要否は Claude の裁量に委ねる。比率データがない場合は定性的な判断（「買増しを検討」「ポジション縮小を推奨」）にとどめる。

### Claude's Discretion
- 保有比率データの追加方式（D-09）
- Portfolio Analysis の JSON スキーマ詳細設計
- portfolio-analysis.json の Zod バリデーションスキーマの作成要否

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 要件定義
- `.planning/REQUIREMENTS.md` — RPT-03, PORT-01/02/03, PIPE-01/02 の要件定義（Phase 7 担当分）
- `.planning/ROADMAP.md` §Phase 7 — 成功基準 5 項目

### 現行実装（改修・拡張対象）
- `src/scripts/generate-portfolio-report.ts` — Phase 6 で作成済みのスタブ（緑アクセントカラー、プレースホルダー内容）→ 完全実装に置換
- `src/scripts/generate-report.ts` — オーケストレーター（portfolio-analysis.json の読み込み追加が必要）
- `.claude/commands/invest.md` — パイプライン定義（Step 3d Portfolio Analysis 追加、Step 4 自動デプロイ追加）

### データソース
- `src/portfolio/holdings.ts` — PortfolioHolding 型定義と PORTFOLIO_HOLDINGS 定数（12銘柄）
- `src/portfolio/data.ts` — Yahoo Finance からのポートフォリオデータ取得
- `src/meeting/types.ts` — MeetingResult 型（highlightedStocks, agentScores 等）
- `src/meeting/schemas.ts` — Zod バリデーションスキーマ

### Phase 6 コンテキスト（先行決定事項）
- `.planning/phases/06-3-report-structure/06-CONTEXT.md` — 3レポート分離アーキテクチャ、アクセントカラー（Portfolio=緑 #10b981）
- `src/scripts/report-utils.ts` — 共通ユーティリティ（escapeHtml, markdownToHtml, generateBaseStyles）
- `src/scripts/report-data-loaders.ts` — Round 1/2/3 データローダー（パターン参照）

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `generate-portfolio-report.ts` のスタブ: 緑アクセントカラー（#10b981）と基本 HTML 構造が既に存在 — Phase 7 で内容を追加するだけ
- `report-utils.ts` の `generateBaseStyles("#10b981")`: Portfolio Report 用 CSS が既に動作済み
- `report-utils.ts` の `escapeHtml`, `markdownToHtml`, `scoreColor`, `verdictColor`: HTML レンダリングユーティリティ一式
- `report-data-loaders.ts` の `loadRound*Results()` パターン: tmp/ JSON 読み込みの確立されたパターン — `loadPortfolioAnalysis()` も同パターンで実装可能
- `generate-daily-report.ts` の `formatHighlightedStocksHtml()`: スコアリングマトリクスの HTML 生成 — 新規組入候補セクションで流用可能

### Established Patterns
- **tmp/ JSON 境界**: AI エージェント出力は `tmp/*.json` に保存、TS スクリプトが読み込んで HTML 生成
- **並列データ読み込み**: `generate-report.ts` の `Promise.all` で複数データソースを並列ロード
- **Zod バリデーション**: すべての外部 JSON 入力は Zod スキーマでバリデーション
- **Immutable データ構造**: 全型に `readonly` を使用

### Integration Points
- `invest.md` Step 3d: 新規追加 — Portfolio Analyst エージェント実行箇所
- `invest.md` Step 4: 新規追加 — 自動デプロイ（git add/commit/push）
- `generate-report.ts` main(): `tmp/portfolio-analysis.json` の読み込み追加 → `generatePortfolioReportHtml()` に渡す
- `generate-portfolio-report.ts`: スタブから完全実装への置換

</code_context>

<specifics>
## Specific Ideas

- Portfolio Analysis エージェントには `portfolio.json`（12銘柄の株価データ）と `meeting-result.json`（ミーティング統合結果）を全て渡し、ポートフォリオ全体を俯瞰した判断を求める
- 保有銘柄の判断は「保持/買増/一部売却/全売却」の4段階で、それぞれに根拠を明記
- リバランス提案は具体的なアクションアイテム形式（「XYZを買増し、ABCのポジションを縮小」）
- 新規組入候補は highlightedStocks のスコア表をそのまま転載し、投資家が自分で判断できるようにする

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 7-Portfolio Integration & Deployment*
*Context gathered: 2026-06-25*

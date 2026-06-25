# Phase 1: Data Layer + Skill Foundation - Context

**Gathered:** 2026-06-24
**Status:** Ready for planning

<domain>
## Phase Boundary

データ収集パイプラインを再構成し、`/invest` スキルコマンドでデータ収集→並列分析スポーンまでの骨格パイプラインを起動できるようにする。AI分析の実装はPhase 2、レポート生成はPhase 3、GeminiクリーンアップはPhase 4で行う。

</domain>

<decisions>
## Implementation Decisions

### 中間JSONファイル設計
- **D-01:** データ種別ごとに3ファイルに分割: `tmp/market.json`, `tmp/news.json`, `tmp/portfolio.json`
- **D-02:** データスコーピング（DATA-02）はスキル側で制御。各アナリストAgentをスポーンする際に必要なJSONファイルを指定して読ませる。TS側はアナリストの役割を知らない
- **D-03:** ニュースは生記事データ（タイトル、ソース、日付）をそのままnews.jsonに出力。分析・要約はClaude側のアナリストが実施する。Geminiによる事前分析（generateAllAnalyses）は呼ばない
- **D-04:** tmp/ファイルは毎回上書き。明示的なクリーンアップ処理や日付別保存は不要

### データ収集スクリプト構造
- **D-05:** 既存のsrc/index.tsをリファクタしてデータ収集部分を再構成する（新規ラッパースクリプトではなく既存コードの再構成）
- **D-06:** Gemini依存コード（charts.ts画像生成、ニュース分析generateAllAnalyses）は新パイプラインから呼ばない。既存ファイルはそのまま残し、Phase 4で削除

### スキルコマンド設計
- **D-07:** `/invest` は引数なしでフルパイプラインを実行。オプションや個別銘柄指定は将来の拡張に回す
- **D-08:** エラー時はグレースフルデグラデーション（部分成功で続行）。市場データ（指数・セクター）は必須、ニュース・ポートフォリオは失敗しても分析を継続する

### 進捗表示方式
- **D-09:** 主要ステップごとに1行の進捗メッセージを表示（例: 「市場データ収集中...」「データ収集完了」「アナリスト分析開始...」）
- **D-10:** データ収集完了後に簡潔なサマリーを表示（指数変動率、ニュース件数、ポートフォリオ銘柄数）

### Claude's Discretion
- データ収集TSスクリプトの実行方法（Bash tsx直接 vs npm script経由）
- 既存src/index.tsの扱い（v1.0エントリとして残す vs リファクタして再利用）
- スキルのオーケストレーション方式（単一SKILL.md内制御 vs サブスキル分割）
- アナリスト分析結果のJSON出力先ディレクトリ構造

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Context
- `.planning/PROJECT.md` — プロジェクト定義、技術スタック制約、キー決定事項
- `.planning/REQUIREMENTS.md` — v2.0全要件マッピング（DATA-01, DATA-02, SKILL-01〜03がPhase 1対象）
- `.planning/ROADMAP.md` — Phase 1のゴールとサクセスクライテリア

### Existing Architecture
- `.planning/codebase/ARCHITECTURE.md` — 既存パイプラインのレイヤー構成とデータフロー
- `.planning/codebase/STACK.md` — 技術スタック詳細（TypeScript 5.9, tsx, yahoo-finance2 v3, Vitest等）
- `.planning/codebase/INTEGRATIONS.md` — 外部API連携詳細（Yahoo Finance, Finnhub, RSS, Gemini）

### Key Source Files
- `src/index.ts` — 既存エントリポイント（7ステップオーケストレーション）。リファクタ対象
- `src/data/market.ts` — 市場指数・セクターETFデータ取得
- `src/data/news/` — ニュース収集（Finnhub, Google News, RSS）
- `src/portfolio/data.ts` — ポートフォリオ保有銘柄データ取得
- `src/agents/` — 6エージェントプロファイル定義（分析ロジックのシステムプロンプト）

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/data/market.ts` の `fetchMarketIndices()`, `fetchSectorPerformance()`: 市場データ取得。そのまま再利用可能
- `src/data/news/` の各fetch関数: ニュース収集ロジック。Gemini分析部分を除いてそのまま再利用
- `src/portfolio/data.ts` の `fetchPortfolioData()`: ポートフォリオデータ取得。そのまま再利用
- `yahoo-finance2` v3: `new YahooFinance()` でインスタンス化が必要（デフォルトインポート不可）
- `zod` 4.3.6: 既にdependencyに含まれるがコード内では未使用。JSONスキーマ定義に活用可能

### Established Patterns
- `Promise.all()` による並列データ取得（市場・ニュース・チャートを並行実行）
- グレースフルデグラデーション: `fetchQuoteSafe()` パターン（try-catch + null返却 + filter）
- イミュータブルデータ構造: `readonly` 型によるデータ不変性の強制
- Step N/M 形式のコンソール進捗出力

### Integration Points
- `.claude/skills/` — `/invest` スキル登録先
- `tmp/` — 中間JSONファイル出力先（新規ディレクトリ）
- `src/agents/` — Phase 2でサブエージェント化する際の参照元

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 1-Data Layer + Skill Foundation*
*Context gathered: 2026-06-24*

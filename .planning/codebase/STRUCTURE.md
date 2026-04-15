# コードベース構造

**分析日:** 2026-04-08

## ディレクトリレイアウト

```
/Users/arai/invest/
├── src/                      # TypeScriptソースコード
│   ├── index.ts             # メインエントリーポイント、日次ワークフローをオーケストレーション
│   ├── gemini.ts            # Gemini API抽象化（テキスト + 画像生成）
│   ├── agents/              # AIエージェント定義（投資アナリスト）
│   │   ├── index.ts         # エージェントエクスポートと型
│   │   ├── types.ts         # 型定義（AgentProfile, MeetingRecord）
│   │   ├── fundamentals.ts  # ファンダメンタルズアナリストエージェント
│   │   ├── tenbagger.ts     # テンバガーハンターエージェント（成長株）
│   │   ├── macro.ts         # マクロエコノミストエージェント
│   │   ├── technical.ts     # テクニカルストラテジストエージェント
│   │   ├── risk-manager.ts  # リスクマネージャーエージェント
│   │   └── moderator.ts     # ミーティングモデレーターエージェント
│   ├── data/                # 市場データ収集・処理
│   │   ├── market.ts        # Yahoo Finance 市場指数・セクターETF
│   │   ├── news.ts          # ニュース集約オーケストレーター
│   │   ├── charts.ts        # Gemini画像生成によるチャート
│   │   └── news/            # ニュース集約サブシステム
│   │       ├── types.ts     # ニュース型定義
│   │       ├── analyzer.ts  # ニュース分析・カテゴリ分類
│   │       ├── finnhub.ts   # Finnhub API連携
│   │       ├── google-news.ts # Google News日本連携
│   │       └── rss-sources.ts # RSSフィード集約
│   ├── meeting/             # ミーティングオーケストレーション
│   │   └── runner.ts        # 市場分析ミーティングコーディネーター
│   ├── portfolio/           # ポートフォリオ分析サブシステム
│   │   ├── holdings.ts      # ハードコードされたポートフォリオ保有銘柄レジストリ
│   │   ├── data.ts          # Yahoo Finance経由のポートフォリオデータ取得
│   │   └── runner.ts        # ポートフォリオ専用ミーティングコーディネーター
│   └── report/              # レポート生成・フォーマット
│       ├── generator.ts     # 日次レポート・議事録HTML生成
│       └── portfolio-generator.ts # ポートフォリオレポートHTML生成
├── docs/                    # 生成レポートの出力ディレクトリ
│   └── YYYY-MM-DD/         # 日付別レポートディレクトリ
│       ├── daily-report.html        # 日次市場分析レポート
│       ├── meeting-minutes.html     # 詳細ミーティング議事録
│       ├── portfolio-report.html    # ポートフォリオ分析レポート
│       ├── sector-performance.png   # 生成チャート（Gemini）
│       └── market-overview.png      # 生成チャート（Gemini）
├── scripts/                 # ユーティリティスクリプト
│   └── run.sh              # npm start用シェルラッパー
├── .planning/              # プランニング・分析出力
│   └── codebase/           # コードベースドキュメント
├── .claude/                # Claude連携設定
├── .github/                # GitHub設定
├── .vscode/                # VS Code設定
├── .idea/                  # IntelliJ IDEA設定
├── tsconfig.json           # TypeScript設定
├── package.json            # Node.js依存関係・スクリプト
├── package-lock.json       # 依存関係ロックファイル
├── .env                    # 環境変数（GEMINI_API_KEY）
├── .gitignore              # Git除外パターン
├── com.arai.invest-agent.plist # macOS launchdスケジューラ（毎日8時）
└── README.md               # プロジェクトドキュメント
```

## ディレクトリの目的

**src/:**
- 目的: 投資エージェントシステムの全TypeScriptソースコード
- 内容: メインエントリー、エージェント、データ収集、ミーティング調整、レポーティング
- 主要ファイル: `index.ts`（オーケストレーター）、`agents/`（スペシャリスト）、`data/`（市場情報）、`report/`（出力）

**src/agents/:**
- 目的: 専門システムプロンプトを持つ投資アナリストエージェント定義
- 内容: 投資の視点を持つ6つのイミュータブルAgentProfile定義
- 主要ファイル: `fundamentals.ts`, `tenbagger.ts`, `macro.ts`, `technical.ts`, `risk-manager.ts`, `moderator.ts`

**src/data/:**
- 目的: 外部APIとニュースソースからの市場データ収集
- 内容: Yahoo Finance市場データ、Finnhub/Google News/RSSニュース集約、チャート生成
- 主要ファイル: `market.ts`（指数/セクター）、`news.ts`（オーケストレーター）、`charts.ts`（画像生成）

**src/data/news/:**
- 目的: 特化型ニュース集約・分析
- 内容: 複数ニュースソース連携、分析/カテゴリ分類、型定義
- 主要ファイル: `finnhub.ts`（米国市場）、`google-news.ts`（日本）、`analyzer.ts`（Gemini分析）

**src/meeting/:**
- 目的: 日次市場分析ミーティングのオーケストレーション
- 内容: 2ラウンドミーティングロジック（プレゼンテーション → ディスカッション）、エージェント調整
- 主要ファイル: `runner.ts`（メインオーケストレーター）

**src/portfolio/:**
- 目的: 日次市場レポートとは別のポートフォリオ固有分析
- 内容: 保有銘柄レジストリ、ポートフォリオデータ収集、ポートフォリオミーティングロジック
- 主要ファイル: `holdings.ts`（7銘柄ハードコードリスト）、`data.ts`（ポートフォリオクオート取得）、`runner.ts`（ミーティング）

**src/report/:**
- 目的: ミーティング結果をチャート埋め込みHTMLレポートに変換
- 内容: Markdown→HTML変換、スタイリング（Bloombergダークテーマ）、ファイルI/O
- 主要ファイル: `generator.ts`（日次 + 議事録）、`portfolio-generator.ts`（ポートフォリオ）

**docs/:**
- 目的: 日付別に整理された生成レポートの出力ディレクトリ
- 内容: HTMLレポートとPNGチャート、日付別サブディレクトリ（YYYY-MM-DD）
- 主要ファイル: `daily-report.html`, `meeting-minutes.html`, `portfolio-report.html`, `*.png` チャート

## 主要ファイルの場所

**エントリーポイント:**
- `src/index.ts`: メインオーケストレーター - 7ステップ日次ワークフロー開始（データ → ミーティング → レポート）
- `src/meeting/runner.ts`: 市場分析ミーティング - 2ラウンドエージェントディスカッション
- `src/portfolio/runner.ts`: ポートフォリオ分析ミーティング - 保有銘柄固有分析

**設定:**
- `tsconfig.json`: TypeScriptコンパイラオプション（ES2022、strictモード、bundler解決）
- `package.json`: 依存関係（Gemini API、Yahoo Finance、dotenv、Zod、tsx）
- `.env`: 環境設定（GEMINI_API_KEY 必須）
- `com.arai.invest-agent.plist`: macOS launchdスケジューラ（毎日8時）

**コアロジック:**
- `src/agents/`: エージェント定義（6名の専門投資アナリスト）
- `src/data/market.ts`: Yahoo Finance連携（指数、セクター）
- `src/data/news/`: マルチソースニュース集約（Finnhub、Google、RSS）
- `src/gemini.ts`: テキスト・画像生成の統一LLMインターフェース

**テスト:**
- リポジトリにテストファイルなし（Vitestインストール済みだが未使用）
- 実行スクリプト: `npm test`（設定済みだがテスト未実装）

## 命名規則

**ファイル:**
- 複数語ファイルはkebab-case: `risk-manager.ts`, `google-news.ts`, `portfolio-generator.ts`
- 単語ファイルはlowercase: `index.ts`, `market.ts`, `news.ts`, `charts.ts`
- 出力ファイルは `{type}-{name}.{ext}` パターン（daily-report.html, sector-performance.png）

**ディレクトリ:**
- 機能ドメインは小文字複数形: `agents/`, `data/`, `meeting/`, `portfolio/`, `report/`
- ネスト機能構造: `data/news/` でニュース固有機能
- 日付別出力: `docs/YYYY-MM-DD/` フォーマット（ハイフン付きISO日付）

**エクスポート:**
- `agents/index.ts` のバレルパターン: 全エージェントと型をエクスポート
- ニュースサブシステム集約: `src/data/news.ts` が個別ソースではなくオーケストレーターをエクスポート
- 型の再エクスポート: `src/agents/index.ts` が利便性のため `types.ts` から型を再エクスポート

## 新規コードの追加場所

**新規エージェント（アナリストスペシャリスト）:**
- 新規ファイル作成: `src/agents/{specialist-name}.ts`
- id、名前、役割、systemPromptを持つAgentProfileを定義
- 名前付きエクスポート: `export const {agentName}Agent: AgentProfile = { ... }`
- `src/agents/index.ts` のエクスポートに追加
- `src/meeting/runner.ts` と `src/portfolio/runner.ts` の `analysisAgents` 配列に追加
- 例: `src/agents/fundamentals.ts`

**新規データソース（市場/ニュース）:**
- 市場データ: `src/data/market.ts` に fetchQuoteSafe() パターンに従い関数追加
- ニュースソース: `src/data/news/{source-name}.ts` モジュール作成
- シグネチャに一致する集約関数をエクスポート: `Promise<ReadonlyArray<NewsDigest>>`
- `src/data/news.ts` オーケストレーターを更新し、並列Promise.all()で新ソースを呼び出し
- 例: `src/data/news/finnhub.ts`

**新規レポートタイプ:**
- 新規ファイル作成: `src/report/{report-name}-generator.ts`
- `generator.ts` のパターンに従う: データ受け取り、HTML生成、docsディレクトリに保存
- 一貫したスタイリングのため `markdownToHtml()` ユーティリティを使用
- PNGファイルを読み込みbase64エンコードでチャートを埋め込み
- `src/index.ts` メインオーケストレーターから呼び出し
- 例: `src/report/portfolio-generator.ts`

**ユーティリティ関数:**
- 共有ヘルパー: 適切な `data/` または `report/` モジュールに追加
- データ変換: 既存の `data/*.ts` ファイルに配置、または必要に応じて新規 `src/utils/` ディレクトリ
- 型定義: `src/agents/types.ts` または新規 `src/types/` ディレクトリに追加
- 現在のパターン: 個別のutils/ディレクトリなし、ユーティリティは使用者と同じ場所に配置

## 特殊ディレクトリ

**docs/:**
- 目的: 生成レポート出力ディレクトリ
- 自動生成: はい - パイプラインが自動作成
- コミット: はい - レポート履歴をgitで追跡
- 構造: YYYY-MM-DDサブディレクトリ、実行日ごとに1つ

**.planning/codebase/:**
- 目的: コードベース分析・ドキュメント
- 自動生成: いいえ - 手動管理ドキュメント
- コミット: はい - プランニングドキュメントをgitで追跡
- 内容: ARCHITECTURE.md, STRUCTURE.md, CONVENTIONS.md 等

**.env:**
- 目的: 環境設定（GEMINI_API_KEY 必須）
- 自動生成: いいえ - 手動設定
- コミット: いいえ - セキュリティのため.gitignoreに記載
- 注意: アプリケーション実行に設定が必要

**.idea/, .vscode/, .claude/:**
- 目的: IDE・ツール設定
- 自動生成: いいえ - ツールとユーザーが管理
- コミット: はい - 開発環境の一貫性
- 注意: .vscode/ にsettings.jsonとlaunch設定を含む

---

*構造分析: 2026-04-08*

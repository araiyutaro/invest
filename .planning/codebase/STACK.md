# 技術スタック

**分析日:** 2026-04-08

## 言語

**主要:**
- TypeScript 5.9.3 - `src/` ディレクトリ内の全ソースコード
- JavaScript (ES2022) - ランタイムモジュール形式

**補助:**
- Bash - `scripts/` およびlaunchd plistのビルド・スケジューリングスクリプト

## ランタイム

**環境:**
- Node.js 24.3.0 - JavaScriptランタイム

**パッケージマネージャ:**
- npm (Node.js同梱)
- ロックファイル: `package-lock.json` あり

## フレームワーク

**コア:**
- 従来のWebフレームワークなし - Node.jsピュア実装

**CLI/実行:**
- tsx 4.21.0 - `tsx src/index.ts` で`.ts`ファイルを直接実行するTypeScriptエグゼキュータ

**テスト:**
- Vitest 4.0.18 - ユニット・統合テストランナー
  - 設定: 暗黙的（デフォルト使用、明示的なvitest設定ファイルなし）
  - 実行: `npm run test`, `npm run test:watch`

**ビルド/開発:**
- TypeScript 5.9.3 コンパイラ
  - 設定: `tsconfig.json` - ES2022ターゲット、strictモード有効
  - 出力: `dist/` ディレクトリ
  - ソースルート: `src/`

## 主要依存関係

**重要 - AI & 生成:**
- `@google/generative-ai` 0.24.1 - テキスト生成用Google Gemini APIクライアント
  - 使用箇所: `src/gemini.ts` エージェント推論
  - モデル: `gemini-3.1-pro-preview`
- `@google/genai` 1.44.0 - 画像生成用Google Generative AIクライアント
  - 使用箇所: `src/data/charts.ts` チャート可視化
  - モデル: `gemini-2.5-flash-image`

**重要 - 金融データ:**
- `yahoo-finance2` 3.13.2 - Yahoo Finance APIクライアント
  - 使用箇所: `src/data/market.ts`, `src/portfolio/data.ts`
  - 取得内容: 市場指数、セクターETFパフォーマンス、個別株価
  - 注意: デフォルトインポートではなく `new YahooFinance()` でインスタンス化が必要

**データ処理:**
- `fast-xml-parser` 5.5.6 - RSSフィード用XMLパーサー
  - 使用箇所: `src/data/news/google-news.ts`, `src/data/news/rss-sources.ts`
  - 目的: Google Newsおよび金融RSSフィードの解析

**バリデーション:**
- `zod` 4.3.6 - TypeScriptファーストなスキーマバリデーション
  - 配置: 入力バリデーション全般で使用

**環境:**
- `dotenv` 17.3.1 - 環境変数読み込み
  - 使用箇所: `src/index.ts` で `import "dotenv/config"`
  - 必要: `GEMINI_API_KEY` と `FINNHUB_API_KEY` を記載した `.env` ファイル

## 設定

**環境:**
- 読み込み: `dotenv` が `.env` ファイルからランタイム時に読み込み
- 必要な設定:
  - `GEMINI_API_KEY` - Google Gemini API認証トークン
  - `FINNHUB_API_KEY` - Finnhub APIキー（オプション - 未設定時はグレースフルにフォールバック）

**ビルド:**
- `tsconfig.json` - TypeScriptコンパイラ設定
  - ターゲット: ES2022（モダンJavaScript）
  - モジュール: ES2022（ECMAScriptモジュール）
  - モジュール解決: bundler
  - strictモード: 有効
  - Libチェック: node_modulesはスキップ

**スケジューリング:**
- `com.arai.invest-agent.plist` - macOS launchd設定
  - 頻度: 毎日8時
  - 実行: `scripts/run.sh`

## プラットフォーム要件

**開発:**
- macOSシステム（launchdスケジューリング、`.plist`ファイル使用）
- Node.js 24.3.0+
- npmによる依存関係管理
- ソースコード理解にTypeScript知識が必要

**本番:**
- macOSシステム（launchd経由のスケジューラ）
- Node.js 24.3.0+ ランタイム
- 環境変数: `GEMINI_API_KEY`（必須）、`FINNHUB_API_KEY`（オプション）
- ネットワークアクセス先:
  - Google Generative AI API
  - Yahoo Finance API
  - Finnhub API
  - Google News RSSフィード
  - 日本の金融ニュースRSSソース

**出力:**
- レポートを `docs/YYYY-MM-DD/` ディレクトリにPNGチャート画像埋め込みHTMLファイルとして出力

---

*スタック分析: 2026-04-08*

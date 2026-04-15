# 外部連携

**分析日:** 2026-04-08

## API & 外部サービス

**AI/LLM:**
- Google Gemini API - エージェント推論・分析
  - SDK/クライアント: `@google/generative-ai` 0.24.1
  - 認証: 環境変数 `GEMINI_API_KEY`
  - 使用箇所: `src/gemini.ts`, `src/agents/`（全6エージェント実装）
  - モデル: テキスト分析用 `gemini-3.1-pro-preview`
- Google Generative AI（画像） - チャート画像生成
  - SDK/クライアント: `@google/genai` 1.44.0
  - 認証: 同一の `GEMINI_API_KEY`
  - 使用箇所: `src/data/charts.ts`
  - モデル: チャート可視化用 `gemini-2.5-flash-image`

**市場データ:**
- Yahoo Finance API - リアルタイム株式・指数データ
  - SDK/クライアント: `yahoo-finance2` 3.13.2
  - 認証: 不要（パブリックAPI）
  - 使用箇所: `src/data/market.ts`, `src/portfolio/data.ts`
  - 取得データ:
    - 主要指数: S&P 500, NASDAQ, ダウ平均, 日経225, TOPIX, VIX
    - セクターETF: 11種のXL*セクタートラッカー（XLK, XLV, XLF, XLY, XLI, XLE, XLU, XLRE, XLB, XLC, XLP）
    - 個別株: ポートフォリオ保有銘柄（MRNA, JOBY, HII, POWL, CLS, FLNC, MOD）
    - フィールド: 株価、変動額、変動率、出来高、時価総額、PER、52週高値/安値

**ニュース:**
- Finnhub API - 米国市場ニュースおよびM&Aニュース
  - SDK/クライアント: `fetch()` による直接HTTP通信
  - 認証: 環境変数 `FINNHUB_API_KEY`
  - 配置: `src/data/news/finnhub.ts`
  - エンドポイント: `https://finnhub.io/api/v1/news`
  - カテゴリ: "general", "merger"
  - フォールバック: APIキー未設定時は空配列をグレースフルに返却
  - フィルタ: 過去24時間の記事のみ

**ニュース（RSSフィード）:**
- Google News - 日本市場ニュース
  - SDK/クライアント: `fetch()` による直接HTTP通信 + `fast-xml-parser` でXML解析
  - 認証: 不要
  - 配置: `src/data/news/google-news.ts`
  - フィード: 日経、株式市場、決算を検索する2つのGoogle News RSSフィード
  - パーサー: 属性正規化付きXMLParser
  - 取得上限: 日付順で20記事

- Investing.com - 日本市場RSS
  - 配置: `src/data/news/rss-sources.ts`
  - フィード: 3つのRSSフィード（ニュース全般、概要）
  - 取得上限: 20記事

- Yahoo!ニュース - 日本のビジネス・株式ニュース
  - 配置: `src/data/news/rss-sources.ts`
  - フィード: 2つのRSSフィード（ビジネス、株式市場セクション）
  - 取得上限: 15記事

- 東洋経済オンライン - 日本のビジネス誌
  - 配置: `src/data/news/rss-sources.ts`
  - フィード: 1つのRSSフィード
  - 取得上限: 10記事

- 日経ビジネス - 日経ビジネス誌
  - 配置: `src/data/news/rss-sources.ts`
  - フィード: 1つのRSSフィード（RDFフォーマット）
  - 取得上限: 10記事

- NHK経済 - NHK経済・ビジネスニュース
  - 配置: `src/data/news/rss-sources.ts`
  - フィード: 1つのRSSフィード
  - 取得上限: 10記事

## データストレージ

**データベース:**
- なし - データベース連携なし

**ファイルストレージ:**
- ローカルファイルシステムのみ
  - レポート出力先: `docs/YYYY-MM-DD/` ディレクトリ
  - ファイル: HTMLレポート（`daily-report.html`, `meeting-minutes.html`, `portfolio-report.html`）
  - ファイル: PNGチャート画像（`sector-performance.png`, `market-overview.png`）

**キャッシュ:**
- なし - 明示的なキャッシュレイヤーなし

## 認証 & アイデンティティ

**認証プロバイダ:**
- なし - ユーザー認証システムなし
- API認証は環境変数経由:
  - `GEMINI_API_KEY` - Google Gemini API呼び出しに必須
  - `FINNHUB_API_KEY` - オプション、未設定時はグレースフルにスキップ

## 監視 & 可観測性

**エラートラッキング:**
- 検出なし - エラートラッキングサービス未連携

**ログ:**
- コンソールログのみ
  - `console.error()` と `console.log()` を使用
  - stdout/stderrに出力
  - タイムスタンプはlaunchdスケジューラが管理

## CI/CD & デプロイ

**ホスティング:**
- macOS ローカルホスト - 単一マシン実行
- スケジューラ: launchd（macOSネイティブスケジューリング）
- 設定: `com.arai.invest-agent.plist`
- 頻度: 毎日8時（Asia/Tokyoタイムゾーン）

**CIパイプライン:**
- 検出なし - CI/CDサービス未設定
- 手動実行: `npm start` またはlaunchd経由のスケジュール実行

## 環境設定

**必須環境変数:**
- `GEMINI_API_KEY` - Google Gemini APIキー（必須）

**オプション環境変数:**
- `FINNHUB_API_KEY` - Finnhub APIキー（オプション、未設定時はグレースフルにスキップ）

**シークレット配置:**
- プロジェクトルートの `.env` ファイル
- gitにコミットされない（`.gitignore` に記載）
- `package.json` に従いローカルで作成が必要

## Webhook & コールバック

**受信:**
- なし - Webhookエンドポイント未公開

**送信:**
- なし - 外部サービスへのWebhookなし

## データフロー

**デイリーミーティングパイプライン:**

1. **市場データ収集**（並列）:
   - `fetchMarketIndices()` → Yahoo Finance APIで主要6指数を取得
   - `fetchSectorPerformance()` → Yahoo Finance APIで11セクターETFを取得
   - 結果: 全銘柄の株価、変動額、変動率

2. **ニュース収集**（並列）:
   - `fetchAllFinnhubNews()` → Finnhub API（general + mergerカテゴリ）
   - `fetchGoogleNewsJapan()` → Google News RSSフィード
   - `fetchAllRssNews()` → 5つの日本金融ニュースRSSソース
   - 処理: タイトルによる重複排除、日付順ソート、件数制限

3. **ニュース分析**（AI）:
   - `generateAllAnalyses()` → Google Gemini API
   - 入力: 収集した全ニュース記事
   - 出力: 構造化分析（米国市場、日本市場、マクロ、セクター、決算）

4. **チャート生成**（並列）:
   - `generateSectorChart()` → Google Gemini API (gemini-2.5-flash-image)
   - `generateMarketOverviewChart()` → Google Gemini API (gemini-2.5-flash-image)
   - プロンプトがBloomberg風ダークテーマ要件とともにデータを記述
   - 出力: ディスクに保存されるPNGファイル

5. **エージェントミーティング**（逐次）:
   - 5名のアナリストが市場コンテキストを処理:
     - ファンダメンタルズアナリスト
     - テンバガーハンター
     - マクロエコノミスト
     - テクニカルストラテジスト
     - リスクマネージャー
   - 各自が `generateText()` → Google Gemini API を呼び出し
   - モデレーターが `generateChat()`（マルチターン会話）で統合

6. **ポートフォリオ分析**（オプション）:
   - `fetchPortfolioData()` → Yahoo Finance APIで7銘柄を取得
   - ポートフォリオエージェントが保有銘柄パフォーマンスを分析
   - ポートフォリオレポートに統合

7. **レポート生成**:
   - HTML出力を `docs/YYYY-MM-DD/` に保存
   - `src/report/generator.ts` でMarkdown → HTML変換
   - 画像はファイルパスまたはbase64で埋め込み

---

*連携分析: 2026-04-08*

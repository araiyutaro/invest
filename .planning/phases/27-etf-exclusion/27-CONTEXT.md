# Phase 27: ETF Exclusion - Context

**Gathered:** 2026-07-15
**Status:** Ready for planning
**Mode:** --auto（全グレーエリアを推奨オプションで自動確定。根拠は .planning/research/ の v2.7 リサーチと既存コード実証パターン）

<domain>
## Phase Boundary

アナリストが推奨する銘柄候補（picks / highlightedStocks）からETFを構造的に排除する二層防御を実装する:

1. **第1層（確率的）**: 全5アナリストエージェント＋モデレーターのプロンプトに、ETFを推奨銘柄から除外する明示的指示を追加
2. **第2層（決定論的）**: meeting-result 確定後、TS側で yahoo-finance2 `quote().quoteType` 照合により highlightedStocks からETFを除外（米国ETF・日本ETF両対応。`.T` サフィックスでは判別不能なため quoteType 必須）

ウォッチリスト永続化（Phase 28）・追跡データ供給（Phase 29）・買いタイミング判定（Phase 30）・レポート表示（Phase 31)は本フェーズの範囲外。Requirements: ETF-01, ETF-02。

</domain>

<decisions>
## Implementation Decisions

### 安全側方針（lookup失敗時の扱い）— 二段構えのフェイル設計
- **D-01: 銘柄単位の quoteType lookup 失敗は fail-closed（= その銘柄を highlightedStocks から除外）**。research PITFALLS Pitfall 1 の明示推奨。ETF混入がウォッチリスト（Phase 28以降）の追跡履歴を汚染すると遡及修正が必要になるため、疑わしきは除外する
- **D-02: フィルタ処理全体（スクリプト実行）の失敗は fail-soft（= 元の tmp/meeting-result.json を維持してパイプライン継続）**。1つの新機能の障害が既存4レポートの生成・デプロイを止めない（OPS方針踏襲）。throw せず `[STEP:etf-exclusion:FAIL:<理由>]` を出力し、`[PIPELINE:FAIL]` は絶対に出さない
- **D-03: 上記の使い分けを明確に区別する**: 「個別銘柄の判定不能 → 除外（安全側）」「フィルタ機構そのものの故障 → 未フィルタで継続（可用性側）」。この2つを混同しない

### ETF判定基準
- **D-04: allowlist 方式 — `quoteType === "EQUITY"` のみ通過**。ETF / MUTUALFUND / INDEX / CRYPTOCURRENCY 等はすべて除外。日本のETF・REIT・投信（1306.T 等）を列挙不要で網羅でき、fail-closed 思想（D-01）と整合する
- **D-05: quoteType の照合は yahoo-finance2 の batch quote()（シンボル配列渡し）1回で実施**。highlightedStocks は高々数銘柄であり、per-ticker 逐次呼び出しによるレート制限リスク（research Pitfall 3）を構造的に回避する

### TS側フィルタの統合ポイント
- **D-06: 純関数モジュール `src/portfolio/etf-exclusion.ts` ＋ 薄い fail-soft CLI ラッパー `src/scripts/filter-etf-stocks.ts` の分離構成**。`urgency-history.ts` + `write-urgency-history.ts` の実証済みパターンを踏襲（純関数は quote 結果を引数で受け取りネットワーク非依存 → 単体テスト容易）
- **D-07: 実行位置は invest.md Step 2g（バリデーション）内、`validate-meeting.ts` 実行の**前**に挿入**。tmp/meeting-result.json を読み、ETF除外済みの highlightedStocks で同ファイルを書き戻す（イミュータブルに新オブジェクト構築）。既存の Step 2g バリデーション・サマリー表示は除外後のデータを自然に検証・表示する
- **D-08: 専用 STEP マーカーを出力する** — `[STEP:etf-exclusion:OK]` および `[STEP:etf-exclusion:FAIL:<理由>]`（既存 STEP マーカー規約に準拠）
- **D-09: meeting-result.json のスキーマ（src/meeting/schemas.ts）は変更しない**。highlightedStocks の要素を除去するのみで、フィールド追加は行わない（Phase 28 のウォッチリスト側で必要になればそこで設計）

### プロンプト指示の挿入箇所（第1層）
- **D-10: `.claude/commands/invest.md` の Round 1 5アナリストブロック（Step 2a）の各出力契約部分に、ETF除外指示を追記**。既存の「注意: picksのtickerは必ず英数字ティッカー形式…」の並びに「ETF・投資信託・インデックスファンドは picks に含めないこと（個別企業株のみ）」の趣旨を追加。5ブロックすべてに同一文言を適用
- **D-11: Step 2f モデレーター最終統合プロンプトの「重要な注意事項」にも同趣旨の除外指示を追加**（highlightedStocks 生成点での防御）
- **D-12: src/agents 配下の systemPrompt ファイルは変更しない** — picks の出力契約が定義されているのは invest.md であり、そこが指示の正準位置。二重管理を避ける

### 除外の可視性・監査性
- **D-13: 除外が発生した場合、除外ティッカー・quoteType・理由（ETF判定 / lookup失敗）を CLI の標準出力に記録**（例: `ETF除外: SPY (quoteType=ETF)` / `ETF除外: XYZ (quoteType取得失敗, fail-closed)`)。launchd ログから事後監査可能
- **D-14: 新規の永続ファイル（除外履歴 JSON 等）は作らない**。Phase 27 はログ出力で十分。永続的な監査トレイルが必要になるのは Phase 28 のウォッチリスト状態テーブル（removedReason 方式）であり、そちらで担う

### テスト方針
- **D-15: 単体テストは純関数（etf-exclusion.ts）に対して実施**: 米国ETF（例: SPY）・日本ETF（例: 1306.T）・米国個別株・日本個別株（7203.T 等）・quoteType 欠損/lookup失敗の各分類を検証（Success Criteria 4）。ネットワークモックは既存テスト規約（プレーン Error でのシミュレート等、write-news-digest.test.ts / urgency-history.test.ts 参照）に合わせる

### Claude's Discretion
- 純関数のシグネチャ・型定義の詳細（WatchlistEntry 等は Phase 28 の管轄。本フェーズは MeetingResult の highlightedStocks 型のみ扱う）
- CLI ラッパーのエラーメッセージ文言・ログフォーマットの詳細
- batch quote() のレスポンスから quoteType を取り出す際の防御的パース実装

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### v2.7 リサーチ（設計根拠）
- `.planning/research/SUMMARY.md` — v2.7 全体の推奨アーキテクチャ・5フェーズ構成・Pitfall 1（プロンプトのみのETF除外は不十分、fail-closed 必須）の根拠
- `.planning/research/PITFALLS.md` — ETF除外・レート制限に関する落とし穴詳細
- `.planning/research/STACK.md` — yahoo-finance2@3.13.2 `quote().quoteType` のライブ検証結果（米国・日本ティッカー、1306.T 含む batch 呼び出し確認済み）

### 要件・ロードマップ
- `.planning/REQUIREMENTS.md` — ETF-01 / ETF-02 の正式定義
- `.planning/ROADMAP.md` §Phase 27 — Success Criteria 4項目

### 変更対象コード
- `.claude/commands/invest.md` — パイプライン定義。Step 2a（Round 1 5アナリストプロンプト）・Step 2f（モデレーター注意事項）・Step 2g（バリデーション、TSフィルタ挿入点）
- `src/meeting/schemas.ts` — meetingResultSchema / highlightedStocks の zod 定義（変更しないが型参照元）
- `src/meeting/types.ts` — MeetingResult 型定義
- `src/scripts/validate-meeting.ts` — Step 2g の既存バリデーション（フィルタの直後に実行される）

### 流用パターン（実装の雛形）
- `src/portfolio/urgency-history.ts` ＋ `src/scripts/write-urgency-history.ts` — 純関数モジュール＋fail-soft CLI ラッパー分離の実証済みテンプレート（ENOENT 二重チェック等のテスト規約含む）
- `src/scripts/collect-technicals.ts` — yahoo-finance2 呼び出しの既存パターン（`new YahooFinance()` インスタンス化）
- `src/portfolio/urgency-history.test.ts` / `src/scripts/write-news-digest.test.ts` — テストモック規約の参照元

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `urgency-history.ts` / `write-urgency-history.ts` ペア: 純関数＋fail-soft CLI の分離構成をそのまま流用（D-06）
- yahoo-finance2 v3 は既にインストール済み（3.13.2）・`new YahooFinance()` インスタンス化規約が `src/data/market.ts` / `src/portfolio/data.ts` に存在。**quoteType は現在コードベースのどこでも未使用**（本フェーズが初出）
- STEP マーカー規約（`[STEP:name:OK/FAIL:<理由>]`）と fail-soft 分岐の記述様式は invest.md 内の news-digest / digest-crossref / urgency-history 節が手本

### Established Patterns
- 「LLM自己申告を信用せず、TSで決定できるものはTS側決定論」— v2.5/2.6 の中核方針。本フェーズの二層防御はこの方針の直接適用
- tmp/*.json ハンドオフ境界: TS↔Claude の受け渡しはすべてファイル経由
- イミュータブル構築: 既存コードは readonly 型・spread 構築が規約（highlightedStocks フィルタも新配列生成で行う）
- 日本語コメント・日本語ログ出力が既存 CLI スクリプトの慣行

### Integration Points
- invest.md Step 2g: `npx tsx src/scripts/validate-meeting.ts` の直前に `npx tsx src/scripts/filter-etf-stocks.ts` を挿入（D-07）
- tmp/meeting-result.json: Step 2f（モデレーター出力保存）→ **本フェーズのフィルタ** → Step 2g バリデーション → Step 3 各レポート生成、の順で流れる。フィルタ済みデータが下流（generate-daily-report.ts / prev-highlighted-stocks 経由の翌日注入 / Phase 28 ウォッチリスト）すべてに自然に波及する

</code_context>

<specifics>
## Specific Ideas

- research SUMMARY は除外フィルタを「2つの独立した呼び出し点」（meeting-result 確定後＋ウォッチリスト入場時）で適用する構成を推奨している。本フェーズは前者のみを実装し、後者（防御的二重適用）は Phase 28 のウォッチリスト admission 側で同じ純関数を再利用する — `etf-exclusion.ts` はその再利用を前提に、meeting-result 非依存の純関数として設計すること
- ポートフォリオ保有銘柄の除外（既存）とETF除外は別レイヤー: 前者はプロンプト＋extract-tickers.ts、後者は本フェーズの quoteType フィルタ。既存の保有銘柄除外ロジックには触れない

</specifics>

<deferred>
## Deferred Ideas

- **Step 2b（extract-tickers.ts）段階での早期ETFフィルタ**: Round 3 のスコアリング・テクニカル収集の無駄を省ける最適化だが、API呼び出し追加とのトレードオフがあり、Success Criteria が要求する確定後フィルタ（Step 2g）で要件は満たせる。必要になれば将来フェーズで検討
- **除外履歴の永続化（data/ への監査ファイル）**: Phase 28 の removedReason 付きウォッチリスト状態テーブルが担うため本フェーズでは実装しない
- **ウォッチリスト admission 側の防御的二重フィルタ**: Phase 28 の管轄（本フェーズの純関数を再利用）

</deferred>

---

*Phase: 27-ETF Exclusion*
*Context gathered: 2026-07-15*

# Investment Agent

## What This Is

マルチエージェント投資分析システム。5人のAIアナリストとモデレーターが日次ミーティングを行い、米国株・日本株の分析レポートをBloomberg風HTMLで自動生成する。個人投資家（自分自身）のための意思決定支援ツール。

## Core Value

毎日の投資判断に必要な多角的分析（ファンダメンタル、テクニカル、マクロ、リスク、テンバガー候補）を、複数AIアナリストの議論形式で提供すること。

## Current State

**Shipped:** v2.5 Portfolio News Intelligence (2026-07-04)

v2.0〜v2.5で、Gemini→Claude Code移行、3レポート構成復元、ニュース品質フィルタ、パイプライン計測、ニュース/分析/運用安定性/レポートUIの総合底上げ、AI厳選ニュースダイジェスト（news-digest.html）の4紙目追加、そして保有銘柄ごとのニュース・WebSearchリサーチを踏まえた売却・保有再考（v1.0「Web調査後の再評価」フローのv2.x再実装）を完了。ポートフォリオレポートは保有銘柄の意思決定に集中し、各保有銘柄カードにID参照方式の関連ニュース・緊急度フラグ（赤バッジ）・前日比の判断変化バッジ（TS側決定論的検出）を表示する。12銘柄のWebSearchリサーチは fail-soft な専用パイプラインステップ（Step 3-P）として実行され、失敗しても4レポートの生成・デプロイは継続する。

**Next milestone:** v2.6 Digest-Meeting Cross-Reference & Urgency History（進行中）。Phase 24（ダイジェスト-ミーティング相互参照）・Phase 25（緊急度履歴永続化 data/urgency-history.json）完了。残タスク: Phase 26（週次ロールアップ表示 HIST-03）、および Phase 20/21/22 の HUMAN-UAT ライブ実行確認（明朝の launchd 実行で消化可能、STATE.md Deferred Items で追跡）。

## Current Milestone: v2.6 Digest-Meeting Cross-Reference & Urgency History

**Goal:** ニュースダイジェストとミーティング分析の相互参照を実現し、緊急度フラグの履歴を永続化してポートフォリオの週次振り返りを可能にする。

**Target features:**
- XREP-01: ダイジェスト記事に当日ミーティングで議論されたテーマへの関連注記を表示（TS側決定論的マッチング — meeting-result.json のティッカー・テーマキーワードと照合、holding-news.ts と同じ設計思想）
- PORT-F1: 緊急度フラグの履歴監査トレイル — リポジトリ内 `data/` ディレクトリに JSON で永続化、日次実行で追記コミット
- PORT-F1 表示: portfolio.html 内に「今週の緊急フラグ履歴」週次ロールアップセクションを追加（新規ページなし）

**Key context:**
- 関連判定・履歴付与はいずれも LLM に頼らず TS 側決定論で実装（v2.5 の holding-news.ts / decision-diff.ts と同じ方針）
- XREP-01 はパイプライン順序依存（ミーティング完了後にダイジェスト注記を付与）が生じるため、fail-soft 設計を踏襲
- 緊急度履歴は公開 docs/ ではなく非公開の data/ に保存

## Requirements

### Validated

- ✓ 5アナリスト+モデレーターによる日次ミーティング分析 — v1.0
- ✓ Yahoo Finance経由の市場データ・個別銘柄データ取得 — v1.0
- ✓ 複数ソース（Finnhub, Google News, RSS）からのニュース取得 — v1.0
- ✓ Gemini APIによるニュース分析・要約 — v1.0
- ✓ Google Search Groundingによる個別銘柄リサーチ — v1.0
- ✓ NanoBanana画像生成によるチャート作成 — v1.0
- ✓ Bloomberg風HTMLダークテーマレポート出力 — v1.0
- ✓ ポートフォリオ保有銘柄の追跡・分析 — v1.0
- ✓ launchdによる毎朝8時の自動実行 — v1.0
- ✓ US インデックスファンド戦略セクション — v1.0
- ✓ 3レポート構成（Daily Report / Meeting Minutes / Portfolio Report） — v2.1
- ✓ ポートフォリオ非依存の新規銘柄発掘 — v2.1
- ✓ アナリスト詳細散文分析（Round 1 + Round 2 ディスカッション） — v2.1
- ✓ ポートフォリオ個別評価と組入判断 — v2.1
- ✓ docs/ 出力 + 自動 git push（GitHub Pages デプロイ） — v2.1
- ✓ クロスソース重複排除（URL + NFKC正規化Jaccard） — v2.2
- ✓ 投資無関係記事の除外（キーワードdenylistフィルタ） — v2.2
- ✓ アナリストへの記事供給数柔軟化（MIN=20/MAX=80） — v2.2
- ✓ パイプライン実行時間計測と12ステップ表示 — v2.2
- ✓ Finnhubポートフォリオティッカー別ニュース取得 — v2.3 (Phase 11, NEWS-01)
- ✓ ニュース時間帯重み付け（直近6h優先スコア） — v2.3 (Phase 11, NEWS-02)
- ✓ 英日クロス言語ニュース重複排除 — v2.3 (Phase 11, NEWS-03)
- ✓ 前日レポート注入によるクロスセッション分析記憶 — v2.3 (Phase 12, ANLQ-01)
- ✓ スコアリングラウンド（Round 3）の専用並列エージェント化 — v2.3 (Phase 12, ANLQ-02)
- ✓ レポートUIデザイン刷新（index.htmlヒーロー+月別アコーディオン）・モバイル対応・VIX/セクターインラインチャート追加 — v2.3 (Phase 14, UI-01/UI-02)
- ✓ 自動実行のエラーリカバリ強化（EXIT_CODEの正確な捕捉、STEPマーカーのログ到達、失敗ステップ名付き通知） — v2.3 (Phase 13/14.1, OPS-01/OPS-03。Phase 14.1でrun.shの根本バグを実修正)
- ✓ docs/index.html・portfolio.html のSHA256チェックサム保護（PROTECT_FILES配列化、grep -F厳密一致、照合失敗時のクラッシュ防止） — v2.3 (Phase 13/14.1, OPS-02)
- ✓ ニュースキュレーションHTML（news-digest.html）を4紙目のレポートとして生成・index.htmlへ条件付きリンク統合 — v2.4 (Phases 15-18, CURA-01〜09 / UI-03 / UI-04 / OPS-04 全12要件、ライブ検証+本番デプロイ済み)
- ✓ finnhub.ts の汎用ニュース ticker 汚染バグ修正（index-as-ticker） — v2.5 (Phase 19, NEWS-04)
- ✓ 保有銘柄別関連ニュースの決定論的抽出と portfolio-analyst への入力供給（buildHoldingNewsMap → tmp/holding-news.json → プロンプト注入） — v2.5 (Phase 19, PORT-01)
- ✓ 保有12銘柄のWebSearchリサーチをfail-softな新設パイプラインステップ（Step 3-P）として実行し tmp/portfolio-research/{symbol}.json へ分離保存（[STEP:portfolio-research:*]マーカー可視化 + 12ファイル契約検証） — v2.5 (Phase 21, PORT-02/OPS-05。ライブ実行確認は21-HUMAN-UAT.mdで追跡)
- ✓ 保有銘柄別ニュース・リサーチ結果の判断根拠への反映（プロンプト契約+ガード指示。rationale実言及のライブ確認は22-HUMAN-UAT.mdで追跡） — v2.5 (Phase 22, PORT-03)
- ✓ 緊急度フラグ（urgent boolean、alias-transform硬化・重大材料判定基準付きプロンプト契約）とカードの赤「⚠ 緊急」バッジ — v2.5 (Phase 22, PORT-04/UI-07)
- ✓ 前日判断スナップショット注入（同日再実行ガード付き）とTS側決定論的 decisionChanged 検出（undefined/false区別）+ アンバー「判断変更: 前日→当日」バッジ — v2.5 (Phase 22, PORT-05/UI-07)
- ✓ ポートフォリオレポートから新規組入候補セクションを削除（通常・フォールバック両パス。portfolio-analyst への highlightedStocks 受け渡しは維持） — v2.5 (Phase 23, UI-08)
- ✓ ニュースダイジェスト記事への当日ミーティング関連注記（TS側決定論マッチング・ticker優先+テーマ照合、fail-soft 専用STEPマーカー） — v2.6 (Phase 24, XREP-01/XREP-02)
- ✓ 緊急度フラグ・判断の履歴監査トレイルを data/urgency-history.json に日次追記永続化（純関数 urgency-history.ts + fail-soft CLI write-urgency-history.ts、meeting-result date キー、同日上書きガード、Step 3f + Step 4 `git add docs/ data/`、全12銘柄スナップショット） — v2.6 (Phase 25, HIST-01/HIST-02)

### Active

v2.6 残タスク（要件定義は REQUIREMENTS.md で確定）:
- HIST-03: portfolio.html 週次ロールアップ表示（直近7日間の緊急フラグ・判断変更履歴、data/urgency-history.json を読み取り側で決定論的に集計） — Phase 26

### Out of Scope

- チャート画像生成 — v2.0でテキストベースに統一、画像不要（v2.3でSVGインラインチャートを採用、外部画像は依然不要）
- 新規アナリスト追加 — 現行の5+1構成を維持
- MinHash/LSH重複排除 — 160件/日にはJaccardで十分、過剰な複雑さ
- ML/LLMベース関連性スコアリング — 1記事ごとのAPI呼び出しはコスト非現実的（denylistフィルタで代替）
- リアルタイム株価ストリーミング — 日次バッチで十分

## Context

- TypeScript + tsx で実装
- yahoo-finance2 v3（`new YahooFinance()` でインスタンス化）
- Finnhub API でニュース取得
- Google News Japan + RSS でニュース補完
- レポートは docs/YYYY-MM-DD/ に出力（GitHub Pages 公開用）
- エージェントは小型・中型株を優先（NVDA, AAPL等の大型株は推奨から除外）
- Gemini API 依存は v2.0 Phase 4 で完全除去済み
- v2.1 で3レポート構成を復元済み（Daily Report / Meeting Minutes / Portfolio Report）
- ニュース取得: Finnhub API（汎用 + ポートフォリオティッカー別カンパニーニュース）+ Google News RSS + 5つの日本語RSSソース（計約160件/日）
- ニュースは filter.ts で品質フィルタ済み（URL+NFKC正規化Jaccard dedup、英日クロス言語dedup、denylist、24h時間フィルタ、直近6h優先スコア）。アナリストへの供給は50件固定ではなくフィルタ後の実数（MIN=20/MAX=80）
- 自動実行は launchd（毎朝実行）で scripts/run.sh 経由。STEPマーカー（stream-jsonログ）・EXIT_CODE捕捉・terminal-notifier通知・docs HTMLのSHA256チェックサム保護を備える
- パイプライン実行時間を performance.now() で計測し、ステップ別に最終出力表示
- v2.4 で4紙目の news-digest.html を追加: news-curator（opus 2体並列）が tmp/news.json のID付き記事プールから10〜15件を選定 → tmp/news-curation.json（ID参照方式）→ write-news-digest.ts が zod 二層バリデーション + generateNewsDigestHtml で描画。fail-soft設計（専用 [STEP:news-digest:*] マーカー、失敗時も既存3レポート継続）。index.html リンクは fs.access() 実在チェックで条件付き出し分け
- v2.5 で保有銘柄インテリジェンスを追加: buildHoldingNewsMap（holding-news.ts）が tmp/news.json から ticker一致+社名フォールバックで保有銘柄別ニュースを決定論的に抽出 → tmp/holding-news.json → portfolio-analyst プロンプト注入。invest.md Step 3-P が保有12銘柄のWebSearchリサーチを並列実行し tmp/portfolio-research/{symbol}.json へ分離保存（fail-soft、[STEP:portfolio-research:*]）。HoldingEvaluation は urgent フラグ（alias硬化）を持ち、decisionChanged は attachDecisionChanges（decision-diff.ts）が前日スナップショットとの等値比較でTS側決定論的に付与。保有銘柄カードに関連ニュースサブセクション・緊急/判断変更バッジを描画。新規組入候補セクションは削除済み

## Constraints

- **Tech stack**: TypeScript + tsx, Claude Code エコシステム内で完結
- **Data accuracy**: 株価データはYahoo Finance APIを維持（WebSearchでは精度不十分）
- **Report format**: HTML dark theme, Bloomberg-style を維持
- **Agent structure**: 5アナリスト+モデレーターの構成を維持

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Gemini → Claude Code 移行 | Claude Codeエコシステムで完結、API依存削減 | ✓ Good (Phase 2+4) |
| ハイブリッドアプローチ | データ取得TSは安定、AI分析のみ置換 | ✓ Good (Phase 1-3) |
| チャート画像廃止→SVGインライン | Claude非対応、v2.3でSVG文字列生成に統一（外部ライブラリ不要） | ✓ Good (Phase 4, 14) |
| スキルコマンド実行 | ユーザー主導で柔軟な実行タイミング | ✓ Good (Phase 1) |
| tmp/*.json ハンドオフ境界 | TS↔Claudeの受け渡しは全てファイル経由（stdoutは届かない） | ✓ Good (v2.2) |
| denylistのみ（allowlist不採用） | allowlistはReuters実証で54%の正規記事を誤除外 | ✓ Good (Phase 8) |
| トークンJaccard 0.70-0.75 | Dice係数は日本語多語タイトルで過大評価 | ✓ Good (Phase 8) |
| run.sh stream-json + EXIT_CODE捕捉 | `\| \| true`マスキング除去で失敗ステップ検知・通知が機能 | ✓ Good (Phase 14.1) |
| deploy を spawnSync 引数配列化 | LLM生成date値のシェルインジェクション防止（正規表現検証） | ✓ Good (Phase 14.1) |
| Phase 13の誤判定→14.1で実修正 | OPS-01/03を監査再オープン、根本バグ（run.sh 35-41行）を修正 | ⚠️ Revisit — 実装済み誤判定の再発防止（監査は実コード検証を要する） |
| ID参照方式キュレーション（n01〜n80） | AgentはIDのみ選定、URLはTS側で照合し幻覚URL・不正market値を構造的に防止 | ✓ Good (Phase 15) |
| ソフト件数クランプ（10〜15件） | 範囲外でもハードzodエラーにせずtruncate/クランプ、パイプラインを止めない | ✓ Good (Phase 15) |
| news-digest fail-soft分離 | 既存3レポートのPromise.allから独立したtry/catch + 専用STEPマーカー、失敗が本流を妨げない | ✓ Good (Phase 17, ライブ検証済み) |
| news-curator は opus 2体並列 | portfolio-analystと同格の品質を確保、記事プールはURL以外の全フィールドのみ渡す | ✓ Good (Phase 17) |
| index.htmlリンクはfs実在チェックから毎回導出 | パース済みリンクを毎回strip→再導出し、404リンク排除 + 古いリンクの自己修復 | ✓ Good (Phase 18, 118日分ライブ検証) |
| 保有銘柄別ニュース抽出はTS側決定論 | ticker一致優先+タイトルのみ社名フォールバック（matchAliases）、LLM選定に頼らず再現性を確保 | ✓ Good (Phase 19) |
| ポートフォリオリサーチを tmp/portfolio-research/ に分離 | Daily Report 用 tmp/websearch/ との構造的隔離で相互汚染を防止（隔離テスト付き） | ✓ Good (Phase 21) |
| LLM出力スキーマは passthrough().transform() で alias 硬化 | フィールド名ゆらぎ（summary/findings等）を正準形に吸収し、ハードエラーでパイプラインを止めない | ✓ Good (Phase 21, 22) |
| decisionChanged はTS側決定論的検出 | LLM自己申告を信用せず、前日スナップショットとの decision enum 等値比較で付与（TS専用フィールドはスキーマ transform で構造的に strip） | ✓ Good (Phase 22) |
| independent-then-compare 構成 | 前日判断を「まず独立評価→その後比較」の順でプロンプト注入しアンカリングを抑制、同日再実行ガード付き退避 | ✓ Good (Phase 22) |
| 新規組入候補はDaily Report専任 | ポートフォリオレポートの二重目的化を解消、highlightedStocks は文脈情報として受け渡しのみ維持 | ✓ Good (Phase 23) |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-07-04 — Phase 25 complete (Urgency History Persistence, HIST-01/HIST-02)*

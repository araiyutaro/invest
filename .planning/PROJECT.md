# Investment Agent

## What This Is

マルチエージェント投資分析システム。5人のAIアナリストとモデレーターが日次ミーティングを行い、米国株・日本株の分析レポートをBloomberg風HTMLで自動生成する。個人投資家（自分自身）のための意思決定支援ツール。

## Core Value

毎日の投資判断に必要な多角的分析（ファンダメンタル、テクニカル、マクロ、リスク、テンバガー候補）を、複数AIアナリストの議論形式で提供すること。

## Current State

**Shipped:** v2.4 News Curation Report (2026-07-03)

v2.0〜v2.4で、Gemini→Claude Code移行、3レポート構成復元、ニュース品質フィルタ、パイプライン計測、ニュース/分析/運用安定性/レポートUIの総合底上げ、そしてAI厳選ニュースダイジェスト（news-digest.html）の4紙目追加を完了。毎日の自動実行パイプライン（launchd経由）が失敗ステップを特定できるログ・通知を備え、4レポート（Daily Report / Meeting Minutes / Portfolio Report / News Digest）をGitHub Pagesへ自動デプロイする。ニュースキュレーションはID参照方式で幻覚URLを構造的に防止し、fail-soft設計により失敗時も既存3レポートの生成・デプロイに影響しない。

**Next milestone:** 未定（`/gsd-new-milestone` で定義。持ち越し候補: XREP-01 ダイジェスト記事とミーティングテーマの関連注記）

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

### Active

（なし — v2.4 全要件検証・出荷済み。次マイルストーン定義時に追加）

候補（v2.5+ 持ち越し）:
- XREP-01: ダイジェスト記事に当日ミーティングで議論されたテーマへの関連注記を表示（パイプライン順序依存が生じるためコア検証後に導入）

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
*Last updated: 2026-07-03 after v2.4 milestone*

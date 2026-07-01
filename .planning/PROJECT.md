# Investment Agent

## What This Is

マルチエージェント投資分析システム。5人のAIアナリストとモデレーターが日次ミーティングを行い、米国株・日本株の分析レポートをBloomberg風HTMLで自動生成する。個人投資家（自分自身）のための意思決定支援ツール。

## Core Value

毎日の投資判断に必要な多角的分析（ファンダメンタル、テクニカル、マクロ、リスク、テンバガー候補）を、複数AIアナリストの議論形式で提供すること。

## Current Milestone: v2.3 Analysis Quality & Operational Stability

**Goal:** ニュース品質・分析品質・運用安定性・レポートUIを総合的に底上げし、毎日の自動実行パイプラインの信頼性と出力品質を向上させる

**Target features:**
- Finnhubポートフォリオティッカー別ニュース取得、時間帯重み付け（直近6h優先）、英日クロス言語dedup
- 前日レポート注入によるクロスセッション分析記憶、スコアリングラウンドの専用並列エージェント化
- 自動実行のエラーリカバリ、index.html保護強化、ログ改善
- index.htmlデザイン刷新、モバイル対応、チャート/グラフ追加

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
- ✓ レポートUIデザイン刷新（index.htmlヒーロー+月別アコーディオン）・モバイル対応・VIX/セクターインラインチャート追加 — v2.3 (Phase 14)

### Active

- [ ] Finnhubポートフォリオティッカー別ニュース取得
- [ ] 時間帯重み付け（直近6h優先）
- [ ] 英日クロス言語重複排除
- [ ] 前日レポート注入によるクロスセッション分析記憶
- [ ] スコアリングラウンドの専用並列エージェント化
- [ ] 自動実行のエラーリカバリ強化
- [ ] index.html保護・ログ改善

### Out of Scope

- チャート画像生成 — v2.0でテキストベースに統一、画像不要
- launchd自動実行 — v2.0ではユーザー主導のコマンド実行に変更
- 新規アナリスト追加 — 現行の5+1構成を維持

## Context

- TypeScript + tsx で実装
- yahoo-finance2 v3（`new YahooFinance()` でインスタンス化）
- Finnhub API でニュース取得
- Google News Japan + RSS でニュース補完
- レポートは docs/YYYY-MM-DD/ に出力（GitHub Pages 公開用）
- エージェントは小型・中型株を優先（NVDA, AAPL等の大型株は推奨から除外）
- Gemini API 依存は v2.0 Phase 4 で完全除去済み
- v2.1 で3レポート構成を復元済み（Daily Report / Meeting Minutes / Portfolio Report）
- ニュース取得: Finnhub API + Google News RSS + 5つの日本語RSSソース（計約160件/日）
- アナリストには最新50件のみ渡しているが、品質フィルタなし

## Constraints

- **Tech stack**: TypeScript + tsx, Claude Code エコシステム内で完結
- **Data accuracy**: 株価データはYahoo Finance APIを維持（WebSearchでは精度不十分）
- **Report format**: HTML dark theme, Bloomberg-style を維持
- **Agent structure**: 5アナリスト+モデレーターの構成を維持

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Gemini → Claude Code 移行 | Claude Codeエコシステムで完結、API依存削減 | ✓ Complete (Phase 2+4) |
| ハイブリッドアプローチ | データ取得TSは安定、AI分析のみ置換 | ✓ Complete (Phase 1-3) |
| チャート画像廃止 | Claude非対応、テキストで十分 | ✓ Complete (Phase 4) |
| スキルコマンド実行 | ユーザー主導で柔軟な実行タイミング | ✓ Complete (Phase 1) |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-07-01 — Phase 14 (report-ui) complete, v2.3 milestone's final phase*

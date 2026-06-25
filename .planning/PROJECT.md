# Investment Agent

## What This Is

マルチエージェント投資分析システム。5人のAIアナリストとモデレーターが日次ミーティングを行い、米国株・日本株の分析レポートをBloomberg風HTMLで自動生成する。個人投資家（自分自身）のための意思決定支援ツール。

## Core Value

毎日の投資判断に必要な多角的分析（ファンダメンタル、テクニカル、マクロ、リスク、テンバガー候補）を、複数AIアナリストの議論形式で提供すること。

## Current Milestone: v2.1 Report Quality & Pipeline Overhaul

**Goal:** v1.0品質の3レポート構成を復元し、新規銘柄発掘とポートフォリオ管理を分離、GitHub Pagesへの自動デプロイ

**Target features:**
- 3レポート分離（Daily Report / Meeting Minutes / Portfolio Report）
- ニュース・市況からの新規銘柄発掘（ポートフォリオ外）
- アナリスト分析の詳細化（JSON圧縮→プロの散文分析）
- ポートフォリオ個別評価（保持/買増/売却判断）
- 出力先を docs/ に変更（GitHub Pages対応）
- レポート生成後の自動 git commit + push

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

### Active

- [ ] 3レポート構成の復元（Daily Report / Meeting Minutes / Portfolio Report）
- [ ] ニュース・市況からの新規銘柄発掘（ポートフォリオ非依存）
- [ ] アナリスト分析の詳細散文化（v1.0品質への回帰）
- [ ] ポートフォリオ個別評価と組入判断
- [ ] docs/ 出力 + 自動 git push（GitHub Pages デプロイ）

### Out of Scope

- チャート画像生成 — v2.0でテキストベースに統一、画像不要
- launchd自動実行 — v2.0ではユーザー主導のコマンド実行に変更
- 新規アナリスト追加 — 現行の5+1構成を維持

## Context

- TypeScript + tsx で実装
- yahoo-finance2 v3（`new YahooFinance()` でインスタンス化）
- Finnhub API でニュース取得
- Google News Japan + RSS でニュース補完
- レポートは reports/YYYY-MM-DD/ に出力
- エージェントは小型・中型株を優先（NVDA, AAPL等の大型株は推奨から除外）
- Gemini API 依存は v2.0 Phase 4 で完全除去済み
- v2.0 では単一レポートに退化 → v2.1 で3レポート構成を復元予定
- レポート出力先は docs/（GitHub Pages 公開用）

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
*Last updated: 2026-06-25 — v2.1 milestone started*

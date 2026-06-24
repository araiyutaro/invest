# Investment Agent

## What This Is

マルチエージェント投資分析システム。5人のAIアナリストとモデレーターが日次ミーティングを行い、米国株・日本株の分析レポートをBloomberg風HTMLで自動生成する。個人投資家（自分自身）のための意思決定支援ツール。

## Core Value

毎日の投資判断に必要な多角的分析（ファンダメンタル、テクニカル、マクロ、リスク、テンバガー候補）を、複数AIアナリストの議論形式で提供すること。

## Current Milestone: v2.0 Claude Code Migration

**Goal:** Gemini APIベースのAI分析をClaude Codeエージェントに全面移行し、スキルコマンドで実行可能にする

**Target features:**
- データ取得は既存TSコード活用、AI分析はClaude Codeエージェントに移行
- 5アナリスト+モデレーター構成をClaude Codeサブエージェントとして再実装
- ニュース分析・銘柄リサーチをClaude Code（WebSearch含む）に移行
- チャート画像生成廃止、テキストベースレポートに統一
- `/invest` スキルコマンドとして登録・実行
- Gemini API依存の完全除去

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

- [x] Claude Codeエージェントへの分析機能移行 — Validated in Phase 2: Analyst Subagents (5アナリスト並列3ラウンド+モデレーター統合)
- [x] スキルコマンド（/invest）による実行 — Validated in Phase 1: Data Layer + Skill Foundation
- [ ] Gemini API依存の除去

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
- @google/generative-ai（テキスト分析）と @google/genai（画像生成）は異なるパッケージ

## Constraints

- **Tech stack**: TypeScript + tsx, Claude Code エコシステム内で完結
- **Data accuracy**: 株価データはYahoo Finance APIを維持（WebSearchでは精度不十分）
- **Report format**: HTML dark theme, Bloomberg-style を維持
- **Agent structure**: 5アナリスト+モデレーターの構成を維持

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Gemini → Claude Code 移行 | Claude Codeエコシステムで完結、API依存削減 | — Pending |
| ハイブリッドアプローチ | データ取得TSは安定、AI分析のみ置換 | — Pending |
| チャート画像廃止 | Claude非対応、テキストで十分 | — Pending |
| スキルコマンド実行 | ユーザー主導で柔軟な実行タイミング | — Pending |

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
*Last updated: 2026-06-24 after Phase 2 (Analyst Subagents) completion*

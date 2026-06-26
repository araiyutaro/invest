---
gsd_state_version: 1.0
milestone: v2.2
milestone_name: News Quality & Pipeline Metrics
status: planning
stopped_at: Phase 8 context gathered
last_updated: "2026-06-26T05:23:40.249Z"
last_activity: 2026-06-26 — v2.2 roadmap created (Phases 8-10), 11/11 requirements mapped
progress:
  total_phases: 3
  completed_phases: 0
  total_plans: 5
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-26)

**Core value:** 毎日の投資判断に必要な多角的分析を、複数AIアナリストの議論形式で提供すること
**Current focus:** v2.2 Phase 8 — News Filter Module

## Current Position

Phase: 8 of 10 (News Filter Module)
Plan: — (not started)
Status: Ready to plan
Last activity: 2026-06-26 — v2.2 roadmap created (Phases 8-10), 11/11 requirements mapped

Progress: [░░░░░░░░░░] 0% (v2.2: 0/3 phases)

## Performance Metrics

**Velocity (cumulative):**

- v2.0 plans completed: 7
- v2.1 plans completed: 6
- v2.2 plans: 0/5

**By Phase (v2.2):**

| Phase | Plans | Completed | Avg/Plan |
|-------|-------|-----------|----------|
| 8. News Filter Module | 2 | 0 | - |
| 9. Pipeline Integration | 2 | 0 | - |
| 10. Pipeline Timing | 1 | 0 | - |

*Updated after each plan completion*

## Accumulated Context

### Key Decisions (v2.2 relevant)

- **tmp/ JSON境界**: TSとClaudeのハンドオフはすべて `tmp/*.json` ファイル経由
- **performance.now() 採用**: NTPジャンプによる負値防止のため Date.now() 禁止
- **tmp/pipeline-metrics.json 方式**: collect-data.ts の stdout は invest.md に届かないためファイル経由で計測値を渡す
- **denylistのみ**: allowlist方式はReuters実証で54%の正規投資記事を誤除外するため不採用
- **トークンJaccard 閾値0.70-0.75**: Dice係数は日本語多語タイトルで過大評価のためJaccard採用
- **二層dedup構造**: rss-sources.ts の既存内ソース dedup は削除し、filter.ts がクロスソース dedup を担当
- **新規npm依存ゼロ**: Jaccard・NFKC正規化はすべてネイティブTypeScriptで実装

### Pitfalls to Avoid (v2.2)

- **50文字プレフィックスdedup の精度崩壊** → NFKC正規化後のJaccard類似度に置換（TDD必須）
- **関連性フィルタの過剰除外** → denylistのみ使用；除外率5〜30%を毎回ログで監視
- **RSS pubDateパース失敗** → フォールバックは `new Date(0)`（エポック=ソート最下位）
- **計測値がユーザーに届かない** → `tmp/pipeline-metrics.json` 経由で invest.md が表示
- **50件制限の残存** → 統合前に `grep -r "slice(0, 50)\|最新50件" src/ .claude/` で全箇所特定

### Blockers

None

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| v2.3+ | Finnhubポートフォリオティッカー別ニュース取得 | Planned | v2.2 scope |
| v2.3+ | 時間帯重み付け（直近6h優先） | Planned | v2.2 scope |
| v2.3+ | クロス言語（英↔日）重複排除 | Planned | v2.2 scope |

## Session Continuity

Last session: 2026-06-26T05:23:40.238Z
Stopped at: Phase 8 context gathered
Resume file: .planning/phases/08-news-filter-module/08-CONTEXT.md

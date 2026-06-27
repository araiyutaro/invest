---
gsd_state_version: 1.0
milestone: v2.2
milestone_name: News Quality & Pipeline Metrics
status: executing
stopped_at: Phase 8 Plan 02 complete
last_updated: "2026-06-27T14:13:00Z"
last_activity: 2026-06-27 -- Phase 08 Plan 02 complete (FILT-01/02 TDD GREEN + dedup削除)
progress:
  total_phases: 6
  completed_phases: 1
  total_plans: 2
  completed_plans: 2
  percent: 33
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-26)

**Core value:** 毎日の投資判断に必要な多角的分析を、複数AIアナリストの議論形式で提供すること
**Current focus:** v2.2 Phase 8 — News Filter Module

## Current Position

Phase: 8 of 10 (News Filter Module) — COMPLETE
Plan: 2 complete / 2 total
Status: Phase 8 complete — ready for Phase 9 (Pipeline Integration)
Last activity: 2026-06-27 -- Phase 08 Plan 02 complete

Progress: [██░░░░░░░░] 33%

## Performance Metrics

**Velocity (cumulative):**

- v2.0 plans completed: 7
- v2.1 plans completed: 6
- v2.2 plans: 0/5

**By Phase (v2.2):**

| Phase | Plans | Completed | Avg/Plan |
|-------|-------|-----------|----------|
| 8. News Filter Module | 2 | 2 | 5min |
| 9. Pipeline Integration | 2 | 0 | - |
| 10. Pipeline Timing | 1 | 0 | - |

*Updated after each plan completion*

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 08-news-filter-module P01 | 5min | 2 tasks | 3 files |
| Phase 08-news-filter-module P02 | 5min | 2 tasks | 3 files |

## Accumulated Context

### Key Decisions (v2.2 relevant)

- **tmp/ JSON境界**: TSとClaudeのハンドオフはすべて `tmp/*.json` ファイル経由
- **performance.now() 採用**: NTPジャンプによる負値防止のため Date.now() 禁止
- **tmp/pipeline-metrics.json 方式**: collect-data.ts の stdout は invest.md に届かないためファイル経由で計測値を渡す
- **denylistのみ**: allowlist方式はReuters実証で54%の正規投資記事を誤除外するため不採用
- **トークンJaccard 閾値0.70-0.75**: Dice係数は日本語多語タイトルで過大評価のためJaccard採用
- **二層dedup構造**: rss-sources.ts の既存内ソース dedup は削除し、filter.ts がクロスソース dedup を担当
- **新規npm依存ゼロ**: Jaccard・NFKC正規化はすべてネイティブTypeScriptで実装
- **denylist タイトルのみ照合**: summaryは除外対象外 (Pitfall 5) — 偽陽性を最小化
- **filterByRelevance / isDenylisted をエクスポート**: Plan 09 統合テストでの直接アサートを可能にするため

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

Last session: 2026-06-27T14:13:00Z
Stopped at: Phase 8 Plan 02 complete — Phase 8 fully complete
Resume file: .planning/phases/09-pipeline-integration/09-01-PLAN.md

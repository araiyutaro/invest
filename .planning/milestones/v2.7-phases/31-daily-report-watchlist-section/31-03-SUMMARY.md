---
phase: 31-daily-report-watchlist-section
plan: 03
subsystem: pipeline-orchestration
tags: [typescript, promise-all, fail-soft, pipeline-wiring]

# Dependency graph
requires:
  - phase: 31-daily-report-watchlist-section (plan 01)
    provides: loadWatchlistJudgment(meetingResultDate) / loadWatchlist() fail-soft loaders in report-data-loaders.ts
  - phase: 31-daily-report-watchlist-section (plan 02)
    provides: generateDailyReportHtml extended with optional trailing watchlistJudgment/watchlist params + formatWatchlistSectionHtml rendering
provides:
  - "generate-report.ts main() now loads watchlist judgment + watchlist data in parallel via Promise.all and wires it into generateDailyReportHtml, completing the end-to-end watchlist section pipeline"
affects: [invest.md Step 3c (daily-report.html generation), future phases consuming watchlist rendering output]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Promise.all loader fan-out extension (append new loader + matching destructure variable, no reordering of existing entries)"]

key-files:
  created: []
  modified:
    - src/scripts/generate-report.ts

key-decisions:
  - "loadWatchlistJudgment(meetingResult.date) called with the already-parsed meetingResult.date (line 119-120) to activate the D-13 stale-file guard, rather than re-deriving date elsewhere"
  - "generateHtml wrapper (lines 84-91) left unmodified — Plan 02's new params are optional with defaults, so the existing 4-arg call site remains backward compatible without changes"
  - "invest.md left unmodified — Step 3-J -> Step 3c ordering was already established in Phase 30; this plan is rendering-layer wiring only"

patterns-established: []

requirements-completed: [UI-09, UI-10, OPS-06]

coverage:
  - id: D1
    description: "generate-report.ts の import に loadWatchlistJudgment / loadWatchlist が追加され、Promise.all で並列読込される"
    requirement: "UI-09"
    verification:
      - kind: unit
        ref: "src/scripts/generate-report.test.ts (81 tests, full suite green after wiring change)"
        status: pass
      - kind: other
        ref: "grep -c 'loadWatchlistJudgment(meetingResult.date)' src/scripts/generate-report.ts -> 1"
        status: pass
    human_judgment: false
  - id: D2
    description: "generateDailyReportHtml 呼び出しが watchlistJudgment/watchlist を末尾引数に渡す6引数呼び出しに拡張される"
    requirement: "UI-10"
    verification:
      - kind: unit
        ref: "src/scripts/generate-report.test.ts (backward-compat + wiring tests, all pass)"
        status: pass
    human_judgment: false
  - id: D3
    description: "ローダー失敗（null/{}）が他レポート生成・デプロイを止めない（fail-soft）"
    requirement: "OPS-06"
    verification:
      - kind: unit
        ref: "src/scripts/report-data-loaders.test.ts (30 tests covering ENOENT/parse-fail/shape-mismatch fallback to null/{})"
        status: pass
    human_judgment: false
  - id: D4
    description: "生成された daily-report.html にウォッチリストセクションが実描画される（ブラウザ目視確認）"
    verification: []
    human_judgment: true
    rationale: "静的解析・単体テストでは色味・レイアウト・バッジの視認性・実パイプライン出力での挿入順序を確認できないため、実機ブラウザ確認が必要。31-HUMAN-UAT.md で追跡（Phase 21/22/24/29/30 前例踏襲）。2026-07-16 分の daily-report.html は本プラン配線前に生成済みのため対象外、次回パイプライン実行で検証可能になる。"

# Metrics
duration: 4min
completed: 2026-07-16
status: complete
---

# Phase 31 Plan 03: Daily Report Watchlist Pipeline Wiring Summary

**generate-report.ts の main() が loadWatchlistJudgment/loadWatchlist を Promise.all に追加し、generateDailyReportHtml へ判定データとウォッチリストを渡すことで、Plan 01 の fail-soft ローダーと Plan 02 のセクション描画を実パイプラインに統合した。**

## Performance

- **Duration:** 4 min
- **Started:** 2026-07-15T23:38:00Z (after prior plan commits)
- **Completed:** 2026-07-15T23:39:02Z
- **Tasks:** 1 auto task + 1 checkpoint:human-verify (persisted to HUMAN-UAT)
- **Files modified:** 1

## Accomplishments
- `generate-report.ts` の import に `loadWatchlistJudgment` / `loadWatchlist` を `report-data-loaders.js` から追加
- `main()` の `Promise.all`（11要素 → 13要素）に `loadWatchlistJudgment(meetingResult.date)` と `loadWatchlist()` を追加し、分割代入に `watchlistJudgment` / `watchlist` を追加
- `generateDailyReportHtml` 呼び出しを4引数から6引数に拡張し、判定データとウォッチリストを渡す
- `generateHtml` ラッパー・invest.md は無変更（後方互換維持、Step 3-J → Step 3c の順序は Phase 30 で確立済み）
- 単体テスト（生成レポート系・ローダー系）111/111 GREEN、フルスイート610/610 GREEN、回帰なし

## Task Commits

Each task was committed atomically:

1. **Task 1: generate-report.ts の Promise.all と generateDailyReportHtml 呼び出しを配線する** - `7f755c4` (feat)
2. **Task 2: daily-report.html のウォッチリストセクション実描画を目視確認する** - checkpoint:human-verify — 31-HUMAN-UAT.md に永続化（Phase 21/22/24/29/30 前例踏襲、実機実行待ちのため plan は complete のまま保持）

**Plan metadata:** (this commit) `docs(31-03): complete plan`

## Files Created/Modified
- `src/scripts/generate-report.ts` - import 追加（loadWatchlistJudgment/loadWatchlist）、Promise.all に2ローダー追加、generateDailyReportHtml 呼び出しを6引数に拡張

## Decisions Made
- `loadWatchlistJudgment` には既に119-120行目でparse済みの `meetingResult.date` を渡し、D-13 stale ガードを有効化した（別途 date を再導出しない）
- `generateHtml` ラッパー（84-91行）は無変更 — Plan 02 の新引数はデフォルト値付き optional のため既存4引数呼び出しは後方互換で動作する（Pitfall 1 回避）
- invest.md も無変更 — Step 3-J → Step 3c の順序は Phase 30 で既に確立済み、本プランは描画層の配線のみ

## Deviations from Plan

None - plan executed exactly as written. Diff matches the plan's `<action>` spec verbatim (import addition, 2-element Promise.all extension, 6-arg call site).

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Human Verification Deferred

Task 2 (`checkpoint:human-verify`, gate="blocking") requires live browser inspection of a `daily-report.html` generated *after* this plan's wiring commit (7f755c4). The most recent report (`docs/2026-07-16/daily-report.html`) was generated before this commit and does not include the watchlist section, so it cannot serve as the verification target.

Per the established precedent (Phase 21/22/24/29/30 `checkpoint:human-verify` persistence pattern), the 7 verification items from the plan's `<how-to-verify>` section have been recorded in `.planning/phases/31-daily-report-watchlist-section/31-HUMAN-UAT.md` as `pending`, to be confirmed after the next pipeline execution (next `launchd` morning run or manual `/invest` execution through Step 3c). This plan is marked `status: complete` because all code-level work (Task 1) is done, tested, and committed — only the runtime visual confirmation remains outstanding, tracked separately in the HUMAN-UAT file.

## Next Phase Readiness
- Phase 31 (all 3 plans) code-complete: watchlist judgment data now flows end-to-end from `tmp/watchlist-judgment.json` / `data/watchlist.json` through fail-soft loaders (Plan 01) and rendering functions (Plan 02) into the live `daily-report.html` output (Plan 03).
- v2.7 milestone (Entry Timing Watchlist & ETF Exclusion) has no further phases in ROADMAP.md — this completes the 5-phase build (27-31).
- Remaining outstanding item: 31-HUMAN-UAT.md live verification, to be resolved organically via the next scheduled pipeline run, consistent with how prior phases' HUMAN-UAT gaps were tracked to milestone close.

---
*Phase: 31-daily-report-watchlist-section*
*Completed: 2026-07-16*

## Self-Check: PASSED

- FOUND: src/scripts/generate-report.ts
- FOUND: .planning/phases/31-daily-report-watchlist-section/31-HUMAN-UAT.md
- FOUND commit: 7f755c4 (feat(31-03): generate-report.ts にウォッチリストローダーと描画配線を追加)

---
phase: 30-buy-timing-judgment-agent
plan: 01
subsystem: portfolio-judgment
tags: [zod, typescript, alias-hardening, pure-functions, vitest, tdd]

# Dependency graph
requires:
  - phase: 29-daily-tracking-data-supply
    provides: watchlist-technicals/watchlist-news 決定論的データ供給パイプライン、TechnicalSnapshot 型
provides:
  - WatchlistJudgment / WatchlistJudgmentFile 正準型（src/meeting/types.ts）
  - rawWatchlistJudgmentSchema → watchlistJudgmentSchema 二段階 alias 硬化スキーマ（src/meeting/schemas.ts）
  - applyConfluenceGate / attachActionChanges / deriveMarket / buildSkippedJudgment 純関数群（src/portfolio/watchlist-judgment.ts）
affects: [30-buy-timing-judgment-agent Plan 02 (CLI), 30-buy-timing-judgment-agent Plan 03 (orchestration), 31-daily-report-watchlist-section]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "二段階 alias 硬化スキーマ（rawXSchema.passthrough().transform() → canonicalSchema）: rawHoldingSchema→holdingEvaluationSchema の複製を watchlistJudgmentSchema に適用"
    - "TS専用派生フィールドの構造的排除: asOf/market/previousAction/actionChanged は raw スキーマに存在せず、transform 内で参照しない（LLMエコー混入防止）"
    - "attachDecisionChanges の逐語的クローン: today配列primary-loop + prevをMap.get専用 + prevなし/未マッチはプロパティ非付与"

key-files:
  created:
    - src/portfolio/watchlist-judgment.ts
    - src/portfolio/watchlist-judgment.test.ts
  modified:
    - src/meeting/types.ts
    - src/meeting/schemas.ts
    - src/meeting/schemas.test.ts

key-decisions:
  - "normalizeTodayAction の alias 優先順位は todayAction→action→verdict（日本語含む）→buyToday→デフォルトwait（fail-closed）"
  - "watchlistTodayActionEnum を rawWatchlistJudgmentSchema 内で共有定義し todayAction/action 両エイリアスで再利用"
  - "スキーマ内の説明コメントから asOf/market/previousAction/actionChanged の直書きを避け、grepベースのsource assertionを誤検知させないよう「TS専用の派生フィールド」という言い換えを採用"

patterns-established:
  - "Pattern: LLM出力契約は二段階 passthrough/transform、TS専用フィールドは raw スキーマから構造的排除（D-08 の型シグネチャレベルでの強制）"
  - "Pattern: 決定論的変化検出は today 配列を primary ループとし、prev は Map lookup 専用（decision-diff.ts と watchlist-judgment.ts で共通）"

requirements-completed: [TIME-02, TIME-03, TIME-04, TIME-05]

coverage:
  - id: D1
    description: "watchlistJudgmentSchema がフィールド名ゆらぎ（action/verdict/buyToday/日本語値）を todayAction 二値enumに正準化し、TS専用4フィールドを構造的にstripし、不正・未知フィールドでもthrowせずfail-closedでwaitをデフォルトにする"
    requirement: "TIME-02"
    verification:
      - kind: unit
        ref: "src/meeting/schemas.test.ts#watchlistJudgmentSchema (TIME-02)"
        status: pass
    human_judgment: false
  - id: D2
    description: "attachActionChanges が前日判定との todayAction 等値比較のみで previousAction/actionChanged を付与し、prevなし銘柄・today限定銘柄にはプロパティ自体を付与しない（undefined/false区別）"
    requirement: "TIME-03"
    verification:
      - kind: unit
        ref: "src/portfolio/watchlist-judgment.test.ts#attachActionChanges (TIME-03)"
        status: pass
    human_judgment: false
  - id: D3
    description: "applyConfluenceGate が todayAction=buy かつ signals<2件の判定を決定論的にwaitへ降格しconsole.warnログを出す"
    requirement: "TIME-04"
    verification:
      - kind: unit
        ref: "src/portfolio/watchlist-judgment.test.ts#applyConfluenceGate (TIME-04)"
        status: pass
    human_judgment: false
  - id: D4
    description: "deriveMarket が .T サフィックスからUS/JPを決定論導出し、buildSkippedJudgmentがテクニカル欠落銘柄をstatus:skippedの陽性レコードにする"
    requirement: "TIME-05"
    verification:
      - kind: unit
        ref: "src/portfolio/watchlist-judgment.test.ts#deriveMarket (TIME-05) / #buildSkippedJudgment (TIME-05 / D-20)"
        status: pass
    human_judgment: false

duration: 3min
completed: 2026-07-15
status: complete
---

# Phase 30 Plan 01: 判定パイプライン決定論コアの実装 Summary

**LLM出力契約を二段階alias硬化スキーマで防御し、confluenceゲート・変化検出・market導出・skip陽性記録の4純関数をTDDで実装（TIME-02〜05）**

## Performance

- **Duration:** 3 min
- **Started:** 2026-07-15T11:46:43Z
- **Completed:** 2026-07-15T11:49:51Z
- **Tasks:** 2
- **Files modified:** 5 (2 new, 3 modified)

## Accomplishments
- `WatchlistJudgment` / `WatchlistJudgmentFile` 正準型を `src/meeting/types.ts` に追加。`asOf`/`market`/`previousAction`/`actionChanged` は「TS側決定論付与、LLM生出力には存在しない」旨のJSDocを `HoldingEvaluation` の既存規約に沿って付与
- `rawWatchlistJudgmentSchema` → `watchlistJudgmentSchema` の二段階 `passthrough().transform()` スキーマを実装。`normalizeTodayAction` が `todayAction`/`action`/`verdict`（日本語「買い」「待ち」含む）/`buyToday`（lenientBoolean経路）の全alias経路を `"buy" | "wait"` に正準化し、全欠落時は fail-closed で `"wait"` をデフォルトにする
- `applyConfluenceGate`/`attachActionChanges`/`deriveMarket`/`buildSkippedJudgment` の4純関数を `src/portfolio/watchlist-judgment.ts` に実装。全て同期・I/O無し・try/catch無し
- `attachActionChanges` は `decision-diff.ts` の `attachDecisionChanges` を逐語的にクローン: today配列をprimaryループ、prevはMap lookup専用、prevなし/未マッチ銘柄はプロパティ自体を非付与（undefined値ではなくキー欠如）
- schemas.test.ts に7テスト、watchlist-judgment.test.ts に13テスト（計20テスト）を新規追加、全green。既存548テストへの回帰なし

## Task Commits

Each task was TDD RED→GREEN:

1. **Task 1: WatchlistJudgment 型定義と二段階 alias 硬化スキーマ（TIME-02）**
   - `5fd8f9c` (test): RED — schemas.test.ts に7テスト追加、types.ts に型追加
   - `201026a` (feat): GREEN — watchlistJudgmentSchema 実装
2. **Task 2: 決定論純関数群とテスト（TIME-03/04/05）**
   - `fa1186b` (test): RED — watchlist-judgment.test.ts 新規作成（13テスト）
   - `1c018b8` (feat): GREEN — watchlist-judgment.ts 実装

## Files Created/Modified
- `src/meeting/types.ts` - `WatchlistJudgment`/`WatchlistJudgmentFile` 型を追加
- `src/meeting/schemas.ts` - `rawWatchlistJudgmentSchema`/`watchlistJudgmentSchema`/`normalizeTodayAction`/`validateWatchlistJudgment` を追加
- `src/meeting/schemas.test.ts` - `watchlistJudgmentSchema` の describe ブロック（alias受理・日本語値・寛容boolean・passthrough・strip検証）を追加
- `src/portfolio/watchlist-judgment.ts` - 新規。4純関数を実装
- `src/portfolio/watchlist-judgment.test.ts` - 新規。13テストケース（makeJudgment ファクトリ含む）

## Decisions Made
- `normalizeTodayAction` の alias 優先順位を `todayAction → action → verdict（日本語含む）→ buyToday → デフォルトwait` に固定（fail-closed、D-07思想）
- `watchlistTodayActionEnum` を raw スキーマ内で共有定義し `todayAction`/`action` 両フィールドで再利用（DRY）
- スキーマの説明コメントで `asOf`/`market`/`previousAction`/`actionChanged` の固有名詞を直書きすると、acceptance_criteriaのgrepベースsource assertion（`sed -n '/rawWatchlistJudgmentSchema/,/passthrough/p' | grep -c -E '...'`）が説明コメント自体を誤検知しカウントしてしまうことが判明したため、「TS専用の派生フィールド」という言い換えに修正（実装ロジックへの影響なし、コメント表現のみの調整）

## Deviations from Plan

None - plan executed exactly as written. TDD RED→GREENサイクルを両タスクで完遂し、全acceptance_criteria（grep/source assertion含む）を検証済み。

## Issues Encountered
- スキーマファイルの説明コメントに `asOf`/`market`/`previousAction`/`actionChanged` という単語を直接書いた初回実装では、acceptance_criteria の grep source assertion（`grep -c -E '\basOf\b|\bmarket\b|...'` が0であることを要求）が誤って2件ヒットした。実装ロジック自体は正しかったが（raw スキーマにこれらのフィールドは定義されていない）、コメント文言を「TS専用の派生フィールド」に言い換えて再検証しゼロヒットを確認した。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Plan 02（CLI: `write-watchlist-judgment.ts`）が本Planの型・スキーマ・純関数に依存できる状態が整った
- Plan 03（オーケストレーション: invest.md Step 3-J）は `watchlistJudgmentSchema`/`applyConfluenceGate`/`attachActionChanges`/`deriveMarket`/`buildSkippedJudgment` を安全に import 可能
- ブロッカーなし

---
*Phase: 30-buy-timing-judgment-agent*
*Completed: 2026-07-15*

## Self-Check: PASSED

All created files verified present on disk (types.ts, schemas.ts, schemas.test.ts, watchlist-judgment.ts, watchlist-judgment.test.ts, 30-01-SUMMARY.md). All 4 task commits (5fd8f9c, 201026a, fa1186b, 1c018b8) verified present in git log.

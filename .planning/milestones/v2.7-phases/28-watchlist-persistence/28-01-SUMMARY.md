---
phase: 28-watchlist-persistence
plan: 01
subsystem: portfolio
tags: [typescript, vitest, pure-functions, state-machine, tdd]

# Dependency graph
requires:
  - phase: 27-etf-exclusion
    provides: filterEtfStocks (第2ゲート, D-21) と QuoteTypeLookup 判別可能ユニオン型
provides:
  - "src/portfolio/watchlist.ts: WatchlistEntry/WatchlistFile/WatchlistRemovalEpisode/WatchlistCandidate 型定義"
  - "admitBullishStocks: 強気銘柄の登録・reconfirm・冪等・ETF第2ゲート・re-admission"
  - "pruneWatchlist: downgraded/purchased/expired の3トリガー除外・履歴保持・優先順位"
  - "getActiveWatchlistEntries: Phase 29/30 が消費する安定シグネチャ"
affects: [29-daily-tracking-data-supply, 30-buy-timing-judgment-agent, 31-daily-report-watchlist-section]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "active フィールド + history 配列方式（episode配列方式ではない）でウォッチリスト状態を表現（D-06）"
    - "spread-merge（{ ...acc, [key]: entry }）による冪等・prototype-pollution耐性のあるオブジェクト構築（urgency-history.ts踏襲）"
    - "純関数境界: I/O・ネットワーク非依存、today を引数で受け取り関数内でDate.now()を呼ばない決定論設計"

key-files:
  created:
    - src/portfolio/watchlist.ts
    - src/portfolio/watchlist.test.ts
  modified: []

key-decisions:
  - "D-06のスキーマ形状としてactiveフィールド+history配列方式を採用（episode配列方式より isActive 判定が単純）"
  - "pruneWatchlistのトリガー優先順位を purchased > downgraded > expired に固定（Pitfall 3対策、テストで検証）"
  - "暦日差計算はDateのミリ秒差からの単純計算のみ（営業日/祝日カレンダー非依存、D-07）"
  - "admitBullishStocks/pruneWatchlistはquote()を一切呼ばず、quoteTypeByTicker/nameByTicker/holdingsを引数で受け取る（ネットワーク非依存を維持、D-23）"

patterns-established:
  - "純関数モジュールのウォッチリスト状態機械: admit→prune の2関数構成で登録と除外を分離し、両方throw-free・mutate-free"

requirements-completed: [WLST-01, WLST-02, WLST-03, WLST-04, WLST-05]

coverage:
  - id: D1
    description: "当日verdict強気のhighlightedStocks銘柄（ETF除外後）がtickerキーでwatchlistのactiveエピソードとして登録される"
    requirement: "WLST-01"
    verification:
      - kind: unit
        ref: "src/portfolio/watchlist.test.ts#admitBullishStocks (WLST-01) > 新規の強気銘柄は addedDate=today, lastVerdictDate=today で active エントリとして登録される"
        status: pass
      - kind: unit
        ref: "src/portfolio/watchlist.test.ts#admitBullishStocks (WLST-01) > 既にアクティブな銘柄が当日再度強気なら lastVerdictDate が today に更新され addedDate は初回値を保持する（reconfirm）"
        status: pass
      - kind: unit
        ref: "src/portfolio/watchlist.test.ts#admitBullishStocks (WLST-01) > 同日2回 admit を呼んでも結果が同一である（冪等, D-17）"
        status: pass
    human_judgment: false
  - id: D2
    description: "verdict中立/弱気に転落したactive銘柄がremovedReason=downgradedで除外され、レコードはhistoryに残る"
    requirement: "WLST-02"
    verification:
      - kind: unit
        ref: "src/portfolio/watchlist.test.ts#pruneWatchlist (WLST-02/03/04/05) > active 銘柄が当日 verdict=中立 で登場したら removedReason=downgraded で除外される（WLST-02）"
        status: pass
      - kind: unit
        ref: "src/portfolio/watchlist.test.ts#pruneWatchlist (WLST-02/03/04/05) > active 銘柄が当日 verdict=弱気 で登場したら removedReason=downgraded で除外される（WLST-02）"
        status: pass
    human_judgment: false
  - id: D3
    description: "PORTFOLIO_HOLDINGSに含まれるactive銘柄がremovedReason=purchasedで除外される"
    requirement: "WLST-03"
    verification:
      - kind: unit
        ref: "src/portfolio/watchlist.test.ts#pruneWatchlist (WLST-02/03/04/05) > active 銘柄が PORTFOLIO_HOLDINGS の symbol に一致すれば removedReason=purchased で除外される（WLST-03/D-12）"
        status: pass
    human_judgment: false
  - id: D4
    description: "lastVerdictDateからEXPIRY_CALENDAR_DAYS超過のactive銘柄がremovedReason=expiredで失効する（境界含む）"
    requirement: "WLST-04"
    verification:
      - kind: unit
        ref: "src/portfolio/watchlist.test.ts#pruneWatchlist (WLST-02/03/04/05) > lastVerdictDate から経過日数がちょうど EXPIRY_CALENDAR_DAYS のときは失効しない（境界, D-08）"
        status: pass
      - kind: unit
        ref: "src/portfolio/watchlist.test.ts#pruneWatchlist (WLST-02/03/04/05) > lastVerdictDate から経過日数が EXPIRY_CALENDAR_DAYS+1 のときは removedReason=expired で失効する（境界, D-08）"
        status: pass
    human_judgment: false
  - id: D5
    description: "除外・失効してもremovedReason/removedDateがhistoryに保持され、再追加は過去の除外記録を破壊せず新エピソードを作る"
    requirement: "WLST-05"
    verification:
      - kind: unit
        ref: "src/portfolio/watchlist.test.ts#pruneWatchlist (WLST-02/03/04/05) > 除外後も removedReason/removedDate が history に保持され、レコード自体は削除されない（WLST-05/D-05）"
        status: pass
      - kind: unit
        ref: "src/portfolio/watchlist.test.ts#admitBullishStocks (WLST-01) > 除外済み（history あり・addedDate なし）の ticker が再度強気なら history を保持したまま新 active エピソードを作る（re-admission, D-05）"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-07-15
status: complete
---

# Phase 28 Plan 01: Watchlist Core Logic Summary

**純関数モジュール src/portfolio/watchlist.ts — admitBullishStocks（強気登録・冪等・ETF第2ゲート）とpruneWatchlist（3トリガー除外・履歴保持）でウォッチリスト状態機械を実装、20件のvitestテストで全WLST要件を検証**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-15T02:26:16Z
- **Completed:** 2026-07-15T02:30:48Z
- **Tasks:** 3
- **Files modified:** 2 (both new)

## Accomplishments
- `WatchlistEntry`/`WatchlistFile`/`WatchlistRemovalEpisode`/`WatchlistCandidate` 型と `EXPIRY_CALENDAR_DAYS`(=30) を定義し、`isActive`/`getActiveWatchlistEntries` を実装（Phase 29/30 向け安定シグネチャ）
- `admitBullishStocks` を実装: 新規登録・reconfirm（addedDate保持/lastVerdictDate前進）・冪等・ETF第2ゲート（`filterEtfStocks` 再利用、fail-closed）・re-admission（history保持）
- `pruneWatchlist` を実装: downgraded（中立/弱気）・purchased（PORTFOLIO_HOLDINGS一致）・expired（暦日30日超過）の3トリガーを優先順位 purchased > downgraded > expired で判定し、除外時は history 追記でレコードを保持
- 20件のvitestテスト（isActive/getActiveWatchlistEntries/EXPIRY: 5件、admitBullishStocks: 6件、pruneWatchlist: 9件）が全green、プロジェクト全体459テストも回帰なし

## Task Commits

Each task was committed atomically (TDD: test → feat):

1. **Task 1: 型定義と定数・アクティブ導出関数** - `3c12101` (test, RED) → `f65279d` (feat, GREEN)
2. **Task 2: admitBullishStocks** - `bfd80b5` (test, GREEN — 実装はTask1コミットに含まれる単一ファイル実装のため同時完成)
3. **Task 3: pruneWatchlist** - `966609d` (test, GREEN — 同上)

_Note: watchlist.ts は型・定数・全関数を一括実装したため、Task 2/3 では実装コミットを追加せずテストコミットのみで対応するタスクのGREENを確認した。各タスクの受け入れ基準（grep検証・vitest実行）はすべてタスク単位で個別に確認済み。_

## Files Created/Modified
- `src/portfolio/watchlist.ts` - 純関数モジュール本体（型定義、EXPIRY_CALENDAR_DAYS、isActive、getActiveWatchlistEntries、admitBullishStocks、pruneWatchlist、内部ヘルパー calendarDaysBetween/removeEntry/mergeNameFields）
- `src/portfolio/watchlist.test.ts` - WLST-01〜05 に対応する単体テスト（20件）

## Decisions Made
- D-06のスキーマ形状として「activeフィールド+history配列」方式を採用（isActiveがaddedDate!==undefinedの単純判定で済む）
- pruneWatchlistのトリガー優先順位を purchased > downgraded > expired に固定し、precedenceテストで明示的に検証（Pitfall 3対策）
- 暦日差計算は`Date.parse`のミリ秒差からの単純計算のみを採用し、営業日/祝日カレンダーには依存しない（D-07）
- admitBullishStocks/pruneWatchlistはquote()を一切呼ばず、quoteTypeByTicker/nameByTicker/holdingsをすべて引数で受け取ることでネットワーク非依存・決定論性・単体テスト容易性を維持（D-23）
- watchlist.jsonはTS自己生成ファイルでLLM出力ではないためzodバリデーションは不要と判断（D-19）

## Deviations from Plan

None - plan executed exactly as written. すべてのタスクの `<acceptance_criteria>` を grep および vitest で個別検証済み。

## Issues Encountered
None

## User Setup Required
None - no external service configuration required. watchlist.ts は純関数モジュールのみで、ファイルI/O・ネットワークアクセスを一切持たない。

## Next Phase Readiness
- `getActiveWatchlistEntries` が Phase 29 のデータ供給ステップ・Phase 30 の判定エージェントが依存する安定シグネチャとして export 済み
- Plan 02（本フェーズ Wave 2, CLI ラッパー）は本 Plan の `admitBullishStocks`/`pruneWatchlist` に quote() 結果（quoteTypeByTicker/nameByTicker）と `PORTFOLIO_HOLDINGS`/`data/watchlist.json` の読み書きを配線するだけでよい状態
- ブロッカーなし

---
*Phase: 28-watchlist-persistence*
*Completed: 2026-07-15*

## Self-Check: PASSED

- FOUND: src/portfolio/watchlist.ts
- FOUND: src/portfolio/watchlist.test.ts
- FOUND: .planning/phases/28-watchlist-persistence/28-01-SUMMARY.md
- FOUND: 3c12101
- FOUND: f65279d
- FOUND: bfd80b5
- FOUND: 966609d

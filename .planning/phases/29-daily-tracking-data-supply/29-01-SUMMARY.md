---
phase: 29-daily-tracking-data-supply
plan: 01
subsystem: portfolio
tags: [watchlist, technicals, chunking, cache, pure-function, tdd]

# Dependency graph
requires:
  - phase: 28-watchlist-persistence
    provides: WatchlistEntry / WatchlistFile / getActiveWatchlistEntries（正規化済み ticker を保持する data/watchlist.json 状態機械）
provides:
  - toPortfolioHoldingShape（WatchlistEntry[] → PortfolioHolding[] 決定論的アダプタ）
  - mergeWithCache（アクティブ ticker と同日キャッシュの突き合わせ、欠落 ticker 算出）
  - chunk（固定サイズ配列分割の純関数）
  - fetchChunked（チャンク単位並列取得+チャンク間待機、per-ticker fail-soft 分離）
  - CHUNK_SIZE / CHUNK_DELAY_MS 名前付き定数
  - TechnicalsCacheFile 型（tmp/technicals.json 形状）
affects: [29-02-daily-tracking-data-supply-plan, 30-buy-timing-judgment-agent]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "pure-module + fail-soft CLI 分割（urgency-history.ts / watchlist.ts と同型）"
    - "チャンク化並列取得（CHUNK_SIZE=5固定サイズ + CHUNK_DELAY_MS=300msチャンク間待機）"

key-files:
  created:
    - src/portfolio/watchlist-data.ts
    - src/portfolio/watchlist-data.test.ts
  modified: []

key-decisions:
  - "toPortfolioHoldingShape は matchAliases を省略（D-15: 人手キュレーション不採用）"
  - "fetchChunked の atomic unit は fetchOne 引数で注入し fetchTechnicalSnapshots（複数形）には一切依存しない（Pitfall 1 回避）"
  - "CHUNK_SIZE/CHUNK_DELAY_MS はファイル内でリテラル重複させず名前付き定数として1箇所のみ定義（D-09）"

patterns-established:
  - "純関数モジュールは throw-free・I/O-free・入力非mutate を徹底し、fs/yahoo-finance2 のモック不要でテスト可能にする（Plan 02 の CLI 層が I/O を担当）"

requirements-completed: [TRAC-01, TRAC-02, TRAC-03]

coverage:
  - id: D1
    description: "toPortfolioHoldingShape が WatchlistEntry[] を PortfolioHolding[] 形状に決定論的にマップする（name/nameJaフォールバック、sector固定、matchAliases省略）"
    requirement: "TRAC-02"
    verification:
      - kind: unit
        ref: "src/portfolio/watchlist-data.test.ts#toPortfolioHoldingShape"
        status: pass
    human_judgment: false
  - id: D2
    description: "mergeWithCache がアクティブ ticker と同日キャッシュを突き合わせ、キャッシュヒット集合と欠落 ticker を返す"
    requirement: "TRAC-01"
    verification:
      - kind: unit
        ref: "src/portfolio/watchlist-data.test.ts#mergeWithCache"
        status: pass
    human_judgment: false
  - id: D3
    description: "chunk が固定サイズで配列を分割する（12要素/size5→5,5,2など）"
    requirement: "TRAC-01"
    verification:
      - kind: unit
        ref: "src/portfolio/watchlist-data.test.ts#chunk"
        status: pass
    human_judgment: false
  - id: D4
    description: "fetchChunked がチャンク単位で並列取得し、1銘柄の null/reject が他銘柄の snapshot を失わせない（TRAC-03 の純関数レベル保証）"
    requirement: "TRAC-03"
    verification:
      - kind: unit
        ref: "src/portfolio/watchlist-data.test.ts#fetchChunked"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-07-15
status: complete
---

# Phase 29 Plan 01: Watchlist Data Pure Functions Summary

**ウォッチリスト銘柄のテクニカル収集に必要な4純関数（形状マップ/キャッシュ突き合わせ/チャンク分割/チャンク単位フェイルソフト並列取得）をTDDで実装、fetchTechnicalSnapshots複数形への依存ゼロで並列度を構造的に制限**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-15T03:56:38Z
- **Completed:** 2026-07-15T03:59:13Z
- **Tasks:** 2 completed
- **Files modified:** 2 (1 new module + 1 new test file)

## Accomplishments
- `toPortfolioHoldingShape` により `WatchlistEntry[]` を既存の `buildHoldingNewsMap`（holding-news.ts）に無改変で渡せる `PortfolioHolding[]` 形状へ決定論的に変換
- `mergeWithCache` により同日キャッシュ（tmp/technicals.json）ヒット銘柄を再取得対象から除外し、欠落銘柄のみを特定
- `chunk` + `fetchChunked` により固定サイズ（CHUNK_SIZE=5）でチャンク化した並列取得を実装し、チャンク間に待機（CHUNK_DELAY_MS=300ms）を挟んでYahoo Financeへの過負荷を回避
- 1銘柄の取得失敗（null/reject）が他銘柄のスナップショットを失わせないことを、fake timers・per-ticker reject分離テストで構造的に検証済み

## Task Commits

Each task was committed atomically (TDD RED→GREEN):

1. **Task 1: toPortfolioHoldingShape と mergeWithCache** - `18b742d` (test) → `4655b6f` (feat)
2. **Task 2: chunk と fetchChunked** - `984433b` (test) → `dd5f034` (feat)

_TDD tasks each have 2 commits (RED test → GREEN implementation), per plan-level `type: tdd`_

## Files Created/Modified
- `src/portfolio/watchlist-data.ts` - 純モジュール。toPortfolioHoldingShape / mergeWithCache / chunk / fetchChunked + CHUNK_SIZE/CHUNK_DELAY_MS 定数 + TechnicalsCacheFile 型
- `src/portfolio/watchlist-data.test.ts` - 上記4関数の単体テスト（21ケース全GREEN）

## Decisions Made
- toPortfolioHoldingShape は matchAliases を省略（D-15: 人手キュレーション不採用、ticker完全一致+社名一致のみで開始）
- fetchChunked の atomic unit は引数注入の fetchOne とし、Plan 02 が fetchTechnicalSnapshot（単数形）を渡す想定。fetchTechnicalSnapshots（複数形、無制限並列）には一切依存しない（Pitfall 1 回避）
- CHUNK_SIZE(5)/CHUNK_DELAY_MS(300)は名前付き定数としてファイル内1箇所のみで定義し、マジックナンバー分散を禁止（Phase 28 D-09 準拠）

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] JSDocコメント内の`fetchTechnicalSnapshots`言及が acceptance criteria の grep 検証に誤検出された**
- **Found during:** Task 2 (chunk/fetchChunked 実装後の acceptance criteria 検証)
- **Issue:** plan の acceptance criteria `grep -v '^//' ... | grep -c 'fetchTechnicalSnapshots'` は単一行 `//` コメントを除外する前提だが、このコードベースの規約は JSDoc ブロックコメント（` * `始まり）であり、Pitfall 1 回避を説明する日本語コメント文中の「fetchTechnicalSnapshots 複数形は import も呼び出しも一切しない」という記述がフィルタで除外されず誤って1件検出された。実コード（import文・関数呼び出し）には複数形への依存は一切存在しない。
- **Fix:** コメント文言を「技術指標の複数一括取得関数への依存は import も呼び出しも一切しない」と言い換え、意味を保ったまま grep 検証と両立させた
- **Files modified:** src/portfolio/watchlist-data.ts
- **Verification:** `grep -v '^//' src/portfolio/watchlist-data.ts | grep -c 'fetchTechnicalSnapshots'` が 0 を返すことを確認。21件のテストは変更前後で全てGREEN維持
- **Committed in:** dd5f034 (Task 2 GREENコミットに含む)

---

**Total deviations:** 1 auto-fixed (1 blocking — verification tooling mismatch)
**Impact on plan:** コメント文言の言い換えのみ。実装ロジック・テスト内容に変更なし。Pitfall 1 の意図（fetchTechnicalSnapshots複数形への非依存）は完全に維持。

## Issues Encountered
- `npx tsc --noEmit` 実行時に `src/scripts/collect-data.test.ts` 由来の既存 TS7006 エラー（暗黙 any）が4件検出されたが、これは Phase 15 由来の既存ファイルで本プランのスコープ外（本プランは `src/portfolio/watchlist-data.ts`/`.test.ts` のみを変更）。`watchlist-data.ts` 単体には型エラーなしを個別確認済み。Scope Boundary ルールに従い修正せず、既存の未解決事項として記録のみ行う。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Plan 02（`src/scripts/collect-watchlist-data.ts` fail-soft CLI）が本プランの4純関数をそのまま消費可能。fetchTechnicalSnapshot（単数形）を fetchChunked の fetchOne 引数として注入し、loadSameDayCache → mergeWithCache → fetchChunked → toPortfolioHoldingShape → buildHoldingNewsMap の一連のパイプラインを構築する想定
- ブロッカーなし

---
*Phase: 29-daily-tracking-data-supply*
*Completed: 2026-07-15*

---
phase: 29-daily-tracking-data-supply
plan: 02
subsystem: portfolio
tags: [watchlist, technicals, news-matching, fail-soft, step-marker, cli, yahoo-finance2]

# Dependency graph
requires:
  - phase: 29-daily-tracking-data-supply (Plan 01)
    provides: toPortfolioHoldingShape / mergeWithCache / chunk / fetchChunked / TechnicalsCacheFile（純関数基盤）
  - phase: 28-watchlist-persistence
    provides: WatchlistEntry / WatchlistFile / getActiveWatchlistEntries（アクティブ銘柄導出の安定シグネチャ）
provides:
  - collect-watchlist-data.ts（fail-soft CLI: テクニカル・ニュース両ブランチ収集、単一 STEP マーカー）
  - tmp/watchlist-technicals.json（{generatedAt, snapshots} 形状の実行時生成物）
  - tmp/watchlist-news.json（HoldingNewsFile 形状の実行時生成物）
  - loadWatchlistDefensive / writeEmptyOutputs（エクスポート済みヘルパー）
affects: [29-03-daily-tracking-data-supply-invest-md-wiring, 30-buy-timing-judgment-agent]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "fail-soft CLI + stderr STEP marker（write-watchlist.ts 直近実装の踏襲）"
    - "2ブランチ独立 try/catch（片系失敗が他系を道連れにしない, Pitfall 4）"
    - "JSON往復後の Date 型復元（tmp/news.json の publishedAt を string→Date に戻してから buildHoldingNewsMap に渡す）"

key-files:
  created:
    - src/scripts/collect-watchlist-data.ts
    - src/scripts/collect-watchlist-data.test.ts
  modified:
    - src/portfolio/watchlist-data.ts
    - src/portfolio/watchlist-data.test.ts

key-decisions:
  - "publishedAt は tmp/news.json 読込直後に new Date() で復元する（buildHoldingNewsMap が内部で calculatePriorityScore 経由 .getTime() を呼ぶため、JSON往復後の string のままでは TypeError）"
  - "toPortfolioHoldingShape の nameJa フォールバックを空文字列から entry.ticker に変更（Rule 1: 空文字列だと holding-news.ts の titleIncludesAny が常に真になり全銘柄が誤マッチする構造的バグ）"
  - "テクニカルブランチを先に完了・書込してからニュースブランチを実行し、2ブランチをそれぞれ独立 try/catch で囲む（Pitfall 4、片系失敗が他系を道連れにしない）"

patterns-established:
  - "別プロセス実行で書かれた JSON ファイルを読む際は、Date 型フィールドの復元漏れが TypeError の温床になる — buildHoldingNewsMap のような『同一プロセス内呼び出し前提』の既存関数を別プロセスから再利用する際は必ず型復元を確認する"

requirements-completed: [TRAC-01, TRAC-02, TRAC-03, OPS-06]

coverage:
  - id: D1
    description: "アクティブ銘柄各社の当日株価・テクニカル指標が同日キャッシュ再利用＋欠落分のみチャンク取得で tmp/watchlist-technicals.json に供給される"
    requirement: "TRAC-01"
    verification:
      - kind: unit
        ref: "src/scripts/collect-watchlist-data.test.ts#main() - technical branch cache/chunk"
        status: pass
    human_judgment: false
  - id: D2
    description: "アクティブ銘柄の関連ニュースが tmp/news.json から buildHoldingNewsMap 無改変流用で抽出され tmp/watchlist-news.json に全銘柄キー保証で供給される"
    requirement: "TRAC-02"
    verification:
      - kind: unit
        ref: "src/scripts/collect-watchlist-data.test.ts#main() - news branch"
        status: pass
    human_judgment: false
  - id: D3
    description: "1銘柄の取得失敗（reject/null）が他銘柄処理やパイプライン全体を止めない（銘柄単位 fail-soft skip）"
    requirement: "TRAC-03"
    verification:
      - kind: unit
        ref: "src/scripts/collect-watchlist-data.test.ts#main() - technical branch cache/chunk > fail-soft"
        status: pass
    human_judgment: false
  - id: D4
    description: "スクリプト自身が [STEP:watchlist-data:OK]/[STEP:watchlist-data:FAIL:<reason>] を stderr に出力し、[PIPELINE:FAIL] は絶対に出さない"
    requirement: "OPS-06"
    verification:
      - kind: unit
        ref: "src/scripts/collect-watchlist-data.test.ts#main() - STEP markers, all branches"
        status: pass
      - kind: other
        ref: "grep -E 'console\\.(error|log)\\(' src/scripts/collect-watchlist-data.ts | grep -c 'PIPELINE:FAIL' → 0"
        status: pass
    human_judgment: false
  - id: D5
    description: "空ウォッチリスト・watchlist.json破損・news.json欠損のいずれの異常系でも両出力ファイルが常に有効JSONになる"
    verification:
      - kind: unit
        ref: "src/scripts/collect-watchlist-data.test.ts#main() - empty watchlist (D-04) / corrupted watchlist (D-19) / news branch > news.json 欠損"
        status: pass
      - kind: other
        ref: "npx tsx src/scripts/collect-watchlist-data.ts (smoke) → tmp/watchlist-technicals.json / tmp/watchlist-news.json 有効JSON生成確認"
        status: pass
    human_judgment: false

duration: 9min
completed: 2026-07-15
status: complete
---

# Phase 29 Plan 02: Fail-Soft CLI for Watchlist Technical/News Data Supply Summary

**単一の fail-soft CLI `collect-watchlist-data.ts` がウォッチリスト銘柄の株価テクニカルと関連ニュースを独立ブランチで収集し、同日キャッシュ再利用・チャンク取得・銘柄単位fail-softで2つの下流供給ファイルを生成**

## Performance

- **Duration:** 9 min
- **Started:** 2026-07-15T04:00:58Z
- **Completed:** 2026-07-15T04:08:58Z
- **Tasks:** 2 completed
- **Files modified:** 4 (2 new + 2 modified for Rule 1 bug fix)

## Accomplishments
- `loadWatchlistDefensive` が data/watchlist.json を ENOENT-vs-corrupted 二段フェイルで読み込み、write-watchlist.ts の verbatim パターンで防御的に処理
- テクニカルブランチ: `loadSameDayCache` → `mergeWithCache` → `fetchChunked(fetchTechnicalSnapshot)` の一連で同日キャッシュ再利用と欠落分のみチャンク取得を実現、取得失敗銘柄は `⚠ 取得失敗:` ログとともに snapshots から omit
- ニュースブランチ: tmp/news.json 読込後 `publishedAt` を Date に復元してから `toPortfolioHoldingShape(activeEntries)` を `buildHoldingNewsMap`（holding-news.ts 無改変流用）に渡し、全アクティブ銘柄キー保証の HoldingNewsFile を生成
- 2ブランチは独立 try/catch で分離され、news.json 欠損時もテクニカル収集は完走することをテストで確認
- 空ウォッチリスト・watchlist.json ENOENT・破損・news.json 欠損の全異常系で両出力ファイルが常に有効JSONになることを12件の単体テストで検証
- `[STEP:watchlist-data:OK]`/`[STEP:watchlist-data:FAIL:corrupted]` の自己出力と `[PIPELINE:FAIL]` の完全非出力を grep + テスト両方で確認

## Task Commits

Each task was committed atomically:

1. **Task 1+2: fail-soft CLI 骨格・防御的読込・両ブランチ実装** - `127bc1e` (feat) — plan の Task 1（骨格・STEP マーカー・writeEmptyOutputs）と Task 2（テクニカル・ニュース両ブランチ）を、正しく動作する一体のCLIとして単一コミットで実装（骨格のみのプレースホルダ段階を経ずTDDで両ブランチを最初から検証しながら構築したため）
2. **Rule 1 バグ修正: toPortfolioHoldingShape の nameJa 空文字列フォールバック** - `ed10ebd` (fix) — Plan 01 成果物への遡及修正

## Files Created/Modified
- `src/scripts/collect-watchlist-data.ts` - fail-soft CLI 本体。loadWatchlistDefensive/loadSameDayCache/writeEmptyOutputs/main()
- `src/scripts/collect-watchlist-data.test.ts` - CLI レベル fail-soft の単体テスト（12ケース全GREEN、vi.hoisted モック規約）
- `src/portfolio/watchlist-data.ts` - [修正] toPortfolioHoldingShape の nameJa フォールバックを "" → entry.ticker に変更（Rule 1）
- `src/portfolio/watchlist-data.test.ts` - [修正] 上記変更に対応するテストケース更新

## Decisions Made
- `publishedAt` は tmp/news.json 読込直後に `new Date()` で復元する — buildHoldingNewsMap は同一プロセス内呼び出し（collect-data.ts）を前提に `RawNewsArticle.publishedAt: Date` を要求するが、別プロセス実行の本CLIが読む tmp/news.json は JSON 往復済みで string になっているため、明示的な型復元なしでは `calculatePriorityScore` 内の `.getTime()` が TypeError になる
- テクニカルブランチを先に完了・書込してからニュースブランチを実行し、それぞれ独立 try/catch で囲む（Pitfall 4 準拠。news.json 欠損時もテクニカル出力に影響しないことをテストで確認）
- Task 1（骨格）と Task 2（両ブランチ実装）を計画通りの2段階プレースホルダ構成ではなく、動作する一体の実装として最初から構築した — TDDでテストを先に書き両ブランチの挙動を含めて検証しながら実装したほうが、プレースホルダ経由の中間コミットより一貫性が高いと判断

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] toPortfolioHoldingShape の nameJa 空文字列フォールバックが全銘柄誤マッチを誘発するバグ**
- **Found during:** Task 2（ニュースブランチ実装後のテスト実行中に発覚）
- **Issue:** Plan 01 で実装済みの `toPortfolioHoldingShape` は `nameJa: entry.nameJa ?? ""` としていたが、`holding-news.ts` の `titleIncludesAny` は `lowerTitle.includes(candidate.toLowerCase())` でマッチ判定するため、`candidate` が空文字列だと `"任意の文字列".includes("")` は常に `true` になる。結果として日本語社名を持たない全ウォッチリスト銘柄が、任意の記事タイトルに対して `matchType: "name"` で誤マッチする構造的バグだった。テストで「AAA記事はAAAにのみマッチし、無関係なBBBにはマッチしない」ことを検証しようとした際に発覚（BBBにも誤マッチした）。
- **Fix:** `nameJa: entry.nameJa ?? entry.ticker` に変更（`name` フィールドと同じ ticker フォールバック方式）。`PortfolioHolding.nameJa` は string 型必須のため `undefined` を渡せない制約下で、空文字列の universal-match バグを構造的に回避する最小修正
- **Files modified:** src/portfolio/watchlist-data.ts, src/portfolio/watchlist-data.test.ts
- **Verification:** `src/scripts/collect-watchlist-data.test.ts#news.json 読込成功の場合、全アクティブ銘柄のキーが newsMap に存在する` が期待通り「AAAのみマッチしBBBは空配列」を検証してGREEN。`src/portfolio/watchlist-data.test.ts` の対応テストも更新後GREEN。全517テスト回帰なし
- **Committed in:** ed10ebd

---

**Total deviations:** 1 auto-fixed (1 bug — Plan 01 成果物への遡及修正)
**Impact on plan:** ニュースマッチング精度に直結する重大なバグ修正。本フェーズのTRAC-02（関連ニュース抽出の正確性）の実質的な正しさに必須のため、Rule 1 の範囲内で即時修正。スコープ外の拡張なし。

## Issues Encountered
- `npx tsc --noEmit` に Phase 15 由来の `src/scripts/collect-data.test.ts` の既存 TS7006 エラー（暗黙 any、4件）が残存するが、Plan 01 SUMMARY で記録済みの本フェーズスコープ外の既知事項。`collect-watchlist-data.ts`/`.test.ts` および `watchlist-data.ts` 単体には型エラーなしを個別確認済み

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Plan 03（invest.md への Step 2i 配線）が本プランの CLI をそのまま `npx tsx src/scripts/collect-watchlist-data.ts` として呼び出せる状態
- 出力契約（tmp/watchlist-technicals.json の `{generatedAt, snapshots}`、tmp/watchlist-news.json の `HoldingNewsFile`）は Phase 30 の買いタイミング判定エージェントがそのまま消費可能
- ブロッカーなし

---
*Phase: 29-daily-tracking-data-supply*
*Completed: 2026-07-15*

## Self-Check: PASSED

- FOUND: src/scripts/collect-watchlist-data.ts
- FOUND: src/scripts/collect-watchlist-data.test.ts
- FOUND: src/portfolio/watchlist-data.ts (modified)
- FOUND: src/portfolio/watchlist-data.test.ts (modified)
- FOUND: 127bc1e (feat commit)
- FOUND: ed10ebd (fix commit)

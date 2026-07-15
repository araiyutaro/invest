---
phase: 28-watchlist-persistence
plan: 02
subsystem: scripts
tags: [typescript, vitest, fail-soft, cli-wrapper, yahoo-finance2]

# Dependency graph
requires:
  - phase: 28-watchlist-persistence
    plan: 01
    provides: "admitBullishStocks/pruneWatchlist/getActiveWatchlistEntries と WatchlistFile/WatchlistCandidate/WatchlistEntry 型（純関数, watchlist.ts）"
provides:
  - "src/scripts/write-watchlist.ts: fail-soft CLI ラッパー（I/O・batch quote()・prune→admit合成・STEPマーカー集約）"
  - "loadExistingWatchlist: ENOENT/破損の二段フェイルローダー"
  - "fetchQuoteTypesAndNames: batch quote()1回でquoteType+社名を取得する関数"
affects: [29-daily-tracking-data-supply, 30-buy-timing-judgment-agent, 31-daily-report-watchlist-section]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "write-urgency-history.tsのmain()骨格（mkdir先行→corrupted分岐→meeting-result読込→dateKey検証→純関数合成→writeFile→OKログ→エントリポイントガード）をverbatimベースに流用"
    - "filter-etf-stocks.tsのbatch quote()ループ（Array.isArray防御的パース）を流用し、同一ループ内でquoteTypeと社名を同時取得（1コール2役, D-04/D-22）"
    - "fail-soft分岐はprocess.exitを使わずreturnで抜ける（invest.mdが終了コードに関わらず継続するため、STEPマーカー文字列で状態を伝える設計）"

key-files:
  created:
    - src/scripts/write-watchlist.ts
    - src/scripts/write-watchlist.test.ts
  modified: []

key-decisions:
  - "既存active銘柄はbatch quote()の再検証対象から除外（D-22準拠。当日新規強気銘柄のみquote()対象にすることでAPI呼び出しを最小化）"
  - "fail-soft分岐は全てprocess.exitを使わずreturnで抜ける設計を採用（write-urgency-history.tsのcorrupted分岐がprocess.exit(1)を使うのと異なり、D-16のパイプライン継続方針に合わせてSTEPマーカー文字列を状態伝達の正準手段とした）"
  - "main()内でTask1のI/O関数とTask2のprune→admit合成を単一ファイルに実装（watchlist.ts同様、密結合な処理を分割せず一体実装）"

patterns-established:
  - "fail-soft CLIラッパーのSTEPマーカー規約: 成功時[STEP:watchlist:OK]、失敗時[STEP:watchlist:FAIL:<reason>]（corrupted/meeting-read/invalid-date/quoteの4種類）をconsole.errorへ、サイズ計測ログ(active=/removed=)をconsole.logへ出力するチャネル分離"

requirements-completed: [WLST-01, WLST-02, WLST-03, WLST-04, WLST-05]

coverage:
  - id: D1
    description: "loadExistingWatchlistがENOENT/破損を二段フェイルで分離する(D-18)"
    requirement: "WLST-01"
    verification:
      - kind: unit
        ref: "src/scripts/write-watchlist.test.ts#loadExistingWatchlist > ENOENT の場合、corrupted:false で空のwatchlistを返す"
        status: pass
      - kind: unit
        ref: "src/scripts/write-watchlist.test.ts#loadExistingWatchlist > 破損したJSONの場合、corrupted:true で空のwatchlistを返す"
        status: pass
    human_judgment: false
  - id: D2
    description: "fetchQuoteTypesAndNamesがbatch quote()1回でquoteTypeと社名を同時取得する(D-04/D-22)"
    requirement: "WLST-01"
    verification:
      - kind: unit
        ref: "src/scripts/write-watchlist.test.ts#fetchQuoteTypesAndNames > batch quote() の結果から quoteType と longName を1回で取得する"
        status: pass
    human_judgment: false
  - id: D3
    description: "main()がprune→admit順で合成し、purchased(保有済み)が当日強気より優先して除外される(Pitfall 3)"
    requirement: "WLST-02, WLST-03"
    verification:
      - kind: unit
        ref: "src/scripts/write-watchlist.test.ts#main() > prune が admit より先に適用され、purchased(保有済み)が当日強気より優先して除外される"
        status: pass
    human_judgment: false
  - id: D4
    description: "破損時にwriteFileへ到達せず既存ファイルを保全し[STEP:watchlist:FAIL:corrupted]を出力する(D-18)"
    requirement: "WLST-05"
    verification:
      - kind: unit
        ref: "src/scripts/write-watchlist.test.ts#main() > 既存 data/watchlist.json が破損している場合、writeFile を呼ばず [STEP:watchlist:FAIL:corrupted] を出力する"
        status: pass
    human_judgment: false
  - id: D5
    description: "成功時に[STEP:watchlist:OK]とactive/removed件数ログを出力し、全FAIL分岐で[PIPELINE:FAIL]を出さない(D-16/D-10)"
    requirement: "WLST-01, WLST-04"
    verification:
      - kind: unit
        ref: "src/scripts/write-watchlist.test.ts#main() > 正常系: 強気銘柄をwatchlistに登録し [STEP:watchlist:OK] と active/removed 件数ログを出力する"
        status: pass
      - kind: unit
        ref: "src/scripts/write-watchlist.test.ts#main() > すべての FAIL 分岐で [PIPELINE:FAIL] マーカーが一度も出力されない"
        status: pass
      - kind: manual
        ref: "npx tsx src/scripts/write-watchlist.ts によるスモークテスト（実 yahoo-finance2 quote() 呼び出し、fixture tmp/meeting-result.json）で data/watchlist.json が正しく生成され [STEP:watchlist:OK] を確認"
        status: pass
    human_judgment: false

duration: 3min
completed: 2026-07-15
status: complete
---

# Phase 28 Plan 02: Watchlist CLI Wrapper Summary

**fail-soft CLI ラッパー write-watchlist.ts — batch quote()1回でquoteType+社名を取得しPlan 01の純関数(prune→admit)を合成、二段フェイル(ENOENT/破損)とSTEPマーカーでdata/watchlist.jsonを日次更新、11件のvitestテスト+実quote()スモークテストで検証**

## Performance

- **Duration:** 3 min
- **Started:** 2026-07-15T02:35:21Z
- **Completed:** 2026-07-15T02:38:31Z
- **Tasks:** 2
- **Files modified:** 2 (both new)

## Accomplishments
- `loadExistingWatchlist` を実装: ENOENT（欠損=空初期化）と破損（JSON パース失敗等=上書き拒否）を二段フェイルで厳密分離（D-18、write-urgency-history.ts の実証済みテンプレートを流用）
- `fetchQuoteTypesAndNames` を実装: filter-etf-stocks.ts の batch quote() ループを流用し、1回の呼び出しで quoteType（ETF第2ゲート用）と社名（longName/shortName）を同時取得（1コール2役、D-04/D-22、追加API呼び出しゼロ）
- `main()` を実装: mkdir(DATA_DIR)先行 → corrupted分岐 → meeting-result読み込み → isValidDateKeyでdateKey検証 → 既存active銘柄を除いた候補のみbatch quote() → **prune（purchased/downgraded/expired）を先に実行してからadmit（当日強気）を実行**（Pitfall 3対策：purchased/downgradedが「今日も強気」に優先）→ data/watchlist.json 書き込み → active/removed件数ログ + `[STEP:watchlist:OK]`
- 全FAIL分岐（corrupted/meeting-read/invalid-date/quote）でwriteFileに到達させず既存ファイルを保全し `[STEP:watchlist:FAIL:<reason>]` のみを出力、`[PIPELINE:FAIL]`（パイプライン全体停止マーカー）は一切出さない設計を実装・テストで検証（D-16）
- 11件のvitestテスト（loadExistingWatchlist: 3件、fetchQuoteTypesAndNames: 2件、main(): 6件）が全green、プロジェクト全体470テストも回帰なし
- 実 yahoo-finance2 quote() を用いたスモークテスト（fixture tmp/meeting-result.json でTSLA銘柄を投入）で data/watchlist.json が正しい形状（社名解決込み）で生成され `[STEP:watchlist:OK]` を確認。テスト後にfixtureとdata/watchlist.jsonは削除済み（本番データ汚染防止）

## Task Commits

Each task was committed atomically (TDD: test → feat):

1. **Task 1+2: I/Oローダー・batch quote()・main()合成** - `a55d74a` (test, RED) → `37f379b` (feat, GREEN)

_Note: Task 1（ローダー・quote取得）とTask 2（main()合成）は単一ファイル実装の密結合な処理のため、write-watchlist.ts全体を一括実装し単一のtest→feat commitペアで対応した。各タスクの受け入れ基準（grep検証・vitest実行・手動スモーク）はすべて個別に確認済み。_

## Files Created/Modified
- `src/scripts/write-watchlist.ts` - fail-soft CLI ラッパー本体（loadExistingWatchlist、fetchQuoteTypesAndNames、main、path定数、STEPマーカー）
- `src/scripts/write-watchlist.test.ts` - I/Oブランチ・quote()モック・main()の全分岐（破損/dateKey不正/quote例外/正常系/prune優先順位/PIPELINE:FAIL非出力）を検証する単体テスト（11件）

## Decisions Made
- 既存active銘柄はbatch quote()の再検証対象から除外し、当日新規強気銘柄のみをquote()対象にすることでAPI呼び出しを最小化（D-22準拠）
- fail-soft分岐は全てprocess.exitを使わずreturnで抜ける設計を採用: write-urgency-history.tsのcorrupted分岐がprocess.exit(1)を使うのと異なり、D-16のパイプライン継続方針（invest.mdが終了コードに関わらず継続）に合わせ、STEPマーカー文字列を状態伝達の正準手段とした（テスト容易性も向上）
- main()内でTask1のI/O関数とTask2のprune→admit合成を単一ファイルに実装（Plan 01のwatchlist.tsと同様、密結合な処理を分割せず一体実装した方が可読性が高いと判断）

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] nameByTicker の型を WatchlistCandidate から正しいインラインシェイプに修正**
- **Found during:** Task 2実装後の`tsc --noEmit`検証
- **Issue:** `main()`内でローカル変数`nameByTicker`の型注釈を誤って`WatchlistCandidate`（ticker必須フィールド持ち）としていたが、`admitBullishStocks`が実際に要求するのは`ReadonlyMap<string, {name?, nameJa?}>`（tickerフィールドなし）だったため型エラーが発生した
- **Fix:** import文から不要な`WatchlistCandidate`型を削除し、`nameByTicker`の型注釈を`ReadonlyMap<string, { name?: string; nameJa?: string }>`に修正
- **Files modified:** src/scripts/write-watchlist.ts
- **Commit:** 37f379b（実装コミットに含めて修正済み、型エラー解消後にコミット）

## Issues Encountered
None

## User Setup Required
None - 外部サービス設定は不要。yahoo-finance2は既存パッケージ（Phase 27で使用実績あり）で新規導入なし。

## Next Phase Readiness
- `data/watchlist.json` はスクリプト実行時（invest.mdパイプラインへの配線はPlan 03または本フェーズ完了後に実施）に自動生成される。実データでのライブ実行確認はスモークテストで検証済み（fixtureは削除済みのため本番データへの汚染なし）
- Phase 29（日次追跡データ供給）は本Plan完成の`data/watchlist.json`（`getActiveWatchlistEntries`経由）を読み取り専用で消費するだけでよい状態
- ブロッカーなし

---
*Phase: 28-watchlist-persistence*
*Completed: 2026-07-15*

## Self-Check: PASSED

- FOUND: src/scripts/write-watchlist.ts
- FOUND: src/scripts/write-watchlist.test.ts
- FOUND: .planning/phases/28-watchlist-persistence/28-02-SUMMARY.md
- FOUND: a55d74a
- FOUND: 37f379b

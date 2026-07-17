---
phase: 30-buy-timing-judgment-agent
plan: 02
subsystem: portfolio-judgment
tags: [zod, typescript, fail-soft-cli, vitest, tdd]

# Dependency graph
requires:
  - phase: 30-buy-timing-judgment-agent (Plan 01)
    provides: WatchlistJudgment/WatchlistJudgmentFile型、watchlistJudgmentSchema、applyConfluenceGate/attachActionChanges/deriveMarket/buildSkippedJudgment純関数群
provides:
  - fail-soft CLI src/scripts/write-watchlist-judgment.ts（tmp/watchlist-judgment-raw/{ticker}.json群を独立検証しtmp/watchlist-judgment.jsonを生成）
  - loadPrevJudgmentDefensive（ENOENT-vs-破損二段判定の前日判定ローダー）
  - writeEmptyOutput（空の有効JSON書き出しヘルパ）
affects: [30-buy-timing-judgment-agent Plan 03 (オーケストレーション: invest.md Step 3-J からの実行), 31-daily-report-watchlist-section]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "raw検証ループの1銘柄1try/catch独立分離（T-30-04 DoS対策、validate-portfolio-research.tsの雛形を継承）"
    - "検証後処理の順序契約: schema.parse → (technicalsスナップショット有無でskip分岐) → applyConfluenceGate → market/asOf決定論付与 → attachActionChanges"
    - "raw検証失敗銘柄は判定欠落として出力から除外（skipレコードとは区別）、technicalsスナップショット欠落の検証済み銘柄のみbuildSkippedJudgmentで陽性skip記録"

key-files:
  created:
    - src/scripts/write-watchlist-judgment.ts
    - src/scripts/write-watchlist-judgment.test.ts

key-decisions:
  - "raw検証失敗（zod parse失敗・JSON破損）銘柄はbuildSkippedJudgmentを使わず判定自体を出力から除外する。skipはtechnicalsスナップショットが無い（=判定不能）検証済み銘柄専用とし、「読めなかった」と「データが無いので判定不能」を明確に区別する"
  - "downgradedCount（confluence降格件数の監査ログ）はapplyConfluenceGateの戻り値downgradedフラグをループ内で直接集計する方式を採用し、配列インデックス対応による脆い実装を避けた"
  - "meeting-result.json読込失敗時のフォールバックdateはUTC当日日付（new Date().toISOString().slice(0,10)）とし、date取得不能でもwriteEmptyOutputが常に有効な文字列を受け取れるようにする"

patterns-established:
  - "Pattern: raw検証成功後の後処理はtechnicalsスナップショットの有無を最初の分岐点とし、有→confluenceゲート+market/asOf付与、無→buildSkippedJudgmentで即時skip化（Pitfall 5の陽性記録規律を維持しつつ、検証失敗銘柄との判定欠落/skip区別を明確化）"

requirements-completed: [TIME-01, TIME-02, TIME-03, TIME-05]

coverage:
  - id: D1
    description: "write-watchlist-judgment.ts が tmp/watchlist-judgment-raw/{ticker}.json 群を1銘柄ずつ独立にzod検証し、1銘柄の不正JSONが他銘柄の検証を止めない（T-30-04 DoS対策）"
    requirement: "TIME-01"
    verification:
      - kind: integration
        ref: "src/scripts/write-watchlist-judgment.test.ts#部分失敗: 3銘柄中1銘柄のrawが不正JSONでも残り2銘柄は判定されthrowしない（D-18）"
        status: pass
    human_judgment: false
  - id: D2
    description: "検証済み判定にapplyConfluenceGate・market/asOf決定論再付与・skip記録を適用しtmp/watchlist-judgment.jsonを常に有効JSONで書く"
    requirement: "TIME-02"
    verification:
      - kind: integration
        ref: "src/scripts/write-watchlist-judgment.test.ts#confluence降格の統合 / #market/asOf決定論付与 / #skip記録"
        status: pass
    human_judgment: false
  - id: D3
    description: "前日ファイル読込がENOENT（.code/.message両チェック）と破損を区別し、欠損はno-prior-dataとして扱う（Pitfall 1回帰防止）"
    requirement: "TIME-03"
    verification:
      - kind: unit
        ref: "src/scripts/write-watchlist-judgment.test.ts#loadPrevJudgmentDefensive（ENOENT/破損/形状不正/正常系の4ケース）"
        status: pass
    human_judgment: false
  - id: D4
    description: "アクティブ0件・全滅・破損のいずれでもthrowせず有効JSONを書きstderrに適切な[STEP:watchlist-judgment:*]マーカーを出す。[PIPELINE:FAIL]は絶対に出さない"
    requirement: "TIME-02"
    verification:
      - kind: integration
        ref: "src/scripts/write-watchlist-judgment.test.ts#アクティブ0件 / #meeting-result読込失敗 / #すべての分岐で[PIPELINE:FAIL]マーカーが一度も出力されない"
        status: pass
    human_judgment: false
  - id: D5
    description: "asOf/marketはTSが入力データ（TechnicalSnapshot.asOf・ティッカーサフィックス）から決定論再付与しLLMエコーを採らない"
    requirement: "TIME-05"
    verification:
      - kind: integration
        ref: "src/scripts/write-watchlist-judgment.test.ts#market/asOf決定論付与: rawがmarket誤申告してもderiveMarket由来・technicals由来のasOfが採用される（D-08/D-15）"
        status: pass
    human_judgment: false
  - id: D6
    description: "同日再実行時にloadPrevJudgmentDefensiveが前日judgmentsを正しく読み込みattachActionChangesがpreviousAction/actionChangedを付与する"
    requirement: "TIME-03"
    verification:
      - kind: integration
        ref: "src/scripts/write-watchlist-judgment.test.ts#同日再実行ガード: loadPrevJudgmentDefensiveが前日judgmentsを正しく読み込みattachActionChangesに反映される（TIME-03c）"
        status: pass
    human_judgment: false

duration: 6min
completed: 2026-07-15
status: complete
---

# Phase 30 Plan 02: Fail-soft CLI write-watchlist-judgment.ts の実装 Summary

**Plan 01の決定論コア（watchlistJudgmentSchema/applyConfluenceGate/attachActionChanges/deriveMarket/buildSkippedJudgment）を組み込むfail-soft CLIをTDDで実装し、銘柄別raw JSON検証→confluenceゲート→market/asOf決定論再付与→前日比較の全パイプラインをthrowなしで完遂**

## Performance

- **Duration:** 6 min
- **Started:** 2026-07-15T11:51:40Z
- **Completed:** 2026-07-15T11:57:10Z
- **Tasks:** 2
- **Files modified:** 2 (both new)

## Accomplishments
- `src/scripts/write-watchlist-judgment.ts` を新規実装。`tmp/watchlist-judgment-raw/{ticker}.json` 群を `readdir` で取得し、1銘柄ずつ独立 try/catch で `readFile` → `JSON.parse` → `watchlistJudgmentSchema.parse` を実行（T-30-04 DoS 対策、`validate-portfolio-research.ts` の検証ループ雛形を踏襲）
- 検証成功判定に対し、technicals スナップショットの有無を最初の分岐点として、有れば `applyConfluenceGate`（signals<2 の buy を wait 降格）→ `deriveMarket` + `TechnicalSnapshot.asOf` の決定論付与、無ければ `buildSkippedJudgment` で status:skipped の陽性レコードを合成（Pitfall 3/4/5 の順序契約と防御ルールを厳守）
- `loadPrevJudgmentDefensive()` を実装。`write-watchlist.ts` の `loadExistingWatchlist` を verbatim ベースに `.code === "ENOENT"` と `.message.includes("ENOENT")` の両チェックで欠損と破損を分類（Pitfall 1 回帰防止）
- `main()` は冒頭無条件 `mkdir(TMP_DIR)`、meeting-result 読込失敗・raw ディレクトリ0件・全銘柄失敗・部分失敗の全分岐で throw せず `tmp/watchlist-judgment.json` に常に有効 JSON を書き、`[STEP:watchlist-judgment:OK]` / `[STEP:watchlist-judgment:FAIL:*]` を `console.error`（stderr）へ出力。`[PIPELINE:FAIL]` は一度も出さない
- テスト14ケース（`write-watchlist-judgment.test.ts`）を新規追加、全green。既存548テスト＋Plan 01の20テストに追加し、全スイート回帰562テストgreen

## Task Commits

TDD RED→GREEN cycle (両タスクの実装が単一のCLIファイル+テストファイルに集約されるプラン構造のため、Task 1/Task 2 のRED/GREENは以下の2コミットに対応):

1. **Task 1+2: fail-soft CLI統合テスト（RED）** - `a9cb38e` (test)
2. **Task 1+2: fail-soft CLI本体実装（GREEN）** - `c8b7e33` (feat)

**Plan metadata:** (この後のコミットで記録)

_Note: プラン構造上 Task 1（CLI本体）と Task 2（統合テスト）が同一ファイルペアを対象とするため、TDD実行はテストファイル全体を先に書いてRED確認 → CLI本体実装でGREEN化、の1サイクルで両タスクの受け入れ基準を同時に満たした。_

## Files Created/Modified
- `src/scripts/write-watchlist-judgment.ts` - 新規。fail-soft CLI本体（`loadPrevJudgmentDefensive`/`writeEmptyOutput`/`main`）
- `src/scripts/write-watchlist-judgment.test.ts` - 新規。14テストケース（ENOENT二段判定4ケース、main()統合テスト8ケース、部分失敗・confluence降格・skip記録・market/asOf決定論・同日再実行ガード・PIPELINE:FAIL非出力を網羅）

## Decisions Made
- raw検証失敗（zod parse失敗・JSON破損）銘柄は `buildSkippedJudgment` を使わず判定自体を出力から除外する方針を採用。skip は technicals スナップショットが無い（＝判定不能）検証済み銘柄専用とし、「読めなかった」と「データが無いので判定不能」を構造的に区別する（プラン記述の「raw検証失敗銘柄は判定欠落として扱う」を実装レベルで解釈し確定）
- confluence降格件数の監査ログ集計は `applyConfluenceGate` の戻り値 `downgraded` フラグをループ内で直接カウントする方式を採用し、当初実装していた配列インデックス対応方式（脆く誤対応の危険）を置き換えた
- meeting-result.json 読込失敗時のフォールバック date は UTC 当日日付（`new Date().toISOString().slice(0,10)`）とし、date 取得不能でも `writeEmptyOutput` が常に有効な文字列を受け取れるようにした

## Deviations from Plan

None - plan executed exactly as written. TDD RED→GREENサイクルを完遂し、全acceptance_criteria（grep/source assertion含む）を検証済み。実装過程で1件の内部設計判断（raw検証失敗とtechnicals欠落skipの区別ロジック）を行ったが、これはプラン本文の記述「raw検証失敗銘柄は判定欠落として扱う」「technicalsにスナップショット自体が無い銘柄はbuildSkippedJudgmentで...合成する」を素直に実装した結果であり、計画からの逸脱ではない。

## Issues Encountered
- GREEN実装の初回パスでは、skipレコード合成ロジックを「technicalsを主ループとしraw欠落/検証失敗銘柄すべてをskip化」する形で書いたため、テスト「部分失敗: 3銘柄中1銘柄のrawが不正JSONでも残り2銘柄は判定される」で失敗した検証済み銘柄がskipレコードとして出力に混入してしまった。プラン本文を再読し「raw検証失敗銘柄は判定欠落（出力から除外）」「technicalsスナップショット自体が無い場合のみskip」という区別を確認し、検証成功銘柄（validatedByTicker）を主ループとしtechnicals有無で分岐する実装に修正して解消した。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Plan 03（オーケストレーション: invest.md Step 3-J）が `write-watchlist-judgment.ts` の `main()` を安全に呼び出せる状態が整った
- `tmp/watchlist-judgment-raw/{ticker}.json`（Plan 03が生成する raw Agent 出力の入力契約）・`tmp/watchlist-technicals.json`（Phase 29供給）・`tmp/prev-watchlist-judgment.json`（Plan 03が退避生成）の3入力ファイル契約が本Planで確定済み
- ブロッカーなし

---
*Phase: 30-buy-timing-judgment-agent*
*Completed: 2026-07-15*

## Self-Check: PASSED

All created files verified present on disk (write-watchlist-judgment.ts, write-watchlist-judgment.test.ts, 30-02-SUMMARY.md). Both task commits (a9cb38e, c8b7e33) verified present in git log.

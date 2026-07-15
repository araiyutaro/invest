---
phase: 27-etf-exclusion
plan: 03
subsystem: pipeline-orchestration
tags: [invest-md, prompt-engineering, pipeline-wiring, fail-soft, etf-exclusion]

# Dependency graph
requires:
  - phase: 27-etf-exclusion (Plan 01)
    provides: "filterEtfStocks pure function, QuoteTypeLookup/EtfExclusionResult types"
  - phase: 27-etf-exclusion (Plan 02)
    provides: "filter-etf-stocks.ts fail-soft CLI wrapper (npx tsx src/scripts/filter-etf-stocks.ts)"
provides:
  - "5アナリストプロンプト（Step 2a）+ モデレータープロンプト（Step 2f）へのETF除外指示（Layer 1, best-effort）"
  - "Step 2g への filter-etf-stocks.ts fail-soft wiring（Layer 2統合, 構造的保証）"
affects: [28-watchlist-persistence]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Step 3f (write-urgency-history) の fail-soft STEP マーカーブロック構造を Step 2g に mirror（intro→bash→fail-soft継続指示→条件付きSTEPマーカー→PIPELINE:FAIL禁止警告）"

key-files:
  created: []
  modified:
    - .claude/commands/invest.md

key-decisions:
  - "既存の「注意: picksのtickerは必ず英数字ティッカー形式」行は5ブロックとも変更せず、その直後に新しい1行を追記する形にした（置換ではなく追記で既存契約を保持）"
  - "Agent 3 (macro) ブロックのみ後続文言が他4ブロックと異なる（「macroはセクターレベルでの推奨が主体...」）ため、Editのold_stringをブロックごとに一意な後続コンテキストで区別して適用した"
  - "filter-etf-stocks.ts の実行は pipeline-metrics の validationStart 記録直後・validate-meeting.ts 実行直前に配置し、D-07（除外後データを以降の全ステップが参照する）を構造的に満たした"

requirements-completed: [ETF-01, ETF-02]

coverage:
  - id: D1
    description: "Step 2a の全5アナリストプロンプトブロックに ETF・投資信託・インデックスファンドを picks に含めない旨の指示が追記されている"
    requirement: "ETF-01"
    verification:
      - kind: unit
        ref: "grep -c \"ETF・投資信託・インデックスファンド（例: SPY, QQQ, 1306.T等）は picks に含めないこと\" .claude/commands/invest.md == 5"
        status: pass
    human_judgment: false
  - id: D2
    description: "Step 2f モデレーター『重要な注意事項』箇条書きに highlightedStocks からのETF除外指示が追記されている"
    requirement: "ETF-01"
    verification:
      - kind: unit
        ref: "grep -q \"ETF・投資信託・インデックスファンドは highlightedStocks に含めないこと\" .claude/commands/invest.md"
        status: pass
    human_judgment: false
  - id: D3
    description: "Step 2g で filter-etf-stocks.ts が validate-meeting.ts の直前に実行されるようwiringされている"
    requirement: "ETF-02"
    verification:
      - kind: unit
        ref: "awk による行番号順序チェック（filter-etf-stocks.ts の行番号 < validate-meeting.ts の行番号）"
        status: pass
    human_judgment: false
  - id: D4
    description: "filter-etf-stocks.ts の失敗は fail-soft で扱われ、[STEP:etf-exclusion:OK/FAIL] を出力し [PIPELINE:FAIL] は出力しない"
    requirement: "ETF-02"
    verification:
      - kind: unit
        ref: "grep -q \"STEP:etf-exclusion:OK\" && grep -q \"STEP:etf-exclusion:FAIL\" .claude/commands/invest.md、および新規挿入ブロック内に PIPELINE:FAIL 禁止警告文が存在することを目視確認"
        status: pass
    human_judgment: false
  - id: D5
    description: "既存の picks 出力契約（「注意: picksのtickerは必ず英数字ティッカー形式」行）が5ブロックとも保持され、validate-meeting.ts ブロックも変更されていない"
    requirement: "ETF-01, ETF-02"
    verification:
      - kind: unit
        ref: "grep -c \"注意: picksのtickerは必ず英数字ティッカー形式\" .claude/commands/invest.md == 5、grep -c \"npx tsx src/scripts/validate-meeting.ts\" .claude/commands/invest.md == 1"
        status: pass
    human_judgment: false

duration: 4min
completed: 2026-07-15
status: complete
---

# Phase 27 Plan 03: invest.md ETF Exclusion Wiring Summary

**5アナリスト+モデレーターのプロンプト（Layer 1）と Step 2g パイプライン統合（Layer 2, filter-etf-stocks.ts の fail-soft wiring）を invest.md に配線し、ETF除外の二層防御を完成させた**

## Performance

- **Duration:** 4 min
- **Started:** 2026-07-15T01:30:00Z (approx, continuation from Plan 02)
- **Completed:** 2026-07-15T01:34:20Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Step 2a の全5アナリストプロンプトブロック（ファンダメンタルズ、テンバガー、マクロ、テクニカル、リスクマネージャー）に、ETF・投資信託・インデックスファンドを picks から除外する明示指示を追記（D-10, ETF-01）
- Step 2f モデレーター最終統合プロンプトの「## 重要な注意事項」箇条書きに、highlightedStocks からのETF除外指示を追記。TS側の quoteType 検証との二層防御であることも明記（D-11）
- Step 2g のバリデーション内、`validate-meeting.ts` 実行の直前に `filter-etf-stocks.ts`（Plan 02 で実装済み）の呼び出しを挿入し、Step 3f と同一構造の fail-soft STEP マーカーブロック（`[STEP:etf-exclusion:OK]` / `[STEP:etf-exclusion:FAIL:<理由>]`）と `[PIPELINE:FAIL]` 出力禁止警告を配線（D-07, D-08, ETF-02）
- Layer 1（プロンプト, best-effort）と Layer 2（TS決定論フィルタ, 構造的保証）の二層防御がパイプライン上で完全に接続された

## Task Commits

Each task was committed atomically:

1. **Task 1: 5アナリストブロック + モデレーターブロックに ETF除外プロンプト指示を追記（Layer 1, D-10/D-11）** - `d2a1032` (feat)
2. **Task 2: Step 2g に filter-etf-stocks.ts 実行と fail-soft STEP マーカーを wiring（Layer 2統合, D-07/D-08）** - `969cb3d` (feat)

## Files Created/Modified
- `.claude/commands/invest.md` - Step 2a 5ブロックへのETF除外picks指示追記、Step 2f モデレーターへのhighlightedStocks除外指示追記、Step 2g への filter-etf-stocks.ts fail-soft wiring 挿入

## Decisions Made
- 既存の「注意: picksのtickerは必ず英数字ティッカー形式」行は5ブロックとも一切変更せず、その直後に新規1行を追記する構造にした（置換ではなく追記であることをgrepで検証可能にした）
- Agent 3（macro）ブロックのみ後続文言が他4ブロックと異なるため、各EditのマッチコンテキストをブロックごとにAgent見出し名やセクター固有の後続文で一意化した
- filter-etf-stocks.ts の実行位置は pipeline-metrics の `validationStart` 記録直後・`validate-meeting.ts` 実行直前とし、D-07（除外後のhighlightedStocksを以降の全バリデーション・サマリー表示・下流レポート生成が参照する）を構造的に満たした

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. 両タスクとも1回の編集セットで検証がすべてPASSした。Agent 3（macro）ブロックのみ後続文言が異なるため個別のold_stringパターンが必要だったが、これは計画のread_first指示（PATTERNS.md Analog A）で事前に想定されていた通り。

## User Setup Required

None - no external service configuration required. `filter-etf-stocks.ts`（Plan 02）は既にビルド・テスト済みで、このプランは invest.md 側のプロンプト・wiring編集のみ。

## Next Phase Readiness
- Phase 27（ETF Exclusion）の全3プランが完了。二層防御（Layer 1: プロンプト指示、Layer 2: TS決定論フィルタ）が実パイプラインに完全配線された
- 手動ライブ検証（27-VALIDATION.md Manual-Only 項目）が残タスク: 翌営業日 launchd 実行後、`tmp/round-1/*.json` の picks と `tmp/meeting-result.json` の highlightedStocks に ETF が含まれないこと、ログに `[STEP:etf-exclusion:OK]` が出力されることを確認
- Phase 28（Watchlist Persistence）は、本フェーズで ETF 除外済みとなった `highlightedStocks` を入力として利用可能

---
*Phase: 27-etf-exclusion*
*Completed: 2026-07-15*

## Self-Check: PASSED

- FOUND: .claude/commands/invest.md
- FOUND commit: d2a1032
- FOUND commit: 969cb3d

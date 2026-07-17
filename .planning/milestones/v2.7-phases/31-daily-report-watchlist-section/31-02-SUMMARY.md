---
phase: 31-daily-report-watchlist-section
plan: 02
subsystem: ui
tags: [typescript, html-templating, report-generation, tdd]

# Dependency graph
requires:
  - phase: 31-daily-report-watchlist-section (plan 01)
    provides: loadWatchlistJudgment/loadWatchlist fail-soft loaders (report-data-loaders.ts) that supply WatchlistJudgmentFile | null and WatchlistFile
  - phase: 30-buy-timing-judgment-agent
    provides: WatchlistJudgment / WatchlistJudgmentFile types (actionChanged/previousAction/status/asOf/market fields)
provides:
  - formatWatchlistSectionHtml 3-state dispatcher (null -> hidden, empty judgments -> message, judgments -> cards) in generate-daily-report.ts
  - formatWatchlistJudgmentCardHtml per-ticker card renderer (company name fallback, as-of/market note, signals pills, addedDate, skipped-status handling)
  - formatTodayActionBadgeHtml (buy pill vs wait plain text) and formatActionChangedBadgeHtml (actionChanged !== true early-return, direction-based color)
  - generateDailyReportHtml extended with optional trailing watchlistJudgment/watchlist params, backward compatible with existing 3-arg/4-arg call sites
affects: [31-daily-report-watchlist-section (plan 03 - pipeline wiring), invest.md orchestration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "3-state section dispatcher pattern (null/empty/populated) mirrored from formatWeeklyUrgencyRollupHtml"
    - "Change-badge undefined/false discrimination via `!== true` early-return (never truthy check)"
    - "Ticker-key normalization join via normalizeHoldingSymbol before indexing into WatchlistFile"

key-files:
  created: []
  modified:
    - src/scripts/generate-daily-report.ts
    - src/scripts/generate-report.test.ts

key-decisions:
  - "Badge/card helper functions duplicated (not imported) from generate-portfolio-report.ts per Pitfall 4 — those functions are not exported, and the visual grammar (color codes, spacing) must match verbatim"
  - "watchlist[normalizeHoldingSymbol(ticker)] join required uppercase-keyed WatchlistFile fixtures in tests (normalizeHoldingSymbol does trim+toUpperCase) — initial RED tests used lowercase keys by mistake and were corrected during GREEN"
  - "Test assertions for `#10b981`/`.agent-card` scoped to the watchlist section HTML fragment only, since both tokens are reused verbatim elsewhere in the report (verdict color, index-investor-advice card) and whole-document assertions produced false negatives"

patterns-established:
  - "Pattern: section-dispatcher functions taking `X | null` return empty string on null (complete section omission) vs empty array (heading + fallback message) — the two 'nothing to show' states are visually distinct"

requirements-completed: [UI-09, UI-10]

coverage:
  - id: D1
    description: "judgments 1件以上でバッジ・判定理由・会社名・as-of注記・signalsピルがHTMLに含まれる（UI-09）"
    requirement: "UI-09"
    verification:
      - kind: unit
        ref: "src/scripts/generate-report.test.ts#Test 37: judgments 複数件（buy 1件 + wait 1件）で見出し・バッジ文言・ラベル文言・rationale・会社名が含まれる"
        status: pass
      - kind: unit
        ref: "src/scripts/generate-report.test.ts#Test 42: market: US の銘柄で「前日終値時点」が asOf 値とともに含まれる"
        status: pass
      - kind: unit
        ref: "src/scripts/generate-report.test.ts#Test 44: signals 配列の各要素が .ticker-pill クラスの span として描画される"
        status: pass
    human_judgment: false
  - id: D2
    description: "judgments 空でも見出し＋空メッセージで正常描画される"
    verification:
      - kind: unit
        ref: "src/scripts/generate-report.test.ts#Test 38: 有効な WatchlistJudgmentFile で judgments が空配列のとき見出し＋空メッセージが含まれ、カード div は含まれない"
        status: pass
    human_judgment: false
  - id: D3
    description: "judgmentFile が null（欠損・破損・stale）ならセクション全体が非表示"
    verification:
      - kind: unit
        ref: "src/scripts/generate-report.test.ts#Test 39: watchlistJudgment に null を渡すとセクション見出し・空メッセージのいずれも含まれない（完全非表示）"
        status: pass
    human_judgment: false
  - id: D4
    description: "actionChanged === true のみ変化バッジを描画し、方向で緑/アンバーを分ける（UI-10）"
    requirement: "UI-10"
    verification:
      - kind: unit
        ref: "src/scripts/generate-report.test.ts#Test 47: 変化バッジ 待ち→買い で「シグナル点灯: 待ち → 買い」文言かつ緑系バッジ"
        status: pass
      - kind: unit
        ref: "src/scripts/generate-report.test.ts#Test 48: 変化バッジ 買い→待ち で「買い → 待ち」文言かつアンバーバッジ"
        status: pass
      - kind: unit
        ref: "src/scripts/generate-report.test.ts#Test 49: 変化バッジ非表示 undefined"
        status: pass
      - kind: unit
        ref: "src/scripts/generate-report.test.ts#Test 50: 変化バッジ非表示 false"
        status: pass
    human_judgment: false
  - id: D5
    description: "status: skipped の銘柄はグレー系の控えめ表示で描画される（buy/waitバッジを出さない）"
    verification:
      - kind: unit
        ref: "src/scripts/generate-report.test.ts#Test 46: status: skipped の銘柄は「判定不能（データ不足）」文言とグレー系スタイルで描画され buy/wait バッジは出さない"
        status: pass
    human_judgment: false
  - id: D6
    description: "会社名が解決できない銘柄はティッカーのみにフォールバックする"
    verification:
      - kind: unit
        ref: "src/scripts/generate-report.test.ts#Test 51: watchlist に該当 ticker のエントリが無い銘柄は見出しがティッカーのみ（会社名フォールバック）"
        status: pass
      - kind: unit
        ref: "src/scripts/generate-report.test.ts#Test 52: judgment.ticker が大文字小文字混在でも watchlist の正規化キーと join され会社名が解決される"
        status: pass
    human_judgment: false
  - id: D7
    description: "既存 generateDailyReportHtml の3引数・4引数呼び出しが後方互換で動作する（D-15）"
    verification:
      - kind: unit
        ref: "src/scripts/generate-report.test.ts#Test 53: generateDailyReportHtml を3引数で呼んでも throw せず HTML を返す（後方互換）"
        status: pass
      - kind: unit
        ref: "src/scripts/generate-report.test.ts#Test 54: generateDailyReportHtml を4引数で呼んでも throw せず HTML を返す（後方互換）"
        status: pass
      - kind: unit
        ref: "src/scripts/generate-report.test.ts#Test 35 [chart]: marketData 省略時（3引数呼び出し）でも HTML が正常に生成される（後方互換）"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-07-16
status: complete
---

# Phase 31 Plan 02: Daily Report Watchlist Section Rendering Summary

**Pure HTML-string rendering functions (formatWatchlistSectionHtml + 3 helpers) added to generate-daily-report.ts to display buy-timing judgments as badged cards, inserted between the scoring matrix and WebSearch sections with fully backward-compatible optional params.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-15T23:29:16Z
- **Completed:** 2026-07-16T08:34:30Z (test run confirming GREEN)
- **Tasks:** 2 (RED test task, GREEN implementation task)
- **Files modified:** 2

## Accomplishments
- `formatWatchlistSectionHtml` — 3-state top-level dispatcher: `null` → section omitted entirely (empty string), empty `judgments[]` → heading + "現在ウォッチリスト銘柄はありません", non-empty → heading + subhead + per-ticker cards
- `formatWatchlistJudgmentCardHtml` — per-ticker card with `.agent-card` container, ticker/company-name heading (em-dash join or ticker-only fallback), today-action badge, action-changed badge, as-of/market session note, rationale paragraph, `.ticker-pill` signals, addedDate meta line; early-returns a distinct grey/`opacity:0.7` skeleton for `status: "skipped"` (no action badges)
- `formatTodayActionBadgeHtml` / `formatActionChangedBadgeHtml` — badge helpers duplicated (not imported) from `generate-portfolio-report.ts`'s proven visual grammar; `formatActionChangedBadgeHtml` uses the mandatory `actionChanged !== true` early-return to distinguish "can't compare" (undefined) from "no change" (false)
- `generateDailyReportHtml` signature extended with two trailing optional params (`watchlistJudgment: WatchlistJudgmentFile | null = null`, `watchlist: WatchlistFile = {}`) — all existing 3-arg and 4-arg call sites continue to work unchanged
- 18 new unit tests added to `generate-report.test.ts` covering all required branches (multi-judgment, empty, null, buy/wait colors, as-of US/JP, signals pills, addedDate, skipped, 4 change-badge directions, company-name fallback, normalized-key join, 3-arg/4-arg backward compat)

## Task Commits

Each task was committed atomically following RED → GREEN TDD discipline:

1. **Task 1: セクション描画分岐の失敗テストを先に書く（RED）** - `b2c2471` (test) — 12 of 18 new tests failed as expected (implementation absent); 69 pre-existing tests unaffected
2. **Task 2: formatWatchlistSectionHtml 群を実装しセクションを挿入して GREEN にする** - `92ff8c7` (feat) — all 81 tests in `generate-report.test.ts` pass; full suite (610 tests) green

_Note: This is a `type: tdd` plan with two RED/GREEN tasks (not per-function TDD sub-cycles); each task itself follows the RED→GREEN discipline internally as documented above._

## Files Created/Modified
- `src/scripts/generate-daily-report.ts` — added imports (`WatchlistJudgment`, `WatchlistJudgmentFile`, `WatchlistEntry`, `WatchlistFile`, `normalizeHoldingSymbol`), four new render functions, extended `generateDailyReportHtml` signature and template insertion point
- `src/scripts/generate-report.test.ts` — added `describe("Watchlist section (UI-09/UI-10)", ...)` block with 18 tests (Test 37–54)

## Decisions Made
- Badge helper functions (`formatTodayActionBadgeHtml`, `formatActionChangedBadgeHtml`) are duplicated from `generate-portfolio-report.ts`'s non-exported `formatUrgentBadgeHtml`/`formatDecisionChangedBadgeHtml`, not imported — matches Pitfall 4 guidance and keeps each report's rendering module self-contained
- `WatchlistFile` lookup keys must be uppercase (or otherwise match `normalizeHoldingSymbol`'s `trim().toUpperCase()` output) — this surfaced as a test-fixture bug during GREEN (fixtures initially used lowercase `pltr`/`snow` keys) and was corrected, not an implementation bug
- Two test assertions (`#10b981` absence check in Test 41, `.agent-card` absence check in Test 38) were rescoped from whole-document `toContain`/`not.toContain` to a sliced watchlist-section-only fragment, because both tokens legitimately appear elsewhere in the report (verdict/trend colors, index-investor-advice card) and whole-document scope produced false test failures unrelated to the implementation

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed test fixture ticker-key casing mismatch**
- **Found during:** Task 2 (GREEN implementation, first test run)
- **Issue:** RED-phase test fixtures for `WatchlistFile` used lowercase keys (`pltr`, `snow`) but `normalizeHoldingSymbol` (used by the join logic per Pitfall 5) uppercases via `trim().toUpperCase()`, so company-name resolution silently failed in 3 tests (Test 37, 45, 52)
- **Fix:** Changed fixture keys to uppercase (`PLTR`, `SNOW`) to match the normalization contract
- **Files modified:** src/scripts/generate-report.test.ts
- **Verification:** Re-ran `npx vitest run src/scripts/generate-report.test.ts`, all 3 tests passed
- **Committed in:** 92ff8c7 (Task 2 commit)

**2. [Rule 1 - Bug] Fixed overly-broad test assertions producing false failures**
- **Found during:** Task 2 (GREEN implementation, second test run)
- **Issue:** Test 41 (`expect(html).not.toContain("#10b981")`) and Test 38 (`expect(html).not.toContain('class="agent-card"')`) asserted against the entire document, but both tokens are legitimately used by unrelated sections in `validMeetingResult`'s fixture data (verdict color `強気`, index-investor-advice card) — causing correct implementation output to fail these assertions
- **Fix:** Sliced the HTML to the watchlist section fragment (from heading text to next `<hr>`) before asserting absence, scoping the check to only what this plan's code renders
- **Files modified:** src/scripts/generate-report.test.ts
- **Verification:** Re-ran `npx vitest run src/scripts/generate-report.test.ts`, both tests passed; full suite still green (610/610)
- **Committed in:** 92ff8c7 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — test-authoring bugs found while driving RED tests to GREEN, no production code behavior changed as a result)
**Impact on plan:** No scope creep; both fixes were corrections to the test suite itself, not the implementation. Implementation matches the plan's `<action>` spec exactly (verified via acceptance-criteria greps below).

## Issues Encountered
None beyond the two auto-fixed test-authoring bugs documented above.

## Acceptance Criteria Verification
- `npx vitest run src/scripts/generate-report.test.ts` — GREEN, 81/81 tests pass
- `npm run test` (full suite) — GREEN, 610/610 tests pass across 33 test files
- `grep -c 'actionChanged !== true' src/scripts/generate-daily-report.ts` → 1 (Pitfall 2 discipline confirmed)
- `grep -c 'normalizeHoldingSymbol' src/scripts/generate-daily-report.ts` → 2 (import + usage, Pitfall 5 confirmed)
- `${scoringSection}` / `${watchlistSection}` / `${webSearchSection}` appear in that exact order in the template literal (D-01 insertion order confirmed)
- Buy/wait/change-direction color codes (`#10b981`, `#9ca3af`, `#f59e0b`) verified present via test assertions, matching 31-UI-SPEC.md Color table

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 31-03 (pipeline wiring: `generate-report.ts` orchestration calling `loadWatchlistJudgment`/`loadWatchlist` and passing results into `generateDailyReportHtml`) can proceed — the rendering functions and extended signature are in place and fully tested in isolation
- No blockers identified

---
*Phase: 31-daily-report-watchlist-section*
*Completed: 2026-07-16*

## Self-Check: PASSED

- FOUND: src/scripts/generate-daily-report.ts
- FOUND: src/scripts/generate-report.test.ts
- FOUND: .planning/phases/31-daily-report-watchlist-section/31-02-SUMMARY.md
- FOUND commit: b2c2471 (test(31-02): add failing tests for watchlist section rendering)
- FOUND commit: 92ff8c7 (feat(31-02): implement watchlist section rendering and insert into daily report)

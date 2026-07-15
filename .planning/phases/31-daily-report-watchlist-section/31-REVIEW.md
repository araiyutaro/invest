---
phase: 31-daily-report-watchlist-section
reviewed: 2026-07-16T08:45:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - src/scripts/generate-daily-report.ts
  - src/scripts/generate-report.test.ts
  - src/scripts/generate-report.ts
  - src/scripts/report-data-loaders.test.ts
  - src/scripts/report-data-loaders.ts
findings:
  critical: 0
  warning: 0
  info: 2
  total: 2
status: issues_found
---

# Phase 31: Code Review Report

**Reviewed:** 2026-07-16T08:45:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Phase 31 adds a watchlist buy-timing section to the Daily Report via two new fail-soft loaders (`loadWatchlistJudgment`, `loadWatchlist`) and a new rendering pipeline in `generate-daily-report.ts`. I read every file in scope and traced the full call chain from `main()` in `generate-report.ts` through the loaders into `formatWatchlistSectionHtml`/`formatWatchlistJudgmentCardHtml`.

Verified against the locked contracts named in phase context:
- **Fail-soft loaders (throw-free):** Both `loadWatchlistJudgment` and `loadWatchlist` wrap all I/O and JSON.parse in try/catch, validate root shape (null/array/primitive guard) before casting, and never throw. Confirmed by reading the full function bodies and cross-checking against `report-data-loaders.test.ts` (malformed JSON, ENOENT, non-object root, array root all covered).
- **D-13 date-mismatch → null:** `loadWatchlistJudgment` explicitly compares `file.date !== meetingResultDate` and returns `null` with a `console.warn`, verified by test "D-13: file.date が meetingResultDate と異なれば null を返し...".
- **3-state rendering (full / empty-message / omitted):** Traced `formatWatchlistSectionHtml` — `null` → `""` (omitted), `judgments.length === 0` → heading + empty message, non-empty → heading + cards. All three states are exercised by Test 37/38/39 and I additionally ran an ad-hoc render to confirm the empty-state test's `<hr>`-boundary slicing logic doesn't accidentally match a later `<hr>` when other sections are also empty (confirmed safe — verified with a throwaway test file, deleted after use, no residual artifacts).
- **actionChanged `!== true` early-return:** `formatActionChangedBadgeHtml` uses `if (actionChanged !== true) return ""`, correctly distinguishing `undefined` (incomparable) from `false` (no change) from `true`. Covered by Test 49/50.
- **escapeHtml on all LLM-derived text:** Every field sourced from LLM/pipeline output that reaches the DOM (`ticker`, `rationale`, `signals[]`, `asOf`, `companyName`, `addedDate`) is passed through `escapeHtml`. The only unescaped interpolations are `judgment.market` (TS-derived literal union `"US"|"JP"`, never LLM-controlled per D-13 comment) and `judgment.todayAction`/`status` (both narrow TS unions), which is consistent with the trust model already used elsewhere in this file for other TS-derived unions (e.g. `result.marketOverview.trend`).
- **Backward-compatible signature:** `generateDailyReportHtml` adds `watchlistJudgment = null` and `watchlist = {}` as the 5th/6th parameters with defaults, preserving all pre-existing 3-arg and 4-arg call sites. Confirmed via Test 35/53/54 (3-arg and 4-arg calls still work and omit the watchlist section).
- **Ticker normalization / lookup correctness:** `WatchlistFile` keys are stored via `normalizeHoldingSymbol` (trim + uppercase) per `watchlist.ts`, and the lookup in `formatWatchlistSectionHtml` (`watchlist[normalizeHoldingSymbol(j.ticker)]`) correctly matches that convention — verified against Test 52 (mixed-case ticker `pLtR` resolves to `PLTR` entry).
- **Badge grammar parity with `generate-portfolio-report.ts`:** Compared `formatActionChangedBadgeHtml` against `formatDecisionChangedBadgeHtml` in the portfolio report — both use the same `!== true` guard, same amber `#f59e0b` background for the "reverted" case, and the same pill styling pattern. Consistent.

No Critical or Warning findings. Two Info-level items below are pre-existing/minor and don't block shipping.

## Info

### IN-01: `markdownToHtml` imported but unused in `generate-daily-report.ts`

**File:** `src/scripts/generate-daily-report.ts:1`
**Issue:** The import `markdownToHtml` from `./report-utils.js` is never referenced anywhere in this file (verified via `grep -n "markdownToHtml" src/scripts/generate-daily-report.ts` — only the import line matches). This predates the Phase 31 diff (the import line was unchanged by this phase's commits), but it is within the reviewed file's current scope.
**Fix:**
```typescript
// Before
import { escapeHtml, markdownToHtml, scoreColor, verdictColor, generateBaseStyles } from "./report-utils.js";

// After
import { escapeHtml, scoreColor, verdictColor, generateBaseStyles } from "./report-utils.js";
```

### IN-02: No test exercises the `entry?.name` fallback branch (nameJa absent, name present)

**File:** `src/scripts/generate-daily-report.ts:257`, `src/scripts/generate-report.test.ts:236-570`
**Issue:** `formatWatchlistJudgmentCardHtml` resolves the display name via `entry?.nameJa ?? entry?.name`. Every watchlist test fixture in the "Watchlist section" describe block that supplies a company name only ever sets `nameJa` (Test 37, 45, 52); none supply an entry with `name` but no `nameJa` to exercise the fallback path. The current implementation is correct by inspection, but the branch is untested, so a future regression (e.g. someone swaps the `??` operands or a typo in the property name) would not be caught by the suite.
**Fix:** Add a small fixture-only test alongside Test 37/45, e.g.:
```typescript
it("Test 55: watchlist エントリに nameJa が無く name のみのとき name がフォールバックとして使われる", async () => {
  const { generateDailyReportHtml } = await import("./generate-daily-report.js");
  const watchlistJudgmentFixture = {
    date: validMeetingResult.date,
    generatedAt: "2026-06-24T08:00:00.000Z",
    judgments: [{ ticker: "PLTR", todayAction: "buy" as const, rationale: "根拠", signals: [] }],
  };
  const watchlistFixture = { PLTR: { ticker: "PLTR", name: "Palantir Technologies", history: [] } };
  const html = generateDailyReportHtml(
    validMeetingResult, [], [], marketDataDefault,
    watchlistJudgmentFixture, watchlistFixture,
  );
  expect(html).toContain("Palantir Technologies");
});
```

---

_Reviewed: 2026-07-16T08:45:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

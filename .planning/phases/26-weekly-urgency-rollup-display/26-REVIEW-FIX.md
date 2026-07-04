---
phase: 26-weekly-urgency-rollup-display
fixed_at: 2026-07-04T08:08:45Z
review_path: .planning/phases/26-weekly-urgency-rollup-display/26-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 8
skipped: 0
status: all_fixed
---

# Phase 26: Code Review Fix Report

**Fixed at:** 2026-07-04T08:08:45Z
**Source review:** .planning/phases/26-weekly-urgency-rollup-display/26-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 8 (3 Critical + 5 Warning)
- Fixed: 8
- Skipped: 0

## Fixed Issues

### CR-01: `computeWeeklyUrgencyRollup` throws on a calendar-invalid (but regex-valid) `anchorDate`

**Files modified:** `src/portfolio/urgency-rollup.ts`, `src/portfolio/urgency-rollup.test.ts`
**Commit:** 0ec3a4f
**Applied fix:** Added `isRealCalendarDate(dateKey)` helper that round-trips `Date.parse` output back through `toISOString().slice(0,10)` and compares to the original key. `computeWeeklyUrgencyRollup` now rejects `anchorDate` values that fail either `isValidDateKey` or `isRealCalendarDate`, returning the same empty-rollup fail-soft shape. Verified via live repro: `computeWeeklyUrgencyRollup({}, "2026-13-01")` no longer throws. Grouped with WR-04 (same commit) since both concern calendar-date consistency.

### CR-02: `computeWeeklyUrgencyRollup` throws when `history` is not a plain object; `loadUrgencyHistory` did not defend against this

**Files modified:** `src/portfolio/urgency-rollup.ts`, `src/portfolio/urgency-rollup.test.ts`, `src/scripts/report-data-loaders.ts`, `src/scripts/report-data-loaders.test.ts`
**Commit:** cc06e86
**Applied fix:** Added a guard in the pure function (`history === null || typeof history !== "object" || Array.isArray(history)` → return empty rollup) and a matching guard in `loadUrgencyHistory` (validates `JSON.parse` root shape, falls back to `{}` with `console.warn` on unexpected root). Defense in depth at both layers per the review's suggestion. Verified via live repro: `computeWeeklyUrgencyRollup(null, "2026-07-01")` no longer throws.

### CR-03: Only `symbol` was runtime-validated per snapshot; non-string `nameJa`/`decision` crashed `escapeHtml`

**Files modified:** `src/portfolio/urgency-rollup.ts`, `src/portfolio/urgency-rollup.test.ts`, `src/scripts/generate-report.test.ts`
**Commit:** d90019b
**Applied fix:** Extended the per-snapshot guard to also require `typeof s.nameJa === "string" && typeof s.decision === "string"`, skipping entries that fail any check. Grouped with WR-01 (same loop, same commit). Verified end-to-end: `generatePortfolioReportHtml` with a `nameJa: 12345` snapshot no longer throws and correctly renders only the valid entries.

### WR-01: Corrupt (non-array) day entries were counted toward `daysCovered`

**Files modified:** `src/portfolio/urgency-rollup.ts`, `src/portfolio/urgency-rollup.test.ts`
**Commit:** d90019b (bundled with CR-03, same loop)
**Applied fix:** Introduced a `usableDates` Set populated only when a snapshot survives the (now CR-03-extended) per-snapshot guard; `daysCovered` now reports `usableDates.size` instead of `matchedDates.length`. Updated the pre-existing test (`"値が配列でない日付は throw せずスキップされる"`) that had locked in the old (overstating) behavior to assert the corrected, more honest `daysCovered`.

### WR-02: Empty-state tier selection used raw `Object.keys().length` instead of valid-date count

**Files modified:** `src/scripts/generate-portfolio-report.ts`, `src/scripts/generate-report.test.ts`
**Commit:** a232f45
**Applied fix:** Imported `isValidDateKey` from `urgency-history.js` and changed `totalHistoryEntries` to `Object.keys(urgencyHistory).filter(isValidDateKey).length`, so both the tier-selection call site and `computeWeeklyUrgencyRollup` share the same notion of "valid date key". Verified: a history containing only `__proto__`/`"not-a-date"` keys now correctly renders the Tier 1 "no history yet" message instead of Tier 2's "no movement this week".

### WR-03: Rendered dates from `formatDateKeyShort` were not passed through `escapeHtml`

**Files modified:** `src/scripts/generate-portfolio-report.ts`
**Commit:** 08bd8e3
**Applied fix:** Wrapped both interpolation sites (`urgentHtml`'s `.map(formatDateKeyShort)` and `changesHtml`'s `formatDateKeyShort(c.date)`) in `escapeHtml(...)` for defense-in-depth consistency with every other dynamic string in the module. Confirmed existing rendering tests (MM/DD digit+slash output) are unaffected since `escapeHtml` only escapes `& < > " '`.

### WR-04: Calendar rollover produced an inconsistent `windowStart`/`windowEnd` pair

**Files modified:** `src/portfolio/urgency-rollup.ts`
**Commit:** 0ec3a4f (bundled with CR-01, both concern calendar-date consistency)
**Applied fix:** `windowEnd` now routes through the same `addDaysUtc(anchorDate, 0)` UTC-normalization path as `windowStart`, rather than assigning the raw `anchorDate` string directly. Combined with the CR-01 fix (which rejects non-real calendar dates before this code runs at all), the inconsistency this finding described is now structurally unreachable, and the two values are computed via the same code path for defense-in-depth.

### WR-05: No test coverage for calendar-invalid `anchorDate` or non-object `history` root shapes

**Files modified:** `src/portfolio/urgency-rollup.test.ts`, `src/scripts/report-data-loaders.test.ts`, `src/scripts/generate-report.test.ts`
**Commits:** 0ec3a4f, cc06e86, d90019b, a232f45 (regression tests were added alongside each corresponding fix rather than as a single separate commit, since each test directly locks in its sibling fix)
**Applied fix:** Added regression tests covering all four missing input classes named in the finding:
- Calendar-invalid anchor (`"2026-13-01"`, `"2026-02-30"`) does not throw and returns empty rollup (`urgency-rollup.test.ts`)
- `history` = `null` / array / primitive does not throw and returns empty rollup, both at the pure-function level (`urgency-rollup.test.ts`) and the loader level for `null`/array JSON roots (`report-data-loaders.test.ts`)
- Non-string `nameJa`/`decision` entries are skipped without throwing, both at the pure-function level and end-to-end through `generatePortfolioReportHtml` (`urgency-rollup.test.ts`, `generate-report.test.ts`)
- Tier-1 vs Tier-2 selection is correct for malformed-keys-only history (`generate-report.test.ts`)

## Skipped Issues

None — all 8 findings were fixed.

## Verification

- Full suite: `npx vitest run` → 377/377 passed (baseline was 366/366; +11 new regression tests)
- `npx vitest run src/portfolio/urgency-rollup.test.ts` → 28/28 passed
- `npx vitest run src/scripts/generate-report.test.ts` → 63/63 passed
- `npx tsc --noEmit` → no errors in any modified file (pre-existing unrelated errors in `src/scripts/collect-data.test.ts` left untouched, out of scope per instructions)
- All four `npx tsx -e` repros from 26-REVIEW.md were re-run against the fixed code and confirmed to no longer throw / no longer select the wrong tier.

---

_Fixed: 2026-07-04T08:08:45Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_

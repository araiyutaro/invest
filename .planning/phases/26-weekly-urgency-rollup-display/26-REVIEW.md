---
phase: 26-weekly-urgency-rollup-display
reviewed: 2026-07-04T12:00:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - src/portfolio/urgency-rollup.ts
  - src/portfolio/urgency-rollup.test.ts
  - src/scripts/generate-portfolio-report.ts
  - src/scripts/generate-report.ts
  - src/scripts/generate-report.test.ts
  - src/scripts/report-data-loaders.ts
  - src/scripts/report-data-loaders.test.ts
findings:
  critical: 3
  warning: 5
  info: 0
  total: 8
status: issues_found
---

# Phase 26: Code Review Report

**Reviewed:** 2026-07-04T12:00:00Z
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Reviewed the weekly urgency rollup feature: the pure aggregation module (`urgency-rollup.ts`), its consumer in the portfolio report renderer, the `loadUrgencyHistory` fail-soft loader, and the `generate-report.ts` pipeline wiring. The escaping discipline for `symbol`/`nameJa`/`decision` is mostly correct (verified with a live `<script>`/`onerror` payload test that does get neutralized), and the `__proto__`/malformed-key rejection via `isValidDateKey` is genuinely safe (confirmed `JSON.parse` does not trigger prototype pollution for `__proto__` keys, and the regex filter additionally strips them from `Object.keys`).

However, the core claim in the module's docstring — "純関数: throw なし、I/O なし" (pure function, never throws) — is **false** for three distinct, reproducible inputs, and all three are able to crash `generatePortfolioReportHtml()` and therefore `main()` in `generate-report.ts` (there is no try/catch around report generation in `main()`, so a crash here takes down the entire 3-report pipeline, not just the portfolio report). Two of the three are reachable from data this pipeline already treats as untrusted (the `data/urgency-history.json` file loaded via `loadUrgencyHistory`, and `meetingResult.date`, which is schema-validated only by a format regex, not calendar validity). There is also a tier-selection logic bug in the empty-state fallback that can show the wrong "no history" message. Each finding below includes a working `npx tsx -e` repro that was actually executed against the checked-out code.

## Critical Issues

### CR-01: `computeWeeklyUrgencyRollup` throws on a calendar-invalid (but regex-valid) `anchorDate`

**File:** `src/portfolio/urgency-rollup.ts:41-44` (`addDaysUtc`), `src/portfolio/urgency-rollup.ts:72` (`isValidDateKey` gate)
**Issue:** `isValidDateKey` (imported from `urgency-history.ts`) only checks the shape `^\d{4}-\d{2}-\d{2}$` — it does not validate that the month/day are real calendar values. `addDaysUtc` calls `Date.parse(\`${dateKey}T00:00:00Z\`)`, which returns `NaN` for months >12 or invalid day-of-month combinations (e.g. `"2026-13-01"`, `"2026-00-01"`, `"2026-07-00"`, `"2026-99-99"`). `new Date(NaN).toISOString()` then throws `RangeError: Invalid time value`, which propagates out of `computeWeeklyUrgencyRollup` uncaught.

Reproduced:
```
$ npx tsx -e "
import { computeWeeklyUrgencyRollup } from './src/portfolio/urgency-rollup.ts';
computeWeeklyUrgencyRollup({}, '2026-13-01');
"
THROWS: Invalid time value
```
`anchorDate` in production is `result.date` / `meetingResult.date`, which is validated in `src/meeting/schemas.ts:49` with `z.string().regex(/^\d{4}-\d{2}-\d{2}$/)` — format-only, not calendar validity. An LLM-produced or hand-edited `meeting-result.json` with a malformed date (plausible failure mode for LLM-generated JSON) would pass schema validation and then crash `generatePortfolioReportHtml`, taking down `main()` for all three reports (daily, minutes, portfolio) since there is no surrounding try/catch in `generate-report.ts`.

**Fix:** Validate that the parsed date actually round-trips before doing arithmetic, and fail soft (return the same empty rollup shape already used for `!isValidDateKey`):
```typescript
function isRealCalendarDate(dateKey: string): boolean {
  const ms = Date.parse(`${dateKey}T00:00:00Z`);
  if (Number.isNaN(ms)) return false;
  return new Date(ms).toISOString().slice(0, 10) === dateKey;
}

export function computeWeeklyUrgencyRollup(
  history: UrgencyHistoryFile,
  anchorDate: string,
): WeeklyUrgencyRollup {
  if (!isValidDateKey(anchorDate) || !isRealCalendarDate(anchorDate)) {
    return { windowStart: anchorDate, windowEnd: anchorDate, daysCovered: 0, symbols: [] };
  }
  // ...
}
```

### CR-02: `computeWeeklyUrgencyRollup` throws when `history` is not a plain object (e.g. `null`), and `loadUrgencyHistory` does not defend against this

**File:** `src/portfolio/urgency-rollup.ts:79` (`Object.keys(history)`), `src/scripts/report-data-loaders.ts:143-151` (`loadUrgencyHistory`)
**Issue:** `loadUrgencyHistory` does `JSON.parse(raw) as UrgencyHistoryFile` with no runtime shape check. If `data/urgency-history.json` contains any syntactically-valid JSON whose root is not a plain object (e.g. literal `null`, a number, a string, `true`) — a realistic corruption mode for a hand-edited or partially-overwritten file — `JSON.parse` succeeds, the `try` block does not throw, and the loader happily returns `null`/`42`/etc. typed as `UrgencyHistoryFile`. `computeWeeklyUrgencyRollup` then calls `Object.keys(history)` directly with no guard, and `Object.keys(null)` throws `TypeError: Cannot convert undefined or null to object`.

Reproduced:
```
$ npx tsx -e "
import { computeWeeklyUrgencyRollup } from './src/portfolio/urgency-rollup.ts';
computeWeeklyUrgencyRollup(null as any, '2026-07-01');
"
THROWS: Cannot convert undefined or null to object
```
This directly violates the stated fail-soft contract: "loadUrgencyHistory must be fail-soft: missing/corrupt file → `{}` fallback, never throws, must not block the report pipeline." A corrupt-but-parseable file bypasses the `catch` block entirely.

**Fix:** Guard the shape in the pure function (defense in depth, since it is the one documented as "never throws"), and/or validate in the loader:
```typescript
// urgency-rollup.ts
if (history === null || typeof history !== "object" || Array.isArray(history)) {
  return { windowStart: anchorDate, windowEnd: anchorDate, daysCovered: 0, symbols: [] };
}
```
```typescript
// report-data-loaders.ts
const parsed = JSON.parse(raw) as unknown;
if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
  console.warn("Urgency history load failed (unexpected root shape) — falling back to {}");
  return {};
}
return parsed as UrgencyHistoryFile;
```

### CR-03: Only `symbol` is runtime-validated per snapshot; a corrupt `nameJa`/`decision` crashes `escapeHtml` in the renderer

**File:** `src/portfolio/urgency-rollup.ts:90` (guard only checks `typeof s.symbol !== "string"`), `src/scripts/generate-portfolio-report.ts:145` (`escapeHtml(s.nameJa)`)
**Issue:** The per-snapshot guard is `if (!s || typeof s.symbol !== "string") continue;` — `nameJa`, `urgent`, and `decision` are passed through with no type check at all, even though the module's own docstring/tests explicitly claim to defend against "corrupt snapshot entries." If a history entry has a non-string `nameJa` (or `decision`) — e.g. a numeric value from a corrupted write — `computeWeeklyUrgencyRollup` happily includes it in `WeeklySymbolRollup.nameJa` (typed `string` at compile time, but not actually a string at runtime). `generate-portfolio-report.ts` then calls `escapeHtml(s.nameJa)`, and `escapeHtml`'s body (`text.replace(/&/g, ...)`) throws because numbers have no `.replace` method.

Reproduced end-to-end:
```
$ npx tsx -e "
import { generatePortfolioReportHtml } from './src/scripts/generate-portfolio-report.ts';
const history = { '2026-07-01': [{ symbol: 'MRNA', nameJa: 12345, urgent: true, decision: '保持' }] };
generatePortfolioReportHtml({ date: '2026-07-01' } as any, null, {}, history as any);
"
THROWS: text.replace is not a function
```
This crashes the entire portfolio report generation (and thus `main()`), exactly the failure mode the module is supposed to prevent for corrupt history data.

**Fix:** Extend the guard to cover all fields actually rendered:
```typescript
for (const s of snapshots) {
  if (
    !s ||
    typeof s.symbol !== "string" ||
    typeof s.nameJa !== "string" ||
    typeof s.decision !== "string"
  ) continue;
  // ...
}
```

## Warnings

### WR-01: Corrupt (non-array) day entries are counted toward `daysCovered`

**File:** `src/portfolio/urgency-rollup.ts:79-82`
**Issue:** `matchedDates` is derived purely from key validity + window range, before the per-day value shape (`Array.isArray(snapshots)`) is checked. A date whose value is not an array (e.g. a truncated/corrupt write) is still counted in `daysCovered` and thus in the "過去N日分の履歴に基づく" footnote, even though it contributed zero actual snapshot data. This is already locked in by a test (`"値が配列でない日付は throw せずスキップされる"` expects `daysCovered: 2` for one corrupt + one valid day), so the behavior is intentional, but it overstates real data coverage to the reader.
**Fix:** Consider only counting dates that yielded at least one usable snapshot toward `daysCovered`, or rename the footnote to avoid implying full data quality for corrupt days.

### WR-02: Empty-state tier selection uses raw `Object.keys().length` instead of valid-date count, which can select the wrong tier

**File:** `src/scripts/generate-portfolio-report.ts:167` (`Object.keys(urgencyHistory).length`)
**Issue:** `totalHistoryEntries` — used to distinguish "no history at all" (Tier 1) from "history exists but no movement this week" (Tier 2) — counts every raw key in `urgencyHistory`, including keys that `isValidDateKey` would reject (`__proto__`, `"not-a-date"`, etc.). If a history object contains only invalid/malformed keys and no valid date entries, `totalHistoryEntries > 0` even though `computeWeeklyUrgencyRollup` finds zero usable data, so the code incorrectly renders Tier 2's "今週は緊急フラグ・判断変更はありませんでした" (implying real history exists) instead of Tier 1's "まだ緊急フラグ・判断変更の履歴がありません" (no history yet).

Reproduced:
```
$ npx tsx -e "
import { generatePortfolioReportHtml } from './src/scripts/generate-portfolio-report.ts';
const history = {
  '__proto__': [{ symbol: 'MRNA', nameJa: 'x', urgent: true, decision: '保持' }],
  'not-a-date': [{ symbol: 'MRNA', nameJa: 'x', urgent: true, decision: '保持' }],
};
const html = generatePortfolioReportHtml({ date: '2026-07-01' } as any, null, {}, history as any);
console.log(html.includes('まだ緊急フラグ・判断変更の履歴がありません')); // false (wrong)
console.log(html.includes('今週は緊急フラグ・判断変更はありませんでした')); // true (wrong tier)
"
```
**Fix:** Use a valid-date count instead of the raw key count, e.g. `Object.keys(urgencyHistory).filter(isValidDateKey).length`, or have `computeWeeklyUrgencyRollup` expose the count directly so both call sites share one source of truth.

### WR-03: Rendered dates from `formatDateKeyShort` are not passed through `escapeHtml` (currently safe only by invariant, not by defense-in-depth)

**File:** `src/scripts/generate-portfolio-report.ts:139,142`
**Issue:** `urgentHtml` and `changesHtml` interpolate `formatDateKeyShort(date)` directly into the HTML template without `escapeHtml`, unlike every other dynamic string in this module (`symbol`, `nameJa`, `decision`, `from`/`to`). This is not currently exploitable because every date reaching this code has already passed `isValidDateKey`'s `^\d{4}-\d{2}-\d{2}$` regex inside `computeWeeklyUrgencyRollup`, so it can only ever contain digits and dashes. But this safety is an implicit cross-module invariant with no local enforcement or test — a future change to `isValidDateKey`, `formatDateKeyShort`, or the timeline-population code could silently reintroduce an XSS vector with no existing test catching it (the current XSS regression test only covers `symbol`/`nameJa`, not dates).
**Fix:** Wrap for consistency and defense-in-depth:
```typescript
const urgentHtml = s.urgentDates.length > 0
  ? `<p ...>⚠ 緊急フラグ: ${s.urgentDates.map((d) => escapeHtml(formatDateKeyShort(d))).join(", ")}</p>`
  : "";
```

### WR-04: `Feb 30`-style calendar rollover produces an inconsistent `windowStart`/`windowEnd` pair (silent, non-crashing correctness bug)

**File:** `src/portfolio/urgency-rollup.ts:41-44,76-77`
**Issue:** For an `anchorDate` like `"2026-02-30"` (regex-valid, not a real calendar day, doesn't hit the `NaN` case from CR-01), `Date.parse` silently normalizes it to March 2 2026. `windowStart` is computed via `addDaysUtc` from this rolled-over timestamp (yielding `"2026-02-24"`), while `windowEnd` is assigned the raw, un-rolled anchor string `"2026-02-30"` (line 77: `const windowEnd = anchorDate;`). The result is a window whose start/end boundary is internally inconsistent with what either value actually represents, and this silently affects which history entries get included in `matchedDates` without any error signal.
**Fix:** Route `windowEnd` through the same UTC-normalization path as `windowStart` (e.g. `addDaysUtc(anchorDate, 0)`), or reject non-real calendar dates entirely per the CR-01 fix (which would make this moot).

### WR-05: No test coverage for calendar-invalid `anchorDate` or non-object `history` root shapes

**File:** `src/portfolio/urgency-rollup.test.ts`
**Issue:** The test suite covers malformed *keys* within an object (`__proto__`, `"not-a-date"`, empty string) and a malformed *anchor string* that fails the regex (`"not-a-date"`), but never exercises a regex-valid-but-calendar-invalid anchor (`"2026-13-01"`, `"2026-02-30"`) or a non-object `history` root (`null`, array, primitive) — exactly the two input classes that CR-01/CR-02 prove will throw. Given the module's explicit "never throws" contract, these are the highest-value missing test cases.
**Fix:** Add regression tests once CR-01/CR-02 are fixed, e.g.:
```typescript
it("暦日として実在しない anchorDate (2026-13-01) でも throw しない", () => {
  expect(() => computeWeeklyUrgencyRollup({}, "2026-13-01")).not.toThrow();
});
it("history が null でも throw せず空ロールアップを返す", () => {
  expect(() => computeWeeklyUrgencyRollup(null as any, "2026-07-01")).not.toThrow();
});
```

---

_Reviewed: 2026-07-04T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

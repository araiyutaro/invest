---
phase: 14-report-ui
reviewed: 2026-07-01T03:01:53Z
depth: standard
files_reviewed: 15
files_reviewed_list:
  - src/data/market.ts
  - src/data/market.test.ts
  - src/scripts/collect-data.test.ts
  - src/scripts/report-charts.ts
  - src/scripts/report-charts.test.ts
  - src/scripts/generate-daily-report.ts
  - src/scripts/generate-report.ts
  - src/scripts/generate-report.test.ts
  - src/scripts/update-index.ts
  - src/scripts/update-index.test.ts
  - docs/index.html
  - src/scripts/report-utils.ts
  - src/scripts/report-utils.test.ts
  - docs/portfolio.html
  - src/meeting/schemas.ts
findings:
  critical: 1
  warning: 7
  info: 3
  total: 11
status: issues_found
---

# Phase 14: Code Review Report

**Reviewed:** 2026-07-01T03:01:53Z
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found

## Summary

Reviewed the report-ui phase's chart rendering, index/portfolio HTML regeneration, market data fetch, and Markdown-to-HTML pipeline. All 69 tests in the six touched vitest files pass, but the tests only assert on the narrow slices they were written to prove and miss several correctness/security gaps that are provable by tracing the code directly:

- `escapeHtml()` never escapes `"`, yet `update-index.ts` interpolates its output straight into an `href="..."` attribute; the interpolated value (`meetingResult.date`) is validated only as a free-form `z.string()` in `schemas.ts`, so a string containing a `"` breaks out of the attribute and injects into the public GitHub Pages `docs/index.html`.
- The `markdownToHtml()` Markdown-to-HTML converter (used for every analyst's `analysis`/`discussion` text in Meeting Minutes) has three separate, independently reproducible rendering bugs: a mis-ordered regex that leaks the `|---|---|` table separator row into rendered tables, unbalanced `<p>` tags whenever a heading/list is not followed by a blank line (which is exactly the format the analyst prompt fixture uses), and a naive italic regex that corrupts any literal `*` used for multiplication.
- `generate-report.ts` and `update-index.ts` both invoke `main().catch(...)` unconditionally at module top level with no entrypoint guard; importing either module (as the tests for their exported helpers do) triggers an uncontrolled background run of `main()`. This is not hypothetical — running the test files reproduces spurious `Fatal error: Error: ENOENT` / `update-index failed: Error: ENOENT` output that has nothing to do with the test being executed.
- The agent-score table in `generate-daily-report.ts` derives its header row from `highlightedStocks[0].agentScores` and then renders every other row positionally from that row's own (unrelated) `agentScores` array, with no shared type/schema invariant guaranteeing all stocks were scored by the same set of agents in the same order.

None of the reviewed files were mutated during this review.

## Critical Issues

### CR-01: Incomplete HTML escaping enables attribute-breakout injection into the public index page

**File:** `src/scripts/update-index.ts:94` (see also `src/scripts/report-utils.ts:7-12`, `src/meeting/schemas.ts:42`)

**Issue:**
`escapeHtml()` only escapes `&`, `<`, and `>`:

```ts
// src/scripts/report-utils.ts:7-12
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
```

It never escapes `"`. Everywhere else `escapeHtml()` is used to populate *text content* (safe), but `update-index.ts` uses it to populate an HTML *attribute value*:

```ts
// src/scripts/update-index.ts:91-97
function renderEntryLinks(entry: ReportEntry): string {
  return entry.links
    .map(
      (l) => `<a href="${escapeHtml(l.href)}">${escapeHtml(l.label)}</a>`,
    )
    .join("\n          ");
}
```

`l.href` traces back to `buildStandardLinks(date)` (`${date}/daily-report.html`, etc.), where `date` is `meetingResult.date`. In `src/meeting/schemas.ts:42`, that field is validated only as `z.string()` with no format constraint:

```ts
date: z.string(),
```

If `date` ever contains a `"` character — e.g. via prompt injection into the analyst/moderator pipeline that produces `meeting-result.json`, or any future change that lets user-influenced text reach `date` — the value breaks out of the `href="..."` attribute and can inject arbitrary attributes/markup (including `<script>`) into `docs/index.html`, which is served as a public static site (GitHub Pages). This is a stored-XSS class defect: the escaping primitive used throughout the codebase is unsafe for attribute contexts, and it is in fact used in an attribute context here.

**Fix:** Escape quotes too (minimum fix), and add defense-in-depth by constraining `date` to a strict format:

```ts
// report-utils.ts
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
```

```ts
// meeting/schemas.ts
date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
```

## Warnings

### WR-01: Markdown table separator row leaks into rendered output

**File:** `src/scripts/report-utils.ts:28-37`
**Issue:** The regex meant to strip the `|---|---|` separator row runs *after* the generic row-conversion regex has already turned every `| ... |` line — including the separator — into a `<tr>`:

```ts
html = html.replace(/^\| (.+) \|$/gm, (_, content: string) => { /* -> <tr>...</tr> */ });
html = html.replace(/^\|[-| ]+\|$/gm, "");   // too late: separator is already a <tr> by now
```

Reproduced directly:
```
Input:  "| A | B |\n| - | - |\n| 1 | 2 |"
Output: <table><tr><td>A</td><td>B</td></tr>
<tr><td>-</td><td>-</td></tr>
<tr><td>1</td><td>2</td></tr></table>
```
Every Markdown table rendered through `markdownToHtml` (used for analyst `analysis`/`discussion` text in Meeting Minutes) will show a garbage `- | -` row between the header and the data.

**Fix:** Strip the separator row before converting rows to `<tr>`:
```ts
html = html.replace(/^\|[-| ]+\|$/gm, "");
html = html.replace(/^\| (.+) \|$/gm, (_, content: string) => { /* ... */ });
```

### WR-02: `markdownToHtml` produces unbalanced `<p>` tags when a block element isn't followed by a blank line

**File:** `src/scripts/report-utils.ts:41-50`
**Issue:** The paragraph-wrapping pass only special-cases a block element (`<h1-4>`, `<ul>`, `<table>`, `<hr>`) when it is immediately followed by `</p>` (i.e., the block was on its own "paragraph"). When a heading/list is followed by body text with only a single newline (no blank line), the opening `<p>` in front of the heading gets stripped but the matching closing `</p>` at the end of that logical block is never found (because there's now text between `</h2>` and `</p>`), producing a dangling, unmatched `</p>` and leaving the following body text outside any `<p>` wrapper.

This is not a theoretical edge case — it is exactly the format used by the real analyst-round prompt fixture in `generate-report.test.ts`:
```
"## 市場認識\n米国株式市場はAI需要主導で上昇基調。\n\n## 専門領域からの洞察\n..."
```
Reproducing this input through `markdownToHtml` yields:
```
<h2>市場認識</h2>
米国株式市場はAI需要主導で上昇基調。
</p>
<h2>専門領域からの洞察</h2>
...
```
Note the body text after each heading is never wrapped in `<p>`, and a stray `</p>` is emitted with no opening tag. This means every section of every analyst's `analysis`/`discussion` text in the Meeting Minutes report loses its intended `p { margin-bottom: 0.8rem; }` spacing/styling and produces invalid HTML (unbalanced tags).

**Fix:** Normalize single newlines after headings/list blocks into paragraph breaks before wrapping, e.g. insert a paragraph break after any block-level closing tag that is followed by a non-blank line, or restructure the wrapping logic to operate on split blocks instead of global string replacement.

### WR-03: Naive italic regex corrupts literal asterisks (e.g. multiplication)

**File:** `src/scripts/report-utils.ts:23`
**Issue:**
```ts
html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
```
This unconditionally treats any pair of `*` characters as italic markers. Prose that uses `*` for multiplication or informal emphasis outside Markdown syntax gets mangled:
```
Input:  "The calculation 3 * 4 * 5 gives interesting results, and 2 * 3 too."
Output: "The calculation 3 <em> 4 </em> 5 gives interesting results, and 2 * 3 too."
```
Given this pipeline renders free-form LLM-generated financial analysis text, occurrences of `*` for multiplication (e.g., valuation multiples, "PER 15倍 × growth" style commentary) are plausible and would silently corrupt the rendered text.

**Fix:** Require single `*` not to be adjacent to `**` and/or restrict italic matching to non-whitespace-bounded tokens (`/(?<!\*)\*([^\s*][^*]*?)\*(?!\*)/g`), or drop single-asterisk italics support entirely given the ambiguity.

### WR-04: Agent-score table columns are positional, not keyed — can misalign across rows

**File:** `src/scripts/generate-daily-report.ts:52-84`
**Issue:** The table header is built solely from the first highlighted stock's `agentScores`:
```ts
const agentHeaders = result.highlightedStocks[0]?.agentScores
  .map((a) => `<td ...>${escapeHtml(a.agentRole)}</td>`)
  .join("") ?? "";
```
while every row renders its own `agentScores` positionally:
```ts
const agentCells = s.agentScores
  .map((a) => `<td ...>${a.score}...</td>`)
  .join("");
```
Nothing in `meeting/types.ts` or `meeting/schemas.ts` guarantees that every `highlightedStocks[i].agentScores` array has the same length or agent ordering as `highlightedStocks[0].agentScores` (each stock is only scored by the analysts who nominated/evaluated it). If stock counts/order differ, the resulting `<table>` will have a header from one agent set and data cells from another, producing misaligned or missing columns with no indication of the mismatch.

**Fix:** Build the header from the union of all `agentRole`s seen across `highlightedStocks`, and render each row by looking up each header's `agentRole` in that stock's `agentScores` (falling back to an empty cell when a given agent didn't score that stock), rather than assuming positional alignment.

### WR-05: `generateHtml()` silently drops market chart data (dead/inconsistent duplicate of `generateDailyReportHtml`)

**File:** `src/scripts/generate-report.ts:79-85`
**Issue:**
```ts
export function generateHtml(
  result: MeetingResult,
  webSearchResults: ReadonlyArray<WebSearchResult>,
  reevalResults: ReadonlyArray<ReevaluationOutput>,
): string {
  return generateDailyReportHtml(result, webSearchResults, reevalResults);
}
```
`main()` (the actual production code path, line 106) correctly calls `generateDailyReportHtml(meetingResult, webSearchResults, reevalResults, marketData)` with the 4th `marketData` argument, so the sector bar chart and VIX line chart render. `generateHtml()` is a separate exported function that omits `marketData` entirely, so calling it always renders the "データ取得エラー" placeholder for both charts regardless of actual data availability. `generateHtml` is only referenced by tests (no other production caller), making it dead code that silently diverges from `main()`'s behavior — a trap for any future caller who assumes `generateHtml` has parity with the real report pipeline.

**Fix:** Either delete `generateHtml` and update its tests to call `generateDailyReportHtml` directly, or thread `marketData` through it: `generateHtml(result, webSearchResults, reevalResults, marketData = { sectors: [], vixHistory: [] })`.

### WR-06: Missing script entrypoint guard causes uncontrolled background execution on import

**File:** `src/scripts/update-index.ts:232-235`, `src/scripts/generate-report.ts:122-125`
**Issue:** Both files call `main().catch(...)` unconditionally at module top level:
```ts
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
```
There is no guard (e.g. checking `import.meta.url` against the invoked entrypoint) preventing this from firing whenever the module is merely `import`-ed — which is exactly what the test files do to reach the exported helpers (`updateIndexHtml`, `generateHtml`, `parseExistingEntries`, etc.). This is verified, not hypothetical:
```
$ npx vitest run src/scripts/generate-report.test.ts
stderr | ... Test 1: generateHtml が ... を受け取り HTML 文字列を返す
Fatal error: Error: ENOENT
    at .../generate-report.test.ts:5:39
    ...

$ npx vitest run src/scripts/update-index.test.ts
update-index failed: Error: ENOENT
```
Neither test that triggers these logs asserts on `main()` or its failure — the fatal errors come purely from the module's own unconditional top-level invocation racing in the background against the test's explicit calls, using whatever `fs/promises` mocks happen to be configured at import time. Current tests happen to pass because assertions use `.find()`/non-strict counts rather than exact call counts, but this is a latent flakiness/race-condition risk (e.g., a `mockRejectedValueOnce` could be consumed by the wrong invocation) and pollutes CI output with unrelated "Fatal error" noise.

**Fix:** Guard the top-level call, e.g.:
```ts
import { fileURLToPath } from "node:url";

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
```

### WR-07: Inconsistent escaping — `buildPortfolioEntry` does not escape `date`

**File:** `src/scripts/update-index.ts:154-161`
**Issue:**
```ts
function buildPortfolioEntry(date: string): string {
  return `      <li class="report-item">
        <div class="report-date">${date}</div>
        <div class="report-links">
          <a href="${date}/portfolio-report.html">Portfolio Report</a>
        </div>
      </li>`;
}
```
Every other entry-rendering function in this same file (`renderEntryItem`, `renderHero`, `renderEntryLinks`) escapes `date`/`href`/`label` via `escapeHtml`. This function interpolates `date` twice with no escaping at all, both as text content and inside an `href` attribute — the same untyped `meetingResult.date` string discussed in CR-01, compounding that finding for `docs/portfolio.html`.

**Fix:** Apply `escapeHtml(date)` consistently, matching the pattern used elsewhere in the file (and combine with the CR-01 fix for attribute-safe escaping).

## Info

### IN-01: Unused import `markdownToHtml`

**File:** `src/scripts/generate-daily-report.ts:1`
**Issue:** `markdownToHtml` is imported but never referenced anywhere in the file:
```ts
import { escapeHtml, markdownToHtml, scoreColor, verdictColor, generateBaseStyles } from "./report-utils.js";
```
**Fix:** Remove `markdownToHtml` from the import list.

### IN-02: Duplicate marker constant

**File:** `src/scripts/update-index.ts:8-10`
**Issue:**
```ts
const START_MARKER = "<!-- REPORT_ENTRIES -->";
const END_MARKER = "<!-- /REPORT_ENTRIES -->";
const MARKER = "<!-- REPORT_ENTRIES -->";
```
`MARKER` is a redundant duplicate of `START_MARKER` (used only in `updatePortfolioHtml`). If the marker string is ever changed in one place, the other silently drifts and breaks the corresponding update function.
**Fix:** Delete `MARKER` and reuse `START_MARKER` in `updatePortfolioHtml`.

### IN-03: Holding symbols interpolated without escaping

**File:** `src/scripts/update-index.ts:163-165`
**Issue:**
```ts
function buildHoldingSpans(): string {
  return PORTFOLIO_HOLDINGS.map((h) => `        <span>${h.symbol}</span>`).join("\n");
}
```
Unlike the rest of the file, `h.symbol` is not passed through `escapeHtml`. Low risk today since `PORTFOLIO_HOLDINGS` is static, source-controlled data, but it's an inconsistent pattern relative to the rest of the module and would become a real gap if holdings are ever sourced dynamically.
**Fix:** Wrap with `escapeHtml(h.symbol)` for consistency and defense-in-depth.

---

_Reviewed: 2026-07-01T03:01:53Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

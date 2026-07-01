---
phase: 14-report-ui
fixed_at: 2026-07-01T05:51:23Z
review_path: .planning/phases/14-report-ui/14-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 8
skipped: 0
status: all_fixed
---

# Phase 14: Code Review Fix Report

**Fixed at:** 2026-07-01T05:51:23Z
**Source review:** .planning/phases/14-report-ui/14-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 8 (1 Critical, 7 Warning)
- Fixed: 8
- Skipped: 0

## Fixed Issues

### CR-01: Incomplete HTML escaping enables attribute-breakout injection into the public index page

**Files modified:** `src/scripts/report-utils.ts`, `src/meeting/schemas.ts`
**Commit:** 66adcce
**Applied fix:** Extended `escapeHtml()` to also escape `"` (`&quot;`) and `'` (`&#39;`), matching the reviewer's minimum fix. Added defense-in-depth by constraining `meetingResultSchema.date` to `z.string().regex(/^\d{4}-\d{2}-\d{2}$/)` so a malicious/malformed date can never reach the attribute-interpolation sites in the first place. Verified test fixtures across the repo only ever use `YYYY-MM-DD` dates for this field, so the stricter schema introduces no regressions.

### WR-01: Markdown table separator row leaks into rendered output

**Files modified:** `src/scripts/report-utils.ts`
**Commit:** 4a0370b
**Applied fix:** Reordered the separator-stripping regex to run *before* the row-to-`<tr>` conversion regex, as suggested. Additionally changed the separator regex to also consume its trailing newline (`/^\|[-| ]+\|\n?/gm`) — a plain reorder without this left a blank line behind, which caused the table-wrapping regex to split the header/data rows into two separate `<table>` elements instead of one. Verified against the reviewer's exact repro string, which now yields a single `<table>` with no garbage row.

### WR-02: `markdownToHtml` produces unbalanced `<p>` tags when a block element isn't followed by a blank line

**Files modified:** `src/scripts/report-utils.ts`
**Commit:** 2c52ab0
**Applied fix:** Inserted a normalization pass before the paragraph-wrapping step that turns the gap after any block-level closing tag (`</h1-4>`, `</ul>`, `</table>`, `<hr>`) into a full blank line whenever it is followed by non-blank content — handling both the "single newline" case (headings) and the "zero newline" case (tables/lists, whose trailing newline is already consumed by their own wrapping regex). Verified against the exact analyst-round prompt fixture from `generate-report.test.ts` plus additional edge cases (table/list/hr each followed by body text, blocks at end of string, pre-existing blank-line-separated blocks) — all produce balanced `<p>`/`</p>` counts.

### WR-03: Naive italic regex corrupts literal asterisks (e.g. multiplication)

**Files modified:** `src/scripts/report-utils.ts`
**Commit:** e9eac9d
**Applied fix:** Replaced `/\*(.+?)\*/g` with the reviewer-suggested `/(?<!\*)\*([^\s*][^*]*?)\*(?!\*)/g`, which requires italic content to be non-whitespace-bounded and not adjacent to another `*` (avoiding collision with already-consumed `**bold**` markers). Verified the reviewer's repro string ("3 * 4 * 5 ... 2 * 3") is now left untouched while `*italic*` and `**bold**` still render correctly, including mixed usage in the same string.

### WR-04: Agent-score table columns are positional, not keyed — can misalign across rows

**Files modified:** `src/scripts/generate-daily-report.ts`
**Commit:** a117c4b
**Applied fix:** Built the header from the union of all `agentRole` values seen across `highlightedStocks` (first-seen order), and changed each row's cell rendering to look up that stock's score by `agentRole` via `.find()`, falling back to an empty (`—`) cell when a given agent didn't score that particular stock, instead of assuming positional alignment. Verified with a synthetic two-stock fixture where the stocks have different agent sets/ordering — the resulting table now correctly aligns each score under its actual agent column with the fallback cell rendered where data is absent.

### WR-05: `generateHtml()` silently drops market chart data (dead/inconsistent duplicate of `generateDailyReportHtml`)

**Files modified:** `src/scripts/generate-report.ts`
**Commit:** fc68087
**Applied fix:** Chose the "thread `marketData` through" option from the reviewer's two suggested fixes (rather than deleting `generateHtml` and its tests) to minimize test churn. Added an optional 4th `marketData` parameter defaulting to `{ sectors: [], vixHistory: [] }` (the same empty shape `generateHtml` always produced before), and now forwards it to `generateDailyReportHtml`. Existing 3-arg test callers are unaffected; future callers can now pass real chart data instead of being silently locked out of it.

### WR-06: Missing script entrypoint guard causes uncontrolled background execution on import

**Files modified:** `src/scripts/update-index.ts`, `src/scripts/generate-report.ts`
**Commit:** d03181f
**Applied fix:** Applied the reviewer's suggested guard in both files: imported `fileURLToPath` from `node:url` and wrapped the top-level `main().catch(...)` call in `if (process.argv[1] === fileURLToPath(import.meta.url)) { ... }`, preserving each file's original error-handling behavior when run as an entrypoint. Verified by re-running `generate-report.test.ts` and `update-index.test.ts` — the previously observed spurious "Fatal error: Error: ENOENT" / "update-index failed: Error: ENOENT" console noise (triggered merely by importing the module for its exported helpers) is now gone; all 40 tests across both files still pass.

### WR-07: Inconsistent escaping — `buildPortfolioEntry` does not escape `date`

**Files modified:** `src/scripts/update-index.ts`
**Commit:** 2215b8e
**Applied fix:** Wrapped both interpolations of `date` in `buildPortfolioEntry` (text content and the `href` attribute) with `escapeHtml(date)`, matching the pattern already used by `renderEntryItem`, `renderHero`, and `renderEntryLinks` elsewhere in the same file. Verified with an injection-payload string (`"><script>alert(1)</script>`) that `escapeHtml` neutralizes it, and confirmed the existing `update-index.test.ts` suite (5 tests) still passes.

## Skipped Issues

None — all 8 in-scope findings were fixed.

## Verification

- `npx tsc --noEmit -p tsconfig.json`: no new errors in any modified file (pre-existing, unrelated errors in other files were present before these fixes and are out of scope).
- `npm test` (`vitest run`): all 141 tests pass across all 9 test files after all 8 fixes were applied, confirming no regressions.
- IN-01, IN-02, IN-03 (Info-tier findings) were intentionally left untouched — `fix_scope` for this run was `critical_warning`, which excludes Info findings.

---

_Fixed: 2026-07-01T05:51:23Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_

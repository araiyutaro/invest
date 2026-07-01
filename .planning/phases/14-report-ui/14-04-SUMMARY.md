---
phase: 14-report-ui
plan: 04
subsystem: ui
tags: [static-html, svg-free, ts-template-literals, index-html, accordion]

# Dependency graph
requires: []
provides:
  - "updateIndexHtml() rewritten from append-only marker insert into a parse+merge+group+render pipeline"
  - "src/scripts/update-index.test.ts unit coverage for month-grouping, open-attribute, link preservation, hero, determinism"
  - "docs/index.html hero + month-accordion CSS (.hero, .month-group, .chart-empty) and @media (max-width: 768px) responsive block"
  - "docs/index.html <ul class=\"report-list\"> wrapper moved inside the REPORT_ENTRIES marker region so future regeneration replaces it cleanly"
affects: [14-05, verify-work-14]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Parse-regroup-regenerate: re-parse own previously generated HTML back into structured ReportEntry[] instead of append-only string insert"
    - "Pure render functions (renderHero/renderAccordion) matching existing formatXxxHtml convention, escapeHtml on every interpolated value"

key-files:
  created:
    - src/scripts/update-index.test.ts
    - .planning/phases/14-report-ui/deferred-items.md
  modified:
    - src/scripts/update-index.ts
    - docs/index.html

key-decisions:
  - "Sourced entries by re-parsing existing docs/index.html <li> blocks (D-04-A from planner), not readdir(docs/) — self-contained, unit-testable via readFile mock, idempotent"
  - "Hero entry is additive: the newest entry appears both in the hero block AND inside its month's accordion (not removed from the group)"
  - "Moved the static <ul class=\"report-list\"> wrapper to live inside the REPORT_ENTRIES marker region (previously it wrapped the region) — otherwise the next production run would nest <div class=\"hero\">/<details> directly inside a <ul>, which is invalid HTML"

patterns-established:
  - "Pattern 2 reference implementation (RESEARCH.md) adopted near-verbatim: parseExistingEntries / groupByMonth / renderAccordion, extended with mergeEntry (new-date-wins) and renderHero"

requirements-completed: [UI-01]

# Metrics
duration: 20min
completed: 2026-07-01
---

# Phase 14 Plan 04: Month-Grouped Accordion Regeneration Summary

**Rewrote `updateIndexHtml()` from an append-only `<li>` marker-insert into a deterministic parse+merge+group+render pipeline producing a hero section plus month-grouped `<details>` accordions, and added the matching hero/accordion/responsive CSS to `docs/index.html`.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-07-01T02:39:06Z
- **Tasks:** 2/2 completed
- **Files modified:** 3 (1 new test file, 1 rewritten script, 1 edited static HTML file) + 1 deferred-items log

## Accomplishments
- `updateIndexHtml()` now parses all existing `<li class="report-item">` blocks out of the region between `<!-- REPORT_ENTRIES -->` / `<!-- /REPORT_ENTRIES -->`, preserving each entry's actual link set (2-link entries stay 2-link, no fabricated Portfolio Report link)
- New date is merged in (new-date-wins on duplicate), entries are grouped by `YYYY-MM`, sorted descending; the newest entry renders as a `class="hero"` Display-typography block and each month renders as a `<details class="month-group">` with the newest month `open` by default
- Single `readFile` + single `writeFile` per call (no partial/streaming writes), verified deterministic via a same-input-twice test
- `docs/index.html` gained `.hero`, `.month-group` (+ `[open]`/`summary`/panel), `.chart-empty`, and an `@media (max-width: 768px)` block, while preserving the existing `#0f0f1a`/`#3b82f6` theme tokens and `.report-item`/`.report-date`/`.report-links` vocabulary
- Fixed a latent HTML-validity bug: the static `<ul class="report-list">` previously wrapped the entire marker region; moved it to live *inside* the region so the next production regeneration (which emits `<div class="hero">` + `<details>` blocks, not bare `<li>`s) replaces the whole list cleanly instead of nesting block elements inside a `<ul>`

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite updateIndexHtml into parse + month-group + hero + accordion** - `bbb622f` (feat)
2. **Task 2: Add hero/accordion + responsive CSS and region markers to docs/index.html** - `307a6d8` (feat)

**Plan metadata:** (this commit, staged with SUMMARY.md)

## Files Created/Modified
- `src/scripts/update-index.ts` - Rewritten: `parseExistingEntries`, `mergeEntry`, `groupByMonth`, `renderHero`, `renderAccordion`, `buildRegion`, and the rewritten `updateIndexHtml`; `updatePortfolioHtml` left unchanged (out of scope, D-01/D-02 apply to index.html only per RESEARCH Assumption A3)
- `src/scripts/update-index.test.ts` - New: 5 unit tests (month-grouping/open-attribute, 2-link preservation, hero content, determinism, region-boundary preservation) using the existing `vi.mock("node:fs/promises", ...)` pattern from `generate-report.test.ts`
- `docs/index.html` - Added hero/accordion/responsive CSS; moved `<ul class="report-list">` inside the `REPORT_ENTRIES` region; closing `<!-- /REPORT_ENTRIES -->` marker was already present in this file (RESEARCH.md's claim that no closing marker existed was stale by the time this plan executed — verified directly)

## Decisions Made
- Reused `escapeHtml` from `report-utils.ts` (imported into `update-index.ts`) rather than duplicating it, per RESEARCH.md's "Don't Hand-Roll" guidance
- Applied `escapeHtml` to both `href` and `label` on every rendered link (plan's action item said "dates/labels"; hrefs are attribute-value context and get the same treatment defensively per T-14-07)
- Kept `main().catch(...)` unconditional at the bottom of `update-index.ts` exactly like the existing pattern (and like `generate-report.ts`) — no entry-point guard added, since all tests fully mock `node:fs/promises` and the harmless auto-run-on-import behavior already matches the codebase's established test convention

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Moved `<ul class="report-list">` inside the REPORT_ENTRIES marker region**
- **Found during:** Task 2 (adding CSS/markers to `docs/index.html`)
- **Issue:** The static file had `<ul class="report-list">` wrapping the entire marker region (`<ul>...<!-- REPORT_ENTRIES -->...<!-- /REPORT_ENTRIES -->...</ul>`). Task 1's new algorithm renders a `<div class="hero">` plus `<details class="month-group">` blocks as the region's replacement content — placing `<div>`/`<details>` directly inside a `<ul>` (outside any `<li>`) is invalid HTML and would corrupt the DOM the next time the production pipeline runs `updateIndexHtml()`.
- **Fix:** Moved the `<ul class="report-list">` opening tag to immediately after `<!-- REPORT_ENTRIES -->` and its closing `</ul>` to immediately before `<!-- /REPORT_ENTRIES -->`, so the wrapper is now inside the swappable region and gets cleanly replaced (along with the old flat `<li>` list) the next time the script runs. The current static snapshot remains valid HTML today; `parseExistingEntries`'s regex-based parsing is unaffected by the wrapper's exact position.
- **Files modified:** docs/index.html
- **Verification:** `grep -q "/REPORT_ENTRIES" docs/index.html` still passes; manual read-back confirms `<!-- REPORT_ENTRIES -->` → `<ul>` → entries → `</ul>` → `<!-- /REPORT_ENTRIES -->` ordering; `update-index.test.ts` (which builds its own fixture, independent of this file) still passes 5/5.
- **Committed in:** `307a6d8` (Task 2 commit)

**2. [Scope boundary - deferred, not fixed] Pre-existing unrelated test failure**
- **Found during:** Full-suite run (`npx vitest run`) after Task 1
- **Issue:** `src/scripts/validate-meeting.test.ts` → `portfolioAnalysisSchema > decision must be one of 保持/買増/一部売却/全売却` fails (`expect(...).toThrow()` does not throw). Confirmed pre-existing and unrelated via `git status --short` (no local changes to `validate-meeting.ts` or its test).
- **Fix:** Not fixed — outside the scope boundary of this plan (SCOPE BOUNDARY rule: only auto-fix issues directly caused by the current task's changes). Logged to `.planning/phases/14-report-ui/deferred-items.md`.
- **Files modified:** `.planning/phases/14-report-ui/deferred-items.md` (log only)

---

**Total deviations:** 1 auto-fixed (Rule 1 — HTML structure bug), 1 deferred (out-of-scope pre-existing test failure)
**Impact on plan:** The Rule 1 fix is necessary for D-01/D-02 to hold once the pipeline next regenerates `docs/index.html`; no scope creep beyond the plan's two designated files. The deferred item does not affect this plan's deliverables.

## Issues Encountered
- RESEARCH.md's Interface note claimed "NO closing marker exists yet" for `docs/index.html`, but the file already had `<!-- /REPORT_ENTRIES -->` at execution time (likely added by a later, out-of-band commit after research was run). Verified directly via Read before editing; Task 2's closing-marker acceptance criterion was already satisfied, so no marker insertion was needed — only the `<ul>` repositioning fix above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `updateIndexHtml()` and its test suite are ready; the actual visual hero+accordion regeneration of `docs/index.html`'s live entries will occur automatically the next time the production pipeline (`invest` skill → `update-index.ts`) runs with a new date — this plan intentionally did not force a manual regeneration of the ~90 existing entries, consistent with this codebase's batch-generated-static-site architecture (RESEARCH.md).
- `updatePortfolioHtml()` / `docs/portfolio.html` are unchanged and out of scope for this plan (D-09 responsive-only, handled elsewhere per phase scope).
- No blockers for Plan 05 (chart/report generator work) or `/gsd-verify-work 14`.

---
*Phase: 14-report-ui*
*Completed: 2026-07-01*

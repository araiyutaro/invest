---
phase: 24-digest-meeting-cross-reference
plan: 02
subsystem: reporting
tags: [static-html-renderer, css, xss-escaping, news-digest, meeting-crossref]

# Dependency graph
requires:
  - phase: 24-01
    provides: "buildDigestCrossRefMap / DigestCrossRef / DigestCrossRefMap / DigestTickerMatch / DigestThemeMatch (src/meeting/digest-crossref.ts)"
provides:
  - "generateNewsDigestHtml(curation, date, crossRefMap?) — additive 3rd param, byte-identical when omitted"
  - "formatDigestCrossRefChipsHtml — chip row renderer reused by formatArticleCardHtml"
  - ".digest-crossref-chip / .digest-crossref-row CSS in generateBaseStyles"
affects: [24-03, news-digest-pipeline-integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Additive optional-parameter extension of an existing pure HTML-string renderer, with a byte-identical-empty-case regression test as an explicit contract"
    - "Chip HTML built as escapeHtml-wrapped dynamic values interpolated into static prefix strings, mirroring existing formatTickerPillsHtml convention"

key-files:
  created: []
  modified:
    - src/scripts/generate-news-digest.ts
    - src/scripts/report-utils.ts
    - src/scripts/generate-news-digest.test.ts

key-decisions:
  - "Chip-absence test asserts on the class=\"digest-crossref-row\" attribute string, not the bare class-name substring, because generateBaseStyles emits the .digest-crossref-row CSS selector on every page regardless of whether any article has an annotation"
  - "formatDigestCrossRefChipsHtml returns a literal empty string (not whitespace/empty tag) for both the undefined case and the defensive empty-tickerMatches/empty-themeMatches case, guaranteeing byte-identical output for unmatched articles"

patterns-established:
  - "Renderer functions extended with trailing optional params (never required params) to preserve backward-compatible call sites and enable additive regression testing"

requirements-completed: [XREP-01]

# Metrics
duration: 25min
completed: 2026-07-04
---

# Phase 24 Plan 02: Digest Cross-Reference Chip Renderer Summary

**Extended `generate-news-digest.ts` with an additive optional `crossRefMap` parameter that renders passive "🗣 ミーティング言及" / "🗣 関連テーマ" chips below `.news-meta`, reusing existing `.ticker-pill` tokens plus a distinct `#a78bfa` meeting-accent border, with a byte-identical regression test guaranteeing zero-match articles are unaffected.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-07-04T01:51:16Z (approx, first Read call)
- **Completed:** 2026-07-04T01:54:10Z
- **Tasks:** 2 (RED, GREEN)
- **Files modified:** 3

## Accomplishments
- `generateNewsDigestHtml` / `formatMarketGroupsHtml` / `formatArticleCardHtml` all extended with trailing optional `crossRefMap`/`annotation` params — every existing call site and existing test continues to pass unmodified
- New `formatDigestCrossRefChipsHtml` renders 0-3 chips (ticker matches first, then theme match) between `.news-meta` and the commentary paragraph, exactly per UI-SPEC Component Contract
- All dynamic chip values (symbol, verdict, keyword) pass through `escapeHtml`; verdict substring color comes from the existing `verdictColor()` (no reimplementation)
- New `.digest-crossref-chip` / `.digest-crossref-row` CSS added to `generateBaseStyles`, reusing `#2a2a3e`/`#c4b5fd` verbatim and introducing zero new hex values (only the already-existing `#a78bfa` accent-light token, applied as a border to visually distinguish from `.ticker-pill`)
- Byte-identical empty case verified by dedicated regression tests: 3rd-arg omitted, and 3rd-arg present but mapping to `{tickerMatches:[], themeMatches:[]}`

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend renderer tests — annotated render, escaping, byte-identical empty case (RED)** - `18b0c09` (test)
2. **Task 2: Implement chip renderer + CSS to pass (GREEN)** - `82f8832` (feat)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified
- `src/scripts/generate-news-digest.ts` - Added `formatDigestCrossRefChipsHtml`, threaded optional `crossRefMap`/`annotation` params through the render pipeline
- `src/scripts/report-utils.ts` - Added `.digest-crossref-chip` / `.digest-crossref-row` CSS rules adjacent to `.ticker-pill`
- `src/scripts/generate-news-digest.test.ts` - Added crossref fixtures + `describe("crossref annotations (XREP-01, D-08/D-09/D-12)")` block (7 new test cases)

## Decisions Made
- The byte-identical-absence assertion had to check for the HTML attribute `class="digest-crossref-row"` rather than the bare string `digest-crossref-row`, because the new CSS selector of the same name is now permanently present in every page's `<style>` block (via `generateBaseStyles`). This was caught and fixed during the GREEN phase (Task 2) before finalizing — not a deviation from plan intent, just a test-precision correction consistent with the plan's own "byte-identical" requirement (which is about the rendered card markup, not the shared stylesheet).

## Deviations from Plan

None - plan executed as written. The one test-assertion refinement described above was corrective work within Task 2's own GREEN iteration (fixing a self-authored test bug before it was ever committed as passing), not a deviation from the plan's design or scope.

## Issues Encountered
- Initial RED-phase test run showed the byte-identical assertions passing on the FIRST run for both the "no 3rd arg" and "empty-map-key" cases even before implementation — this was expected per the plan (these two contracts don't require new code, only the escaping/chip-rendering assertions genuinely need GREEN work). After implementing the CSS in Task 2, the same two byte-identical assertions started failing because the new `.digest-crossref-row` CSS selector always appears in the stylesheet; fixed by scoping the assertion to the `class="..."` attribute string as described above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `generateNewsDigestHtml`'s optional 3rd param is ready for the pipeline-integration plan (24-03) to call `buildDigestCrossRefMap` (from 24-01) and pass its result through
- Full test suite (304 tests, 18 files) green; `npx vitest run src/scripts/generate-news-digest.test.ts` green (21/21)
- No blockers for 24-03

---
*Phase: 24-digest-meeting-cross-reference*
*Completed: 2026-07-04*

## Self-Check: PASSED

All created/modified files verified present on disk; commits `18b0c09` and `82f8832` verified present in git log.

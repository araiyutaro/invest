---
phase: 24-digest-meeting-cross-reference
plan: 01
subsystem: news-digest
tags: [typescript, vitest, tdd, deterministic-matching, digest-crossref]

# Dependency graph
requires:
  - phase: 19-holding-news-supply
    provides: "normalizeHoldingSymbol (src/portfolio/holding-news.ts) — reused for ticker normalization"
provides:
  - "src/meeting/digest-crossref.ts — pure buildDigestCrossRefMap(curation, meetingResult) matcher"
  - "DigestCrossRef / DigestCrossRefMap / DigestTickerMatch / DigestThemeMatch contract exported for Plan 02 (renderer) and Plan 03 (pipeline)"
affects: [24-02, 24-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Ticker-priority matching with early-continue (ported from holding-news.ts:149-165)"
    - "Theme-keyword fallback restricted to article title only, matching filter.ts's title-only denylist pattern"
    - "Parenthetical-ticker strip transform for sectorRecommendations[].sector before keyword matching"

key-files:
  created:
    - src/meeting/digest-crossref.ts
    - src/meeting/digest-crossref.test.ts
  modified: []

key-decisions:
  - "Reused normalizeHoldingSymbol from holding-news.ts verbatim (D-15) instead of reimplementing trim+toUpperCase"
  - "Stripped trailing ' (TICKER)' parenthetical from sector strings via /\\s*\\([^)]*\\)\\s*$/ before title matching (Pitfall 1 / Assumption A3), filtering out any resulting empty keyword"
  - "No calculatePriorityScore / recency scoring imported — cap uses stable filter+slice preserving original array order (D-10, Pitfall 4 avoidance)"

patterns-established:
  - "Digest-domain cross-reference matcher mirrors holding-news.ts design 1:1, differing only in iteration direction (per-article scan vs per-holding scan) since the join key is article ID not holding symbol"

requirements-completed: [XREP-01]

# Metrics
duration: 8min
completed: 2026-07-04
---

# Phase 24 Plan 01: Digest-Meeting Cross-Reference Matcher Summary

**Deterministic ticker-priority + theme-keyword matcher (`buildDigestCrossRefMap`) that maps each digest article to its meeting-discussion cross-reference, ported from `holding-news.ts`'s tested design.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-04T01:40:00Z
- **Completed:** 2026-07-04T01:48:18Z
- **Tasks:** 2 (TDD RED + GREEN)
- **Files modified:** 2 created

## Accomplishments
- Defined the `DigestCrossRef` contract (`DigestTickerMatch`, `DigestThemeMatch`, `DigestCrossRefMap`) that Plan 02 (renderer) and Plan 03 (pipeline) will consume as an additive optional parameter
- Implemented `buildDigestCrossRefMap`: ticker match first (highlightedStocks verdict lookup + scoredTickers fallback without verdict), early-continue on ticker match (D-04), theme-keyword fallback against title only with real `"Name (TICKER)"` sector-string parenthetical stripping (Pitfall 1)
- Full unit test suite (11 tests) covering ticker match, scoredTickers-only (no verdict), realistic JP ticker (`6326.T`) normalization, theme match with case-insensitivity, empty-after-strip keyword guard, priority early-continue, cap behavior (max 2 ticker / max 1 theme, stable order), and fail-soft empty-array handling
- Verified zero regressions across the full existing suite (297 tests / 18 files green)

## Task Commits

Each task was committed atomically (TDD RED -> GREEN):

1. **Task 1: Define DigestCrossRef contract and write failing matcher tests (RED)** - `35ca9c7` (test)
2. **Task 2: Implement buildDigestCrossRefMap matcher to pass (GREEN)** - `fd8af4f` (feat)

_TDD gate sequence confirmed: test(...) commit before feat(...) commit; no refactor commit needed (implementation was already clean on first GREEN pass)._

## Files Created/Modified
- `src/meeting/digest-crossref.ts` - Pure matcher module: `buildDigestCrossRefMap`, `DigestCrossRef`/`DigestTickerMatch`/`DigestThemeMatch`/`DigestCrossRefMap` contract, private `titleIncludesAny`/`extractThemeKeyword` helpers
- `src/meeting/digest-crossref.test.ts` - 11 unit tests across 5 describe blocks (ticker match, theme match, priority, cap, fail-soft), with factory helpers `makeCuratedArticle`/`makeCuration`/`makeMeetingResult`

## Decisions Made
- Reused `normalizeHoldingSymbol` from `src/portfolio/holding-news.ts` via direct import rather than duplicating trim+toUpperCase logic (D-15 mandate)
- Chose the regex `/\s*\([^)]*\)\s*$/` to strip the trailing parenthetical ETF ticker from `sectorRecommendations[].sector` (e.g. `"Healthcare (XLV)"` -> `"Healthcare"`), filtering any resulting empty string so a bare `"(XLV)"` sector can never match every title
- Did not import `calculatePriorityScore` or anything from `src/data/news/filter.ts` — D-10's cap requirement is stable-order `.filter().slice()`, no recency scoring needed (avoids Pitfall 4)

## Deviations from Plan

None - plan executed exactly as written. Both tasks (RED, GREEN) completed on the first attempt with no additional fix iterations.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. Pure in-repo TypeScript module, zero new dependencies.

## Next Phase Readiness

- `src/meeting/digest-crossref.ts` exports the full `DigestCrossRef`/`DigestCrossRefMap` contract Plan 02 (renderer) needs to add as an additive optional 3rd parameter to `generateNewsDigestHtml`/2nd parameter to `formatArticleCardHtml`
- Plan 03 (pipeline integration) can import `buildDigestCrossRefMap` directly and wrap it in the isolated try/catch specified by D-13/Pitfall 2
- No blockers. Full test suite green (297/297), no regressions in sibling suites.

---
*Phase: 24-digest-meeting-cross-reference*
*Completed: 2026-07-04*

## Self-Check: PASSED

- FOUND: src/meeting/digest-crossref.ts
- FOUND: src/meeting/digest-crossref.test.ts
- FOUND: .planning/phases/24-digest-meeting-cross-reference/24-01-SUMMARY.md
- FOUND: commit 35ca9c7 (test - RED)
- FOUND: commit fd8af4f (feat - GREEN)

---
phase: 16-report-generator-html-rendering
plan: 02
subsystem: reporting
tags: [vitest, typescript, html-rendering, news-curation, xss-prevention]

# Dependency graph
requires:
  - phase: 15-curation-contract-schema
    provides: "CuratedArticle/NewsCuration types, resolveNewsCuration id-reference resolution pipeline"
  - phase: 16-report-generator-html-rendering
    plan: 01
    provides: "CuratedArticle.tickerNames? contract field, ACCENT_VARIANTS purple (#8b5cf6) entry"
provides:
  - "generateNewsDigestHtml(curation: NewsCuration | null, date: string): string pure renderer"
  - "3-way fallback pattern (null / empty articles / normal) as a reusable precedent for future report renderers"
affects: [17-pipeline-integration-orchestration, generate-report.ts wiring for news-digest.html output]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "3-way fallback branching (null vs empty-array vs normal) extending the existing 2-way null-check pattern from generate-portfolio-report.ts, to preserve the semantic distinction between 'agent failed' and 'agent succeeded with zero picks'"
    - "safeHref() scheme allowlist (http/https only) as defense-in-depth on top of upstream id-reference URL resolution, for the codebase's first LLM-adjacent <a href target=_blank> rendering"
    - "single-source importance->sort-key/badge-color derivation (IMPORTANCE_ORDER + importanceColor) to guarantee badge and sort order never diverge"

key-files:
  created:
    - src/scripts/generate-news-digest.ts
    - src/scripts/generate-news-digest.test.ts
  modified: []

key-decisions:
  - "Test fixture's leadIn text was changed from a string containing the substring '米国株' to one without it, because the CURA-09 ordering assertion (leadIn index < market-heading index) produced a false positive: indexOf('米国株') matched inside the leadIn paragraph itself before ever reaching the actual <h2>米国株</h2> section heading"
  - "Added a defense-in-depth safeHref() URL-scheme test (javascript: rejection, T-16-02-03) beyond the plan's minimum 5-case behavior list, since the threat model explicitly marks this mitigation as required and it is cheap to verify"

requirements-completed: [CURA-03, CURA-04, CURA-06, CURA-07, CURA-08, CURA-09, UI-03]

# Metrics
duration: ~5min
completed: 2026-07-02
---

# Phase 16 Plan 02: News Digest HTML Renderer Summary

**Implemented `generateNewsDigestHtml(curation, date)` -- a pure TDD-built renderer that turns the Phase 15 `NewsCuration | null` contract into a market-grouped, importance-sorted, dark-themed HTML page mirroring the existing 3-report visual identity, with a 3-way null/empty/normal fallback and XSS/tabnabbing-hardened article links.**

## Performance

- **Duration:** ~5 min (8cf2888 at 15:42:47 -> 01fd919 at 15:43:52 JST)
- **Tasks:** 1 (single TDD feature, RED -> GREEN, no REFACTOR needed)
- **Files created:** 2

## Accomplishments

- `generateNewsDigestHtml(curation: NewsCuration | null, date: string): string` implemented as a pure function with zero I/O, mirroring the `generate-portfolio-report.ts` structure (styles -> timestamp -> fallback branches -> section formatters -> shell)
- 3-way fallback branching distinguishes `curation === null` ("本日のニュースキュレーションは生成できませんでした", D-12) from `curation.articles.length === 0` ("本日は厳選記事なし", D-06) -- preserving the operational signal of "agent crashed" vs "agent ran and picked nothing"
- Fixed-order market grouping (米国株 -> 日本株 -> グローバル, D-05) via `MARKET_ORDER`, with empty groups always rendering their heading + "本日の該当記事なし" (D-06)
- Stable per-group importance sort (`sortByImportance`, high->medium->low, D-07) using native `Array.prototype.sort`
- Badge color/label (`importanceBadgeHtml`/`importanceColor`) and sort key (`IMPORTANCE_ORDER`) both derive from `CuratedArticle["importance"]` as the single source, guaranteeing CURA-07's "badge and order share the same source" requirement
- Article cards follow the D-03 three-line layout: badge+escaped headline link, then source/JST-time/ticker-pills meta row, then commentary
- Headline links: `escapeHtml()` applied to href/title (including the href attribute itself, Pitfall 3), `target="_blank" rel="noopener noreferrer"` always paired (Pitfall 4/T-16-02-02), and `safeHref()` rejects any non-http(s) scheme by falling back to a plain-text (non-linked) headline (T-16-02-03)
- Ticker pills show `"SYMBOL 会社名"` when `tickerNames[symbol]` is present, falling back to the bare symbol otherwise (D-04/D-09)
- `formatPublishedAtJst()` derives JST absolute time strictly from the `publishedAt` ISO string (`new Date(iso).toLocaleString(...)`), with zero `Date.now()` calls anywhere in the file (D-02, archive-integrity)
- Reused `generateBaseStyles("#8b5cf6")` (Plan 01's purple accent) and `escapeHtml()` from `report-utils.ts` -- no new CSS, no new escaping logic
- Page title follows D-13: `<title>` stays English ("News Digest - YYYY-MM-DD"), Japanese subtitle "AI厳選ニュースダイジェスト" appears in the visible `<h1>`. No in-page navigation added (D-11)

## Task Commits

TDD gate sequence for the single `tdd="true"` feature:

1. **RED:** `8cf2888` -- `test(16-02): add failing tests for news-digest renderer (RED)` -- 12 tests, all failing (module not found) before implementation existed
2. **GREEN:** `01fd919` -- `feat(16-02): implement news-digest HTML renderer (GREEN)` -- implementation + a one-line test-fixture fix (see Deviations), all 12 tests passing

No REFACTOR commit was needed -- the GREEN implementation matched the plan's `<implementation>` spec directly with no follow-up cleanup required.

## Files Created/Modified

- `src/scripts/generate-news-digest.ts` (148 lines) -- new renderer: `MARKET_ORDER`, `IMPORTANCE_ORDER`/`IMPORTANCE_LABELS`, `importanceColor`/`importanceBadgeHtml`, `formatPublishedAtJst`, `sortByImportance`, `formatTickerPillsHtml`, `safeHref`, `formatArticleCardHtml`, `formatMarketGroupsHtml`, `formatLeadInHtml`, `renderShell`, and the top-level exported `generateNewsDigestHtml`
- `src/scripts/generate-news-digest.test.ts` (209 lines) -- 12 tests covering CURA-03/04/06/07/08/09, UI-03, market ordering, the 0-article market group case, both null/empty fallbacks, and a `javascript:` scheme-rejection test

## Decisions Made

- The CURA-09 lead-in fixture originally read "米国株の決算シーズンが本格化し..." which accidentally embedded the exact substring used to locate the "米国株" market-section heading in the ordering assertion (`html.indexOf("米国株")`), causing `indexOf` to match inside the lead-in paragraph itself and produce a false "equal index" failure. Fixed by rewording the fixture to "決算シーズンが本格化し、ハイテク企業の動向が焦点。" -- no production code change, test-fixture-only fix.
- Added a `safeHref()` URL-scheme test (`javascript:alert(1)` rejection) beyond the plan's 5 required behavior cases, since the plan's own `<threat_model>` marks T-16-02-03 as `mitigate` and the implementation section explicitly specifies the `safeHref` guard -- verifying it costs one small fixture and keeps the mitigation from silently regressing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed test fixture producing a false-positive ordering assertion**
- **Found during:** GREEN phase, first test run after implementation (`CURA-09` test failing with `expected 3004 to be less than 3004`)
- **Issue:** The `leadIn` fixture text contained the substring "米国株", which is also the label used for the market-section heading being compared against in the same test's `indexOf` calls -- both indices resolved to the same string occurrence inside the lead-in paragraph.
- **Fix:** Reworded the fixture text to avoid embedding "米国株" while preserving its intent (a plausible Japanese lead-in sentence about the day's market driver).
- **Files modified:** `src/scripts/generate-news-digest.test.ts`
- **Verification:** `npx vitest run src/scripts/generate-news-digest.test.ts` -- all 12 tests pass.
- **Committed in:** `01fd919` (GREEN commit)

**2. [Rule 1 - Bug] Removed literal `Date.now()` substring from a code comment**
- **Found during:** GREEN phase, plan verification step (`grep -c "Date.now()" src/scripts/generate-news-digest.ts` expected to return 0)
- **Issue:** A comment explaining D-02 ("Date.now() は使わない...") literally contained the text `Date.now()`, which the plan's verification grep matches regardless of comment-vs-code context, producing a false verification failure.
- **Fix:** Reworded the comment to describe the constraint without spelling out the literal API call ("実行時刻に依存する相対時刻APIは使わない").
- **Files modified:** `src/scripts/generate-news-digest.ts`
- **Verification:** `grep -c "Date.now()" src/scripts/generate-news-digest.ts` now returns `0`; behavior unchanged (comment-only edit).
- **Committed in:** `01fd919` (GREEN commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1, both test/comment-only, zero production-logic changes)
**Impact on plan:** None on scope or behavior -- both fixes were needed purely to satisfy the plan's own verification commands as written.

## Issues Encountered

- Pre-existing, unrelated `tsc --noEmit` errors persist in `src/data/news/finnhub.ts` (map-callback parameter type mismatch) and `src/scripts/collect-data.test.ts` (implicit-any parameters), identical to those already logged in `.planning/phases/16-report-generator-html-rendering/deferred-items.md` by Plan 01. Confirmed unrelated to this plan's file scope (`generate-news-digest.ts`/`.test.ts`); not touched.

## User Setup Required

None -- no external service configuration required.

## Next Phase Readiness

- `generateNewsDigestHtml(curation, date)` is a stable, pure `(NewsCuration | null, string) => string` function ready for Phase 17's pipeline wiring (`meetingResult.date` can be passed directly as the second argument, per the RESEARCH.md Open Question 1 resolution).
- Full repo test suite (`npx vitest run` / `npm test`) passes 178/178 tests with no regressions (166 baseline from Plan 01 + 12 new).
- `npx tsc --noEmit` reports no new errors introduced by this plan's files (2 pre-existing, unrelated errors remain deferred).
- No blockers for Phase 17 (Pipeline Integration & Orchestration).

---
*Phase: 16-report-generator-html-rendering*
*Completed: 2026-07-02*

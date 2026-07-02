---
phase: 16-report-generator-html-rendering
plan: 01
subsystem: reporting
tags: [zod, typescript, vitest, news-curation, html-theme]

# Dependency graph
requires:
  - phase: 15-curation-contract-schema
    provides: "CuratedArticle/NewsCuration types, curatedArticleRawSchema, resolveNewsCuration (id-reference resolution pipeline)"
provides:
  - "CuratedArticle.tickerNames? (symbol -> company name map, additive, D-04)"
  - "curatedArticleRawSchema tickerNames field (z.record, optional, default {})"
  - "resolveNewsCuration pure passthrough of tickerNames"
  - "ACCENT_VARIANTS purple entry (#8b5cf6 / #a78bfa / #c4b5fd, D-10)"
affects: [16-report-generator-html-rendering plan 02, generate-news-digest.ts renderer]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Additive optional readonly field on existing domain interface (mirrors HoldingEvaluation.riskNote?)"
    - "zod v4 two-arg z.record(z.string(), z.string()) for symbol->name maps"

key-files:
  created: []
  modified:
    - src/meeting/types.ts
    - src/meeting/schemas.ts
    - src/meeting/schemas.test.ts
    - src/scripts/report-utils.ts
    - src/scripts/report-utils.test.ts

key-decisions:
  - "tickerNames default-fill test constructs raw JSON and runs it through validateRawNewsCuration (not the makeRawArticle literal factory), because zod's .optional().default({}) only fires during actual parse — bypassing validateRawNewsCuration with a hand-built object literal would never exercise the default"

patterns-established:
  - "Company-name map fields (symbol -> name) use z.record(z.string(), z.string()).optional().default({}) and are threaded through resolvers as pure passthrough (no merge logic) when the source pool has no equivalent data"

requirements-completed: [CURA-08, UI-03]

# Metrics
duration: ~6min
completed: 2026-07-02
---

# Phase 16 Plan 01: Contract Prerequisites (tickerNames + purple accent) Summary

**Added `CuratedArticle.tickerNames?` (symbol->company-name map) to the news-curation zod contract and a purple (#8b5cf6) accent variant to `report-utils.ts`, both additive and non-breaking, unblocking Plan 02's renderer.**

## Performance

- **Duration:** ~6 min (74ba736 at 15:30:17 -> c261e00 at 15:36:32 JST)
- **Started:** 2026-07-02T06:30:17Z
- **Completed:** 2026-07-02T06:36:32Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- `CuratedArticle` now carries an optional `tickerNames?: Readonly<Record<string, string>>` field, following the exact `HoldingEvaluation.riskNote?` convention (append-only, no change to existing `tickers: ReadonlyArray<string>` shape)
- `curatedArticleRawSchema` validates `tickerNames` as `z.record(z.string(), z.string()).optional().default({})`; `resolveNewsCuration` threads it through as a pure passthrough (no merge logic needed, pool has no company-name data)
- `ACCENT_VARIANTS` in `report-utils.ts` gained a 4th entry (`#8b5cf6`: `{ light: "#a78bfa", lighter: "#c4b5fd" }`) so `generateBaseStyles("#8b5cf6")` (D-10, to be called by Plan 02's `generate-news-digest.ts`) produces a proper graduated purple theme instead of falling back to a flat single-color accent

## Task Commits

Each task was committed atomically:

1. **Task 1: CuratedArticle.tickerNames additive contract field (type + schema + resolver)** - `e04e4a5` (feat)
2. **Task 2: ACCENT_VARIANTS purple #8b5cf6 entry (D-10)** - `c261e00` (feat)

_Note: Task 1 was tdd="true" per the plan; tests were authored alongside the implementation in the same commit (test file + type/schema changes) rather than as separate RED/GREEN commits, since the schema change itself was small and the plan did not require a strict multi-commit RED/GREEN split for this task._

## Files Created/Modified
- `src/meeting/types.ts` - Added `tickerNames?: Readonly<Record<string, string>>` to `CuratedArticle`
- `src/meeting/schemas.ts` - Added `tickerNames` field to `curatedArticleRawSchema`; added `tickerNames: item.tickerNames` passthrough in `resolveNewsCuration`'s `resolved.push`
- `src/meeting/schemas.test.ts` - Added 2 new tests (tickerNames passthrough, tickerNames default `{}`); fixed `makeRawArticle` factory default to include `tickerNames: {}` (see Deviations)
- `src/scripts/report-utils.ts` - Added `"#8b5cf6": { light: "#a78bfa", lighter: "#c4b5fd" }` to `ACCENT_VARIANTS`
- `src/scripts/report-utils.test.ts` - Added regression test asserting `generateBaseStyles("#8b5cf6")` output contains `#8b5cf6`/`#a78bfa`/`#c4b5fd`

## Decisions Made
- The "tickerNames omitted -> defaults to `{}`" test constructs a raw JSON object and calls `validateRawNewsCuration()` on it (rather than using the `makeRawArticle` literal-factory helper directly), because zod's `.optional().default({})` only fills the default during an actual `.parse()` call. A hand-built object literal that omits the key would leave `item.tickerNames` as `undefined` at runtime regardless of the TypeScript type, so the test needed to exercise the real validation pipeline to assert the documented default-fill behavior.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed `makeRawArticle` test factory type error after adding required `tickerNames` to the schema's inferred output type**
- **Found during:** Task 1 (`npx tsc --noEmit` verification step)
- **Issue:** `curatedArticleRawSchema`'s new `tickerNames: z.record(...).optional().default({})` field makes the schema's *output* type require `tickerNames: Record<string, string>` (non-optional, since zod's `.default()` removes `undefined` from the output type). The existing `makeRawArticle` test factory built its base literal without a `tickerNames` key, so `{...overrides}` spread produced a value typed `Record<string, string> | undefined`, failing to satisfy the now-required field and breaking `tsc --noEmit`.
- **Fix:** Added `tickerNames: {}` to `makeRawArticle`'s base object literal, mirroring the existing `tickers: []` default-value convention already used in that same factory.
- **Files modified:** `src/meeting/schemas.test.ts`
- **Verification:** `npx tsc --noEmit` clean for this file; `npx vitest run src/meeting/schemas.test.ts` all 19 tests pass.
- **Committed in:** `e04e4a5` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 Rule 1 bug fix)
**Impact on plan:** Necessary to keep `tsc --noEmit` clean per the task's own acceptance criteria; no scope creep, no behavior change to production code beyond what the plan specified.

## Issues Encountered
- Pre-existing, unrelated `tsc --noEmit` errors were discovered in `src/data/news/finnhub.ts` (map-callback parameter type mismatch) and `src/scripts/collect-data.test.ts` (implicit-any parameters). Both are outside this plan's file scope (`types.ts`/`schemas.ts`/`schemas.test.ts`/`report-utils.ts`/`report-utils.test.ts`) and were not introduced by this plan's diff. Logged to `.planning/phases/16-report-generator-html-rendering/deferred-items.md` per the Scope Boundary rule; left untouched.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Plan 02's renderer (`generate-news-digest.ts`) can now safely reference `a.tickerNames?.[symbol]` and call `generateBaseStyles("#8b5cf6")` — both contracts are in place and covered by regression tests.
- Full repo test suite (`npx vitest run`) passes 166/166 tests with no regressions; `npx tsc --noEmit` reports no new errors (2 pre-existing, unrelated errors deferred, see Issues Encountered).
- No blockers for Plan 02.

---
*Phase: 16-report-generator-html-rendering*
*Completed: 2026-07-02*

# Deferred Items — Phase 16

Pre-existing issues discovered during execution that are out of scope for this plan
(not caused by 16-01 changes, left untouched per Scope Boundary rule).

## Plan 16-01

- `src/data/news/finnhub.ts:43` — `npx tsc --noEmit` reports a pre-existing type error:
  `Argument of type '(item: FinnhovNewsItem, ticker?: string | undefined) => RawNewsArticle' is not assignable...`
  (parameter `ticker`/`index` type mismatch in an `Array.prototype.map` callback). Unrelated to
  Plan 16-01's file scope (`types.ts` / `schemas.ts` / `schemas.test.ts` / `report-utils.ts` /
  `report-utils.test.ts`). Confirmed pre-existing (not introduced by this plan's diff).
- `src/scripts/collect-data.test.ts:297,299,358,360` — pre-existing `TS7006` implicit-any
  parameter errors (`call`, `msg`). Unrelated to Plan 16-01's file scope. Confirmed pre-existing.

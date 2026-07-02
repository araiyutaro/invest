# Deferred Items — Phase 17

Items discovered during execution that are out of scope for the current task
(pre-existing issues in files not touched by this plan).

## Plan 17-01

- **`npx tsc --noEmit` pre-existing type errors** (unrelated to `write-news-digest.ts`):
  - `src/data/news/finnhub.ts:43` — `TS2345` argument type mismatch in a `.map()` callback (`ticker` vs `index` parameter).
  - `src/scripts/collect-data.test.ts:297,299,358,360` — `TS7006` implicit `any` on `call`/`msg` parameters.
  - Verified via `git diff 820faca8b875e77df1d9e713fe65a1237a941cc8 HEAD -- src/data/news/finnhub.ts src/scripts/collect-data.test.ts` (empty diff — files untouched by plan 17-01).
  - Not fixed per executor scope-boundary rule (only auto-fix issues directly caused by the current task's changes). `write-news-digest.ts` and `write-news-digest.test.ts` themselves have zero type errors.

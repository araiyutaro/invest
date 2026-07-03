# Deferred Items — Phase 19

Items discovered during execution that are out of scope for the current plan
(Scope Boundary rule: only auto-fix issues directly caused by the current
task's changes).

## From 19-02 execution

- **`src/data/news/finnhub.ts:43` type error** (`npx tsc --noEmit` failure:
  `toRawArticle`'s `ticker?: string` param receives `Array.prototype.map`'s
  positional `index: number` argument). This is the NEWS-04 bug tracked in
  19-CONTEXT.md and assigned to plan `19-01`. Not touched by 19-02 (files_modified
  scope: `src/portfolio/holdings.ts`, `src/portfolio/holding-news.ts`,
  `src/portfolio/holding-news.test.ts` only).
- **`src/scripts/collect-data.test.ts:297,299,358,360` implicit-any errors**
  (`Parameter 'call'/'msg' implicitly has an 'any' type`). Pre-existing,
  unrelated to holding-news extraction; last touched in commit `cfe6b3b`
  (Phase 15). Out of scope for 19-02.

Both were confirmed pre-existing via `git log` on the affected files (no
commits from this plan's work touch them) and via a scoped `tsc` grep showing
zero errors in `src/portfolio/holdings.ts` / `src/portfolio/holding-news.ts`.

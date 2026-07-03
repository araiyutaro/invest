---
phase: 19-data-foundation-holding-news-supply
plan: 01
subsystem: data
tags: [finnhub, news, ticker, vitest, tdd]

# Dependency graph
requires: []
provides:
  - "index-as-ticker汚染バグ修正済みのfetchNewsByCategory（general/merger記事のtickerは常にundefined）"
  - "NEWS-04回帰テスト（複数配列インデックスでticker undefinedを検証）"
affects: [19-02, 19-03, holding-news-extraction]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "toRawArticle呼び出しは常に明示ラップ .map((item) => toRawArticle(item)) を使う（Array.prototype.mapの暗黙indexパラメータ渡り込みを防ぐ）"

key-files:
  created: []
  modified:
    - src/data/news/finnhub.ts
    - src/data/news/finnhub.test.ts

key-decisions:
  - "fetchCompanyNewsの既存正パターン(.map((item) => toRawArticle(item, ticker)))と対称的な明示ラップ形をfetchNewsByCategoryにも適用"
  - "回帰テストは3件以上の配列(index 0,1,2)で全indexのticker undefinedを検証（index 0のみだと falsy な数値0でバグを隠すため）"

patterns-established:
  - "Array.prototype.mapへ関数を直接渡す際は多引数コールバックの位置的引数渡り込みに注意し、明示ラップで防ぐ"

requirements-completed: [NEWS-04]

# Metrics
duration: 8min
completed: 2026-07-03
---

# Phase 19 Plan 01: Finnhub index-as-ticker バグ修正 Summary

**fetchNewsByCategoryのindex-as-ticker汚染バグをTDDで修正し、general/merger記事のtickerを常にundefinedに正した**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-03T05:39:00Z
- **Completed:** 2026-07-03T05:47:19Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- `src/data/news/finnhub.ts:43` の `.map(toRawArticle)` を `.map((item) => toRawArticle(item))` に修正し、Array.prototype.mapのindex引数がtoRawArticleの`ticker?: string`パラメータに位置的に渡り込むバグを除去
- general/merger記事のtickerが複数配列インデックス位置（0,1,2）で常にundefinedになることを検証する回帰テストを追加（NEWS-04）
- company記事の既存挙動（ticker === ティッカーシンボル）は不変であることを既存テストで確認

## Task Commits

Each task was committed atomically (TDD: test → fix):

1. **Task 1 (RED): NEWS-04回帰テスト追加** - `a5c312d` (test)
2. **Task 1 (GREEN): index-as-tickerバグ修正** - `35c7012` (fix)

**Plan metadata:** (this commit, docs: complete plan)

_TDD task: RED (failing test with index 0 producing ticker=0) → GREEN (explicit wrap fixes it, all 189 suite tests green)_

## Files Created/Modified
- `src/data/news/finnhub.ts` - fetchNewsByCategoryの`.map(toRawArticle)`を`.map((item) => toRawArticle(item))`に修正（line 43）
- `src/data/news/finnhub.test.ts` - NEWS-04回帰テストを追加（3件配列・全index検証）

## Decisions Made
- 明示ラップ形（Claude's Discretionで推奨、fetchCompanyNewsの既存正パターンと対称）を採用し、リファクタ不要なほど最小の差分で修正
- REFACTORフェーズは不要と判断（1行修正のみで既にクリーン）

## Deviations from Plan

None - plan executed exactly as written.

## TDD Gate Compliance

Gate sequence verified in git log:
1. RED: `a5c312d test(19-01): add failing regression test for index-as-ticker bug (NEWS-04)` — テストは修正前に実際にfail（index 0で `expected +0 to be undefined`）
2. GREEN: `35c7012 fix(19-01): remove index-as-ticker contamination in fetchNewsByCategory` — 修正後、finnhub.test.ts全5件 + 全suite189件がgreen
3. REFACTOR: なし（1行の最小修正のため不要）

## Issues Encountered
None - straightforward one-line fix with regression test as specified in plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Plan 02/03（保有銘柄別ニュース抽出）が `article.ticker === holding.symbol` で照合する際、general/merger記事のticker汚染による誤マッチが構造的に防止された
- 既存の `schemas.ts` の `typeof source.ticker === "string"` ガードはdead-but-harmlessとして残存（本フェーズではスコープ外、削除しない）
- `npx vitest run` 全189件green、回帰なし

---
*Phase: 19-data-foundation-holding-news-supply*
*Completed: 2026-07-03*

## Self-Check: PASSED

- FOUND: src/data/news/finnhub.ts
- FOUND: src/data/news/finnhub.test.ts
- FOUND: .planning/phases/19-data-foundation-holding-news-supply/19-01-SUMMARY.md
- FOUND commit: a5c312d (test)
- FOUND commit: 35c7012 (fix)
- FOUND commit: 614ca8f (docs)

# Architecture Research

**Domain:** Investment Analysis — News Quality & Pipeline Metrics (v2.2 addendum)
**Researched:** 2026-06-26
**Confidence:** HIGH (based on direct codebase inspection)

> **Scope:** This document focuses exclusively on how v2.2 features integrate with the
> existing architecture. For the baseline v2.0 system design see the original ARCHITECTURE.md
> section above (retained below for reference).

---

## v2.2 Integration Overview

### What's Being Added

Four features, three integration points:

| Feature | Integration Point | New/Modified |
|---------|-------------------|--------------|
| Cross-source deduplication (Finnhub/Google/RSS) | New `filter.ts` module called from `collect-data.ts` | **NEW file** |
| Investment-relevance filtering | Same `filter.ts` module | **NEW file** |
| Dynamic article supply to analysts (50件固定→全量) | `collect-data.ts` (write), `invest.md` (read) | **MODIFIED** |
| Pipeline timing measurement | `collect-data.ts` (internal) + `invest.md` (overall) | **MODIFIED** |

### System Overview (v2.2 changes highlighted)

```
[collect-data.ts]
  │
  ├── Promise.all([
  │     fetchAllFinnhubNews()   →  { general[], merger[] }
  │     fetchGoogleNewsJapan()  →  RawNewsArticle[]  (sorted, max 20)
  │     fetchAllRssNews()       →  RawNewsArticle[]  (per-source deduped ← keep as-is)
  │   ])
  │
  ├── MERGE: allArticles = [...general, ...merger, ...googleNews, ...rssNews]
  │          (currently: ~160 articles, no cross-source dedup, no quality filter)
  │
  ├── *** NEW *** filterNewsArticles(allArticles)   ← src/data/news/filter.ts
  │     ├── deduplicateByUrl()      → removes exact URL duplicates across all sources
  │     ├── deduplicateByTitle()    → removes title-prefix-50 duplicates (cross-source)
  │     └── filterIrrelevant()      → drops non-investment titles (keyword denylist)
  │
  ├── write tmp/news.json          ← filtered articles only (was: raw merged array)
  └── console.log with timing      ← "160件 → dedup後120件 → filter後85件 (1,240ms)"

[invest.md — Step 2.0]
  ├── reads tmp/news.json          ← ALL filtered articles (was: 最新50件 hardcap)
  └── pipeline timing via bash     ← START_TIME before Step 1, print elapsed at each step
```

---

## New Component: `src/data/news/filter.ts`

### Responsibility

Single-responsibility module: accept a merged `RawNewsArticle[]`, return a filtered+deduplicated subset. No I/O. Pure functions. Fully testable.

### Interface

```typescript
export interface NewsFilterStats {
  readonly rawCount: number;
  readonly afterUrlDedup: number;
  readonly afterTitleDedup: number;
  readonly afterRelevanceFilter: number;
}

export interface NewsFilterResult {
  readonly articles: ReadonlyArray<RawNewsArticle>;
  readonly stats: NewsFilterStats;
}

export function filterNewsArticles(
  articles: ReadonlyArray<RawNewsArticle>
): NewsFilterResult
```

### Deduplication Algorithm

Two-pass dedup — consistent with the existing `rss-sources.ts` approach:

1. **URL-exact match** (primary key): `new Set<string>()` on `article.url`. Handles the
   most common case (same article picked up by multiple feeds).

2. **Title prefix 50-char** (fallback): `article.title.slice(0, 50)`. Handles same story
   with different URL paths (e.g., Google News redirect vs original source). Matches the
   existing in-source dedup logic in `rss-sources.ts` — no behavioral change for within-RSS,
   but now applies across Finnhub and Google News too.

> **Why not fuzzy matching?** Overkill for this use case. URL + title-prefix catches 95%+
> of duplicates without adding a library dependency. Fuzzy match can be added later if
> post-filter analysis shows remaining dupes.

### Relevance Filter

**Approach: denylist** (remove obviously non-investment content). An allowlist would be too
aggressive and risk removing legitimate articles (e.g., "スポーツ用品株" contains "スポーツ").

**Match target: title only** (not summary). Summaries may reference non-investment words
in context.

```typescript
// Rough keyword set — tune based on observed false positives/negatives
const IRRELEVANT_TITLE_KEYWORDS = [
  // Japanese non-investment topics
  '芸能', '映画', '音楽', 'グルメ', '料理', 'レシピ', '旅行', '観光',
  'ファッション', 'ゴシップ', '恋愛', 'ドラマ', 'アニメ',
  'サッカー', '野球', 'バスケ', 'テニス', 'オリンピック',
  // English non-investment topics
  'celebrity', 'fashion', 'recipe', 'travel', 'lifestyle', 'gossip',
];
```

**Note on `rss-sources.ts` categories:** All RSS sources are tagged `category: "japan_market"`,
but NHK経済 and Yahoo!ニュース 経済 occasionally surface entertainment-adjacent content.
The filter catches these without touching the fetcher code.

**Note on Finnhub categories:** `"general"` and `"merger"` are inherently investment-relevant.
The relevance filter will rarely (if ever) drop Finnhub articles. This is correct — no
Finnhub-specific bypass needed.

---

## Modified Component: `src/scripts/collect-data.ts`

### Changes Required

1. **Import `filterNewsArticles`** from `filter.ts`
2. **Call filter** after merge, before `writeFile`
3. **Write only filtered articles** to `tmp/news.json`
4. **Add per-step timing** using `Date.now()` (not `process.hrtime` — millisecond precision is sufficient)
5. **Log filter stats** in human-readable format

### Before vs After (the news block)

```typescript
// BEFORE (current)
const allArticles = [
  ...finnhubNews.general,
  ...finnhubNews.merger,
  ...googleNews,
  ...rssNews,
];
await writeFile(join(TMP_DIR, "news.json"), JSON.stringify(allArticles, null, 2), "utf-8");
console.log(`ニュース収集完了 (${allArticles.length}件)`);

// AFTER (v2.2)
const t0 = Date.now();
const allArticles = [
  ...finnhubNews.general,
  ...finnhubNews.merger,
  ...googleNews,
  ...rssNews,
];
const { articles: filteredArticles, stats } = filterNewsArticles(allArticles);
await writeFile(join(TMP_DIR, "news.json"), JSON.stringify(filteredArticles, null, 2), "utf-8");
const elapsed = Date.now() - t0;
console.log(
  `ニュース収集完了 (${stats.rawCount}件 → dedup後${stats.afterTitleDedup}件 → filter後${stats.afterRelevanceFilter}件, ${elapsed}ms)`
);
```

### Timing Scope in collect-data.ts

Track elapsed time at the section level (market data, news, portfolio). Grand total is
tracked at the `invest.md` level (see below).

---

## Modified Component: `.claude/commands/invest.md`

### Change 1 — Remove 50-article hardcap

**Current (Step 2.0):**
```
## ニュースデータ (tmp/news.json) ※最新50件
[tmp/news.json の最新50件の内容]
```

**After:**
```
## ニュースデータ (tmp/news.json) ※フィルタ済み全件
[tmp/news.json の全内容]
```

The filter ensures quality. With ~80-100 articles instead of a fixed 50, analysts receive
more signal without noise from duplicates or irrelevant content.

> **Context window concern:** Moving from 50 to ~85 articles adds roughly 35 articles of
> context per analyst. Typical article JSON is ~200 chars. Net increase: ~7,000 chars per
> analyst (~1,750 tokens). This is well within the Opus context window and acceptable.

### Change 2 — Pipeline timing via bash timestamps

Add timing capture at each major step boundary in invest.md. Bash approach (no new tools needed):

```bash
# In Step 1 (before collect-data.ts call):
PIPELINE_START=$(node -e "process.stdout.write(String(Date.now()))")

# After collect-data.ts:
STEP1_END=$(node -e "process.stdout.write(String(Date.now()))")
echo "Step 1 完了: $((STEP1_END - PIPELINE_START))ms"

# At pipeline completion (パイプライン完了):
PIPELINE_END=$(node -e "process.stdout.write(String(Date.now()))")
echo "=== パイプライン総実行時間: $((PIPELINE_END - PIPELINE_START))ms ==="
```

Alternatively, collect-data.ts outputs a timing line that the skill captures and displays.
Either approach works; the bash variable approach avoids needing to modify the TS script's
output format.

**Timing granularity to track:**
- Step 1: データ収集 (collect-data.ts)
- Step 2: アナリストミーティング (Round 1 + 2 + 3 combined, or per-round)
- Step 3: WebSearch + 再評価 + ポートフォリオ分析 + レポート生成
- Total pipeline

---

## Data Flow (v2.2)

```
User: /invest
    │
    ├─► [Step 1] npx tsx collect-data.ts                ← START_TIME recorded
    │       │
    │       ├── fetchAllFinnhubNews()    ~80 articles
    │       ├── fetchGoogleNewsJapan()   ~20 articles
    │       ├── fetchAllRssNews()        ~65 articles (per-source deduped)
    │       │         Total merged:      ~165 articles
    │       │
    │       ├── filterNewsArticles()    ← NEW
    │       │     ├── URL dedup:        ~145 articles
    │       │     ├── title dedup:      ~125 articles
    │       │     └── relevance filter: ~85 articles
    │       │
    │       └── writes tmp/news.json    ← 85 quality-filtered articles
    │                                      (was: 165 raw articles)
    │
    ├─► [Step 2.0] reads tmp/news.json  ← ALL 85 articles (was: hardcoded 50)
    │
    ├─► [Steps 2a-2f] analyst rounds    (unchanged)
    │
    ├─► [Step 3] WebSearch + reports    (unchanged)
    │
    └─► パイプライン完了: 総実行時間 XXXs  ← NEW timing summary
```

---

## Integration Points Summary

### New Module Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `filter.ts` ↔ `collect-data.ts` | Direct TypeScript import | Pure functions; no I/O in filter.ts |
| `rss-sources.ts` ↔ `filter.ts` | None (independent) | rss-sources.ts keeps its per-source dedup as a cheap first pass; filter.ts handles cross-source |
| `collect-data.ts` ↔ `invest.md` | `tmp/news.json` (filtered) | Contract unchanged; file now contains filtered articles |

### Component Classification

**NEW (create from scratch):**
- `src/data/news/filter.ts` — Pure dedup + relevance filtering. No external deps.

**MODIFIED (small changes, backward-compatible):**
- `src/scripts/collect-data.ts` — Import + call `filterNewsArticles`; add timing logs
- `.claude/commands/invest.md` — Remove 50-article cap; add timing capture at step boundaries
- `src/data/news/types.ts` — Add `NewsFilterStats` and `NewsFilterResult` interfaces

**UNCHANGED:**
- `src/data/news/finnhub.ts`
- `src/data/news/google-news.ts`
- `src/data/news/rss-sources.ts` (existing per-source dedup preserved as first pass)
- All agent files, report generator, everything else

---

## Build Order (Dependency-Aware)

```
Step 1 — New pure module (no dependencies on other new code)
  1a. Add NewsFilterStats + NewsFilterResult to src/data/news/types.ts
  1b. Create src/data/news/filter.ts
      - deduplicateByUrl()
      - deduplicateByTitle()
      - filterIrrelevant()
      - filterNewsArticles() (composes all three)
  1c. Write unit tests for filter.ts
      - test: exact URL dupe removed
      - test: title-prefix-50 dupe removed
      - test: URL from different source, same article → deduped
      - test: irrelevant keyword in title → filtered
      - test: irrelevant keyword in summary only → kept (title-only match)
      - test: valid investment article → kept
      - test: stats counts are accurate

Step 2 — Modify collect-data.ts (depends on Step 1)
  2a. Import filterNewsArticles
  2b. Apply filter after merge
  2c. Write filtered articles to tmp/news.json
  2d. Log filter stats + section timing

Step 3 — Modify invest.md (depends on Step 2 producing correct tmp/news.json)
  3a. Remove "最新50件" hardcap → pass all filtered articles
  3b. Add pipeline timing (START_TIME before Step 1, elapsed after each step)
  3c. Add timing summary at パイプライン完了

Step 4 — Validation
  4a. Run collect-data.ts standalone → verify filter stats logged, counts look right
  4b. Run full /invest pipeline → verify timing displayed, article count improved
  4c. Inspect tmp/news.json manually → verify no sports/entertainment articles
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Filtering Inside Individual Fetchers

**What:** Adding relevance filter logic to `finnhub.ts`, `google-news.ts`, `rss-sources.ts`.
**Why wrong:** Cross-source dedup requires seeing all articles at once. Splitting filter
across fetchers means no single place can compare across sources. Also harder to test.
**Do instead:** All filtering in `filter.ts`, called once in `collect-data.ts` after merge.

### Anti-Pattern 2: Removing rss-sources.ts Per-Source Dedup

**What:** Removing the existing `seen.has(key)` dedup from `rss-sources.ts` on grounds that
`filter.ts` handles all dedup.
**Why wrong:** The per-source dedup in `rss-sources.ts` is a cheap first pass that prevents
the same RSS article from being fetched from multiple URLs within the same source. It reduces
the array size before merge, which is good. It's not redundant — it's complementary.
**Do instead:** Keep `rss-sources.ts` dedup as-is; let `filter.ts` handle cross-source.

### Anti-Pattern 3: Allowlist for Relevance Filter

**What:** Only keeping articles that match investment keywords (株, 決算, earnings, etc.).
**Why wrong:** Too aggressive. Legitimate macro/risk news (地震, 台風, geopolitical events)
won't contain investment keywords but is highly relevant to the investment analysts.
**Do instead:** Denylist of clearly non-investment topics. Err on the side of including
borderline articles — the LLM analysts are good at ignoring irrelevant content.

### Anti-Pattern 4: Storing Pipeline Timing in tmp/news.json

**What:** Adding a `_meta: { timing: ... }` key to `tmp/news.json`.
**Why wrong:** Breaks the `RawNewsArticle[]` contract. Any consumer that does
`JSON.parse(newsJson) as RawNewsArticle[]` would get unexpected shape.
**Do instead:** Log timing to stdout in `collect-data.ts`. Capture and display in
`invest.md` via bash variable assignment. If persisting stats is needed later, use a
separate `tmp/news-stats.json`.

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Current (~165 raw → ~85 filtered) | Single-pass filter in memory is fine |
| More RSS sources added | Filter scales linearly; no change needed |
| Filter tuning needed | Keyword list is in `filter.ts` constants; edit without touching other files |
| Need ML-based relevance | Replace `filterIrrelevant()` internals; interface unchanged |

---

## Sources

- Direct inspection: `src/scripts/collect-data.ts`, `src/data/news/*.ts`, `.claude/commands/invest.md`
- Existing architecture: `.planning/research/ARCHITECTURE.md` (v2.0 baseline)
- Project requirements: `.planning/PROJECT.md` (v2.2 milestone)

---
*Architecture research for: Investment Agent v2.2 News Quality & Pipeline Metrics*
*Researched: 2026-06-26*

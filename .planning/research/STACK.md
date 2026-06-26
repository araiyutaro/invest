# Stack Research

**Domain:** News Quality & Pipeline Metrics (v2.2 — incremental additions to existing TypeScript investment agent)
**Researched:** 2026-06-26
**Confidence:** HIGH

## Scope

This is a **targeted addition** to the existing stack. TypeScript + tsx + yahoo-finance2 + Claude Code agents are unchanged.
Research focuses only on the 4 new capabilities in v2.2.

---

## Feature 1: Cross-Source Deduplication

### Approach: Inline implementation (no new dependency)

**Why no library:**
- Dataset is ~160 articles/day. O(n²) comparison = ~25,600 comparisons — completes in <100ms.
- Dice coefficient is ~15 lines of TypeScript. Adding a dependency for 15 lines is not justified.
- `string-similarity` (v4.0.4, last updated 2023-05-01) is stable but unmaintained. Works fine but adds package surface area unnecessarily.

**Deduplication strategy (two-pass):**

| Pass | Method | Catches |
|------|--------|---------|
| 1st: URL exact match | `Set<string>` on normalized URL | Same article syndicated across sources |
| 2nd: Title similarity | Dice coefficient ≥ 0.80 | Rephrased headlines of same story |

**Dice coefficient (inline implementation):**
```typescript
function diceCoefficient(a: string, b: string): number {
  const normalize = (s: string) =>
    s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").trim();
  const bigrams = (s: string): Set<string> => {
    const pairs = new Set<string>();
    for (let i = 0; i < s.length - 1; i++) pairs.add(s.slice(i, i + 2));
    return pairs;
  };
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 1;
  if (na.length < 2 || nb.length < 2) return 0;
  const ba = bigrams(na);
  const bb = bigrams(nb);
  let intersection = 0;
  for (const bg of ba) if (bb.has(bg)) intersection++;
  return (2 * intersection) / (ba.size + bb.size);
}
```

**Similarity threshold:** 0.80 (industry standard for news deduplication; 0.70 is too permissive for financial news where similar-sounding but distinct events exist).

**Cross-language deduplication (English↔Japanese): NOT attempted**
- Finnhub articles are English; RSS/Google News articles are Japanese
- Same news story has completely different title text in different languages
- Title similarity is ineffective across languages without embedding models
- Decision: Dedup within language groups only. English sources vs. English sources, Japanese vs. Japanese.

---

## Feature 2: Relevance Filtering

### Approach: Rule-based pure TypeScript (no new dependency)

**Why no library:**
- Keyword matching + category allowlist is pure array/regex logic
- NLP libraries (e.g., `natural`, `compromise`) add significant weight for a simple filter
- Rule-based is intentionally transparent and maintainable by humans

**Filter architecture:**

```typescript
interface FilterConfig {
  readonly categoryAllowlist: ReadonlyArray<string>;     // from Finnhub category field
  readonly titleBlockPatterns: ReadonlyArray<RegExp>;    // irrelevant topic patterns
  readonly requireKeyword?: ReadonlyArray<RegExp>;       // optional: must contain one of these
}
```

**Recommended exclusion categories (title keyword patterns):**
- Sports: `/スポーツ|野球|サッカー|バスケ|オリンピック|sports|soccer|baseball/i`
- Entertainment: `/芸能|映画|音楽|アイドル|ドラマ|celebrity|entertainment|oscars/i`
- Lifestyle/Health: `/料理|レシピ|ダイエット|美容|fashion|cooking|recipe/i`
- Crime (non-market): `/殺人|逮捕|事件|詐欺師|murder|arrest|crime(?! wave)/i`
- Natural disasters (not market-moving): `/地震速報|台風|tsunami(?! economic)/i`

**Finnhub category allowlist** (only pass these):
- `general` (already fetched - keep)
- `merger` (already fetched - keep)
- Block: crypto, forex if added in future

**Implementation location:** New file `src/data/news/filter.ts` with exported `filterNewsArticles()` function.

---

## Feature 3: Flexible Article Limits

### Approach: Configuration object (no new dependency)

**Current state:** Hardcoded `50` articles passed to analysts. The number exists in the invest skill command, not in the TypeScript data layer.

**Recommended change:** Define a typed config:
```typescript
const NEWS_DELIVERY_CONFIG = {
  maxArticlesPerAnalyst: 80,       // upper bound safety limit
  preferFilteredCount: true,       // use all filtered articles up to max
} as const;
```

The `50` limit appears to live in the skill prompt text (`.claude/commands/invest.md`). Update to use `all filtered articles (up to ${NEWS_DELIVERY_CONFIG.maxArticlesPerAnalyst})`.

**No library needed.**

---

## Feature 4: Pipeline Execution Timing

### Approach: `Date.now()` (Node.js built-in, no new dependency)

**Why `Date.now()` over `performance.now()` or `process.hrtime.bigint()`:**
- Pipeline runs take 30 seconds to 5 minutes. Millisecond precision is sufficient; nanoseconds unnecessary.
- `Date.now()` is synchronous, universally available, and requires zero imports.
- `performance.now()` requires `import { performance } from 'node:perf_hooks'` — adds complexity with no benefit at this precision.

**Implementation pattern:**
```typescript
async function main() {
  const pipelineStart = Date.now();
  
  // ... existing pipeline code ...
  
  const elapsed = Math.floor((Date.now() - pipelineStart) / 1000);
  const min = Math.floor(elapsed / 60);
  const sec = elapsed % 60;
  const timing = min > 0 ? `${min}m ${sec}s` : `${sec}s`;
  console.log(`=== パイプライン完了 (${timing}) ===`);
}
```

**Integration point:** `src/scripts/collect-data.ts` `main()` function already has the right structure. Add timing to `main()` in the invest skill's data collection step.

---

## Recommended Stack (New Additions)

### Core Technologies — No Changes

Existing stack (TypeScript, tsx, yahoo-finance2, fast-xml-parser, dotenv, zod) is **unchanged**.

### New npm Dependencies

**NONE.** All v2.2 features are implementable with:
- Native TypeScript string/array operations (deduplication, filtering)
- Node.js built-ins (`Date.now()` for timing)

### New Source Files

| File | Purpose |
|------|---------|
| `src/data/news/filter.ts` | Relevance filter + deduplication logic |
| `src/data/news/types.ts` | Add `FilteredNewsArticle` type (extends `RawNewsArticle`) |

### Modified Files

| File | Change |
|------|--------|
| `src/scripts/collect-data.ts` | Add pipeline timing, call dedup+filter after collection |
| `src/data/news/rss-sources.ts` | Remove weak 50-char title dedup (replace with proper dedup in filter.ts) |
| `.claude/commands/invest.md` | Remove hardcoded 50-article limit, use filtered count |

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Inline Dice coefficient | `string-similarity@4.0.4` | If the project already depended on it, or if comparison logic needs to be tested in isolation as a package |
| `Date.now()` | `process.hrtime.bigint()` | If nanosecond precision is needed (pipeline benchmarking, profiling tight loops) |
| Rule-based keyword filter | `natural` NLP library | If semantic classification (beyond keywords) were needed, e.g., topic modeling |
| Rule-based keyword filter | Claude AI classification | Viable but expensive — sends every article through an LLM call; overkill for simple exclusion |
| Two-pass URL+title dedup | URL-only dedup | Acceptable if RSS sources rarely carry the same story with different URLs (they often do) |

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `string-similarity` npm package | Unnecessary dependency for 15 lines of code; last updated 2023, no active development | Inline Dice coefficient function |
| `natural` / `compromise` NLP libs | 3-10MB packages for keyword matching that native regex handles | Array of `RegExp` patterns |
| `performance.now()` / `perf_hooks` | Overkill precision for pipeline-level timing | `Date.now()` |
| Cross-language (EN↔JP) deduplication | Same story has different text in different languages; requires embeddings (not in scope) | Language-group-scoped deduplication only |
| ML-based relevance scoring | Requires model, latency, infrastructure; rule-based is sufficient for exclusion | Keyword blacklist + category allowlist |
| Embedding-based semantic dedup (MinHash, LSH) | Correct approach at 10K+ articles/day; overkill for 160/day | Simple title similarity with Dice |

---

## Version Compatibility

All new code is pure TypeScript ESM (matching existing `"type": "module"` in package.json). No compatibility concerns since no new packages are added.

---

## Sources

- Existing codebase audit (`src/data/news/*.ts`, `src/scripts/collect-data.ts`) — confirmed dataset size (~160 articles/day), existing dedup weaknesses, hardcoded limits — HIGH confidence
- [npm: string-similarity](https://www.npmjs.com/package/string-similarity) v4.0.4 (Dice coefficient, last updated 2023-05-01) — confirmed TypeScript types available via `@types/string-similarity` v4.0.2 — HIGH confidence
- [npm: fastest-levenshtein](https://www.npmjs.com/package/fastest-levenshtein) v1.0.16 — confirmed available, but Levenshtein is worse than Dice for multi-word news titles (word order sensitivity) — HIGH confidence
- [Node.js perf_hooks docs](https://nodejs.org/api/perf_hooks.html) — confirmed `Date.now()` millisecond precision sufficient for pipeline timing — HIGH confidence
- [Cross-Lingual News Dedup research](https://yingjiezhao.com/en/articles/Cross-Lingual-News-Dedup-at-100-Dollar-a-Month/) — confirmed that cross-language dedup requires embeddings, not string similarity — MEDIUM confidence
- [News deduplication thresholds](https://crackingwalnuts.com/post/news-aggregator-system-design) — 0.70-0.80 threshold range validated for news title similarity — MEDIUM confidence

---
*Stack research for: v2.2 News Quality & Pipeline Metrics*
*Researched: 2026-06-26*

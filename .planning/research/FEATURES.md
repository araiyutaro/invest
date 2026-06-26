# Feature Research

**Domain:** Investment News Quality Improvement — v2.2 Milestone
**Researched:** 2026-06-26
**Confidence:** HIGH

## Context: What Already Exists

| Source | Articles/Day | Current Dedup | Time Filter |
|--------|-------------|---------------|-------------|
| Finnhub API (English) | ~60–80 | None | 24h only |
| Google News RSS (Japanese) | ~20 | None | None |
| 5 custom RSS (Japanese) | ~65 | Title prefix 50-char within-RSS only | None |
| **Total** | **~161** | **No cross-source dedup** | **Partial** |
| Analyst feed | Top 50 by recency | Hardcoded in invest.md | N/A |

Key gap: `invest.md` hardcodes `「最新50件」` in all 5 analyst prompts. No dedup or
relevance filtering happens before that cutoff, so duplicate and irrelevant articles
consume analyst context budget.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features that any serious news aggregation pipeline for investment use must have.
Missing = analysts receive noisy input, degrading recommendation quality.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Cross-source deduplication** | Same article from Finnhub + Google News + RSS wastes analyst context with redundant content | MEDIUM | Normalize title → token-set Jaccard similarity ≥0.7; no MinHash needed at 161 articles/day |
| **Non-investment article exclusion** | RSS sources (Yahoo!ニュース, NHK経済) mix in sports/politics/weather; wastes analyst tokens | LOW | Keyword blocklist + category allowlist; rule-based, no ML needed |
| **Consistent 24h time filter across all sources** | RSS sources have no recency filter today; old articles crowd out fresh news | LOW | Apply `publishedAt > Date.now() - 24h` globally, same as Finnhub |
| **Flexible article limit (not hardcoded 50)** | After dedup + filter, remaining quality article count should drive the feed size | LOW | Remove hardcoded "最新50件" from invest.md prompts; inject `filteredCount` dynamically |
| **Pipeline step timing display** | User has no visibility into where time is spent; essential for debugging slow runs | LOW | `performance.now()` or `Date.now()` timestamps at each major step; print summary at end |

### Differentiators (Competitive Advantage)

Features that improve output quality beyond baseline dedup.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Title normalization before dedup** | Raw title comparison misses "【速報】日経平均…" vs "日経平均…" (prefix noise, brackets, whitespace) | LOW | Strip `【…】`, `[…]`, leading spaces, lowercase/normalize CJK full-width chars before comparison |
| **Relevance keyword allowlist for RSS** | RSS sources include legit finance news mixed with noise; positive keyword match confirms relevance even without category signal | LOW | Keywords: 株価, 決算, 上場, 金利, 為替, 日銀, FRB, インフレ, etc. → article passes if ANY keyword present |
| **Article count floor + ceiling** | Prevent analyst starvation (too few articles after aggressive filtering) or context overflow (too many) | LOW | `max(MIN_ARTICLES, min(MAX_ARTICLES, filteredCount))`; suggest MIN=20, MAX=80 |
| **Pipeline timing per-step breakdown** | Know whether bottleneck is data collection, AI analysis, or report generation | LOW | Record marks at: collect-start, collect-end, round1-start, round1-end, etc.; display table at end |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **URL-based dedup** | URLs uniquely identify articles | Syndicated content appears at different URLs (e.g., Reuters article on Yahoo Finance + Investing.com); URL dedup misses these — the most common cross-source duplicate pattern | Title similarity dedup catches syndication; URL dedup is complementary but not primary |
| **MinHash / LSH deduplication** | Production-grade dedup used by Feedly, Google News | At 161 articles/day, MinHash overhead (hashing, band computation) adds complexity with no benefit vs simple Jaccard on tokenized titles | Token-set Jaccard similarity on normalized titles: O(n²) over 161 articles = 12,961 comparisons, negligible cost |
| **ML-based relevance scoring** | More accurate than keyword rules | Requires API call per article → latency + cost; overkill when 90% of non-relevant articles are excluded by simple rules (sports scores, weather, celebrity news) | Keyword blocklist + allowlist; review false-positive rate manually and tune rules |
| **Per-analyst article personalization** | Each analyst gets different news slice relevant to their specialty | Increases complexity of collect-data.ts → 5 separate filtered sets; out of scope for v2.2 | All analysts receive the same deduplicated, filtered feed; analyst prompts guide which news to focus on |
| **Persistent dedup state across days** | Avoid showing same slow-moving story multiple times across days | Cross-day state file management adds complexity; storage, migration, and staleness concerns | 24h time filter already handles this naturally — each day's feed is a fresh window |

---

## Feature Dependencies

```
[fetchAllFinnhubNews()]
[fetchGoogleNewsJapan()]    ──merge──> [all ~161 articles]
[fetchAllRssNews()]                        │
                                           ├──> [FEATURE: 24h time filter (all sources)]
                                           │         │
                                           │         ├──> [FEATURE: normalize titles]
                                           │         │         │
                                           │         │         └──> [FEATURE: cross-source dedup]
                                           │         │                     │
                                           │         └──────────────────> [FEATURE: relevance filter]
                                           │                                     │
                                           │                         [filtered articles N]
                                           │                                     │
                                           │                         [FEATURE: article count floor/ceiling]
                                           │                                     │
                                           v                         [feed: min(MAX, max(MIN, N)) articles]
                               [tmp/news.json]                                   │
                                                                                 v
                                                                    [invest.md: inject dynamic count]
                                                                                 │
                                                                                 v
                                                              [5 analyst agents × 3 rounds]
                                                                                 │
                                                                    [FEATURE: pipeline timing]
                                                              (spans entire collect→report flow)
```

### Dependency Notes

- **Cross-source dedup requires title normalization first:** Raw CJK titles contain brackets, spaces, and source-specific prefixes that must be stripped before similarity comparison. Normalization is a prerequisite.
- **Relevance filter should run after dedup:** Filter on the already-deduplicated set to avoid wasted comparisons on articles that will be removed anyway.
- **Article count floor/ceiling requires dedup + filter first:** The final count only makes sense after removing duplicates and irrelevant articles.
- **Dynamic article limit requires all above:** The `invest.md` command must read the filtered count (from `tmp/news.json` length or a stats file) before injecting it into analyst prompts.
- **Pipeline timing is independent:** Timing instrumentation wraps the entire pipeline; it does not depend on any news feature but is often requested alongside pipeline improvements.

---

## MVP Definition

### v2.2 Target Features (this milestone)

All 4 features are independently implementable in `collect-data.ts` and `invest.md`.

- [ ] **Cross-source dedup** — Normalize titles, compute token Jaccard ≥0.7, keep first-seen (highest recency). Implement in `collect-data.ts` after merging all sources. Expected impact: ~15–30 duplicate articles removed/day.
- [ ] **Relevance filter** — Blocklist (sports/entertainment keywords) + allowlist (financial keywords for RSS sources). Implement in `collect-data.ts` after dedup. Expected impact: ~10–20 non-investment articles removed/day from Yahoo!ニュース and NHK経済.
- [ ] **Dynamic article limit** — Remove "最新50件" hardcoding from all 5 analyst prompts in `invest.md`. Inject actual filtered article count dynamically (e.g., via `tmp/news-stats.json` or by reading `tmp/news.json` length). Keep MAX_ARTICLES=80, MIN_ARTICLES=20.
- [ ] **Pipeline timing** — Record `Date.now()` at: pipeline-start, collect-end, round1-start, round1-end, round2-end, round3-end, report-end. Display step durations and total at pipeline completion.

### Deferred (v2.3+)

- [ ] **Finnhub ticker-specific news** — Fetch news per portfolio ticker (not just general/merger categories); higher relevance but more API calls.
- [ ] **Time-of-day weighting** — Prefer news from the last 6h over 6–24h; more timely for daily market analysis.

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Cross-source deduplication | HIGH — removes redundant analyst context | MEDIUM | P1 |
| Relevance filter (keyword rules) | HIGH — removes noise from RSS sources | LOW | P1 |
| Pipeline timing display | MEDIUM — diagnostic visibility | LOW | P1 |
| Dynamic article limit | MEDIUM — avoids over/under-feeding analysts | LOW | P1 |
| Title normalization (CJK-aware) | MEDIUM — prerequisite for quality dedup | LOW | P1 (part of dedup) |
| Article count floor/ceiling | LOW — edge case guard | LOW | P2 |

---

## Implementation Notes

### Cross-Source Dedup Algorithm (recommended)

At ~161 articles/day, simple O(n²) token Jaccard is sufficient (< 1ms total):

```typescript
function normalizeTitle(title: string): string {
  return title
    .replace(/【[^】]*】/g, "")   // remove 【速報】 etc.
    .replace(/\[[^\]]*\]/g, "")   // remove [PR] etc.
    .replace(/[　\s]+/g, " ")     // normalize whitespace (includes full-width space)
    .toLowerCase()
    .trim();
}

function tokenize(title: string): Set<string> {
  // CJK: bigrams; Latin: space-split words
  // Simple approach: split on whitespace + punctuation, filter length >= 2
  return new Set(title.split(/[\s　・、。]+/).filter((t) => t.length >= 2));
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  const intersection = [...a].filter((x) => b.has(x)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : intersection / union;
}

// Usage: dedup across all ~161 articles
function crossSourceDedup(articles: RawNewsArticle[]): RawNewsArticle[] {
  const kept: RawNewsArticle[] = [];
  const keptTokens: Set<string>[] = [];
  for (const article of articles) {
    const tokens = tokenize(normalizeTitle(article.title));
    const isDuplicate = keptTokens.some((t) => jaccardSimilarity(tokens, t) >= 0.7);
    if (!isDuplicate) {
      kept.push(article);
      keptTokens.push(tokens);
    }
  }
  return kept;
}
```

### Relevance Filter (recommended keyword sets)

```typescript
// Blocklist: exclude if title contains any of these (non-financial topics)
const IRRELEVANT_KEYWORDS = [
  "スポーツ", "野球", "サッカー", "テニス", "競馬", "ゴルフ",
  "芸能", "タレント", "俳優", "歌手", "アイドル",
  "天気", "台風", "地震", "洪水",
  "レシピ", "グルメ", "旅行", "観光",
];

// Allowlist: RSS articles that DON'T match blocklist but seem borderline
// → pass if ANY of these present (confirms financial relevance)
const FINANCIAL_KEYWORDS = [
  "株", "株価", "上場", "決算", "業績", "利益", "売上",
  "金利", "為替", "円安", "円高", "ドル", "インフレ",
  "日銀", "FRB", "FOMC", "GDP", "CPI",
  "投資", "ファンド", "ETF", "債券",
  "M&A", "買収", "合併", "IPO",
  "半導体", "AI", "EV", "原油",
];
```

### Pipeline Timing Output (recommended format)

```
=== パイプライン完了 ===
  データ収集:     42s  (市場データ + ニュース + ポートフォリオ)
  Round 1分析:   183s  (5アナリスト並列)
  Round 2討議:   156s  (5アナリスト並列)
  Round 3統合:    98s  (モデレーター)
  レポート生成:    8s
  ──────────────────
  合計:          487s  (8分7秒)
```

---

## Sources

- Codebase analysis (ground truth): `src/data/news/rss-sources.ts`, `src/data/news/finnhub.ts`, `src/data/news/google-news.ts`, `src/scripts/collect-data.ts`, `.claude/commands/invest.md` — HIGH confidence
- [Feedly: News Clustering & Deduplication Engineering](https://feedly.com/engineering/posts/reducing-clustering-latency) — MEDIUM confidence (production system, confirmed Jaccard/MinHash approach)
- [NewsCatcher API: Article Deduplication](https://www.newscatcherapi.com/docs/news-api/guides-and-concepts/articles-deduplication) — MEDIUM confidence (confirms URL + title similarity as standard approach)
- [CrackingWalnuts: News Aggregator System Design](https://crackingwalnuts.com/post/news-aggregator-system-design) — MEDIUM confidence (confirms MinHash/LSH for scale, O(n²) viable at small scale)
- [Node.js Performance API](https://nodejs.org/api/perf_hooks.html) — HIGH confidence (official docs, `performance.now()` standard approach)
- [Scanz: Keyword-Based News Scanning](https://scanz.com/smart-ways-to-create-keyword-based-news-scans/) — MEDIUM confidence (confirms keyword allowlist/blocklist is industry standard for investment news)

---

*Feature research for: Investment News Quality Improvement (v2.2 Milestone)*
*Researched: 2026-06-26*

# Phase 19: Data Foundation & Holding-News Supply - Pattern Map

**Mapped:** 2026-07-03
**Files analyzed:** 7 (2 modify, 3 new/new-test, 1 prompt doc, 1 existing test extended)
**Analogs found:** 7 / 7

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `src/data/news/finnhub.ts` (MODIFY, line 43) | utility (data-fetch/transform) | transform | same file, `fetchCompanyNews` (lines 69-71) | exact (self-analog: correct callback-wrap pattern already exists 28 lines below the bug) |
| `src/data/news/finnhub.test.ts` (MODIFY — add regression test) | test | transform | same file, existing `describe("fetchAllFinnhubNews company field ...")` block | exact |
| `src/portfolio/holding-news.ts` (NEW) | utility (pure function module) | transform / CRUD-like filter+match | `src/data/news/filter.ts` (pure function pipeline) + `src/data/news/article-id.ts` (ID-assignment pattern) | exact (role+dataflow both match; same directory tree pattern, one level up) |
| `src/portfolio/holding-news.test.ts` (NEW) | test | transform | `src/data/news/filter.test.ts` + `src/data/news/article-id.test.ts` | exact |
| `src/portfolio/holdings.ts` (MODIFY — add `matchAliases`) | config/model (static data) | n/a (constant) | same file (extend existing interface + array) | exact |
| `src/scripts/collect-data.ts` (MODIFY — integrate holding-news.json write) | script/orchestrator | file-I/O, batch, fail-soft | same file, existing `news.json` try/catch block (lines 31-68) and `portfolio.json` try/catch block (lines 70-82) | exact |
| `.claude/commands/invest.md` Step 3d (MODIFY, ~line 1558-1633) | prompt/config (agent instructions) | request-response | same file, `news-curator` ID-reference section (lines 1634-1684) + Step 3a `prev-highlighted-stocks.json` conditional-file section (lines 165-172) | exact |

## Pattern Assignments

### `src/data/news/finnhub.ts` (utility, transform) — NEWS-04 bug fix

**Analog:** the file's own `fetchCompanyNews` function, 28 lines below the bug.

**The bug** (line 43):
```typescript
return items
  .filter((item) => item.datetime * 1000 > oneDayAgo)
  .map(toRawArticle);   // BUG: Array.prototype.map calls (item, index, array) —
                         // index is positionally passed as toRawArticle's `ticker?: string` param
```

**The correct pattern already in the same file** (line 71, `fetchCompanyNews`):
```typescript
return items
  .filter((item) => item.datetime * 1000 > oneDayAgo)
  .map((item) => toRawArticle(item, ticker));
```

**Fix to apply** — explicit no-arg wrap (per CONTEXT.md Claude's Discretion, this is the recommended shape):
```typescript
return items
  .filter((item) => item.datetime * 1000 > oneDayAgo)
  .map((item) => toRawArticle(item));
```

**Type signature involved** (line 15):
```typescript
function toRawArticle(item: FinnhubNewsItem, ticker?: string): RawNewsArticle {
```

**Downstream consumer already defends against the bug** — `src/meeting/schemas.ts` lines 277-280 (`resolveNewsCuration`) contains a `typeof source.ticker === "string"` guard specifically because of this bug:
```typescript
// finnhub由来のmerger/business記事はtickerが数値インデックスのため、文字列のみマージする
tickers:
  typeof source.ticker === "string" && source.ticker !== ""
    ? [...new Set([source.ticker, ...item.tickers])]
    : item.tickers,
```
This comment is direct evidence (per RESEARCH/PITFALLS Pitfall 3) that the fix changes `article.ticker` from `number` → `undefined` for general/merger articles with **no scoring behavior change** (this guard becomes dead-but-harmless code post-fix; do not remove it in this phase — out of scope, no regression risk either way).

**Also relevant** — `src/data/news/filter.ts` line 251-254 (`calculatePriorityScore`) is the other consumer that reads `article.ticker`; confirms the fix is behavior-neutral there too:
```typescript
const tickerBonus =
  article.ticker !== undefined && portfolioTickers.includes(article.ticker)
    ? 0.2
    : 0;
```
`string[].includes(number)` was always `false`, so pre-fix numeric tickers never triggered the bonus — post-fix `undefined` also never triggers it. Behavior is unchanged; only the type is now correct.

---

### `src/data/news/finnhub.test.ts` (test) — regression test for the bug fix

**Analog:** existing `describe("fetchAllFinnhubNews company field (NEWS-01 / D-02)", ...)` block in the same file (lines 1-67).

**Pattern to copy** — `vi.spyOn(globalThis, "fetch").mockImplementation(...)` keyed by URL substring, mock a multi-item array response to hit multiple indices:
```typescript
// existing precedent (lines 44-66), mocking a single company-news item:
it("company記事のtickerフィールドがティッカーシンボルと一致する (D-03)", async () => {
  const mockItem = { category: "company news", datetime: ..., headline: "...", id: 1,
    image: "", related: "MRNA", source: "Reuters", summary: "...", url: "..." };
  vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
    if (String(url).includes("company-news")) {
      return { ok: true, json: async () => [mockItem] } as Response;
    }
    return { ok: true, json: async () => [] } as Response;
  });
  const { fetchAllFinnhubNews } = await import("./finnhub.js");
  const result = await fetchAllFinnhubNews(["MRNA"]);
  expect(result.company).toHaveLength(1);
  expect(result.company[0].ticker).toBe("MRNA");
});
```

**New regression test to add** — mirror the same mock shape but target the `general`/`merger` category endpoint (URL contains `category=`, not `company-news`) with an array of **3+ items** to prove every index is `undefined`, not just index 0 (index 0 is falsy and can mask the bug):
```typescript
it("general/merger記事は配列インデックス位置に関わらずtickerがundefinedになる（回帰テスト、NEWS-04）", async () => {
  const mockItems = [0, 1, 2].map((i) => ({
    category: "general", datetime: Math.floor((Date.now() - 60 * 60 * 1000) / 1000),
    headline: `Article ${i}`, id: i, image: "", related: "", source: "Reuters",
    summary: `summary ${i}`, url: `https://reuters.com/${i}`,
  }));
  vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
    if (String(url).includes("category=general")) {
      return { ok: true, json: async () => mockItems } as Response;
    }
    return { ok: true, json: async () => [] } as Response;
  });
  const { fetchAllFinnhubNews } = await import("./finnhub.js");
  const result = await fetchAllFinnhubNews([]);
  expect(result.general).toHaveLength(3);
  for (const article of result.general) {
    expect(article.ticker).toBeUndefined();
  }
});
```
Note in the test's own comment/description that this is a behavior-neutral fix for `calculatePriorityScore` (per the ripple-effect note above) so a reviewer doesn't think "the fix does nothing."

---

### `src/portfolio/holding-news.ts` (NEW) — deterministic holding-news extraction, pure functions, TDD

**Analog 1 (pure-function pipeline shape):** `src/data/news/filter.ts` — small, focused, exported pure functions, each independently testable, composed at the bottom into one orchestrating function (`filterNewsArticles`).

**Imports pattern** (`filter.ts` line 1):
```typescript
import type { RawNewsArticle, NewsFilterResult } from "./types.js";
```
For `holding-news.ts`, the equivalent will be:
```typescript
import type { NewsArticleWithId } from "../data/news/article-id.js";
import type { PortfolioHolding } from "./holdings.js";
```

**Title-only matching precedent** (D-03: name-fallback checks title only, not summary) — `filter.ts` lines 201-213, `isDenylisted`:
```typescript
/**
 * タイトルが denylist に該当し、かつ投資関連キーワードが存在しない場合に true を返す。
 * タイトルのみを照合対象とする (summaryは対象外 -- RESEARCH.md Pitfall 5)。
 */
export function isDenylisted(title: string): boolean {
  const hasDenyMatch = DENYLIST_PATTERNS.some((p) => p.test(title));
  if (!hasDenyMatch) return false;
  const hasFinancialKeyword = FINANCIAL_EXCEPTION_KEYWORDS.some((p) =>
    p.test(title),
  );
  return !hasFinancialKeyword;
}
```
Copy this "single-purpose exported predicate, JSDoc references the design-doc rationale inline" shape for a `matchesHoldingByName(title: string, holding: PortfolioHolding): boolean` function.

**Priority-score reuse (D-10):** `filter.ts` lines 235-257, `calculatePriorityScore` — reuse this exported function directly (import from `../data/news/filter.js`) for same-tier tie-breaking when truncating to the per-holding cap of 5:
```typescript
export function calculatePriorityScore(
  article: RawNewsArticle,
  now: number,
  portfolioTickers: ReadonlyArray<string>,
): number { ... }
```

**Analog 2 (ID-assignment / immutable-mapping shape):** `src/data/news/article-id.ts` — small single-export module, immutable transform over `ReadonlyArray`, JSDoc explaining *why* (design decision references):
```typescript
export function assignArticleIds(
  articles: ReadonlyArray<RawNewsArticle>,
): ReadonlyArray<NewsArticleWithId> {
  return articles.map((article, i) => ({
    ...article,
    id: `n${String(i + 1).padStart(2, "0")}`,
  }));
}
```
`holding-news.ts` should follow the same shape: one clearly-named exported function per concern (e.g. `matchArticlesForHolding`, `buildHoldingNewsMap`), each taking `ReadonlyArray<NewsArticleWithId>` + `PortfolioHolding`(s) and returning a new immutable structure — never mutate inputs.

**Suggested function decomposition** (Claude's Discretion per CONTEXT.md, but grounded in the two analogs' granularity):
- `matchesTicker(article, holding): boolean` — exact `article.ticker === holding.symbol` check
- `matchesHoldingByName(title, holding): boolean` — title-only substring check against `holding.name` / `holding.nameJa` / `holding.matchAliases`
- `matchArticlesForHolding(articles, holding): ReadonlyArray<{ article, matchType: "ticker" | "name" | "alias" }>` — per-holding candidate collection
- `rankAndCapHoldingArticles(matches, now): ReadonlyArray<HoldingNewsEntry>` — D-10 truncation: ticker-match first, then priority-score tie-break, cap 5
- `buildHoldingNewsMap(articles, holdings): HoldingNewsFile` — top-level orchestrator (D-08 fail-soft: always returns all 12 holding keys, empty array is a valid value, never throws)

---

### `src/portfolio/holding-news.test.ts` (NEW) — TDD test file

**Analog:** `src/data/news/filter.test.ts` (fixture-builder + describe-per-concern shape) and `src/data/news/article-id.test.ts` (small, focused module test file).

**Fixture-builder pattern** (`filter.test.ts` lines 11-18, `article-id.test.ts` lines 5-13):
```typescript
const makeArticle = (overrides: Partial<RawNewsArticle>): RawNewsArticle => ({
  title: "デフォルトタイトル",
  summary: "デフォルト本文",
  source: "TestSource",
  url: "https://example.com/article",
  publishedAt: new Date(),
  category: "japan_market",
  ...overrides,
});
```
Copy this shape for a `makeHolding(overrides)` and reuse `makeArticle`-with-`id` (or a local `makeArticleWithId`) fixture builder in the new test file.

**Describe-per-concern + edge-case coverage pattern** (`article-id.test.ts` lines 15-50): one `describe` per exported function, explicit tests for empty-array input, boundary conditions (last element, first element), and immutability (`expect(articles).toEqual(original)` after calling the function — input array unchanged).

**Required test cases (derived from CONTEXT.md decisions):**
- D-01/D-02: ticker match takes priority over name match; name fallback applies uniformly to all 12 holdings (not JP-only)
- D-03: title-only matching — an article whose *summary* mentions the holding name but title doesn't must NOT match
- D-04: `matchAliases` participates in matching (e.g., "Joby" matches JOBY even though `name` is "Joby Aviation")
- D-08: fail-soft — empty `articles` input still produces all 12 holding keys with empty arrays, function never throws
- D-09/D-10: cap at 5 per holding; when >5 matches exist, ticker-matches are kept over name-matches, and same-type ties are broken by `calculatePriorityScore` (reuse `filter.ts`'s exported function directly rather than reimplementing)

---

### `src/portfolio/holdings.ts` (MODIFY — add `matchAliases`)

**Current shape** (full file, 21 lines):
```typescript
export interface PortfolioHolding {
  readonly symbol: string;
  readonly name: string;
  readonly nameJa: string;
  readonly sector: string;
}

export const PORTFOLIO_HOLDINGS: ReadonlyArray<PortfolioHolding> = [
  { symbol: "MRNA", name: "Moderna", nameJa: "モデルナ", sector: "Healthcare" },
  ...
] as const;
```

**Pattern to apply** — add an optional readonly array field to the interface (matches the existing all-`readonly` convention), and populate only where curated aliases exist (per D-04, most entries will omit the field):
```typescript
export interface PortfolioHolding {
  readonly symbol: string;
  readonly name: string;
  readonly nameJa: string;
  readonly sector: string;
  readonly matchAliases?: ReadonlyArray<string>;
}

export const PORTFOLIO_HOLDINGS: ReadonlyArray<PortfolioHolding> = [
  { symbol: "MRNA", name: "Moderna", nameJa: "モデルナ", sector: "Healthcare" },
  { symbol: "JOBY", name: "Joby Aviation", nameJa: "ジョビー・アビエーション", sector: "Industrials", matchAliases: ["Joby"] },
  ...
  { symbol: "8522.T", name: "The Bank of Nagoya", nameJa: "名古屋銀行", sector: "Financials", matchAliases: ["名古屋銀"] },
  ...
  // POWL: no matchAliases — "Powell" collides with Fed Chair Powell (per D-04/specifics)
] as const;
```
No test file currently exists for `holdings.ts`; a new `holding-news.test.ts` test asserting `matchAliases` participates in matching (per D-04 test case above) is sufficient coverage — do not create a separate `holdings.test.ts` for a static-data file unless the module gains logic.

---

### `src/scripts/collect-data.ts` (MODIFY — integrate holding-news.json generation)

**Analog:** the file's own existing `news.json` fail-soft block (lines 31-68) and the simpler `portfolio.json` fail-soft block (lines 70-82).

**Fail-soft try/catch shape to copy** (lines 70-82, `portfolio.json` — this is the simpler, more directly-applicable template since holding-news generation is a single deterministic call, not a multi-source fetch+filter pipeline):
```typescript
try {
  console.log("ポートフォリオデータ収集中...");
  const portfolioStocks = await fetchPortfolioData(PORTFOLIO_HOLDINGS);
  await writeFile(
    join(TMP_DIR, "portfolio.json"),
    JSON.stringify(portfolioStocks, null, 2),
    "utf-8",
  );
  console.log(`ポートフォリオデータ収集完了 (${portfolioStocks.length}銘柄)`);
} catch (e) {
  console.error("ポートフォリオ収集失敗（続行）:", e);
  await writeFile(join(TMP_DIR, "portfolio.json"), "[]", "utf-8");
}
```

**D-08 requires the fail-soft fallback to be "all 12 holdings, empty arrays" rather than `[]`** — this differs slightly from the two existing precedents (`[]` and `"[]"`), so the catch-branch fallback must build a full empty map, e.g.:
```typescript
} catch (e) {
  console.error("保有銘柄別ニュース抽出失敗（続行）:", e);
  const emptyMap = Object.fromEntries(
    PORTFOLIO_HOLDINGS.map((h) => [h.symbol, []]),
  );
  await writeFile(join(TMP_DIR, "holding-news.json"), JSON.stringify(emptyMap, null, 2), "utf-8");
}
```

**Integration point** — insert directly after the existing `news.json` write (line 59-64), reusing `idArticles` and `PORTFOLIO_HOLDINGS` (both already in scope at that point in the function):
```typescript
const idArticles = assignArticleIds(finalArticles);
await writeFile(
  join(TMP_DIR, "news.json"),
  JSON.stringify(idArticles, null, 2),
  "utf-8",
);
// NEW: D-06 integration point
const holdingNews = buildHoldingNewsMap(idArticles, PORTFOLIO_HOLDINGS);
await writeFile(
  join(TMP_DIR, "holding-news.json"),
  JSON.stringify(holdingNews, null, 2),
  "utf-8",
);
```
This stays inside the *same* outer `try { ... } catch { ... }` block as `news.json` (lines 31-68), since holding-news extraction has a hard dependency on `idArticles` existing — if news collection fails, the existing `catch` already writes `news.json` as `"[]"` and must be extended to also write an all-empty `holding-news.json` (see D-08 fail-soft fallback above, applied inside that existing catch branch too, not only in a separate try block).

**Import to add** (mirrors existing import style, lines 4-11):
```typescript
import { buildHoldingNewsMap } from "../portfolio/holding-news.js";
```

---

### `.claude/commands/invest.md` Step 3d (MODIFY, ~line 1558-1633) — portfolio-analyst prompt integration

**Analog 1 (ID-reference, resolved-content embedding into a prompt):** the `news-curator` agent section, lines 1642-1643, which already demonstrates "extract N fields per record from a tmp/*.json file and manually embed them" instruction phrasing:
```
## 記事プール (tmp/news.json、URL以外の全フィールド)
[tmp/news.json の各記事から id, title, summary, source, publishedAt, ticker の6フィールドのみを埋め込む。url と category は含めないこと]
```
For holding-news (D-07: **resolved full text embedded**, URL excluded), the new section should read `tmp/holding-news.json` (ID refs) + `tmp/news.json` (already loaded, per line 1563) and instruct the orchestrator to resolve+embed per holding:
```
## 保有銘柄別関連ニュース (tmp/holding-news.json を tmp/news.json と突き合わせて解決)
[tmp/holding-news.json の各銘柄について、記事IDを tmp/news.json と照合し id, title, summary, source, publishedAt を解決して埋め込む。URLは含めないこと。]
```

**Analog 2 (conditional-file-existence gated section, D-08 fail-soft):** Step 3a's `prev-highlighted-stocks.json` pattern, lines 165-172:
```
（tmp/prev-highlighted-stocks.json が存在する場合のみ以下を含めること）
## 前日の推奨銘柄
前日のミーティングでチームが注目した銘柄と評価スコアです。...
[tmp/prev-highlighted-stocks.json の各銘柄の ticker, averageScore, verdict, agentScores フィールドを全て展開してください。...]
本日の市場データ・ニュースを踏まえて見解が変化したか明示すること。
（tmp/prev-highlighted-stocks.json が存在しない場合はこのセクション全体を省略）
```
Copy this exact "existence-gated inclusion, explicit omission instruction on both open and close" phrasing for `tmp/holding-news.json` missing/absent (second half of D-08 — invest.md must continue without the news section if the file is missing).

**Analog 3 (list-all-N-items-explicitly instruction, D-11):** Step 3d's existing "must cover all 12 holdings" instruction, line 1584-1585 and line 1630:
```
## 保有銘柄一覧（全12銘柄、必ず全銘柄を評価すること）
[PORTFOLIO_HOLDINGS の全12銘柄: symbol, name, nameJa, sector]
...
- holdings は全12銘柄を含めること（抜け漏れ禁止）
```
Reuse this "全12銘柄、必ず" framing for the new news section's D-11 requirement (list all 12 holdings including explicit "本日の関連ニュースなし" for zero-match ones).

**Anti-hallucination constraint precedent (D-07 URL exclusion + D-12 guard instruction):** `news-curator` section, line 1662:
```
**重要: フィールド名は以下の通り正確に使用すること。独自のフィールド名に変えてはならない。title/url/source/publishedAt は出力しないこと（TS側が tmp/news.json から記事IDを照合して解決するため、ID参照方式を徹底すること。URLやタイトルを直接出力してはならない）。**
```
Adapt this framing for D-12's guard instruction (ニュースなし銘柄への言及禁止・創作禁止) — same "**重要:**" bolded-imperative style used throughout Step 3d/3a for hard constraints.

**Read-file list addition** (line 1558-1563, add one line):
```
- `/Users/arai/invest/tmp/holding-news.json` -- 全内容（保有銘柄別ニュースID参照。tmp/news.json と突き合わせて全文解決する）
```

---

## Shared Patterns

### Fail-soft try/catch with explicit fallback write
**Source:** `src/scripts/collect-data.ts` lines 65-68, 79-82
**Apply to:** `collect-data.ts`'s new holding-news integration block
```typescript
} catch (e) {
  console.error("<日本語の失敗メッセージ>（続行）:", e);
  await writeFile(join(TMP_DIR, "<file>.json"), "<safe-fallback-json>", "utf-8");
}
```
D-08 requires the fallback for `holding-news.json` specifically to be an all-12-keys-empty-array object, not `"[]"` — see collect-data.ts pattern assignment above for the concrete shape.

### Title-only matching (never summary)
**Source:** `src/data/news/filter.ts` `isDenylisted` (lines 201-213), JSDoc explicitly cites "RESEARCH.md Pitfall 5" as rationale
**Apply to:** `holding-news.ts`'s name-fallback matcher (D-03)
Both this precedent and the new module solve the same class of problem (avoid false-positive matches from incidental summary mentions) — copy both the implementation shape (regex/substring test against `.title` only) and the JSDoc convention of citing the design-doc decision ID inline.

### Immutable pure-function transform over `ReadonlyArray`
**Source:** `src/data/news/article-id.ts` `assignArticleIds` (whole file, 27 lines)
**Apply to:** every exported function in `holding-news.ts`
Never mutate the input `articles`/`holdings` arrays; always return new objects/arrays via spread. Confirmed by `article-id.test.ts`'s explicit immutability assertion (lines 26-35): `expect(articles).toEqual(original)` after the call.

### ID-reference, never raw URL/title in LLM-facing artifacts that get re-embedded
**Source:** `.claude/commands/invest.md` line 1662 (news-curator), `src/meeting/schemas.ts` lines 226-234 (`NewsArticlePoolEntry`)
**Apply to:** `holding-news.json`'s shape (D-05: IDs + match meta, not full article copies) and the Step 3d prompt's URL-exclusion instruction (D-07)
This project has a standing structural rule (per PITFALLS.md Pitfall 8/Security section): TS resolves URLs from a trusted pool, LLMs never author or re-emit URLs directly.

### Conditional-file-existence gated prompt section
**Source:** `.claude/commands/invest.md` lines 165-172 (repeated 5x for Step 3a's 5 analyst agents, `prev-highlighted-stocks.json`)
**Apply to:** Step 3d's new holding-news section, gated on `tmp/holding-news.json` existing (second half of D-08)
Copy the exact "（...が存在する場合のみ以下を含めること）" open-gate / "（...が存在しない場合はこのセクション全体を省略）" close-gate phrasing pair.

### Reuse existing scoring function rather than reimplementing
**Source:** `src/data/news/filter.ts` `calculatePriorityScore` (lines 235-257), already exported
**Apply to:** `holding-news.ts`'s D-10 tie-break logic — `import { calculatePriorityScore } from "../data/news/filter.js";`
Do not reimplement time-decay/portfolio-bonus scoring; the exact function needed for D-10's "同格は優先度スコア順" requirement already exists and is exported.

## No Analog Found

None. All 7 files in scope have a strong (role + data-flow match) existing analog in the codebase, consistent with RESEARCH.md's overall finding that this phase is "100% wiring, extension, and one bug fix on the existing TypeScript + Claude Code stack."

## Metadata

**Analog search scope:** `src/data/news/`, `src/portfolio/`, `src/scripts/collect-data.ts`, `src/meeting/schemas.ts`, `.claude/commands/invest.md`
**Files scanned:** `finnhub.ts`, `finnhub.test.ts`, `filter.ts`, `filter.test.ts`, `article-id.ts`, `article-id.test.ts`, `types.ts`, `holdings.ts`, `data.ts`, `collect-data.ts`, `schemas.ts` (lines 180-296), `invest.md` (lines 140-220, 1542-1700)
**Pattern extraction date:** 2026-07-03

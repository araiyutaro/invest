# Phase 20: Holding-Card News Display - Pattern Map

**Mapped:** 2026-07-03
**Files analyzed:** 9 (7 modify, 1 new test, 1 optional refactor-only)
**Analogs found:** 9 / 9

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `src/portfolio/holding-news.ts` (MODIFY: add `resolvePortfolioHoldingNews()` + `ResolvedHoldingNewsItem`) | service/utility (pure function) | transform (ID resolution) | `src/meeting/schemas.ts` `resolveNewsCuration()` (lines 243-295) | exact |
| `src/portfolio/holding-news.test.ts` (MODIFY: add resolver describe block) | test | transform | `src/meeting/schemas.test.ts` `describe("resolveNewsCuration", ...)` (lines 118-271) | exact |
| `src/scripts/report-data-loaders.ts` (MODIFY: add `loadNewsPool()`, `loadHoldingNews()`) | service (data loader) | file-I/O | `loadPortfolioAnalysis()` in same file (lines 74-82); `write-news-digest.ts` lines 23-24 for non-zod variant | exact (structure) / role-match (no-zod simplicity) |
| `src/scripts/report-data-loaders.test.ts` (NEW — file does not exist yet) | test | file-I/O | No direct test-file analog exists for this module; use `generate-report.test.ts` fs-mock convention (lines 1-9) as the mocking pattern | no direct analog (see below) |
| `src/scripts/report-utils.ts` (MODIFY: add `safeHref()`, `formatPublishedAtJst()` moved from generate-news-digest.ts) | utility | transform | `escapeHtml()` in same file (lines 8-15); source functions at `generate-news-digest.ts` lines 31-42, 60-63 | exact |
| `src/scripts/generate-news-digest.ts` (MODIFY: remove local `safeHref`/`formatPublishedAtJst`, import from report-utils.ts) | component (HTML renderer) | transform | itself (pre-refactor) | exact (mechanical import swap) |
| `src/scripts/generate-portfolio-report.ts` (MODIFY: extend `formatHoldingEvaluationsHtml`, add `formatHoldingNewsSectionHtml`/`formatHoldingNewsItemHtml`, extend `generatePortfolioReportHtml` signature) | component (HTML renderer) | transform | `generate-news-digest.ts` `formatArticleCardHtml`/`formatMarketGroupsHtml` (lines 65-92); itself for card shell (lines 21-38, 81-132) | exact |
| `src/scripts/generate-report.ts` (MODIFY: extend `Promise.all` with `loadNewsPool`/`loadHoldingNews`, call resolver, pass to `generatePortfolioReportHtml`) | controller/orchestrator (batch script) | file-I/O + batch | itself (existing `Promise.all` block, lines 95-103) | exact |
| `src/scripts/generate-report.test.ts` (MODIFY: extend `describe("Portfolio Report", ...)`) | test | transform | itself, `Test 25`-`Test 32` (lines 320-380) | exact |

## Pattern Assignments

### `src/portfolio/holding-news.ts` (service/utility, transform)

**Analog:** `src/meeting/schemas.ts` — `resolveNewsCuration()`

**Imports pattern** (current file, lines 1-3):
```typescript
import { calculatePriorityScore } from "../data/news/filter.js";
import type { NewsArticleWithId } from "../data/news/article-id.js";
import type { PortfolioHolding } from "./holdings.js";
```
Add for the resolver:
```typescript
import type { NewsArticlePoolEntry } from "../meeting/schemas.js";
```
**Do not** import `NewsArticleWithId` for pool typing in the resolver — see Pitfall 3 in Shared Patterns (publishedAt is `string` at runtime, not `Date`).

**Core ID-resolution pattern** (analog: `src/meeting/schemas.ts` lines 243-267):
```typescript
export function resolveNewsCuration(
  raw: RawNewsCuration,
  pool: ReadonlyArray<NewsArticlePoolEntry>,
  date: string,
  generatedAt: string,
): NewsCuration {
  const poolById = new Map(pool.map((a) => [a.id, a]));
  const seenIds = new Set<string>();
  const resolved: CuratedArticle[] = [];

  for (const item of raw.articles) {
    if (seenIds.has(item.id)) {
      console.warn(`[news-curation] 重複記事IDをdrop: ${item.id}`);
      continue;
    }
    const source = poolById.get(item.id);
    if (!source) {
      console.warn(`[news-curation] 不明な記事IDをdrop: ${item.id}`);
      continue;
    }
    seenIds.add(item.id);
    resolved.push({ id: item.id, title: source.title, url: source.url, /* ... */ });
  }
  // ...
}
```

**Adapted for this phase** (loop over `holdingNews` keys, NOT over the pool — this is the critical anti-cross-leakage constraint, Pitfall 5):
```typescript
export interface ResolvedHoldingNewsItem {
  readonly id: string;
  readonly title: string;
  readonly source: string;
  readonly url: string;
  readonly publishedAt: string; // JSON往復後は必ずstring — NewsArticlePoolEntry型を使うこと (Pitfall 3)
  readonly matchType: HoldingNewsMatchType;
}

export function resolvePortfolioHoldingNews(
  holdingNews: HoldingNewsFile,
  pool: ReadonlyArray<NewsArticlePoolEntry>,
): Record<string, ReadonlyArray<ResolvedHoldingNewsItem>> {
  const poolById = new Map(pool.map((a) => [a.id, a]));
  const result: Record<string, ReadonlyArray<ResolvedHoldingNewsItem>> = {};

  for (const [symbol, entries] of Object.entries(holdingNews)) {
    const resolved: ResolvedHoldingNewsItem[] = [];
    for (const entry of entries) {
      const article = poolById.get(entry.id);
      if (!article) {
        console.warn(`[holding-news] 不明な記事IDをdrop: ${entry.id} (symbol=${symbol})`);
        continue; // D-10
      }
      resolved.push({
        id: entry.id,
        title: article.title,
        source: article.source,
        url: article.url,
        publishedAt: article.publishedAt,
        matchType: entry.matchType, // note: score is discarded (D-06)
      });
    }
    result[normalizeHoldingSymbol(symbol)] = resolved; // Q2 RESOLVED: 参照側と同一関数でキー正準化
  }
  return result;
}
```

**Existing types to reuse as-is** (`src/portfolio/holding-news.ts` lines 9, 14-21):
```typescript
export type HoldingNewsMatchType = "ticker" | "name" | "alias";
export interface HoldingNewsEntry {
  readonly id: string;
  readonly matchType: HoldingNewsMatchType;
  readonly score: number;
}
export type HoldingNewsFile = Record<string, ReadonlyArray<HoldingNewsEntry>>;
```

**Doc-comment convention** (existing file uses `D-XX` decision tags in JSDoc, e.g. lines 11-12, 20, 28-30, 104-107): follow the same annotation style referencing this phase's decisions (D-06, D-10).

---

### `src/portfolio/holding-news.test.ts` (test)

**Analog:** `src/meeting/schemas.test.ts` — `describe("resolveNewsCuration", ...)`

**Factory pattern** (lines 94-101, adapt for `NewsArticlePoolEntry`):
```typescript
const makePoolEntry = (overrides: Partial<NewsArticlePoolEntry>): NewsArticlePoolEntry => ({
  id: "n01",
  title: "デフォルトタイトル",
  url: "https://example.com/article",
  source: "TestSource",
  publishedAt: "2026-07-02T09:00:00.000Z",
  ...overrides,
});
```

**Unknown-ID drop test pattern** (lines 151-162):
```typescript
it("不明ID: pool に無い id は drop され console.warn が出る", () => {
  const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  const pool = [makePoolEntry({ id: "n01" })];
  const raw = /* holdingNews with an entry id not in pool */;
  const result = resolvePortfolioHoldingNews(raw, pool);
  expect(result.MRNA).toHaveLength(0); // or whatever symbol
  expect(warnSpy).toHaveBeenCalled();
});
```

**Cross-holding ID leakage test (mandatory — Pitfall 5 / D-10 verification requirement):** construct a pool containing article `X`, but list `X`'s id only under `HII` in `holdingNews`; assert `MRNA`'s resolved array does NOT contain `X`, even if `X.ticker === "MRNA"`. This proves the resolver iterates `holdingNews` entries and never independently re-filters the pool (existing `ALL_12_HOLDINGS` fixture at lines 30-43 of the current test file can be reused for symbol fixtures).

**No-throw test pattern** (lines 283-294 in `schemas.test.ts`, adapted as `buildHoldingNewsMap` already does at lines 118-121 of `holding-news.test.ts`):
```typescript
it("マッチする記事がない場合も throw しない", () => {
  expect(() => buildHoldingNewsMap(articles, ALL_12_HOLDINGS)).not.toThrow();
});
```

---

### `src/scripts/report-data-loaders.ts` (service, file-I/O)

**Analog:** `loadPortfolioAnalysis()` (same file, lines 74-82) for the fail-soft try/catch shape; `write-news-digest.ts` lines 23-24 for the no-zod type-assertion variant (since holding-news.json/news.json are self-produced TS output, not LLM output).

**Imports pattern** (lines 1-4):
```typescript
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { analystRound1OutputSchema, analystRound2OutputSchema, analystRound3OutputSchema, portfolioAnalysisSchema } from "../meeting/schemas.js";
import type { AnalystRound1Output, AnalystRound2Output, AnalystRound3Output, PortfolioAnalysis } from "../meeting/types.js";

const TMP_DIR = join(import.meta.dirname, "../../tmp");
```

**Fail-soft loader pattern** (lines 74-82, zod variant — do NOT copy the zod call, just the try/catch/console.error/fallback shape):
```typescript
export async function loadPortfolioAnalysis(): Promise<PortfolioAnalysis | null> {
  try {
    const raw = await readFile(join(TMP_DIR, "portfolio-analysis.json"), "utf-8");
    return portfolioAnalysisSchema.parse(JSON.parse(raw) as unknown) as PortfolioAnalysis;
  } catch (error) {
    console.error('Portfolio analysis load failed:', error instanceof Error ? error.message : error);
    return null;
  }
}
```

**No-zod type-assertion pattern** (`write-news-digest.ts` lines 23-24 — this is the shape to actually copy since holding-news.json/news.json need no zod validation per RESEARCH.md):
```typescript
const poolRaw = await readFile(join(TMP_DIR, "news.json"), "utf-8");
const pool = JSON.parse(poolRaw) as ReadonlyArray<NewsArticlePoolEntry>;
```

**Combined target implementation:**
```typescript
import type { NewsArticlePoolEntry } from "../meeting/schemas.js";
import type { HoldingNewsFile } from "../portfolio/holding-news.js";

export async function loadNewsPool(): Promise<ReadonlyArray<NewsArticlePoolEntry>> {
  try {
    const raw = await readFile(join(TMP_DIR, "news.json"), "utf-8");
    return JSON.parse(raw) as ReadonlyArray<NewsArticlePoolEntry>;
  } catch (error) {
    console.error("News pool load failed:", error instanceof Error ? error.message : error);
    return [];
  }
}

export async function loadHoldingNews(): Promise<HoldingNewsFile> {
  try {
    const raw = await readFile(join(TMP_DIR, "holding-news.json"), "utf-8");
    return JSON.parse(raw) as HoldingNewsFile;
  } catch (error) {
    console.error("Holding news load failed:", error instanceof Error ? error.message : error);
    return {}; // D-09: fail-soft, treated identically to "all holdings 0 news"
  }
}
```

---

### `src/scripts/report-data-loaders.test.ts` (test, NEW FILE — does not exist yet)

**No direct file analog** (`ls` confirms this file is absent). Use two composed patterns instead:

1. **fs mocking convention** from `src/scripts/generate-report.test.ts` lines 4-9:
```typescript
vi.mock("node:fs/promises", () => ({
  readFile: vi.fn().mockRejectedValue(new Error("ENOENT")),
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
  readdir: vi.fn().mockResolvedValue([]),
}));
```
Override `readFile` per-test with `vi.mocked(readFile).mockResolvedValueOnce(...)` to simulate success vs ENOENT vs malformed JSON.

2. **Fail-soft assertion style** from `schemas.test.ts` no-throw pattern (lines 283-294) and `holding-news.test.ts` (lines 118-121): assert the loader never throws and returns the documented fallback (`[]` for `loadNewsPool`, `{}` for `loadHoldingNews`) on ENOENT and on `JSON.parse` failure, with `console.error` called (spy via `vi.spyOn(console, "error")`).

---

### `src/scripts/report-utils.ts` (utility, transform)

**Analog:** `escapeHtml()` in the same file (lines 8-15) for style; source logic to migrate from `generate-news-digest.ts`.

**Functions to move here verbatim** (source: `src/scripts/generate-news-digest.ts` lines 31-42 and 60-63):
```typescript
export function formatPublishedAtJst(publishedAtIso: string): string {
  // D-02: 実行時刻に依存する相対時刻APIは使わない -- publishedAt文字列からのみ絶対時刻を導出(アーカイブ整合性)
  const d = new Date(publishedAtIso);
  return d.toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function safeHref(url: string): string | null {
  // T-16-02-03: javascript:/data: 等の非http(s)スキームはリンク化しない(最終防衛線)
  return url.startsWith("http://") || url.startsWith("https://") ? url : null;
}
```
Add `export` keyword (functions are currently module-private in `generate-news-digest.ts`). After the move, `generate-news-digest.ts` imports both from `./report-utils.js` instead of defining them locally — this is a pure refactor with no behavior change, so existing news-digest tests must still pass unmodified.

---

### `src/scripts/generate-portfolio-report.ts` (component, transform)

**Analog:** `src/scripts/generate-news-digest.ts` `formatArticleCardHtml()`/`formatMarketGroupsHtml()` (lines 65-92) for the card-with-empty-state pattern; itself for the existing card shell.

**Current imports** (line 1):
```typescript
import { escapeHtml, scoreColor, verdictColor, generateBaseStyles } from "./report-utils.js";
```
Extend to:
```typescript
import { escapeHtml, scoreColor, verdictColor, generateBaseStyles, safeHref, formatPublishedAtJst } from "./report-utils.js";
import type { ResolvedHoldingNewsItem } from "../portfolio/holding-news.js";
```

**Empty-state-but-heading-always-shown pattern** (analog: `generate-news-digest.ts` lines 84-92, `formatMarketGroupsHtml`):
```typescript
function formatMarketGroupsHtml(articles: ReadonlyArray<CuratedArticle>): string {
  return MARKET_ORDER.map(({ value, label }) => {
    const groupArticles = sortByImportance(articles.filter((a) => a.market === value));
    const bodyHtml = groupArticles.length === 0
      ? `<p class="agent-card">本日の該当記事なし</p>` // D-06: 0件市場グループも見出しは常時表示
      : groupArticles.map(formatArticleCardHtml).join("\n");
    return `<h2>${escapeHtml(label)}</h2>\n${bodyHtml}`;
  }).join("\n");
}
```
This is the exact structural precedent for D-08 (news heading always shown, body swaps between list and muted empty-state line). **Do not** copy the anti-pattern at `generate-portfolio-report.ts` lines 40-46 / 48-79 (`formatRebalanceActionsHtml`/`formatNewCandidatesHtml`), which return `""` when empty — Pitfall 1 explicitly warns against this shape for the news subsection.

**Card shell to extend** (current file, lines 21-38):
```typescript
function formatHoldingEvaluationsHtml(holdings: ReadonlyArray<HoldingEvaluation>): string {
  if (holdings.length === 0) return "";

  const cards = holdings.map((h) => {
    const color = decisionColor(h.decision);
    const riskHtml = h.riskNote
      ? `<p style="color:#f59e0b;font-size:0.85rem;">リスク: ${escapeHtml(h.riskNote)}</p>`
      : "";
    return `<div class="agent-card" style="border-left-color:${color};">
      <h4>${escapeHtml(h.symbol)}${h.nameJa ? ` -- ${escapeHtml(h.nameJa)}` : ""} <span style="float:right;color:${color};font-weight:bold;">${escapeHtml(h.decision)}</span></h4>
      <p>${escapeHtml(h.rationale)}</p>
      ${riskHtml}
    </div>`;
  }).join("\n");

  return `<h2>保有銘柄 個別評価</h2>
    ${cards}`;
}
```

**Target implementation (per UI-SPEC Component/Markup Contract, verbatim HTML/CSS values):**
```typescript
function formatHoldingNewsItemHtml(item: ResolvedHoldingNewsItem): string {
  const href = safeHref(item.url);
  const titleHtml = href
    ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.title)}</a>`
    : escapeHtml(item.title);
  const badge = item.matchType !== "ticker" // D-07: name/alias一致のみ
    ? ` <span style="display:inline-block;background:#2a2a3e;color:#9ca3af;font-size:0.7rem;padding:0.15rem 0.4rem;margin-left:0.4rem;border-radius:999px;">社名一致</span>`
    : "";
  return `<li style="padding:0.4rem 0;border-top:1px solid #2a2a3e;background:transparent;border-radius:0;margin-bottom:0;">
      ${titleHtml}${badge}
      <p style="color:#888;font-size:0.85rem;margin:0.15rem 0 0;">${escapeHtml(item.source)} ・ ${escapeHtml(formatPublishedAtJst(item.publishedAt))}</p>
    </li>`;
}

function formatHoldingNewsSectionHtml(items: ReadonlyArray<ResolvedHoldingNewsItem>): string {
  // D-08: 見出しは常時表示。0件でもセクション自体は省略しない
  const heading = `<p style="font-size:0.85rem;font-weight:600;color:#a5b4fc;margin-bottom:0.4rem;">関連ニュース</p>`;
  if (items.length === 0) {
    return `<div style="margin-top:0.8rem;">${heading}<p style="color:#888;font-size:0.85rem;">本日の関連ニュースなし</p></div>`;
  }
  const rows = items.map(formatHoldingNewsItemHtml).join("\n");
  return `<div style="margin-top:0.8rem;">${heading}<ul style="list-style:none;padding-left:0;margin:0;">${rows}</ul></div>`;
}

function formatHoldingEvaluationsHtml(
  holdings: ReadonlyArray<HoldingEvaluation>,
  resolvedHoldingNews: Record<string, ReadonlyArray<ResolvedHoldingNewsItem>>,
): string {
  if (holdings.length === 0) return "";

  const cards = holdings.map((h) => {
    const color = decisionColor(h.decision);
    const riskHtml = h.riskNote
      ? `<p style="color:#f59e0b;font-size:0.85rem;">リスク: ${escapeHtml(h.riskNote)}</p>`
      : "";
    const newsHtml = formatHoldingNewsSectionHtml(resolvedHoldingNews[normalizeHoldingSymbol(h.symbol)] ?? []); // Q2 RESOLVED: 参照側もnormalizeHoldingSymbolでキー一致（Pitfall 2 の silent 0件を構造的に防ぐ）
    return `<div class="agent-card news-card" style="border-left-color:${color};">
      <h4>${escapeHtml(h.symbol)}${h.nameJa ? ` -- ${escapeHtml(h.nameJa)}` : ""} <span style="float:right;color:${color};font-weight:bold;">${escapeHtml(h.decision)}</span></h4>
      <p>${escapeHtml(h.rationale)}</p>
      ${riskHtml}
      ${newsHtml}
    </div>`;
  }).join("\n");

  return `<h2>保有銘柄 個別評価</h2>
    ${cards}`;
}
```
Note the `class="agent-card news-card"` two-class combo (UI-SPEC Color section, "実装契約") — required so `.news-card a` link-color rules apply without any new CSS.

**Backward-compatible signature extension** (current file, line 81; analog: `src/scripts/generate-daily-report.ts` `marketData` default-arg pattern referenced by RESEARCH.md, mirrored in `generate-report.ts` line 84):
```typescript
export function generateHtml(
  result: MeetingResult,
  webSearchResults: ReadonlyArray<WebSearchResult>,
  reevalResults: ReadonlyArray<ReevaluationOutput>,
  marketData: MarketData = { sectors: [], vixHistory: [] },
): string {
```
Apply the same shape:
```typescript
export function generatePortfolioReportHtml(
  result: MeetingResult,
  portfolioAnalysis: PortfolioAnalysis | null,
  resolvedHoldingNews: Record<string, ReadonlyArray<ResolvedHoldingNewsItem>> = {},
): string {
  // ...
  const holdingEvaluationsHtml = formatHoldingEvaluationsHtml(portfolioAnalysis.holdings, resolvedHoldingNews);
  // ...
}
```
This preserves existing 2-argument call sites (`generate-report.test.ts` Test 25-32) without modification — confirm Test 31 (`portfolioAnalysis === null` fallback branch, lines 365-371) still passes unchanged, since that branch never reaches `formatHoldingEvaluationsHtml`.

---

### `src/scripts/generate-report.ts` (controller/orchestrator, file-I/O + batch)

**Analog:** itself — existing `Promise.all` loader aggregation (lines 95-103).

**Current pattern** (lines 89-110):
```typescript
const [webSearchResults, reevalResults, round1Results, round2Results, round3Results, portfolioAnalysis, marketData] = await Promise.all([
  loadWebSearchResults(),
  loadReevalResults(),
  loadRound1Results(),
  loadRound2Results(),
  loadRound3Results(),
  loadPortfolioAnalysis(),
  loadMarketData(),
]);
// ...
const portfolioHtml = generatePortfolioReportHtml(meetingResult, portfolioAnalysis);
```

**Extension:**
```typescript
import { loadRound1Results, loadRound2Results, loadRound3Results, loadPortfolioAnalysis, loadNewsPool, loadHoldingNews } from "./report-data-loaders.js";
import { resolvePortfolioHoldingNews } from "../portfolio/holding-news.js";

// ... inside main():
const [webSearchResults, reevalResults, round1Results, round2Results, round3Results, portfolioAnalysis, marketData, newsPool, holdingNews] = await Promise.all([
  loadWebSearchResults(),
  loadReevalResults(),
  loadRound1Results(),
  loadRound2Results(),
  loadRound3Results(),
  loadPortfolioAnalysis(),
  loadMarketData(),
  loadNewsPool(),
  loadHoldingNews(),
]);

const resolvedHoldingNews = resolvePortfolioHoldingNews(holdingNews, newsPool);
// ...
const portfolioHtml = generatePortfolioReportHtml(meetingResult, portfolioAnalysis, resolvedHoldingNews);
```
Note: `resolvePortfolioHoldingNews` is imported from `holding-news.ts`, not `schemas.ts` (RESEARCH.md Pattern 1 / Assumption A1). This is a **read-only data-flow layer** — no changes to `collect-data.ts` (Phase 19's write side).

---

### `src/scripts/generate-report.test.ts` (test)

**Analog:** itself, `describe("Portfolio Report", ...)` Test 25-32 (lines 320-380).

**Existing describe-block style to extend:**
```typescript
describe("Portfolio Report", () => {
  it("Test 25: Portfolio Report に緑系アクセントカラー（#10b981）が含まれる", async () => {
    const { generatePortfolioReportHtml } = await import("./generate-portfolio-report.js");
    const html = generatePortfolioReportHtml(validMeetingResult, validPortfolioAnalysis);
    expect(html).toContain("#10b981");
  });
  // ...
  it("Test 31: portfolioAnalysis が null の場合フォールバック HTML を返す", async () => {
    const { generatePortfolioReportHtml } = await import("./generate-portfolio-report.js");
    const html = generatePortfolioReportHtml(validMeetingResult, null);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("Portfolio Report");
    expect(html).not.toContain("保有銘柄 個別評価");
  });
});
```

**New tests to add (Test 33+), following the exact `await import(...)` + `expect(html).toContain(...)` idiom:**
- 0件銘柄: `generatePortfolioReportHtml(validMeetingResult, validPortfolioAnalysis, {})` → `expect(html).toContain("関連ニュース")` and `expect(html).toContain("本日の関連ニュースなし")`.
- 複数件 + バッジ: pass a `resolvedHoldingNews` fixture with a `matchType: "name"` entry → `expect(html).toContain("社名一致")`; a `matchType: "ticker"` entry must NOT produce the badge text for that item (assert absence scoped carefully, since other holdings may have the badge).
- リンク属性: `expect(html).toContain('target="_blank" rel="noopener noreferrer"')`.
- 3引数省略の後方互換: re-run Test 25 with only 2 args (no `resolvedHoldingNews`) and confirm it still passes unchanged — this is a regression guard, not a new test, per Pitfall 4.
- Test 31 regression: confirm the null-fallback path is unaffected by the added third parameter (no new assertions needed beyond existing ones).

## Shared Patterns

### Fail-soft loading (apply to `loadNewsPool`, `loadHoldingNews`)
**Source:** `src/scripts/report-data-loaders.ts` `loadPortfolioAnalysis()` (lines 74-82) and `src/scripts/write-news-digest.ts` (lines 23-24)
```typescript
try {
  const raw = await readFile(join(TMP_DIR, "<file>.json"), "utf-8");
  return JSON.parse(raw) as <Type>;
} catch (error) {
  console.error("<Label> load failed:", error instanceof Error ? error.message : error);
  return <fallback>; // never throw
}
```

### ID-reference resolution / no self-signed URLs (apply to `resolvePortfolioHoldingNews`)
**Source:** `src/meeting/schemas.ts` `resolveNewsCuration()` (lines 243-267)
```typescript
const poolById = new Map(pool.map((a) => [a.id, a]));
// iterate the CONSUMER's own ID list (never re-filter the pool independently — Pitfall 5)
// unknown id -> console.warn + drop (D-10), never throw
```

### HTML escaping (apply to all new rendering code)
**Source:** `src/scripts/report-utils.ts` `escapeHtml()` (lines 8-15)
```typescript
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
```
Apply to every dynamic string embedded into the news subsection (title, source, badge text is static so no escaping needed there, but title/source always require it).

### Safe href / reverse-tabnabbing guard (apply to news item links)
**Source:** `src/scripts/generate-news-digest.ts` lines 60-63, 70-73 (to be relocated to `report-utils.ts`)
```typescript
function safeHref(url: string): string | null {
  return url.startsWith("http://") || url.startsWith("https://") ? url : null;
}
// usage:
const href = safeHref(item.url);
const titleHtml = href
  ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.title)}</a>`
  : escapeHtml(item.title);
```

### "Heading always shown, body swaps on empty" (apply to `formatHoldingNewsSectionHtml`)
**Source:** `src/scripts/generate-news-digest.ts` `formatMarketGroupsHtml()` (lines 84-92)
```typescript
const bodyHtml = groupArticles.length === 0
  ? `<p class="agent-card">本日の該当記事なし</p>` // heading rendered unconditionally above this line
  : groupArticles.map(formatArticleCardHtml).join("\n");
```
**Anti-pattern to avoid:** `if (items.length === 0) return "";` (seen in `formatRebalanceActionsHtml`/`formatNewCandidatesHtml`, `generate-portfolio-report.ts` lines 40-46/48-79) — explicitly forbidden for the news subsection by D-08/Pitfall 1.

### Backward-compatible default-arg signature extension
**Source:** `src/scripts/generate-report.ts` `generateHtml()` (lines 80-87), mirroring `generate-daily-report.ts`'s `marketData` param
```typescript
export function generatePortfolioReportHtml(
  result: MeetingResult,
  portfolioAnalysis: PortfolioAnalysis | null,
  resolvedHoldingNews: Record<string, ReadonlyArray<ResolvedHoldingNewsItem>> = {},
): string { /* ... */ }
```

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/scripts/report-data-loaders.test.ts` | test | file-I/O | No test file currently exists for `report-data-loaders.ts` at all (confirmed via `ls`/RESEARCH.md Wave 0 Gaps). Compose from `generate-report.test.ts`'s fs-mock convention (lines 1-9) + `schemas.test.ts`'s no-throw/fail-soft assertion style (lines 283-294) as documented above — this is a synthesized pattern, not a direct copy. |

## Metadata

**Analog search scope:** `src/portfolio/`, `src/scripts/`, `src/meeting/`, `src/data/news/`
**Files scanned:** `holding-news.ts`, `holding-news.test.ts`, `holdings.ts`, `article-id.ts`, `report-utils.ts`, `report-data-loaders.ts`, `generate-report.ts`, `generate-report.test.ts`, `generate-portfolio-report.ts`, `generate-news-digest.ts`, `write-news-digest.ts`, `schemas.ts`, `schemas.test.ts`
**Pattern extraction date:** 2026-07-03

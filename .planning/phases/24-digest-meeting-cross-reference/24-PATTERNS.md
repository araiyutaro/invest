# Phase 24: Digest-Meeting Cross-Reference - Pattern Map

**Mapped:** 2026-07-04
**Files analyzed:** 7 (2 new, 5 modified)
**Analogs found:** 7 / 7

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `src/meeting/digest-crossref.ts` | utility (pure matcher) | transform | `src/portfolio/holding-news.ts` | exact (same design template, explicitly named in CONTEXT.md canonical_refs) |
| `src/meeting/digest-crossref.test.ts` | test | transform | `src/portfolio/holding-news.test.ts` | exact |
| `src/scripts/generate-news-digest.ts` | component/renderer (HTML string template) | transform | itself (existing `formatArticleCardHtml`/`formatTickerPillsHtml`) + `src/scripts/report-utils.ts` (`verdictColor`) | exact (same file, additive extension) |
| `src/scripts/generate-news-digest.test.ts` | test | transform | itself (existing fixtures) | exact |
| `src/scripts/write-news-digest.ts` | script/pipeline (file I/O + orchestration) | file-I/O, request-response (batch) | itself (existing outer try/catch) | exact (same file, additive isolated try/catch) |
| `src/scripts/write-news-digest.test.ts` | test (integration, fs-mocked) | file-I/O | itself (existing 3 test cases) | exact |
| `.claude/commands/invest.md` Step 3e | config/orchestration (markdown pipeline script) | event-driven (STEP marker echo) | Step 3e's own `[STEP:news-digest:*]` block (L2009-2017) + Step "portfolio-research" N/M-failure pattern (L1378-1385) | role-match |

## Pattern Assignments

### `src/meeting/digest-crossref.ts` (utility, transform)

**Analog:** `src/portfolio/holding-news.ts` (full file, 214 lines — read in one pass, no re-reads needed)

**Imports pattern** (`holding-news.ts:1-4`):
```typescript
import { calculatePriorityScore } from "../data/news/filter.js";
import type { NewsArticleWithId } from "../data/news/article-id.js";
import type { NewsArticlePoolEntry } from "../meeting/schemas.js";
import type { PortfolioHolding } from "./holdings.js";
```
**Translation for digest-crossref.ts:** do NOT import `calculatePriorityScore` (Pitfall 4 — no recency scoring needed per D-10). Import types instead:
```typescript
import type { CuratedArticle, NewsCuration, MeetingResult } from "./types.js";
```
(digest-crossref.ts lives in `src/meeting/`, sibling to `types.ts` — no `../` needed, unlike holding-news.ts which reaches into `../data/news/` and `../meeting/`.)

**Symbol normalization (reuse, do not reimplement — D-15)** (`holding-news.ts:32-34`):
```typescript
export function normalizeHoldingSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}
```
Import this function directly from `../portfolio/holding-news.js` rather than duplicating it (Don't-Hand-Roll table in RESEARCH.md explicitly mandates reuse to avoid divergence).

**Core matching pattern — ticker-priority + early-continue (D-01, D-04)** (`holding-news.ts:149-165`):
```typescript
export function matchArticlesForHolding(
  articles: ReadonlyArray<NewsArticleWithId>,
  holding: PortfolioHolding,
): ReadonlyArray<HoldingArticleMatch> {
  const matches: HoldingArticleMatch[] = [];
  for (const article of articles) {
    if (matchesTicker(article, holding)) {
      matches.push({ article, matchType: "ticker" });
      continue;
    }
    const nameMatchType = resolveNameMatchType(article.title, holding);
    if (nameMatchType !== null) {
      matches.push({ article, matchType: nameMatchType });
    }
  }
  return matches;
}
```
**Digest-crossref translation:** invert iteration direction. `holding-news.ts` loops "per holding, scan all articles" (output keyed by holding symbol). digest-crossref must loop "per article, check ticker-set then theme" (output keyed by article ID — the join key here is `CuratedArticle.id`, not a holding symbol). Suggested shape:
```typescript
for (const article of curation.articles) {
  const tickerMatches = matchTickersForArticle(article, tickerVerdictMap, scoredTickerSet); // early source: highlightedStocks ∪ scoredTickers
  if (tickerMatches.length > 0) {
    map[article.id] = { tickerMatches: tickerMatches.slice(0, 2), themeMatches: [] };
    continue; // D-04: never evaluate theme when ticker matched
  }
  const themeMatch = resolveThemeMatch(article.title, sectorKeywords);
  if (themeMatch !== null) {
    map[article.id] = { tickerMatches: [], themeMatches: [themeMatch] };
  }
}
```

**Title-only keyword matching (reuse pattern verbatim — D-03)** (`holding-news.ts:105-111`):
```typescript
function titleIncludesAny(
  title: string,
  candidates: ReadonlyArray<string>,
): boolean {
  const lowerTitle = title.toLowerCase();
  return candidates.some((c) => lowerTitle.includes(c.toLowerCase()));
}
```
For digest-crossref, `candidates` = sector keywords extracted from `sectorRecommendations[].sector` **after stripping the trailing `" (TICKER)"` parenthetical** (Pitfall 1 — verified real data is `"Healthcare (XLV)"`, not a clean label):
```typescript
sector.replace(/\s*\([^)]*\)\s*$/, "").trim() // "Healthcare (XLV)" -> "Healthcare"
```

**Name-match-type resolution shape** (`holding-news.ts:119-130`, comment explains title-only rationale citing filter.ts):
```typescript
function resolveNameMatchType(
  title: string,
  holding: PortfolioHolding,
): "name" | "alias" | null {
  if (titleIncludesAny(title, [holding.name, holding.nameJa])) {
    return "name";
  }
  if (holding.matchAliases && titleIncludesAny(title, holding.matchAliases)) {
    return "alias";
  }
  return null;
}
```

**Rank-and-cap pattern (D-10 — simplified, no scoring)** (`holding-news.ts:172-192`):
```typescript
export function rankAndCapHoldingArticles(
  matches: ReadonlyArray<HoldingArticleMatch>,
  now: number,
  portfolioTickers: ReadonlyArray<string>,
): ReadonlyArray<HoldingNewsEntry> {
  const scored = matches.map((m) => ({ ...m, score: calculatePriorityScore(m.article, now, portfolioTickers) }));
  const tickerMatches = scored.filter((m) => m.matchType === "ticker").sort((a, b) => b.score - a.score);
  const nameMatches = scored.filter((m) => m.matchType !== "ticker").sort((a, b) => b.score - a.score);
  return [...tickerMatches, ...nameMatches].slice(0, MAX_ARTICLES_PER_HOLDING).map(...);
}
```
**Digest-crossref translation (simpler — no `.sort`, no `calculatePriorityScore`, Anti-Pattern flagged in RESEARCH.md):** D-10 requires stable original-array order, ticker-first capped at 2, theme capped at 1:
```typescript
const cappedTicker = tickerMatches.slice(0, 2); // JS array order is iteration-order-preserving; no sort needed
const cappedTheme = themeMatches.slice(0, 1);
```
Do not import `calculatePriorityScore` from `src/data/news/filter.ts` — this is an explicit anti-pattern for this module (RESEARCH.md Pitfall 4).

**Fail-soft / no-throw / no-side-effects design (D-11)** — mirror the whole-file discipline of `holding-news.ts`: every exported function is a pure function over its arguments, nothing throws on empty/malformed-but-typed input, and the module performs zero I/O (`buildHoldingNewsMap` at `holding-news.ts:199-213` is the top-level pure entry point to mirror as `buildDigestCrossRefMap(curation, meetingResult)`).

**Data source construction (new logic, no direct analog — D-02):**
```typescript
// From MeetingResult (src/meeting/types.ts:38-84):
// highlightedStocks[].ticker + verdict -> Map<normalizedTicker, verdict>
// roundSummary.scoredTickers -> Set<normalizedTicker> (verdict-less fallback membership)
const verdictByTicker = new Map(
  meetingResult.highlightedStocks.map((s) => [normalizeHoldingSymbol(s.ticker), s.verdict]),
);
const scoredTickerSet = new Set(meetingResult.roundSummary.scoredTickers.map(normalizeHoldingSymbol));
```

---

### `src/meeting/digest-crossref.test.ts` (test, transform)

**Analog:** `src/portfolio/holding-news.test.ts` (full file, 342 lines)

**Factory-helper pattern** (`holding-news.test.ts:14-42`):
```typescript
const makeArticleWithId = (
  overrides: Partial<NewsArticleWithId> & { id: string },
): NewsArticleWithId => ({
  title: "デフォルトタイトル",
  summary: "デフォルト本文",
  source: "TestSource",
  url: "https://example.com/article",
  publishedAt: new Date(),
  category: "japan_market",
  ...overrides,
});
```
**Translation:** build `makeCuratedArticle(overrides: Partial<CuratedArticle> & { id: string })` with sensible `CuratedArticle` defaults (title/url/source/publishedAt as ISO string per `types.ts:147` comment — NOT a `Date` object, unlike `NewsArticleWithId`), and `makeMeetingResult(overrides)` with minimal valid `MeetingResult` defaults (empty `highlightedStocks`/`sectorRecommendations`/`scoredTickers` arrays, overridable).

**Describe-block-per-decision convention** (`holding-news.test.ts:59, 79, 123, 138, 161, 219, 237`): each `describe` block is named after the D-number it verifies, e.g. `describe("matchesTicker (D-01)", ...)`, `describe("normalizeHoldingSymbol (Q2 RESOLVED)", ...)`. Mirror this exactly with `describe("digest-crossref ticker match (D-01, D-02)", ...)`, `describe("digest-crossref theme match (D-03, D-06)", ...)`, `describe("digest-crossref cap (D-10)", ...)`, etc.

**Fail-soft assertion pattern** (`holding-news.test.ts:132-135`):
```typescript
it("マッチする記事がない場合も throw しない", () => {
  const articles = [makeArticleWithId({ id: "n01", title: "無関係な記事" })];
  expect(() => buildHoldingNewsMap(articles, ALL_12_HOLDINGS)).not.toThrow();
});
```

**Critical fixture requirement (Pitfall 1, verified real-data format):** at least one test MUST use a realistic `sector: "Semiconductors (SMH)"` / `"Healthcare (XLV)"` style string, not a clean `"半導体"` string, to catch the parenthetical-stripping bug. At least one JP ticker fixture MUST use the suffixed format `"6326.T"` (not bare `"7203"`), per Pitfall 5, to match real `highlightedStocks`/`scoredTickers` production shape.

---

### `src/scripts/generate-news-digest.ts` (renderer, additive extension)

**Analog:** itself — existing `formatArticleCardHtml` (lines 47-64), `formatTickerPillsHtml` (lines 36-45), `generateNewsDigestHtml` (lines 104-130).

**Current card structure to extend** (`generate-news-digest.ts:47-64`, exact current code):
```typescript
function formatArticleCardHtml(a: CuratedArticle): string {
  const badge = importanceBadgeHtml(a.importance);
  const timeJst = formatPublishedAtJst(a.publishedAt);
  const tickersHtml = formatTickerPillsHtml(a);
  const href = safeHref(a.url);
  const titleHtml = href
    ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(a.title)}</a>`
    : escapeHtml(a.title);
  const metaTail = tickersHtml ? ` ・ ${tickersHtml}` : "";

  return `<div class="agent-card news-card">
      <h4>${badge} ${titleHtml}</h4>
      <p class="news-meta">${escapeHtml(a.source)} ・ ${escapeHtml(timeJst)}${metaTail}</p>
      <p>${escapeHtml(a.commentary)}</p>
    </div>`;
}
```
**Insertion point (D-08, per UI-SPEC.md Component Contract):** a new `<p class="digest-crossref-row">` line goes between `.news-meta` (line 61) and the commentary `<p>` (line 62) — **only when ≥1 match exists**; when 0 matches, the interpolated string must be `""` (empty), producing byte-identical output to today's markup (UI-SPEC.md "byte-identical empty case" requirement, tested by the existing `generate-news-digest.test.ts` suite which must keep passing unmodified).

**Chip-list-join pattern to mirror** (`generate-news-digest.ts:36-45`, this is the direct visual/structural analog for the new `formatDigestCrossRefChipsHtml` function):
```typescript
function formatTickerPillsHtml(a: CuratedArticle): string {
  return a.tickers
    .map((symbol) => {
      const name = a.tickerNames?.[symbol];
      const label = name ? `${symbol} ${name}` : symbol;
      return `<span class="ticker-pill">${escapeHtml(label)}</span>`;
    })
    .join(" ");
}
```
**Digest-crossref translation** (per UI-SPEC.md Component Contract exact markup):
```typescript
function formatDigestCrossRefChipsHtml(annotation: DigestCrossRef | undefined): string {
  if (!annotation) return "";
  const chips = [
    ...annotation.tickerMatches.map((t) => {
      const verdictHtml = t.verdict
        ? ` <strong style="color:${verdictColor(t.verdict)}">${escapeHtml(t.verdict)}</strong>`
        : "";
      return `<span class="digest-crossref-chip">🗣 ミーティング言及: ${escapeHtml(t.symbol)}${verdictHtml}</span>`;
    }),
    ...annotation.themeMatches.map((theme) =>
      `<span class="digest-crossref-chip">🗣 関連テーマ: ${escapeHtml(theme.keyword)}</span>`,
    ),
  ];
  return chips.length === 0 ? "" : `\n      <p class="digest-crossref-row">${chips.join(" ")}</p>`;
}
```
Import `verdictColor` from `./report-utils.js` (already exported, see below).

**Signature extension (additive optional param, D-12)** (`generate-news-digest.ts:104`, current):
```typescript
export function generateNewsDigestHtml(curation: NewsCuration | null, date: string): string {
```
becomes (append-only, existing call sites unaffected):
```typescript
export function generateNewsDigestHtml(
  curation: NewsCuration | null,
  date: string,
  crossRefMap?: Readonly<Record<string, DigestCrossRef>>,
): string {
```
`formatArticleCardHtml` gains `annotation?: DigestCrossRef` as 2nd param; `formatMarketGroupsHtml` (`generate-news-digest.ts:66-74`) must thread `crossRefMap?.[a.id]` through its `.map(formatArticleCardHtml)` call at line 71 — becomes `.map((a) => formatArticleCardHtml(a, crossRefMap?.[a.id]))`.

**Reuse from report-utils.ts (no new escaping/color logic — D-09):**
```typescript
// Source: src/scripts/report-utils.ts:90-96
export function verdictColor(verdict: string): string {
  switch (verdict) {
    case "強気": return "#10b981";
    case "弱気": return "#ef4444";
    default: return "#f59e0b";
  }
}
```
Import and reuse directly — do not reimplement verdict-to-color mapping in generate-news-digest.ts.

---

### `src/scripts/generate-news-digest.test.ts` (test, additive extension)

**Analog:** itself — existing fixture pattern (lines 1-77 read, non-overlapping from later cases already covered by RESEARCH.md).

**Fixture-per-scenario convention** (`generate-news-digest.test.ts:6-17, 19-29, 31-42`): each `CuratedArticle` const fixture models one rendering scenario (`articleUsHigh`, `articleUsLow` — missing `tickerNames` to test fallback, `articleUsMultiTicker` — multiple tickers). Mirror this: add `articleWithTickerCrossRef`, `articleWithThemeCrossRef`, `articleWithNoCrossRef` (must reuse an EXISTING fixture like `articleUsLow` unchanged, calling `generateNewsDigestHtml(curation, date)` with no 3rd arg, to prove 0-annotation/omitted-param byte-identical output — this is the most important new test case per XREP-01 validation architecture).

**Required new test assertions (from RESEARCH.md Validation Architecture table):**
- 0-annotation / omitted 3rd-arg call produces byte-identical HTML to current baseline (regression-guard for existing suite).
- Annotated article's card contains `class="digest-crossref-row"` and the chip text, properly escaped.
- An article present in `crossRefMap` keys but empty `tickerMatches`/`themeMatches` arrays renders no row (defensive empty-array case).

---

### `src/scripts/write-news-digest.ts` (pipeline script, isolated try/catch)

**Analog:** itself — the existing single try/catch (lines 20-36) is both the anti-pattern to avoid nesting into carelessly AND the fail-soft convention to structurally mirror for the new inner block.

**Current structure (exact, lines 1-44):**
```typescript
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { validateRawNewsCuration, resolveNewsCuration } from "../meeting/schemas.js";
import type { NewsArticlePoolEntry } from "../meeting/schemas.js";
import { generateNewsDigestHtml } from "./generate-news-digest.js";

const TMP_DIR = join(import.meta.dirname, "../../tmp");
const DOCS_DIR = join(import.meta.dirname, "../../docs");

export async function main(): Promise<void> {
  const meetingRaw = await readFile(join(TMP_DIR, "meeting-result.json"), "utf-8");
  const { date } = JSON.parse(meetingRaw) as { date: string };

  const dateDir = join(DOCS_DIR, date);
  await mkdir(dateDir, { recursive: true });

  try {
    const rawJson = await readFile(join(TMP_DIR, "news-curation.json"), "utf-8");
    const raw = validateRawNewsCuration(JSON.parse(rawJson) as unknown);
    const poolRaw = await readFile(join(TMP_DIR, "news.json"), "utf-8");
    const pool = JSON.parse(poolRaw) as ReadonlyArray<NewsArticlePoolEntry>;
    const curation = resolveNewsCuration(raw, pool, date, new Date().toISOString());

    const html = generateNewsDigestHtml(curation, date);
    await writeFile(join(dateDir, "news-digest.html"), html, "utf-8");
    console.log(`news-digest.html generated: ${curation.articles.length} articles`);
  } catch (error) {
    const html = generateNewsDigestHtml(null, date);
    await writeFile(join(dateDir, "news-digest.html"), html, "utf-8");
    console.error("news-digest fallback:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
```
**Critical isolation requirement (D-13, Pitfall 2):** the crossref computation MUST NOT be added directly inside the existing try block above the `generateNewsDigestHtml(curation, date)` call — any exception there is caught by the outer `catch` and misreported as a full digest failure (`process.exit(1)` + null-fallback page), which D-13 explicitly forbids. It must be its own nested try/catch that always resolves to a safe default and never calls `process.exit`/sets `process.exitCode`:
```typescript
try {
  const rawJson = await readFile(join(TMP_DIR, "news-curation.json"), "utf-8");
  const raw = validateRawNewsCuration(JSON.parse(rawJson) as unknown);
  const poolRaw = await readFile(join(TMP_DIR, "news.json"), "utf-8");
  const pool = JSON.parse(poolRaw) as ReadonlyArray<NewsArticlePoolEntry>;
  const curation = resolveNewsCuration(raw, pool, date, new Date().toISOString());

  let crossRefMap: Readonly<Record<string, DigestCrossRef>> = {};
  try {
    const meetingResult = validateMeetingResult(JSON.parse(meetingRaw)); // full-shape parse; meetingRaw already read above for `date`
    crossRefMap = buildDigestCrossRefMap(curation, meetingResult);
    console.error("[digest-crossref] OK"); // distinctly-prefixed marker for invest.md to observe (Open Question 1, option a)
  } catch (crossRefError) {
    console.error("[digest-crossref] FAIL:", crossRefError instanceof Error ? crossRefError.message : crossRefError);
    // crossRefMap stays {} — digest generation below is completely unaffected, never rethrow, never process.exit
  }

  const html = generateNewsDigestHtml(curation, date, crossRefMap);
  await writeFile(join(dateDir, "news-digest.html"), html, "utf-8");
  console.log(`news-digest.html generated: ${curation.articles.length} articles`);
} catch (error) {
  // UNCHANGED outer catch — crossref exceptions never reach here
  ...
}
```
Use `validateMeetingResult` (`src/meeting/schemas.ts:108`, already exported) rather than a raw `as MeetingResult` cast, for schema safety — Pitfall 3 notes today's code only casts `{ date: string }`, so the fuller shape must be (re-)parsed from the already-read `meetingRaw` string (no second file read needed).

**STEP marker signal choice (Open Question 1 / D-14):** two options are viable, planner must pick one explicitly:
- **(a) stderr string convention** (shown above): `console.error("[digest-crossref] OK")` / `console.error("[digest-crossref] FAIL:...")`, with `invest.md` Step 3e instructing the agent to inspect the just-executed command's stderr output for this prefix before echoing `[STEP:digest-crossref:OK]` / `[STEP:digest-crossref:FAIL:...]`. Zero new file I/O.
- **(b) tmp/pipeline-metrics.json field**: append `crossRefOk: boolean` to the same JSON file `invest.md`'s Step 3e already reads/writes for timestamps (`invest.md:1991-1998`). More robust (parseable JSON vs string-matching), reuses an existing touch-point.
Either satisfies D-14 ("crossref-specific, independent of `[STEP:news-digest:*]`, no `[PIPELINE:FAIL]`"). RESEARCH.md recommends (b) as slightly more robust.

---

### `src/scripts/write-news-digest.test.ts` (integration test, fs-mocked)

**Analog:** itself — existing 3-test structure (lines 1-117, full file already in context).

**fs-mock setup pattern** (lines 1-7, 48-53):
```typescript
vi.mock("node:fs/promises", () => ({
  readFile: vi.fn().mockRejectedValue(new Error("ENOENT")),
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));
// ...
beforeEach(async () => {
  const fsMock = await import("node:fs/promises");
  (fsMock.writeFile as ReturnType<typeof vi.fn>).mockClear();
  (fsMock.mkdir as ReturnType<typeof vi.fn>).mockClear();
  (fsMock.readFile as ReturnType<typeof vi.fn>).mockClear();
  vi.spyOn(process, "exit").mockImplementation((() => {}) as never);
});
```

**New required test case (D-13, Pitfall 2 warning sign — most critical new test in this phase):** malformed/incompatible `meeting-result.json` (e.g. missing `highlightedStocks`/`sectorRecommendations` fields, or valid `date` but otherwise garbage) combined with valid `news-curation.json`/`news.json`. Assertion MUST be:
```typescript
expect(process.exit).not.toHaveBeenCalledWith(1); // crossref failure must NOT affect digest exit code
const digestCall = writeCalls.find((call) => String(call[0]).includes("news-digest.html"));
expect(digestCall).toBeDefined();
expect(String(digestCall![1])).not.toContain("生成できませんでした"); // must NOT trigger null-fallback text (D-13)
```
This directly mirrors the existing **Test 1** (`write-news-digest.test.ts:60-78`) happy-path shape but deliberately corrupts only the meeting-result mock while keeping curation/pool mocks valid — the inverse of existing **Test 2/3** which corrupt curation while meeting-result stays valid.

---

### `.claude/commands/invest.md` Step 3e (config/orchestration, STEP marker echo)

**Analog:** Step 3e's own existing `[STEP:news-digest:*]` block (`invest.md:2001-2021`). Rendered here as indented text (not a nested fenced code block) to avoid markdown fence-nesting ambiguity — the actual file uses standard ` ```bash ` fences for each command:

    以下のBashコマンドを実行してください:

        cd /Users/arai/invest && npx tsx src/scripts/write-news-digest.ts

    スクリプトの終了コードに関わらず、Step 4 へ進んでください（fail-soft, D-09）。

    終了コードが 0 の場合:
        echo '[STEP:news-digest:OK]'

    終了コードが非0の場合:
        echo '[STEP:news-digest:FAIL:キュレーション生成またはHTML書き出しに失敗（詳細はログのconsole.error出力を参照）]'

    **`[PIPELINE:FAIL]` は絶対に出力しないこと** — この失敗は既存3レポート・デプロイをブロックしない（OPS-04）。

**Digest-crossref translation:** append a second, independent conditional-echo block right after the existing one, driven by the crossref-specific signal (stderr string match or `pipeline-metrics.json` field, per the write-news-digest.ts decision above), e.g.:

    crossref が成功した場合（[digest-crossref] OK が出力された場合、または pipeline-metrics.json の crossRefOk が true の場合）:
        echo '[STEP:digest-crossref:OK]'

    crossref が失敗した場合:
        echo '[STEP:digest-crossref:FAIL:...]'

    **`[PIPELINE:FAIL]` は絶対に出力しないこと** — crossref 失敗は既存4レポート・デプロイをブロックしない。

**N/M-count conditional-echo pattern (secondary analog for "count failures, then choose one of two echo blocks")** (`invest.md:1378-1385`):

    12/12銘柄が成功した場合:
        echo '[STEP:portfolio-research:OK]'

    1銘柄でも失敗した場合、以下のプレースホルダ `{N}` と `{失敗ティッカー}` を実際の値に置き換えてから実行してください:
        echo '[STEP:portfolio-research:FAIL:{N}/12銘柄失敗（{失敗ティッカー}）]'

Not the primary analog (digest-crossref is a single boolean success/fail, not an N/M count), but useful if the planner wants the FAIL marker to embed a short reason string, matching this codebase's placeholder-substitution convention.

**Hard constraint verified exhaustively:** `grep -rn "STEP:" src/` returns zero matches — every `[STEP:*]` marker in this codebase is `echo`'d from `invest.md` only, never printed as a literal `[STEP:...]` string from inside a `.ts` script. The new `[STEP:digest-crossref:*]` markers must follow this same convention (echo'd from invest.md, driven by a signal the script exposes via stderr text or a JSON field — never emitted directly by the script as a literal bracketed string).

---

## Shared Patterns

### HTML Escaping
**Source:** `src/scripts/report-utils.ts:26-33` (`escapeHtml`)
**Apply to:** `digest-crossref.ts` output values that flow into HTML (symbol, verdict, sector keyword) via `generate-news-digest.ts`'s chip renderer. Every interpolated string — including the fixed-string prefixes ("🗣 ミーティング言及: " etc.) — must pass through `escapeHtml`, per UI-SPEC.md Copywriting Contract ("no exceptions, including the fixed-string prefixes").
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

### Verdict Color
**Source:** `src/scripts/report-utils.ts:90-96` (`verdictColor`)
**Apply to:** `generate-news-digest.ts`'s chip renderer, for the `<strong style="color:...">` wrapping the verdict substring inside ticker-match chips. Do not reimplement — import and call directly.
```typescript
export function verdictColor(verdict: string): string {
  switch (verdict) {
    case "強気": return "#10b981";
    case "弱気": return "#ef4444";
    default: return "#f59e0b";
  }
}
```

### Symbol Normalization
**Source:** `src/portfolio/holding-news.ts:32-34` (`normalizeHoldingSymbol`)
**Apply to:** `digest-crossref.ts` ticker-set construction and per-article ticker comparison (D-15 explicitly mandates reuse — trim + toUpperCase only, no `.T`-suffix reconciliation needed per Pitfall 5's verified real-data findings).

### Fail-Soft Isolation (New Cross-Cutting Concern for This Phase)
**Source:** `src/scripts/write-news-digest.ts:20-36` (existing outer try/catch, structural anti-pattern reference) + Pitfall 2's exact nested-try/catch code shape (see write-news-digest.ts section above)
**Apply to:** any crossref computation inserted into the pipeline script — nested try/catch must resolve to `{}` on any exception, never rethrow, never touch `process.exit`/`process.exitCode`.

### CSS Chip Styling
**Source:** `src/scripts/report-utils.ts:194-204` (`.ticker-pill`) + `24-UI-SPEC.md` §"New CSS" (exact `.digest-crossref-chip`/`.digest-crossref-row` block, lines 163-178 of UI-SPEC.md)
**Apply to:** one new CSS block added to `generateBaseStyles` in `report-utils.ts`, adjacent to `.ticker-pill`. Border color `#a78bfa` (accent-light) distinguishes the new chip from `.ticker-pill`'s neutral `#3f3f5a` border, per D-09.

### STEP Marker Convention
**Source:** `.claude/commands/invest.md` — verified zero exceptions: all `[STEP:*]` markers are `echo`'d from invest.md, never from `src/*.ts`
**Apply to:** the new `[STEP:digest-crossref:OK|FAIL:...]` markers — must be added to invest.md Step 3e, driven by a script-exposed signal (stderr prefix or `tmp/pipeline-metrics.json` field), never printed literally by the TS script itself.

## No Analog Found

None. All 7 files in this phase have a strong (exact or role-match) analog in the existing codebase — this phase is, per RESEARCH.md's own summary, "95% port an existing, tested design to a new join key."

## Metadata

**Analog search scope:** `src/portfolio/`, `src/scripts/`, `src/meeting/`, `.claude/commands/invest.md` (directories/files explicitly named in CONTEXT.md canonical_refs and confirmed via direct reads)
**Files scanned:** `holding-news.ts` (214 lines, full), `holding-news.test.ts` (342 lines, full), `generate-news-digest.ts` (130 lines, full), `generate-news-digest.test.ts` (partial, L1-80), `write-news-digest.ts` (44 lines, full), `write-news-digest.test.ts` (117 lines, full), `report-utils.ts` (228 lines, full), `meeting/types.ts` (160 lines, full), `meeting/schemas.ts` (grep only, exported symbols confirmed), `invest.md` (Step 3e region L1985-2024, portfolio-research region L1284-1385)
**Pattern extraction date:** 2026-07-04

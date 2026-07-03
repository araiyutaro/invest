# Architecture Research: Portfolio News Intelligence (v2.5) Integration

**Domain:** Integration of per-holding news injection, parallel WebSearch research, and hold/sell re-evaluation into an existing Claude-Code-orchestrated investment pipeline
**Researched:** 2026-07-03
**Confidence:** HIGH (all findings verified directly against current codebase, not training-data assumptions)

## Standard Architecture (Current System, Verified)

### System Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Step 1: collect-data.ts (TS, deterministic)                              │
│  Yahoo Finance → market.json / portfolio.json                            │
│  Finnhub(general+merger+company) + Google News JP + RSS → filter.ts      │
│                → assignArticleIds() → news.json (id-tagged pool)         │
├──────────────────────────────────────────────────────────────────────────┤
│ Step 2: Meeting (5 analysts × 3 rounds, Agent tool, opus/sonnet)          │
│  R1 analysis → ticker extract → R2 discussion → moderator issues →       │
│  R3 scoring → moderator final → meeting-result.json                      │
│  (highlightedStocks = NEW candidates only; portfolio holdings EXCLUDED   │
│   by explicit prompt rule — no ticker collision with portfolio flow)     │
├──────────────────────────────────────────────────────────────────────────┤
│ Step 3a/3b: Daily-candidate WebSearch research + reeval (EXISTING,       │
│  reusable pattern — see below)                                           │
│  N parallel sonnet Agents (1/ticker) → tmp/websearch/{ticker}.json       │
│  5 parallel sonnet Agents (1/analyst persona) → tmp/reeval/{id}.json     │
├──────────────────────────────────────────────────────────────────────────┤
│ Step 3d: portfolio-analyst (opus) + news-curator (opus), PARALLEL        │
│  portfolio-analyst: portfolio.json + meeting-result.json + holdings.ts   │
│                     → tmp/portfolio-analysis.json                        │
│  news-curator: news.json (ID pool, no URLs) → selects IDs + commentary   │
│                → tmp/news-curation.json → resolveNewsCuration() (TS      │
│                resolves URLs from pool by ID; agent never emits URLs)    │
├──────────────────────────────────────────────────────────────────────────┤
│ Step 3c/3e/4: generate-report.ts (3 HTML) + write-news-digest.ts (4th,   │
│  fail-soft/independent) + update-index.ts + git deploy                  │
└──────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities (Existing, Verified)

| Component | Responsibility | Verified Detail |
|-----------|----------------|------------------|
| `src/data/news/finnhub.ts` | Fetch general/merger/company news | `fetchAllFinnhubNews(companyTickers)` only requests company-news for **non-JP** tickers (`.filter(s => !s.includes("."))` in collect-data.ts:33-35). JP holdings (8522.T, 5885.T, 5576.T, 7711.T) get **zero** Finnhub company-news coverage today. |
| `src/data/news/filter.ts` | Dedup/denylist/time/priority filter | `RawNewsArticle.ticker` is only set by `fetchCompanyNews` (per-ticker path); Google News JP and RSS sources never set `ticker` |
| `src/data/news/article-id.ts` | Assigns `n01`, `n02`... sequential IDs | Runs **after** filtering, in `collect-data.ts`. This is the ID space the ID-reference pattern relies on. |
| `src/meeting/schemas.ts` | Zod validation + ID-resolution | `resolveNewsCuration()` is the canonical "never trust LLM URLs" resolver — looks up `id` in the `tmp/news.json` pool, drops unknown/duplicate IDs, never accepts agent-authored `url`/`title`/`source` |
| `src/scripts/generate-report.ts` | Loads all round/websearch/reeval/portfolio data, calls 3 renderers | `loadPortfolioAnalysis()` returns `PortfolioAnalysis \| null`; renderer handles null with a fallback message — this is the fail-soft contract new code must preserve |
| `src/scripts/generate-portfolio-report.ts` | Pure HTML renderer | `formatNewCandidatesHtml(result: MeetingResult)` renders `highlightedStocks` as a table — **this is the function to delete from rendering**, but `MeetingResult` (and thus `highlightedStocks`) must still reach `portfolio-analyst`'s prompt (already does, via Step 3d's existing Read of `meeting-result.json`) |

### Existing Reusable Pattern: Per-Ticker Parallel WebSearch (Step 3a/3b)

This is the **most important finding** for this milestone: the exact mechanism requested for the 12 holdings **already exists and runs today**, just scoped to `highlightedStocks` (new candidates), not portfolio holdings:

- Step 3a spawns **N parallel `model: sonnet` Agents**, one per ticker (`websearch-{ticker}`), each doing 2-3 WebSearch queries + WebFetch on 2-3 articles, outputting a fixed JSON shape validated by `webSearchResultSchema` (`src/meeting/schemas.ts:112`) and typed as `WebSearchResult` (`src/meeting/types.ts:86`).
- Step 3b then spawns **5 parallel `model: sonnet` Agents**, one per analyst persona, each re-scoring **all** researched tickers against the WebSearch findings, output `ReevaluationOutput` (`reevaluations[]` with `originalScore`/`revisedScore`/`changed`).
- Both types are fully wired into `generate-report.ts` (`loadWebSearchResults()`, `loadReevalResults()`) and feed **only** the Daily Report (`generate-daily-report.ts`), not the Portfolio Report.
- Individual failures already fall back to a documented JSON shape (`{"ticker":"...", "researchSummary":"リサーチ失敗", ...}`) — the fail-soft contract for research failure is already established and should be copied verbatim, not reinvented.

**Do not write to `tmp/websearch/`** for portfolio-holding research — `loadWebSearchResults()` reads every file in that directory indiscriminately and injects it into the **Daily Report**. Writing portfolio-holding research there would silently leak 12 holdings' research into the Daily Report's "new candidates" WebSearch section. Use a new directory (`tmp/portfolio-research/`).

### Existing Reusable Pattern: Cross-Session Memory via tmp/ Persistence

`tmp/` is **never wiped** between daily runs (verified: no `rm -rf tmp` anywhere in `scripts/run.sh` or `invest.md`; only `mkdir -p`). Step 2.0 already exploits this: at the start of a run, before Round 1 overwrites `tmp/meeting-result.json`, it snapshots the **previous day's** `highlightedStocks` into `tmp/prev-highlighted-stocks.json` and injects it into every analyst's Round 1 prompt ("前日の推奨銘柄" section), conditionally included only when the file exists.

This is the correct precedent for "decision re-evaluation" — see Key Decision 3 below.

### Existing Reusable Pattern: ID-Reference Resolution (No Hallucinated URLs)

`CuratedArticle` / `NewsArticlePoolEntry` / `resolveNewsCuration()` (`src/meeting/schemas.ts:195-295`) is the canonical mechanism: the LLM outputs **only `id`** (plus editorial fields like `commentary`/`importance`), and TypeScript resolves `title`/`url`/`source`/`publishedAt` from the `tmp/news.json` pool by ID lookup, silently dropping unknown/duplicate IDs (`console.warn`, never throw). This exists **specifically because news-curator's article selection is an editorial judgment call** that only an LLM can make (which 10-15 of 160 articles matter most).

## Key Decisions for v2.5 Integration

### Decision 1: Per-holding news extraction is a deterministic TS module — NOT an LLM ID-selection task

Unlike news-curator's selection (editorial judgment over 160 articles), "which articles mention holding X" is a **mechanical filter**, not a judgment call. Do not extend the agent-selects-IDs round-trip pattern here — it adds LLM cost/failure surface for zero benefit.

**Recommended:** New pure module `src/portfolio/holding-news.ts`:
```typescript
export function extractHoldingNews(
  pool: ReadonlyArray<NewsArticlePoolEntry>,
  holdings: ReadonlyArray<PortfolioHolding>,
  maxPerHolding = 5,
): ReadonlyMap<string, ReadonlyArray<NewsArticlePoolEntry>>
```
Matching strategy must be **two-tiered**, because ticker-field matching alone silently fails for all 4 JP holdings (Finnhub company-news is US-only per collect-data.ts:33-35, and Google News JP/RSS never populate `.ticker`):
1. Primary: `article.ticker === holding.symbol` (works today for the 8 US holdings once collect-data continues company-news fetch)
2. Fallback: case-insensitive substring match of `holding.nameJa` (JP articles) or `holding.name` (EN articles) in `article.title` — this is the only path that will ever surface JP-holding news, since no upstream source tags JP tickers today

This should be TDD'd exactly like `filter.ts` (pure functions, `vitest`, no I/O) — the codebase's established convention.

**Attach results deterministically, not via LLM self-report.** After `portfolio-analyst` returns its `holdings[]` (decision + rationale text only), a TS post-processing step (extend `report-data-loaders.ts:loadPortfolioAnalysis()`) attaches `relatedNews` to each holding by `symbol` lookup into the pre-computed map. The agent never outputs article IDs, URLs, or titles for this feature — eliminating hallucination risk entirely (stronger guarantee than the ID-reference pattern, which still trusts the LLM to output *valid* IDs).

### Decision 2: Portfolio WebSearch research reuses the existing Step 3a agent-per-ticker pattern verbatim, in a new directory

Reuse `WebSearchResult` type and `webSearchResultSchema` unchanged (no new type needed) — the shape (`researchSummary`/`positiveFindings`/`negativeFindings`/`keyArticles`/`researchedAt`) is domain-agnostic and fits holdings research as-is.

- 12 parallel `model: sonnet` Agents (not 1 agent for all 12 — parallelism is why the existing pattern completes N ticker-researches without linear time cost; sonnet keeps per-agent cost low)
- Output → `tmp/portfolio-research/{symbol}.json` (new directory — **not** `tmp/websearch/`, to avoid leaking into Daily Report's WebSearch loader)
- Reject the "1 agent researches all 12 holdings" option: WebSearch/WebFetch tool-call budgets are per-agent-turn; one agent doing 12×(2-3 searches + 2-3 fetches) either truncates research depth per holding or blows context/turn limits. The existing N-parallel-agent pattern already solves this correctly.
- Reject "2-round initial+reeval" **for the WebSearch layer** (see Decision 3 for why the re-evaluation itself should NOT be a second agent fleet).

### Decision 3: Re-evaluation is a single portfolio-analyst pass with previous-day decision injection — NOT a second reeval agent fleet

The Daily Report's Step 3b (5 reeval agents reconsidering scores) exists because the Daily Report models a **5-person analyst team** reaching consensus. The Portfolio Report's decision-maker is a **single portfolio-analyst agent** (opus) — there is no "team" to poll a second time. Spawning 5 more agents to "re-evaluate" holdings would double LLM cost for a report that already has one authoritative decision-maker, and doesn't map to anything in the existing architecture.

**Recommended:** Feed WebSearch research + per-holding news + previous-day decisions into the **same existing single `portfolio-analyst` call** (Step 3d), reusing the proven `tmp/prev-highlighted-stocks.json` cross-session-memory pattern:
1. At the start of Step 3d (before `portfolio-analyst` runs and overwrites the file), snapshot current `tmp/portfolio-analysis.json` → `tmp/prev-portfolio-analysis.json` (mirrors `prev-highlighted-stocks.json` exactly; conditional inclusion only if the file exists, exactly like the existing pattern's "if exists, include; else omit section entirely" rule)
2. Inject three new conditional sections into the `portfolio-analyst` prompt: "前日の判断" (from `tmp/prev-portfolio-analysis.json`), "保有銘柄別関連ニュース" (from `tmp/holding-news.json`, id+title+summary **only, no URL** — same no-URL-in-prompt discipline as news-curator, so the agent can't parrot a URL into `rationale` text), "保有銘柄別WebSearchリサーチ" (from `tmp/portfolio-research/*.json`)
3. `decisionChanged` and `previousDecision` are **computed by TS, not self-reported by the LLM** — after receiving the new `holdings[]`, compare `holding.decision !== previousHolding.decision` by symbol lookup. This mirrors the project's established philosophy of never trusting LLM self-assessment when TS can verify deterministically (same principle as `resolveNewsCuration` never trusting agent-authored URLs).
4. "緊急情報の指摘" (urgent-info flagging) stays as **prose** inside the existing `riskNote` field — no new schema field needed; the agent is instructed to mention urgency explicitly in `riskNote`/`rationale` when WebSearch/news surfaces something time-sensitive (earnings surprise, litigation, regulatory action). Keep the schema surface small.

This keeps LLM call count for Step 3d unchanged (still 2 parallel opus agents: portfolio-analyst + news-curator) while adding 12 cheap sonnet WebSearch calls — much cheaper than the "N parallel + 5 reeval" pattern would imply if copied wholesale from Daily Report.

### Decision 4: `finnhub.ts:43` bug fix is a true prerequisite, not cosmetic

Confirmed via `npx tsc --noEmit`: `src/data/news/finnhub.ts(43,10)` **is currently a real TypeScript compile error** (`Argument of type '(item: FinnhubNewsItem, ticker?: string) => RawNewsArticle' is not assignable to parameter of type '(value: FinnhubNewsItem, index: number, ...) => RawNewsArticle'`). It has never been caught because:
- `package.json` has no `typecheck`/`build` script — only `vitest run`. The pipeline runs via `npx tsx` (transpile-only, no type checking).
- No existing test covers `general`/`merger` article `.ticker` field (only `finnhub.test.ts` tests the correctly-written `company` path).

Effect: `fetchNewsByCategory`'s `.map(toRawArticle)` implicitly passes `Array.prototype.map`'s `index` argument as `toRawArticle`'s second parameter, so every `general`/`merger` article gets `ticker: 0`, `ticker: 1`, `ticker: 2`... (a number, mistyped as the `string` field). This doesn't currently break anything downstream by coincidence (`resolveNewsCuration` guards with `typeof source.ticker === "string"`, and no exact-string ticker will ever equal a small integer) — but it pollutes the data contract that the new `holding-news.ts` extraction module will read (`article.ticker === holding.symbol`), and leaving it unfixed while adding new consumers of `.ticker` compounds the inconsistency. **Fix first, before building `holding-news.ts`**, so the new module's tests aren't written against contaminated fixtures.

Fix: `.map(toRawArticle)` → `.map((item) => toRawArticle(item))` in `fetchNewsByCategory` (general/merger path only; `fetchCompanyNews`'s wrapped-arrow-function usage is already correct).

## Recommended Project Structure (New Files)

```
src/
├── data/news/
│   └── finnhub.ts              # MODIFY: fix line 43 .map(toRawArticle) → .map((item) => toRawArticle(item))
├── portfolio/
│   ├── holdings.ts              # UNCHANGED (12-holding source of truth, already exists)
│   └── holding-news.ts          # NEW: pure fn extractHoldingNews(pool, holdings) → Map<symbol, articles[]>
│   └── holding-news.test.ts     # NEW: TDD — ticker-match + name-substring-match + JP fallback cases
├── meeting/
│   ├── types.ts                 # MODIFY: extend HoldingEvaluation (relatedNews, decisionChanged, previousDecision)
│   └── schemas.ts                # MODIFY: extend holdingEvaluationSchema; ADD resolvePortfolioHoldingNews()
│                                  #   (deterministic attach step, analogous to resolveNewsCuration but NOT
│                                  #   agent-ID-driven — pure symbol-keyed map lookup)
├── scripts/
│   ├── extract-holding-news.ts  # NEW: thin script wrapper, writes tmp/holding-news.json
│   │                              #   (Map<symbol, articles> serialized; reused by both the
│   │                              #   portfolio-analyst prompt AND WebSearch research prompt)
│   ├── report-data-loaders.ts    # MODIFY: loadPortfolioAnalysis() also loads tmp/news.json pool +
│   │                              #   tmp/holding-news.json + tmp/prev-portfolio-analysis.json, then
│   │                              #   calls resolvePortfolioHoldingNews() before returning
│   └── generate-portfolio-report.ts  # MODIFY: delete formatNewCandidatesHtml() call sites (keep
│                                       #   MeetingResult param for result.date); add
│                                       #   formatRelatedNewsHtml() + decisionChanged badge per holding
tmp/
├── holding-news.json             # NEW: output of extract-holding-news.ts (deterministic, no LLM)
├── portfolio-research/           # NEW directory: {symbol}.json per holding (WebSearchResult shape,
│                                  #   REUSED type — do NOT write to tmp/websearch/, see Decision 2)
└── prev-portfolio-analysis.json  # NEW: snapshot of yesterday's portfolio-analysis.json, written at
                                   #   the START of Step 3d before portfolio-analyst overwrites the real file
```

### Structure Rationale

- `src/portfolio/holding-news.ts` is separated from `src/data/news/filter.ts` because it's a **portfolio-domain** concern (holding-to-article matching), not a **news-domain** concern (dedup/relevance/priority) — matches existing `src/portfolio/` vs `src/data/news/` boundary.
- `resolvePortfolioHoldingNews()` lives in `schemas.ts` alongside `resolveNewsCuration()` to keep all "resolve LLM output against a trusted pool" logic in one file, even though this resolver doesn't consume agent-selected IDs (it's symbol-keyed, not ID-selection-keyed) — grouping by *purpose* (untrusted-boundary resolution), not by *mechanism*.
- `extract-holding-news.ts` is a separate script (not inlined as `node -e` in `invest.md` like the ticker-extraction step) because its matching logic needs unit tests (TDD mandate) and will be read by **two** downstream consumers (portfolio-analyst prompt + portfolio-research WebSearch prompts) — logic worth a real module, unlike the one-off regex ticker-scraping in Step 2b.

## Architectural Patterns

### Pattern 1: Deterministic Attachment Instead of LLM Self-Report

**What:** When a value can be computed correctly and cheaply by TypeScript from data TS already has, compute it in TS — never ask the LLM to compute or self-report it, even if it seems convenient to add one JSON field.
**When to use:** `decisionChanged` (string comparison against `tmp/prev-portfolio-analysis.json`), `relatedNews` (symbol/ticker lookup against a pre-matched map).
**Trade-offs:** Slightly more plumbing (an extra resolve step in `report-data-loaders.ts`) vs. a strictly more reliable, testable, hallucination-free result. This is the same trade-off the project already made for `resolveNewsCuration` and consistently favors correctness.

```typescript
// report-data-loaders.ts (extension)
const prev = await loadPrevPortfolioAnalysis(); // null if no prior day
const holdingNewsMap = await loadHoldingNewsMap(); // from tmp/holding-news.json
const holdings = raw.holdings.map((h) => ({
  ...h,
  relatedNews: holdingNewsMap.get(h.symbol) ?? [],
  decisionChanged: prev
    ? prev.holdings.find((p) => p.symbol === h.symbol)?.decision !== h.decision
    : false,
  previousDecision: prev?.holdings.find((p) => p.symbol === h.symbol)?.decision,
}));
```

### Pattern 2: Directory-Scoped Fan-Out to Avoid Cross-Report Leakage

**What:** Every "N parallel agents write per-item JSON files to a directory, then a loader reads the whole directory" step (`tmp/round-1/`, `tmp/round-2/`, `tmp/round-3/`, `tmp/websearch/`, `tmp/reeval/`) is scoped to **one report's loader**. Adding a new fan-out step must get its **own directory**, never reuse an existing one, because loaders do `readdir()` + read-everything with no per-report filtering.
**When to use:** Any new "1 agent per ticker/item" step.
**Trade-offs:** None significant — directories are cheap. The alternative (shared directory + naming convention to distinguish) is strictly worse (fragile, easy to leak data across reports as shown in Decision 2).

### Pattern 3: Conditional Prompt Sections Gated on File Existence

**What:** `invest.md` already has an established idiom: "if `tmp/X.json` exists, include section Y in the prompt; otherwise omit the section entirely" (used for `prev-highlighted-stocks.json`). New context injections (prev-day decision, holding news, WebSearch research) should follow this exact idiom rather than injecting empty/placeholder sections.
**When to use:** Every new conditional context block being added to the `portfolio-analyst` prompt in Step 3d.
**Trade-offs:** Slightly more branching in the markdown orchestration file, but keeps prompts clean on days when a prior run doesn't exist (first run) or WebSearch entirely fails (fail-soft).

## Data Flow

### New Data Flow (v2.5 additions layered onto existing Step 3)

```
tmp/news.json (id-tagged pool, from Step 1)
         │
         ▼
extract-holding-news.ts ──────────────► tmp/holding-news.json
   (deterministic: ticker match             (Map<symbol, article[]>,
    + JP name-substring fallback)             id/title/source/publishedAt,
         │                                     NO commentary — pure facts)
         │
         ├─────────────────────────────────────┐
         ▼                                      ▼
   [12 parallel sonnet Agents]         portfolio-analyst prompt
   WebSearch per holding                (Step 3d, injected as
   → tmp/portfolio-research/                "保有銘柄別関連ニュース"
       {symbol}.json                          — id+title+summary,
   (WebSearchResult shape, reused)              no URL, per Decision 1)
         │                                      │
         └──────────────┬───────────────────────┘
                         ▼
              portfolio-analyst prompt
              (also injected: "保有銘柄別WebSearchリサーチ"
               + "前日の判断" from tmp/prev-portfolio-analysis.json,
               all conditional on file existence)
                         │
                         ▼
              tmp/portfolio-analysis.json
              (decision + rationale + riskNote per holding —
               NO relatedNews/decisionChanged yet — LLM boundary ends here)
                         │
                         ▼
              report-data-loaders.ts: loadPortfolioAnalysis()
              (attaches relatedNews from holding-news.json map,
               computes decisionChanged vs prev-portfolio-analysis.json,
               ALL deterministic — see Pattern 1)
                         │
                         ▼
              generate-portfolio-report.ts
              (renders relatedNews list + decisionChanged badge
               per holding card; formatNewCandidatesHtml deleted)
```

### Key Data Flows

1. **News injection flow:** `tmp/news.json` → `holding-news.ts` (pure fn) → `tmp/holding-news.json` → (a) portfolio-analyst prompt context (facts only, no editorializing needed since matching is mechanical) and (b) `report-data-loaders.ts` deterministic attachment to final HTML data. The LLM never touches URLs for this feature.
2. **Research flow:** `PORTFOLIO_HOLDINGS` (12 symbols) → 12 parallel WebSearch Agents (reusing existing `WebSearchResult` type, new directory) → read directly into the **same** portfolio-analyst call that already runs in Step 3d (no separate reeval agent fleet — see Decision 3).
3. **Cross-session decision-change flow:** `tmp/portfolio-analysis.json` (yesterday's, still on disk because `tmp/` persists) → snapshotted to `tmp/prev-portfolio-analysis.json` at the top of Step 3d, before being overwritten → injected into today's prompt as context → compared deterministically post-hoc for `decisionChanged`.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Writing portfolio-holding WebSearch results into `tmp/websearch/`

**What people might do:** Reuse the exact same directory as Step 3a for convenience, since the agent pattern and JSON shape are identical.
**Why it's wrong:** `generate-report.ts:loadWebSearchResults()` reads **every** file in `tmp/websearch/` with no filtering and injects all of it into the **Daily Report**. Portfolio-holding research would silently appear in the wrong report (or double-count if a symbol were ever shared, though the `highlightedStocks`-excludes-portfolio rule currently prevents literal collisions — the leak is about report content, not just naming).
**Instead:** New directory `tmp/portfolio-research/`.

### Anti-Pattern 2: Adding a 5-agent "reeval" fleet for portfolio holdings, mirroring Step 3b

**What people might do:** Copy Step 3b's "5 analyst-persona agents each re-score all researched tickers" pattern because it's the closest existing precedent for "post-research re-evaluation."
**Why it's wrong:** The Portfolio Report has exactly one decision-maker (`portfolio-analyst`), not a 5-person team producing per-agent scores. Adding 5 more opus/sonnet calls here doesn't map to anything the Portfolio Report renders (`generate-portfolio-report.ts` has no per-analyst breakdown for holdings, unlike the Daily Report's `agentScores` table) and meaningfully increases pipeline runtime/cost for a report structure that has no slot for the extra output.
**Instead:** Feed research into the single existing `portfolio-analyst` call (Decision 3).

### Anti-Pattern 3: Trusting the LLM to self-report `decisionChanged` or emit `relatedNews` URLs

**What people might do:** Add `decisionChanged: boolean` and `relatedNews: [{title, url, source}]` directly to the JSON the agent is asked to output, since it's simpler to specify in one prompt.
**Why it's wrong:** This is exactly the class of bug the ID-reference pattern (Phase 15, `resolveNewsCuration`) was built to eliminate — LLMs hallucinate URLs and can miscompute "did my decision change" when it's actually a trivial string comparison TS can do perfectly. `PROJECT.md`'s own Key Decisions table explicitly documents this lesson (`ID参照方式キュレーション`).
**Instead:** Decisions 1 and 3 — TS computes both fields deterministically after the agent call returns.

## Fail-Soft Behavior (Required, Matches Existing OPS-04/D-08 Precedent)

| Failure point | Existing precedent to copy | Required behavior |
|---|---|---|
| `extract-holding-news.ts` fails or `tmp/news.json` missing | `collect-data.ts` writes `"[]"` on news failure | Write `tmp/holding-news.json` as `{}` (empty map); never throw; portfolio-analyst prompt simply omits the news section (Pattern 3) |
| Individual portfolio-research WebSearch agent fails (1 of 12) | Step 3a's per-ticker fallback JSON | Save `{"ticker": "...", "researchSummary": "リサーチ失敗", ...}` for that symbol only; other 11 unaffected (agents run independently in parallel) |
| Entire portfolio-research step fails/skipped (0 of 12) | `write-news-digest.ts`'s independent try/catch + dedicated `[STEP:news-digest:*]` marker that never emits `[PIPELINE:FAIL]` | New `[STEP:portfolio-research:*]` marker; on total failure, log warning and let Step 3d proceed with `tmp/portfolio-research/` absent — prompt omits that section entirely (Pattern 3); **must never emit `[PIPELINE:FAIL]`** |
| `portfolio-analyst` itself fails (both retries) | Existing Step 3d behavior (unchanged) | Already fail-soft: `tmp/portfolio-analysis.json` not written → `loadPortfolioAnalysis()` returns `null` → renderer shows existing "本日のポートフォリオ分析は生成されませんでした" fallback. No change needed here. |
| `tmp/prev-portfolio-analysis.json` doesn't exist (first run, or yesterday's analysis also failed) | `prev-highlighted-stocks.json` conditional pattern | Omit "前日の判断" prompt section entirely; `decisionChanged` computed as `false` for all holdings (no baseline = no change to report) |

## Schema Changes Summary

`src/meeting/types.ts` — extend `HoldingEvaluation`:
```typescript
export interface HoldingEvaluation {
  readonly symbol: string;
  readonly nameJa: string;
  readonly decision: "保持" | "買増" | "一部売却" | "全売却";
  readonly rationale: string;
  readonly riskNote?: string;
  // NEW (all attached by TS post-processing, never by the LLM):
  readonly relatedNews?: ReadonlyArray<HoldingNewsRef>;
  readonly decisionChanged?: boolean;
  readonly previousDecision?: "保持" | "買増" | "一部売却" | "全売却";
}

export interface HoldingNewsRef {
  readonly id: string;
  readonly title: string;
  readonly url: string;
  readonly source: string;
  readonly publishedAt: string;
}
```
`src/meeting/schemas.ts` — `holdingEvaluationSchema` gains optional passthrough fields (matches existing `.passthrough()` + defaulting style already used for `riskNote`); add `resolvePortfolioHoldingNews(holdings, holdingNewsMap, prevAnalysis)` alongside `resolveNewsCuration`, following the same "never throw, console.warn on anomalies" contract (Pitfall/D-08 style already established).

`generate-report.ts` / `report-data-loaders.ts` — `loadPortfolioAnalysis()` becomes the single place all three new pieces (news pool, holding-news map, prev-day snapshot) converge before validation returns to the renderer — keeping `generate-portfolio-report.ts` itself a pure, dumb renderer (unchanged responsibility boundary).

## Suggested Build Order

1. **Fix `finnhub.ts:43`** (`.map(toRawArticle)` → `.map((item) => toRawArticle(item))`) + add a test asserting `general`/`merger` articles have `ticker === undefined`. Zero dependencies, unblocks clean data for everything else.
2. **`src/portfolio/holding-news.ts`** (pure fn + TDD tests) — ticker-match + JP name-substring fallback. No pipeline wiring yet, fully testable in isolation.
3. **Schema/type extensions** (`HoldingEvaluation`, `HoldingNewsRef`, `resolvePortfolioHoldingNews`) — depends on (2)'s output shape.
4. **`src/scripts/extract-holding-news.ts`** (thin script wrapper) + wire into `invest.md` as a new prep step before Step 3d, writing `tmp/holding-news.json`. Depends on (2).
5. **Portfolio WebSearch research step** in `invest.md` (12 parallel sonnet Agents → `tmp/portfolio-research/{symbol}.json`, reusing existing `WebSearchResult` type unchanged). Independent of (2)-(4); can be built in parallel with them.
6. **Previous-day snapshot mechanism** (`tmp/prev-portfolio-analysis.json`, copied at top of Step 3d before overwrite) — small, independent, can be built any time before (7).
7. **Modify Step 3d prompt** in `invest.md`: inject the three new conditional sections (holding news, WebSearch research, prev-day decision) into `portfolio-analyst`'s prompt. Depends on (4), (5), (6) all being wired.
8. **`report-data-loaders.ts`** — extend `loadPortfolioAnalysis()` to load the three new tmp files and call `resolvePortfolioHoldingNews()` before returning. Depends on (3), (4), (6).
9. **`generate-portfolio-report.ts`** — delete `formatNewCandidatesHtml()` call sites; add related-news + decisionChanged rendering per holding. Depends on (8).
10. **Pipeline orchestration polish** — new `[STEP:portfolio-research:*]` markers, `pipeline-metrics.json` timing entries, Pipeline Timing summary block update, fail-soft wording per the table above.
11. **End-to-end live verification** — one full pipeline run, inspect `docs/{date}/portfolio-report.html` for all 12 holdings showing relatedNews (accepting JP holdings may show empty lists if no RSS/Google-News article happens to mention them that day — this is expected, not a bug) and confirm Daily Report's WebSearch section is unaffected (no leakage from `tmp/portfolio-research/`).

## Sources

- Direct codebase inspection (all file paths cited inline above) — HIGH confidence, no training-data speculation
- `git show ba01275^:src/portfolio/runner.ts` and `git show ba01275^:src/data/research.ts` (v1.0 precedent, deleted but recoverable) — confirms the "research before final judgment, single moderator/analyst synthesis, not a second agent fleet" shape was the original design intent
- `npx tsc --noEmit` run directly against the repo — confirmed the `finnhub.ts:43` compile error is real and currently unenforced (no typecheck script in `package.json`, only `vitest run`)

---
*Architecture research for: Portfolio News Intelligence (v2.5) pipeline integration*
*Researched: 2026-07-03*

# Architecture Research

**Domain:** AI-curated news digest report (news-digest.html) — 4th report in an existing multi-agent investment pipeline
**Researched:** 2026-07-02
**Confidence:** HIGH (grounded directly in the current codebase, not general domain patterns)

## Standard Architecture

### System Overview (current pipeline, with new step highlighted)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Step 1: Data Collection (collect-data.ts)                               │
│   Finnhub + Google News + RSS → filterNewsArticles() → tmp/news.json    │
│   (20-80 filtered articles) ────────────────────────────────┐           │
│   also: tmp/market.json, tmp/portfolio.json                 │           │
├───────────────────────────────────────────────────────────  │  ─────────┤
│ Step 2: Analyst Meeting (5 agents × 3 rounds + moderator)    │           │
│   Round1 → moderator-tickers → Round2 → moderator-issues →   │           │
│   Round3 → moderator-final → tmp/meeting-result.json (date)  │           │
├───────────────────────────────────────────────────────────  │  ─────────┤
│ Step 3: WebSearch + Synthesis (single-purpose Agent calls)   │           │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐  ┌────────────▼────────┐ │
│  │ 3a       │  │ 3b       │  │ 3d Portfolio │  │ 3e NEWS CURATION     │ │
│  │ WebSearch│  │ Reeval   │  │ Analysis     │  │ (NEW — single Agent) │ │
│  │ (Nx      │  │ (5x      │  │ (1x Agent)   │  │ reads tmp/news.json  │ │
│  │ Agent)   │  │ Agent)   │  │ →portfolio-  │  │ →tmp/news-curation.  │ │
│  │          │  │          │  │  analysis.   │  │  json                │ │
│  │          │  │          │  │  json        │  │                       │ │
│  └──────────┘  └──────────┘  └──────────────┘  └───────────────────────┘ │
│                        │              │                  │                │
│                        └──────┬───────┴──────────────────┘                │
│                               ▼                                           │
│              3c: generate-report.ts (pure TS, TDD)                       │
│              reads ALL tmp/*.json → writes docs/{date}/*.html            │
│              (daily-report / meeting-minutes / portfolio-report /        │
│               news-digest ← NEW)                                         │
├────────────────────────────────────────────────────────────────────────┤
│ Step 4: Deploy — update-index.ts (add 4th link) → git add docs/ →        │
│         commit → push (SHA256 checksum protection on index/portfolio)    │
└────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Current State |
|-----------|----------------|----------------|
| `collect-data.ts` + `filter.ts` | Fetch + dedupe + score news, write `tmp/news.json` (20-80 filtered `RawNewsArticle[]`) | Exists, unmodified — already the exact input the curation step needs |
| **News Curation Agent (new)** | Select ~10-15 articles from `tmp/news.json`, classify by market (米国株/日本株/グローバル), rank by importance within group, write Japanese commentary | New — single Agent invocation in `invest.md`, not a 6th standing analyst |
| `meeting/types.ts` + `meeting/schemas.ts` | Define/validate the TS↔Claude JSON contract | Modified — add `NewsCuration` type + zod schema |
| `generate-news-digest.ts` (new) | Pure TS function `generateNewsDigestHtml()`, string-template HTML, TDD | New — modeled on `generate-portfolio-report.ts` |
| `report-data-loaders.ts` | Load + validate `tmp/*.json` into typed arrays for generators | Modified — add `loadNewsCuration()` |
| `generate-report.ts` | Orchestrate all 4 generators, write `docs/{date}/*.html` | Modified — add news-digest wiring |
| `report-utils.ts` | Shared `generateBaseStyles()`, `escapeHtml()`, accent color palette | Modified — add a 4th `ACCENT_VARIANTS` entry |
| `update-index.ts` | Rewrite `docs/index.html` REPORT_ENTRIES region with per-date links | Modified — `buildStandardLinks()` gains a 4th link |
| `invest.md` (skill) | Orchestrates the whole pipeline via Bash + Agent tool calls | Modified — new curation step + generation-confirmation messaging |
| `scripts/run.sh` | launchd wrapper, STEP markers, SHA256 checksum protection | **No change required** (see Anti-Patterns) |

## Recommended Project Structure

```
src/
├── meeting/
│   ├── types.ts             # MODIFIED: + NewsCuration, CuratedArticle interfaces
│   └── schemas.ts           # MODIFIED: + newsCurationSchema, validateNewsCuration()
├── scripts/
│   ├── generate-news-digest.ts       # NEW: pure HTML generator (TDD)
│   ├── generate-news-digest.test.ts  # NEW: unit tests, fixture-driven
│   ├── generate-report.ts            # MODIFIED: orchestrates 4th generator
│   ├── generate-report.test.ts       # MODIFIED: assert news-digest.html written
│   ├── report-data-loaders.ts        # MODIFIED: + loadNewsCuration()
│   ├── report-utils.ts               # MODIFIED: + 4th ACCENT_VARIANTS color
│   ├── update-index.ts               # MODIFIED: buildStandardLinks() + 1 link
│   └── update-index.test.ts          # MODIFIED: expect 4 links per entry
.claude/commands/
└── invest.md                # MODIFIED: new Step 3e (curation Agent call) +
                              #   Step 3c confirmation-message file list update
```

No new top-level folders are needed — this feature is additive within the existing `meeting/` (contracts) and `scripts/` (generators/orchestration) domains, consistent with the codebase's existing organization by pipeline stage rather than by technical layer.

### Structure Rationale

- **`meeting/types.ts` + `meeting/schemas.ts` (modified, not new files):** Every other tmp/*.json contract in this codebase (MeetingResult, WebSearchResult, ReevaluationOutput, PortfolioAnalysis) lives in these two files. Adding `NewsCuration` there keeps all pipeline JSON contracts colocated and discoverable, and both files stay well under the project's 400-line soft limit after the addition (~35-40 lines each).
- **`generate-news-digest.ts` (new, sibling file):** The codebase's report generators are one-file-per-report (`generate-daily-report.ts`, `generate-meeting-minutes.ts`, `generate-portfolio-report.ts`), each a pure function importing shared helpers from `report-utils.ts`. `generate-news-digest.ts` follows the exact same shape — no architectural deviation needed.

## Architectural Patterns

### Pattern 1: Single-Purpose Agent Step (not a 6th analyst)

**What:** A pipeline step that invokes exactly one Agent tool call (not 5 parallel analysts) to produce one `tmp/*.json` artifact. Already used for `portfolio-analyst` (Step 3d) and `moderator-issues`/`moderator-final`.
**When to use:** Any new capability that needs LLM judgment but does not require multi-perspective debate. Curation (select + classify + comment) is exactly this shape — it needs judgment (which articles matter, how to phrase commentary) but not disagreement/discussion.
**Trade-offs:** Keeps the 5+1 agent structure intact (explicit project constraint). Slightly less "true curation debate" than a dedicated analyst, but that's the correct trade-off here — the milestone explicitly forbids adding a 6th standing persona.

**Example (pattern already in `invest.md`, Step 3d):**
```
**1つの Agent ツールを呼び出してください:**
- name: `portfolio-analyst`
- model: `opus`
- prompt: ... [emits JSON] ...
エージェントの応答を tmp/portfolio-analysis.json に保存。
出力が有効なJSONでない場合は1回リトライ、2回目も失敗したら警告して続行（ファイルを作らず、生成側がnullフォールバックを描画）。
```
The news curation step should follow this template verbatim, with `tmp/news.json` as input and `tmp/news-curation.json` as output.

### Pattern 2: Pure-Function Report Generator + Graceful-Null Fallback

**What:** Each `generate-*.ts` module exports one pure function `(typed data) => string` (HTML), fully unit-testable with fixtures, no I/O inside the function itself. The orchestrator (`generate-report.ts`) does all file I/O. When an optional upstream artifact is missing (e.g., `portfolio-analysis.json` didn't get produced), the generator still renders a valid HTML shell with a "not generated today" message rather than throwing — see `generatePortfolioReportHtml(result, portfolioAnalysis: PortfolioAnalysis | null)`.
**When to use:** `generate-news-digest.ts` must follow this exactly: `generateNewsDigestHtml(curation: NewsCuration | null): string`, because the curation Agent step can fail/retry-exhaust just like portfolio-analyst does, and the pipeline must not hard-fail Step 3c if curation is missing.
**Trade-offs:** Requires every generator to handle a null/absent case, adding a branch — but this is exactly why the existing 3-report pipeline has stayed reliable through retries and partial failures (see how `portfolio-report.html` handles its null state).

### Pattern 3: LLM-side Classification, TS-side Rendering Only

**What:** Market classification (米国株/日本株/グローバル) and importance ranking are produced **by the curation Agent inside its JSON output** (e.g. a `market` field and explicit `rank` per article), not recomputed in TypeScript via keyword/ticker heuristics.
**When to use:** Any time a categorization needs nuanced judgment. This mirrors how `filter.ts`'s denylist is a blunt regex-based *relevance* filter (mechanical, cheap, already-solved problem) versus how *ticker picks*, *verdicts*, and *sector views* are always LLM-authored, never TS-inferred. The project's Out-of-Scope list already rejects "ML/LLMベース関連性スコアリング" for the *filter* step (cost concern, per-article API calls) — but curation is a *single* Agent call across the whole batch, not per-article scoring, so this cost objection does not apply here.
**Trade-offs:** TS generator becomes a thin grouping/rendering layer (`.filter(a => a.market === "米国株")` etc.) — simple, testable with fixtures, no brittle keyword classifier to maintain.

**Example:**
```typescript
// generate-news-digest.ts (illustrative)
const MARKET_ORDER = ["米国株", "日本株", "グローバル"] as const;

function groupByMarket(articles: ReadonlyArray<CuratedArticle>) {
  return MARKET_ORDER.map((market) => ({
    market,
    items: articles.filter((a) => a.market === market).sort((a, b) => a.rank - b.rank),
  })).filter((g) => g.items.length > 0);
}
```

## Data Flow

### New/Modified Data Flow

```
tmp/news.json (existing, 20-80 filtered articles, produced in Step 1)
    │
    ▼
[NEW Agent call: news-curator]  ← single Agent, Step 3e
    │  reads tmp/news.json, writes commentary + market + rank per selected article
    ▼
tmp/news-curation.json  (NEW contract — see below)
    │
    ▼  validated by newsCurationSchema (meeting/schemas.ts, MODIFIED)
    ▼  loaded by loadNewsCuration() (report-data-loaders.ts, MODIFIED)
    ▼
generate-report.ts (MODIFIED) ──calls──> generateNewsDigestHtml() (generate-news-digest.ts, NEW)
    │
    ▼
docs/{date}/news-digest.html  (NEW output file)
    │
    ▼
update-index.ts (MODIFIED: buildStandardLinks() +1 link) ──> docs/index.html (4 links/entry)
    │
    ▼
Step 4 deploy: `git add docs/` (unchanged — already stages the whole docs/ tree,
   automatically picks up news-digest.html and the updated index.html with zero changes)
```

### Key Data Flows

1. **Input reuse, zero new fetch logic:** `tmp/news.json` already contains exactly what the milestone requires (20-80 filtered articles from `filter.ts`). No changes to `collect-data.ts`, `finnhub.ts`, `google-news.ts`, `rss-sources.ts`, or `filter.ts` are needed — curation is purely a new consumer of an existing artifact.
2. **Date consistency:** Every generator keys its output directory off `meetingResult.date` (from `tmp/meeting-result.json`). The news curation Agent step should run **after** Step 2 completes (so `tmp/meeting-result.json` exists) so `generate-report.ts` can place `news-digest.html` in the same `docs/{date}/` directory as the other 3 reports without the curation Agent needing to independently compute "today's date."
3. **Independent of Step 3a/3b/3d outputs:** Curation only needs `tmp/news.json` (available since Step 1). It does not need `highlightedStocks`, WebSearch results, reevaluations, or portfolio data. This makes it safe to run **in parallel with Step 3d (Portfolio Analysis)** as a second Agent tool call in the same message — both are single, independent Agent invocations with no data dependency on each other, exactly like the existing 5-way parallel Agent pattern used in Round 1/2/3. Recommended placement: extend Step 3d's "呼び出してください" block from 1 Agent to 2 parallel Agents (`portfolio-analyst` + `news-curator`), saving wall-clock time versus a fully sequential new step. A simpler (slower but lower-risk) alternative is a standalone sequential Step 3e immediately after 3d — acceptable if the roadmap prioritizes implementation simplicity over the ~1-2 minute time savings.

## Proposed tmp/news-curation.json Contract

```typescript
// src/meeting/types.ts additions
export interface CuratedArticle {
  readonly title: string;
  readonly url: string;
  readonly source: string;
  readonly publishedAt: string;       // ISO 8601, carried through from RawNewsArticle
  readonly market: "米国株" | "日本株" | "グローバル";
  readonly rank: number;              // 1-based importance rank within its market group
  readonly commentary: string;        // 日本語解説コメント (100-200字目安)
}

export interface NewsCuration {
  readonly date: string;              // YYYY-MM-DD, must match meeting-result.json's date
  readonly generatedAt: string;       // ISO 8601
  readonly selectedCount: number;
  readonly articles: ReadonlyArray<CuratedArticle>;
}
```

```typescript
// src/meeting/schemas.ts additions
export const curatedArticleSchema = z.object({
  title: z.string(),
  url: z.string(),
  source: z.string(),
  publishedAt: z.string(),
  market: z.enum(["米国株", "日本株", "グローバル"]),
  rank: z.number().int().min(1),
  commentary: z.string(),
});

export const newsCurationSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  generatedAt: z.string(),
  selectedCount: z.number().int(),
  articles: z.array(curatedArticleSchema).min(10).max(15),
});

export function validateNewsCuration(data: unknown): NewsCuration {
  return newsCurationSchema.parse(data) as NewsCuration;
}
```

**Failure handling (matches existing `portfolio-analyst` pattern exactly):** if the Agent's JSON output fails validation, retry once; if the retry also fails, log a warning and proceed without writing `tmp/news-curation.json`. `loadNewsCuration()` in `report-data-loaders.ts` should mirror `loadPortfolioAnalysis()`: return `null` on missing/invalid file rather than throwing, and `generateNewsDigestHtml()` must render a "本日はニュースキュレーションが生成されませんでした" fallback shell in that case (Pattern 2 above) so Step 3c never hard-fails because of this one optional artifact.

**Article count guardrail:** the milestone specifies "10-15件程度". Encoding `.min(10).max(15)` directly in the zod schema is a judgment call — it gives a hard validation failure (triggering the retry-then-skip path) if the Agent under/over-selects, which is stricter than how other agent outputs are validated in this codebase (e.g. `highlightedStocks` has no min/max array-length constraint). Consider relaxing to a soft warning (log only) if strict rejection proves too brittle in practice — flag this as a phase-level decision, not something to lock in blind.

## Scaling Considerations

Not meaningfully applicable — this is a single-user, single-run-per-day batch pipeline (yourself, via launchd, 8AM daily). No concurrent users, no growth curve. The only "scale" axis worth noting:

| Concern | Current (20-80 articles/day) | If article volume grows 5-10x |
|---------|-------------------------------|-------------------------------|
| Agent context size for curation prompt | Fine — same order of magnitude as what's already fed to all 5 Round-1 analysts | Would need to pre-truncate `tmp/news.json` to top-N by existing `sortByPriorityScore()` before feeding the curation Agent (reuse `filter.ts`'s existing priority score, no new logic) |

## Anti-Patterns

### Anti-Pattern 1: Building a TS-side news classifier/ranker

**What people do:** Write keyword/ticker regex heuristics in TypeScript to sort articles into 米国株/日本株/グローバル and rank importance, treating curation like `filter.ts`'s denylist.
**Why it's wrong:** This duplicates the exact kind of nuanced judgment the LLM agents already do everywhere else in this pipeline (verdicts, sector views, picks). It also risks silently drifting from what "important" means, unlike an Agent-authored `commentary` field that's inherently explainable. The project already explicitly rejected "ML/LLMベース関連性スコアリング" for *per-article filtering* due to cost (Out of Scope) — but that concern doesn't transfer to a single curation Agent call over the whole already-filtered batch.
**Do this instead:** Let the curation Agent emit `market` and `rank` directly in its JSON output (Pattern 3); TS only groups and renders.

### Anti-Pattern 2: Adding a 6th standing analyst persona

**What people do:** Create `src/agents/news-curator.ts` with a `systemPrompt` and wire it into the Round 1/2/3 parallel-analyst loop like the other 5.
**Why it's wrong:** Explicit project constraint — "エージェント構成は5+1を維持（キュレーションは既存パイプライン内のステップとして実装）". A 6th persona would also force it through 3 rounds of debate/scoring it doesn't need, tripling latency/cost for a task that's fundamentally single-pass selection+annotation.
**Do this instead:** One-off Agent tool call in Step 3 (Pattern 1), same shape as `portfolio-analyst`.

### Anti-Pattern 3: Modifying `filter.ts` or `collect-data.ts` to add a curation-specific fetch/filter pass

**What people do:** Add a second, stricter filter pass or a dedicated fetch step "for curation" believing the digest needs different input than the analysts.
**Why it's wrong:** The milestone context is explicit: "ニュースソースは既存の filter.ts フィルタ済みパイプライン出力を利用（新規取得ロジックは不要）". `tmp/news.json` (post-`filterNewsArticles()`, 20-80 items) is already the correct, sufficient input.
**Do this instead:** Curation Agent reads `tmp/news.json` as-is, exactly like the 5 analysts already do in Step 2.

### Anti-Pattern 4: Adding docs/{date}/news-digest.html to `run.sh`'s `PROTECT_FILES` checksum list

**What people do:** Assume any new HTML output under `docs/` needs the same SHA256 checksum protection as `docs/index.html` / `docs/portfolio.html`.
**Why it's wrong:** `PROTECT_FILES` exists specifically to guard hand-maintained, cross-run-persistent shell templates that an LLM agent could accidentally rewrite in place (index/portfolio navigation pages). `docs/{date}/news-digest.html` — like `daily-report.html`, `meeting-minutes.html`, `portfolio-report.html` — is freshly generated every run by pure TS string templates and never hand-edited; there is nothing to "protect" it from.
**Do this instead:** No change to `scripts/run.sh`. Confirm this explicitly during implementation so it isn't mistaken for a missed integration point.

## Integration Points

### External Services

None. This feature introduces no new external API/service dependency — it's a pure consumer of already-collected `tmp/news.json` plus one additional Claude Code Agent invocation (same "service" as every other analyst step).

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `collect-data.ts` (Step 1) → curation Agent (Step 3e) | `tmp/news.json` file handoff | Existing file, existing shape (`RawNewsArticle[]`) — zero changes on the producer side |
| curation Agent (Step 3e) → `generate-report.ts` | `tmp/news-curation.json` file handoff, validated via `meeting/schemas.ts` | New contract; must follow the TS↔Claude "all handoffs via tmp/*.json files" rule (stdout does not reach `invest.md`) — same discipline as every existing agent step |
| `generate-report.ts` → `docs/{date}/news-digest.html` | Direct `writeFile()` call alongside the other 3 reports | Add to the existing `Promise.all([...])` write batch in `main()` |
| `generate-report.ts` output → `update-index.ts` | `docs/{date}/news-digest.html`'s existence is implied by `buildStandardLinks(date)` returning a 4th `{href, label}` entry — no file-existence check currently performed for the other 3 links either, so no new pattern needed | `update-index.ts` never touches `docs/{date}/*.html` files directly, only `docs/index.html`'s REPORT_ENTRIES region and `docs/portfolio.html`'s holdings list |
| `update-index.ts` output → Step 4 deploy | `git add docs/` (broad, unchanged) | No wiring needed — new files under `docs/` are picked up automatically by the existing `git add docs/` + diff-check + commit/push logic in `invest.md`'s Step 4 Bash block |

## Suggested Build Order (dependency-driven)

1. **JSON contract first** — `src/meeting/types.ts` (+`NewsCuration`, `CuratedArticle`) and `src/meeting/schemas.ts` (+`newsCurationSchema`, `validateNewsCuration`), with schema unit tests (TDD RED) using fixture JSON. Nothing downstream can be built or tested without this.
2. **Report generator** — `src/scripts/generate-news-digest.ts` + `.test.ts`, following `generate-portfolio-report.ts`'s shape (pure function, null-fallback branch, grouped-by-market rendering per Pattern 3). Testable entirely against fixtures conforming to step 1's schema — no pipeline wiring needed yet. Add the 4th accent color to `report-utils.ts`'s `ACCENT_VARIANTS` in this step.
3. **Data loader** — `report-data-loaders.ts`: add `loadNewsCuration()` mirroring `loadPortfolioAnalysis()` (graceful null on missing/invalid file).
4. **Orchestration wiring** — `generate-report.ts`: call `loadNewsCuration()`, call `generateNewsDigestHtml()`, add `docs/{date}/news-digest.html` to the `Promise.all([...])` write batch; update `generate-report.test.ts`.
5. **Index/nav wiring** — `update-index.ts`: extend `buildStandardLinks()` to a 4th `{href, label}` entry; update `update-index.test.ts` (existing tests assert exact 3-link shape — will need updating, not just additive tests).
6. **Pipeline wiring** — `.claude/commands/invest.md`: add the new curation Agent step (recommend: merge into Step 3d as a second parallel Agent call; alternative: standalone sequential Step 3e), update Step 3c's post-generation confirmation file-list (currently hardcodes `['daily-report.html', 'meeting-minutes.html', 'portfolio-report.html']` in a Bash/node snippet — must add `'news-digest.html'`), and update the "パイプライン完了" summary text if it enumerates report count anywhere.
7. **End-to-end validation** — run `/invest` (or a scoped manual replay using an existing `tmp/news.json` fixture + `npx tsx src/scripts/generate-report.ts`) to confirm `docs/{date}/news-digest.html` is produced, `docs/index.html` renders 4 links per entry, and `git add docs/` / deploy step requires no changes.
8. **Explicitly verify no-op items** — confirm `scripts/run.sh` `PROTECT_FILES` needs no change (Anti-Pattern 4) and `collect-data.ts`/`filter.ts` need no change, so these aren't mistakenly scheduled as roadmap work.

## Sources

- `/Users/arai/invest/.claude/commands/invest.md` — full pipeline orchestration script (Steps 1-4), existing single-Agent step pattern (Step 3d Portfolio Analysis), existing parallel multi-Agent pattern (Round 1/2/3), Step 3c/4 confirmation and deploy Bash blocks
- `/Users/arai/invest/src/scripts/collect-data.ts` — confirms `tmp/news.json` is already `filterNewsArticles()` output (20-80 items), no new fetch/filter logic needed
- `/Users/arai/invest/src/data/news/filter.ts`, `/Users/arai/invest/src/data/news/types.ts` — `RawNewsArticle` shape, `filterNewsArticles()` pipeline (URL dedup → title dedup → cross-lang dedup → denylist → 24h filter → priority sort)
- `/Users/arai/invest/src/meeting/types.ts`, `/Users/arai/invest/src/meeting/schemas.ts` — existing TS↔Claude JSON contract patterns (`MeetingResult`, `WebSearchResult`, `ReevaluationOutput`, `PortfolioAnalysis`) and their zod validation + graceful-transform patterns
- `/Users/arai/invest/src/scripts/generate-report.ts`, `generate-portfolio-report.ts`, `report-data-loaders.ts`, `report-utils.ts` — pure-function generator pattern, `generateBaseStyles()`/`ACCENT_VARIANTS` shared styling, null-fallback rendering pattern
- `/Users/arai/invest/src/scripts/update-index.ts` — `buildStandardLinks()`/`renderEntryLinks()` data-driven link rendering, confirms no static HTML template edits are needed to add a 4th link
- `/Users/arai/invest/scripts/run.sh` — `PROTECT_FILES` SHA256 checksum protection scope (only `docs/index.html`, `docs/portfolio.html`), confirms per-date report HTML is out of scope for that protection
- `/Users/arai/invest/.planning/PROJECT.md` — milestone goal, constraints (5+1 agent structure, reuse `filter.ts` output, no new fetch logic), Out of Scope rationale (ML/LLM per-article scoring rejected for cost, does not apply to single curation Agent call)

---
*Architecture research for: AI-curated news digest report integration (v2.4 News Curation Report milestone)*
*Researched: 2026-07-02*

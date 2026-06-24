# Architecture Research

**Domain:** Multi-agent investment analysis system — Gemini API to Claude Code migration
**Researched:** 2026-06-24
**Confidence:** HIGH (based on direct codebase inspection)

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    /invest  (Claude Code Skill)                  │
│           ~/.claude/skills/invest  or  .claude/commands/invest   │
├─────────────────────────────────────────────────────────────────┤
│                       Orchestrator Agent                         │
│   (Claude Code main session — reads data JSON, spawns agents,   │
│    collects results, calls TS scripts, writes HTML report)       │
├──────────┬────────────────────────────────┬─────────────────────┤
│ Data Layer (TypeScript — kept as-is)       │  Agent Layer (Claude Code) │
│                                            │                             │
│ ┌─────────────┐  ┌──────────────┐          │ ┌─────────┐ ┌──────────┐   │
│ │  market.ts  │  │   news.ts    │          │ │Fundam.  │ │Tenbagger │   │
│ │(yahoo-fin2) │  │(Finnhub+RSS) │          │ │Subagent │ │Subagent  │   │
│ └──────┬──────┘  └──────┬───────┘          │ └────┬────┘ └────┬─────┘   │
│        │                │                  │      │           │          │
│ ┌──────┴──────┐  ┌──────┴───────┐          │ ┌────┴────┐ ┌────┴─────┐   │
│ │portfolio/   │  │  (removed:   │          │ │  Macro  │ │Technical │   │
│ │ data.ts     │  │ analyzer.ts  │          │ │Subagent │ │Subagent  │   │
│ │ holdings.ts │  │  charts.ts)  │          │ └────┬────┘ └────┬─────┘   │
│ └──────┬──────┘  └──────────────┘          │      │           │          │
│        │                                   │ ┌────┴────┐                 │
│        ▼                                   │ │  Risk   │                 │
│ ┌─────────────────────────────────┐        │ │ Subagent│                 │
│ │     market-data.json            │        │ └────┬────┘                 │
│ │     news-raw.json               │        │      │                      │
│ │     portfolio-data.json         │        │ ┌────▼──────────────────┐   │
│ └─────────────────────────────────┘        │ │   Moderator Subagent  │   │
│           (intermediate files)             │ │ (synthesizes + scores)│   │
└────────────────────────────────────────────┴─┴───────────────────────────┘
                                    │
                          ┌─────────▼──────────┐
                          │   Report Layer      │
                          │  generator.ts (TS)  │
                          │  → HTML dark theme  │
                          └────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Keep / Change |
|-----------|----------------|---------------|
| `src/data/market.ts` | Yahoo Finance data fetch → JSON | Keep as-is |
| `src/data/news.ts` | Finnhub + RSS fetch → raw articles JSON | Keep fetch; remove analyzer call |
| `src/data/news/analyzer.ts` | Gemini news summarization | **Replace** with Claude subagent or inline Claude tool use |
| `src/data/research.ts` | Stock research via Google Search Grounding | **Replace** with Claude WebSearch tool use |
| `src/data/charts.ts` | NanoBanana chart image generation | **Delete** |
| `src/agents/*.ts` | Agent system prompts + Gemini call wrappers | Keep system prompts; remove Gemini calls |
| `src/gemini.ts` | Gemini API client | **Delete** |
| `src/meeting/runner.ts` | Meeting orchestration (Gemini calls) | **Replace** — logic moves to Claude orchestrator agent |
| `src/portfolio/runner.ts` | Portfolio meeting (Gemini calls) | **Replace** — logic moves to Claude orchestrator agent |
| `src/report/generator.ts` | MeetingRecord → HTML | Keep; update to accept plain-text inputs |
| `src/index.ts` | Entry point orchestrator | **Replace** with Claude skill |

## Recommended Project Structure (v2.0)

```
.claude/
└── commands/
    └── invest.md          # /invest skill definition

src/
├── data/
│   ├── market.ts          # unchanged — Yahoo Finance fetch
│   ├── news.ts            # unchanged — Finnhub + RSS fetch (remove analyzer.ts call)
│   ├── news/
│   │   ├── finnhub.ts     # unchanged
│   │   ├── google-news.ts # unchanged
│   │   ├── rss-sources.ts # unchanged
│   │   └── types.ts       # unchanged
│   ├── portfolio/         # unchanged — holdings, data fetch
│   └── (charts.ts deleted, analyzer.ts deleted, research.ts deleted)
├── agents/
│   ├── types.ts           # keep type definitions (MeetingRecord etc.)
│   ├── fundamentals.ts    # keep system prompt only
│   ├── tenbagger.ts       # keep system prompt only
│   ├── macro.ts           # keep system prompt only
│   ├── technical.ts       # keep system prompt only
│   ├── risk-manager.ts    # keep system prompt only
│   ├── moderator.ts       # keep system prompt only
│   └── index.ts           # keep exports
├── report/
│   ├── generator.ts       # keep — accepts MeetingRecord with text fields
│   └── portfolio-generator.ts  # keep — same
└── scripts/
    ├── collect-data.ts    # NEW — runs data fetch, writes JSON files
    └── build-report.ts    # NEW — reads JSON inputs, writes HTML report

tmp/                       # gitignored — intermediate JSON files
├── market-data.json
├── news-raw.json
└── portfolio-data.json

docs/
└── YYYY-MM-DD/
    ├── daily-report.html
    └── meeting-minutes.html
```

### Structure Rationale

- **`.claude/commands/invest.md`:** Claude Code skill entry point — invokes data collection scripts then spawns analyst subagents, feeds them data, collects results, generates report
- **`src/scripts/collect-data.ts`:** Pure data collection with no AI — runs with `npx tsx`, outputs JSON to `tmp/`; called from within the skill
- **`src/scripts/build-report.ts`:** Accepts structured meeting results as JSON, renders HTML; decouples report generation from agent execution
- **`src/agents/*.ts`:** System prompts only — no Gemini imports; exported as plain strings for the Claude skill to embed in subagent messages
- **`tmp/`:** Intermediate files shared between the TS data layer and Claude agent layer; gitignored, cleaned after each run

## Architectural Patterns

### Pattern 1: Skill as Orchestrator

**What:** The `/invest` Claude Code skill acts as the top-level coordinator. It runs TS scripts via Bash tool, reads JSON output, spawns analyst subagents in parallel, collects their text responses, then calls `build-report.ts` with the aggregated results.

**When to use:** When you need to bridge a TypeScript data layer with Claude subagents in a single user-invokable command.

**Trade-offs:** Simple mental model; all coordination logic lives in the skill's markdown prompt. Risk: skill prompts can become large. Mitigation: keep the skill concise and delegate complex logic to TS scripts.

**Example flow in skill:**
```markdown
## Steps
1. Run `npx tsx src/scripts/collect-data.ts` → writes tmp/market-data.json, tmp/news-raw.json, tmp/portfolio-data.json
2. Read tmp/market-data.json and tmp/news-raw.json
3. Spawn 5 analyst subagents in parallel, each receiving:
   - Their system prompt (from src/agents/*.ts exported strings)
   - Market data + raw news as context
4. Collect analyst outputs
5. Spawn moderator subagent with all analyst outputs + market data
6. Run `npx tsx src/scripts/build-report.ts` with meeting results → docs/YYYY-MM-DD/
```

### Pattern 2: JSON Contract Between TS and Claude

**What:** TypeScript data scripts output structured JSON files that the Claude skill reads as plain text context. The meeting result is also serialized to JSON and passed to the TS report generator.

**When to use:** Whenever you need stable, inspectable handoffs between the TS layer and the Claude layer.

**Trade-offs:** Adds a serialization step; but makes each layer independently testable and prevents Claude context from becoming a giant unstructured blob.

**Example:** `collect-data.ts` writes:
```json
{
  "indices": [...],
  "sectors": [...],
  "news": { "finnhub": [...], "japanNews": [...] }
}
```
The skill reads this file and embeds it in subagent prompts.

### Pattern 3: Subagent Per Analyst Role

**What:** Each of the 5 analysts + moderator is a separate Claude subagent spawned by the skill. Analyst subagents run in parallel (Round 1). Discussion round spawns them again sequentially or with prior analyst outputs as context.

**When to use:** When each agent has a distinct system prompt and the results need to be independent before cross-pollination.

**Trade-offs:** More subagent invocations = more latency/cost than a single monolithic prompt. Benefit: faithful recreation of the multi-agent meeting structure; each agent's reasoning is isolated.

### Pattern 4: WebSearch for Stock Research (replaces Google Search Grounding)

**What:** Inside analyst subagents or a dedicated research subagent, use the Claude `WebSearch` tool to look up individual stock tickers. The skill instructs agents that they have WebSearch available.

**When to use:** Replacing `src/data/research.ts` which used Gemini's Google Search Grounding.

**Trade-offs:** Claude WebSearch is not identical to Google Search Grounding — result format differs. But it eliminates the Gemini dependency and works natively within Claude Code.

## Data Flow

### v2.0 Request Flow

```
User: /invest
    │
    ▼
Claude Skill (invest.md)
    │
    ├─► Bash: npx tsx src/scripts/collect-data.ts
    │       │
    │       ├── fetchAllMarketData()  → Yahoo Finance
    │       ├── fetchMarketNews()     → Finnhub + RSS + Google News
    │       ├── fetchPortfolioData()  → Yahoo Finance
    │       └── writes tmp/market-data.json
    │                tmp/news-raw.json
    │                tmp/portfolio-data.json
    │
    ├─► Read tmp/*.json
    │
    ├─► Spawn analyst subagents (parallel):
    │       ├── Fundamentals Agent  (system prompt + market data + news)
    │       ├── Tenbagger Agent     (same context)
    │       ├── Macro Agent         (same context)
    │       ├── Technical Agent     (same context)
    │       └── Risk Manager Agent  (same context)
    │
    ├─► Collect analyst outputs → Round 1 presentations
    │
    ├─► Spawn analyst subagents again (discussion round):
    │       Each agent receives own analysis + all others' analyses
    │       Uses WebSearch for stock research inline
    │
    ├─► Collect discussion + research outputs
    │
    ├─► Spawn Moderator subagent:
    │       Receives all presentations + discussion + research results
    │       Outputs: finalSummary, scoreSummaries
    │
    ├─► Spawn Portfolio subagents (parallel):
    │       Each receives portfolio holdings data + daily summary
    │       Uses WebSearch for portfolio stock research
    │
    ├─► Bash: npx tsx src/scripts/build-report.ts --input meeting-result.json
    │       Renders HTML to docs/YYYY-MM-DD/
    │
    └─► Print report path to user
```

### Key Data Handoff Points

1. **TS → Claude:** `tmp/market-data.json`, `tmp/news-raw.json`, `tmp/portfolio-data.json` — read by skill, embedded as context in subagent prompts
2. **Claude → TS:** Meeting result object serialized to `tmp/meeting-result.json` by skill, read by `build-report.ts`
3. **TS → File system:** HTML reports written to `docs/YYYY-MM-DD/`

### News Analysis Migration

v1.0: `news/analyzer.ts` called Gemini to summarize raw Finnhub + Japan news articles into structured `MarketNews`.

v2.0 option A (recommended): Pass raw articles directly in analyst subagent context. Each agent summarizes what's relevant to their domain. Eliminates the separate Gemini summarization pass.

v2.0 option B: Create a news-summarizer subagent that runs before the analysts and outputs structured summaries. More modular but adds one more sequential step.

**Recommendation: Option A.** Simpler, reduces steps, and each analyst already filters for domain-relevant news.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Yahoo Finance (yahoo-finance2 v3) | TS script → JSON | `new YahooFinance()` instantiation required; unchanged from v1.0 |
| Finnhub API | TS script → JSON | Unchanged; key in `.env` |
| Google News / RSS | TS script → JSON | Unchanged |
| Claude (subagents) | Claude Code skill spawns subagents | Via `use_mcp_tool` or Agent tool in skill |
| WebSearch | Claude subagent tool use | Replaces Google Search Grounding in research.ts |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| TS data scripts ↔ Claude skill | JSON files in `tmp/` | Serialized; inspectable; decoupled |
| Claude skill ↔ analyst subagents | Prompt context (embedded JSON) | System prompt from `src/agents/*.ts` strings |
| Analyst subagents ↔ Moderator | Skill collects text outputs, passes as context | Sequential: analysts first, then moderator |
| Claude skill ↔ report builder | JSON file (`tmp/meeting-result.json`) + Bash call | `build-report.ts` is pure TS with no AI |
| `src/agents/*.ts` ↔ skill | Exported system prompt strings | Skill reads these strings; no Gemini imports |

### New Components Needed

| Component | Type | Purpose |
|-----------|------|---------|
| `.claude/commands/invest.md` | Claude Code skill | Entry point; orchestrates full pipeline |
| `src/scripts/collect-data.ts` | TypeScript | Runs all data fetches, writes `tmp/*.json` |
| `src/scripts/build-report.ts` | TypeScript | Reads meeting JSON, renders HTML report |

### Modified Components

| Component | Change |
|-----------|--------|
| `src/data/news.ts` | Remove call to `analyzer.ts`; return raw articles only |
| `src/agents/*.ts` | Remove any Gemini imports (currently none — system prompts only) |
| `src/report/generator.ts` | Accept plain-text `MeetingRecord` fields (currently does — no change needed) |

### Deleted Components

| Component | Reason |
|-----------|--------|
| `src/gemini.ts` | Gemini API client — no longer needed |
| `src/data/charts.ts` | Chart image generation removed in v2.0 |
| `src/data/news/analyzer.ts` | Gemini summarization replaced by Claude inline |
| `src/data/research.ts` | Google Search Grounding replaced by WebSearch in agents |
| `src/meeting/runner.ts` | Meeting orchestration moves to Claude skill |
| `src/portfolio/runner.ts` | Portfolio orchestration moves to Claude skill |
| `src/index.ts` | Entry point replaced by Claude skill |

## Build Order (Dependency-Aware)

```
Phase 1 — Foundation (no dependencies)
  1a. Create src/scripts/collect-data.ts  (extracts data fetch from index.ts)
  1b. Delete src/gemini.ts, src/data/charts.ts, src/data/research.ts
  1c. Prune src/data/news.ts (remove analyzer.ts call, return raw articles)
  1d. Clean src/agents/*.ts (verify no Gemini imports — already clean)

Phase 2 — Report Builder (depends on types.ts staying stable)
  2.  Create src/scripts/build-report.ts (wraps existing generator.ts)

Phase 3 — Skill (depends on Phase 1 + 2 being complete)
  3.  Create .claude/commands/invest.md
      - Define data collection step (calls collect-data.ts)
      - Define analyst subagent prompts (embed system prompts from agents/*.ts)
      - Define discussion + research round (WebSearch)
      - Define moderator aggregation
      - Define portfolio meeting
      - Call build-report.ts with results

Phase 4 — Cleanup (depends on Phase 3 working end-to-end)
  4a. Delete src/meeting/runner.ts
  4b. Delete src/portfolio/runner.ts
  4c. Delete src/index.ts
  4d. Remove @google/generative-ai and @google/genai from package.json
  4e. Remove GEMINI_API_KEY references
```

## Anti-Patterns

### Anti-Pattern 1: Calling Gemini and Claude in the Same Pipeline

**What people do:** Keep `gemini.ts` for "just the news summarization" while migrating agents to Claude.
**Why it's wrong:** Defeats the goal of removing Gemini dependency; two API keys to manage; news format must be compatible with both.
**Do this instead:** Pass raw news articles directly to Claude analyst subagents. Each agent extracts what's relevant for their domain. Less pre-processing, same or better quality.

### Anti-Pattern 2: Embedding All Logic in the Skill File

**What people do:** Put data fetching, agent orchestration, and report rendering all inside `invest.md`.
**Why it's wrong:** Skill files become unmaintainable. TS scripts can't be unit-tested if logic lives in markdown.
**Do this instead:** Skill only orchestrates. Data collection and report rendering stay in TS scripts. Skill calls them via Bash.

### Anti-Pattern 3: Passing Entire MeetingRecord JSON as Agent Context

**What people do:** Serialize the full MeetingRecord (all 5 analyst outputs + discussion + research) and pass to every subagent.
**Why it's wrong:** Context windows fill quickly; cost scales with each parallel agent.
**Do this instead:** Each agent receives only what they need. Round 1 analysts get market data. Round 2 discussion agents get market data + other agents' summaries only (not full analysis). Moderator gets everything.

### Anti-Pattern 4: Recreating `src/meeting/runner.ts` Logic in TypeScript

**What people do:** Replace `generateText()` calls with Claude SDK calls in TypeScript, keeping the same runner structure.
**Why it's wrong:** This adds a TypeScript Claude SDK dependency, requires API key management, and loses Claude Code's native tool use (WebSearch, file access). The skill-based approach is the intended Claude Code pattern.
**Do this instead:** Move orchestration logic to the skill. TS handles only data and rendering.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Single user (current) | Monolithic skill is appropriate; `tmp/` files, sequential rounds |
| Multiple concurrent users | Not applicable — personal tool, single-user design is correct |
| Larger portfolio (>20 stocks) | Portfolio research round will grow; consider batching WebSearch calls or limiting to top N holdings |
| More analyst agents | Each new agent is a parallel subagent invocation; cost grows linearly, latency unchanged (parallel) |

---
*Architecture research for: Investment Agent v2.0 Claude Code Migration*
*Researched: 2026-06-24*

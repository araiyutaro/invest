# Stack Research

**Domain:** Portfolio news intelligence additions to an existing Claude Code multi-agent investment pipeline (v2.5)
**Researched:** 2026-07-03
**Confidence:** HIGH (verified against existing codebase behavior + official Anthropic docs; MEDIUM on the Claude Code CLI concurrency ceiling, which is community-reported rather than a documented hard limit)

## Recommended Stack

### Core Technologies

No new runtime technologies are required. All five v2.5 features are built entirely from capabilities already present in this repository and the Claude Code CLI it runs inside.

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Claude Code `Agent` tool (parallel subagent invocation) | Claude Code CLI, current (2026) | Spawn one research subagent per portfolio holding, in parallel, from `.claude/commands/invest.md` | Already the established pattern in this repo — Round 1/2/3 spawn 5 agents in parallel per round, and the existing Step 3a (`websearch-{ticker}`) already spawns one parallel `Agent` per `highlightedStocks` ticker using `model: sonnet`. Extending that exact pattern to the 12 `PORTFOLIO_HOLDINGS` tickers is a scope change, not a new mechanism. |
| Claude Code `WebSearch` tool (used inside subagents) | Built into Claude Code CLI | Per-holding research: earnings, lawsuits, regulation, contracts | Already proven working in this codebase's Step 3a/3b (WebSearch → JSON research summary → reevaluation round). No `allowed-tools` frontmatter change needed at the command level — subagents spawned via `Agent` get their own tool access independent of the parent command's `allowed-tools: [Bash, Agent]` list, which is why WebSearch/WebFetch already work inside `websearch-{ticker}` subagents today despite not being declared at the top of `invest.md`. |
| zod | ^4.3.6 (already installed, unchanged) | Validate/normalize LLM JSON output for the new holding-news and holding-research contracts | Already the project's sole validation library (`src/meeting/schemas.ts`). Extend the same file with new schemas rather than introducing a second validation approach. |

### Supporting Libraries

No new libraries needed. Reuse:

| Library/Module (existing) | Purpose | When to Use |
|---------|---------|-------------|
| `src/data/news/article-id.ts` (`assignArticleIds`) | Short `n01`-style IDs already assigned to every `tmp/news.json` entry | Reuse the existing ID for each per-holding news item when rendering the holding card link — do not invent a second ID scheme. `formatHoldingEvaluationsHtml` can look up `id → {title, url, source}` from the same pool the news-digest curator already uses. |
| `src/data/news/types.ts` (`RawNewsArticle.ticker`) | Per-article ticker tag set only by Finnhub company-news (v2.3) | Use `article.ticker === holding.symbol` for exact per-holding matching — see "What NOT to Use" for its coverage gap. |
| Node's native `fetch` (already used in `finnhub.ts`) | Any additional HTTP calls | If a future feature needs another HTTP call, keep using native `fetch` — no axios/node-fetch anywhere in this codebase today. |

### Development Tools

No new dev tools. Continue using `vitest` (already a devDependency) for the new zod schema tests and for a regression test on the `finnhub.ts` ticker bug fix.

## Installation

```bash
# No installation required for this milestone.
# All five v2.5 features are implemented with the existing dependency set:
#   dotenv, fast-xml-parser, tsx, typescript, yahoo-finance2, zod (deps)
#   @types/node, vitest (devDeps)
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|--------------------------|
| Reuse `tmp/news.json` + Finnhub company-news (already fetched) for per-holding news | Add a new news API (NewsAPI.org, Alpha Vantage News, Benzinga) dedicated to per-holding coverage | Only if Finnhub company-news + WebSearch prove insufficient in practice for JP holdings after a few days of live data — would require a new API key/secret and a new fetch module, which conflicts with the project's zero-new-deps convention and duplicates what Feature 2 (WebSearch) already does. |
| Declare all 12 `websearch-{ticker}` Agent calls in a single parallel message (extending the existing Step 3a pattern) | Add `p-limit`/`bottleneck` npm package to throttle concurrency in TS code | Only relevant if pipeline runs move from Claude Code's own orchestration into a TS-driven agentic loop (e.g., using the Agent SDK directly instead of slash-command markdown). Not applicable here — concurrency is controlled by how many `Agent` calls appear in one Claude Code message, not by TS code. |
| Extend `src/meeting/schemas.ts` with new schemas (`holdingResearchSchema`, or extend `holdingEvaluationSchema` with `relatedNews`) | Create a separate `schemas-portfolio-news.ts` file | Only if the file grows past the project's ~800-line file-size ceiling (currently ~300 lines) — not close to that yet. |
| `article.ticker === holding.symbol` exact match for per-holding news injection | Fuzzy company-name matching (holding.name / nameJa substring match against title/summary) for tickers with no `ticker` field | Only as a deliberate fallback for JP holdings if empty news sections prove unacceptable in review — fuzzy matching risks false positives (e.g., "Bank of Nagoya" matching unrelated regional-bank articles) and breaks the project's existing "structural prevention of hallucination/misattribution" convention (ID-reference pattern, Finnhub-ticker-is-ground-truth). Prefer explicit empty state over fuzzy guesses. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|--------------|
| A new News API for per-holding coverage | Finnhub company-news (v2.3, per-ticker) already exists and is the "土台" (foundation) called out in `.planning/PROJECT.md`; adding another API means a new secret, a new fetch module, and duplicate effort with Feature 2 (WebSearch), which already covers exactly the "material events" (earnings, lawsuits, regulation, contracts) this milestone wants | Reuse `fetchAllFinnhubNews`'s `company` array (once the `.map(toRawArticle)` bug is fixed) + the new per-holding WebSearch step |
| `article.ticker` as the *sole* signal for "does this holding have news today" | **Verified gap:** `collect-data.ts` only passes `usTickers` (US-listed symbols) into `fetchAllFinnhubNews`; the 4 JP holdings (`8522.T`, `5885.T`, `5576.T`, `7711.T`) never get Finnhub company-news, and no other news source (`google-news.ts`, RSS) tags a `ticker` field at all. A ticker-only per-holding news feed will silently show zero articles for 1/3 of the portfolio. | Treat per-holding ticker-tagged news (Feature 1) as US-holding enrichment on top of a WebSearch research pass (Feature 2) that covers all 12 holdings uniformly — do not rely on Feature 1 alone for JP holdings, and render an explicit "関連ニュースなし" state rather than fabricating a match. |
| `axios` / `node-fetch` | Zero usages in the current codebase; `finnhub.ts` and all other fetchers use native `fetch()`, which has been available in Node without a flag since Node 18 | Native `fetch()` |
| `p-limit`, `bottleneck`, or any TS-level concurrency limiter for the 12 WebSearch subagents | Subagent concurrency is controlled by Claude Code's own orchestration (how many `Agent` tool calls are issued in one message from the command markdown), not by TS code — there is no TS process spawning these agents to rate-limit | If concurrency needs tuning, batch the `Agent` calls across two markdown-level parallel blocks instead (see Stack Patterns below) |
| Renaming/aliasing the old `Task` tool syntax in `invest.md` | Claude Code renamed `Task` → `Agent` in a recent CLI release; `invest.md` already uses `Agent` correctly throughout | Keep using `Agent` as already done |
| A second ID scheme for holding-news links | The project already has a working, hallucination-proof ID-reference pattern (`n01`…`n99` via `assignArticleIds`, consumed by `news-curator`/`resolveNewsCuration`) | Reuse the same `id` field when wiring up `<a>` links on holding cards — do not have the `portfolio-analyst` subagent emit raw URLs (same rationale that drove the CURA-02 "ID参照方式" decision for news-digest) |

## Stack Patterns by Variant

**If spawning 12 parallel `websearch-holding-{ticker}` Agents in one message risks hitting Claude Code's practical concurrency ceiling:**
- The ~10-simultaneous-subagent figure reported in the community (GitHub issue [#15487](https://github.com/anthropics/claude-code/issues/15487)) is **not a documented hard API limit** — it's a practical/coordination-overhead observation, and this pipeline already runs unattended overnight via launchd with a generous time budget.
- Recommend firing all 12 in a single parallel message first (matches the existing 5-agent-per-round precedent exactly, just larger N) and only split into two batches of 6 (sequential parallel blocks, mirroring how Round 1 → Round 2 → Round 3 are already sequenced) if live runs show truncated/dropped results.
- Because fail-soft is already a house convention (per `.planning/PROJECT.md` Key Decisions), a per-holding WebSearch failure should fall back to the existing `{"ticker": "...", "researchSummary": "リサーチ失敗", ...}` shape (already defined in `invest.md` Step 3a) rather than blocking the pipeline — this pattern needs no new code, just reuse.

**If the `portfolio-analyst` subagent needs both per-holding news AND per-holding WebSearch research injected into one prompt:**
- Keep them as two distinct, TS-computed sections in the prompt (as `invest.md` already does for `moderator-tickers.json` vs `websearch/*.json`): a `## 保有銘柄別ニュース` block built by a small pure TS function filtering `tmp/news.json` by `ticker === holding.symbol`, and a `## 保有銘柄別WebSearchリサーチ` block reading `tmp/holding-research/{symbol}.json`. Do not merge them into a single schema — they have different provenance (TS-extracted fact vs LLM-summarized research) and different failure modes.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `zod@4.3.6` (installed) | Existing `.object().passthrough().transform()` patterns in `src/meeting/schemas.ts` | No API changes needed; `npm view zod version` currently reports `4.4.3` as latest — a minor bump is optional/cosmetic for this milestone, not required by any new schema needs (no v4.4-only API is needed here). |
| Claude Code CLI `Agent` tool + `WebSearch` tool | Already co-used successfully in `invest.md` Step 3a (existing feature, not new) | Confirms no CLI version gate blocks reusing this mechanism at a larger fan-out (12 holdings vs the current small `highlightedStocks` count, typically 1-3). |
| Anthropic `web_search` server tool (API-level reference, informs subagent behavior) | `max_uses` unset by default in Claude Code's built-in WebSearch (not user-configurable per the slash-command markdown level); errors surface as `too_many_requests`/`unavailable` inside a `web_search_tool_result_error`, not a thrown exception | Design the holding-research subagent's JSON fallback (already the `invest.md` Step 3a convention) to also catch "WebSearch produced no results" gracefully — an empty `positiveFindings`/`negativeFindings` array is a valid, expected output on a slow-news day. |

## Sources

- `/Users/arai/invest/.claude/commands/invest.md` (lines 1243–1700) — existing Step 3a/3b WebSearch + reevaluation pattern for `highlightedStocks`, the direct precedent to extend to `PORTFOLIO_HOLDINGS`
- `/Users/arai/invest/src/data/news/finnhub.ts` — confirmed the `.map(toRawArticle)` ticker-corruption bug (line 43: `Array.prototype.map` passes the array index as the second positional arg, which `toRawArticle`'s optional `ticker` parameter silently accepts)
- `/Users/arai/invest/src/scripts/collect-data.ts` — confirmed only `usTickers` are passed to `fetchAllFinnhubNews`, meaning JP holdings never receive Finnhub company-news
- `/Users/arai/invest/src/meeting/schemas.ts` — existing zod v4 patterns (`passthrough`, `transform`, ID-resolution via `resolveNewsCuration`) to extend for the new contracts; also confirmed a pre-existing workaround (line 277-282) that already treats numeric-index ticker values from the finnhub bug as non-string and drops them, evidence the corruption has been a live, silently-tolerated issue
- `/Users/arai/invest/src/data/news/article-id.ts` — existing hallucination-proof ID-reference convention to reuse for holding-card news links
- [Web search tool — Anthropic API docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool) — HIGH confidence, official docs, verified `max_uses`, domain filtering, and error-code behavior (`too_many_requests`, `max_uses_exceeded`, `unavailable`)
- [anthropics/claude-code issue #15487 — maxParallelAgents feature request](https://github.com/anthropics/claude-code/issues/15487) — MEDIUM confidence, community-reported ~10-subagent practical ceiling, not an official documented hard limit
- `npm view zod version` — confirmed latest is `4.4.3` vs installed `4.3.6` (HIGH confidence, direct registry query)

---
*Stack research for: Portfolio News Intelligence (v2.5) additions to an existing Claude Code + TypeScript investment pipeline*
*Researched: 2026-07-03*

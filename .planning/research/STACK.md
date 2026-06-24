# Stack Research

**Domain:** Claude Code Agent Migration (Gemini API → Claude Code ecosystem)
**Researched:** 2026-06-24
**Confidence:** HIGH

## What's Changing

This is a targeted migration. The existing TypeScript/tsx/yahoo-finance2/HTML stack is **unchanged**. Only the AI analysis layer changes.

| Layer | v1.0 (Current) | v2.0 (Target) |
|-------|----------------|---------------|
| Data fetching | TypeScript + yahoo-finance2 + Finnhub | Same — no change |
| AI analysis | @google/generative-ai (Gemini API) | Claude Code agents (no external API) |
| Image generation | @google/genai (NanoBanana) | Removed — text-only reports |
| Orchestration | `src/meeting/runner.ts` | Claude Code skill + subagents |
| Invocation | launchd cron | `/invest` skill command |

## Additions Required

### Skills (`.claude/skills/`)

**File: `.claude/skills/invest/SKILL.md`**

Skills are Markdown files with YAML frontmatter. Project-scoped skills live in `.claude/skills/<name>/SKILL.md`. Invoked as `/invest`.

```yaml
---
name: invest
description: Run daily investment analysis meeting with 5 analyst subagents
disable-model-invocation: true
allowed-tools: Bash Read Write Agent
---

Run daily investment analysis:
1. Execute `npx tsx src/data/market.ts` to collect market data
2. Spawn analyst subagents in parallel: fundamentals, ten-bagger, macro, technical, risk
3. Spawn moderator subagent to synthesize results
4. Write HTML report to reports/YYYY-MM-DD/
```

Key frontmatter fields for `/invest`:
- `disable-model-invocation: true` — prevents auto-trigger, user-only command
- `allowed-tools: Bash Read Write Agent` — pre-approves tools without per-use prompts
- Dynamic context via `` !`npx tsx src/data/market.ts` `` injects live market data before Claude sees it

### Subagents (`.claude/agents/`)

**File: `.claude/agents/<analyst-name>.md`**

Subagents are Markdown files with YAML frontmatter. Project-scoped subagents live in `.claude/agents/`.

Supported frontmatter fields relevant to this project:

| Field | Purpose | Example |
|-------|---------|---------|
| `name` | Unique identifier (lowercase, hyphens) | `fundamentals-analyst` |
| `description` | When Claude delegates to this subagent | `"Analyzes financial statements..."` |
| `tools` | Allowlist of tools | `Read, WebSearch, WebFetch` |
| `model` | Model alias or ID | `sonnet`, `haiku`, `claude-sonnet-4-6` |
| `permissionMode` | Permission handling | `auto` for no prompts |
| `maxTurns` | Cap on agentic turns | `20` |

**Example analyst subagent:**

```markdown
---
name: fundamentals-analyst
description: Analyzes financial statements, valuations, and earnings for stocks. Invoked during investment analysis meetings.
tools: Read, WebSearch, WebFetch, Bash
model: sonnet
permissionMode: auto
maxTurns: 15
---

You are a fundamentals analyst. Analyze the provided stocks for:
- P/E, P/B, EV/EBITDA valuations
- Revenue/earnings growth trends
- Balance sheet strength
- Competitive moat

Return structured findings in Japanese.
```

**5 analyst + 1 moderator files needed:**
1. `.claude/agents/fundamentals-analyst.md`
2. `.claude/agents/ten-bagger-hunter.md`
3. `.claude/agents/macro-economist.md`
4. `.claude/agents/technical-strategist.md`
5. `.claude/agents/risk-manager.md`
6. `.claude/agents/moderator.md`

### Tool Availability in Subagents

Built-in tools available to subagents (reference by string name in `tools` field):

| Tool | Purpose |
|------|---------|
| `Read` | Read files (market data JSON, portfolio holdings) |
| `Write` | Write HTML report output |
| `Bash` | Run TypeScript data collectors (`npx tsx src/data/*.ts`) |
| `WebSearch` | Find relevant news, earnings reports, analyst ratings |
| `WebFetch` | Fetch specific URLs (SEC filings, company pages) |
| `Grep` / `Glob` | Search codebase files |
| `Agent` | Spawn nested subagents (only if needed) |

**NOT available to subagents:**
- `AskUserQuestion` — requires interactive UI
- `EnterPlanMode` / `ExitPlanMode`
- `ScheduleWakeup`

### WebSearch Capabilities

- Input: search query string + optional `allowed_domains` / `blocked_domains`
- Output: list of `{title, url}` — titles and URLs only, no page content
- Requires follow-up `WebFetch` call to retrieve actual content
- Not available on Bedrock/Vertex (irrelevant here — using Claude Code directly)
- Best for: discovering news articles, earnings reports, analyst coverage when URL is unknown

### WebFetch Capabilities

- Input: known URL + question/prompt about the page
- Output: summarized answer (not raw HTML), processed by Claude Haiku internally
- 15-minute cache for repeated fetches of the same URL
- Max page content: ~10 MB fetch, truncated to ~100 KB for processing
- Best for: extracting specific data from a known SEC filing URL, investor relations page, news article

**Analyst research pattern:**
```
WebSearch("TICKER Q2 2026 earnings") → get URLs
WebFetch(url, "What were the revenue and EPS results?") → get data
```

## Removals Required

| Package | Reason | Action |
|---------|--------|--------|
| `@google/generative-ai` | Gemini text API — replaced by Claude Code agents | `npm uninstall @google/generative-ai` |
| `@google/genai` | NanoBanana image generation — charts removed in v2.0 | `npm uninstall @google/genai` |
| `GEMINI_API_KEY` in `.env` | No longer needed | Remove from `.env` and `.env.example` |
| `src/agents/*.ts` | Gemini-based agent TypeScript files | Delete or repurpose as data collectors |
| `src/meeting/runner.ts` | Gemini orchestration logic | Replace with Claude Code skill |

## What NOT to Add

| Avoid | Why |
|-------|-----|
| `@anthropic-ai/sdk` | Claude Code provides built-in agent capabilities — no SDK needed for skill/subagent execution |
| New npm AI packages | Claude Code tools (WebSearch, WebFetch, Agent) are built-in, no npm install required |
| New npm packages for HTTP/fetch | `WebFetch` handles URL fetching natively |
| TypeScript rewrite of agent logic | Subagents are Markdown files, not TypeScript — keep it simple |

## Data Passing Patterns

**Skill → Subagent:** Pass data via the Agent tool's prompt parameter (text only). Large datasets should be written to temp files first, then the subagent reads them.

**Pattern for market data:**
```
Skill: !`npx tsx src/data/market.ts > /tmp/market-data.json`
Analyst subagent: reads /tmp/market-data.json via Read tool
```

**Pattern for parallel analysts:**
The `/invest` skill orchestrates Claude's Agent tool calls. Claude spawns multiple analyst subagents in parallel. Each returns text findings. Moderator receives all findings as concatenated text.

## Model Selection for Subagents

| Role | Recommended Model | Reason |
|------|------------------|--------|
| Fundamentals Analyst | `sonnet` | Complex financial analysis |
| Ten-Bagger Hunter | `sonnet` | Research + pattern recognition |
| Macro Economist | `sonnet` | Nuanced macro interpretation |
| Technical Strategist | `haiku` | Pattern matching, lower complexity |
| Risk Manager | `sonnet` | Devil's advocate reasoning |
| Moderator | `sonnet` or `opus` | Synthesis quality matters most |

## Sources

- [Claude Code Skills documentation](https://code.claude.com/docs/en/skills) — skill format, frontmatter fields, dynamic context injection, invocation control — HIGH confidence
- [Claude Code Custom Subagents documentation](https://code.claude.com/docs/en/sub-agents) — subagent format, tool configuration, model selection, parallel execution — HIGH confidence
- [Inside Claude Code's Web Tools: WebFetch vs WebSearch](https://mikhail.io/2025/10/claude-code-web-tools/) — WebSearch/WebFetch capabilities, limitations, data formats — HIGH confidence

---
*Stack research for: Claude Code Migration (Gemini → Claude Code agents)*
*Researched: 2026-06-24*

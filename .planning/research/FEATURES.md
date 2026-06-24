# Feature Research

**Domain:** Claude Code Migration — Multi-Agent Investment Analysis Skill
**Researched:** 2026-06-24
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features the user (owner) expects as a baseline for a working v2.0. Missing these = migration is incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| `/invest` skill invocation | Entry point to the entire workflow; replaces `tsx src/index.ts` | LOW | SKILL.md in `.claude/skills/invest/` with `invocation: user` frontmatter |
| Market data collection (Yahoo Finance) | Core data source for all analysis; already implemented in TypeScript | LOW | Existing `src/data/market.ts` called via Bash tool from skill — no rewrite needed |
| News aggregation (Finnhub + Google News + RSS) | All analyst reasoning depends on current news; already implemented | LOW | Existing `src/data/news.ts` — same pass-through pattern as market data |
| 5 analyst subagents (Fundamentals, Ten-Bagger, Macro, Technical, Risk) | The core value prop; each analyst must run as a Claude Code subagent | HIGH | One subagent definition per analyst in `.claude/agents/`; system prompts ported from `src/agents/*.ts` |
| Moderator subagent (report synthesis) | Synthesizes analyst outputs into final report; already defined in v1.0 | MEDIUM | Moderator runs sequentially after all 5 analysts complete |
| WebSearch-based stock research | Replaces Google Search Grounding (Gemini-specific); Claude Code has built-in WebSearch tool | MEDIUM | Replaces `src/data/research.ts`; ticker extraction + per-ticker WebSearch inside a dedicated subagent |
| Bloomberg-style HTML report output | v1.0 report format must be preserved; user expects dark-theme HTML | MEDIUM | `src/report/generator.ts` logic stays; Claude writes structured markdown → existing TS renderer converts to HTML |
| Portfolio analysis section | Already in v1.0; portfolio holdings tracked in `src/portfolio/holdings.ts` | MEDIUM | `src/portfolio/data.ts` (Yahoo Finance fetch) stays; portfolio subagent replaces `src/portfolio/runner.ts` |
| US index fund strategy section | Already in v1.0 final report; user holds ~80% index funds | LOW | Handled by moderator prompt — no structural change needed |
| Gemini API dependency removal | Migration goal; keeping Gemini alongside Claude adds complexity and cost | LOW | Delete `src/gemini.ts`, `src/data/charts.ts`; remove `@google/generative-ai` and `@google/genai` packages |

### Differentiators (Competitive Advantage)

Features that make this Claude Code implementation better than the v1.0 Gemini implementation.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Parallel analyst subagents (fan-out pattern) | 5 analysts run simultaneously → faster total execution; v1.0 already uses `Promise.all` but within a single Gemini process | MEDIUM | Claude Code supports up to 10 simultaneous subagents; analyst subagents have no shared state so true parallelism works |
| Native WebSearch with no API key | Removes dependency on Google Search Grounding API; built into Claude Code | LOW | `WebSearch` tool available natively; no additional setup |
| Skill auto-discovery | Claude can invoke `/invest` proactively when user asks about portfolio or markets | LOW | Set `description` in SKILL.md to describe investment analysis trigger conditions |
| Per-analyst context isolation | Each subagent runs in its own context window; heavy research output doesn't pollute the main session or other analysts | MEDIUM | Subagent returns only final analysis text; orchestrator accumulates results |
| Text-based visualization | Removes chart image dependency (NanoBanana/Gemini); ASCII tables and structured text work in any context | LOW | Moderator formats data as markdown tables; existing HTML renderer handles display |
| Resumable subagents | If a subagent is interrupted, it can be resumed with full context; v1.0 had no retry capability | LOW | SendMessage to agentId resumes the same context; useful for long research rounds |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Chart image generation in v2.0 | v1.0 had visual charts; removing them feels like a regression | Claude Code cannot invoke image generation APIs natively; adds Gemini dependency back; images not renderable in Claude chat context | ASCII sparklines or markdown tables for numeric data; HTML report already handles visual formatting |
| launchd/cron auto-execution | v1.0 ran automatically at 8AM; automation feels convenient | Claude Code skills require an active session; background execution without a user prompt is not supported | User runs `/invest` manually when desired; simpler and more reliable than fighting launchd + session management |
| Real-time streaming analyst output | Seeing each analyst type live is engaging | Parallel subagents don't stream to parent context mid-execution; only final results arrive | Show progress log lines after each subagent completes (sequential completion events) |
| Interactive Q&A during meeting | User asks follow-up questions mid-meeting | Subagents can't pause waiting for user; the meeting is a batch process | Run `/invest` for full report; ask Claude follow-up questions in main session afterwards |
| Storing analyst state across days | Analysts "remember" previous recommendations | Subagent context is session-scoped; cross-day memory requires external storage | Summarize previous day's report in the prompt via existing `reports/` directory |

## Feature Dependencies

```
[/invest skill invocation]
    └──triggers──> [Bash: tsx data scripts]
                       └──produces──> [marketDataSummary, news, portfolioData strings]
                                           └──passes to──> [Orchestrator prompt]
                                                               └──spawns (parallel)──> [5 analyst subagents]
                                                                                           └──each returns──> [analysis text]
                                                               └──spawns (parallel)──> [stock research subagent]
                                                                                           └──uses──> [WebSearch tool]
                                                                                           └──returns──> [StockResearch[]  ]
                                                               └──spawns (sequential)──> [scoring round per analyst]
                                                               └──spawns (sequential)──> [moderator subagent]
                                                                                            └──writes──> [HTML report via tsx]

[portfolio analysis]
    └──requires──> [marketDataSummary] (shared dependency)
    └──requires──> [portfolioData from Yahoo Finance]
    └──feeds into──> [moderator final report]
```

### Dependency Notes

- **Analyst subagents require marketDataSummary and news:** Data collection scripts must complete before any subagent is spawned. The skill orchestrator runs `tsx` scripts first, captures stdout, then passes the text into subagent prompts.
- **Stock research requires ticker extraction:** The extraction step (identifying tickers from analyst outputs) must complete before WebSearch research begins. This is a sequential dependency within the research subagent.
- **Moderator requires all analyst outputs + research results:** Moderator is strictly the last subagent to run; it receives the full set of analyst analyses, research summaries, and scoring as input context.
- **HTML report requires moderator output:** The final `tsx` report generation script receives the moderator's markdown and converts it to HTML; this is the terminal step.
- **Chart removal resolves a dependency:** v1.0 depended on `@google/genai` for charts. Removing charts eliminates this package dependency entirely, simplifying the migration.

## MVP Definition

### Launch With (v2.0 — this milestone)

Minimum viable migration — Claude Code replaces Gemini, same output quality.

- [ ] `/invest` SKILL.md with `invocation: user` and orchestrator instructions
- [ ] 6 subagent definitions (5 analysts + moderator) with ported system prompts
- [ ] Bash-based data collection wiring (existing `market.ts`, `news.ts`, `portfolio/data.ts`)
- [ ] Research subagent using native WebSearch (replacing `src/data/research.ts`)
- [ ] Moderator subagent producing same report structure as v1.0 final summary
- [ ] HTML report generation via existing `src/report/generator.ts` (unchanged or minimally adapted)
- [ ] Gemini packages removed from `package.json`

### Add After Validation (v2.x)

- [ ] Scoring round as dedicated subagents (currently modeled as inline prompt calls; could be parallelized further)
- [ ] Portfolio subagent as a proper subagent definition (v2.0 may inline this into orchestrator)
- [ ] Skill auto-invocation tuning (description refinement after observing actual trigger behavior)

### Future Consideration (v3+)

- [ ] Cross-session analyst memory via report file injection (previous day summary → today's prompt)
- [ ] User-configurable analyst roster (add/remove analyst types via skill arguments)

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| `/invest` skill + orchestrator | HIGH | LOW | P1 |
| 5 analyst subagents | HIGH | MEDIUM | P1 |
| WebSearch stock research | HIGH | MEDIUM | P1 |
| Moderator + HTML report | HIGH | MEDIUM | P1 |
| Gemini dependency removal | HIGH | LOW | P1 |
| Portfolio subagent | MEDIUM | MEDIUM | P2 |
| Parallel subagent execution | MEDIUM | LOW | P2 |
| Text-based data visualization | MEDIUM | LOW | P2 |
| Skill auto-discovery tuning | LOW | LOW | P3 |

## Sources

- [Claude Code Skills Documentation](https://code.claude.com/docs/en/skills) — HIGH confidence (official docs)
- [Claude Code Subagents Documentation](https://code.claude.com/docs/en/sub-agents) — HIGH confidence (official docs)
- [Claude Code Subagent Best Practices](https://claudefa.st/blog/guide/agents/sub-agent-best-practices) — MEDIUM confidence
- [Claude Code Split-and-Merge Pattern](https://www.mindstudio.ai/blog/claude-code-split-and-merge-pattern-sub-agents) — MEDIUM confidence
- Existing codebase: `src/meeting/runner.ts`, `src/data/research.ts`, `src/agents/*.ts` — HIGH confidence (ground truth)

---
*Feature research for: Claude Code Migration of Investment Analysis Agent*
*Researched: 2026-06-24*

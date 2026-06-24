# Project Research Summary

**Project:** Investment Agent v2.0 — Gemini API to Claude Code Migration
**Domain:** Multi-agent investment analysis system (Claude Code skill + subagents)
**Researched:** 2026-06-24
**Confidence:** HIGH

## Executive Summary

This project is a targeted AI layer migration: the existing TypeScript/tsx/yahoo-finance2/HTML stack remains entirely intact, and only the AI analysis layer changes from Gemini API to Claude Code's native skill and subagent system. Experts building this class of system on Claude Code use a "skill as orchestrator" pattern — a single `.claude/commands/invest.md` skill file triggers data collection via Bash (existing TS scripts), spawns 5 analyst subagents in parallel, then routes their outputs to a moderator subagent for synthesis and HTML report generation via the existing `src/report/generator.ts`.

The recommended approach is a phased migration: first build the foundation (skill file + subagent definitions + data wiring), then validate the pipeline with real data, and finally remove all Gemini dependencies. The architecture preserves the proven two-layer model — TypeScript handles data and rendering, Claude handles analysis and reasoning — with JSON files in `tmp/` as the stable handoff boundary between layers. Image chart generation (NanoBanana/Gemini) is removed in v2.0; structured text and markdown tables replace visual charts.

The critical risks are token cost explosion (each of 6 parallel subagents holds an independent context window, multiplying costs), unstructured agent output breaking the report pipeline, and Google Search Grounding quality degradation when replaced by Claude's native WebSearch. All three are preventable with upfront design: per-agent data scoping (not full market data to all agents), strict JSON output schemas in system prompts, and retaining Finnhub/RSS APIs as primary news sources with WebSearch used only for qualitative research.

## Key Findings

### Recommended Stack

The AI layer migration requires zero new npm packages. Claude Code provides built-in `WebSearch`, `WebFetch`, `Read`, `Write`, `Bash`, and `Agent` tools natively — no `@anthropic-ai/sdk` install needed. The two Gemini packages (`@google/generative-ai` for text, `@google/genai` for image generation) are removed entirely, along with `GEMINI_API_KEY`. New artifacts are Markdown files (skill definition + 6 subagent definitions) that live in `.claude/commands/` and can be extended without TypeScript changes.

**Core technologies:**
- **TypeScript + tsx**: Data collection and report rendering — unchanged, authoritative data layer
- **yahoo-finance2 v3**: Stock/index price data — unchanged; `new YahooFinance()` instantiation required (not default import)
- **Claude Code Skills (`.claude/commands/invest.md`)**: Orchestration entry point — replaces `src/index.ts` and `src/meeting/runner.ts`
- **Claude Code Subagents (`.claude/agents/*.md`)**: 5 analysts + moderator as Markdown files — replaces `src/agents/*.ts` Gemini wrappers
- **WebSearch / WebFetch (built-in tools)**: Stock research — replaces Google Search Grounding in `src/data/research.ts`
- **Sonnet for analysis agents, Haiku for lighter roles**: Cost-optimized model selection per subagent role

### Expected Features

**Must have (table stakes — v2.0 scope):**
- `/invest` skill invocation — entry point replacing `npx tsx src/index.ts`
- Market data collection via existing Yahoo Finance TS scripts
- News aggregation via existing Finnhub + RSS TS scripts
- 5 analyst subagents (Fundamentals, Ten-Bagger, Macro, Technical, Risk Manager)
- Moderator subagent for synthesis and scoring
- WebSearch-based stock research (replaces Google Search Grounding)
- Bloomberg-style HTML report output via existing `generator.ts`
- Portfolio analysis section
- Gemini dependency removal (`@google/generative-ai`, `@google/genai`, `GEMINI_API_KEY`)

**Should have (differentiators over v1.0):**
- Parallel analyst subagent execution (fan-out pattern)
- Per-analyst context isolation
- Native WebSearch with no additional API key

**Defer (v2.x+):**
- Scoring round as dedicated parallel subagents
- Cross-session analyst memory via prior report injection
- Skill auto-invocation tuning

**Anti-features (do not build):**
- Chart image generation — requires Gemini dependency; images not renderable in Claude chat
- launchd/cron auto-execution — Claude Code skills require active session

### Architecture Approach

The architecture uses a clean two-layer separation: TypeScript handles all data fetching and HTML rendering, Claude handles all analysis and reasoning. These layers communicate through JSON files in `tmp/` (TS → Claude handoff) and a `meeting-result.json` (Claude → TS handoff for report generation).

**Major components:**
1. `.claude/commands/invest.md` — Skill orchestrator; triggers data collection, spawns subagents, routes results to report builder
2. `.claude/agents/*.md` (6 files) — Analyst + moderator subagent definitions with system prompts ported from `src/agents/*.ts`
3. `src/scripts/collect-data.ts` — Pure data collection; writes `tmp/*.json`; no AI calls
4. `src/scripts/build-report.ts` — Pure rendering; reads `tmp/meeting-result.json`; writes HTML; no AI calls
5. `src/data/market.ts`, `src/data/news.ts`, `src/portfolio/data.ts` — Unchanged TypeScript data layer

**Deleted components:**
- `src/gemini.ts`, `src/data/charts.ts`, `src/data/news/analyzer.ts`, `src/data/research.ts`
- `src/meeting/runner.ts`, `src/portfolio/runner.ts`, `src/index.ts`

### Critical Pitfalls

1. **サブエージェントトークンコスト爆発** — 各アナリストに必要なデータのみを絞って渡す（全市場データを全エージェントに渡さない）
2. **アナリスト出力の非構造化によるJSONパース失敗** — 各アナリストのシステムプロンプトに厳密なJSONスキーマ例を含める
3. **Google Search Grounding → WebSearch品質劣化** — 株価・財務数値は必ずYahoo Finance API経由；WebSearchは定性情報に限定する
4. **スキル実行フローの実行順序崩壊** — スキルプロンプトにステップ依存関係を明示；データ収集完了確認後にエージェントスポーンする
5. **`allowed-tools`フロントマター不動作（既知バグ）** — ツール制限はシステムプロンプト内の明示的禁止指示で担保する

## Implications for Roadmap

### Phase 1: Foundation — Skill, Subagents, Data Wiring
**Rationale:** The skill and subagent definitions are the architectural core; token cost and output structure pitfalls must be designed in from day one.
**Delivers:** Working `/invest` skill that collects data, spawns all 6 subagents, outputs raw analyst text
**Addresses:** Pitfall 1 (token cost), Pitfall 2 (unstructured output), Pitfall 4 (execution order), Pitfall 5 (allowed-tools bug)

### Phase 2: Data Layer Cleanup + WebSearch Integration
**Rationale:** Once skill runs, clean data layer and validate WebSearch quality against Finnhub/RSS before removing Gemini.
**Delivers:** Research subagent using WebSearch for qualitative research; data sources validated
**Addresses:** Pitfall 3 (Search quality degradation)

### Phase 3: Report Builder + Moderator Integration
**Rationale:** Report generation depends on stable agent output quality; build after Phase 1 validates output structure.
**Delivers:** Full end-to-end pipeline: `/invest` → data → 5 analysts → moderator → HTML report

### Phase 4: Gemini Dependency Removal + Cleanup
**Rationale:** Remove Gemini dependencies only after Claude Code pipeline is validated end-to-end.
**Delivers:** Clean codebase with zero Gemini references

### Research Flags

Needs research: **Phase 1** (subagent JSON output enforcement strategy), **Phase 2** (WebSearch freshness for Japanese stocks)
Standard patterns: **Phase 3** (TypeScript report generation), **Phase 4** (deterministic dependency removal)

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Official Claude Code docs; confirmed via direct codebase inspection |
| Features | HIGH | Existing codebase is ground truth; official docs confirm capability set |
| Architecture | HIGH | Direct codebase inspection; all component responsibilities verified |
| Pitfalls | HIGH | Official docs, verified GitHub issues, confirmed incident reports |

**Overall confidence:** HIGH

### Gaps to Address

- **Subagent JSON output reliability:** Test system-prompt-schema vs. structured outputs API during Phase 1
- **WebSearch Japanese stock coverage:** Validate during Phase 2; fallback is Finnhub + RSS
- **Skill file size limits:** Monitor during Phase 1; externalize system prompts if needed
- **Concurrent subagent limits:** Measure during Phase 1

## Sources

### Primary (HIGH confidence)
- Claude Code Skills documentation
- Claude Code Custom Subagents documentation
- Structured outputs — Claude API Docs
- Existing codebase: `src/meeting/runner.ts`, `src/data/research.ts`, `src/agents/*.ts`

### Secondary (MEDIUM confidence)
- Claude Code WebSearch/WebFetch tool analysis
- Claude Code Subagent Best Practices guides

---
*Research completed: 2026-06-24*
*Ready for roadmap: yes*

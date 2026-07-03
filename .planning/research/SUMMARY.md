# Project Research Summary

**Project:** Investment Agent — v2.5 Portfolio News Intelligence
**Domain:** Feature restoration + integration on an existing Claude-Code-orchestrated, multi-agent daily investment report pipeline (personal-use tool)
**Researched:** 2026-07-03
**Confidence:** HIGH

## Executive Summary

v2.5 is a restoration project, not greenfield feature discovery: it rebuilds a capability v1.0 already had (per-holding news + WebSearch research + hold/sell re-evaluation, deleted during the v2.0 Gemini→Claude Code migration) on top of the current v2.x architecture (single opus `portfolio-analyst` subagent + zod-validated JSON handoff, rather than the old 5-agent multi-round TS loop). All research agrees on one structural conclusion: **every piece of this milestone has a direct, working precedent already in the codebase** — the Step 3a/3b per-ticker parallel WebSearch pattern (currently scoped to `highlightedStocks`), the ID-reference anti-hallucination resolver (`resolveNewsCuration`, proven in news-digest), and the ANLQ-01 prior-day cross-session injection pattern. No new runtime dependencies are needed; this is 100% wiring, extension, and one bug fix on the existing TypeScript + Claude Code stack.

The recommended approach is: (1) fix a real, currently-live `finnhub.ts:43` ticker-contamination bug first (a genuine `tsc` compile error masked by the project having no typecheck script), since it corrupts the exact `article.ticker` field the new per-holding matching logic depends on; (2) extract per-holding news via a new deterministic (non-LLM) TS module, not an agent ID-selection round, because "which articles mention holding X" is a mechanical filter, not an editorial judgment; (3) reuse the existing Step 3a WebSearch-per-ticker Agent pattern verbatim for the 12 holdings, writing to a **new** directory so results never leak into the Daily Report; and (4) feed all new context (holding news, WebSearch research, yesterday's decision) into the **same existing single `portfolio-analyst` call** rather than spawning a second 5-agent "reeval fleet" — the Portfolio Report has one decision-maker, not a team, so Step 3b's reeval pattern does not map onto it.

The dominant risk cluster is **silent, undetected degradation**, not crashes: JP small-cap holdings (4 of 12) will show near-empty news because Finnhub company-news is US-centric and no other source tags `ticker`; two tickers (`EE`, `NXT`) collide with unrelated real-world entities (a UK telecom brand, a UK retailer) and will contaminate bare-ticker WebSearch queries; reusing `tmp/websearch/`/`tmp/reeval/` directories would silently leak holdings research into the Daily Report; and anchoring-biased re-evaluation prompts risk producing `changed: false` every day regardless of actual news, quietly defeating the milestone's core value proposition. All of these degrade gracefully (valid JSON, no pipeline failure) which is precisely why they need explicit detection/verification steps built into the relevant phases rather than being caught by "it ran without errors."

## Key Findings

### Recommended Stack

No new technologies, libraries, or dependencies are required for v2.5. All five target features are implementable using capabilities already present in this repository: the Claude Code `Agent` tool for parallel per-holding subagent fan-out (already used for `highlightedStocks` in Step 3a), the Claude Code `WebSearch` tool (already proven inside Step 3a/3b subagents), `zod` (already the sole validation library, extend `src/meeting/schemas.ts`), and native `fetch` for any incidental HTTP needs. The one open question — whether 12 parallel WebSearch subagents risk Claude Code's practical concurrency ceiling (~10, community-reported, not a documented hard limit per GitHub issue #15487) — is not blocking; the recommendation is to fire all 12 in one parallel message first (matching the existing precedent) and only split into two batches of 6 if live runs show truncation.

**Core technologies (all pre-existing, zero new installs):**
- Claude Code `Agent` tool — parallel per-holding subagent fan-out, extending the proven Step 3a pattern from `highlightedStocks` (typically 1-3 tickers) to the fixed 12 `PORTFOLIO_HOLDINGS`
- Claude Code `WebSearch` tool — per-holding research (earnings, lawsuits, regulation, contracts), already working inside Step 3a/3b subagents with no `allowed-tools` frontmatter changes needed
- `zod` (^4.3.6, installed) — extend `src/meeting/schemas.ts` with new/extended schemas for holding research and evaluation contracts, reusing existing `.passthrough().transform()` alias patterns

### Expected Features

This is a small, well-scoped milestone where all five target features from PROJECT.md are P1 (must-have for launch), not stretch goals — restoring a previously-validated capability rather than exploratory discovery.

**Must have (table stakes):**
- finnhub.ts ticker-contamination bugfix — blocking prerequisite; must land before any ticker-matching logic is built or tested
- Per-holding news matched by ticker, supplied to `portfolio-analyst` — the data foundation for everything else
- Related news on holding cards (headline/source/link, ID-referenced, capped 3-5/holding) — the visible half of "news-informed"
- WebSearch-based per-holding research + re-evaluation (decision change + urgency flags for earnings miss/lawsuit/regulatory change/major contract) — the milestone's actual differentiator, must not be deferred
- Graceful no-news handling per holding (explicit empty state, not silent omission)
- New-candidates section removed from `portfolio-report.html` (context to `portfolio-analyst` retained — do not strip `highlightedStocks` from the prompt)

**Should have (differentiators, P1-P2):**
- Decision-change tracking vs. previous day (`previousDecision`/`decisionChanged`), reusing the shipped ANLQ-01 prior-day injection pattern
- Urgency-flagged card styling (visual differentiation once an `urgency` field exists)
- Staleness/priority-aware article selection within each holding card

**Defer (v2.6+):**
- XREP-01 cross-reference between news-digest themes and holding cards (pipeline-ordering dependency, already flagged deferred in PROJECT.md)
- Historical urgency-flag audit trail / weekly rollup (no persistent storage infra beyond daily `tmp/`/`docs/`)
- Position-sizing-aware rebalance suggestions (blocked on missing holding-percentage data, not implementation choice)
- Full v1.0 multi-round meeting revival, real-time/intraday alerts, per-article LLM sentiment scoring, unbounded article counts, and re-introducing "candidates" inside re-evaluation — all explicitly rejected as anti-features/scope creep

### Architecture Approach

The existing pipeline (collect-data → 5-analyst/3-round meeting → Step 3a/3b candidate WebSearch+reeval → Step 3d portfolio-analyst+news-curator in parallel → report generation) already contains a working, directly-reusable precedent for every mechanism v2.5 needs. The key architectural decisions are: treat per-holding news extraction as a **deterministic TS module** (not an LLM ID-selection round) since ticker matching is mechanical, not editorial; reuse the Step 3a per-ticker parallel-Agent WebSearch pattern **verbatim** but write to a brand-new `tmp/portfolio-research/` directory (never `tmp/websearch/`, which is read wholesale by the Daily Report loader); and route all new context into the **single existing** `portfolio-analyst` call rather than adding a second 5-agent reeval fleet, since the Portfolio Report has exactly one decision-maker. `decisionChanged` and `relatedNews` must be computed by TypeScript post-processing after the agent returns, never self-reported by the LLM — this mirrors the project's established "never trust LLM self-assessment when TS can verify deterministically" philosophy (same rationale as `resolveNewsCuration`).

**Major components (new/modified):**
1. `src/data/news/finnhub.ts` (MODIFY) — fix line 43 `.map(toRawArticle)` index-as-ticker bug; true prerequisite, currently a masked `tsc` compile error
2. `src/portfolio/holding-news.ts` (NEW) — pure, TDD'd function matching news articles to holdings (ticker match + JP name-substring fallback for holdings with no Finnhub coverage)
3. `src/scripts/extract-holding-news.ts` (NEW) — thin script wrapper writing `tmp/holding-news.json`, run as a new pipeline prep step before Step 3d
4. 12 parallel `model: sonnet` Agents (invest.md, NEW step) — per-holding WebSearch research → `tmp/portfolio-research/{symbol}.json`, reusing the existing `WebSearchResult` type/schema unchanged
5. `src/meeting/schemas.ts` / `types.ts` (MODIFY) — extend `HoldingEvaluation` with `relatedNews`/`decisionChanged`/`previousDecision`; add `resolvePortfolioHoldingNews()` alongside `resolveNewsCuration()`
6. `src/scripts/report-data-loaders.ts` (MODIFY) — `loadPortfolioAnalysis()` becomes the convergence point loading the news pool, holding-news map, and previous-day snapshot, then attaching fields deterministically
7. `src/scripts/generate-portfolio-report.ts` (MODIFY) — delete both call sites of `formatNewCandidatesHtml` (success **and** null-fallback branches); add related-news + decisionChanged rendering

### Critical Pitfalls

1. **Directory collision leaks holdings research into the Daily Report** — `loadWebSearchResults()`/`loadReevalResults()` read every file in `tmp/websearch/`/`tmp/reeval/` indiscriminately with no origin filter. Avoid by using entirely new directories (`tmp/portfolio-research/`, etc.) with dedicated loaders scoped only to the Portfolio Report; verify with an isolation test asserting Daily Report output is byte-identical with/without holdings-research files present.
2. **Removing the new-candidates renderer breaks the `portfolioAnalysis === null` fallback path** — `formatNewCandidatesHtml` is called at two sites (success branch and null-fallback branch); a naive removal only touches the visible happy path. Avoid by grepping for all call sites and testing the null-fallback branch explicitly.
3. **finnhub.ts ticker bug fix has real (if benign) ripple effects** — the classic `.map(callback-with-extra-arg)` footgun currently gives every general/merger article a numeric `ticker` (index 0 is falsy, index 1+ truthy) instead of `undefined`; must fix before building `holding-news.ts` so tests aren't written against contaminated fixtures, and needs an explicit regression test across multiple array indices.
4. **Per-holding news silently under-covers JP small-cap holdings** — only Finnhub `company-news` populates `article.ticker`; none of the other sources (Google News JP, RSS) do, and Finnhub is US-centric, so the 4 JP holdings will show near-empty news lists indefinitely with no error. Avoid by making the coverage boundary an explicit, documented MVP scope decision and rendering a visible "no coverage" state rather than a silently empty section; measure actual per-holding match counts on a live run before shipping.
5. **Ticker-only WebSearch queries collide with unrelated entities** — `EE` (Excelerate Energy) collides with EE Limited (UK mobile carrier); `NXT` (Nextpower) collides with NEXT plc (UK retailer) and historically an unrelated cryptocurrency. Avoid by always pairing ticker + company name in WebSearch queries and instructing the agent to verify entity identity before including a result; spot-check EE/NXT specifically during verification.
6. **Doubling WebSearch fan-out increases rate-limit exposure and runtime with no documented budget** — adding a 12-holding WebSearch round roughly doubles peak parallel Agent/WebSearch concurrency within one unattended run, and Claude Code has documented 429/529 failures with no auto-backoff. Avoid by explicitly deciding sequential-vs-parallel execution as a named phase decision, applying the existing partial-success fail-soft pattern, and tracking duration via the existing `pipeline-metrics.json` infrastructure.

## Implications for Roadmap

Based on combined research, the dependency chain is clear and largely linear with two independently-parallelizable branches (news extraction vs. WebSearch research), converging at the `portfolio-analyst` prompt integration step.

### Phase 1: Data Foundation — Ticker Bugfix + Deterministic Holding-News Extraction
**Rationale:** The finnhub.ts bug is a true prerequisite (currently a masked `tsc` error) that must be fixed before any ticker-matching logic is built or tested against clean data; holding-news extraction is a pure, independently testable TS module with no agent/prompt dependency, so it can be fully built and TDD'd in isolation.
**Delivers:** Fixed `finnhub.ts:43`, regression test asserting `ticker === undefined` for general/merger articles at every array index; new `src/portfolio/holding-news.ts` (ticker match + JP name-substring fallback) with unit tests; `extract-holding-news.ts` script producing `tmp/holding-news.json`.
**Addresses:** finnhub.ts ticker-contamination fix, per-holding news supply (data foundation) from FEATURES.md.
**Avoids:** Pitfall 3 (bug-fix ripple caught by regression test), Pitfall 4 (JP under-coverage made explicit and measured, not assumed).

### Phase 2: Holding-Card News Display (ID-Reference, No LLM URL Emission)
**Rationale:** Once `tmp/holding-news.json` exists, wiring it into the report is a rendering + schema-extension task independent of the WebSearch research work — can proceed in parallel with Phase 3, both converging on Phase 4.
**Delivers:** `HoldingEvaluation`/`HoldingNewsRef` type extensions, `resolvePortfolioHoldingNews()` in `schemas.ts` (deterministic symbol-keyed attachment, TS never trusts LLM-authored URLs), holding-card rendering with capped (3-5) related news per holding, explicit "no news today" empty state.
**Uses:** ID-reference resolution pattern from STACK.md/ARCHITECTURE.md (proven in news-digest).
**Implements:** Pattern 1 (Deterministic Attachment Instead of LLM Self-Report) from ARCHITECTURE.md.
**Avoids:** Pitfall 10 (per-holding article cap), Pitfall 11 (distinguish "no news" from "reassessed, unchanged" in UI), the ID-reference cross-holding-leakage gotcha from PITFALLS.md.

### Phase 3: Portfolio WebSearch Research (12-Ticker Parallel Fan-Out)
**Rationale:** Independent of Phases 1-2 in implementation (only needs the fixed `PORTFOLIO_HOLDINGS` list, not the news-extraction module), but is the milestone's core differentiator and highest-complexity piece — reuses the Step 3a per-ticker Agent pattern verbatim, in a new directory.
**Delivers:** 12 parallel `model: sonnet` Agents → `tmp/portfolio-research/{symbol}.json`, reusing `WebSearchResult` type/schema unchanged; company-name-paired query templates (not bare tickers) with explicit entity-verification instruction; partial-success fail-soft handling (N/12 pattern); `[STEP:portfolio-research:*]` pipeline markers and duration metrics.
**Delivers (schema hardening):** Alias-transform (`passthrough().transform()`) applied to any new/extended holding-research schema, backported consideration for `webSearchResultSchema`/`reevaluationOutputSchema`.
**Avoids:** Pitfall 1 (new directory, never `tmp/websearch/`), Pitfall 5 (EE/NXT collision — company name in queries, manual spot-check), Pitfall 6 (sequential-vs-parallel decision documented, partial-success fail-soft), Pitfall 7 (log every catch branch), Pitfall 8 (alias-transform schema).

### Phase 4: Portfolio-Analyst Integration — Re-Evaluation + Decision-Change Tracking
**Rationale:** Converges Phases 1-3; must come last because it depends on `tmp/holding-news.json` (Phase 1), the holding-card schema fields (Phase 2), and `tmp/portfolio-research/*.json` (Phase 3) all being available, plus introduces the previous-day snapshot mechanism.
**Delivers:** `tmp/prev-portfolio-analysis.json` snapshot mechanism (mirrors shipped ANLQ-01 pattern); three new conditional prompt sections in `portfolio-analyst` (holding news, WebSearch research, prior-day decision), each gated on file existence; independent-then-compare prompt framing to counter anchoring bias; TS-computed `decisionChanged`/`previousDecision` post-processing (never LLM self-report); urgency signal folded into existing `riskNote` field (no new schema surface).
**Implements:** Decision 3 (single-pass re-evaluation, no second reeval fleet) from ARCHITECTURE.md.
**Avoids:** Pitfall 9 (anchoring bias — explicit independent-first prompt framing, track `changed:true/false` ratio as a live health metric over multiple days, not a single test run).

### Phase 5: New-Candidates Section Removal
**Rationale:** Smallest, most isolated change; can technically run any time after Phase 4 confirms `portfolio-analyst` no longer needs the removed section for anything, but is sequenced last to avoid touching the renderer while other phases are still modifying it, and because its main risk (the null-fallback branch) is best verified once the full new rendering surface is stable.
**Delivers:** Deletion of both `formatNewCandidatesHtml` call sites (success **and** null-fallback branches); `MeetingResult.highlightedStocks` plumbing to `portfolio-analyst` prompt context explicitly retained.
**Addresses:** New-candidates section removal from FEATURES.md/PROJECT.md.
**Avoids:** Pitfall 2 (fallback-path regression) — explicit test constructing a `portfolioAnalysis === null` report and asserting the table is absent.

### Phase Ordering Rationale

- Phase 1 must be first: it is a genuine data-integrity prerequisite (not cosmetic) that every subsequent ticker-matching phase depends on for clean test fixtures.
- Phases 2 and 3 can be built in parallel (different files, different directories, no shared state) but both must complete before Phase 4, which is the single integration point where all three data sources (holding news, WebSearch research, prior-day decisions) converge into one prompt.
- Phase 4 is deliberately scoped as "extend the single existing `portfolio-analyst` call," not "add a second agent fleet" — this is the architecture research's strongest, most explicit recommendation, and getting the phase boundary wrong here (treating re-evaluation as a Step-3b-style 5-agent round) would be the single most expensive design mistake available in this milestone.
- Phase 5 is sequenced last because it is low-risk and isolated, and its verification (null-fallback path) is easiest to reason about once the rest of the holding-card rendering surface has stabilized.
- This ordering directly avoids Pitfalls 1, 2, 3, 5, 6, 8, and 9 by construction (bugfix-first, isolated directories, deferred low-risk removal) rather than requiring after-the-fact detection.

### Research Flags

Needs deeper research during planning:
- **Phase 3 (Portfolio WebSearch Research):** Highest complexity and highest external-uncertainty item — the sequential-vs-parallel concurrency decision, actual behavior under Claude Code's practical subagent ceiling, and rate-limit/backoff behavior are not fully resolved by this research pass (MEDIUM confidence on the concurrency ceiling specifically) and should be validated with a live run before finalizing the phase plan.
- **Phase 4 (Portfolio-Analyst Integration):** The anchoring-bias mitigation (independent-then-compare prompt framing) is grounded in general LLM literature, not project-specific empirical data — the `changed:true/false` ratio needs to be tracked over several live days as part of this phase's success criteria, which may require a follow-up validation step beyond initial implementation.

Phases with standard, well-documented patterns (research-phase likely unnecessary):
- **Phase 1 (Data Foundation):** Bug fix and pure-function extraction are fully specified by direct code inspection; TDD approach is the codebase's established convention.
- **Phase 2 (Holding-Card News Display):** Directly reuses the shipped, proven `resolveNewsCuration`/ID-reference pattern from news-digest with only the resolution key changed (symbol vs. ID).
- **Phase 5 (New-Candidates Removal):** Small, mechanical deletion with a clear verification checklist already defined in PITFALLS.md.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Verified directly against existing codebase behavior and official Anthropic docs; only the Claude Code CLI concurrency ceiling is MEDIUM (community-reported GitHub issue, not a documented hard limit) |
| Features | MEDIUM-HIGH | Primary source is this project's own proven v1.0 implementation (HIGH-confidence internal precedent, recoverable via git history) plus PROJECT.md's explicit target features; general industry patterns (S&P Capital IQ-style dashboards) are MEDIUM-confidence supporting evidence, not primary drivers |
| Architecture | HIGH | All findings verified directly against current codebase (file paths, line numbers, `npx tsc --noEmit` output confirming the real compile error), not training-data assumptions |
| Pitfalls | HIGH | Grounded directly in current codebase inspection (finnhub.ts, filter.ts, schemas.ts, generate-report.ts, invest.md Step 3a-3d) plus MEDIUM-confidence external verification (WebSearch rate-limit GitHub issues, LLM anchoring-bias academic literature) |

**Overall confidence:** HIGH

### Gaps to Address

- **Actual JP small-cap news coverage volume:** Research establishes the coverage gap exists in principle (no source but Finnhub company-news tags `ticker`, Finnhub is US-centric) but the real-world frequency/severity for the 4 specific JP holdings is unmeasured — Phase 1/4 should include a live-run audit logging per-holding match counts before deciding whether a keyword/name-substring fallback (already recommended) is sufficient or whether further scope adjustment is needed.
- **Real subagent concurrency ceiling for 12 parallel WebSearch Agents:** The ~10-simultaneous-subagent figure is community-reported (GitHub issue #15487), not an official documented limit. Phase 3 planning should include a live-run validation step before committing to "all 12 in one message" vs. "two batches of 6," rather than assuming the naive approach works from research alone.
- **Anchoring-bias mitigation efficacy:** The independent-then-compare prompt framing is a reasoned mitigation based on general LLM literature, not validated against this project's specific `portfolio-analyst` prompt. The `changed:true/false` ratio metric should be tracked as an ongoing health signal post-launch, and Phase 4's plan should define what ratio would trigger a prompt-framing revisit.
- **Sequential vs. parallel execution of the two WebSearch rounds (candidates + holdings):** Explicitly flagged in both ARCHITECTURE.md and PITFALLS.md as a decision that must be made deliberately during Phase 3 planning, not left to implementation-time improvisation — no research finding definitively resolves it either way; it is a runtime-vs-concurrency-risk tradeoff requiring a human/planning-time judgment call.

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection: `.claude/commands/invest.md` (Step 3a-3d), `src/data/news/finnhub.ts`, `src/data/news/filter.ts`, `src/data/news/article-id.ts`, `src/meeting/schemas.ts`, `src/meeting/types.ts`, `src/scripts/generate-report.ts`, `src/scripts/generate-portfolio-report.ts`, `src/portfolio/holdings.ts`
- `npx tsc --noEmit` run directly against the repo — confirmed the `finnhub.ts:43` compile error is real and currently unenforced (no typecheck script in `package.json`)
- `git show ba01275^:src/portfolio/runner.ts` and `git show ba01275^:src/data/research.ts` — v1.0 precedent implementation (deleted in v2.0 Gemini removal, recoverable via git history)
- `.planning/PROJECT.md` — milestone target features, constraints, out-of-scope decisions, prior incident history (Phase 13/14.1 fail-soft masking, field-name invention)
- [Web search tool — Anthropic API docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool) — official docs, verified `max_uses`, domain filtering, error-code behavior

### Secondary (MEDIUM confidence)
- [anthropics/claude-code issue #15487 — maxParallelAgents feature request](https://github.com/anthropics/claude-code/issues/15487) — community-reported ~10-subagent practical ceiling
- [GitHub anthropics/claude-code#27074 — WebSearch rate limit reached](https://github.com/anthropics/claude-code/issues/27074) and [#68502 — 529 overloaded hard-fails](https://github.com/anthropics/claude-code/issues/68502) — community-reported reliability issues under concurrent load
- [AI Portfolio Analysis (Barebone AI)](https://barebone.ai/resources/ai-portfolio-analysis-5-agents), [Designing Agentic AI-Based Screening for Portfolio Investment (arXiv)](https://arxiv.org/pdf/2603.23300), [Top 10 Investment Research Tools (Visualping)](https://visualping.io/blog/investment-research-tools) — supporting evidence that news-triggered materiality flagging and multi-signal buy/sell agent deliberation match industry patterns
- Anchoring bias literature: arXiv 2412.03605 (CBEval), arXiv 2505.15392 — general LLM anchoring-bias findings, applied here as a reasoned risk assessment for this project's specific re-evaluation prompt design

### Tertiary (LOW confidence)
- WebSearch results on generic staleness/relevance ranking in stock dashboards — used only to corroborate that priority-tiering/recency-awareness is standard practice, not to source specific thresholds (thresholds already exist in-house via NEWS-02)

---
*Research completed: 2026-07-03*
*Ready for roadmap: yes*

# Project Research Summary

**Project:** Investment Agent — Entry Timing Watchlist & ETF Exclusion (v2.7)
**Domain:** Extension of an existing daily-batch, multi-agent (Claude Code subagents) investment analysis pipeline — adding a persisted bullish-stock watchlist, deterministic ETF exclusion, and a daily LLM+TS buy-timing ("buy today"/"wait") judgment
**Researched:** 2026-07-15
**Confidence:** HIGH

## Executive Summary

v2.7 is a **greenfield feature built entirely on an established architecture** — not a new system. All four research passes agree this is a zero-new-dependency milestone: `yahoo-finance2@3.13.2`'s `quote().quoteType` field gives free, deterministic ETF/equity classification (verified live against both US and JP tickers, including `1306.T`), `zod@4.3.6`'s `.passthrough().transform()` alias-hardening pattern already proven for `urgent`/`decisionChanged` extends cleanly to a new buy-timing verdict schema, and the `data/urgency-history.json` + `write-urgency-history.ts` pure-module/fail-soft-wrapper split is a directly reusable template for watchlist persistence. The project's own hard-won doctrine — "never trust LLM self-report for anything TS can determine deterministically" — is the single most load-bearing constraint across all four research files and should govern every implementation decision in this milestone.

The recommended approach: (1) a standalone `etf-exclusion.ts` module applying `quoteType`-based filtering at two independent call sites (post meeting-result finalization, and again inside watchlist admission); (2) a ticker-keyed (not date-keyed) `data/watchlist.json` current-state table with explicit `addedDate`/`lastVerdictDate`/`removedReason` fields, built via the proven pure-module + fail-soft-CLI-wrapper split; (3) daily tracking data supply reusing `collect-technicals.ts` and a generalized `holding-news.ts` matcher verbatim; (4) a new Claude Agent judgment step (model: sonnet) producing a zod-validated `todayAction: buy|wait` verdict with rationale grounded in ≥2 concrete collected signals; (5) a Daily Report section reusing the existing badge+rationale UX.

The primary risks are not technical unknowns but **design gaps relative to the literal milestone spec**: the spec names only two watchlist removal triggers (rating downgrade, purchase), but without a third time-based staleness trigger the list grows unboundedly, which compounds into API rate-limit pressure (Yahoo Finance has no official SLA/rate-limit; Finnhub free tier caps at 60/min shared across the whole pipeline). A second class of risk is specific to a *daily, discrete, timing-sensitive* judgment: LLM verdicts can flip-flop day to day on near-identical data (documented even at temperature=0 in external LLM-trading-signal research), and a naive 8AM-JST-run judgment risks lookahead bias for US tickers (whose "current" data is actually the prior close, since US markets haven't opened yet at that hour). Both are directly mitigated by patterns this project has already shipped once (`decisionChanged`'s prior-snapshot injection + independent-then-compare prompting) and should be reused, not reinvented.

## Key Findings

### Recommended Stack

Zero new npm dependencies. Every capability — ETF detection, watchlist persistence, technical/news data supply, LLM+zod verdict validation — is achievable with packages already installed and already used identically elsewhere in the codebase.

**Core technologies:**
- `yahoo-finance2@3.13.2` (installed) — `quote().quoteType` for ETF/equity detection (batchable, verified live on US+JP tickers) and `chart()` for OHLCV technicals — same call pattern already used in `market.ts`/`portfolio/data.ts`
- `zod@4.3.6` (installed) — buy-timing verdict schema via `.passthrough().transform()` alias-hardening, identical to the proven `holdingEvaluationSchema` pattern in `src/meeting/schemas.ts`
- Node `fs/promises` (built-in) — `data/watchlist.json` persistence, mirroring `write-urgency-history.ts` exactly, no persistence library needed
- `tsx@4.21.0` (installed) — execution runtime for new scripts, unchanged from existing convention

### Expected Features

**Must have (table stakes / v2.7 core, P1):**
- ETF exclusion from all stock-pick surfaces (prompt instruction + TS `quoteType` deterministic filter)
- Watchlist persistence to `data/` (daily append of new 強気 tickers, accumulation starts from today, no backfill)
- Daily tracking data supply (price, technicals, related news) per watchlist symbol
- Entry-timing judgment agent (LLM + TS zod verification), binary buy-today/wait verdict + rationale grounded in ≥2 concrete collected signals (confluence, not single-indicator)
- Daily Report watchlist section (badge + rationale, reusing existing urgent/decisionChanged badge UX)
- Auto-exclusion on rating downgrade (中立/弱気) or purchase (ticker enters `tmp/portfolio.json`)

**Should have (fast-follow, P2):**
- Time-based staleness removal — flagged by research as a **gap versus the literal spec**: only 2 of the practitioner-standard 3 removal triggers are currently scoped; without this the watchlist has no upper bound
- Multi-day timing memory ("still waiting" vs. newly buy-worthy) — mitigates day-to-day flip-flopping, reuses `decision-diff.ts`
- Explicit "waitingFor" structured trigger condition when verdict is "wait"
- News-catalyst awareness in judgment reasoning — low marginal cost (reuses `holding-news.ts`), consider pulling into P1 during planning

**Defer indefinitely (anti-features, do not build):**
- Intraday/real-time re-scoring — incompatible with the once-daily batch architecture
- Numeric price targets / stop-loss levels — conflicts with decision-support (not execution) framing and risks LLM-fabricated numeric precision, exactly the class of bug fixed in the 2026-07-13 commit
- Standalone RSI/MACD/indicator dashboard/table — duplicates existing `collect-technicals.ts` output, conflicts with established prose-over-tables convention
- Auto-execute / brokerage integration — out of scope, real financial/security risk

### Architecture Approach

The watchlist and ETF-exclusion logic live in `src/portfolio/` alongside `holdings.ts`/`holding-news.ts`/`urgency-history.ts` (the watchlist is "the portfolio's forward-looking sibling"). New pipeline steps are inserted into `.claude/commands/invest.md` between existing Step 2 (analyst meeting) and Step 3 (report generation): ETF exclusion runs immediately after meeting-result finalization; watchlist admission/pruning is pure TS (no LLM) reading `tmp/meeting-result.json` + `data/watchlist.json` + portfolio holdings; data supply reuses `collect-technicals.ts` verbatim and a generalized `holding-news.ts` matcher; the judgment agent (new, Claude Agent, model sonnet) is the only new LLM-involving component and reads only `tmp/*.json` handoff files (never live tool calls for price data); the report renderer consumes everything via new fail-soft loaders in `report-data-loaders.ts`.

**Major components:**
1. `src/portfolio/etf-exclusion.ts` (new, pure) — deterministic `quoteType`-based ETF/equity gate, called at two independent sites
2. `src/portfolio/watchlist.ts` + `src/scripts/write-watchlist.ts` (new) — pure admit/prune functions + fail-soft CLI wrapper, mirroring `urgency-history.ts`/`write-urgency-history.ts` exactly; `data/watchlist.json` is ticker-keyed current-state, NOT date-keyed
3. `src/meeting/schemas.ts` / `types.ts` (modified) — new zod-validated `WatchlistEntry`/buy-timing judgment schema using the alias-hardened `.passthrough().transform()` pattern
4. `src/scripts/generate-daily-report.ts` + `report-data-loaders.ts` (modified) — new watchlist section renderer + fail-soft loader, mirroring the `loadUrgencyHistory()`/`computeWeeklyUrgencyRollup()` wiring

### Critical Pitfalls

1. **Prompt-only ETF exclusion without TS-side deterministic verification** — prompt instructions alone are probabilistic; LLMs still surface thematic/sector ETFs. Must layer a mandatory `quoteType`-based TS filter (fail-closed on lookup failure) on top of the prompt instruction, at both the meeting-result finalization point and again inside watchlist admission.
2. **Unbounded watchlist growth degrading pipeline runtime and API budget over months** — the spec's two removal triggers (downgrade, purchase) are rarer than the daily addition rate; realistic growth to 50-150+ tickers within months. Recommend adding a third time-based staleness/expiry trigger and instrumenting watchlist size in the existing pipeline-timing output from day one.
3. **yahoo-finance2/Finnhub rate limits hit as per-ticker daily calls multiply with watchlist size** — Yahoo has no official SLA and returns 429s under load; Finnhub free tier is 60 calls/min shared across the whole pipeline. Must batch multi-symbol calls, stagger/cache within a run, and design fail-soft-per-ticker from the start (this failure mode is invisible in small-scale dev/testing and only appears after weeks of production accumulation).
4. **LLM buy-timing verdict flip-flops day to day on near-identical data** — documented even at temperature=0 in external research; erodes user trust faster than a crash would since it looks like the feature "worked" every day. Mitigate by reusing the project's already-proven `decisionChanged` pattern: inject prior verdict + rationale into the prompt, require independent-then-compare reasoning, consider a TS-side hysteresis/debounce requiring 2 consecutive days before flipping the displayed badge.
5. **Lookahead bias — judging "buy today" using yesterday's close before today's market has opened** — at the pipeline's ~8AM JST run time, US markets haven't opened yet, so a "buy today" US-ticker verdict is reasoning about stale prior-close data. Must timestamp every data point with its as-of session and distinguish US vs. JP session-awareness in both the data contract and report copy.

## Implications for Roadmap

Based on combined research, the dependency chain is unambiguous and all four research files converge on the same build order: deterministic TS infrastructure first, LLM-facing agent step next, report rendering last — matching how every comparable prior feature in this codebase has shipped (holding-news → portfolio-research → judgment/urgent fields → persistence/rollup).

### Phase 1: ETF Exclusion
**Rationale:** No dependencies on anything else; unblocks every downstream phase since watchlist admission requires ETF-free `highlightedStocks`. Foundational and must land before watchlist persistence — a bad ticker entering the watchlist on day one pollutes tracked history and requires manual cleanup to fix retroactively.
**Delivers:** `src/portfolio/etf-exclusion.ts` (pure, unit-tested) wired into two call sites: post meeting-result finalization (Step 2f/2g) and defensively inside watchlist admission.
**Addresses:** ETF exclusion from all stock-pick surfaces (table stakes)
**Avoids:** Pitfall 1 (prompt-only ETF exclusion without TS verification) — includes explicit test cases for US ETFs, JP ETFs/REITs (`.T` suffix does NOT indicate fund-vs-equity), fail-closed on lookup failure

### Phase 2: Watchlist Persistence
**Rationale:** Depends on Phase 1's admission filter. Foundational data structure every subsequent feature depends on. The removal/expiry policy must be designed alongside the append policy, not bolted on after the file has grown unbounded.
**Delivers:** `src/portfolio/watchlist.ts` (pure admit/prune) + `src/scripts/write-watchlist.ts` (fail-soft CLI wrapper) + `data/watchlist.json` (ticker-keyed current-state table, NOT date-keyed), wired as new Step 3-W in `invest.md`
**Uses:** Pure-module + fail-soft-CLI-wrapper pattern from `urgency-history.ts`/`write-urgency-history.ts`
**Implements:** `src/portfolio/` component boundary; auto-exclusion on rating downgrade or purchase
**Research flag:** Explicitly decide (even if deferring) the third removal trigger (time-based staleness) here — this is a documented gap versus the literal spec, not a nice-to-have

### Phase 3: Daily Tracking Data Supply
**Rationale:** Depends on Phase 2 existing so there's an active ticker list to fetch data for. Must be designed with batching/staggering/fail-soft-per-ticker from the start, not retrofitted after rate-limit failures appear in production.
**Delivers:** `tmp/watchlist-technicals.json` (via `collect-technicals.ts`, reused as-is) and `tmp/watchlist-news.json` (via generalized `holding-news.ts` matcher, Pattern 4)
**Addresses:** Daily tracking data supply (table stakes); news-catalyst awareness (differentiator, low marginal cost — consider folding into this phase rather than deferring)
**Avoids:** Pitfall 3 (rate limits) — batch multi-symbol calls, stagger, cache within-run, fail-soft-per-ticker

### Phase 4: Buy-Timing Judgment Agent
**Rationale:** Depends on Phase 3's data files existing. First LLM-involving new component; built last among infrastructure pieces so its prompt can reference already-stable upstream data shapes.
**Delivers:** New zod schema in `meeting/schemas.ts` (alias-hardened `.passthrough().transform()`), new Claude Agent step (model: sonnet) in `invest.md`, `tmp/watchlist-judgment.json` output
**Addresses:** Entry-timing judgment agent (table stakes) — confluence-based rationale citing ≥2 concrete signals, no fabricated numeric precision
**Avoids:** Pitfall 4 (verdict flip-flopping) via prior-verdict injection + independent-then-compare, reusing the `decisionChanged` pattern; Pitfall 5 (lookahead bias) via as-of timestamping and explicit US/JP session-awareness in the prompt contract

### Phase 5: Daily Report Watchlist Section
**Rationale:** Depends on Phase 4's output schema being finalized. Purely a consumer of everything above; the only user-facing surface — without it the feature has zero visibility.
**Delivers:** New watchlist section in `generate-daily-report.ts` + `loadWatchlist()`/`loadWatchlistJudgment()` fail-soft loaders in `report-data-loaders.ts`
**Addresses:** Daily Report watchlist section (table stakes), reusing existing badge+rationale UX
**Avoids:** UX pitfalls — always display as-of timestamp next to badge; explain what changed when a verdict flips; handle empty/one/many-entry states; de-emphasize stale "still waiting" entries

### Phase Ordering Rationale

- Dependency chain is linear and well-defined: ETF exclusion → watchlist persistence → data supply → judgment agent → report rendering. All four research files (STACK, FEATURES, ARCHITECTURE, PITFALLS) independently converge on this exact order.
- Each phase is unit-testable in isolation before wiring into `invest.md`, matching how every prior comparable feature in this codebase has shipped (infrastructure-before-agent-before-rendering).
- Deterministic TS infrastructure (Phases 1-3) must precede the first LLM-involving component (Phase 4) so the judgment agent's prompt can reference already-stable, already-tested data shapes rather than co-evolving with them.
- Pitfall mitigations are baked into the phase that owns the relevant design surface, not deferred: staleness/removal policy in Phase 2, rate-limit batching in Phase 3, flip-flop/lookahead mitigation in Phase 4 — none of these should be treated as later refinements per the pitfalls research (each is explicitly flagged as "must be designed in from the start, not retrofitted").

### Research Flags

Needs deeper research during phase planning:
- **Phase 2 (Watchlist Persistence):** the third removal trigger (time-based staleness) is a genuine open design decision, not just an implementation detail — needs explicit discussion of threshold (N trading days) during `/gsd-plan-phase`, since it's a product-behavior change beyond the literal milestone spec
- **Phase 4 (Buy-Timing Judgment Agent):** the hysteresis/debounce mechanism (requiring N consecutive days before flipping a displayed badge) needs a concrete design decision — TS-side deterministic debounce vs. pure prompt-level consistency instruction — before implementation

Phases with standard, well-documented patterns (skip deep research, direct reuse of proven in-repo code):
- **Phase 1 (ETF Exclusion):** `quoteType` API surface fully verified live against both US and JP tickers; implementation shape is a direct copy of the existing two-layer-defense pattern
- **Phase 3 (Data Supply):** `collect-technicals.ts` and `holding-news.ts` are reused near-verbatim per Pattern 4; no new integration research needed
- **Phase 5 (Report Section):** direct reuse of the existing urgent/decisionChanged badge+rationale rendering pattern and `loadUrgencyHistory()` loader contract

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All findings verified against installed package source and live runtime calls against the project's own `node_modules/yahoo-finance2@3.13.2`; zero new dependencies |
| Features | MEDIUM | Internal precedent (HIGH) combined with general retail/swing-trading practitioner consensus (MEDIUM, no authoritative "watchlist entry-timing" API/spec exists to consult directly) |
| Architecture | HIGH | Verified directly against current codebase (internal architecture-extension question, not external ecosystem lookup) |
| Pitfalls | MEDIUM | Mix of MEDIUM-confidence external sources (official library source, vendor docs, arXiv research) and LOW-confidence single-source web claims; project-specific pitfalls are grounded directly in repo code/commit history (HIGH confidence) |

**Overall confidence:** HIGH

### Gaps to Address

- **Third watchlist removal trigger (time-based staleness):** not specified in the literal milestone scope but flagged by both FEATURES.md and PITFALLS.md as a near-term necessity to prevent unbounded growth. Address explicitly during roadmap/phase discussion for Phase 2 rather than silently adding or silently omitting.
- **Verdict flip-flop hysteresis mechanism:** the exact debounce design (N consecutive days, or a different mechanism) is not yet specified — needs a concrete decision during Phase 4 planning, informed by real usage data if possible.
- **`tmp/portfolio.json` vs `data/` path assumption:** PITFALLS.md notes the milestone's stated storage location for auto-removal purchase-detection should be verified against the actual current path (`tmp/portfolio.json`, not `data/portfolio.json`) before wiring Phase 2's pruning logic.
- **Watchlist size threshold for batching judgment LLM calls:** ARCHITECTURE.md suggests batching Step 3-J from N parallel single-ticker agents to 5-8-per-call batches "if the watchlist grows to 30+ simultaneously active tickers" — not urgent for v2.7 launch but should be a known trigger point for Phase 4 follow-up work.

## Sources

### Primary (HIGH confidence)
- Direct inspection of `.planning/PROJECT.md` — milestone scope, established Key Decisions table
- Direct inspection of `.claude/commands/invest.md` — full pipeline step order, fail-soft contracts, STEP marker conventions
- Direct inspection of `src/portfolio/holding-news.ts`, `urgency-history.ts`, `holdings.ts`, `decision-diff.ts`, `src/scripts/write-urgency-history.ts`, `collect-technicals.ts`, `generate-report.ts`, `report-data-loaders.ts`, `generate-portfolio-report.ts`, `src/meeting/types.ts`, `schemas.ts`
- `node_modules/yahoo-finance2/esm/src/modules/quote.d.ts`, `quote.schema.js`, `chart.d.ts` (installed v3.13.2) — confirmed `quoteType` discriminated union and per-bar chart fields
- Live runtime verification (2026-07-15) against installed `yahoo-finance2@3.13.2` — confirmed `quoteType` values and batch-call support empirically for US and JP tickers including `1306.T`

### Secondary (MEDIUM confidence)
- [gadicc/yahoo-finance2 quoteSummary-iface.ts / quote.ts (GitHub source)](https://github.com/gadicc/node-yahoo-finance2) — quoteType field values
- [Finnhub API rate-limit docs](https://finnhub.io/docs/api/rate-limit) — 60 calls/min free tier
- [AlphaForgeBench (arXiv 2602.18481)](https://arxiv.org/html/2602.18481v2) and [Agentic Trading (arXiv 2605.19337)](https://arxiv.org/html/2605.19337v1) — LLM trading-signal inconsistency across runs
- [Multifaceted variability in LLM-driven stock recommendations — ScienceDirect](https://www.sciencedirect.com/science/article/abs/pii/S1544612325021762) — <30% repeat-query overlap finding
- [Look-Ahead Bias — Corporate Finance Institute](https://corporatefinanceinstitute.com/resources/career-map/sell-side/capital-markets/look-ahead-bias/); [Freqtrade lookahead-analysis docs](https://www.freqtrade.io/en/stable/lookahead-analysis/)
- Various retail/swing-trading watchlist and entry-timing sources (TradingSim, LevelFields, ChartsWatcher, TradeAlgo, StockAlarm, tastytrade) — used to sanity-check feature landscape against domain practice

### Tertiary (LOW confidence)
- [gadicc/yahoo-finance2 GitHub issue #982](https://github.com/gadicc/yahoo-finance2/issues/982) — community rate-limit reports, no official SLA
- App Store listings for retail signal apps (Stock Signal, ProTicker, AMSON) — marketing copy only, used for presentation-pattern comparison

---
*Research completed: 2026-07-15*
*Ready for roadmap: yes*

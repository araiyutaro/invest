# Feature Research

**Domain:** Portfolio news intelligence — per-holding news feed + WebSearch re-evaluation for a daily AI investment report (personal tool)
**Researched:** 2026-07-03
**Confidence:** MEDIUM-HIGH

Scope note: This research covers only the NEW features targeted by v2.5 — (1) per-holding
news supply to `portfolio-analyst`, (2) WebSearch-based per-holding research + buy/hold/sell
re-evaluation, (3) related-news display on holding cards, (4) removal of the new-candidates
section from the portfolio report. It assumes as given: the existing `portfolio-analyst`
single-agent JSON contract (`tmp/portfolio-analysis.json`, `HoldingEvaluation` with
`symbol/nameJa/decision/rationale/riskNote?`), the existing Finnhub per-ticker company-news
collection (`fetchCompanyNews` in `src/data/news/finnhub.ts`), and the existing ID-reference
anti-hallucination pattern proven in the v2.4 news-digest feature
(`validateRawNewsCuration` / `resolveNewsCuration` in `src/meeting/schemas.ts`).

This supersedes the previous FEATURES.md content (v2.4 News Curation Report milestone, dated
2026-07-02), which covered the `news-digest.html` curation feature, now shipped and out of
scope for this research pass.

This is largely a **restoration + adaptation** project, not greenfield feature discovery: the
target behavior existed in v1.0 (`git show ba01275^:src/portfolio/runner.ts` and
`src/data/research.ts`, both deleted during the v2.0 Gemini→Claude Code migration) and is
being rebuilt on the v2.x architecture (single opus subagent + zod-validated JSON handoff,
not the old 5-agent multi-round TS orchestration loop). The v1.0 code is therefore treated
here as a **HIGH-confidence internal precedent** for expected behavior/content, while general
industry practice (S&P Capital IQ-style material-event monitoring, IMPORTANT/noise flags,
priority-tiered news alerts) is used as MEDIUM-confidence supporting evidence that the
approach matches how professional tools shape this problem.

## Feature Landscape

### Table Stakes (Users Expect These)

Features a "news-informed hold/sell decision" is expected to contain. Missing these = the
re-evaluation reads as generic commentary, not news-driven.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Per-holding news matched by ticker | Core premise of the milestone — a decision can't be "news-informed" without the news being scoped to that specific holding. Finnhub `company-news` already provides this per ticker | LOW | Data already collected (`fetchCompanyNews`, 24h window) — this is a wiring task (filter `tmp/news.json` by `ticker === symbol`), blocked only by the finnhub.ts ticker-contamination bug (see Dependencies) |
| Related news on the holding card (headline + source + link) | Reader needs to verify *what* triggered a decision without leaving the report; matches the existing `news-digest.html` UX precedent and the general "link out, don't paraphrase-only" pattern this codebase already follows for anti-hallucination | LOW-MEDIUM | Reuse the ID-reference resolution pattern (`resolveNewsCuration`) — agent selects article IDs from the pool, TS resolves the real `url`/`source`/`title`, never trusts LLM-echoed URLs |
| Decision must be explicitly grounded in supplied news when news exists | v1.0's re-evaluation prompt required agents to state "did the news change your prior judgment" — without this, injecting news is decorative rather than decision-driving | LOW | Prompt-level requirement in `portfolio-analyst`; add a "news considered" field or require rationale to reference the specific development when `relatedNewsIds` is non-empty |
| Graceful no-news handling per holding | Not every one of the 12 holdings will have fresh Finnhub company-news every day (small/mid-cap coverage is uneven) — a holding with zero matched articles must still render a normal card, not an error or empty section | LOW | Same null-tolerant pattern already used for `portfolioAnalysis === null` fallback in `generate-portfolio-report.ts`; apply at holding-card granularity |
| Materiality/urgency signal on the decision | v1.0 explicitly instructed agents to flag "決算ミス、訴訟、規制変更、大型契約" (earnings miss, lawsuit, regulatory change, major contract) as high-urgency; general industry tools (S&P Capital IQ dashboards, IR-monitoring alert tools) converge on the same binary/tiered materiality signal — without it, a reader can't tell "routine mention" from "act now" | LOW-MEDIUM | Add an `urgent: boolean` or `urgency: "high"/"normal"` field to `HoldingEvaluation`; drive it from an explicit prompt rule (earnings miss / lawsuit / regulatory change / major contract / guidance cut → urgent), not free-text only |
| New-candidates section removed from `portfolio-report.html` | Explicit milestone requirement — the report should read as "what should I do with what I already own," not double as a discovery feed (that's Daily Report's job) | LOW | Delete `formatNewCandidatesHtml` call site in the renderer only; **do not** strip `highlightedStocks` context from the `portfolio-analyst` prompt — PROJECT.md explicitly keeps that as background context for the agent's own judgment |

### Differentiators (Competitive Advantage)

Features that set this report apart from a plain news ticker bolted onto a portfolio list.
These align directly with the milestone's Core Value: news-driven re-evaluation, not just
news display.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| WebSearch-based per-holding research + re-evaluation round | The single highest-value feature in this milestone — Finnhub's 24h company-news window misses slower-breaking developments (analyst days, filings, competitor moves) that WebSearch catches. v1.0 proved this pattern works (`researchStock` + `getPostResearchPortfolioReview`) and it's the literal reason this milestone exists | HIGH | v1.0 called Gemini's `googleSearch` grounding directly from TS; v2.x has no direct-API AI layer anymore (removed Phase 4) — must be re-implemented as a Claude Code subagent step using the `WebSearch` tool, either as N per-ticker calls or one `portfolio-analyst` invocation with WebSearch granted. 12 holdings × research adds real wall-clock time to the daily pipeline — flag for architecture-phase parallelization design |
| Decision-change tracking vs. previous day | Directly answers "did anything change since yesterday" — the single most actionable question a daily holder cares about. v1.0 asked this explicitly ("先ほどの判断を変更すべき銘柄はあるか"); v2.x already has a proven, shipped precedent for exactly this cross-session pattern (ANLQ-01: prior-day `highlightedStocks` injected into Round 1 prompts) | MEDIUM | Reuse the ANLQ-01 pattern: read yesterday's `tmp/portfolio-analysis.json` (or an archived copy), inject each holding's prior `decision` into the `portfolio-analyst` prompt, require the agent to state explicitly whether today's decision differs and why. Needs a `previousDecision`/`decisionChanged` field on `HoldingEvaluation` for the renderer to visually flag changes |
| Urgency-flagged card styling (visual differentiation) | A wall of 12 uniformly-styled cards buries the one holding that actually needs attention today; a red/amber accent on urgent cards mirrors the existing `decisionColor` pattern already used for 保持/買増/一部売却/全売却 | LOW | Purely a rendering concern once the `urgency` field exists — extend `formatHoldingEvaluationsHtml`'s existing color-by-decision logic with a secondary badge/border for urgent items |
| Staleness-aware relevance within the holding card | Not all matched company-news is equally worth surfacing — a 20-hour-old routine analyst-note mention shouldn't outrank a 2-hour-old earnings/lawsuit item. The pipeline already computes recency-weighted priority (NEWS-02, 6h-recency scoring) at the pool level | LOW | Inherit existing `priorityScore` ordering when building the per-holding candidate list fed to the agent; let the agent (not TS) do final selection via the same ID-reference curation approach used for news-digest, capped at a small per-holding limit (see Anti-Features) |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem like natural additions here but would create problems or duplicate
existing product boundaries.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|------------------|-------------|
| Full v1.0 multi-round meeting revival for portfolio (5 analysts × Round 1 → Round 2 → research → post-research review, per old `runner.ts`) | "Just restore what v1.0 had" feels like the safest, most faithful restoration | v2.x deliberately collapsed portfolio analysis into a single `portfolio-analyst` opus subagent for cost/speed; reviving the full 5-agent × 2-round loop *and* adding WebSearch research across 12 tickers would multiply daily pipeline runtime far beyond what a single-subagent design costs, for marginal quality gain over one well-prompted opus agent | Keep the single `portfolio-analyst` agent; give it the news context + WebSearch research results as richer input, not a second meeting layer |
| Real-time / intraday news alerts on holdings | "What if something urgent happens mid-day, not just at the 8am run" feels valuable for a "sell decision" use case | Explicitly out of scope per PROJECT.md ("リアルタイム株価ストリーミングは日次バッチで十分") — this is a daily batch report tool, not a monitoring/alerting service; adding push/polling infra is a different product class | Daily urgency flag in the next morning's report is the intended cadence; if a genuinely time-critical gap emerges later, treat as a separate milestone, not folded into this one |
| Per-article ML/LLM relevance/sentiment scoring for every matched news item | Feels like it would make ranking "smarter" than reusing the existing denylist + recency scoring | Explicitly out of scope per PROJECT.md ("ML/LLMベース関連性スコアリング...API呼び出しはコスト非現実的") — per-article LLM calls at ~160 articles/day is not economical, and this was already rejected for the general news pipeline | Let the single `portfolio-analyst`/research agent do qualitative selection over the pre-filtered, recency-scored candidate pool in one call — same pattern as `news-curator`'s ID-based selection, no per-article scoring pass |
| Unbounded article count per holding card | "Show everything so nothing is missed" feels safer than curating | Some tickers (especially ones with heavy Finnhub company-news coverage) can generate 8-10+ routine articles/day; rendering all of them buries the one material item and bloats 12 cards into an unreadable report | Cap at a small number per holding (e.g., 3-5, mirroring the news-digest's 10-15/day precedent scaled down to single-ticker granularity); let the agent pick top-N via ID reference, note "+N more" only if truly needed |
| Reintroducing "new addition candidates" *inside* the re-evaluation flow (e.g., agent recommends new buys during holding re-evaluation) | Since the agent already sees `highlightedStocks` as context, it's tempting to let it surface new opportunities inline | This is precisely the scope creep the milestone explicitly removes — mixing "what to do with what I own" and "what should I newly buy" back together defeats the stated goal of focusing the Portfolio Report on held positions | Keep `highlightedStocks` as background context only (may inform a holding's sector-relative view), but no rendered "candidates" output from this report; that remains Daily Report's exclusive job |

## Feature Dependencies

```
[finnhub.ts ticker-contamination bugfix]
    └──blocks──> [Per-holding news matched by ticker]
                     └──requires──> [Related news on holding card]
                     └──enhances──> [WebSearch per-holding research + re-evaluation]

[ID-reference resolution pattern (schemas.ts, proven in news-digest)]
    └──requires──> [Related news on holding card]  (prevents hallucinated URLs)

[ANLQ-01 prior-day injection pattern (already shipped)]
    └──requires──> [Decision-change tracking vs. previous day]

[Decision-change tracking] ──enhances──> [Urgency-flagged card styling]
[WebSearch per-holding research] ──enhances──> [Materiality/urgency signal on decision]

[New-candidates section removal] ──conflicts──> [Reintroducing candidates inline] (anti-feature)
```

### Dependency Notes

- **finnhub.ts bugfix blocks per-holding news supply:** `fetchNewsByCategory`'s
  `.map(toRawArticle)` (finnhub.ts:43) implicitly passes the array index as `toRawArticle`'s
  second positional argument (`ticker`), because `Array.prototype.map` calls the callback
  with `(item, index, array)`. This silently pollutes general/merger news articles with a
  numeric-string `ticker` field (e.g., `"0"`, `"1"`, `"2"`...), which would cause false
  ticker-matches once per-holding filtering is wired up (e.g., a general article at index 3
  incorrectly "matching" a holding whose symbol coincidentally equals `"3"`, or — more
  commonly — every general-category article at index N getting miscounted as belonging to
  whichever portfolio ticker happens to be processed Nth). This must be fixed before ticker
  matching logic is trustworthy; it is a data-integrity prerequisite, not an independent
  feature.
- **Related news on holding card requires the ID-reference pattern:** Same anti-hallucination
  rationale as `news-digest.html` — the agent must reference article IDs from the trusted
  `tmp/news.json` pool, and TS resolves the real `url`/`source`/`title` server-side. Free-text
  URL generation by the agent is a proven hallucination risk in this codebase and must not be
  reintroduced for holding cards.
- **Decision-change tracking requires the ANLQ-01 pattern:** The pipeline already reads
  yesterday's meeting output and injects it into today's Round 1 prompts (Phase 12). The same
  mechanism (read prior `tmp/portfolio-analysis.json`, inject prior `decision` per holding)
  is the lowest-risk way to implement decision-change tracking, since it's already validated
  in production for the Daily Report side of the pipeline.
- **WebSearch research enhances per-holding news, doesn't replace it:** Finnhub company-news
  (fast, structured, ID-referenceable) and WebSearch (broader but unstructured, higher latency,
  harder to anti-hallucinate against) serve different roles — the former is the reliable
  "related articles" list on the card; the latter is the "did anything change my view" research
  input that isn't necessarily rendered as clickable article links.
- **New-candidates removal conflicts with reintroducing candidates inline:** These are the same
  scope-creep risk from two angles (removing a section vs. accidentally recreating it inside
  the new re-evaluation output) — the roadmap phase that implements re-evaluation should
  explicitly exclude "candidate" language from the `portfolio-analyst` output schema to avoid
  drift back toward the old dual-purpose report.

## MVP Definition

### Launch With (v1 = this milestone, v2.5)

All four target features from PROJECT.md are core, not stretch — this is a small, well-scoped
milestone restoring a previously-validated capability, not exploratory feature discovery.

- [ ] finnhub.ts ticker-contamination fix — blocking prerequisite for all ticker-matching logic
- [ ] Per-holding news supply to `portfolio-analyst` (ticker-matched from `tmp/news.json`) — the data foundation; without it, nothing else in this milestone has real input
- [ ] Related news on holding cards (headline/source/link, ID-referenced, capped 3-5/holding) — the visible, user-facing half of "news-informed"
- [ ] WebSearch-based per-holding research + re-evaluation (decision change + urgency flags for earnings miss/lawsuit/regulatory change/major contract) — the reasoning half of "news-informed"; this is the milestone's actual differentiator and must not be deferred
- [ ] New-candidates section removed from `portfolio-report.html` (context to `portfolio-analyst` retained) — small, isolated, unblocks focus

### Add After Validation (v1.x, still within v2.5 if scope allows)

- [ ] Decision-change tracking vs. previous day (`previousDecision`/`decisionChanged` field + card badge) — high value but has its own dependency chain (prior-day file read); reasonable to land as a fast-follow phase within v2.5 rather than blocking the WebSearch re-evaluation phase
- [ ] Parallelization/runtime tuning of the 12-ticker WebSearch research step — only needed if the naive implementation (sequential or simple `Promise.all`) pushes the daily pipeline past an acceptable runtime; validate the simple approach first

### Future Consideration (v2.6+)

- [ ] XREP-01 — cross-reference news-digest themes discussed in the daily meeting back onto holding cards (already flagged as deferred in PROJECT.md due to pipeline-ordering dependency; requires news-digest to run before portfolio analysis, currently the reverse or independent)
- [ ] Historical urgency-flag audit trail / weekly rollup of flagged events — would need persistent storage beyond daily `tmp/`/`docs/` snapshots, no current infrastructure for it
- [ ] Position-sizing-aware rebalance suggestions — blocked on data availability, not implementation choice: PROJECT.md notes "保有比率データはありません" (no holding-percentage data exists), so rebalance actions must stay qualitative regardless of how good the news/research input becomes

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|----------------------|----------|
| finnhub.ts ticker bugfix | HIGH (blocks everything) | LOW | P1 |
| Per-holding news supply | HIGH | LOW | P1 |
| Related news on holding card | HIGH | MEDIUM | P1 |
| WebSearch research + re-evaluation | HIGH | HIGH | P1 |
| New-candidates section removal | MEDIUM | LOW | P1 |
| Urgency/materiality flag | HIGH | LOW-MEDIUM | P1 |
| Decision-change tracking | MEDIUM-HIGH | MEDIUM | P2 |
| WebSearch runtime parallelization | MEDIUM | MEDIUM | P2 (only if needed) |
| XREP-01 theme cross-reference | LOW-MEDIUM | MEDIUM | P3 |
| Urgency audit trail / rollup | LOW | HIGH (needs new storage) | P3 |

**Priority key:**
- P1: Must have for v2.5 launch
- P2: Should have, add when possible within v2.5 or as immediate fast-follow
- P3: Nice to have, explicitly deferred (v2.6+ per PROJECT.md)

## Competitor / Precedent Feature Analysis

Since this is a single-user personal tool, "competitors" here means (a) this project's own
proven v1.0 implementation and (b) general industry patterns from professional research
platforms, used to sanity-check that the restored design matches how the domain actually
solves this problem.

| Feature | v1.0 (this project, deleted in v2.0) | Industry pattern (S&P Capital IQ-style / IR-monitoring tools) | Our v2.5 Approach |
|---------|----------------------------------------|----------------------------------------------------------------|---------------------|
| Per-holding news scoping | Not ticker-matched from a pool — relied on a separate Gemini `googleSearch`-grounded research call per ticker | Portfolio-scoped dashboards with per-company monitoring, alerts filtered to tracked tickers | Ticker-match against the *existing* filtered news pool (Finnhub company-news) first — cheaper and faster than a fresh search per holding — then layer WebSearch research on top |
| Re-evaluation trigger | Explicit second round: "先ほどの判断を変更すべき銘柄はあるか" after research | Event-driven re-review triggers on earnings/filings/rating changes | Same explicit re-evaluation instruction, executed within a single `portfolio-analyst` call rather than a second agent round |
| Materiality signal | Free-text instruction to flag "決算ミス、訴訟、規制変更、大型契約" | Binary IMPORTANT flag / High-Medium-Low priority tiers common across monitoring tools | Structured `urgency` field (not just prose) so the renderer can visually distinguish urgent holdings — an improvement over v1.0's free-text-only approach |
| Anti-hallucination for linked news | Not applicable (v1.0 had no clickable per-article links on holdings — only prose research summaries) | N/A (professional tools use first-party structured news feeds, not LLM-generated links) | ID-reference resolution against `tmp/news.json` (proven in-house pattern from `news-digest.html`) — this is a v2.x-only improvement over both v1.0 and generic prose-summary approaches |

## Sources

- Internal precedent (HIGH confidence, primary source for this milestone): `git show
  ba01275^:src/portfolio/runner.ts`, `git show ba01275^:src/data/research.ts` (v1.0
  implementation, deleted in v2.0 Gemini removal)
- Internal precedent (HIGH confidence): `src/scripts/write-news-digest.ts`,
  `src/meeting/schemas.ts` (ID-reference anti-hallucination pattern, shipped v2.4)
- Internal precedent (HIGH confidence): `.claude/commands/invest.md` lines ~94-172 (ANLQ-01
  prior-day injection pattern, shipped Phase 12) and lines ~1569-1632 (`portfolio-analyst`
  current prompt contract)
- Internal precedent (HIGH confidence): `src/data/news/finnhub.ts` (confirmed
  `.map(toRawArticle)` index-contamination bug at line 43 by direct code inspection)
- `.planning/PROJECT.md` (milestone target features, constraints, out-of-scope decisions)
- [AI Portfolio Analysis: How AI Reviews Your Entire Portfolio at Once — Barebone AI](https://barebone.ai/resources/ai-portfolio-analysis-5-agents) — MEDIUM confidence, supports news-triggered alert pattern
- [Designing Agentic AI-Based Screening for Portfolio Investment (arXiv)](https://arxiv.org/pdf/2603.23300) — MEDIUM confidence, supports multi-signal (fundamentals + sentiment/news) buy/sell agent deliberation pattern
- [Top 10 Investment Research Tools (Visualping)](https://visualping.io/blog/investment-research-tools) — MEDIUM confidence, supports binary IMPORTANT-flag / material-vs-noise distinction pattern
- [FactSet News & Research](https://www.factset.com/solutions/data/news-and-research) and S&P Capital IQ material-event dashboard pattern (via Visualping article) — MEDIUM confidence, supports per-company monitoring dashboards with material-event alerts
- WebSearch results on staleness/relevance ranking in stock dashboards — LOW-MEDIUM confidence (generic dashboard advice, not portfolio-news-specific); used only to corroborate that priority-tiering and recency-awareness are standard, not to source specific thresholds (thresholds already exist in-house via NEWS-02)

---
*Feature research for: portfolio news intelligence (per-holding news + WebSearch re-evaluation)*
*Researched: 2026-07-03*

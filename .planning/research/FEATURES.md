# Feature Research

**Domain:** Entry-timing watchlist & buy/wait signal — daily buy-timing judgment for bullish-rated individual stocks in a multi-agent investment analysis tool (personal use)
**Researched:** 2026-07-15
**Confidence:** MEDIUM

Scope note: This research covers only the NEW features targeted by v2.7 — (1) ETF exclusion
from recommended-stock surfaces, (2) a persisted watchlist of bullish-rated individual stocks,
(3) daily tracking data supply (price/technicals/news) per watchlist symbol, (4) an
entry-timing judgment agent producing a "buy today / wait" verdict + rationale, (5) a Daily
Report watchlist section, and (6) automated watchlist exclusion rules. It assumes as given the
existing 5-analyst + moderator daily meeting, Round 3 scoring (`highlightedStocks` with
`averageScore`/`verdict: 強気/中立/弱気`), portfolio holding re-evaluation with urgency flags and
decision-change badges, holding-specific news extraction (`holding-news.ts`), and the existing
`yahooFinance.quote()` call already in `src/data/market.ts`.

This supersedes the previous FEATURES.md content (v2.5 Portfolio News Intelligence milestone,
dated 2026-07-03), which covered per-holding news + WebSearch re-evaluation, now shipped and
out of scope for this research pass.

This is a **greenfield feature within an established architecture**, not a restoration: there
is no in-house precedent for entry-timing judgment or watchlist persistence (v1.0 had no such
feature). It is grounded instead in (a) this project's own proven architectural patterns —
zod-verified structured LLM output, ID-reference anti-hallucination, TS-side deterministic
verification of self-reported fields, fail-soft pipeline steps — which are treated as HIGH
confidence constraints on *how* to build this, and (b) general retail/swing-trading practitioner
consensus on entry-timing criteria and watchlist lifecycle management, treated as MEDIUM
confidence guidance on *what* the feature should contain, since no authoritative "watchlist
entry-timing" API or library documentation exists to consult directly.

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = the watchlist section feels incomplete or
untrustworthy, or actively recommends buying instruments the user shouldn't (ETFs already
dollar-cost-averaged into).

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| ETF exclusion from all stock-pick surfaces | The user's portfolio is ~80% ETFs/index funds by design — an entry-timing feature recommending "buy today" on a fund the user already DCAs into is actively harmful noise. Current `highlightedStocks`/picks flow has no such filter today | LOW | `quoteType` field from `yahooFinance.quote()` (already called in `src/data/market.ts`) gives a free, zero-new-API-call deterministic filter: keep `EQUITY`, drop `ETF`/`MUTUALFUND`/`INDEX`. Matches this project's established two-layer defense pattern (prompt instruction + TS-side deterministic verification), already proven for `urgent`/`decisionChanged` |
| Binary "buy now / wait" verdict per watchlist stock | Practitioner signal tools always reduce entry timing to an unambiguous action, not a raw indicator dump — the point of a daily digest is to save the reader from re-deriving the call each morning | LOW | Reuse the existing `verdict: 強気/中立/弱気` badge-rendering convention (already validated with the user via urgent/decisionChanged badges in Phase 22) — same UX shape, new judgment axis |
| Confluence-based rationale, not a single indicator | Practitioner consensus (moving-average position, RSI band, breakout/pullback, volume) is unanimous that no single signal is trustworthy alone; entry checklists require multiple confirming signals before triggering a "buy now" call | MEDIUM | Requires Daily Tracking Data Supply to include ≥2 independent technical facts per stock (price vs. moving average, RSI value, volume vs. average) before the judgment agent can justify a verdict — a single-indicator judgment is both practitioner-weak and inconsistent with this project's "no fabrication" ethos |
| Explicit rationale text paired with the badge | Practitioner trade-setup writeups always separate context → trigger → what's missing; the user making a next-morning decision needs to know *why* "wait" was chosen, not just that it was | LOW–MEDIUM | Directly reuses this project's existing pattern: portfolio urgency/decision-change badges already pair a boolean badge with a rationale paragraph (Phase 22 PORT-04). Same UX shape, new judgment field |
| TS-side deterministic verification of the LLM's structured output | House doctrine since v2.5/2.6 (multiple Key Decisions entries): never trust LLM self-reported structured fields — zod schema validation + alias hardening is already standard for `urgent`, `decisionChanged`, `holdingEvaluation` | LOW | Directly extends the existing `passthrough().transform()` alias-hardening pattern to a new `entryTiming` judgment field; no new architecture needed |
| Stale-entry lifecycle management (watchlist pruning) | Every watchlist-building source treats un-pruned watchlists as a known failure mode — a list that only grows is explicitly flagged as neglect. The milestone spec itself notes accumulation starts today with "no retroactive backfill," meaning the list has no natural upper bound unless pruning exists | LOW–MEDIUM | Spec already defines 2 of 3 standard removal triggers (re-rated to 中立/弱気 → excluded; purchased → excluded as "already bought"). Missing the third practitioner-standard trigger — time-based staleness (no bullish re-confirmation for N sessions) — see Dependencies/Gap below |
| Fail-soft pipeline integration | Every new pipeline step added since v2.4 (news-digest, portfolio-research, urgency-history) has been explicitly fail-soft with a dedicated `[STEP:*]` marker so failures don't block the 4 existing reports | LOW | Spec already states this requirement; simply confirming it as table-stakes consistent with prior phases, not a new pattern to invent |

### Differentiators (Competitive Advantage)

Features that set this feature apart from generic screeners/signal apps. Not required for the
v2.7 core scope, but align with the project's existing quality bar (multi-agent debate,
deterministic guardrails, cross-session memory) and are cheap given what already exists.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| News-catalyst awareness in the timing judgment | Most retail signal apps (Stock Signal, AMSON, ProTicker) are purely technical/price-based; this project already has a decisive edge — Finnhub company news + WebSearch research pipeline feeding portfolio decisions. Reusing that for watchlist entries (e.g., "wait — earnings in 2 days" or "buy — pullback confirmed, no adverse news") is a real differentiator vs. commodity signal apps, and the milestone's own "Target features" already lists related news as part of daily tracking data supply | LOW (reuses `holding-news.ts` ticker-matching pattern) | Recommend folding into the P1 Daily Tracking Data Supply phase rather than deferring — marginal cost is low since the ticker-matching utility already exists |
| Multi-day timing memory ("waiting 3rd consecutive day") | Generic signal apps re-derive verdicts from scratch daily with no continuity. This project has strong precedent for cross-session memory (previous-day snapshot injection, `decisionChanged` badge, urgency-history.json rollups) — surfacing "still waiting" vs. "newly buy-worthy today" is more actionable than a stateless daily verdict, and directly mitigates a documented LLM weakness (see Pitfalls note below) | MEDIUM | Depends on watchlist persistence (already P1) + reusing the `decision-diff.ts` equality-comparison pattern against yesterday's verdict |
| Explicit "waitingFor" trigger condition when verdict is "wait" | Practitioner setups always specify what needs to happen for entry to become valid (e.g., "close above 20-day MA on rising volume") rather than a vague "not yet" — turns "wait" from a dead-end into an actionable watch condition for tomorrow's read | MEDIUM | Natural extension of the existing rationale field; TS only needs to require a non-empty structured field when verdict = wait |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem like natural additions but conflict with this project's scope (personal
decision-support tool, once-daily batch pipeline) or established philosophy (no fabricated
numeric precision, prose over tables).

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|------------------|-------------|
| Intraday/real-time re-scoring of entry timing | "Buy now" feels more actionable if updated throughout the day as price moves | Project is architecturally a once-daily batch pipeline (launchd 8AM); intraday data adds Yahoo Finance rate-limit risk and false precision — an 8AM "buy now" call is inherently a morning snapshot, matching how the rest of the report already frames itself | Keep single daily snapshot judgment; rationale explicitly says "as of this morning's data," consistent with existing daily-batch report framing. Already implicit in "Out of Scope" (リアルタイム株価ストリーミング) from PROJECT.md |
| Numeric price targets / stop-loss levels per watchlist stock | Trade-setup writeups conventionally include entry/stop/target prices and it reads as more "professional" | Project is a decision-support tool for a long-horizon individual investor, not a trade-execution tool; precise numeric stop-loss/targets from an LLM invite false confidence and are exactly the kind of numeric fabrication the project's Key Decisions log already fought against (2026-07-13 fix: "候補銘柄の当日テクニカルデータを収集しアナリストに注入 — 古い指標値の創作を防止") | Keep rationale qualitative + reference concrete observed technical facts (actual RSI value, actual price vs. actual MA value) already collected — never invent target/stop prices |
| Aggressive swing-trader-style turnover / weekly forced pruning | Swing-trading literature treats 40-60% weekly turnover as healthy discipline | This project's watchlist source is a slow-moving 5-analyst daily meeting for a personal mid/long-term stock allocation, not an active swing-trading list; importing swing-trader turnover norms would prematurely remove fundamentally sound names not yet confirmed by price action | Use the removal triggers already scoped (rating downgrade, purchase, optionally time-based staleness with a generous window) rather than importing swing-trading turnover cadence |
| Standalone RSI/MACD/Bollinger indicator dashboard/table | Feels rigorous, mirrors TradingView-style tools | Duplicates the existing `collect-technicals.ts` output surface and conflicts with this project's established UX convention of prose rationale over raw indicator tables ("アナリスト詳細散文分析" pattern, explicit prior decision that analyst output should be prose not compressed data) | Feed indicator values into the LLM judgment as context; surface only the synthesized verdict + prose rationale, consistent with existing report style |
| Auto-execute or brokerage integration | Natural "next step" once a buy signal exists | Explicitly out of scope for a decision-support tool; introduces real financial/security risk (API keys, order execution) far beyond current project scope (personal decision aid, not a trading bot) | None needed — the report is read by the user each morning; execution stays manual, matching the project's entire existing design (report → human reads → human decides) |

## Feature Dependencies

```
ETF Exclusion (prompt instruction + TS quoteType filter)
    └──requires──> Existing highlightedStocks/picks selection (Round 3 scoring) — must run BEFORE ETF filter is applied

Watchlist Persistence (data/watchlist.json, daily append)
    └──requires──> ETF Exclusion (must not persist ETF tickers into watchlist)
    └──requires──> Round 3 verdict field (強気 threshold for entry)

Daily Tracking Data Supply (price/technicals/news per watchlist symbol)
    └──requires──> Watchlist Persistence (need symbol list before fetching data for it)
    └──reuses────> collect-technicals.ts pattern (existing)
    └──reuses────> holding-news.ts ticker-matching pattern (existing) [News-catalyst awareness differentiator]

Entry-Timing Judgment Agent (LLM + TS zod verification)
    └──requires──> Daily Tracking Data Supply (needs price/technical/news facts to reason over)
    └──requires──> Confluence-based rationale (table stakes) — agent must cite ≥2 independent signals
    └──enhances─by─> News-catalyst awareness (differentiator, reuses existing news pipeline)

Daily Report Watchlist Section (badge + rationale)
    └──requires──> Entry-Timing Judgment Agent (needs verdict + rationale to render)
    └──reuses────> Existing urgent/decisionChanged badge rendering pattern (Phase 22 UI-07)

Watchlist Auto-Exclusion (rating downgrade / purchased)
    └──requires──> Watchlist Persistence (need existing entries to evaluate for removal)
    └──requires──> Daily 5-analyst meeting re-evaluation output (existing, for downgrade detection)
    └──requires──> portfolio.json (existing, for purchase detection)

Multi-day Timing Memory (differentiator) ──enhances──> Entry-Timing Judgment Agent
    └──requires──> Watchlist Persistence storing prior-day verdict
    └──reuses────> decision-diff.ts equality-comparison pattern (existing)

Explicit "waitingFor" trigger condition (differentiator) ──enhances──> Daily Report Watchlist Section
    └──requires──> Entry-Timing Judgment Agent (must emit structured field)

Time-based staleness removal (table-stakes gap vs. current spec) ──enhances──> Watchlist Auto-Exclusion
    └──requires──> Watchlist Persistence (need entry-added date to compute staleness)
```

### Dependency Notes

- **ETF Exclusion must run before Watchlist Persistence:** the milestone spec already states
  this ("ETF除外はウォッチリストの入口より前段"). Research confirms this is correct — every
  downstream feature (tracking data supply, judgment, report) assumes the watchlist only ever
  contains individual equities. Filtering ETFs after persistence would require retroactive
  cleanup logic; filtering before is strictly simpler and matches the project's established
  "verify at the boundary" philosophy.
- **Confluence-based rationale requires Daily Tracking Data Supply to include at least 2
  independent signal types** (e.g., price-vs-moving-average AND RSI, or moving-average AND
  volume): practitioner consensus is unanimous that single-indicator signals are unreliable,
  and this project's own established "no fabrication" doctrine (evidenced by the 2026-07-13
  fix injecting real technical data to prevent stale-indicator creation) requires the judgment
  to be traceable to concrete collected facts, not LLM-invented technical color.
- **Multi-day Timing Memory enhances but does not block the MVP judgment agent:** it can ship
  as a fast-follow once persistence + a few days of judgment history exist, mirroring how
  `decisionChanged` (Phase 22) was added after the base portfolio evaluation flow already
  existed (Phase 19-21). This also directly mitigates a documented risk: published research on
  LLM-driven stock recommendations found <30% overlap in repeated/rephrased queries without
  explicit consistency constraints — surfacing "verdict changed from yesterday" via
  deterministic TS-side diffing (not LLM self-report) is this project's standard mitigation
  pattern for exactly this class of risk.
- **Time-based staleness removal is a gap versus the current milestone spec:** the spec names
  only 2 removal triggers (rating downgrade, purchase). Practitioner convention names a third
  (no-movement/no-reconfirmation staleness) as equally important to prevent unbounded list
  growth. Since the milestone explicitly starts accumulation from today with no backfill, the
  list will grow indefinitely absent *some* time-based bound. Recommend flagging this to the
  roadmap as a should-have close to P1, and cross-reference as a candidate item in
  PITFALLS.md (unbounded data growth / stale watchlist entries).

## MVP Definition

### Launch With (v2.7 core, matches PROJECT.md Active requirements)

- [ ] ETF exclusion (prompt instruction + TS `quoteType` deterministic filter) — without this,
      the watchlist immediately fills with fund tickers and the whole feature is untrustworthy
      from day one
- [ ] Watchlist persistence to `data/` (daily append of new 強気 tickers, accumulation from
      today only) — foundational data structure every other feature depends on
- [ ] Daily tracking data supply (price, technicals, related news) per watchlist symbol — the
      judgment agent has nothing to reason over without this
- [ ] Entry-timing judgment agent (LLM + TS zod verification), binary buy-today/wait verdict +
      rationale grounded in ≥2 concrete collected signals — the core deliverable
- [ ] Daily Report watchlist section (badge + rationale, reusing existing badge UX) — the only
      user-facing surface; without it the feature has zero visibility
- [ ] Auto-exclusion on rating downgrade (中立/弱気) or purchase (added to portfolio.json) —
      prevents the list from recommending stocks the user should no longer buy or already owns

### Add After Validation (v2.7.x / fast-follow)

- [ ] Time-based staleness removal (e.g., N sessions with no bullish re-confirmation from the
      daily meeting) — trigger: watchlist grows unboundedly over the first few months without
      this; recommend evaluating after ~4-6 weeks of live data
- [ ] Multi-day timing memory / "waiting Nth consecutive day" surfaced in rationale — trigger:
      once persistence has accumulated enough days of verdict history to make the comparison
      meaningful (roughly 1-2 weeks)
- [ ] Explicit "waitingFor" structured trigger condition (what needs to happen for wait→buy) —
      trigger: user feedback that "wait" verdicts feel like dead ends without a concrete
      re-check condition
- [ ] News-catalyst awareness folded fully into judgment reasoning (beyond raw data supply) —
      low marginal cost given `holding-news.ts` precedent; consider pulling forward into P1 if
      implementation proves cheap during planning

### Future Consideration (v3+)

- [ ] Numeric stop-loss/price-target fields — defer indefinitely: conflicts with this project's
      decision-support (not execution) framing and risks LLM-fabricated numeric precision;
      would require a fundamentally different verification architecture (grounding every
      number to a collected data point, not just structural schema validation)
- [ ] Intraday re-scoring — defer indefinitely: fundamentally incompatible with the current
      once-daily batch architecture; would require a new scheduling/infra model entirely
- [ ] Standalone technical-indicator dashboard/table — defer: duplicates existing
      collect-technicals output surface and conflicts with established prose-over-tables report
      convention

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| ETF exclusion (prompt + TS quoteType filter) | HIGH | LOW | P1 |
| Watchlist persistence (data/watchlist.json) | HIGH | LOW | P1 |
| Daily tracking data supply (price/technicals/news) | HIGH | MEDIUM | P1 |
| Entry-timing judgment agent (LLM+zod) | HIGH | MEDIUM | P1 |
| Daily Report watchlist section (badge+rationale) | HIGH | LOW–MEDIUM | P1 |
| Auto-exclusion (downgrade/purchase) | HIGH | LOW | P1 |
| Time-based staleness removal | MEDIUM | LOW | P2 |
| Multi-day timing memory | MEDIUM | MEDIUM | P2 |
| Explicit "waitingFor" trigger field | MEDIUM | LOW | P2 |
| News-catalyst awareness in judgment | MEDIUM–HIGH | LOW (reuses holding-news.ts) | P1/P2 borderline — see note |
| Numeric stop-loss/targets | LOW (misaligned with project intent) | MEDIUM | P3 (do not build) |
| Intraday re-scoring | LOW (architecture mismatch) | HIGH | P3 (do not build) |
| Standalone indicator dashboard | LOW (conflicts with UX convention) | MEDIUM | P3 (do not build) |

**Priority key:**
- P1: Must have for v2.7 launch (matches PROJECT.md Active requirements exactly)
- P2: Should have, strong fast-follow candidates
- P3: Anti-features / explicitly do not build given current project scope and philosophy

**Note on News-catalyst awareness:** Because this project already collects Finnhub company
news per ticker and has a proven ticker-matching utility (`holding-news.ts`), extending that
same extraction to watchlist symbols is low marginal cost. The milestone's own "Target
features" list already includes "関連ニュース" as part of daily tracking data supply, so this
should likely be folded into the P1 Daily Tracking Data Supply phase during planning rather
than treated as a separate deferred item.

## Competitor / Precedent Feature Analysis

Since this is a single-user personal tool, "competitors" here means general retail signal-app
and swing-trading-screener patterns, used to sanity-check that the new watchlist design matches
how the domain actually solves entry timing — while adapting to this project's own established
architecture (deterministic verification, prose rationale, fail-soft pipeline steps).

| Feature | Generic signal apps (AMSON, Stock Signal, ProTicker) | Swing-trading screeners (TradingView, LevelFields, ChartsWatcher) | This project's v2.7 approach |
|---------|--------------------------------------------------------------|---------------------------------------------------------------------|--------------------------|
| Signal presentation | Simple BUY/SELL/HOLD badge + numeric entry/stop/target | Filterable indicator screen (RSI/MA/volume columns), user interprets manually | Binary buy-today/wait badge + prose rationale citing concrete collected facts (reuses project's existing badge+rationale UX) — no fabricated numeric price targets |
| Entry timing basis | Proprietary black-box "AI signals," rarely explains reasoning | Explicit indicator confluence (MA position + RSI band + volume), user must manually combine | LLM judgment agent reasoning over collected technicals + news, with TS-side structural verification (zod) rather than trusting LLM self-report — matches this project's house doctrine |
| News integration | Rare; mostly price-only | Absent; purely technical screens | Direct differentiator — reuses existing Finnhub/WebSearch news pipeline already built for portfolio holdings |
| List maintenance | Push notifications on trigger, no explicit staleness policy shown to user | User-driven manual pruning (weekly review discipline is a *user* practice, not a *tool* feature) | Automated staleness + downgrade + purchase-based removal implemented directly in TS (deterministic), removing the maintenance burden from the user — an improvement over both competitor categories |
| Consistency across days | Not addressed in marketing materials; documented LLM-based signal tools suffer from low day-to-day recommendation overlap (<30% in some studies without constraints) | N/A (deterministic indicator math, not LLM-based) | Mitigated via zod-verified structured output + (P2) multi-day memory comparison against yesterday's verdict, consistent with the project's existing `decisionChanged` deterministic-diff precedent — directly addresses the flip-flopping risk documented in LLM-trading-signal literature |

## Sources

- Internal precedent (HIGH confidence, primary source, direct code inspection):
  `src/data/market.ts` (confirms `yahooFinance.quote()` already in use via `new YahooFinance()`,
  making `quoteType` available for ETF filtering at zero marginal API cost)
- Internal precedent (HIGH confidence, primary source, direct code inspection):
  `src/meeting/types.ts` (confirms existing `highlightedStocks: { symbol, averageScore,
  verdict: 強気/中立/弱気 }` shape this milestone extends)
- `.planning/PROJECT.md` (HIGH confidence, primary source — milestone target features,
  constraints, out-of-scope decisions, and full history of established architectural patterns:
  ID-reference anti-hallucination, alias-hardened zod schemas, fail-soft pipeline steps,
  TS-side deterministic verification of LLM output, prose-over-tables convention)
- [RSI Indicator: Day Trading Settings & Strategies 2026 — TradingSim](https://www.tradingsim.com/blog/relative-strength-index-rsi) — MEDIUM confidence
- [LevelFields — How to Pick Stocks for Swing Trading](https://www.levelfields.ai/news/how-to-pick-stocks-for-swing-trading-a-data-driven-approach-that-actually-works) — MEDIUM confidence
- [8 Best Indicators for Swing Trading — ChartsWatcher](https://chartswatcher.com/pages/blog/8-best-indicators-for-swing-trading-to-use-in-2025) — MEDIUM confidence
- [Pullback Trading Strategy — Capital.com](https://capital.com/en-eu/learn/trading-strategies/pullback-trading) — MEDIUM confidence
- [Breakout Retest Volume Entry — Trade with the Pros](https://tradewiththepros.com/breakout-retest-volume-entry/) — MEDIUM confidence
- [Trade Entry Checklist — Bulls On Wall Street](https://www.bullsonwallstreet.com/post/trade-entry-checklist) — MEDIUM confidence
- [How to Build a Trading Watchlist That Actually Works in 2026 — TradeAlgo](https://www.tradealgo.com/trading-guides/tools/how-to-build-a-trading-watchlist-that-actually-works-in-2026) — MEDIUM confidence (source of staleness/turnover/removal-trigger findings)
- [How to Build a Stock Watchlist — StockAlarm](https://pro.stockalarm.io/blog/how-to-build-a-stock-watchlist) — MEDIUM confidence
- [Watchlists Overview — tastytrade support](https://support.tastytrade.com/support/s/solutions/articles/43000435402) — MEDIUM confidence
- [What is a Trading Setup? — Aron Groups](https://arongroups.co/technical-analyze/trading-setup/) — MEDIUM confidence (entry/stop/target structure findings)
- [Checklist for Perfect Trade Entry and Exit — For Traders](https://www.fortraders.com/blog/trade-entry-exit-checklist) — MEDIUM confidence
- App Store listings for Stock Signal, ProTicker Signals, Stocks To Buy Now, AMSON Trading Signals — LOW–MEDIUM confidence (marketing copy, used only for signal-presentation-pattern comparison, not technical criteria)
- [Multifaceted variability in LLM-driven stock recommendations — ScienceDirect](https://www.sciencedirect.com/science/article/abs/pii/S1544612325021762) — MEDIUM confidence (key finding: <30% repeat-query overlap in unconstrained LLM stock picks — informs the multi-day consistency mitigation above)
- [Strat-LLM: Stratified Strategy Alignment — arXiv](https://arxiv.org/html/2605.06024v1) — MEDIUM confidence (informs "constrained execution protocol" pattern, consistent with this project's existing zod-verification doctrine)

---
*Feature research for: entry-timing watchlist & ETF exclusion (v2.7)*
*Researched: 2026-07-15*

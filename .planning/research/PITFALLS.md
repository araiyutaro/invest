# Pitfalls Research

**Domain:** Adding entry-timing watchlist, ETF exclusion, and daily buy-timing LLM judgment to an existing daily automated multi-agent investment analysis pipeline (v2.7 Entry Timing Watchlist & ETF Exclusion — TypeScript + tsx, Claude Code subagents, yahoo-finance2 v3, Finnhub, launchd cron, fail-soft steps, zod-validated LLM outputs)
**Researched:** 2026-07-15
**Confidence:** MEDIUM (mix of MEDIUM-confidence external sources — official library source, vendor docs, arXiv research — and LOW-confidence single-source web claims; project-specific pitfalls are grounded directly in this repo's existing code and commit history, which is HIGH confidence)

> **Note:** This file supersedes the v2.5-era PITFALLS.md (holdings news injection + WebSearch re-evaluation pitfalls), which is no longer the active milestone. Those findings remain valid in the shipped code but are not repeated here — this file is scoped exclusively to the v2.7 Entry Timing Watchlist & ETF Exclusion milestone.

This is a **subsequent milestone** on a live system with an established convention set (fail-soft STEP markers, TS-side deterministic verification of LLM self-report, `independent-then-compare` prompting, alias-hardened zod schemas, same-day re-run guards). Most pitfalls below are new failure modes specific to *watchlists that grow over time* and *daily timing judgments*, which this project has not previously had to handle (existing per-ticker steps like `collect-technicals`/`holding-news` operate on a small, roughly-fixed 12-ticker portfolio, not a growing, unbounded list).

## Critical Pitfalls

### Pitfall 1: Prompt-only ETF exclusion without TS-side deterministic verification

**What goes wrong:**
The analyst prompt says "don't recommend ETFs," but LLMs still let ETFs through — especially thematic/sector ETFs that read like a normal "pick" (e.g., `SOXX`, `XLK`, a JP sector ETF), or tickers the model doesn't recognize as funds. This project's own ticker-extraction code already treats the string `"ETF"` as a denylisted acronym to strip from free text (`src/scripts/extract-tickers.ts` line 15), which proves the underlying pattern — LLM output containing junk that needs TS-side cleanup — already exists here. But that's a string-level filter on the word "ETF" appearing in prose, not a security-type check on a ticker; it does nothing to stop an actual ETF ticker like `QQQ` or a JP-listed ETF from being promoted into `picks`/`highlightedStocks`.

**Why it happens:**
LLMs are asked to reason over "attractive investment opportunities" and naturally surface diversified vehicles when topically relevant (a sector-rotation call, a "safe way to play AI infra" suggestion). Prompt instructions alone are probabilistic, not structural — the same class of failure this project already learned from `decisionChanged`/`urgent` self-reporting being unreliable (per PROJECT.md Key Decisions: "LLM自己申告を信用せず...TS専用フィールドはスキーマtransformで構造的にstrip").

**How to avoid:**
Two-layer defense, matching the project's established "LLM proposes, TS verifies" pattern:
1. **Prompt layer:** explicit instruction to exclude ETFs/index funds/REIT funds from picks, with 2-3 concrete examples across both US and JP tickers.
2. **TS deterministic layer (source of truth):** for every candidate ticker, call yahoo-finance2's quote endpoint and check the `quoteType` field. The library's own source (`quoteSummary-iface.ts`) confirms `quoteType` returns `"EQUITY" | "ETF" | "MUTUALFUND"` (plus other non-equity types like `"INDEX"`) — filter out anything where `quoteType !== "EQUITY"`. Do NOT rely on ticker-name heuristics (letter-count patterns, `.T` suffix) — those false-positive against legitimate small-cap equities and false-negative against ETFs that don't "look like" ETFs by name alone.
3. Treat the TS `quoteType` check as authoritative; if it disagrees with the LLM's own classification, TS silently wins (log it for debugging, don't ask the LLM to confirm — reuse the `decisionChanged` lesson that TS should not defer to LLM self-report for a fact TS can determine directly).

**Warning signs:**
- Any ETF ticker appearing in `docs/` Daily Report highlight cards or the watchlist JSON.
- `quoteType` lookup failing/timing out silently and defaulting to "allow" (fail-open on a filter is a silent bug — must fail-closed).

**Phase to address:**
Phase implementing ETF exclusion — foundational, must land before or alongside watchlist persistence, since a bad ticker entering the watchlist on day one pollutes tracked history going forward and would require manual `data/` cleanup to fix retroactively.

---

### Pitfall 2: Unbounded watchlist growth degrading pipeline runtime and API budget over months

**What goes wrong:**
The watchlist accumulates every bullish-verdict ticker daily with no cap. After a few months of daily runs, the tracked-ticker count can realistically reach 50-150+ (5 analysts × daily bullish picks across US+JP universes, minus attrition). Every additional ticker means one more Yahoo Finance quote/technicals fetch, one more Finnhub company-news fetch, and one more LLM judgment call per day — multiplying, not adding, pipeline runtime. This project already measures and displays per-step pipeline duration (v2.2 パイプライン実行時間計測), so slow creep will eventually be visible in that instrumentation, but only after it has already become a problem.

**Why it happens:**
"Append daily, remove on bearish re-rating or purchase" sounds bounded, but in practice most tracked stocks sit in a "still bullish, never purchased" limbo indefinitely — there's no forced timeout in the milestone's stated scope. The two specified removal conditions (re-rating to neutral/bearish, or portfolio.json purchase) are both relatively rare events compared to the daily addition rate, especially with 5 analysts surfacing overlapping-but-not-identical bullish names across two markets — so net growth is very likely positive on average.

**How to avoid:**
- Add a **third removal condition** beyond the two specified in scope: staleness/age-based expiry (e.g., auto-drop after N trading days if verdict hasn't changed and it hasn't been purchased). This changes product behavior beyond the current milestone scope, so it should be surfaced explicitly during roadmap/phase discussion rather than silently added or silently omitted — flag it now as a near-term necessity.
- At minimum, instrument and log watchlist size and total per-run API call count in the existing pipeline timing output from day one, so growth is visible before it becomes an incident rather than discovered retroactively.
- Consider whether a hard size cap (e.g., top N by recency/conviction) is preferable to unbounded accumulation, even if the milestone's literal spec doesn't mention one — bounded-by-design is cheaper than retrofitting a cap onto an already-large `data/` JSON later.

**Warning signs:**
- Pipeline step duration for the new watchlist-data-supply step trending upward week over week in the existing timing output.
- Watchlist ticker count growing faster than removal count over any rolling multi-week window.

**Phase to address:**
Watchlist persistence phase — the removal/expiry policy must be designed alongside the append policy, not bolted on after the file has already grown unbounded.

---

### Pitfall 3: yahoo-finance2 / Finnhub rate limits hit as per-ticker daily calls multiply with watchlist size

**What goes wrong:**
yahoo-finance2 is an unofficial scraper of Yahoo's web endpoints (confirmed via the library's own GitHub issue tracker) with no documented official rate limit or SLA — it returns HTTP 429 under burst load, and Yahoo can intermittently rate-limit or block by IP/pattern without advance warning. Finnhub's free tier is more predictable (60 calls/min, with an internal 30 calls/sec cap, per Finnhub's own rate-limit documentation) but the existing pipeline already spends part of that budget on general news + portfolio-ticker company news; adding one more call per watchlist ticker per day compounds against the same shared budget. As the watchlist grows (Pitfall 2), the marginal API load compounds daily — this is the kind of failure that's invisible in development (testing with 3-5 tickers) and only appears once real accumulation happens in production over weeks.

**Why it happens:**
Development and testing naturally happen with a small number of test tickers; rate-limit failures are load-dependent and won't reproduce until the watchlist has organically grown over weeks. Also, the existing per-ticker fetch code in this pipeline (`collect-technicals`, `holding-news`) was designed for a small, mostly-fixed set (portfolio holdings, ~12 tickers) — reusing that pattern verbatim for a list that's designed to keep growing inherits an assumption (bounded N) that no longer holds.

**How to avoid:**
- Batch requests where the API supports it (yahoo-finance2 supports multi-symbol quote calls — prefer one batched call over N single-symbol calls).
- Stagger/rate-limit outbound calls explicitly (small delay between requests) rather than firing all watchlist tickers concurrently with `Promise.all`.
- Cache same-day repeated lookups (if a ticker is both a portfolio holding AND on the watchlist, don't fetch it twice in the same run).
- Design the watchlist data-supply step as fail-soft per-ticker, matching this project's established fail-soft philosophy: one ticker's fetch failure should degrade that ticker's judgment (skip it, mark insufficient data) rather than aborting the whole step or pipeline.
- Tie this directly to Pitfall 2's size cap/expiry — bounding the list also bounds the API call ceiling, rather than treating rate limits and list growth as unrelated concerns.

**Warning signs:**
- 429 responses or empty/error results appearing in pipeline logs for watchlist tickers specifically (as distinct from the stable, already-battle-tested portfolio-ticker set).
- Pipeline step duration for watchlist data supply scaling roughly linearly (or worse) with watchlist size, threatening the daily launchd time budget.

**Phase to address:**
Daily tracking data-supply phase — must be designed with batching/staggering/fail-soft-per-ticker from the start, not retrofitted after rate-limit failures start appearing in production.

---

### Pitfall 4: LLM buy-timing verdict flip-flops day to day on near-identical data ("buy today" → "wait" → "buy today")

**What goes wrong:**
Research on LLM-based trading signal generation (arXiv work such as AlphaForgeBench and related agentic-trading studies) found that LLMs produce inconsistent action sequences across runs on identical or near-identical market data — even at temperature=0 — because (a) each day's LLM call is stateless with no persistent memory of yesterday's verdict or its stated reasoning, and (b) markets move continuously while the output ("buy today" vs "wait") is discrete, so small day-to-day input deltas (a small price move, one new headline) can flip a judgment that is actually still fundamentally unchanged. For a daily-refreshed watchlist feature whose entire value proposition is "tell me when to act," visible flip-flopping (buy → wait → buy on essentially flat price action) will erode user trust in the signal faster than any crash would, and is a much subtler bug — it looks like the feature "worked" every single day.

**Why it happens:**
A naive daily-independent-judgment design has no inertia/hysteresis mechanism; each day's LLM call reasons from a fresh snapshot with no explicit instruction to weigh consistency with its own prior verdict.

**How to avoid:**
- Inject the **previous verdict and its stated rationale** into the day's prompt. This project already has this exact pattern for portfolio holdings ("前日判断スナップショット注入", `independent-then-compare` ordering, same-day re-run guard — per PROJECT.md Phase 22/PORT-05) — reuse that established pattern here rather than inventing a new one.
- Require the LLM to explicitly state whether today's verdict differs from yesterday's and why, using the same `independent-then-compare` structure (evaluate independently first, then compare) already used to mitigate anchoring bias for `decisionChanged`.
- Consider a minimum "conviction delta" or day-count threshold before flipping the surfaced badge — e.g., don't switch "wait" to "buy today" on a single borderline day; require the same computed judgment on two consecutive days before changing the displayed badge. This would be a TS-side deterministic hysteresis/debounce layer, consistent with the project's existing preference for TS-side determinism over LLM self-report for anything that can be computed.
- Do NOT rely on LLM temperature settings alone to fix this — research explicitly found inconsistency persists even at temperature=0, because the root cause is architectural statelessness, not sampling randomness.

**Warning signs:**
- Watchlist history showing verdict oscillation for a ticker with stable/flat price and no material news across consecutive days.
- A "wait" verdict immediately following a "buy today" verdict for the same ticker with no new information in between.

**Phase to address:**
Buy-timing judgment agent phase — the prior-verdict injection and independent-then-compare structure must be designed into the initial prompt contract, reusing patterns/code from the existing portfolio `decisionChanged` implementation rather than being treated as a later refinement.

---

### Pitfall 5: Lookahead bias — judging "buy today" using yesterday's close before today's market has opened

**What goes wrong:**
The pipeline runs daily via launchd (currently ~8 AM). If the watchlist data-supply step fetches "current" price/technicals before the target market (US or Japan) has opened for the day, the LLM's "buy today" judgment is actually reasoning about the prior close while presenting it — implicitly or explicitly — as an actionable same-day signal. This is a lookahead-bias / causality-violation pattern well documented in quant-trading literature: closing prices aren't available until market close, so using them to imply "the situation right now" before the next session opens is misleading. For US tickers at an 8 AM JST run, US markets haven't opened yet (US regular session opens roughly 22:30/23:30 JST depending on DST) — so a "buy today" US-ticker verdict generated at 8 AM JST is, at best, advice for a session that starts many hours later, using data that will be stale by the time the user can act on it. For JP tickers, 8 AM JST is pre-market (TSE opens 9:00 JST) — closer to real-time, but still technically pre-open, and the two markets should not be treated with identical "as of now" language.

**Why it happens:**
Cross-timezone pipelines (JST execution time, mixed US/JP ticker universe — this project explicitly targets both) make "today" ambiguous. It's easy to silently treat "most recent close from yahoo-finance2" as equivalent to "current price" without surfacing the as-of timestamp to the user or distinguishing US vs JP session timing in the prompt/report copy.

**How to avoid:**
- Explicitly timestamp every price/technical data point fed to the judgment agent with its actual as-of date/session, and require the report to display that as-of date next to the buy-timing badge — never let the badge imply real-time immediacy it doesn't have.
- Frame the LLM's judgment language relative to the correct next actionable session (e.g., "次回のUS市場寄付き時点で" for US tickers) rather than an ambiguous "today."
- Distinguish JP tickers (near-real-time given the 8 AM JST run time, market opens same-day at 9:00 JST) from US tickers (data is the prior US session's close; next actionable session is that evening JST) in both the data pipeline and the report copy — this is a real structural difference between the two markets given this project's fixed run schedule, not a detail to gloss over.
- Detection technique from lookahead-bias literature: artificially delay the price feature by one session in a test run and check whether the judgment's rationale collapses or becomes inconsistent — if the "buy today" reasoning secretly depended on intraday movement that hadn't happened yet, this exposes it.

**Warning signs:**
- Report copy or LLM rationale referencing "today's price action" when the underlying data is actually the prior close.
- User confusion about acting on a "buy today" signal for a US stock that had already moved significantly by the time the US market actually opened.

**Phase to address:**
Daily buy-timing judgment phase — the as-of timestamping and US/JP session-awareness must be part of the initial data contract (what's passed to the LLM and what's rendered), not a copy edit added after users notice staleness.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|-----------------|-------------------|
| Ticker-name regex/pattern matching for ETF detection instead of `quoteType` API check | No extra API call, faster to ship | False positives/negatives (misses non-obvious ETF tickers, wrongly excludes legitimate equities with fund-like names) | Never as the sole mechanism — acceptable only as a cheap pre-filter ahead of the authoritative `quoteType` check |
| No watchlist size cap / no expiry ("we'll add it later") | Simpler v1 scope, matches the literal milestone wording | Runtime/API-budget creep becomes a production incident months in; retrofitting a cap onto an already-large `data/` JSON is more disruptive than designing it in | Only acceptable if a size/growth monitor is added from day one so the "later" fix has a concrete trigger, not a surprise |
| Independent-per-day LLM judgment with no prior-verdict injection | Simpler prompt, faster to implement | Flip-flopping badge erodes trust in the single most visible new feature | Never — this project has already solved this exact class of problem for `decisionChanged`; reuse it, don't skip it |
| Treating yahoo-finance2 "latest quote" as always-current without as-of timestamping | Simpler prompt/report, no timezone-handling code | Misleading "buy today" for US tickers generated on stale prior-close data at an 8 AM JST run | Never for a feature whose entire value proposition is same-day timing |
| Fetching watchlist tickers with unbounded `Promise.all` concurrency | Simple, fast in small tests | 429s under production-scale watchlist load, correlated failures across the whole batch | Only acceptable while watchlist stays under roughly 10 tickers; must be revisited before general accumulation |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|-----------------|--------------------|
| yahoo-finance2 `quoteType` | Assuming ticker string patterns (`.T` suffix, letter-count heuristics) reliably indicate ETF vs equity | Use the library's `quoteType` field (`EQUITY`/`ETF`/`MUTUALFUND`) as the deterministic source of truth; fail-closed (exclude) on lookup failure |
| yahoo-finance2 rate limits | Firing N individual quote calls concurrently, one per watchlist ticker | Batch multi-symbol calls where supported; stagger remaining calls; cache within a run |
| Finnhub company news per ticker | Assuming the existing ~12-ticker portfolio call budget scales linearly to watchlist without checking combined total against the 60/min free-tier cap | Track total daily call count across portfolio + watchlist + general news calls as one shared budget, not independent per-feature budgets |
| `data/` vs `tmp/portfolio.json` for purchase-detection auto-removal | Assuming portfolio holdings already live in `data/`, per the milestone's stated storage location for the watchlist, without checking the current actual path | The current portfolio source is `tmp/portfolio.json`, not `data/portfolio.json` — verify the actual path in code before wiring auto-removal logic against it |
| Japanese ticker `.T` suffix handling | Treating `.T` as sufficient signal to route through "Japanese ticker" logic without also checking `quoteType`, since JP-listed ETFs and REIT funds also carry `.T` | Suffix determines exchange/locale only; `quoteType` (not suffix) determines fund-vs-equity classification — keep these two checks orthogonal, never conflate them |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|------------------|
| Unbounded daily-append watchlist | Pipeline step duration for watchlist data-supply creeping up week over week | Size cap or age-based expiry from day one; log watchlist size/growth trend in existing timing output | Roughly 30-60 days of accumulation if net additions exceed removals, given 5-analyst daily bullish-pick overlap across two markets |
| Sequential/unbatched per-ticker API calls scaling with watchlist size | Pipeline total runtime growing linearly or worse with watchlist size, risking the launchd daily time budget or delaying deploy | Batch calls, stagger concurrency, fail-soft per-ticker so one slow/failing ticker doesn't block the rest | Once watchlist exceeds roughly 15-20 tickers with naive concurrent-per-ticker fetching |
| LLM judgment call cost/latency scaling per watchlist ticker (one Claude call per ticker per day) | Increased pipeline duration and Claude API cost as watchlist grows, stacking on top of existing 5-analyst + moderator + news-curator + portfolio-research calls | Consider batching multiple tickers into fewer LLM calls (clearly structured per ticker) rather than 1:1 call-per-ticker once the list grows large | Becomes noticeable once watchlist size rivals the number of existing per-item calls (portfolio-research already runs 12 parallel Claude calls; adding N more without a shared budget view compounds runtime and cost) |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Fail-open ETF filter (unrecognized `quoteType` or API failure defaults to "include") | ETF silently reaches Daily Report highlights / watchlist, defeating the entire exclusion feature invisibly | Fail-closed: on lookup error or unrecognized `quoteType`, exclude the ticker and log a warning rather than defaulting to include |
| Trusting LLM self-reported "is this an ETF: no" field as ground truth | Same failure class this project already learned from `decisionChanged`/`urgent` — LLM self-report is not reliable | TS-side `quoteType` check is authoritative; the LLM's own classification is informational only, never load-bearing |
| Purchase-detection auto-removal matching only on ticker symbol string, ignoring market/exchange | Wrong ticker silently removed from or retained on the watchlist (e.g., a symbol collision between markets), breaking tracking data integrity | Match on both ticker symbol AND market/exchange when cross-referencing watchlist entries against portfolio holdings, not string-only match |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|--------------------|
| "今日買うべき" badge shown without an as-of data timestamp | User acts on stale prior-close data believing it's current, especially for US tickers evaluated pre-market | Always display the as-of date/session next to the badge; distinguish "based on yesterday's US close" vs "based on today's JP open" |
| Verdict flip-flops without explanation of what changed | User loses trust in the signal and starts ignoring it (worse than not having the feature at all) | When a verdict changes from the prior day, explicitly state what changed (price move, new news, re-rating) — reuse the existing `decisionChanged` badge pattern conceptually |
| Watchlist grows silently with no visible curation, burying genuinely actionable "buy today" signals among many stale "still watching" entries | Feature becomes noise, defeating its purpose as an actionable daily signal | Surface tickers with an actionable state change or an active "buy today" verdict prominently; de-emphasize long-standing "still waiting" entries |

## "Looks Done But Isn't" Checklist

- [ ] **ETF exclusion:** Often missing fail-closed behavior on `quoteType` lookup failure — verify a simulated API timeout results in exclusion, not silent inclusion.
- [ ] **ETF exclusion:** Often missing coverage for Japanese-listed ETFs/REIT funds (which also carry the `.T` suffix like ordinary equities) — verify test cases include at least one JP ETF/REIT ticker, not only US tickers.
- [ ] **Watchlist persistence:** Often missing a removal/expiry path beyond the two specified (bearish re-rating, purchase) — verify there is at least a documented decision (even if deferred) for the "still bullish, never purchased, never re-rated" indefinite-limbo case.
- [ ] **Watchlist persistence:** Often missing same-day re-run idempotency — this project has hit this exact bug class before with history files (urgency-history.json same-day overwrite guard) — verify running the pipeline twice in one day doesn't double-append the same ticker to the watchlist.
- [ ] **Daily tracking data supply:** Often missing fail-soft-per-ticker isolation — verify one ticker's Yahoo/Finnhub fetch failure produces a partial/skipped judgment for that ticker only, not a pipeline-wide failure, matching the project's established fail-soft philosophy.
- [ ] **Buy-timing judgment:** Often missing prior-verdict injection — verify the prompt actually includes yesterday's verdict + rationale, not just today's fresh data (copy the existing portfolio `decisionChanged` prompt pattern rather than reinventing it).
- [ ] **Buy-timing judgment:** Often missing US/JP session-awareness — verify the as-of timestamp and "next actionable session" framing correctly differ between US and JP tickers given the fixed ~8 AM JST run time.
- [ ] **Daily Report UI:** Often missing empty-state handling for a watchlist with zero entries (early days after this feature ships, before enough bullish picks accumulate) — verify the section renders sensibly with zero, one, and many tickers.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|-----------------|-------------------|
| ETF slipped into watchlist/report before detection was fixed | LOW | One-time manual cleanup of the `data/` watchlist JSON to remove the bad entries; add a regression test pinned to that specific ticker |
| Watchlist grew unbounded before a cap was added | MEDIUM | Backfill a one-time pruning script (age-based or size-based) against the existing `data/` file; add the cap/expiry going forward; note the one-time prune in a commit message for auditability |
| Rate-limit failures started appearing in production due to watchlist growth | LOW-MEDIUM | Add batching/staggering/caching to the data-supply step (no schema changes required); can ship as a fast-follow fix without touching persisted data |
| Flip-flopping verdicts already visible in shipped report history | MEDIUM | Add prior-verdict injection and/or a debounce/hysteresis layer going forward; past history entries don't need retroactive correction — forward-fix and optionally annotate that the mechanism changed on a given date |
| Lookahead-bias-tainted "buy today" copy already shipped | LOW | Copy/prompt fix only (add as-of timestamp, adjust language) — no data model change required, can ship as a fast-follow |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|--------------------|----------------|
| Prompt-only ETF exclusion without TS verification | ETF exclusion phase | Test suite includes at least one US ETF, one JP ETF/REIT, one legitimate small/mid-cap equity with fund-like naming, and a simulated `quoteType` lookup failure (must fail-closed) |
| Unbounded watchlist growth | Watchlist persistence phase | Design explicitly addresses a size cap or expiry policy before implementation; a synthetic multi-week simulation test confirms bounded (or intentionally monitored) growth |
| API rate limits from growing per-ticker calls | Daily tracking data-supply phase | Load test with a simulated 30-50 ticker watchlist confirms no 429s and the pipeline stays within its time budget; fail-soft-per-ticker verified via a simulated single-ticker failure |
| LLM verdict flip-flopping | Buy-timing judgment agent phase | Prompt contract includes prior-verdict injection; a manual/scripted test with flat price action over consecutive days confirms verdict stability (or an explained change) |
| Lookahead bias / stale pre-market data | Buy-timing judgment agent phase | Report renders an explicit as-of timestamp; US vs JP ticker copy reviewed for session-awareness before ship |

## Sources

- [gadicc/yahoo-finance2 quoteSummary-iface.ts (GitHub source)](https://github.com/gadicc/node-yahoo-finance2/blob/devel/src/modules/quoteSummary-iface.ts) — confirms `quoteType` field values EQUITY/ETF/MUTUALFUND (MEDIUM confidence, official library source)
- [gadicc/yahoo-finance2 quote.ts (GitHub source)](https://github.com/gadicc/yahoo-finance2/blob/dev/src/modules/quote.ts)
- [Finnhub API rate-limit docs](https://finnhub.io/docs/api/rate-limit) — 60 calls/min free tier, 30 calls/sec internal cap (MEDIUM confidence, vendor docs)
- [gadicc/yahoo-finance2 GitHub issue #982 — Too Many Requests](https://github.com/gadicc/yahoo-finance2/issues/982) (LOW confidence, community issue thread, no official SLA)
- [AlphaForgeBench: Benchmarking End-to-End Trading Strategy Design with LLMs (arXiv 2602.18481)](https://arxiv.org/html/2602.18481v2) — LLM trading action inconsistency across runs even at temperature=0 (MEDIUM confidence)
- [Agentic Trading: When LLM Agents Meet Financial Markets (arXiv 2605.19337)](https://arxiv.org/html/2605.19337v1)
- [Look-Ahead Bias — Corporate Finance Institute](https://corporatefinanceinstitute.com/resources/career-map/sell-side/capital-markets/look-ahead-bias/) (MEDIUM confidence, established finance education source)
- [Freqtrade — Lookahead analysis documentation](https://www.freqtrade.io/en/stable/lookahead-analysis/) (MEDIUM confidence, official trading-bot framework docs)
- Project-internal grounding (HIGH confidence, direct code/history inspection): `src/scripts/extract-tickers.ts` (ETF as denylisted string), `tmp/portfolio.json` (actual current portfolio path, not `data/`), commit history for prior ticker false-positive fixes (`aa086b8`, `87447b0`, `35c7012`), and `.planning/PROJECT.md` Key Decisions table (decisionChanged/urgent TS-side determinism, independent-then-compare pattern, fail-soft design precedent)

---
*Pitfalls research for: Entry Timing Watchlist & ETF Exclusion (v2.7 milestone)*
*Researched: 2026-07-15*

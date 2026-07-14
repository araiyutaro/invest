# Architecture Research

**Domain:** Entry-Timing Watchlist & ETF Exclusion (v2.7) — integration into an existing Claude-Code-orchestrated multi-agent investment pipeline
**Researched:** 2026-07-15
**Confidence:** HIGH (all findings verified directly against current codebase, not training-data assumptions — this is an internal architecture-extension question, not an external ecosystem lookup)

## Standard Architecture

### System Overview (current pipeline, verified, before v2.7)

```
┌────────────────────────────────────────────────────────────────────────┐
│ Step 1: Data Collection (TS)                                           │
│  collect-data.ts → tmp/market.json, tmp/news.json, tmp/portfolio.json  │
├────────────────────────────────────────────────────────────────────────┤
│ Step 2: Analyst Meeting (Claude Agents, 3 rounds, orchestrated by      │
│         .claude/commands/invest.md)                                    │
│  2a Round1 (5 agents, opus, parallel) → tmp/round-1/*.json             │
│  2b extract-tickers.ts + collect-technicals.ts → tmp/technicals.json   │
│  2c Round2 discussion (5 agents, opus) → tmp/round-2/*.json            │
│  2d moderator-issues (1 agent, opus) → tmp/moderator-issues.json       │
│  2e Round3 scoring (5 agents, sonnet) → tmp/round-3/*.json             │
│  2f moderator-final (1 agent, opus) → tmp/meeting-result.json          │
│      (highlightedStocks: ticker/verdict/averageScore/agentScores/...)  │
│  2g validate-meeting.ts (zod)                                          │
├────────────────────────────────────────────────────────────────────────┤
│ Step 3: WebSearch + Report Generation                                  │
│  3-P portfolio-research (12 agents, sonnet, fail-soft)                 │
│       → tmp/portfolio-research/{symbol}.json                           │
│  3a  websearch per highlightedStock (agents) → tmp/websearch/*.json    │
│  3b  reeval (5 agents) → tmp/reeval/*.json                             │
│  3d  portfolio-analyst (1 agent, opus) → tmp/portfolio-analysis.json   │
│       news-curator (1 agent, opus) → tmp/news-curation.json            │
│  3f  write-urgency-history.ts (TS, fail-soft) → data/urgency-history.json│
│  3c  generate-report.ts (TS) → docs/{date}/*.html (3 reports)          │
│  3e  write-news-digest.ts (TS, fail-soft) → docs/{date}/news-digest.html│
├────────────────────────────────────────────────────────────────────────┤
│ Step 4: Deploy (TS)                                                    │
│  update-index.ts, archive-old-reports.ts, git add docs/ docs_old/ data/│
└────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities (existing, relevant to v2.7)

| Component | Responsibility | Verified Detail |
|-----------|----------------|------------------|
| `src/meeting/types.ts` / `schemas.ts` | Canonical TS interfaces + zod validators for all agent-produced JSON | `passthrough().transform()` alias-hardening (e.g. `holdingEvaluationSchema`'s `urgent`/`urgency`/`isUrgent`/`urgentFlag` alias collapse); TS-only fields (`decisionChanged`, `previousDecision`) are absent from the raw pre-transform schema, so they are structurally impossible for the LLM to fabricate |
| `src/portfolio/holding-news.ts` | Deterministic extraction (ticker-exact match, then name/alias fallback, score, cap at 5) from `tmp/news.json` into a per-symbol ID-reference map | Pure functions (`matchArticlesForHolding`, `rankAndCapHoldingArticles`, `buildHoldingNewsMap`) + `resolvePortfolioHoldingNews()` for pool resolution; fail-soft (never throws, always returns all keys even with empty arrays) |
| `src/portfolio/urgency-history.ts` | Pure extraction/append functions for `data/urgency-history.json` persistence | `extractUrgencySnapshots`, `appendUrgencySnapshot`, `isValidDateKey` — zero I/O, immutable spreads only |
| `src/scripts/write-urgency-history.ts` | Thin fail-soft CLI wrapper around the pure module | Reads `tmp/portfolio-analysis.json` + `tmp/meeting-result.json`, calls the pure functions, writes `data/urgency-history.json`; never lets an internal error propagate as `[PIPELINE:FAIL]` — emits `[urgency-history] FAIL: <reason>` to stderr and `process.exit(1)`, which `invest.md` translates into a non-blocking `[STEP:urgency-history:FAIL:...]` marker |
| `src/scripts/collect-technicals.ts` | CLI wrapper around `fetchTechnicalSnapshots` (Yahoo Finance) | `parseTickerList()` already accepts three input shapes (`string[]`, `{tickers: string[]}`, `{highlightedStocks: [{ticker}]}`) — directly reusable for a watchlist ticker file with zero code change if the watchlist file exposes a `tickers: string[]` shape |
| `src/portfolio/holdings.ts` | Static portfolio holdings list (`PORTFOLIO_HOLDINGS`) | `as const` array of 12 fixed `{symbol, name, nameJa, sector, matchAliases?}` — single source of truth for current holdings, used both for exclusion (Step 2f prompt rule) and for Step 3-P iteration |
| `src/scripts/report-data-loaders.ts` | Fail-soft loaders turning `tmp/`/`data/` files into typed structures for report generators | `loadUrgencyHistory()` never throws (catches ENOENT and parse errors, returns `{}`); this is the loader-contract new report data must follow |
| `src/scripts/generate-portfolio-report.ts` | HTML string builder consuming loader outputs + pure aggregation | Calls `computeWeeklyUrgencyRollup(urgencyHistory, result.date)` (pure, from `src/portfolio/urgency-rollup.ts`) then formats HTML — the renderer itself stays "dumb," aggregation logic lives in a testable pure module |
| `src/meeting/schemas.ts` `lenientBoolean` | Tolerant boolean parser for LLM output type drift (`"true"`/`"false"` strings vs booleans) | Reusable utility for any new boolean-ish LLM field (e.g. a future `buyNow: boolean` in the judgment schema) |
| `.claude/commands/invest.md` | Orchestration script (step order, agent prompts, STEP markers, fail-soft branching) | Not code — a Claude Code skill definition executed live each run; every new pipeline component must be wired here as an explicit new Step |

## Recommended Project Structure (delta for v2.7)

```
src/
├── portfolio/
│   ├── holdings.ts                 # existing — PORTFOLIO_HOLDINGS (UNCHANGED)
│   ├── etf-exclusion.ts            # NEW — deterministic ETF detection/filter (pure)
│   ├── etf-exclusion.test.ts       # NEW
│   ├── watchlist.ts                # NEW — pure functions: admit/prune, same
│   │                                #        pure-module shape as urgency-history.ts
│   ├── watchlist.test.ts           # NEW
│   ├── holding-news.ts             # MODIFY — generalize the holding-shaped input
│   │                                #   type so watchlist tickers can reuse the same
│   │                                #   matching functions (see Pattern 4)
│   ├── urgency-history.ts          # existing — pattern to mirror, not modify
│   └── decision-diff.ts            # existing — pattern to mirror for verdict-drop pruning
├── meeting/
│   ├── types.ts                    # MODIFY — add WatchlistEntry, BuyTimingJudgment types
│   └── schemas.ts                  # MODIFY — add zod schema for buy-timing agent output
│                                    #   (passthrough().transform() alias-hardened, same style
│                                    #    as holdingEvaluationSchema / rawHoldingSchema)
├── scripts/
│   ├── collect-technicals.ts       # existing — REUSED AS-IS for watchlist tickers
│   ├── write-watchlist.ts          # NEW — fail-soft CLI wrapper mirroring
│   │                                #   write-urgency-history.ts exactly (admit + prune)
│   ├── generate-daily-report.ts    # MODIFY — add watchlist section renderer
│   └── report-data-loaders.ts      # MODIFY — add loadWatchlist() fail-soft loader
data/
├── urgency-history.json            # existing
└── watchlist.json                  # NEW — ticker-keyed state table (NOT date-keyed,
                                     #   see Anti-Pattern 2)
.claude/commands/
└── invest.md                       # MODIFY — insert new steps (see Step Order below)
```

### Structure Rationale

- **`src/portfolio/` stays the home for all watchlist/ETF logic** — it already owns `holdings.ts`, `holding-news.ts`, `urgency-history.ts`, `decision-diff.ts`. The watchlist is conceptually "the portfolio's forward-looking sibling" (tracked-but-not-owned tickers), so it belongs next to holdings, not in `src/meeting/` (which owns agent-output shapes only) or a new top-level folder.
- **New pure module (`watchlist.ts`) + new fail-soft CLI wrapper (`write-watchlist.ts`)** exactly mirrors the `urgency-history.ts` + `write-urgency-history.ts` split this codebase already validated twice (Phase 25/26). Copy the proven pattern, don't invent a new one: pure functions with zero I/O, one thin CLI wrapper that does the reading/writing and never lets an internal error escalate to `[PIPELINE:FAIL]`.
- **ETF exclusion as its own module (`etf-exclusion.ts`), not bolted onto `holding-news.ts` or `extract-tickers.ts`.** It has one sharply-scoped responsibility (is this ticker an ETF, yes/no) and two call sites (post `meeting-result.json` finalization, and again inside watchlist admission). Keeping it isolated makes it trivially unit-testable and reusable at both defense layers without coupling to unrelated modules.
- **`meeting/schemas.ts` and `meeting/types.ts` get the new buy-timing judgment shape**, consistent with how `HoldingEvaluation` / `ReevaluationOutput` already live there — this file is the single source of truth for all LLM-output contracts; the roadmap should not create a second contracts file.
- **`data/watchlist.json` is a new sibling file, not appended into `urgency-history.json`.** Different lifecycle (entries are added/removed with an active/inactive state over time, not an ever-growing daily log) and different consumer contract. Precedent: `data/` already holds one single-purpose file; a second sibling file continues that pattern instead of overloading the first with mixed shapes.

## Architectural Patterns

### Pattern 1: Two-Layer Defense (prompt instruction + TS deterministic verification)

**What:** Every hard constraint an LLM output must satisfy is stated in the prompt AND independently re-checked/enforced in TypeScript after the LLM responds. The TS layer is authoritative; the prompt layer is a best-effort nudge that reduces how often the TS layer must intervene.
**When to use:** Any place an LLM output must satisfy a structural rule — e.g. "no ETFs in picks/highlightedStocks," "urgent only when material event confirmed" (already existing precedent), "decisionChanged is TS-computed, never LLM-reported" (already existing precedent).
**Trade-offs:** Requires a second, independently-testable TS implementation of the rule (ETF detection logic), but this is the established codebase norm — explicitly documented in PROJECT.md's Key Decisions table ("LLM自己申告を信用せず...TS側決定論的検出") and reinforced by the 2026-07-14 commit "ティッカー誤抽出の除外拡充" (TS-side hardening layered on top of an already-existing prompt instruction that alone proved insufficient).

**Example (ETF exclusion, TS layer):**
```typescript
// src/portfolio/etf-exclusion.ts
const KNOWN_ETF_TICKERS: ReadonlySet<string> = new Set([
  "SPY", "QQQ", "VOO", "VTI", "IWM", /* curated, extend deliberately */
]);

export function isEtf(ticker: string): boolean {
  return KNOWN_ETF_TICKERS.has(ticker.trim().toUpperCase());
}

export function excludeEtfPicks<T extends { ticker: string }>(
  picks: ReadonlyArray<T>,
): ReadonlyArray<T> {
  return picks.filter((p) => !isEtf(p.ticker));
}
```
Call sites: (1) applied to `meeting-result.json`'s `highlightedStocks` immediately after Step 2f/before Step 2g validation (or as an explicit new micro-step, for auditability parity with how `extract-tickers.ts` already visibly filters portfolio tickers); (2) applied again inside `watchlist.ts`'s admission function as a second independent gate, since watchlist entries must never enter even if a future code path bypasses (1).

### Pattern 2: Pure Module + Fail-Soft CLI Wrapper (persistence pattern)

**What:** Business logic (admit/prune/extract/transform) lives in a pure, synchronous, throw-free module under `src/portfolio/`. A separate thin script under `src/scripts/` does all I/O (`readFile`/`writeFile`/`mkdir`), calls the pure functions, and is the only place that can `process.exit(1)` — and only after emitting a `[modulename] FAIL: <reason>` line to stderr that `invest.md` surfaces as a non-blocking `[STEP:...:FAIL:...]` marker.
**When to use:** The new `data/watchlist.json` persistence step (admit today's bullish tickers, prune downgrades/purchases) fits this exactly.
**Trade-offs:** Slightly more files than a single script, but this codebase has paid for this pattern twice already (`urgency-history.ts`/`write-urgency-history.ts`, and the derived `urgency-rollup.ts` built cleanly on top without touching the writer). Inlining I/O and logic together is the anti-pattern this project explicitly moved away from.

**Example:**
```typescript
// src/portfolio/watchlist.ts (pure)
export interface WatchlistEntry {
  readonly ticker: string;
  readonly nameJa: string;
  readonly addedDate: string;       // YYYY-MM-DD, first day verdict was 強気
  readonly lastVerdict: "強気" | "中立" | "弱気";
  readonly lastVerdictDate: string; // YYYY-MM-DD of most recent verdict update
  readonly removedReason?: "verdict-downgrade" | "entered-portfolio";
  readonly removedDate?: string;
}
export type WatchlistFile = Record<string, WatchlistEntry>; // keyed by normalized ticker

export function admitBullishStocks(
  watchlist: WatchlistFile,
  highlightedStocks: ReadonlyArray<{ ticker: string; verdict: string }>,
  today: string,
): WatchlistFile {
  /* pure merge; assumes ETF-filtered input (upstream), applies excludeEtfPicks again defensively */
}

export function pruneWatchlist(
  watchlist: WatchlistFile,
  latestVerdictByTicker: ReadonlyMap<string, string>,
  portfolioTickers: ReadonlySet<string>,
  today: string,
): WatchlistFile {
  /* pure: verdict downgrade (強気 → 中立/弱気) OR ticker now in portfolio.json → mark removed */
}
```
```typescript
// src/scripts/write-watchlist.ts (impure wrapper, mirrors write-urgency-history.ts's main())
```

### Pattern 3: tmp/*.json Handoff Boundary for the Judgment Agent

**What:** The buy-timing judgment agent, like `portfolio-analyst`, consumes only `tmp/*.json` file contents assembled by the `invest.md` orchestrator — never live tool calls to fetch price/technical data itself (WebSearch/WebFetch for qualitative news context is fine and mirrors the existing `portfolio-research-{symbol}` agents).
**When to use:** Any new agent step in this pipeline. Non-negotiable given the established constraint "tmp/*.json ハンドオフ境界（TS↔Claudeの受け渡しは全てファイル経由 — stdoutは届かない）" documented in PROJECT.md.
**Trade-offs:** None — this is how the whole pipeline already works; deviating breaks the orchestration model invest.md relies on.

### Pattern 4: Generalizing an Existing Matcher for a New Ticker Population

**What:** `holding-news.ts`'s matching functions (`matchArticlesForHolding`, `rankAndCapHoldingArticles`, `buildHoldingNewsMap`) are already written against `PortfolioHolding` (`{symbol, name, nameJa, matchAliases?}`), not against `PORTFOLIO_HOLDINGS` directly. Reusing them for watchlist tickers requires only supplying a different `ReadonlyArray<PortfolioHolding>`-shaped array at the call site — no duplication needed.
**When to use:** Building `tmp/watchlist-news.json` for Step 3-W2 (data supply).
**Trade-offs:** Watchlist tickers will lack human-curated `matchAliases` (that curation only exists for the 12 fixed holdings today) — accept ticker-exact + primary-name matching only for watchlist tickers at launch; alias curation can be added incrementally later without changing the function signatures.

```typescript
// Reuse verbatim — no new matching logic needed:
import { buildHoldingNewsMap } from "../portfolio/holding-news.js";
import type { PortfolioHolding } from "../portfolio/holdings.js";

const watchlistAsHoldingShape: ReadonlyArray<PortfolioHolding> = activeWatchlist.map((w) => ({
  symbol: w.ticker,
  name: w.ticker,      // no curated English name available yet — ticker doubles as name
  nameJa: w.nameJa,
  sector: "",          // unused by matching logic
}));
const watchlistNewsMap = buildHoldingNewsMap(newsPool, watchlistAsHoldingShape);
```

## Data Flow

### v2.7 Data Flow (new pieces marked NEW)

```
Step 2f moderator-final → tmp/meeting-result.json (highlightedStocks)
        │
        ▼
[NEW] ETF exclusion filter applied to highlightedStocks
       (immediately after Step 2f, before/alongside Step 2g validation)
        │
        ▼
tmp/meeting-result.json (highlightedStocks, ETF-free) — the single upstream
        source both existing Step 3 flow AND the new watchlist admission read from
        │
        ├───────────────────────────────────────────────┐
        ▼                                                ▼
[UNCHANGED] Step 3 continues exactly as today       [NEW] Step 3-W: watchlist update
  (Step 3-P, 3a, 3b, 3d all read highlightedStocks    (admit today's 強気 tickers via
   as before — zero changes needed to these steps)     admitBullishStocks(); prune via
                                                         pruneWatchlist() using verdict
                                                         downgrades + portfolio.json
                                                         membership)
                                                         → data/watchlist.json (updated)
                                                                │
                                                                ▼
                                              [NEW] Step 3-W2: watchlist data supply
                                              (collect-technicals.ts reused as-is on
                                               active watchlist tickers; holding-news.ts
                                               matcher reused via Pattern 4 against
                                               watchlist tickers)
                                              → tmp/watchlist-technicals.json
                                              → tmp/watchlist-news.json
                                                                │
                                                                ▼
                                              [NEW] Step 3-J: buy-timing judgment agent
                                              (1 agent per active watchlist ticker, or
                                               batched — see Build Order; model: sonnet,
                                               zod-validated output)
                                              → tmp/watchlist-judgment.json
                                                                │
                                                                ▼
                                    Step 3c generate-report.ts (Daily Report generator
                                    reads tmp/watchlist-judgment.json + data/watchlist.json
                                    via new loadWatchlist()/loadWatchlistJudgment() in
                                    report-data-loaders.ts) → docs/{date}/daily-report.html
                                    (new watchlist section)
                                                                │
                                                                ▼
                                    Step 4 deploy: `git add docs/ docs_old/ data/`
                                    ALREADY includes data/ — watchlist.json rides along
                                    for free, no deploy script change needed
```

### Key Data Flows

1. **ETF exclusion (two call sites):** (a) applied to `highlightedStocks` right after Step 2f/2g — analogous in spirit to how portfolio-ticker exclusion is already enforced via a moderator prompt instruction today, except this time backed by a mandatory TS filter pass, not prompt-only; (b) applied again defensively inside `watchlist.ts`'s admission function, so even a future code path that feeds candidates into the watchlist from somewhere other than `highlightedStocks` still cannot introduce ETFs.
2. **Watchlist admission/pruning is entirely TS-deterministic** — no LLM involvement, no prompt. Reads `tmp/meeting-result.json` (today's verdicts, ETF-filtered), `data/watchlist.json` (yesterday's state), and `src/portfolio/holdings.ts` / `tmp/portfolio.json` (current holdings), and writes the new `data/watchlist.json`. Must run **after** Step 2g (meeting-result finalized) and **before** Step 3-J (judgment agent needs the finalized active-ticker list) — early in Step 3, parallelizable with Step 3-P.
3. **Watchlist judgment agent input assembly mirrors `portfolio-analyst`:** reads `tmp/watchlist-technicals.json` (from `collect-technicals.ts`, reused verbatim — it already accepts a `{tickers: string[]}` shape) and `tmp/watchlist-news.json` (from `holding-news.ts`'s matcher reused per Pattern 4). Output is zod-validated with the same `passthrough().transform()` alias-hardening style as `holdingEvaluationSchema`.
4. **"Before report generation" placement is a hard requirement, matching the `write-urgency-history.ts` / Step 3f precedent**: Step 3f runs *before* Step 3c specifically so today's rollup data is available for today's report. The watchlist judgment write must follow the identical rule — it must complete before Step 3c so today's judgments appear in today's Daily Report, not tomorrow's.
5. **Deploy step already covers `data/`** — Step 4's `git add docs/ docs_old/ data/` requires zero modification; `data/watchlist.json` is swept up automatically once it exists on disk (same reasoning documented inline in invest.md for `data/urgency-history.json`).

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Current (single user, roughly 1-12 watchlist tickers/day expected, 1 run/day via launchd) | The design above is already correctly sized. No batching/queueing needed. |
| If the watchlist grows to 30+ simultaneously active tickers | Switch Step 3-J from N parallel single-ticker agents to a smaller number of batched agents (e.g. 5-8 tickers per agent call) to stay within a practical parallel-Agent-call ceiling — the same tradeoff Step 3-P implicitly settled by capping at exactly 12 (the fixed portfolio size). Batching also amortizes fixed per-call system-prompt overhead. |
| If historical watchlist-judgment analytics are wanted later (e.g. "win rate of buy-now calls") | Add a second date-keyed log file analogous to `urgency-history.json` (e.g. `data/watchlist-judgment-history.json`) rather than retrofitting `watchlist.json` itself, which should remain a "current state" table, not a growing log — mirrors the existing separation between `urgency-history.json` (append-only log) and `watchlist.json` (current-membership state). |

### Scaling Priorities

1. **First bottleneck:** parallel Agent-call count in Step 3-J if the watchlist grows large — mitigate via batching described above; not a concern at the expected 1-12 ticker scale.
2. **Second bottleneck:** none realistically expected at personal-investor daily-batch scale; `data/watchlist.json` stays small and bounded (entries are pruned on downgrade/purchase, not accumulated indefinitely).

## Anti-Patterns

### Anti-Pattern 1: Trusting the LLM's self-reported ETF exclusion without a TS check

**What people might do:** Add "do not recommend ETFs" to the analyst/moderator prompt and consider the requirement satisfied.
**Why it's wrong:** This codebase has repeatedly found that prompt-only constraints leak. Precedent: `decisionChanged`/`urgent` alias-transform hardening, and the ticker-extraction cleanup shipped 2026-07-14 ("fix(pipeline): ティッカー誤抽出の除外拡充と websearch/reeval の日次クリーンアップ") — all exist as TS-side hardening layered on top of prompt instructions that alone proved insufficient.
**Instead:** Prompt instruction (cheap, reduces frequency of violations) + `excludeEtfPicks()` mandatory TS filter applied at both call sites described in Pattern 1.

### Anti-Pattern 2: Storing the watchlist as a date-keyed append-only log like `urgency-history.json`

**What people might do:** Copy `urgency-history.ts`'s date-keyed shape (`Record<dateKey, snapshot[]>`) wholesale for the watchlist because it's the closest existing precedent in `src/portfolio/`.
**Why it's wrong:** The watchlist is fundamentally a **current-state table with membership lifecycle** (added → active → removed), not a daily observation log. A date-keyed log forces every reader (judgment agent, report renderer, pruning logic) to reconstruct "what's currently active" by scanning and deduplicating across all historical date keys — expensive, error-prone, and it breaks the "remove when downgraded/purchased" requirement, which needs an explicit per-ticker state transition rather than an implicit absence-from-today's-key.
**Instead:** Key `data/watchlist.json` by normalized ticker (`Record<ticker, WatchlistEntry>`), each entry carrying its own `addedDate` / `lastVerdictDate` / `removedReason` / `removedDate`. If historical judgment analytics are wanted later, add a *separate* date-keyed log file for that purpose (see Scaling Considerations) rather than overloading this one.

### Anti-Pattern 3: Making the new pipeline steps hard-fail the whole run

**What people might do:** Wire the watchlist/judgment steps with the same strict `[PIPELINE:FAIL]` semantics as Step 2 (the analyst meeting), on the reasoning that "buy-timing feels important."
**Why it's wrong:** PROJECT.md explicitly requires new v2.7 steps to be fail-soft ("新パイプラインステップは fail-soft 設計（失敗しても既存4レポートの生成・デプロイを継続）"), consistent with every Phase 19+ addition (portfolio-research, news-digest, urgency-history are all fail-soft by design, with explicit "**`[PIPELINE:FAIL]` は絶対に出力しないこと**" instructions in invest.md for each).
**Instead:** Follow the `write-urgency-history.ts` / Step 3f contract exactly: the script never lets an internal error propagate past its own `main()`; it emits `[STEP:watchlist:OK]` or `[STEP:watchlist:FAIL:<reason>]` (never `[PIPELINE:FAIL]`); downstream report rendering degrades gracefully (empty/omitted watchlist section) via a fail-soft loader in `report-data-loaders.ts`, exactly like `loadUrgencyHistory()` already does today.

### Anti-Pattern 4: Reusing `PORTFOLIO_HOLDINGS`-style static iteration for a dynamic watchlist

**What people might do:** Copy Step 3-P's pattern of "hardcode symbols in a TS constant, iterate that constant" for the new watchlist steps, since it's the most recent precedent for "N parallel agents per ticker."
**Why it's wrong:** `PORTFOLIO_HOLDINGS` is intentionally static (12 fixed holdings with human-curated `matchAliases`). The watchlist is dynamic and changes daily. A step that iterates a compile-time constant cannot work for a runtime-varying ticker list.
**Instead:** Step 3-W2 (data supply) and Step 3-J (judgment) must read the **current active watchlist from `data/watchlist.json`** (post Step 3-W admission/pruning) at runtime, never from a hardcoded TS constant. Accept that watchlist tickers won't have curated `matchAliases` at launch (see Pattern 4) rather than trying to force static curation onto a dynamic list.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Yahoo Finance (`yahoo-finance2` v3) | `fetchTechnicalSnapshots()` via `collect-technicals.ts`, reused verbatim for watchlist tickers | No new integration code needed — `parseTickerList()` already accepts a `{tickers: string[]}` input shape. Just point the CLI's input argument at a watchlist-derived ticker file instead of `tmp/moderator-tickers.json`. |
| Finnhub / Google News RSS (via `tmp/news.json` pool) | Reuse `holding-news.ts`'s matching functions unchanged (Pattern 4), fed a `PortfolioHolding`-shaped array derived from watchlist entries instead of `PORTFOLIO_HOLDINGS` | Zero function-signature changes required — only the caller in the new `write-watchlist-news.ts`-style script differs. |
| Claude Code Agent tool (buy-timing judgment) | New agent step in `invest.md`, `model: sonnet` (scoring-tier work, not deep multi-round synthesis — matches Round 3's model-choice rationale) | Prompt assembled from `tmp/watchlist-technicals.json` + `tmp/watchlist-news.json`, output written to `tmp/watchlist-judgment.json`, zod-validated via a new schema in `meeting/schemas.ts` following the `rawHoldingSchema`/`holdingEvaluationSchema` two-stage (raw passthrough → transform) pattern. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| ETF exclusion module ↔ meeting-result finalization | Direct TS function call (`excludeEtfPicks`) applied to `highlightedStocks`, post Step 2f / pre Step 2g validation, ideally as an explicit visible sub-step (its own console log line) | Prefer an explicit sub-step for auditability, consistent with how `extract-tickers.ts` already visibly filters out portfolio tickers today. |
| Watchlist module ↔ invest.md orchestrator | `tmp/*.json` / `data/*.json` handoff boundary (TS scripts only, no agent involved in admission/pruning) | New Step 3-W is pure TS, invoked via `npx tsx src/scripts/write-watchlist.ts`, exactly like Step 3f's `write-urgency-history.ts` invocation pattern. |
| Watchlist data supply ↔ judgment agent | `tmp/*.json` handoff boundary | Same contract as `portfolio-analyst`'s consumption of `tmp/holding-news.json` + `tmp/technicals.json`. |
| Judgment agent output ↔ Daily Report renderer | `tmp/watchlist-judgment.json` + `data/watchlist.json` read via new `loadWatchlist()` / `loadWatchlistJudgment()` fail-soft loaders in `report-data-loaders.ts`, consumed by `generate-daily-report.ts` | Mirrors the existing `loadUrgencyHistory()` → `computeWeeklyUrgencyRollup()` → `generate-portfolio-report.ts` wiring pattern exactly. |

## Suggested Build Order

Given the dependency chain traced above, the natural build/phase order is:

1. **ETF exclusion module** (`src/portfolio/etf-exclusion.ts` + tests) — no dependencies on anything else; unit-testable standalone, then wired into Step 2f/2g of `invest.md`. Unblocks everything downstream because watchlist admission depends on ETF-free `highlightedStocks`.
2. **Watchlist persistence module** (`src/portfolio/watchlist.ts` + `src/scripts/write-watchlist.ts` + tests, including the "entered portfolio.json" prune path) — depends on (1) for the admission filter; depends on `urgency-history.ts`/`write-urgency-history.ts`'s proven pure-module/fail-soft-wrapper pattern (reference-only, no code dependency). Wire in as new Step 3-W in `invest.md`, positioned after Step 2g and before/parallel with Step 3-P.
3. **Watchlist data supply** (generalize `holding-news.ts` matching for arbitrary ticker lists per Pattern 4; reuse `collect-technicals.ts` as-is) — depends on (2) existing so there's an active ticker list to fetch data for. New Step 3-W2 in `invest.md`.
4. **Buy-timing judgment agent + schema** (`meeting/types.ts` + `meeting/schemas.ts` additions, new agent prompt block in `invest.md` as Step 3-J) — depends on (3)'s data files existing. This is the first LLM-involving new component and should be built last among the new pieces so its prompt can reference already-stable upstream data shapes.
5. **Daily Report watchlist section renderer** (`generate-daily-report.ts` + `report-data-loaders.ts` additions) — depends on (4)'s output schema being finalized. Build last since it's purely a consumer of everything above.

Note: the "entered portfolio.json" auto-removal check is folded into step 2 (`pruneWatchlist()`), not treated as a separate later item — it's pure logic that only needs `src/portfolio/holdings.ts` / `tmp/portfolio.json` as inputs, both of which already exist, so there's no reason to defer it.

This order lets each piece be unit-tested in isolation before wiring into `invest.md`, and matches how this codebase has always shipped comparable features: deterministic TS infrastructure and persistence first, the LLM-facing agent step next, report rendering last (Phase 19 holding-news → Phase 21 portfolio-research → Phase 22 judgment/urgent fields → Phase 25/26 persistence/rollup all followed this same infrastructure-before-agent-before-rendering sequencing).

## Sources

- Direct inspection of `/Users/arai/invest/.planning/PROJECT.md` (v2.7 milestone scope, established Key Decisions table)
- Direct inspection of `/Users/arai/invest/.claude/commands/invest.md` (full pipeline step order, Steps 1–4, all fail-soft contracts and STEP marker conventions)
- Direct inspection of `/Users/arai/invest/src/portfolio/holding-news.ts`, `urgency-history.ts`, `holdings.ts`, `decision-diff.ts`
- Direct inspection of `/Users/arai/invest/src/scripts/write-urgency-history.ts`, `collect-technicals.ts`, `generate-report.ts`, `report-data-loaders.ts`, `generate-portfolio-report.ts`
- Direct inspection of `/Users/arai/invest/src/meeting/types.ts`, `schemas.ts` (zod `passthrough().transform()` alias-hardening pattern, `lenientBoolean` utility)
- Git log (recent commit "fix(pipeline): ティッカー誤抽出の除外拡充と websearch/reeval の日次クリーンアップ" confirming ongoing TS-side hardening philosophy)

---
*Architecture research for: Entry-Timing Watchlist & ETF Exclusion (v2.7 milestone)*
*Researched: 2026-07-15*

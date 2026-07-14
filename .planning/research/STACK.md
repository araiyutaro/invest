# Stack Research

**Domain:** Entry-timing watchlist & ETF exclusion (v2.7 milestone, additive to existing multi-agent investment analysis pipeline)
**Researched:** 2026-07-15
**Confidence:** HIGH (all findings verified against installed package source and live runtime calls against the project's own `node_modules/yahoo-finance2@3.13.2`)

## Recommended Stack

### Core Technologies — no new packages required

This milestone adds **zero new npm dependencies**. Every capability needed (ETF detection, watchlist persistence, technical/news data supply, LLM+zod verdict validation) is achievable with the stack already installed and already used identically elsewhere in the codebase (`urgency-history.ts`, `holding-news.ts`, `technicals.ts`, `meeting/schemas.ts`).

| Technology | Version (installed) | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `yahoo-finance2` | `3.13.2` (already in `package.json`) | ETF/equity detection via `quote().quoteType`; OHLCV history via `chart()` for technicals | Verified live: `quote()` returns a discriminated-union `Quote` typed by `quoteType` (`"EQUITY" \| "ETF" \| "MUTUALFUND" \| "INDEX" \| ...`). Confirmed on both US (`SPY`→`ETF`, `AAPL`→`EQUITY`) and Japan tickers (`1306.T`→`ETF`, `7203.T`→`EQUITY`, `9984.T`→`EQUITY`). No separate ecosystem-specific logic needed. |
| `zod` | `4.3.6` (already in `package.json`) | Buy-timing verdict schema validation with alias-hardening | Same `.union([...]).transform()` / `.passthrough()` pattern already proven in `src/meeting/schemas.ts` for `urgent`/`decisionChanged`. Reuse directly for the new `todayAction` (buy/wait) verdict field. |
| Node `fs/promises` (`readFile`/`writeFile`/`mkdir`) | Node 24.x runtime (built-in) | Watchlist JSON persistence in `data/` | Identical to `src/scripts/write-urgency-history.ts` — no persistence library needed for a single flat JSON file with date-keyed append semantics. |
| `tsx` | `4.21.0` (already in `package.json`) | Run new scripts/agents in the existing pipeline | Already the execution runtime for all `src/scripts/*.ts` CLI entrypoints. |

### Supporting Libraries — none needed

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| — | — | — | No supporting library gaps identified. `yahoo-finance2` + `zod` + built-in `fs` cover ETF detection, technical indicator computation (reuse `computeSMA`/`computeRSI`/`buildSnapshot` from `src/data/technicals.ts`), and schema validation. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `vitest` (`4.0.18`, already installed) | Unit tests for new pure functions (`isEtf`, `appendWatchlistSnapshot`, `pruneWatchlist`, verdict schema parsing) | Follow existing pattern: `src/portfolio/urgency-history.test.ts` style — pure functions tested with plain fixtures, no mocking framework needed. |

## Installation

```bash
# No installation needed — all required packages are already present.
# Confirm with:
npm ls yahoo-finance2 zod tsx
```

## ETF Detection — Verified API Surface

**Field to use: `quote(symbol).quoteType`** (also cross-checkable with `.typeDisp`, the human-readable label).

Confirmed via live call against `yahoo-finance2@3.13.2` (`esm/src/index.js`) on 2026-07-15:

| Symbol | `quoteType` | `typeDisp` | `shortName` |
|--------|-------------|------------|-------------|
| `SPY` | `ETF` | `ETF` | State Street SPDR S&P 500 ETF T |
| `QQQ` | `ETF` | `ETF` | Invesco QQQ Trust, Series 1 |
| `VOO` | `ETF` | `ETF` | Vanguard S&P 500 ETF |
| `AAPL` | `EQUITY` | `Equity` | Apple Inc. |
| `NVDA` | `EQUITY` | `Equity` | NVIDIA Corporation |
| `7203.T` | `EQUITY` | `Equity` | TOYOTA MOTOR CORP |
| `9984.T` | `EQUITY` | `Equity` | SOFTBANK GROUP CORP |
| `1306.T` | `ETF` | `ETF` | NOMURA ASSET MANAGEMENT CO LTD (TOPIX ETF) |

**Key findings:**
- `quoteType` is a **discriminated literal** on the `Quote` union type (`QuoteEtf`, `QuoteEquity`, `QuoteIndex`, `QuoteMutualfund`, `QuoteCurrency`, `QuoteCryptoCurrency`, `QuoteFuture`, `QuoteOption`, `QuoteECNQuote`, `QuoteMoneyMarket`, `QuoteAltSymbol` — 11 variants total, source: `esm/src/modules/quote.d.ts:450-462`).
- The signal is **identical across US and Japan tickers** — no per-market special-casing needed. This directly satisfies the PROJECT.md requirement for deterministic TS-side ETF exclusion as the second layer of defense (prompt instruction + TS verification).
- `quote()` accepts **batch symbol arrays** (`yf.quote(["SPY","AAPL","1306.T"])` → array of `Quote`, each retaining its own `quoteType`) — verified live. This means ETF-check can be done in one batched call per pipeline run rather than N sequential calls, consistent with the existing `fetchStockQuotes`/`fetchPortfolioData` batching style (`Promise.all` over `quote()` calls) in `src/data/market.ts` and `src/portfolio/data.ts`.
- Recommended guard function signature, mirroring existing `src/data/*.ts` fail-soft conventions:

```typescript
// src/portfolio/etf-filter.ts (new, pure function — no I/O)
export function isEtfQuoteType(quoteType: string | undefined): boolean {
  return quoteType === "ETF" || quoteType === "MUTUALFUND" || quoteType === "INDEX";
}
```
  Excluding `MUTUALFUND` and `INDEX` alongside `ETF` is recommended because the domain requirement is "individual stock picks only" — index/mutual-fund quoteTypes are equally inappropriate as "buy-timing" picks and are trivially returned by the same field, at zero extra cost.
- **Two-layer defense implementation shape** (matches PROJECT.md's stated architecture): analyst prompts instruct "ETFを推奨から除外" (layer 1, prompt-level), then a TS filter step calls batched `quote()` on all `picks`/`highlightedStocks` symbols and drops any where `isEtfQuoteType(quoteType)` is true before the symbols reach the watchlist writer or the Daily Report renderer (layer 2, deterministic). This is the same "don't trust LLM self-report" philosophy already applied to `decisionChanged` (`src/portfolio/urgency-history.ts` comment: "LLM自己申告を信用しない").
- **Failure mode to handle:** if `quote()` throws or returns no `quoteType` for a symbol (delisted/typo/rate-limited), treat as **exclude** (fail-closed) rather than fail-open, since the cost of wrongly excluding one candidate is far lower than recommending an ETF or a bad ticker. This mirrors the existing `fetchQuoteSafe`/`fetchStockSafe` pattern of returning `null` on error and filtering nulls out downstream.

## Watchlist Persistence — Pattern to Reuse

**Do not design a new persistence pattern.** `src/portfolio/urgency-history.ts` + `src/scripts/write-urgency-history.ts` is a directly reusable template:

- **Shape:** `Record<dateKey, ReadonlyArray<Snapshot>>` keyed by `YYYY-MM-DD`, same-day writes overwrite via key assignment (not array push) — structurally prevents duplicate same-day entries.
- **Location:** `data/watchlist.json` (or similar), alongside `data/urgency-history.json` — non-public, not under `docs/`.
- **Write flow:** pure extraction function (no I/O) → `appendXSnapshot(existing, dateKey, newSnapshots)` (pure, immutable spread) → thin CLI wrapper in `src/scripts/` that does `mkdir -p data/`, reads existing file (treats `ENOENT` as empty, treats corrupt JSON as **fail-closed skip-with-error**, never silently overwrites), writes updated file.
- **Date key validation:** reuse `isValidDateKey` regex (`/^\d{4}-\d{2}-\d{2}$/`) to guard against prototype-pollution-style keys (e.g. `__proto__`) before writing.
- **Auto-removal rules (verdict downgrade / already purchased):** implement as a pure `pruneWatchlist(watchlist, latestVerdicts, portfolioHoldings)` function, called before the append step, mirroring the immutable-spread style of `appendUrgencySnapshot`. Two removal conditions per PROJECT.md:
  1. Latest re-evaluation verdict for a watchlisted symbol is 中立/弱気 → drop entry.
  2. Symbol now appears in `PORTFOLIO_HOLDINGS` (`src/portfolio/holdings.ts`) → drop entry (already purchased).
- **Git tracking:** Step 4's existing `git add docs/ data/` already covers any new file placed under `data/` — no pipeline change needed there, confirmed by reading `write-urgency-history.ts` comment referencing this exact mechanism.

## Daily Tracking Data Supply (Technicals + News) — Reuse, Don't Rebuild

- **Technicals:** `src/data/technicals.ts`'s `fetchTechnicalSnapshot(symbol)` / `fetchTechnicalSnapshots(symbols)` already returns everything needed for buy-timing judgment: `price`, `changePercent`, `ma20`/`ma50`/`ma200`, `pctFromMa50`/`pctFromMa200`, `rsi14`, `fiftyTwoWeekHigh`/`Low`, `pctFrom52wHigh`, `volumeRatio`, `trendLabel`. Call this directly for watchlist symbols — no new technical-indicator code required.
- **Support/resistance extension (optional, if the buy-timing agent needs explicit levels beyond MA/RSI):** `yahooFinance.chart()` already returns per-bar `high`/`low`/`open`/`close`/`volume` (confirmed in `esm/src/modules/chart.d.ts:158-166`), but `technicals.ts` currently only extracts `close`/`volume`. If the buy-timing agent's prompt needs recent swing-high/swing-low support levels, extend `DailyBar`/`buildSnapshot` to also carry `high`/`low` and derive a simple rolling min/max (e.g., 20-day low as near-term support, 20-day high as resistance) — this is arithmetic on already-fetched data, not a new dependency.
- **News:** `src/portfolio/holding-news.ts`'s `buildHoldingNewsMap` (ticker-match + name-alias fallback against `tmp/news.json`) is the exact same deterministic-extraction shape needed for watchlist-ticker news. Watchlist symbols are a superset-compatible input — either extend `PORTFOLIO_HOLDINGS`-shaped lookup to also accept ad-hoc watchlist symbols, or add a parallel `buildWatchlistNewsMap` using the same `matchAliases`/`normalizeHoldingSymbol` helpers exported from that module.

## Buy-Timing Verdict Schema — Pattern to Reuse

Model the new schema directly on `holdingEvaluationSchema` in `src/meeting/schemas.ts`:

```typescript
// Sketch — follow the exact rawXSchema -> .passthrough() -> transform() shape
// already used for urgent/decisionChanged in meeting/schemas.ts
const rawWatchlistVerdictSchema = z.object({
  symbol: z.string(),
  todayAction: z.enum(["buy", "wait"]).optional(),      // canonical
  action: z.enum(["buy", "wait"]).optional(),             // alias
  recommendation: z.enum(["buy", "wait"]).optional(),     // alias
  reasoning: z.string().optional(),                       // canonical
  rationale: z.string().optional(),                       // alias
}).passthrough();
```
Then `.transform()` into a canonical shape exactly as `holdingEvaluationSchema` does, so prompt-level field-name drift (LLMs inventing `action`/`recommendation` instead of `todayAction`) doesn't hard-fail the pipeline. This is a **zero-new-dependency** application of the existing `zod@4.3.6` alias-hardening idiom already proven for `urgent`/`webSearchResult`/`portfolioAnalysis` in the same file.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `quote().quoteType` for ETF detection | Symbol-pattern heuristics (e.g., regex against known ETF ticker lists) | Never for this project — heuristic lists go stale and don't cover Japan ETF codes (e.g. `1306.T`), which have no lexical marker distinguishing them from equity codes. `quoteType` is authoritative and free (same API call already made for price data). |
| `quote().quoteType` | `quoteSummary()` with `assetProfile`/`fundProfile` modules | Only if you need deeper fund metadata (expense ratio, holdings breakdown) for a *future* feature — unnecessary extra API surface for a simple ETF/equity boolean gate. `quote()` is lighter-weight and already the call pattern used everywhere else in this codebase (`market.ts`, `portfolio/data.ts`). |
| Flat `data/watchlist.json` (date-keyed, `urgency-history.ts` pattern) | SQLite / a real DB | Only if watchlist size or query complexity grows beyond what a single JSON file can hold performantly — at ~12-30 watchlist symbols with daily append, this is far below that threshold, and a DB would break the project's stated `data/` JSON-file convention and add a new dependency for no benefit. |
| Reuse `zod` alias-hardening `.passthrough().transform()` | A stricter `z.object().strict()` schema for buy-timing verdict | Never — the project's own Key Decisions log states this pattern exists specifically because strict schemas caused hard failures on LLM field-name drift (see `PROJECT.md`: "LLM出力スキーマは passthrough().transform() で alias 硬化"). Reintroducing strict validation here would reintroduce the exact problem already solved. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|--------------|
| A new "financial data" or "technical analysis" npm library (e.g. `technicalindicators`, `trading-signals`) | The project already has hand-rolled, tested `computeSMA`/`computeRSI`/`buildSnapshot` in `src/data/technicals.ts` that produces exactly the fields needed; adding a second indicator library creates two sources of truth for the same numbers and risks numeric drift between existing reports and the new watchlist feature. | Reuse `src/data/technicals.ts` functions directly; extend with `high`/`low` fields only if support/resistance levels are required. |
| A database (SQLite/Postgres/etc.) for watchlist state | Contradicts the project's established flat-JSON-in-`data/` persistence convention (`urgency-history.json`) and the `[STEP:*]` fail-soft pipeline design, which assumes plain-file read/write with `git add data/` for durability across runs, not a DB connection. | Flat JSON file, date-keyed, following `urgency-history.ts`/`write-urgency-history.ts` exactly. |
| Symbol-name/ticker-suffix heuristics for ETF detection (e.g. "anything ending in common ETF-sounding words") | Unreliable and unverifiable; the project's stated philosophy explicitly rejects LLM/heuristic self-report in favor of deterministic TS checks — a heuristic string match is not meaningfully more deterministic than trusting the LLM. | `quote().quoteType === "ETF"` (or `MUTUALFUND`/`INDEX`), verified live against both US and Japan tickers. |
| `quoteSummary()` with a large multi-module fetch (fundamentals + fund data + technicals) for the sole purpose of getting `quoteType` | Heavier API surface (more sub-requests, larger payload, more failure surface area) than needed for a single classification field, and inconsistent with the lightweight `quote()`-only pattern used throughout `market.ts`/`portfolio/data.ts`. | Plain `quote()` call — `quoteType` is already present on the base `Quote` response the pipeline already fetches for price data. |

## Stack Patterns by Variant

**If the buy-timing agent needs explicit support/resistance price levels (not just MA/RSI trend):**
- Extend `DailyBar` in `src/data/technicals.ts` to include `high`/`low` (already returned by `chart()`, just not currently mapped).
- Derive rolling N-day low/high (e.g. 20-day) as a simple `Math.min`/`Math.max` over the window — no new dependency, same style as existing `fiftyTwoWeekHigh`/`Low` computation in `buildSnapshot`.

**If watchlist symbols is a strict superset of portfolio holdings' data shape:**
- Do not force-fit watchlist entries into `PortfolioHolding` (which has `nameJa`/`sector`/`matchAliases` curated by hand for 12 fixed holdings). Watchlist symbols are dynamic and come from daily analyst picks, so their metadata (name, sector) should be fetched from `quote()` at read-time (`shortName`, or `longName` if available) rather than requiring manual curation like `PORTFOLIO_HOLDINGS`.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `yahoo-finance2@3.13.2` | Node 24.x (project's runtime, confirmed via live test) | No changes needed; same instantiation pattern (`new YahooFinance({ suppressNotices: ["yahooSurvey"] })`) works identically for `quote()` ETF detection as for existing price/technicals fetches. |
| `zod@4.3.6` | TypeScript 5.9.3 | `.passthrough()`/`.transform()`/`z.union([...])` APIs used in `meeting/schemas.ts` are zod v4 stable APIs — safe to extend with new schemas in the same file or a sibling file without version concerns. |
| `tsx@4.21.0` | ESM (`"type": "module"` in `package.json`) | New scripts under `src/scripts/` must use ESM import syntax (`import ... from "../module.js"` with `.js` extension on TS source, per existing convention) — confirmed by inspecting `write-urgency-history.ts` imports. |

## Sources

- `node_modules/yahoo-finance2/esm/src/modules/quote.d.ts` (installed v3.13.2) — confirmed `Quote` discriminated union and `quoteType` literal values (`EQUITY`, `ETF`, `MUTUALFUND`, `INDEX`, etc.), lines 450-462.
- `node_modules/yahoo-finance2/esm/src/modules/quote.schema.js` — confirmed JSON-schema `const` values per quote type (`"ETF"`, `"EQUITY"`, `"MUTUALFUND"`, `"INDEX"`, ...).
- `node_modules/yahoo-finance2/esm/src/modules/chart.d.ts` — confirmed `ChartResultArrayQuote` per-bar fields (`high`, `low`, `open`, `close`, `volume`), lines 158-166.
- Live runtime verification (2026-07-15, executed against the project's own installed package): `yf.quote(["SPY","QQQ","AAPL","NVDA","7203.T","1306.T","9984.T","VOO"])` and batch-array call — confirmed `quoteType` values and batch-call support empirically, not just from types. Confidence: HIGH (first-party, verified against project's exact installed version, cross-checked type declarations against live behavior).
- `src/portfolio/urgency-history.ts`, `src/scripts/write-urgency-history.ts` — existing in-repo pattern for `data/` JSON persistence, date-keyed append, fail-closed corruption handling. Confidence: HIGH (project's own validated, shipped code).
- `src/meeting/schemas.ts` — existing in-repo zod alias-hardening pattern (`.passthrough().transform()`, lenient boolean union). Confidence: HIGH (project's own validated, shipped code).
- `src/data/technicals.ts` — existing in-repo technical indicator computation (`computeSMA`, `computeRSI`, `buildSnapshot`). Confidence: HIGH (project's own validated, shipped code, has existing test coverage per `market.test.ts` sibling pattern).
- `.planning/PROJECT.md` — milestone requirements, two-layer ETF defense design, `data/` vs `docs/` placement rule, TS-side-deterministic philosophy precedent.

---
*Stack research for: Entry Timing Watchlist & ETF Exclusion (v2.7)*
*Researched: 2026-07-15*

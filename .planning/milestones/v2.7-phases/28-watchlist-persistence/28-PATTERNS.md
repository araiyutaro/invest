# Phase 28: Watchlist Persistence - Pattern Map

**Mapped:** 2026-07-15
**Files analyzed:** 5 (2 new source + 2 new test + 1 modified)
**Analogs found:** 5 / 5

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `src/portfolio/watchlist.ts` | service (pure module) | CRUD (state-table admit/prune) | `src/portfolio/urgency-history.ts` | exact (same pure-module template; schema differs: ticker-keyed not date-keyed) |
| `src/scripts/write-watchlist.ts` | CLI / fail-soft wrapper | file-I/O + request-response (batch API call) | `src/scripts/write-urgency-history.ts` (I/O skeleton) + `src/scripts/filter-etf-stocks.ts` (batch quote()) | exact (composite of two analogs) |
| `src/portfolio/watchlist.test.ts` | test | CRUD (unit) | `src/portfolio/urgency-history.test.ts` | exact |
| `src/scripts/write-watchlist.test.ts` | test | file-I/O (CLI wrapper unit) | none dedicated; mirror `write-urgency-history.ts`'s untested-inline shape using `filter-etf-stocks.ts`'s fail-soft branching as behavior reference | role-match |
| `.claude/commands/invest.md` (MODIFY) | config / pipeline orchestration | event-driven (pipeline step insertion) | Existing Step 2g / Step 3f block in same file | exact |

## Pattern Assignments

### `src/portfolio/watchlist.ts` (service, CRUD state-table)

**Analog:** `src/portfolio/urgency-history.ts` (structure/purity template) + `src/portfolio/etf-exclusion.ts` (second-gate reuse)

**Imports pattern** (urgency-history.ts lines 1-2):
```typescript
import { normalizeHoldingSymbol } from "./holding-news.js";
import type { PortfolioAnalysis } from "../meeting/types.js";
```
For watchlist.ts, adapt to:
```typescript
import { normalizeHoldingSymbol } from "./holding-news.js";
import { filterEtfStocks } from "./etf-exclusion.js";
import type { QuoteTypeLookup } from "./etf-exclusion.js";
import type { MeetingResult } from "../meeting/types.js";
import type { PortfolioHolding } from "./holdings.js";
```

**Date validation pattern to reuse verbatim** (urgency-history.ts lines 50-56):
```typescript
export function isValidDateKey(dateKey: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateKey);
}
```
Import/re-export this exact function (do not duplicate) — CONTEXT.md D-03 explicitly requires reusing this regex.

**Idempotent merge pattern** (urgency-history.ts lines 42-48, the core template for admit's spread-merge):
```typescript
export function appendUrgencySnapshot(
  history: UrgencyHistoryFile,
  dateKey: string,
  snapshots: ReadonlyArray<HoldingUrgencySnapshot>,
): UrgencyHistoryFile {
  return { ...history, [dateKey]: snapshots };
}
```
Adapt shape for ticker-keyed merge in `admitBullishStocks` — same `{ ...existing, [tickerKey]: newEntry }` idiom, but keyed on ticker (via `normalizeHoldingSymbol`) not date, and merge must preserve prior entry's `history` array (D-05/D-06 — do NOT overwrite wholesale).

**ETF second-gate reuse** (etf-exclusion.ts lines 37-64, call as-is, do not modify):
```typescript
export function filterEtfStocks(
  stocks: MeetingResult["highlightedStocks"],
  quoteTypeByTicker: ReadonlyMap<string, QuoteTypeLookup>,
): EtfExclusionResult {
  // returns { kept, excluded }; fail-closed on missing/failed lookup (D-01 pattern)
}
```
Call this inside `admitBullishStocks` for new-candidate tickers only (D-21/D-22), passing quote results supplied by the CLI wrapper (D-23 — the pure module never calls `quote()` itself).

**Ticker normalization** (holding-news.ts lines 32-34, reuse verbatim as key function):
```typescript
export function normalizeHoldingSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}
```
Caution: `.T`-suffix Japanese tickers must NOT be altered beyond trim/uppercase — confirm this matches `extract-tickers.ts` convention before applying broadly (per D-12 "ticker は完全一致").

**Purchased-trigger source** (holdings.ts lines 1-27):
```typescript
export interface PortfolioHolding {
  readonly symbol: string;
  readonly name: string;
  readonly nameJa: string;
  readonly sector: string;
  readonly matchAliases?: ReadonlyArray<string>;
}
export const PORTFOLIO_HOLDINGS: ReadonlyArray<PortfolioHolding> = [ ... ] as const;
```
`pruneWatchlist`'s "purchased" branch checks membership of normalized ticker against `PORTFOLIO_HOLDINGS.map(h => h.symbol)` — read directly, never via `tmp/portfolio.json` (D-12).

**Anti-pattern warning (explicit in RESEARCH.md):** Do NOT copy `urgency-history.ts`'s `Record<dateKey, snapshot[]>` shape. `watchlist.ts` is ticker-keyed (`Record<ticker, WatchlistEntry>`), not date-keyed. The date-key regex (`isValidDateKey`) is reused only for validating `addedDate`/`lastVerdictDate`/`removedDate` string values, not as the object's top-level key.

**Schema reference (illustrative, from RESEARCH.md Pattern 3 — exact naming is Claude's discretion per D-06):**
```typescript
export interface WatchlistRemovalEpisode {
  readonly addedDate: string;
  readonly lastVerdictDate: string;
  readonly removedReason: "downgraded" | "purchased" | "expired";
  readonly removedDate: string;
}
export interface WatchlistEntry {
  readonly ticker: string;
  readonly name?: string;
  readonly nameJa?: string;
  readonly addedDate?: string;
  readonly lastVerdictDate?: string;
  readonly history: ReadonlyArray<WatchlistRemovalEpisode>;
}
export type WatchlistFile = Record<string, WatchlistEntry>;
```

---

### `src/scripts/write-watchlist.ts` (CLI, file-I/O + fail-soft)

**Analog 1 (I/O skeleton, ENOENT double-check):** `src/scripts/write-urgency-history.ts`

**Full ENOENT/corruption two-branch loader (copy verbatim, D-18):** (write-urgency-history.ts lines 12-26)
```typescript
async function loadExistingHistory(): Promise<{ history: UrgencyHistoryFile; corrupted: boolean }> {
  try {
    const raw = await readFile(HISTORY_PATH, "utf-8");
    return { history: JSON.parse(raw) as UrgencyHistoryFile, corrupted: false };
  } catch (error) {
    const isMissing =
      (error as NodeJS.ErrnoException).code === "ENOENT" ||
      (error instanceof Error && error.message.includes("ENOENT"));
    return isMissing ? { history: {}, corrupted: false } : { history: {}, corrupted: true };
  }
}
```
Adapt names to `loadExistingWatchlist` / `WatchlistFile` / `WATCHLIST_PATH`. On `corrupted: true`, emit `[STEP:watchlist:FAIL:corrupted]` and return without writing (D-18) — mirror lines 38-45's pattern:
```typescript
if (corrupted) {
  console.error(
    "[watchlist] FAIL: 既存の data/watchlist.json が破損しています。保全のため今回の書き込みをスキップします。",
  );
  process.exit(1);
  return;
}
```

**mkdir-before-any-branch pattern** (write-urgency-history.ts lines 33-35 — apply identically so `git add docs/ data/` never fails on missing dir):
```typescript
await mkdir(DATA_DIR, { recursive: true });
```

**dateKey sourced from meeting-result.json, never re-derived** (write-urgency-history.ts lines 62-70, D-13):
```typescript
const meetingRaw = await readFile(join(TMP_DIR, "meeting-result.json"), "utf-8");
const { date: dateKey } = JSON.parse(meetingRaw) as { date: string };

if (!isValidDateKey(dateKey)) {
  console.error(`[watchlist] FAIL: 不正なdateキー形式: ${dateKey}`);
  process.exit(1);
  return;
}
```

**Path constants pattern** (write-urgency-history.ts lines 8-10):
```typescript
const TMP_DIR = join(import.meta.dirname, "../../tmp");
const DATA_DIR = join(import.meta.dirname, "../../data");
const HISTORY_PATH = join(DATA_DIR, "urgency-history.json");
```
Adapt to `WATCHLIST_PATH = join(DATA_DIR, "watchlist.json")`.

**Entry-point guard pattern** (write-urgency-history.ts lines 78-83, copy verbatim):
```typescript
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
```

---

**Analog 2 (batch quote() call, name+quoteType in one call):** `src/scripts/filter-etf-stocks.ts`

**Instantiation convention** (filter-etf-stocks.ts line 12):
```typescript
const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });
```

**Batch quote() call, extend to also capture longName/shortName** (filter-etf-stocks.ts lines 21-40, D-04/D-22 "1コール2役"):
```typescript
async function fetchQuoteTypes(
  tickers: ReadonlyArray<string>,
): Promise<ReadonlyMap<string, QuoteTypeLookup>> {
  const result = new Map<string, QuoteTypeLookup>();
  if (tickers.length === 0) return result;

  const quotes = await yahooFinance.quote([...tickers]);
  const quoteArray = Array.isArray(quotes) ? quotes : [quotes];
  for (const q of quoteArray) {
    const symbol = (q as { symbol?: string }).symbol;
    const quoteType = (q as { quoteType?: string }).quoteType;
    if (symbol && quoteType) {
      result.set(symbol, { status: "ok", quoteType });
    }
  }
  return result;
}
// Phase 28 extension: also read (q as { longName?: string; shortName?: string })
// in the same loop iteration and attach to the lookup/return value alongside quoteType —
// zero additional API calls.
```

**Fail-soft branching pattern for the batch call itself** (filter-etf-stocks.ts lines 80-104 — the "mechanism failure vs per-ticker failure" distinction to replicate):
```typescript
let quoteTypeByTicker: ReadonlyMap<string, QuoteTypeLookup>;
try {
  quoteTypeByTicker = await fetchQuoteTypes(tickers);
} catch (error) {
  console.error("[watchlist] FAIL: quoteType/社名一括取得に失敗しました。", error);
  process.exitCode = 1;
  return;
}
```
Apply the same "0 candidates = skip cleanly" short-circuit (lines 75-78) before calling `fetchQuoteTypes`.

**STEP marker output convention (D-16, adapt exit code to non-blocking per D-16's explicit deviation from filter-etf-stocks.ts's `process.exitCode = 1` — watchlist must use `[STEP:watchlist:FAIL:<reason>]` text and MUST NOT emit `[PIPELINE:FAIL]`):**
```typescript
console.error(`[STEP:watchlist:OK]`);
// or, on failure branches:
console.error(`[STEP:watchlist:FAIL:<reason>]`);
```
Size instrumentation (D-10, new requirement, no direct analog — compose from scratch):
```typescript
console.log(`[watchlist] active=${activeCount}件, removed=${removedCount}件`);
```

---

### `src/portfolio/watchlist.test.ts` (test, unit)

**Analog:** `src/portfolio/urgency-history.test.ts` (fixture-builder convention) + `src/portfolio/etf-exclusion.test.ts` (Map-based lookup fixture convention)

**Fixture builder pattern** (urgency-history.test.ts lines 10-18):
```typescript
const makeHoldingEvaluation = (
  overrides: Partial<HoldingEvaluation>,
): HoldingEvaluation => ({
  symbol: "TEST",
  nameJa: "テスト株式会社",
  decision: "保持",
  rationale: "デフォルト理由",
  urgent: false,
  ...overrides,
});
```
Adapt to a `makeHighlightedStock` (reuse etf-exclusion.test.ts's exact builder below) plus a `makeWatchlistEntry` builder for existing-state fixtures.

**highlightedStock fixture + Map-based QuoteTypeLookup fixture** (etf-exclusion.test.ts lines 5-21, reuse verbatim import + builder):
```typescript
import { describe, it, expect } from "vitest";
import { filterEtfStocks, type QuoteTypeLookup } from "./etf-exclusion.js";
import type { MeetingResult } from "../meeting/types.js";

const makeHighlightedStock = (
  overrides: Partial<MeetingResult["highlightedStocks"][number]>,
): MeetingResult["highlightedStocks"][number] => ({
  ticker: "TEST",
  averageScore: 50,
  verdict: "中立",
  summary: "デフォルト要約",
  agentScores: [],
  nominatedBy: [],
  ...overrides,
});

const makeQuoteLookup = (overrides: Partial<QuoteTypeLookup>): QuoteTypeLookup =>
  ({
    status: "ok",
    quoteType: "EQUITY",
    ...overrides,
  }) as QuoteTypeLookup;
```

Test naming convention (both files): `describe("functionName (D-xx)", () => { it("日本語での挙動記述（D-xx）", ...) })` — Japanese behavior descriptions referencing the driving decision ID. Apply this convention to all new `watchlist.test.ts` cases (admit new/existing/idempotent/ETF-rejected/lookup-failed; prune downgraded/purchased/expired/boundary/reconfirm; history preservation/re-admission).

---

### `src/scripts/write-watchlist.test.ts` (test, CLI wrapper)

No dedicated CLI-wrapper test file exists in the codebase yet for either `write-urgency-history.ts` or `filter-etf-stocks.ts` (both are exercised only via their exported pure functions' tests + manual/smoke runs). **No analog found** — planner should design this file fresh, reusing the vitest mocking conventions implied by `urgency-history.test.ts`'s fixture style, and cover: ENOENT-initializes-empty, corrupted-JSON-skips-write, dateKey-invalid-fails, STEP marker text on success/failure paths (per RESEARCH.md's Wave 0 Gaps table).

---

### `.claude/commands/invest.md` (MODIFY, pipeline orchestration)

**Analog:** Existing Step 2g / Step 3f block in the same file (self-referential — read the file directly during planning to locate exact insertion point and STEP marker conventions for `[STEP:filter-etf:...]` / `[STEP:validate-meeting:...]`). D-15 requires insertion immediately after Step 2g (filter-etf-stocks → validate-meeting) and before Step 3-P. D-20 notes no `git add` line change is needed since `data/` is already included.

## Shared Patterns

### Pure Module / Fail-Soft CLI Wrapper Split
**Source:** `src/portfolio/urgency-history.ts` + `src/scripts/write-urgency-history.ts`
**Apply to:** `watchlist.ts` (pure, throw-free, no I/O) / `write-watchlist.ts` (all readFile/writeFile/mkdir/process.exit)

### ENOENT vs Corruption Two-Branch Load
**Source:** `src/scripts/write-urgency-history.ts` lines 12-26
**Apply to:** `write-watchlist.ts`'s `loadExistingWatchlist` — copy verbatim, adapt type names only

### Batch quote() for Dual-Purpose Lookup (quoteType + name)
**Source:** `src/scripts/filter-etf-stocks.ts` lines 21-40
**Apply to:** `write-watchlist.ts`'s quote-fetching helper — extend to also read `longName`/`shortName`

### Fail-Closed ETF Gate
**Source:** `src/portfolio/etf-exclusion.ts` `filterEtfStocks` (lines 37-64)
**Apply to:** `watchlist.ts`'s `admitBullishStocks` — called as an unmodified second gate for new candidates only

### Ticker Normalization
**Source:** `src/portfolio/holding-news.ts` lines 32-34 (`normalizeHoldingSymbol`)
**Apply to:** All ticker-key operations in `watchlist.ts` (admission key, prune lookup, PORTFOLIO_HOLDINGS comparison)

### Date Key Validation
**Source:** `src/portfolio/urgency-history.ts` lines 54-56 (`isValidDateKey`)
**Apply to:** `watchlist.ts` — reuse/re-export for validating `addedDate`/`lastVerdictDate`/`removedDate` string fields (NOT as the top-level object key, unlike urgency-history.ts's own usage)

### STEP Marker / Fail-Soft Contract
**Source:** `src/scripts/write-urgency-history.ts` (console.error patterns) + D-16's explicit new marker text
**Apply to:** `write-watchlist.ts` — emit `[STEP:watchlist:OK]` / `[STEP:watchlist:FAIL:<reason>]`, never `[PIPELINE:FAIL]`

### Test Fixture Builder + Japanese-Decision-ID Naming Convention
**Source:** `src/portfolio/urgency-history.test.ts` + `src/portfolio/etf-exclusion.test.ts`
**Apply to:** `watchlist.test.ts` — `make*` override-based builders, `describe("fn (D-xx)")` naming

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/scripts/write-watchlist.test.ts` | test | file-I/O | No existing CLI-wrapper test file exists for either `write-urgency-history.ts` or `filter-etf-stocks.ts` to copy from; planner/implementer should design fresh using pure-module test conventions as the closest style reference and RESEARCH.md's Wave 0 Gaps table as the coverage checklist |
| Size instrumentation logging (D-10) | (cross-cutting, not a file) | — | Net-new requirement with no prior console.log-based size-metrics precedent in this codebase; compose from scratch per D-10's plain description |

## Metadata

**Analog search scope:** `src/portfolio/`, `src/scripts/`, `.claude/commands/`
**Files scanned:** `urgency-history.ts`, `write-urgency-history.ts`, `etf-exclusion.ts`, `filter-etf-stocks.ts`, `holdings.ts`, `holding-news.ts`, `urgency-history.test.ts`, `etf-exclusion.test.ts`
**Pattern extraction date:** 2026-07-15
</content>

# Phase 29: Daily Tracking Data Supply - Pattern Map

**Mapped:** 2026-07-15
**Files analyzed:** 4 new files
**Analogs found:** 4 / 4

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `src/portfolio/watchlist-data.ts` (new, name is Claude's discretion) | utility (pure module) | transform | `src/portfolio/urgency-history.ts` | exact (pure-module split, no I/O, throw-free) |
| `src/scripts/collect-watchlist-data.ts` (new) | service / CLI | batch + fail-soft request-response | `src/scripts/write-watchlist.ts` | exact (fail-soft CLI, STEP marker, ENOENT-vs-corrupted two-branch load) |
| `src/scripts/collect-watchlist-data.ts` (technical branch specifically) | service | batch (chunked network) | `src/scripts/collect-technicals.ts` | role-match (existing technicals CLI, but unbounded `Promise.all` — do NOT copy concurrency, only the fail-soft empty-write + logging shape) |
| `src/portfolio/watchlist-data.test.ts` + `src/scripts/collect-watchlist-data.test.ts` (new) | test | unit / CLI-mock | `src/scripts/write-watchlist.test.ts` | exact (vi.hoisted mock pattern for fs/promises + yahoo-finance2) |

No `technicals.ts` or `holding-news.ts` modification — both are reused verbatim (D-08, D-13). They are analogs for *calling convention*, not files to modify.

## Pattern Assignments

### `src/portfolio/watchlist-data.ts` (pure module, transform)

**Analog:** `src/portfolio/urgency-history.ts` (56 lines, exact structural analog — pure module with type + 2-3 pure functions, no I/O)

**Imports pattern** (urgency-history.ts lines 1-2):
```typescript
import { normalizeHoldingSymbol } from "./holding-news.js";
import type { PortfolioAnalysis } from "../meeting/types.js";
```
For the new module, mirror with:
```typescript
import { normalizeHoldingSymbol } from "./holding-news.js";
import type { WatchlistEntry } from "./watchlist.js";
import type { PortfolioHolding } from "./holdings.js";
import type { TechnicalSnapshot } from "../data/technicals.js";
```

**Core pure-function pattern** (urgency-history.ts lines 27-36, `extractUrgencySnapshots`):
```typescript
/**
 * D-02, D-10: PortfolioAnalysis.holdings から最小4フィールドを決定論的に抽出する。
 * symbol は normalizeHoldingSymbol で正規化してから保存する。
 * 純関数: throw なし、I/O なし。入力 analysis は変更しない。
 */
export function extractUrgencySnapshots(
  analysis: PortfolioAnalysis,
): ReadonlyArray<HoldingUrgencySnapshot> {
  return analysis.holdings.map((h) => ({
    symbol: normalizeHoldingSymbol(h.symbol),
    nameJa: h.nameJa,
    urgent: h.urgent,
    decision: h.decision,
  }));
}
```
Apply this exact shape for `toPortfolioHoldingShape` (D-14 — `WatchlistEntry[]` → `PortfolioHolding[]`), `mergeWithCache` (D-11/D-12), and `chunk`/`fetchChunked` (D-09; RESEARCH.md Pattern 2 already gives a full code example — no direct in-repo precedent exists for chunking, compose per that spec). Doc comments cite decision IDs exactly like `// D-02, D-10:` above — follow that convention (`// D-14:`, `// D-09:`, etc.) verbatim.

**Immutability pattern** (urgency-history.ts lines 42-48, `appendUrgencySnapshot`):
```typescript
/**
 * D-04: 同日ガードは日付キー上書き。immutable spread で history を一切 mutate しない。
 */
export function appendUrgencySnapshot(
  history: UrgencyHistoryFile,
  dateKey: string,
  snapshots: ReadonlyArray<HoldingUrgencySnapshot>,
): UrgencyHistoryFile {
  return { ...history, [dateKey]: snapshots };
}
```
Apply the same spread-only style to any merge/dedup logic in the cache-merge function.

---

### `src/scripts/collect-watchlist-data.ts` (fail-soft CLI, batch + request-response)

**Analog:** `src/scripts/write-watchlist.ts` (192 lines — closest full-CLI analog: fail-soft wrapper, single STEP marker, ENOENT-vs-corrupted watchlist load)

**Imports pattern** (write-watchlist.ts lines 1-16):
```typescript
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import YahooFinance from "yahoo-finance2";
import {
  admitBullishStocks,
  pruneWatchlist,
  getActiveWatchlistEntries,
} from "../portfolio/watchlist.js";
import type { WatchlistFile } from "../portfolio/watchlist.js";
import { isValidDateKey } from "../portfolio/urgency-history.js";
import { normalizeHoldingSymbol } from "../portfolio/holding-news.js";
```
For the new CLI, swap in `fetchTechnicalSnapshot` from `technicals.js`, `buildHoldingNewsMap` from `holding-news.js`, and the new pure module's exports. Do NOT import `fetchTechnicalSnapshots` (plural) — Pitfall 1 in RESEARCH.md explicitly forbids this coupling.

**ENOENT-vs-corrupted load pattern** (write-watchlist.ts lines 23-50, `loadExistingWatchlist` — this is the exact template for D-19's watchlist read):
```typescript
export async function loadExistingWatchlist(): Promise<{
  watchlist: WatchlistFile;
  corrupted: boolean;
}> {
  try {
    const raw = await readFile(WATCHLIST_PATH, "utf-8");
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return { watchlist: {}, corrupted: true };
    }
    return { watchlist: parsed as WatchlistFile, corrupted: false };
  } catch (error) {
    const isMissing =
      (error as NodeJS.ErrnoException).code === "ENOENT" ||
      (error instanceof Error && error.message.includes("ENOENT"));
    return isMissing ? { watchlist: {}, corrupted: false } : { watchlist: {}, corrupted: true };
  }
}
```
Copy this verbatim (rename only) for the new CLI's `data/watchlist.json` read — D-19 requires the identical ENOENT-is-normal / corrupted-is-FAIL distinction.

**STEP marker + fail-soft main() skeleton** (write-watchlist.ts lines 100-192):
```typescript
export async function main(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });

  const { watchlist: existingWatchlist, corrupted } = await loadExistingWatchlist();
  if (corrupted) {
    console.error("[watchlist] 既存の data/watchlist.json が破損しています。...");
    console.error("[STEP:watchlist:FAIL:corrupted]");
    return;
  }
  // ... business logic ...
  console.error("[STEP:watchlist:OK]");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
```
Adapt marker text to `[STEP:watchlist-data:OK]` / `[STEP:watchlist-data:FAIL:<reason>]` (D-03). Every early-return failure branch must still write valid empty JSON to both output files before returning (D-04/D-19) — write-watchlist.ts does NOT need this because it never overwrites on failure, but collect-technicals.ts DOES (see below) — combine both patterns.

**Fail-soft empty-output-on-fatal pattern** (collect-technicals.ts lines 81-98 — this is the piece write-watchlist.ts lacks and the new CLI needs):
```typescript
const isDirectRun = process.argv[1]?.endsWith("collect-technicals.ts");
if (isDirectRun) {
  const outputPath = process.argv[3] ?? "tmp/technicals.json";
  main(outputPath).catch(async (error) => {
    console.error("Fatal error:", error);
    // fail-soft: 後続ステップが常に有効なJSONを読めるよう空スナップショットを書き込む
    try {
      await writeFile(
        outputPath,
        JSON.stringify({ generatedAt: new Date().toISOString(), snapshots: [] }),
        "utf-8",
      );
    } catch {
      // 出力先にも書けない場合は invest.md 側のフォールバック手順に委ねる
    }
    process.exit(1);
  });
}
```
This is the exact template for `writeEmptyOutputs()` referenced in RESEARCH.md's CLI skeleton (D-04/D-19 fatal-catch path) — reuse this try/catch-around-writeFile shape for both `tmp/watchlist-technicals.json` and `tmp/watchlist-news.json`.

**Failed-ticker logging pattern** (collect-technicals.ts lines 53-58 — template for D-10):
```typescript
const failed = tickers.filter(
  (t) => !snapshots.some((s) => s.symbol === t),
);
if (failed.length > 0) {
  console.log(`⚠ 取得失敗: ${failed.join(", ")}`);
}
```
Reuse this exact log format for watchlist ticker fetch failures (D-10 explicitly specifies `⚠ 取得失敗: <tickers>` style).

**Per-ticker fail-soft (network call), reused unmodified** (technicals.ts lines 138-159, `fetchTechnicalSnapshot`):
```typescript
export async function fetchTechnicalSnapshot(
  symbol: string,
): Promise<TechnicalSnapshot | null> {
  try {
    const period1 = new Date(Date.now() - 420 * 24 * 60 * 60 * 1000);
    const result = await yahooFinance.chart(symbol, { period1, interval: "1d" });
    const bars: ReadonlyArray<DailyBar> = result.quotes
      .filter((q) => q.close !== null)
      .map((q) => ({ date: q.date.toISOString().slice(0, 10), close: q.close as number, volume: q.volume ?? null }));
    return buildSnapshot(symbol, bars);
  } catch (error) {
    console.error(`Failed to fetch technicals for ${symbol}:`, error);
    return null;
  }
}
```
Confirmed already exported (RESEARCH.md Pitfall 2) — import directly, no edit to `technicals.ts` needed. This is the atomic unit inside the new chunking helper (D-09).

**News-map construction, reused unmodified** (holding-news.ts lines 199-213, `buildHoldingNewsMap`):
```typescript
export function buildHoldingNewsMap(
  articles: ReadonlyArray<NewsArticleWithId>,
  holdings: ReadonlyArray<PortfolioHolding>,
): HoldingNewsFile {
  const now = Date.now();
  const portfolioTickers = holdings.map((h) => h.symbol);
  const entries = holdings.map((holding) => {
    const matches = matchArticlesForHolding(articles, holding);
    const ranked = rankAndCapHoldingArticles(matches, now, portfolioTickers);
    return [holding.symbol, ranked] as const;
  });
  return Object.fromEntries(entries);
}
```
Call this with `toPortfolioHoldingShape(activeEntries)` as the `holdings` argument (D-13) — zero modification to holding-news.ts itself.

**Active-entries derivation, reused unmodified** (watchlist.ts lines 75-79):
```typescript
export function getActiveWatchlistEntries(
  watchlist: WatchlistFile,
): ReadonlyArray<WatchlistEntry> {
  return Object.values(watchlist).filter(isActive);
}
```

---

## Shared Patterns

### Fail-soft CLI + stderr STEP marker
**Source:** `src/scripts/write-watchlist.ts` lines 100-192, `src/scripts/collect-technicals.ts` lines 81-98
**Apply to:** `src/scripts/collect-watchlist-data.ts` (only new CLI in this phase)
- `console.error("[STEP:watchlist-data:OK]")` on success; `console.error("[STEP:watchlist-data:FAIL:<short-reason>]")` on every failure branch; never emit `[PIPELINE:FAIL]`.
- Every failure branch still writes valid (possibly empty) JSON to both output files before returning — combine write-watchlist.ts's ENOENT-vs-corrupted branching with collect-technicals.ts's catch-and-write-empty pattern.
- `if (process.argv[1] === fileURLToPath(import.meta.url))` direct-run guard (write-watchlist.ts style) or `process.argv[1]?.endsWith(...)` (collect-technicals.ts style) — either is acceptable; write-watchlist.ts's is more robust to path resolution and is the more recent (Phase 28) convention, prefer it.

### Symbol normalization single source of truth
**Source:** `src/portfolio/holding-news.ts` lines 32-34, `normalizeHoldingSymbol`
**Apply to:** Any place the new module compares/derives ticker keys (shape-mapping, cache-merge lookups)
```typescript
export function normalizeHoldingSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}
```
`WatchlistEntry.ticker` is already normalized (Phase 28 guarantee) — do not re-normalize watchlist keys, but DO normalize any external input (e.g., cache file symbols) before comparing, per WR-03 precedent (write-watchlist.ts line 84 comment).

### Pure module / fail-soft CLI split
**Source:** `src/portfolio/urgency-history.ts` + `src/scripts/write-watchlist.ts` (also `src/portfolio/watchlist.ts` + `src/scripts/write-watchlist.ts`)
**Apply to:** `src/portfolio/watchlist-data.ts` (pure) + `src/scripts/collect-watchlist-data.ts` (I/O + network + STEP marker)
All business logic (shape mapping, cache merge, chunk splitting) must be throw-free, I/O-free, and independently unit-testable without mocking `fs`/`yahoo-finance2` — only the CLI file needs those mocks.

### Vitest mocking convention for fs/promises + yahoo-finance2
**Source:** `src/scripts/write-watchlist.test.ts` lines 1-20
```typescript
const { quoteMock, readFileMock, writeFileMock, mkdirMock } = vi.hoisted(() => ({
  quoteMock: vi.fn(),
  readFileMock: vi.fn(),
  writeFileMock: vi.fn(),
  mkdirMock: vi.fn(),
}));

vi.mock("yahoo-finance2", () => ({
  default: vi.fn().mockImplementation(function YahooFinanceMock() {
    return { quote: quoteMock };
  }),
}));

vi.mock("node:fs/promises", () => ({
  readFile: readFileMock,
  writeFile: writeFileMock,
  mkdir: mkdirMock,
}));
```
Apply to `collect-watchlist-data.test.ts`; adjust the yahoo-finance2 mock's method to `chart` instead of `quote` (technicals uses `chart()`, not `quote()`). ENOENT simulation convention: `readFileMock.mockRejectedValue(new Error("ENOENT"))` (plain Error, not an errno-coded object) — per D-21's explicit "プレーン Error シミュレート" requirement.

## No Analog Found

None — every file in this phase has a strong (exact or role-match) analog already in the codebase. This phase is pure glue (per RESEARCH.md's own assessment); no novel architectural pattern needs inventing beyond the small chunking helper (Pattern 2 in RESEARCH.md, which has no in-repo precedent but is fully specified there).

## Metadata

**Analog search scope:** `src/portfolio/`, `src/scripts/`, `src/data/technicals.ts`
**Files scanned:** `write-watchlist.ts`, `write-watchlist.test.ts`, `collect-technicals.ts`, `watchlist.ts`, `holding-news.ts`, `urgency-history.ts`, `technicals.ts`
**Pattern extraction date:** 2026-07-15

# Phase 31: Daily Report Watchlist Section - Pattern Map

**Mapped:** 2026-07-16
**Files analyzed:** 4 (3 modified + 1 test file modified; no new files)
**Analogs found:** 4 / 4

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `src/scripts/report-data-loaders.ts` (add `loadWatchlistJudgment`, `loadWatchlist`) | service (I/O loader) | file-I/O, fail-soft read | `loadUrgencyHistory` (same file, lines 143-159); secondary: `loadPortfolioAnalysis` (lines 84-96) | exact |
| `src/scripts/generate-daily-report.ts` (add `formatWatchlistSectionHtml` + card/badge helpers) | component (HTML section renderer) | transform (data → HTML string) | `formatWeeklyUrgencyRollupHtml` + `formatHoldingEvaluationsHtml` + `formatUrgentBadgeHtml`/`formatDecisionChangedBadgeHtml` (all in `generate-portfolio-report.ts`); in-file analog: `formatHighlightedStocksHtml` (generate-daily-report.ts lines 52-102) | exact (cross-file) / role-match (in-file) |
| `src/scripts/generate-report.ts` (extend `Promise.all` + `generateDailyReportHtml` call + `generateHtml` wrapper) | controller (orchestrator `main()`) | request-response / batch wiring | same file's existing `Promise.all` block (lines 122-134) and `generateHtml` (line 84-91) | exact |
| `src/scripts/report-data-loaders.test.ts` (add test cases for new loaders) | test | unit | same file's `describe("loadUrgencyHistory", ...)` block (lines 116-160+) | exact |
| `src/scripts/generate-report.test.ts` (add test cases for new section rendering) | test | unit | existing tests exercising `generateDailyReportHtml` / Test 35 (backward-compat 3-arg call) | exact |

## Pattern Assignments

### `src/scripts/report-data-loaders.ts` — `loadWatchlistJudgment()` / `loadWatchlist()`

**Analog:** `loadUrgencyHistory` (`src/scripts/report-data-loaders.ts:143-159`)

**Imports pattern** (file top, lines 1-7 — already present, reuse as-is):
```typescript
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { analystRound1OutputSchema, analystRound2OutputSchema, analystRound3OutputSchema, portfolioAnalysisSchema } from "../meeting/schemas.js";
import type { NewsArticlePoolEntry } from "../meeting/schemas.js";
import type { AnalystRound1Output, AnalystRound2Output, AnalystRound3Output, PortfolioAnalysis } from "../meeting/types.js";
import type { HoldingNewsFile } from "../portfolio/holding-news.js";
import type { UrgencyHistoryFile } from "../portfolio/urgency-history.js";
```
Add: `import type { WatchlistJudgmentFile } from "../meeting/types.js";` and `import type { WatchlistFile } from "../portfolio/watchlist.js";`

**Fail-soft read + root-shape guard pattern** (lines 143-159, exact code to clone and adapt):
```typescript
export async function loadUrgencyHistory(): Promise<UrgencyHistoryFile> {
  try {
    const raw = await readFile(join(DATA_DIR, "urgency-history.json"), "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      console.warn("Urgency history load failed (unexpected root shape) — falling back to {}");
      return {};
    }
    return parsed as UrgencyHistoryFile;
  } catch (error) {
    console.warn("Urgency history load failed (expected on first run / fail-soft, HIST-03):", error instanceof Error ? error.message : error);
    return {};
  }
}
```

**`loadWatchlistJudgment` requires an additional stale-date guard** (D-13) not present in any single existing loader — this is genuinely new logic layered on top of the above pattern. Take `meetingResultDate: string` as a parameter and compare `file.date !== meetingResultDate` before returning; log via `console.warn` (fail-soft severity, same as `loadUrgencyHistory`/`loadPrevPortfolioAnalysis`) and return `null`.

**`loadWatchlist()`**: same root-shape guard style, fallback to `{}` (matches `WatchlistFile = Record<string, WatchlistEntry>`), reading from `data/watchlist.json` under `DATA_DIR` — mirrors `loadUrgencyHistory`'s `DATA_DIR` usage exactly (not `TMP_DIR`, since watchlist.json lives in `data/`).

Note: `tmp/watchlist-judgment.json` lives under `TMP_DIR` (per RESEARCH architecture diagram), same directory constant used by `loadHoldingNews` (`src/scripts/report-data-loaders.ts:127-135`, `TMP_DIR`).

---

### `src/scripts/generate-daily-report.ts` — `formatWatchlistSectionHtml` + helpers

**Analog for badges:** `formatUrgentBadgeHtml` / `formatDecisionChangedBadgeHtml` (`src/scripts/generate-portfolio-report.ts:52-69`) — NOT exported, must be duplicated/adapted, not imported (Pitfall 4).

```typescript
function formatUrgentBadgeHtml(urgent: boolean): string {
  if (!urgent) return "";
  return ` <span style="display:inline-block;background:#ef4444;color:#fff;font-size:0.75rem;font-weight:bold;padding:0.15rem 0.5rem;margin-left:0.5rem;border-radius:999px;">⚠ 緊急</span>`;
}

function formatDecisionChangedBadgeHtml(
  decisionChanged: boolean | undefined,
  previousDecision: string | undefined,
  decision: string,
): string {
  if (decisionChanged !== true) return "";
  return ` <span style="display:inline-block;background:#f59e0b;color:#1a1a28;font-size:0.75rem;font-weight:bold;padding:0.15rem 0.5rem;margin-left:0.5rem;border-radius:999px;">判断変更: ${escapeHtml(previousDecision ?? "?")} → ${escapeHtml(decision)}</span>`;
}
```
Adapt to `formatTodayActionBadgeHtml(todayAction)` and `formatActionChangedBadgeHtml(actionChanged, previousAction, todayAction)` — keep the exact `!== true` early-return discipline (Pitfall 2 / D-10 / D-11), and keep the exact color codes: `#10b981` (buy/green), `#f59e0b` (amber, decisionChanged direction "買い→待ち"), `#ef4444` reserved for urgent (not used in Phase 31 — no urgent concept for watchlist).

**Analog for card structure:** `formatHoldingEvaluationsHtml` (`generate-portfolio-report.ts:71-96`):
```typescript
function formatHoldingEvaluationsHtml(
  holdings: ReadonlyArray<HoldingEvaluation>,
  resolvedHoldingNews: Record<string, ReadonlyArray<ResolvedHoldingNewsItem>>,
): string {
  if (holdings.length === 0) return "";
  const cards = holdings.map((h) => {
    const color = decisionColor(h.decision);
    const urgentBadge = formatUrgentBadgeHtml(h.urgent);
    const changedBadge = formatDecisionChangedBadgeHtml(h.decisionChanged, h.previousDecision, h.decision);
    return `<div class="agent-card news-card" style="border-left-color:${color};">
      <h4>${escapeHtml(h.symbol)}${h.nameJa ? ` -- ${escapeHtml(h.nameJa)}` : ""}${urgentBadge}${changedBadge} <span style="float:right;color:${color};font-weight:bold;">${escapeHtml(h.decision)}</span></h4>
      <p>${escapeHtml(h.rationale)}</p>
      ${riskHtml}
      ${newsHtml}
    </div>`;
  }).join("\n");
  return `<h2>保有銘柄 個別評価</h2>\n    ${cards}`;
}
```
Reuse: `<div class="agent-card">`, `<h4>` heading with badges inline, `<p>${escapeHtml(...)}</p>` for rationale, ticker-heading pattern `${escapeHtml(ticker)}${nameJa ? " -- " + escapeHtml(nameJa) : ""}` — Phase 31 D-04 uses "—" (em dash) instead of "--" per CONTEXT wording, confirm exact separator with planner discretion.

**Analog for 3-state fallback (D-14):** `formatWeeklyUrgencyRollupHtml` (`generate-portfolio-report.ts:116-158`):
```typescript
function formatWeeklyUrgencyRollupHtml(rollup: WeeklyUrgencyRollup, totalHistoryEntries: number): string {
  const heading = `<h2>今週の緊急・判断変更ロールアップ</h2>`;
  if (totalHistoryEntries === 0) {
    return `${heading}
    <div class="agent-card">
      <p style="color:#888;font-size:0.85rem;">まだ緊急フラグ・判断変更の履歴がありません（履歴は日次で蓄積されます）</p>
    </div>`;
  }
  const footnoteHtml = rollup.daysCovered < 7 ? `...` : "";
  if (rollup.symbols.length === 0) {
    return `${heading}
    <div class="agent-card">
      <p style="color:#888;font-size:0.85rem;">今週は緊急フラグ・判断変更はありませんでした</p>
      ${footnoteHtml}
    </div>`;
  }
  // ...cards
}
```
Adapt three-way branch to: `judgmentFile === null` → `return ""` (D-14 state 3, section hidden entirely — this is a distinct 3rd branch not present in the rollup analog, which always renders a heading; watchlist section must skip rendering completely on null); `judgments.length === 0` → heading + empty-state message (D-14 state 2, mirrors rollup's `totalHistoryEntries === 0`/`symbols.length === 0` empty-state style); `judgments.length > 0` → card list (D-14 state 1).

**Insertion point** (`generate-daily-report.ts:227-280`, `generateDailyReportHtml`):
```typescript
export function generateDailyReportHtml(
  result: MeetingResult,
  webSearchResults: ReadonlyArray<WebSearchResult>,
  reevalResults: ReadonlyArray<ReevaluationOutput>,
  marketData: {
    sectors: ReadonlyArray<SectorDatum>;
    vixHistory: ReadonlyArray<VixDatum>;
  } = { sectors: [], vixHistory: [] },
): string {
  ...
  const scoringSection = formatHighlightedStocksHtml(result);
  const webSearchSection = formatWebSearchHtml(webSearchResults);
  ...
  return `<!DOCTYPE html>
...
    ${scoringSection}
    ${webSearchSection}
...`;
}
```
D-01 insertion: add `const watchlistSection = formatWatchlistSectionHtml(watchlistJudgment, watchlist);` between `scoringSection` and `webSearchSection` definitions, and insert `${watchlistSection}` in the template literal between `${scoringSection}` and `${webSearchSection}` (line 273-275 region). D-15 requires new params appended at the end of the signature with defaults, following the exact style of the existing `marketData` default-value param:
```typescript
watchlistJudgment: WatchlistJudgmentFile | null = null,
watchlist: WatchlistFile = {},
```

**Section function pure-function contract** — in-file analog `formatHighlightedStocksHtml` (`generate-daily-report.ts:52-102`) demonstrates the "receives `MeetingResult` (or similar data), returns HTML string" discipline (D-02) that `formatWatchlistSectionHtml` must follow, receiving `WatchlistJudgmentFile | null` and `WatchlistFile` instead.

---

### `src/scripts/generate-report.ts` — orchestrator wiring

**Analog:** existing `Promise.all` loader block (lines 122-134) and `generateHtml` wrapper (lines 84-91):
```typescript
const [webSearchResults, reevalResults, round1Results, round2Results, round3Results, portfolioAnalysis, marketData, newsPool, holdingNews, prevPortfolioAnalysis, urgencyHistory] = await Promise.all([
  loadWebSearchResults(),
  loadReevalResults(),
  loadRound1Results(),
  loadRound2Results(),
  loadRound3Results(),
  loadPortfolioAnalysis(),
  loadMarketData(),
  loadNewsPool(),
  loadHoldingNews(),
  loadPrevPortfolioAnalysis(),
  loadUrgencyHistory(),
]);
...
const dailyHtml = generateDailyReportHtml(meetingResult, webSearchResults, reevalResults, marketData);
```
Add `loadWatchlistJudgment(meetingResult.date)` and `loadWatchlist()` to the `Promise.all` array (note: `meetingResult` is already parsed before this `Promise.all` at line 119-120, so `meetingResult.date` is available to pass into `loadWatchlistJudgment` for the D-13 stale-date guard). Extend `generateDailyReportHtml(...)` call at line 151 with the two new trailing args. Also update the `generateHtml` wrapper (lines 84-91) import list at line 6/9 if it needs to expose the new loaders — check whether `generateHtml` needs updating for Pitfall 1 backward-compat (it calls `generateDailyReportHtml` with only 4 args currently; since new params are optional/defaulted, no change to `generateHtml` is strictly required, but confirm during planning).

**Import line to extend** (line 9):
```typescript
import { loadRound1Results, loadRound2Results, loadRound3Results, loadPortfolioAnalysis, loadNewsPool, loadHoldingNews, loadPrevPortfolioAnalysis, loadUrgencyHistory } from "./report-data-loaders.js";
```
Add `loadWatchlistJudgment, loadWatchlist` to this import list.

---

### Test files

**`src/scripts/report-data-loaders.test.ts`** — Analog: `describe("loadUrgencyHistory", ...)` block (lines 116-160+), mock conventions (lines 1-23):
```typescript
vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
  readdir: vi.fn(),
}));
const mockReadFile = readFile as unknown as ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.clearAllMocks();
});
```
Per-case pattern (from `loadUrgencyHistory` tests, lines 116-160):
```typescript
vi.mocked(readFile).mockResolvedValueOnce(raw);       // success case
vi.mocked(readFile).mockRejectedValueOnce(new Error("ENOENT"));  // ENOENT fail-soft
vi.mocked(readFile).mockResolvedValueOnce("not valid json{{{");  // parse-fail fail-soft
vi.mocked(readFile).mockResolvedValueOnce("null");     // root-shape guard: null
vi.mocked(readFile).mockResolvedValueOnce("[1,2,3]");  // root-shape guard: array
```
For `loadWatchlistJudgment`, add a 5th case: date-mismatch fixture (`file.date` ≠ passed `meetingResultDate`) asserting `null` return and a `console.warn` call — this is new, no existing analog covers date-mismatch, must be authored fresh following the same `vi.mocked(readFile).mockResolvedValueOnce(...)` + `expect(result).toBeNull()` shape.

**`src/scripts/generate-report.test.ts`** — Analog: Test 35 (backward-compat 3-arg `generateDailyReportHtml` call, referenced in RESEARCH.md Pitfall 1) confirms the existing pattern of testing default-value params without breaking prior call sites. New tests for `formatWatchlistSectionHtml`/section integration should call `generateDailyReportHtml` with explicit 5th/6th args and assert HTML string contains expected fragments (`toContain`), matching the string-assertion style already used for other sections in this test file.

---

## Shared Patterns

### HTML Escaping
**Source:** `src/scripts/report-utils.ts:26` (`escapeHtml`)
**Apply to:** All dynamic strings in `formatWatchlistSectionHtml`/card helpers — ticker, nameJa, rationale, signals, addedDate, asOf. Mandatory per Pitfall 5 / Security Domain XSS row (v2.6 WR-03 established convention: escape ALL dynamic strings including dates, defense-in-depth).

### Fail-soft loader pattern (root-shape guard + try/catch + console.warn)
**Source:** `src/scripts/report-data-loaders.ts:143-159` (`loadUrgencyHistory`)
**Apply to:** `loadWatchlistJudgment`, `loadWatchlist` — both must check `parsed === null || typeof parsed !== "object" || Array.isArray(parsed)` before use, and use `console.warn` (not `console.error`) since missing files are an expected/normal condition (matches `loadPrevPortfolioAnalysis`/`loadUrgencyHistory` severity convention, distinguished from `loadPortfolioAnalysis`'s `console.error` per code comment at line 97).

### undefined/false discrimination for change badges
**Source:** `src/scripts/generate-portfolio-report.ts:67` (`if (decisionChanged !== true) return "";`)
**Apply to:** `formatActionChangedBadgeHtml` — must use `actionChanged !== true` early return, never a truthy check (Pitfall 2, D-10, D-11).

### Ticker key normalization for joins
**Source:** `src/scripts/generate-portfolio-report.ts:82` (`resolvedHoldingNews[normalizeHoldingSymbol(h.symbol)]`), `normalizeHoldingSymbol` exported from `src/portfolio/holding-news.ts`
**Apply to:** `formatWatchlistSectionHtml`'s `watchlist[judgment.ticker]` lookup — must normalize via `normalizeHoldingSymbol(judgment.ticker)` before indexing into `WatchlistFile` (Pitfall 5).

### Card visual container
**Source:** `.agent-card` CSS class, used throughout `generate-portfolio-report.ts` and `generate-daily-report.ts`; base styles from `report-utils.ts:98` (`generateBaseStyles`)
**Apply to:** Each watchlist judgment card — reuse `.agent-card` class, no new CSS.

## No Analog Found

None. All required patterns (fail-soft loader, badge visual grammar, card layout, 3-state fallback, section insertion, backward-compatible optional params, test mock conventions) have direct, recently-modified codebase analogs from Phases 22/25/26/28/29/30.

## Metadata

**Analog search scope:** `src/scripts/report-data-loaders.ts`, `src/scripts/generate-portfolio-report.ts`, `src/scripts/generate-daily-report.ts`, `src/scripts/generate-report.ts`, `src/scripts/report-utils.ts`, `src/meeting/types.ts`, `src/portfolio/watchlist.ts`, `src/scripts/report-data-loaders.test.ts`
**Files scanned:** 8 (all read directly, no grep-only inference)
**Pattern extraction date:** 2026-07-16
</content>

# Phase 14: Report UI - Pattern Map

**Mapped:** 2026-07-01
**Files analyzed:** 14 (5 extend, 1 new source, 2 generated HTML artifacts, 1 no-op check, 5 test files)
**Analogs found:** 12 / 14 (2 have no direct analog — new algorithm/new mocking surface, noted below with fallback guidance)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `src/data/market.ts` (extend: `fetchVixHistory`, `fetchAllMarketData`) | service | batch (external API fetch → in-memory shape) | `src/data/market.ts` itself (`fetchMarketIndices`, `fetchSectorPerformance`) | exact |
| `src/scripts/report-charts.ts` (new) | utility / template-component | transform (data → SVG string) | `src/scripts/generate-daily-report.ts` (`formatMarketOverviewHtml` et al.) | role-match (established `formatXxxHtml` pure-function convention, new file continues it) |
| `src/scripts/generate-daily-report.ts` (extend: `marketData` param) | component / template | transform + request-response (compose sections → HTML string) | itself (existing section-composition in `generateDailyReportHtml`) | exact |
| `src/scripts/generate-report.ts` (extend: `loadMarketData`) | controller (script entrypoint) | file-I/O (read JSON) + batch | itself (`loadWebSearchResults` / `loadReevalResults`) | exact |
| `src/scripts/update-index.ts` (rewrite: `updateIndexHtml`) | controller (script) | file-I/O (read → parse → regenerate → write) | itself (current `updateIndexHtml`, marker-insert) | partial — role/file exact, but algorithm shifts from append-only to full parse+regroup (no existing analog for month-grouping; see RESEARCH.md Pattern 2 as the reference implementation) |
| `src/scripts/report-utils.ts` (extend: responsive media query) | utility (shared styles) | transform (string template) | itself (`generateBaseStyles`) | exact |
| `docs/index.html` (generated/edited artifact) | generated static HTML+CSS | file-I/O (written by `update-index.ts`; `<style>` block is static, hand-authored) | itself (existing `.report-item`/`.report-date`/`.report-links` markup + inline `<style>`) | exact for existing markup / no-analog for new hero+accordion+`<details>` structure (net-new pattern, D-01/D-02) |
| `docs/portfolio.html` (generated/edited artifact) | generated static HTML+CSS | file-I/O (written by `update-index.ts`; `<style>` block is static) | `docs/index.html` (near-identical inline `<style>` block, shares `.report-item` pattern) | exact |
| `src/scripts/collect-data.ts` | controller (script orchestrator) | batch/file-I/O | itself (`fetchAllMarketData()` call → `JSON.stringify` write) | exact — **no code change expected**; `vixHistory` flows through automatically once `market.ts::fetchAllMarketData` includes it (see D-08 caveat in Shared Patterns) |
| `src/scripts/report-charts.test.ts` (new) | test (unit) | request-response (call pure fn, assert string) | `src/scripts/generate-report.test.ts` → `describe("Daily Report")` block | role-match |
| `src/data/market.test.ts` (new) | test (unit) | event-driven (mock external client, assert mapping) | `src/data/news/finnhub.test.ts` (external API mocking via `vi.spyOn`/`vi.mock`) + `collect-data.test.ts` (`mockMarketData` shape) | role-match (no existing test mocks `yahoo-finance2` directly — first of its kind, see No Analog Found) |
| `src/scripts/update-index.test.ts` (new) | test (unit) | file-I/O | `src/scripts/generate-report.test.ts` → `describe("3-report output")` (fs-mock pattern) | role-match |
| `src/scripts/collect-data.test.ts` (extend `mockMarketData`) | test | unit | itself (lines 10-15) | exact |
| `src/scripts/generate-report.test.ts` (extend Daily Report cases) | test | unit | itself (`describe("Daily Report")` block, lines 142-204) | exact |

---

## Pattern Assignments

### `src/data/market.ts` (service, batch fetch)

**Analog:** itself — `src/data/market.ts` lines 1-3 (client init), 55-65 (`fetchQuoteSafe`), 84-99 (`fetchSectorPerformance`), 125-132 (`fetchAllMarketData`)

**Imports pattern** (lines 1-3):
```typescript
import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });
```

**Error-tolerant fetch pattern** (lines 55-65) — `fetchVixHistory` must follow the same
try/catch-log-return-fallback shape, not throw:
```typescript
async function fetchQuoteSafe(
  symbol: string,
): Promise<Record<string, unknown> | null> {
  try {
    const result = await yahooFinance.quote(symbol);
    return result as unknown as Record<string, unknown>;
  } catch (error) {
    console.error(`Failed to fetch quote for ${symbol}:`, error);
    return null;
  }
}
```

**Aggregation pattern** (lines 84-99, `fetchSectorPerformance`) — new `fetchVixHistory` should
return a `ReadonlyArray<VixHistoryPoint>` the same way this returns `ReadonlyArray<SectorPerformance>`:
```typescript
export async function fetchSectorPerformance(): Promise<
  ReadonlyArray<SectorPerformance>
> {
  const results = await Promise.all(
    SECTOR_ETFS.map(async ({ sector, symbol }) => {
      const quote = await fetchQuoteSafe(symbol);
      if (!quote) return null;
      return {
        sector: sector as string,
        symbol: symbol as string,
        changePercent: (quote.regularMarketChangePercent as number) ?? 0,
      };
    }),
  );
  return results.filter((r): r is SectorPerformance => r !== null);
}
```

**`fetchAllMarketData` extension point** (lines 125-132) — add `vixHistory` as a third parallel
fetch, keep `as const`:
```typescript
export async function fetchAllMarketData() {
  const [indices, sectors] = await Promise.all([
    fetchMarketIndices(),
    fetchSectorPerformance(),
  ]);

  return { indices, sectors } as const;
}
```
Note: `.chart()` (not `.quote()`) is the right call for VIX history — use
`yahooFinance.chart("^VIX", { period1: new Date(Date.now() - 30*24*60*60*1000) })`, map
`quotes[].date` (a `Date` object) to `YYYY-MM-DD` via `.toISOString().slice(0,10)`, and filter
`close !== null` before mapping, per RESEARCH.md Pitfalls 1-2 (`node_modules/yahoo-finance2/esm/src/modules/chart.d.ts` — `ChartOptions.period1: Date | string | number`).

---

### `src/scripts/report-charts.ts` (new — utility/template, transform)

**Analog:** `src/scripts/generate-daily-report.ts` lines 4-22 (`formatMarketOverviewHtml`, a pure `(MeetingResult) => string` function using the same escaping + conditional-empty convention this new module must follow)

**Core pattern to mirror** (pure function, ternary color pick, escapeHtml on every interpolated value, template-literal return):
```typescript
function formatMarketOverviewHtml(result: MeetingResult): string {
  const trendColor = result.marketOverview.trend === "上昇" ? "#10b981"
    : result.marketOverview.trend === "下降" ? "#ef4444"
    : "#f59e0b";

  const indicesHtml = result.marketOverview.keyIndices.map((idx) => {
    const color = idx.changePercent >= 0 ? "#10b981" : "#ef4444";
    const sign = idx.changePercent >= 0 ? "+" : "";
    return `<li>${escapeHtml(idx.name)}: <span style="color:${color}">${sign}${idx.changePercent}%</span></li>`;
  }).join("\n");

  return `<hr>
    <h2>市場概況</h2>
    <div class="agent-card">
      ...
    </div>`;
}
```

**Empty-array guard convention to mirror** (from `formatSectorRecommendationsHtml`, line 24-25):
```typescript
function formatSectorRecommendationsHtml(result: MeetingResult): string {
  if (result.sectorRecommendations.length === 0) return "";
  ...
```
`report-charts.ts`'s empty-state must follow the same "check `.length === 0` first" style but
render the UI-SPEC's fixed copy block (not `""`) — see Code Examples in RESEARCH.md for the exact
`renderSectorBarChart` / `renderVixLineChart` implementations (already written verbatim against
this codebase's conventions, including `escapeHtml` import from `report-utils.js`). Reuse those
implementations as-is; they were derived directly from this analog.

**Import convention** (matches `generate-daily-report.ts` line 1):
```typescript
import { escapeHtml, markdownToHtml, scoreColor, verdictColor, generateBaseStyles } from "./report-utils.js";
```
`report-charts.ts` only needs `escapeHtml`:
```typescript
import { escapeHtml } from "./report-utils.js";
```

---

### `src/scripts/generate-daily-report.ts` (extend, component/template)

**Analog:** itself — `generateDailyReportHtml` (lines 208-253)

**Section-composition pattern to extend** (lines 216-224, 237-244) — new chart sections slot in
exactly like the existing `formatXxxHtml` calls:
```typescript
export function generateDailyReportHtml(
  result: MeetingResult,
  webSearchResults: ReadonlyArray<WebSearchResult>,
  reevalResults: ReadonlyArray<ReevaluationOutput>,
): string {
  const timestamp = new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
  const styles = generateBaseStyles("#3b82f6");

  const marketSection = formatMarketOverviewHtml(result);
  const sectorSection = formatSectorRecommendationsHtml(result);
  ...
  return `<!DOCTYPE html>
...
    ${marketSection}
    ${sectorSection}
    ${scoringSection}
    ...
  </div>
</body>
</html>`;
}
```
Add a 4th parameter `marketData: { sectors: ReadonlyArray<SectorDatum>; vixHistory: ReadonlyArray<VixDatum> }`
(per RESEARCH.md data-plumbing-gap finding), call `renderSectorBarChart(marketData.sectors)` /
`renderVixLineChart(marketData.vixHistory)` from the new `report-charts.ts`, and splice the
resulting SVG strings into the returned template literal the same way `marketSection`/`sectorSection`
are spliced in — wrap each in a `<h2>...</h2>` + container `<div>` following the existing `<hr><h2>...</h2>` section-header convention seen in every `formatXxxHtml` function.

**Call-site update required in `generate-report.ts`** (both `generateHtml` line 57-63 and
`main()` line 83) — both currently call `generateDailyReportHtml(result, webSearchResults, reevalResults)` with 3 args; must become 4 args once `marketData` is threaded through.

---

### `src/scripts/generate-report.ts` (extend, controller/script)

**Analog:** itself — `loadWebSearchResults` (lines 13-33) / `loadReevalResults` (lines 35-55)

**Try/catch-empty-fallback loader pattern to copy for `loadMarketData()`**:
```typescript
async function loadReevalResults(): Promise<ReadonlyArray<ReevaluationOutput>> {
  const reevalDir = join(TMP_DIR, "reeval");
  try {
    const files = await readdir(reevalDir);
    const results = await Promise.all(
      files
        .filter((f) => f.endsWith(".json"))
        .map(async (f) => {
          try {
            const raw = await readFile(join(reevalDir, f), "utf-8");
            return validateReevaluationOutput(JSON.parse(raw) as unknown);
          } catch {
            return null;
          }
        }),
    );
    return results.filter((r): r is ReevaluationOutput => r !== null);
  } catch {
    return [];
  }
}
```
`loadMarketData()` differs slightly (single file, not a directory of files) — RESEARCH.md's
Code Examples section already has the exact single-file variant matching this codebase's
try/catch-empty-fallback convention:
```typescript
async function loadMarketData(): Promise<MarketData> {
  try {
    const raw = await readFile(join(TMP_DIR, "market.json"), "utf-8");
    const parsed = JSON.parse(raw) as { sectors?: unknown; vixHistory?: unknown };
    return {
      sectors: Array.isArray(parsed.sectors) ? (parsed.sectors as MarketData["sectors"]) : [],
      vixHistory: Array.isArray(parsed.vixHistory) ? (parsed.vixHistory as MarketData["vixHistory"]) : [],
    };
  } catch {
    return { sectors: [], vixHistory: [] };
  }
}
```

**Wire-up point** (lines 71-78, `Promise.all` fan-out in `main()`):
```typescript
const [webSearchResults, reevalResults, round1Results, round2Results, round3Results, portfolioAnalysis] = await Promise.all([
  loadWebSearchResults(),
  loadReevalResults(),
  loadRound1Results(),
  loadRound2Results(),
  loadRound3Results(),
  loadPortfolioAnalysis(),
]);
```
Add `loadMarketData()` to this array, then pass the result as the 4th arg to
`generateDailyReportHtml(...)` at line 83.

---

### `src/scripts/update-index.ts` (rewrite, controller/script)

**Analog:** itself — current marker-insert implementation (lines 39-52), which must be replaced
per RESEARCH.md's Architecture Patterns "Pattern 2: Month-grouped accordion regeneration"
(no existing codebase analog for month-grouping — this is genuinely new logic).

**Current pattern being replaced** (lines 39-52) — read for context (what NOT to keep doing:
naive marker string-insert with a duplicate-date early-return):
```typescript
async function updateIndexHtml(date: string): Promise<void> {
  const filePath = join(DOCS_DIR, "index.html");
  const content = await readFile(filePath, "utf-8");

  if (content.includes(`<div class="report-date">${date}</div>`)) {
    console.log(`index.html: ${date} のエントリは既に存在します。スキップします。`);
    return;
  }

  const entry = buildIndexEntry(date);
  const updated = content.replace(MARKER, `${MARKER}\n${entry}`);
  await writeFile(filePath, updated, "utf-8");
  console.log(`index.html: ${date} のエントリを追加しました。`);
}
```

**Existing markup vocabulary to preserve** (`buildIndexEntry`, lines 15-24) — keep these exact
CSS class names (`.report-item`, `.report-date`, `.report-links`) since `docs/index.html`'s
static `<style>` block already targets them; new hero/accordion markup should extend this
vocabulary (e.g. new classes `.hero`, `.month-group`) rather than replace it:
```typescript
function buildIndexEntry(date: string): string {
  return `      <li class="report-item">
        <div class="report-date">${date}</div>
        <div class="report-links">
          <a href="${date}/daily-report.html">Daily Report</a>
          <a href="${date}/meeting-minutes.html">Meeting Minutes</a>
          <a href="${date}/portfolio-report.html">Portfolio Report</a>
        </div>
      </li>`;
}
```

**Replacement algorithm (no in-repo analog — copy from RESEARCH.md verbatim):** parse existing
`<li class="report-item">` blocks (regex, preserving each entry's actual link set — do not assume
3 links, see RESEARCH.md finding 2 / Anti-Patterns), group by `date.slice(0,7)`, sort months
descending, render newest entry as hero (D-01) and one `<details class="month-group"${i===0
? " open" : ""}>` per month (D-02) with summary text `${y}年${Number(mo)}月 (${items.length}件)`
per UI-SPEC copy contract. Full reference implementation: RESEARCH.md → "Pattern 2: Month-grouped
accordion regeneration (index.html)" (`parseExistingEntries`, `groupByMonth`, `renderAccordion`).
RESEARCH.md's Open Question #1 additionally recommends sourcing entries from `readdir(docs/)`
rather than re-parsing HTML — planner should decide and record this choice explicitly, since it
changes `updateIndexHtml`'s data source (not the rendering logic).

**`updatePortfolioHtml` (lines 54-77) — keep existing marker-insert algorithm.** Per CONTEXT.md
scoping (D-01/D-02 apply to index.html only) and RESEARCH.md Assumption A3, `portfolio.html`
needs only D-09 responsive CSS added to its static `<style>` block — no hero/accordion rewrite.

---

### `src/scripts/report-utils.ts` (extend, utility/shared styles)

**Analog:** itself — `generateBaseStyles` (lines 70-168)

**Extension point** (end of returned template literal, before closing `</style>` tag, line
165-167):
```typescript
    .discussion-card {
      background: #1a1a28;
      border-radius: 8px;
      padding: 1rem;
      margin-bottom: 0.8rem;
      border-left: 4px solid #f59e0b;
    }
    .discussion-card h4 { color: #fbbf24; margin-top: 0; }
  </style>
`;
```
Append a `@media (max-width: 768px) { ... }` block here (D-09/D-10/D-11), matching RESEARCH.md's
Code Examples snippet:
```typescript
  @media (max-width: 768px) {
    body { padding: 1rem; }
    .container { max-width: 100%; }
    table { display: block; overflow-x: auto; white-space: nowrap; }
    h1 { font-size: 1.4rem; }
    .report-links a, summary { min-height: 44px; display: inline-flex; align-items: center; }
  }
```
This function is shared by `generate-daily-report.ts`, `generate-meeting-minutes.ts` (amber
`#f59e0b` accent), and `generate-portfolio-report.ts` (green `#10b981` accent) — a single edit
here covers mobile responsiveness for 3 of the 5 required HTML surfaces (UI-01/D-09) automatically. `docs/index.html` and `docs/portfolio.html` do **not** call this function (they have
their own static inline `<style>` blocks, confirmed by grep — no `generateBaseStyles` reference
in either file) and need the equivalent media-query block added directly to their own `<style>`
blocks by whatever script/edit touches those two files.

---

### `docs/index.html` / `docs/portfolio.html` (generated static artifacts)

**Analog:** each other — near-identical inline `<style>` block structure (both `#0f0f1a`
background, `.report-item`/`.report-date`/`.report-links` classes; `docs/index.html` accents
`#3b82f6`, `docs/portfolio.html` accents `#10b981`).

**Existing shared inline-style vocabulary** (`docs/index.html` lines 7-58 / `docs/portfolio.html`
lines 7-56) — both start with the identical reset + body + container + h1 rules:
```css
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: 'Helvetica Neue', Arial, 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', Meiryo, sans-serif;
  background: #0f0f1a;
  color: #e0e0e0;
  line-height: 1.7;
  padding: 2rem;
}
.container { max-width: 720px; margin: 0 auto; }
```
Only these two files declare `.container { max-width: 720px; ... }` (narrower than
`report-utils.ts`'s 960px) — a real, pre-existing divergence, not a bug; preserve 720px for these
two files per D-03 (existing theme preserved) unless the hero section redesign explicitly changes
it (Claude's Discretion).

**No analog for the new hero/accordion DOM structure** — this is genuinely new markup (D-01/D-02
require `<details>/<summary>` month accordions and a hero block) with no precedent anywhere in
the codebase. Build it fresh using the CSS token values from `14-UI-SPEC.md` (Typography/Color/
Spacing sections) and the copy contract's exact accordion summary format
(`{YYYY年M月} ({N}件)`).

**Important operational constraint (not a pattern, but load-bearing):** only `update-index.ts`
is permitted to mutate these two files (`.claude/commands/invest.md` explicit instruction,
enforced operationally by the OPS-02 checksum+`git checkout` safety net in `scripts/run.sh`).
Any one-time hand-edit to add new CSS rules (hero, `.month-group`, `details/summary`, media
query) to the static `<style>` blocks must be committed normally — do not leave uncommitted
changes to these files, they will be silently reverted by the next pipeline run's checksum check.

---

### `src/scripts/collect-data.ts` (no code change expected)

**Analog:** itself — lines 19-28 already call `fetchAllMarketData()` and `JSON.stringify` the
entire returned object to `tmp/market.json`:
```typescript
console.log("市場データ収集中...");
const marketData = await fetchAllMarketData();
await writeFile(
  join(TMP_DIR, "market.json"),
  JSON.stringify(marketData, null, 2),
  "utf-8",
);
console.log(
  `市場データ収集完了 (指数: ${marketData.indices.length}件, セクター: ${marketData.sectors.length}件)`,
);
```
Because `vixHistory` is added inside `market.ts::fetchAllMarketData()`'s return object, it
flows through this existing code path automatically — `collect-data.ts` itself needs **no
functional change**. Optionally extend the summary `console.log` line to also print
`vixHistory.length`, but this is cosmetic, not required by D-06/D-07/D-08.

---

## Test File Patterns

### `src/scripts/report-charts.test.ts` (new)

**Analog:** `src/scripts/generate-report.test.ts` → `describe("Daily Report")` (lines 142-204)
and `describe("report-utils")` (lines 122-141) for the "call pure function, assert on the
returned HTML/SVG string" style:
```typescript
it("Test 2: HTML 出力に Bloomberg 風ダークテーマの CSS class が含まれる（\"agent-card\" と \"0f0f1a\"）", async () => {
  // pattern: import fn, call with fixture data, expect(html).toContain(...)
});
```
Apply the same shape to `renderSectorBarChart`/`renderVixLineChart`: assert sort order (`indexOf`
comparisons on rendered sector names), assert bar colors (`toContain("#10b981")` /
`toContain("#ef4444")`), assert empty-array → `toContain("データ取得エラー")`, assert
`toContain('viewBox="0 0')` and `not.toContain('width="600"')`-style checks for the
no-fixed-pixel-width requirement.

### `src/data/market.test.ts` (new — no direct in-repo analog)

**Closest analogs (combine two):**
1. `src/data/news/finnhub.test.ts` (lines 1-40) — external-API mocking style via `vi.spyOn(globalThis, "fetch")` / module mocking, `beforeEach`/`afterEach` cleanup with `vi.stubEnv`/`vi.unstubAllEnvs`/`vi.restoreAllMocks()`.
2. `src/scripts/collect-data.test.ts` (lines 10-19) — the `mockMarketData` shape and
   `vi.mock("../data/market.js", () => ({ fetchAllMarketData: vi.fn().mockResolvedValue(mockMarketData) }))` pattern, which will need `vixHistory: []` added once `market.ts` changes.

Since no test currently mocks the `yahoo-finance2` npm package's `chart()`/`quote()` methods
directly, `market.test.ts` must mock the `YahooFinance` class itself, e.g.
`vi.mock("yahoo-finance2", () => ({ default: vi.fn().mockImplementation(() => ({ chart: vi.fn()..., quote: vi.fn()... })) }))` — this is new mocking surface, not a copy-paste from an existing
file, but should follow the same `beforeEach`/`afterEach` reset discipline used in
`finnhub.test.ts` and `generate-report.test.ts`.

### `src/scripts/update-index.test.ts` (new)

**Analog:** `src/scripts/generate-report.test.ts` → `describe("3-report output")` (lines
353-459) for the `vi.mock("node:fs/promises", ...)` + read-mock-file-content, call `main()`/
target function, assert on `writeFile` mock calls pattern:
```typescript
vi.mock("node:fs/promises", () => ({
  readFile: vi.fn().mockRejectedValue(new Error("ENOENT")),
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
  readdir: vi.fn().mockResolvedValue([]),
}));
```
For `update-index.test.ts`, mock `readFile` to resolve with a fixture `docs/index.html` string
containing several `<li class="report-item">` entries across 2+ months (including one entry with
only 2 links, to cover RESEARCH.md's Anti-Pattern), then assert the `writeFile`-captured output
contains the correct number of `<details>` blocks, the newest month has ` open`, older months do
not, and the 2-link entry's `href`s are preserved verbatim (no fabricated 3rd link).

### `src/scripts/collect-data.test.ts` (extend `mockMarketData`)

**Exact location** (lines 10-15):
```typescript
const mockMarketData = {
  indices: [
    { name: "S&P 500", symbol: "^GSPC", price: 5000, change: 10, changePercent: 0.2 },
  ],
  sectors: [],
};
```
Add `vixHistory: []` here (RESEARCH.md Pitfall 6) — required to keep this mock structurally
consistent with `fetchAllMarketData()`'s updated return type once `market.ts` changes, even
though no existing assertion currently checks `vixHistory`.

---

## Shared Patterns

### HTML escaping (universal)
**Source:** `src/scripts/report-utils.ts` lines 7-12
```typescript
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
```
**Apply to:** every interpolated string in `report-charts.ts` (sector names, dates) and any
new markup in `update-index.ts`'s hero/accordion regeneration (dates, links) — matches
RESEARCH.md's Security Domain V5 finding. This is the single universal convention across all
`formatXxxHtml`/`generateXxxHtml` functions in the codebase; no file in this phase should
interpolate untrusted/semi-trusted string data without routing through this function.

### Color tokens (existing, must be reused not redefined)
**Source:** `src/scripts/report-utils.ts` lines 1-5 (`ACCENT_VARIANTS`), 55-68 (`scoreColor`,
`verdictColor`)
```typescript
const ACCENT_VARIANTS: Record<string, { light: string; lighter: string }> = {
  "#3b82f6": { light: "#60a5fa", lighter: "#93c5fd" },
  "#f59e0b": { light: "#fbbf24", lighter: "#fcd34d" },
  "#10b981": { light: "#34d399", lighter: "#6ee7b7" },
};
```
**Apply to:** `report-charts.ts` (positive `#10b981` / negative `#ef4444` / accent `#3b82f6`
already match these tokens exactly — no new color constants needed, just literal hex reuse per
UI-SPEC Color section) and any new CSS added to `docs/index.html`/`docs/portfolio.html`/
`report-utils.ts` (threshold gray `#6b7280` is the one genuinely new token this phase introduces).

### Pure-function HTML/SVG section pattern
**Source:** `src/scripts/generate-daily-report.ts` — every `formatXxxHtml(result): string`
function (lines 4-206)
**Apply to:** `report-charts.ts`'s `renderSectorBarChart`/`renderVixLineChart` (same shape:
pure function, takes data, returns a markup string, guards on empty input, no side effects, no
class, no framework).

### Try/catch → empty-array/empty-object fallback (never throw, log and degrade)
**Source:** `src/scripts/generate-report.ts` lines 13-33, 35-55; `src/data/market.ts` lines
55-65; `src/scripts/collect-data.ts` lines 30-66, 68-80
**Apply to:** `fetchVixHistory()` (must return `[]` on error, not throw — matches
`fetchQuoteSafe`), `loadMarketData()` (must return `{ sectors: [], vixHistory: [] }` on error),
and `report-charts.ts`'s render functions (must render the UI-SPEC empty-state markup for
`length === 0`, not throw on missing/partial data — RESEARCH.md Pitfall 4).

### Viewport meta tag (already present everywhere — no action needed)
**Source:** present identically in `docs/index.html` line 5, `docs/portfolio.html` line 5, and
every `generateDailyReportHtml`/`generateMeetingMinutesHtml`/`generatePortfolioReportHtml`
output (`<meta name="viewport" content="width=device-width, initial-scale=1.0">`). Confirms
D-09/D-10/D-11 responsive work only requires CSS additions, not new meta tags.

---

## No Analog Found

| File / Concern | Role | Data Flow | Reason |
|------|------|-----------|--------|
| Month-grouped `<details>`/`<summary>` accordion regeneration algorithm (`update-index.ts`) | controller | file-I/O (parse+regroup+write) | No existing script in this codebase parses its own previously-generated HTML back into structured data — every other generator is write-only (compose from source JSON → write HTML, never re-read prior HTML output). Use RESEARCH.md's Pattern 2 (`parseExistingEntries`/`groupByMonth`/`renderAccordion`) as the from-scratch reference implementation, informed by RESEARCH.md Open Question #1 (`readdir(docs/)` as an alternative, more-authoritative data source worth considering during planning). |
| `yahoo-finance2` `YahooFinance` class mocking in tests (`market.test.ts`) | test | event-driven (mock external client) | No existing test file mocks the `yahoo-finance2` package directly (all current market-data tests mock at the `src/data/market.js` module boundary instead, per `collect-data.test.ts`). `finnhub.test.ts`'s `vi.spyOn(globalThis, "fetch")` pattern is the closest sibling convention for external-API test isolation, but the actual mock target (a class constructor vs. `fetch`) differs — new mocking code, not copy-paste. |

## Metadata

**Analog search scope:** `src/data/`, `src/scripts/`, `docs/index.html`, `docs/portfolio.html`, all `*.test.ts` under `src/`
**Files scanned:** `src/data/market.ts`, `src/scripts/report-utils.ts`, `src/scripts/generate-report.ts`, `src/scripts/generate-daily-report.ts`, `src/scripts/update-index.ts`, `src/scripts/collect-data.ts`, `src/scripts/report-data-loaders.ts`, `docs/index.html`, `docs/portfolio.html`, `src/scripts/generate-report.test.ts`, `src/scripts/collect-data.test.ts`, `src/data/news/finnhub.test.ts`
**Pattern extraction date:** 2026-07-01

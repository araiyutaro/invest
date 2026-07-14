# Phase 26: Weekly Urgency Rollup Display - Pattern Map

**Mapped:** 2026-07-04
**Files analyzed:** 5 (2 new, 3 modified)
**Analogs found:** 5 / 5

**Verification note:** All line numbers below were re-verified directly against live source in this session (not copied blindly from RESEARCH.md/CONTEXT.md). One correction confirmed: `attachDecisionChanges` lives at `src/portfolio/decision-diff.ts` (NOT `src/meeting/decision-diff.ts` as CONTEXT.md's `<canonical_refs>` states — RESEARCH.md already caught this; re-confirmed here by direct Read).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `src/portfolio/urgency-rollup.ts` | utility (pure aggregation module) | transform (batch, in-memory) | `src/portfolio/urgency-history.ts` (types/shape) + `src/portfolio/decision-diff.ts` (algorithm philosophy) | exact (role+flow) |
| `src/portfolio/urgency-rollup.test.ts` | test | transform (unit) | `src/portfolio/urgency-history.test.ts` | exact |
| `src/scripts/generate-portfolio-report.ts` (modify) | component/renderer (server-side HTML string template) | request-response (build-time render) | itself — extend existing `format*Html` functions in same file (`formatHoldingEvaluationsHtml`, `formatUrgentBadgeHtml`, `formatDecisionChangedBadgeHtml`) | exact (same file, same role) |
| `src/scripts/generate-report.ts` (modify) | controller (pipeline orchestrator / loader wiring) | file-I/O + CRUD (read JSON → compose → write HTML) | itself — extend existing `Promise.all` loader batch + call site | exact |
| `src/scripts/generate-report.test.ts` (modify) | test | request-response (backward-compat + render assertions) | Test 38 (`generate-report.test.ts` L473-479) + Tests 40-43 (L481-518) | exact |

Additionally implied by RESEARCH.md's verified architecture (not explicitly in the file list header but required to satisfy D-13 loader placement — flagging for planner):
| `src/scripts/report-data-loaders.ts` (modify — add `loadUrgencyHistory`) | service (loader) | file-I/O | `loadHoldingNews` (L125-133) / `loadPrevPortfolioAnalysis` (L97-105) in same file | exact |
| `src/scripts/report-data-loaders.test.ts` (modify — add `describe("loadUrgencyHistory")`) | test | file-I/O | `describe("loadHoldingNews")` block (L55-80) | exact |

## Pattern Assignments

### `src/portfolio/urgency-rollup.ts` (utility, pure aggregation)

**Analog 1 (types/shape):** `src/portfolio/urgency-history.ts` (57 lines, read in full)

**Imports pattern** (whole file has none beyond internal type imports — mirror this minimalism):
```typescript
import { normalizeHoldingSymbol } from "./holding-news.js";
import type { PortfolioAnalysis } from "../meeting/types.js";
```
For `urgency-rollup.ts`, the equivalent is:
```typescript
import { isValidDateKey } from "./urgency-history.js";
import type { HoldingUrgencySnapshot, UrgencyHistoryFile } from "./urgency-history.js";
```
Do NOT import `normalizeHoldingSymbol` here — D-04 explicitly says the read side must not re-normalize (analog `holding-news.ts` L32-34 is the normalization source of truth, already applied at write time by Phase 25).

**Core type-definition pattern** (`urgency-history.ts` L9-20):
```typescript
export interface HoldingUrgencySnapshot {
  readonly symbol: string;
  readonly nameJa: string;
  readonly urgent: boolean;
  readonly decision: "保持" | "買増" | "一部売却" | "全売却";
}

export type UrgencyHistoryFile = Record<string, ReadonlyArray<HoldingUrgencySnapshot>>;
```
New types for this phase (`WeeklyUrgencyRollup`, `WeeklySymbolRollup`, `DecisionChangeEvent`) should follow this exact style: `interface` with `readonly` fields, `ReadonlyArray<...>` for lists — never mutable arrays.

**Pure-function-with-doc-comment pattern** (`urgency-history.ts` L38-48, `appendUrgencySnapshot`):
```typescript
/**
 * D-04: 同日ガードは日付キー上書き。immutable spread で history を一切 mutate しない。
 * オブジェクトの同一キー代入なので重複は構造的に不可能。
 */
export function appendUrgencySnapshot(
  history: UrgencyHistoryFile,
  dateKey: string,
  snapshots: ReadonlyArray<HoldingUrgencySnapshot>,
): UrgencyHistoryFile {
  return { ...history, [dateKey]: snapshots };
}
```
Mirror this exact doc-comment style (Japanese, cites decision ID, states immutability/no-throw guarantee explicitly) for `computeWeeklyUrgencyRollup`.

**Date-key validation pattern to reuse verbatim** (`urgency-history.ts` L54-56):
```typescript
export function isValidDateKey(dateKey: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateKey);
}
```
`urgency-rollup.ts` MUST import and reuse this exact function (not reimplement) — it is already hardened against `"__proto__"` (tested in `urgency-history.test.ts` L157-159) and is the project's single source of truth for date-key shape (Don't-Hand-Roll table, RESEARCH.md).

**Analog 2 (decision-diff algorithm philosophy):** `src/portfolio/decision-diff.ts` (42 lines, read in full — **confirmed path**, not `src/meeting/decision-diff.ts`)

**Core comparison pattern** (`decision-diff.ts` L19-42, `attachDecisionChanges`):
```typescript
export function attachDecisionChanges(
  holdings: ReadonlyArray<HoldingEvaluation>,
  prevHoldings: ReadonlyArray<HoldingEvaluation> | null,
): ReadonlyArray<HoldingEvaluation> {
  if (prevHoldings === null) {
    return holdings.map((h) => ({ ...h }));
  }
  const prevBySymbol = new Map(
    prevHoldings.map((h) => [normalizeHoldingSymbol(h.symbol), h] as const),
  );
  return holdings.map((h) => {
    const prev = prevBySymbol.get(normalizeHoldingSymbol(h.symbol));
    if (!prev) {
      return { ...h };
    }
    return {
      ...h,
      previousDecision: prev.decision,
      decisionChanged: prev.decision !== h.decision,
    };
  });
}
```
D-02 explicitly maps this "single-day, enum-equality diff" philosophy onto "adjacent recorded dates within a history timeline". Reuse: (a) strict enum `!==` comparison (never fuzzy/partial matching), (b) never-throw / no-null-crash guards, (c) doc-comment discipline citing the mirrored decision ID.

**Immutability test pattern to mirror** (`urgency-history.test.ts` L134-141):
```typescript
it("入力 history を mutate しない（イミュータブル）", () => {
  const snapshotA = makeSnapshot({ symbol: "MRNA" });
  const snapshotB = makeSnapshot({ symbol: "HII" });
  const history: UrgencyHistoryFile = { "2026-07-03": [snapshotA] };
  const originalHistory = { ...history, "2026-07-03": [...history["2026-07-03"]] };
  appendUrgencySnapshot(history, "2026-07-04", [snapshotB]);
  expect(history).toEqual(originalHistory);
});
```

---

### `src/portfolio/urgency-rollup.test.ts` (test)

**Analog:** `src/portfolio/urgency-history.test.ts` (165 lines, read in full)

**Test file structure pattern** (L1-20):
```typescript
import { describe, it, expect } from "vitest";
import {
  extractUrgencySnapshots,
  appendUrgencySnapshot,
  isValidDateKey,
  type UrgencyHistoryFile,
  type HoldingUrgencySnapshot,
} from "./urgency-history.js";
import type { HoldingEvaluation, PortfolioAnalysis } from "../meeting/types.js";

const makeSnapshot = (
  overrides: Partial<HoldingUrgencySnapshot>,
): HoldingUrgencySnapshot => ({
  symbol: "TEST",
  nameJa: "テスト株式会社",
  urgent: false,
  decision: "保持",
  ...overrides,
});
```
Use this exact "builder function with `Partial<T>` overrides + spread defaults" pattern for a `urgency-rollup.test.ts` equivalent (e.g. `makeHistory`, `makeSnapshot`, building multi-date fixtures). `describe` blocks are one per exported function, each `it(...)` cites the decision ID it verifies in its Japanese title (e.g. `"isValidDateKey (D-06)"` at L144). For `urgency-rollup.test.ts`, name blocks like `describe("computeWeeklyUrgencyRollup — window filter (D-01)")`, `describe("computeWeeklyUrgencyRollup — decision changes (D-02)")`, etc.

**Edge-case coverage checklist to replicate** (from `urgency-history.test.ts`'s full breadth — window/decision/urgent/immutable/partial per RESEARCH.md's test map):
- Format-validity edge cases (mirrors `isValidDateKey` block L144-164): malformed keys, `"__proto__"`, empty string
- Immutability check (mirrors L134-141): input `history` object/array identity untouched after call
- Multi-entry ordering (mirrors L76-85): deterministic output order (`symbol.localeCompare` ascending per RESEARCH.md Pattern 1)

---

### `src/scripts/generate-portfolio-report.ts` (modify — add renderer + 4th param)

**Analog:** same file, existing sibling `format*Html` functions

**Badge-color/semantics pattern to reuse (colors only, not the functions themselves)** (L48-65):
```typescript
/** urgent: true の銘柄に赤系「⚠ 緊急」バッジを表示する (D-16/UI-07)。false/未設定なら空文字。 */
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
UI-SPEC.md's locked markup reuses `#ef4444` (urgent) / `#f59e0b` (decision change) as **text colors** (not badge backgrounds) — a new bespoke function `formatWeeklyUrgencyRollupHtml` is required (RESEARCH.md Anti-Pattern: do not call these two functions from the rollup renderer, write new markup that reuses only the color constants).

**Empty-state / 0-item pattern to mirror** (L67-92, `formatHoldingEvaluationsHtml`):
```typescript
function formatHoldingEvaluationsHtml(
  holdings: ReadonlyArray<HoldingEvaluation>,
  resolvedHoldingNews: Record<string, ReadonlyArray<ResolvedHoldingNewsItem>>,
): string {
  if (holdings.length === 0) return "";

  const cards = holdings.map((h) => {
    ...
    return `<div class="agent-card news-card" style="border-left-color:${color};">
      <h4>${escapeHtml(h.symbol)}${h.nameJa ? ` -- ${escapeHtml(h.nameJa)}` : ""}...</h4>
      ...
    </div>`;
  }).join("\n");

  return `<h2>保有銘柄 個別評価</h2>
    ${cards}`;
}
```
The UI-SPEC's per-symbol card structure (`<div class="agent-card"><h4>{symbol} -- {nameJa}</h4>...</div>`) directly mirrors this. Note: per D-10/UI-SPEC, `formatWeeklyUrgencyRollupHtml` must NOT early-return `""` on the empty case the way `formatHoldingEvaluationsHtml` does — the rollup's 3-tier empty/partial state (UI-SPEC "Full section render logic") always renders the `<h2>` heading, unlike this analog's all-or-nothing empty behavior. Use this function for the **card-mapping/join pattern only**, not the empty-return convention.

**Signature + backward-compat default-param pattern** (L102-106):
```typescript
export function generatePortfolioReportHtml(
  result: MeetingResult,
  portfolioAnalysis: PortfolioAnalysis | null,
  resolvedHoldingNews: Record<string, ReadonlyArray<ResolvedHoldingNewsItem>> = {},
): string {
```
D-12 requires adding a 4th parameter using this exact convention:
```typescript
export function generatePortfolioReportHtml(
  result: MeetingResult,
  portfolioAnalysis: PortfolioAnalysis | null,
  resolvedHoldingNews: Record<string, ReadonlyArray<ResolvedHoldingNewsItem>> = {},
  urgencyHistory: UrgencyHistoryFile = {},
): string {
```
Requires new import: `import type { UrgencyHistoryFile } from "../portfolio/urgency-history.js";` and `import { computeWeeklyUrgencyRollup } from "../portfolio/urgency-rollup.js";`.

**Null-branch pitfall (verified directly, L110-129):**
```typescript
if (portfolioAnalysis === null) {
  return `<!DOCTYPE html>
...
    <div class="agent-card">
      <p>本日のポートフォリオ分析は生成されませんでした。</p>
    </div>
  </div>
</body>
</html>`;
}

const overallCommentHtml = formatOverallCommentHtml(portfolioAnalysis.overallComment);
const holdingEvaluationsHtml = formatHoldingEvaluationsHtml(portfolioAnalysis.holdings, resolvedHoldingNews);
const rebalanceActionsHtml = formatRebalanceActionsHtml(portfolioAnalysis.rebalanceActions);
```
Confirmed: this null branch currently computes and renders **none** of the other sections. RESEARCH.md Pitfall 4 / UI-SPEC's "Open question" flags this explicitly — planner must decide whether `weeklyRollupHtml` is computed once (before the null check, since its only dependency is `urgencyHistory` + `result.date`, both available regardless of `portfolioAnalysis`) and inserted into **both** branches. RESEARCH.md's recommendation (adopted in UI-SPEC as the default expectation) is yes — render in both.

**Template composition insertion point (D-08, verified L131-149):**
```typescript
const overallCommentHtml = formatOverallCommentHtml(portfolioAnalysis.overallComment);
const holdingEvaluationsHtml = formatHoldingEvaluationsHtml(portfolioAnalysis.holdings, resolvedHoldingNews);
const rebalanceActionsHtml = formatRebalanceActionsHtml(portfolioAnalysis.rebalanceActions);

return `<!DOCTYPE html>
...
    ${overallCommentHtml}
    ${holdingEvaluationsHtml}
    ${rebalanceActionsHtml}
  </div>
</body>
</html>`;
```
New line inserted between `overallCommentHtml` and `holdingEvaluationsHtml`:
```typescript
const weeklyRollupHtml = formatWeeklyUrgencyRollupHtml(computeWeeklyUrgencyRollup(urgencyHistory, result.date));
// ...
    ${overallCommentHtml}
    ${weeklyRollupHtml}
    ${holdingEvaluationsHtml}
```

**Escaping discipline (every dynamic string, verified pattern throughout file, e.g. L83-84):**
```typescript
<h4>${escapeHtml(h.symbol)}${h.nameJa ? ` -- ${escapeHtml(h.nameJa)}` : ""}...</h4>
<p>${escapeHtml(h.rationale)}</p>
```
Apply identically to `symbol`, `nameJa`, `from`/`to` decision strings in the new renderer (D-07/UI-SPEC "Escaping" section).

**Date short-format helper — new, NOT an existing analog (must NOT reuse `formatPublishedAtJst`):**
`report-utils.ts` L13-24:
```typescript
export function formatPublishedAtJst(publishedAtIso: string): string {
  const d = new Date(publishedAtIso);
  return d.toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
```
Confirmed unsuitable: takes a full ISO datetime, always emits `HH:MM`, no zero-padding on month/day. Write a new local (non-exported) helper instead:
```typescript
function formatDateKeyShort(dateKey: string): string {
  return dateKey.slice(5).replace("-", "/"); // "2026-07-02" -> "07/02"
}
```

---

### `src/scripts/generate-report.ts` (modify — add loader wiring)

**Analog:** same file, existing loader batch + call site

**Import + `Promise.all` batch pattern (verified L1-14, L122-133):**
```typescript
import { loadRound1Results, loadRound2Results, loadRound3Results, loadPortfolioAnalysis, loadNewsPool, loadHoldingNews, loadPrevPortfolioAnalysis } from "./report-data-loaders.js";
...
const [webSearchResults, reevalResults, round1Results, round2Results, round3Results, portfolioAnalysis, marketData, newsPool, holdingNews, prevPortfolioAnalysis] = await Promise.all([
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
]);
```
Add `loadUrgencyHistory` to both the import list and the `Promise.all` array/destructure (10 → 11 entries).

**Call-site pattern (verified L152, exact current line):**
```typescript
const portfolioHtml = generatePortfolioReportHtml(meetingResult, enrichedPortfolioAnalysis, resolvedHoldingNews);
```
becomes:
```typescript
const portfolioHtml = generatePortfolioReportHtml(meetingResult, enrichedPortfolioAnalysis, resolvedHoldingNews, urgencyHistory);
```
Anchor date for D-01 is available in the same scope already: `meetingResult.date` (verified used at L120, L147: `const dateDir = join(DOCS_DIR, meetingResult.date);`).

**DATA_DIR const — no existing const in this file (verified: only `TMP_DIR`/`DOCS_DIR` at L13-14); reuse the exact pattern already established in `write-urgency-history.ts` L8-9:**
```typescript
const TMP_DIR = join(import.meta.dirname, "../../tmp");
const DATA_DIR = join(import.meta.dirname, "../../data");
```
(This const is more naturally added to `report-data-loaders.ts` alongside its own `TMP_DIR` — see below — but `generate-report.ts` itself needs no new `DATA_DIR` if the loader lives in `report-data-loaders.ts`, consistent with every other loader in this file living there.)

---

### `src/scripts/report-data-loaders.ts` (modify — add `loadUrgencyHistory`, implied by D-13)

**Analog:** `loadHoldingNews` (L125-133) and `loadPrevPortfolioAnalysis` (L97-105), same file

**Type-assertion (no-zod) fail-soft loader pattern, verified exact (L121-133):**
```typescript
/**
 * tmp/holding-news.json（銘柄別ID参照, Phase 19生成）を fail-soft で読み込む。
 * 欠損/パース失敗時は throw せず {} を返す (D-09: 欠損は全銘柄0件と同一扱い)。
 */
export async function loadHoldingNews(): Promise<HoldingNewsFile> {
  try {
    const raw = await readFile(join(TMP_DIR, "holding-news.json"), "utf-8");
    return JSON.parse(raw) as HoldingNewsFile;
  } catch (error) {
    console.error("Holding news load failed:", error instanceof Error ? error.message : error);
    return {};
  }
}
```
`console.warn`-severity variant (recommended by RESEARCH.md for `loadUrgencyHistory` since a missing file is an expected/first-run condition, not an error), verified exact at L92-105:
```typescript
/**
 * tmp/prev-portfolio-analysis.json（前日のポートフォリオ判断スナップショット）を fail-soft で読み込む。
 * 欠損/パース失敗は初回実行・スキップ日などの想定内エッジケースのため console.warn を使う
 * （loadPortfolioAnalysis の console.error とは severity を区別、D-15/Pitfall 7）。
 */
export async function loadPrevPortfolioAnalysis(): Promise<PortfolioAnalysis | null> {
  try {
    const raw = await readFile(join(TMP_DIR, "prev-portfolio-analysis.json"), "utf-8");
    return portfolioAnalysisSchema.parse(JSON.parse(raw) as unknown) as PortfolioAnalysis;
  } catch (error) {
    console.warn("Prev portfolio analysis load failed (D-15/Pitfall 7):", error instanceof Error ? error.message : error);
    return null;
  }
}
```
`loadUrgencyHistory` should combine these two: type-assertion (no zod, matching `loadHoldingNews`'s self-generated-artifact precedent) + `console.warn` severity (matching `loadPrevPortfolioAnalysis`'s "expected on first run" precedent). Needs a new `DATA_DIR` const in this file (currently only `TMP_DIR` exists at L8) — mirror `write-urgency-history.ts` L8-9's exact `join(import.meta.dirname, "../../data")` construction.

**Recommended concrete implementation (synthesizing the two analogs above):**
```typescript
const DATA_DIR = join(import.meta.dirname, "../../data");

export async function loadUrgencyHistory(): Promise<UrgencyHistoryFile> {
  try {
    const raw = await readFile(join(DATA_DIR, "urgency-history.json"), "utf-8");
    return JSON.parse(raw) as UrgencyHistoryFile;
  } catch (error) {
    console.warn("Urgency history load failed (expected on first run / fail-soft, HIST-03):", error instanceof Error ? error.message : error);
    return {};
  }
}
```
Requires new import: `import type { UrgencyHistoryFile } from "../portfolio/urgency-history.js";`

---

### `src/scripts/report-data-loaders.test.ts` (modify — add `describe("loadUrgencyHistory")`)

**Analog:** `describe("loadHoldingNews")` block, verified exact (L55-80):
```typescript
describe("loadHoldingNews", () => {
  it("holding-news.json を読めたら JSON.parse 結果をオブジェクトとして返す", async () => {
    const raw = JSON.stringify({ MRNA: [{ id: "n01", matchType: "ticker", score: 9 }] });
    vi.mocked(readFile).mockResolvedValueOnce(raw);
    const result = await loadHoldingNews();
    expect(result).toEqual({ MRNA: [{ id: "n01", matchType: "ticker", score: 9 }] });
  });

  it("欠損時（ENOENT）は throw せず {} を返し console.error が呼ばれる（D-09）", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(readFile).mockRejectedValueOnce(new Error("ENOENT"));
    const result = await loadHoldingNews();
    expect(result).toEqual({});
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("パース失敗時は throw せず {} を返し console.error が呼ばれる", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(readFile).mockResolvedValueOnce("not valid json{{{");
    const result = await loadHoldingNews();
    expect(result).toEqual({});
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
```
For `loadUrgencyHistory`, mirror this 3-case shape exactly, but assert `vi.spyOn(console, "warn")` (not `"error"`) per the severity choice above. Top-of-file `vi.mock` setup (verified L12-15) is already shared/global for this test file — no new mock scaffolding needed:
```typescript
vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
  readdir: vi.fn(),
}));
```

---

### `src/scripts/generate-report.test.ts` (modify — add 4th-arg backward-compat + rollup-render tests)

**Analog:** Test 38 (backward-compat), verified exact (L473-479):
```typescript
it("Test 38: generatePortfolioReportHtml は第3引数省略の2引数呼び出しでも後方互換で動作する", async () => {
  const { generatePortfolioReportHtml } = await import("./generate-portfolio-report.js");
  const html = generatePortfolioReportHtml(validMeetingResult, validPortfolioAnalysis);
  expect(html).toContain("<!DOCTYPE html>");
  expect(html).toContain("関連ニュース");
  expect(html).toContain("本日の関連ニュースなし");
});
```
New test mirrors this exact shape for the 4th param: call with only 2 args, assert HTML still renders + contains the new rollup section's Tier-1 empty-state text (`"まだ緊急フラグ・判断変更の履歴がありません（履歴は日次で蓄積されます）"` per UI-SPEC Copywriting Contract).

**Badge-presence test pattern to mirror** (Test 40, verified exact L481-490):
```typescript
it("Test 40: urgent: true の銘柄カードに赤系「⚠ 緊急」バッジが表示される (D-16/UI-07)", async () => {
  const { generatePortfolioReportHtml } = await import("./generate-portfolio-report.js");
  const analysisWithUrgent = {
    ...validPortfolioAnalysis,
    holdings: validPortfolioAnalysis.holdings.map((h, i) => (i === 0 ? { ...h, urgent: true } : h)),
  };
  const html = generatePortfolioReportHtml(validMeetingResult, analysisWithUrgent);
  expect(html).toContain("⚠ 緊急");
  expect(html).toContain("#ef4444");
});
```
New rollup-section tests should follow this "spread override + assert substring + assert color" shape, e.g. passing a 4th-arg `urgencyHistory` fixture and asserting `⚠ 緊急フラグ: 07/02, 07/04` / `判断変更: 07/03 保持 → 一部売却` / `#ef4444` / `#f59e0b` substrings, per UI-SPEC's locked copy.

**Null-portfolioAnalysis test to extend (Test 31, verified L370-380):**
```typescript
it("Test 31: portfolioAnalysis が null の場合フォールバック HTML を返す", async () => {
  const { generatePortfolioReportHtml } = await import("./generate-portfolio-report.js");
  const html = generatePortfolioReportHtml(validMeetingResult, null);
  expect(html).toContain("<!DOCTYPE html>");
  expect(html).toContain("Portfolio Report");
  expect(html).not.toContain("保有銘柄 個別評価");
  ...
});
```
If planner adopts RESEARCH.md's Pitfall-4 recommendation (render rollup in both branches), a new test must assert the rollup section (or its empty-state) **does** appear even when `portfolioAnalysis === null` — this is a new assertion, no existing analog covers it (flagged explicitly as an open decision in RESEARCH.md/UI-SPEC).

---

## Shared Patterns

### Immutability discipline (applies to `urgency-rollup.ts` + its test)
**Source:** `src/portfolio/urgency-history.ts` L47 (`return { ...history, [dateKey]: snapshots };`), `src/portfolio/decision-diff.ts` L24/34/37 (`return { ...h };` / spread-and-extend, never in-place mutation)
**Apply to:** `computeWeeklyUrgencyRollup` — never `.push()`/`.sort()` in place on input arrays; always spread/map into new arrays. Verified: every existing pure module in `src/portfolio/` follows this without exception.

### Fail-soft try/catch + severity-differentiated logging
**Source:** `src/scripts/report-data-loaders.ts` L82-133 (all 5 loaders in this file follow: `try { ...; return parsed; } catch (error) { console.{warn|error}(...); return <safe-default>; }` — never throw, never `console.log`)
**Apply to:** new `loadUrgencyHistory` in `report-data-loaders.ts`. Severity choice: `console.warn` (matches `loadPrevPortfolioAnalysis`'s "expected first-run absence" precedent, not `loadHoldingNews`'s `console.error`).

### HTML escaping — universal, no exceptions
**Source:** `src/scripts/report-utils.ts` L26-33 (`escapeHtml`)
```typescript
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
```
**Apply to:** every dynamic string in the new rollup renderer (`symbol`, `nameJa`, `from`/`to` decision enum values) — confirmed universal convention across every existing `format*Html` function in `generate-portfolio-report.ts`.

### Backward-compatible optional trailing parameter with default value
**Source:** `src/scripts/generate-portfolio-report.ts` L105 (`resolvedHoldingNews: ... = {}`), verified by Test 38
**Apply to:** `generatePortfolioReportHtml`'s new 4th param `urgencyHistory: UrgencyHistoryFile = {}`.

### Doc-comment discipline citing decision IDs
**Source:** every exported function across `urgency-history.ts`, `decision-diff.ts`, `holding-news.ts`, `write-urgency-history.ts` — Japanese doc comments that state the decision ID (`D-XX`), the purity/no-throw guarantee, and the rationale in 1-3 sentences.
**Apply to:** all new exported functions (`computeWeeklyUrgencyRollup`, `loadUrgencyHistory`, `formatWeeklyUrgencyRollupHtml` if exported for testing).

### `Object.keys`/`Object.entries`, never `for...in`, over parsed-JSON objects
**Source:** RESEARCH.md-verified precedent in `resolvePortfolioHoldingNews` (`holding-news.ts`); reinforced by `urgency-history.test.ts` L157-159's `"__proto__"` rejection test for `isValidDateKey`.
**Apply to:** `computeWeeklyUrgencyRollup`'s iteration over `Object.keys(history)`, always filtered through `isValidDateKey` first (Pitfall 2 defense).

## No Analog Found

None — every file in this phase has a strong same-file or same-directory analog. This is a low-risk, high-precedent phase; no RESEARCH.md-suggested patterns had to be used in place of a codebase analog.

## Metadata

**Analog search scope:** `src/portfolio/`, `src/scripts/` (all files read in full or via targeted non-overlapping line ranges)
**Files scanned/read directly this session:** `src/portfolio/urgency-history.ts` (full), `src/portfolio/urgency-history.test.ts` (full), `src/portfolio/decision-diff.ts` (full), `src/portfolio/holding-news.ts` (L1-40), `src/scripts/generate-portfolio-report.ts` (full, 153 lines), `src/scripts/generate-report.ts` (full, 172 lines), `src/scripts/report-data-loaders.ts` (full, 134 lines), `src/scripts/report-utils.ts` (L1-35), `src/scripts/write-urgency-history.ts` (full, 84 lines), `src/scripts/generate-report.test.ts` (L323-519, Portfolio Report describe block), `src/scripts/report-data-loaders.test.ts` (L1-85)
**Pattern extraction date:** 2026-07-04
**Line-number verification:** All line numbers cited above were confirmed by direct `Read` in this session (not trusted from RESEARCH.md claims alone) — they match RESEARCH.md's claims exactly, with the one already-known path correction (`decision-diff.ts` is under `src/portfolio/`, not `src/meeting/`).

# Phase 16: Report Generator (HTML Rendering) - Pattern Map

**Mapped:** 2026-07-02
**Files analyzed:** 5 (2 new, 3 modified)
**Analogs found:** 5 / 5

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `src/scripts/generate-news-digest.ts` (NEW) | service (pure HTML renderer) | transform (data → string) | `src/scripts/generate-portfolio-report.ts` | exact (same role: `(data \| null) => string` renderer, same null-fallback shape, same accent-color/style call) |
| `src/scripts/generate-news-digest.test.ts` (NEW) | test | transform | `src/scripts/generate-report.test.ts` (`describe("Portfolio Report", ...)` block, lines 320-380) | exact (fixture-in-file + `toContain` assertions for a `(MeetingResult\|data, X\|null) => string` generator) |
| `src/scripts/report-utils.ts` (MODIFIED — add ACCENT_VARIANTS entry) | utility/config | transform | itself, `ACCENT_VARIANTS` map (lines 1-5) | exact (additive map entry, no new pattern needed) |
| `src/meeting/types.ts` (MODIFIED — add `tickerNames?` to `CuratedArticle`) | model | CRUD (type definition) | `HoldingEvaluation` (`riskNote?: string` optional field, lines 110-116) | exact (established convention for additive-optional field on an existing readonly interface) |
| `src/meeting/schemas.ts` (MODIFIED — add `tickerNames` to `curatedArticleRawSchema`, thread through `resolveNewsCuration`) | model/service (zod schema + resolver) | transform | itself, `curatedArticleRawSchema` / `resolveNewsCuration` (lines 201-289) | exact (additive `.optional().default(...)` field on the same schema being modified) |

## Pattern Assignments

### `src/scripts/generate-news-digest.ts` (NEW — service, transform)

**Analog:** `src/scripts/generate-portfolio-report.ts` (132 lines, read in full)

**Imports pattern** (lines 1-2):
```typescript
import { escapeHtml, scoreColor, verdictColor, generateBaseStyles } from "./report-utils.js";
import type { MeetingResult, PortfolioAnalysis, HoldingEvaluation } from "../meeting/types.js";
```
For news-digest, adapt to:
```typescript
import { escapeHtml, generateBaseStyles } from "./report-utils.js";
import type { NewsCuration, CuratedArticle } from "../meeting/types.js";
```

**Color-mapping helper pattern** (lines 4-12) — mirror for `importanceColor`/badge (D-08):
```typescript
function decisionColor(decision: string): string {
  switch (decision) {
    case "保持": return "#10b981";
    case "買増": return "#3b82f6";
    case "一部売却": return "#f59e0b";
    case "全売却": return "#ef4444";
    default: return "#10b981";
  }
}
```
RESEARCH.md already provides the adapted `importanceColor`/`importanceBadgeHtml` version for this file — use that (High=#ef4444/Medium=#f59e0b/Low=#6b7280 per D-08).

**Small `format*Html` composition pattern** (lines 14-79): every section is a standalone pure function returning an HTML fragment, guarded by an early `if (x.length === 0) return "";` (e.g. `formatHoldingEvaluationsHtml` line 21-22, `formatRebalanceActionsHtml` line 40-41). News-digest's `formatMarketGroupsHtml`/`formatArticleCardHtml` should follow this same shape, but note D-06 flips the empty-guard: 0-article market groups must still render a heading + "本日の該当記事なし" message rather than returning `""` (see RESEARCH.md Pattern 2 code example, already adapted).

**Top-level export + accent color + timestamp pattern** (lines 81-83):
```typescript
export function generatePortfolioReportHtml(result: MeetingResult, portfolioAnalysis: PortfolioAnalysis | null): string {
  const styles = generateBaseStyles("#10b981");
  const timestamp = new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
  ...
```
For news-digest: `generateBaseStyles("#8b5cf6")` (D-10) — accent must first be added to `ACCENT_VARIANTS` in `report-utils.ts` (see below) or it silently falls back to `{ light: accentColor, lighter: accentColor }` (report-utils.ts line 80).

**Null-fallback full-HTML-shell pattern** (lines 87-107) — this is the exact template for D-12 (`curation === null` branch):
```typescript
  if (portfolioAnalysis === null) {
    return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Portfolio Report - ${escapeHtml(result.date)}</title>
  ${styles}
</head>
<body>
  <div class="container">
    <h1>Portfolio Report - ${escapeHtml(result.date)}</h1>
    <p class="timestamp">生成日時: ${timestamp}</p>
    <div class="agent-card">
      <p>本日のポートフォリオ分析は生成されませんでした。</p>
    </div>
    ${newCandidatesHtml}
  </div>
</body>
</html>`;
  }
```
Note this analog only has a 2-value branch (`null` / normal). Phase 16 needs a **3-value** branch (null / empty articles / normal) per RESEARCH.md Pattern 1 and D-06/D-12 — extract the shared `<!DOCTYPE html>...` shell into a small `renderShell(styles, timestamp, date, bodyHtml)` helper (as RESEARCH.md suggests) to avoid duplicating the wrapper markup three times. This is a deliberate deviation from the analog's inline-duplication style, justified because the analog only needed 2 branches.

**Normal-path composition pattern** (lines 109-131): build named `*Html` fragments, then interpolate into the same shell:
```typescript
  const overallCommentHtml = formatOverallCommentHtml(portfolioAnalysis.overallComment);
  const holdingEvaluationsHtml = formatHoldingEvaluationsHtml(portfolioAnalysis.holdings);
  const rebalanceActionsHtml = formatRebalanceActionsHtml(portfolioAnalysis.rebalanceActions);

  return `<!DOCTYPE html>
...
    ${overallCommentHtml}
    ${holdingEvaluationsHtml}
    ${rebalanceActionsHtml}
    ${newCandidatesHtml}
  </div>
</body>
</html>`;
```

**Card rendering + conditional inline style pattern** (lines 24-38) — direct model for `formatArticleCardHtml`:
```typescript
  const cards = holdings.map((h) => {
    const color = decisionColor(h.decision);
    const riskHtml = h.riskNote
      ? `<p style="color:#f59e0b;font-size:0.85rem;">リスク: ${escapeHtml(h.riskNote)}</p>`
      : "";
    return `<div class="agent-card" style="border-left-color:${color};">
      <h4>${escapeHtml(h.symbol)}${h.nameJa ? ` -- ${escapeHtml(h.nameJa)}` : ""} <span style="float:right;color:${color};font-weight:bold;">${escapeHtml(h.decision)}</span></h4>
      <p>${escapeHtml(h.rationale)}</p>
      ${riskHtml}
    </div>`;
  }).join("\n");
```
This optional-field ternary (`h.riskNote ? ... : ""`) is the exact pattern to reuse for `tickerNames` fallback (symbol-only vs "symbol 会社名").

**Error handling:** None present in this file — it is a pure function with no try/catch (I/O and error boundaries live in `generate-report.ts`, see Shared Patterns below). Do not add try/catch inside `generate-news-digest.ts`; keep it a pure function per RESEARCH.md Pattern 1/Architectural Responsibility Map.

**No `<a href>` precedent** — this is confirmed net-new (RESEARCH.md Pitfall 3/4 already flags this; no existing file in `src/scripts/` renders an anchor tag with LLM/pool-derived data). Use RESEARCH.md's Pattern 3 code example verbatim as the closest available reference since no in-repo analog exists.

---

### `src/scripts/generate-news-digest.test.ts` (NEW — test, transform)

**Analog:** `src/scripts/generate-report.test.ts`, `describe("Portfolio Report", ...)` block (lines 320-380), plus fixture style (lines 13-121)

**Inline fixture pattern** (lines 13-55, `validMeetingResult`): fixtures are plain `const` objects typed against the domain interface, defined at module top level (not per-test), reused across `it()` blocks:
```typescript
const validMeetingResult: MeetingResult = {
  date: "2026-06-24",
  generatedAt: "2026-06-24T08:00:00.000Z",
  ...
};
```
For news-digest, define an analogous `validCuration: NewsCuration` fixture with 3+ articles spanning `us`/`japan`/`global` and `high`/`medium`/`low`, plus a second fixture covering the "社名欠落" (missing `tickerNames`) case per CONTEXT.md Claude's Discretion.

**Dynamic import + assertion pattern** (lines 321-379):
```typescript
  it("Test 25: Portfolio Report に緑系アクセントカラー（#10b981）が含まれる", async () => {
    const { generatePortfolioReportHtml } = await import("./generate-portfolio-report.js");
    const html = generatePortfolioReportHtml(validMeetingResult, validPortfolioAnalysis);
    expect(html).toContain("#10b981");
  });
```
This `await import(...)` + `toContain` string-matching style (not DOM parsing) is the established convention across the whole test suite — follow it for all CURA-03/04/06/07/08/09 assertions.

**Null-fallback test pattern** (lines 365-371) — direct model for D-12's null-branch test:
```typescript
  it("Test 31: portfolioAnalysis が null の場合フォールバック HTML を返す", async () => {
    const { generatePortfolioReportHtml } = await import("./generate-portfolio-report.js");
    const html = generatePortfolioReportHtml(validMeetingResult, null);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("Portfolio Report");
    expect(html).not.toContain("保有銘柄 個別評価");
  });
```
Adapt for the 3-value branch: one test for `curation === null` asserting "生成できませんでした", one for `curation.articles.length === 0` asserting "厳選記事なし" (per RESEARCH.md Pitfall 2 — do not conflate these two assertions in one test).

**Color-badge assertion pattern** (lines 373-379):
```typescript
  it("Test 32: decision バッジに正しい色が使われる", async () => {
    const html = generatePortfolioReportHtml(validMeetingResult, validPortfolioAnalysis);
    expect(html).toContain("#10b981"); // 保持 = green
    expect(html).toContain("#3b82f6"); // 買増 = blue
    expect(html).toContain("#f59e0b"); // 一部売却 = amber
  });
```
Reuse directly for CURA-07 (`#ef4444`/`#f59e0b`/`#6b7280` importance badges, D-08).

---

### `src/scripts/report-utils.ts` (MODIFIED — utility, transform)

**Analog:** itself — `ACCENT_VARIANTS` (lines 1-5)

**Additive-entry pattern** (exact D-10 target):
```typescript
const ACCENT_VARIANTS: Record<string, { light: string; lighter: string }> = {
  "#3b82f6": { light: "#60a5fa", lighter: "#93c5fd" },
  "#f59e0b": { light: "#fbbf24", lighter: "#fcd34d" },
  "#10b981": { light: "#34d399", lighter: "#6ee7b7" },
  "#8b5cf6": { light: "#a78bfa", lighter: "#c4b5fd" }, // ADD: news-digest purple (D-10)
};
```
Fallback behavior if omitted (line 80): `ACCENT_VARIANTS[accentColor] ?? { light: accentColor, lighter: accentColor }` — so this addition is purely cosmetic-safety (adding it prevents a flat, non-graduated header/border color), not a hard requirement for the function to work. Still required per D-10.

**Test analog:** `src/scripts/report-utils.test.ts` (30 lines, read in full) — all four existing tests call `generateBaseStyles("#3b82f6")` and assert on structural CSS strings (`@media`, `overflow-x: auto`, `min-height: 44px`, `#0f0f1a`). No test currently asserts on a specific `ACCENT_VARIANTS` entry's light/lighter values — if the plan wants a regression test for the new purple entry, add one following this exact `toContain` style, e.g. `expect(generateBaseStyles("#8b5cf6")).toContain("#a78bfa")`.

---

### `src/meeting/types.ts` (MODIFIED — model, CRUD/type-definition)

**Analog:** `HoldingEvaluation` interface, optional field convention (lines 110-116):
```typescript
export interface HoldingEvaluation {
  readonly symbol: string;
  readonly nameJa: string;
  readonly decision: "保持" | "買増" | "一部売却" | "全売却";
  readonly rationale: string;
  readonly riskNote?: string;
}
```

**Target interface to modify** (lines 126-136):
```typescript
export interface CuratedArticle {
  readonly id: string;
  readonly title: string;
  readonly url: string;
  readonly source: string;
  readonly publishedAt: string; // ISO 8601, tmp/news.jsonのプールから解決済み（Date型ではない — Pitfall 3）
  readonly market: "us" | "japan" | "global";
  readonly importance: "high" | "medium" | "low";
  readonly commentary: string;
  readonly tickers: ReadonlyArray<string>;
}
```
Add per RESEARCH.md's recommended non-breaking design (D-04, Pitfall 1):
```typescript
  readonly tickerNames?: Readonly<Record<string, string>>; // symbol -> company name, additive (D-04)
```
Follow the `HoldingEvaluation.riskNote?` pattern exactly: optional readonly field appended at the end of the interface, no change to existing field types (`tickers` stays `ReadonlyArray<string>` — do NOT change its shape, this is the load-bearing constraint from RESEARCH.md Pitfall 1).

---

### `src/meeting/schemas.ts` (MODIFIED — model/service, transform)

**Analog:** itself — `curatedArticleRawSchema` + `resolveNewsCuration` (lines 201-289, read in full)

**Additive optional-field-with-default schema pattern** (lines 201-209, existing `commentary`/`tickers` fields are the direct precedent):
```typescript
const curatedArticleRawSchema = z
  .object({
    id: z.string().min(1),
    market: z.enum(["us", "japan", "global"]),
    importance: z.enum(["high", "medium", "low"]),
    commentary: z.string().optional().default(""),
    tickers: z.array(z.string()).optional().default([]),
  })
  .passthrough();
```
Add (per RESEARCH.md Code Examples, confirmed against zod v4's two-arg `z.record` requirement):
```typescript
    tickerNames: z.record(z.string(), z.string()).optional().default({}),
```

**Thread-through pattern in the resolver** (lines 267-277, `resolved.push({...})` object construction is the exact site to extend):
```typescript
    resolved.push({
      id: item.id,
      title: source.title,
      url: source.url,
      source: source.source,
      publishedAt: source.publishedAt,
      market: item.market,
      importance: item.importance,
      commentary: item.commentary,
      tickers: source.ticker ? [...new Set([source.ticker, ...item.tickers])] : item.tickers,
    });
```
Add `tickerNames: item.tickerNames,` — no merge logic needed (RESEARCH.md confirms: pool has no company-name data, so this is a pure passthrough, unlike `tickers` which does a Set-merge with the pool's single `ticker`).

**Error/graceful-degradation pattern already established in this function** (lines 252-266): every drop path uses `console.warn` + `continue`, never `throw`. No new error-handling code is needed for `tickerNames` since it's optional-with-default; zod's `.optional().default({})` guarantees no validation failure occurs from omission.

**Test analog:** `src/meeting/schemas.test.ts` (247 lines, read in full). Existing fixtures use plain `tickers: ["AAPL"]` string arrays (lines 13, 20, 27) and `makeRawArticle`/`makePoolEntry` factory-with-overrides helpers (lines 94-112). Any new `tickerNames` field must NOT require changes to these existing fixtures/assertions (e.g. `toEqual(["AAPL", "MSFT"])` at line 231 must keep passing unmodified) — this is the hard regression constraint from RESEARCH.md Pitfall 1. New tests for `tickerNames` should follow the same `makeRawArticle({ tickerNames: {...} })` override-factory style.

---

## Shared Patterns

### HTML escaping (mandatory, all interpolation sites including `href`)
**Source:** `src/scripts/report-utils.ts` lines 7-14
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
**Apply to:** every interpolated value in `generate-news-digest.ts`, including the new `href="${escapeHtml(a.url)}"` site (this codebase's first LLM/pool-derived `<a href>` — no prior precedent for escaping inside an `href` attribute specifically, but the function itself needs no changes, just consistent application per RESEARCH.md Pitfall 3).

### Dark theme + responsive CSS
**Source:** `src/scripts/report-utils.ts` `generateBaseStyles(accentColor)`, lines 79-184
**Apply to:** `generate-news-digest.ts` via `generateBaseStyles("#8b5cf6")` — do not hand-roll new CSS; `.agent-card` (lines 159-166) is the base class to extend/reuse for `.news-card` per CONTEXT.md "Reusable Assets".

### Orchestration / write-out (Phase 17 scope, reference only — do not implement in Phase 16)
**Source:** `src/scripts/generate-report.ts` lines 108-121
```typescript
  const dailyHtml = generateDailyReportHtml(meetingResult, webSearchResults, reevalResults, marketData);
  const minutesHtml = generateMeetingMinutesHtml(meetingResult, round1Results, round2Results, round3Results);
  const portfolioHtml = generatePortfolioReportHtml(meetingResult, portfolioAnalysis);

  await Promise.all([
    writeFile(join(dateDir, "daily-report.html"), dailyHtml, "utf-8"),
    writeFile(join(dateDir, "meeting-minutes.html"), minutesHtml, "utf-8"),
    writeFile(join(dateDir, "portfolio-report.html"), portfolioHtml, "utf-8"),
  ]);
```
**Apply to:** nothing in Phase 16 directly, but confirms the calling contract: Phase 17 will call `generateNewsDigestHtml(curation, date)` the same way and `writeFile` the result to `docs/{date}/news-digest.html`. This is why RESEARCH.md's Open Question recommends `generateNewsDigestHtml(curation: NewsCuration | null, date: string): string` — the caller already has `meetingResult.date` in hand at this exact call site, so passing it as a second argument costs nothing.

### Test authoring convention
**Source:** `src/scripts/generate-report.test.ts` (whole-file style) + `src/meeting/schemas.test.ts` (whole-file style)
**Apply to:** both new test files. Conventions confirmed: (1) fixtures as top-level `const` typed against domain interfaces, (2) `await import("./module.js")` dynamic import inside each `it()` (not top-level static import) for the `.ts`-generator test files, (3) string-`toContain` assertions rather than DOM/HTML parsing, (4) numbered test names (`"Test N: ..."`) — Phase 16 tests may or may not need to continue the global numbering scheme; follow whatever the existing file's next-number sequence implies if the plan chooses to preserve it, otherwise descriptive Japanese names alone (as in `schemas.test.ts`) are equally acceptable within this codebase.

## No Analog Found

None. All 5 files have a strong, directly-applicable analog already identified above (this phase is explicitly scoped by CONTEXT.md/RESEARCH.md as a near-total mirror of `generate-portfolio-report.ts` plus additive schema/type changes to already-existing Phase 15 files).

The only sub-pattern with **no in-repo precedent** is rendering an `<a href>` tag from pool/LLM-derived data (D-01) — flagged above under `generate-news-digest.ts`. RESEARCH.md's Pattern 3 code example (Architecture Patterns section, `.planning/phases/16-report-generator-html-rendering/16-RESEARCH.md` lines 229-251) is the best available reference for this sub-pattern since no codebase file does it yet; treat it as the analog for that specific slice only.

## Metadata

**Analog search scope:** `src/scripts/` (all `generate-*.ts` and `report-*.ts` files), `src/meeting/` (`types.ts`, `schemas.ts`, `schemas.test.ts`)
**Files scanned:** `generate-portfolio-report.ts`, `report-utils.ts`, `report-utils.test.ts`, `generate-report.ts`, `generate-report.test.ts`, `meeting/types.ts`, `meeting/schemas.ts`, `meeting/schemas.test.ts`, `update-index.ts` (grep only, confirmed no in-page nav pattern per D-11)
**Pattern extraction date:** 2026-07-02

---
*Phase: 16-Report Generator (HTML Rendering)*
*Patterns mapped: 2026-07-02*

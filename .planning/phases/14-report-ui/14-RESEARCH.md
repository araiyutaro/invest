# Phase 14: Report UI - Research

**Researched:** 2026-07-01
**Domain:** Server-side static HTML generation (TypeScript template literals), inline SVG chart generation, mobile-responsive CSS — no client framework, no bundler
**Confidence:** HIGH

## Summary

This phase has no new external dependencies and no client-side JavaScript runtime. It is 100%
server-side string generation: TypeScript template literals in `src/scripts/generate-*.ts` and
`src/scripts/update-index.ts` build HTML/SVG strings that are written to static files under
`docs/`. All research below is scoped to reading the existing codebase precisely (function
signatures, data shapes, pipeline ordering) rather than evaluating third-party libraries, because
D-04 explicitly forbids external chart libraries.

Two findings are load-bearing for planning and were not fully specified in CONTEXT.md /
UI-SPEC.md:

1. **`docs/index.html` is currently a flat, incrementally-appended list, not month-grouped.**
   `update-index.ts` inserts one `<li>` per date directly after a `<!-- REPORT_ENTRIES -->`
   marker via string replace. There are 74 existing `<li class="report-item">` entries spanning
   March–July 2026 already baked into the file. Implementing D-01/D-02 (hero + month
   `<details>` accordions) is **not** a CSS-only change — it requires replacing the incremental
   marker-insert algorithm with either (a) a full regeneration of the entries block from a parsed
   list of existing entries + the new one, grouped by year-month, or (b) a smarter insertion that
   locates/creates the correct month's `<details>` block. Full regeneration (a) is simpler and
   less error-prone given entries already exist in mixed formats (see finding 2).

2. **Existing entries have inconsistent link sets.** Entries before ~2026-06-24 have only 2 links
   (Daily Report, Meeting Minutes — no Portfolio Report existed yet); newer entries have 3. Any
   regeneration/parsing logic must preserve each date's actual link set rather than assuming 3
   links per entry, or it will fabricate broken links to non-existent files.

3. **Chart data (`sectors[]`, VIX time series) does not currently reach `generateDailyReportHtml`.**
   `MeetingResult.marketOverview.keyIndices` only has `{name, changePercent}` — no sector data, no
   VIX history. The raw `tmp/market.json` (which has `sectors[]` and will gain `vixHistory[]`)
   is never read by `generate-report.ts`. It must be loaded there (pattern-matching the existing
   `loadWebSearchResults`/`loadReevalResults` loaders) and threaded into
   `generateDailyReportHtml(result, webSearchResults, reevalResults, marketData)`.

**Primary recommendation:** Implement charts as pure functions (`renderSectorBarChart(sectors)`,
`renderVixLineChart(vixHistory)`) returning SVG strings in a new module (e.g.
`src/scripts/report-charts.ts`), reuse `escapeHtml` from `report-utils.ts` for all interpolated
text, add `fetchVixHistory()` to `src/data/market.ts` using the already-installed
`yahoo-finance2@3.13.2` `chart()` API (verified in `node_modules`, not `historical()` which is
deprecated), and rewrite `update-index.ts`'s `updateIndexHtml` to parse+regroup all existing
entries rather than doing a marker string-insert.

## User Constraints (from CONTEXT.md)

<user_constraints>

### Locked Decisions

**index.html リデザイン (UI-01)**
- **D-01:** 最新レポートをヒーローセクションとして大きく表示し、過去のレポートは月別のアコーディオン（`<details>/<summary>`）でグループ化する。JS不要のCSS/HTMLのみ実装
- **D-02:** 最新月のアコーディオンはデフォルトで展開（`open` 属性）、それ以前の月は折りたたみ状態にする
- **D-03:** 既存のBloomberg風ダークテーマ（`#0f0f1a` 背景、`#3b82f6` アクセント）を維持しながらモダンなデザインに刷新する

**チャート実装 (UI-02)**
- **D-04:** インラインSVG生成方式を採用。generate-report.ts（または generate-daily-report.ts）がデータからSVGタグを直接生成してHTMLに埋め込む。外部ライブラリ不要、オフライン表示可能
- **D-05:** セクターパフォーマンスチャートは横バーチャート形式。プラスが緑系（`#10b981`）、マイナスが赤系（`#ef4444`）。market.json の sectors データ（11セクター分の changePercent）を使用
- **D-06:** VIX推移チャートは折れ線グラフ形式。yahoo-finance2 の chart() API で過去30日分の ^VIX データを取得し、collect-data.ts の market.json に `vixHistory` フィールドとして追加

**VIXデータ取得 (UI-02)**
- **D-07:** collect-data.ts に VIX 履歴取得を追加。yahoo-finance2 の `chart("^VIX", { period1: "30d ago" })` 相当で過去30日分の日次終値を取得
- **D-08:** 取得したVIXデータは market.json の `vixHistory: [{date, close}]` 形式で保存

**モバイルレスポンシブ (UI-01)**
- **D-09:** 全HTMLファイル（index.html, daily-report, meeting-minutes, portfolio-report, portfolio.html）にレスポンシブCSSを適用
- **D-10:** 375px幅（iPhone SE相当）をブレークポイントとして、テーブルの横スクロール防止、フォントサイズ調整、ボタンのタップ領域拡大を行う
- **D-11:** `@media (max-width: 768px)` でカラム幅・パディング・フォントサイズを調整する

### Claude's Discretion
- SVGチャートの具体的なサイズ・レイアウト・アニメーションの有無は実装時に判断
- index.html のヒーローセクションの具体的なデザイン要素（アイコン、サマリー情報等）は実装時に判断
- レスポンシブCSS の具体的なブレークポイント値とスタイル調整の詳細は実装時に判断

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope

### UI Design Contract highlights (from 14-UI-SPEC.md, status: approved, checker sign-off pending)
- Tool: none (static HTML + inline `<style>`); no shadcn, no component library, no icon library
- Font (existing, preserved): `'Helvetica Neue', Arial, 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', Meiryo, sans-serif`
- New-element spacing scale: xs 4px / sm 8px / md 16px / lg 24px / xl 32px (8-pt grid) — existing report body content keeps its current rem-based spacing, do not retrofit
- Tap target minimum: 44px height for interactive elements at ≤768px
- New-element typography: Body 16px/400/1.7, Label 13px/400/1.4, Heading 20px/700/1.3, Display 28px/700/1.2 (only 2 weights total: 400 and 700). Mobile ≤768px: Display→22px, Heading→18px
- Color: dominant `#0f0f1a`, secondary `#1e1e2e`/`#1a1a28`/`#2a2a3e`, accent `#3b82f6` (index.html/daily report scope), positive `#10b981`, negative `#ef4444`, new threshold-marker gray `#6b7280` dashed (VIX 20/30 lines only — not accent, not semantic pos/neg)
- Accordion summary label format: `{YYYY年M月} ({N}件)` e.g. "2026年7月 (3件)"
- Chart empty/unavailable state: heading "データ取得エラー", body "{VIX推移 / セクターパフォーマンス}データを取得できませんでした。次回のレポート生成をお待ちください。" — no retry action (static batch site)
- Sector chart: sort descending by changePercent, bar height 24px, gap 8px, label 13px/400 color `#e0e0e0`, full-width responsive (no fixed px bar width)
- VIX chart: stroke `#3b82f6` width 2px, dots 3px radius same color, threshold lines dashed `#6b7280` at y=20/y=30 with 13px/400 gray labels, axis labels 13px/400 `#888`, `viewBox`-based SVG (e.g. `viewBox="0 0 600 200"`), no fixed pixel width on `<svg>` — only on `viewBox`, `width:100%` for responsive reflow
- Mobile responsive: `@media (max-width: 768px)` body padding 2rem→1rem, `.container` max-width→100%; tables at 375px: `overflow-x:auto` OR stacked `display:block` (implementer's choice); all interactive elements ≥44px tap target at ≤768px

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UI-01 | index.htmlがモダンなデザインに刷新され、モバイルレスポンシブで閲覧できる | Existing marker-insert architecture in `update-index.ts` documented (finding 1/2 above); regeneration algorithm and month-grouping code example provided; existing theme tokens (`report-utils.ts`) documented for consistency; mobile breakpoint patterns provided for all 5 HTML surfaces |
| UI-02 | Daily ReportにセクターパフォーマンスやVIX推移のインラインチャートが表示される | `market.json` data shape confirmed (`sectors[]` with 11 ETFs); `yahoo-finance2` `chart()` API verified against installed `node_modules` types (period1 type constraint corrects CONTEXT.md's `"30d ago"` example); data-plumbing gap from `market.json` → `generateDailyReportHtml` identified with fix; SVG bar/line chart code examples provided matching UI-SPEC contract exactly |

</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| VIX history fetch | API/Backend (build-time script) | — | `collect-data.ts` runs as a Node/TS script during the daily pipeline; there is no runtime server. `src/data/market.ts` owns all Yahoo Finance calls |
| Sector performance data | API/Backend (build-time script) | — | Already collected in `src/data/market.ts::fetchSectorPerformance`; no change needed to data source, only to consumption |
| SVG chart rendering | API/Backend (build-time script) | — | Server-generates static SVG markup at report-generation time (`generate-daily-report.ts`); zero client JS. This is a "static/CDN" artifact once written, but the *generation* responsibility is backend/build-time |
| index.html hero + accordion structure | API/Backend (build-time script) | — | `update-index.ts` (a Node/TS script, not a browser) owns all mutation of `docs/index.html`; the accordion's open/close interactivity is native `<details>` (Browser tier, zero JS) but the *markup generation* is backend |
| Mobile responsive CSS | Browser (rendering) / Backend (authoring) | — | CSS is authored in `report-utils.ts` template strings (backend) but interpreted entirely by the browser at view time; no server-side responsive logic needed |
| Static HTML/asset delivery | CDN/Static (GitHub Pages) | — | `docs/` is served as-is by GitHub Pages; no server round-trip, no CDN transform step |

**Note:** This project has no "frontend server" or "API" tier in the conventional sense — the
entire "backend" is a set of Node scripts that run once per day via `launchd` and write static
files. Do not introduce a runtime server, client bundler, or SPA framework; that would contradict
D-04 and the UI-SPEC's `Tool: none` gate.

## Standard Stack

### Core
No new libraries. All chart/HTML/CSS generation uses:

| Library | Version | Purpose | Why Standard (for this project) |
|---------|---------|---------|--------------|
| `yahoo-finance2` | `3.13.2` [VERIFIED: package.json/node_modules] | VIX historical time-series via `.chart()` | Already the project's sole market-data source (`new YahooFinance()` instantiation pattern, per project memory) |
| TypeScript template literals | n/a (native) | HTML/SVG string generation | Established pattern in `generate-daily-report.ts`, `report-utils.ts` — no templating engine (no EJS/Handlebars) is used anywhere in the codebase [VERIFIED: codebase grep] |
| Native `<svg>` markup | n/a (browser standard) | Inline chart rendering | Renders offline, no JS execution required, satisfies D-04 |

### Supporting
None required. `zod` (already a dependency, `^4.3.6`) MAY optionally be used to validate the new
`vixHistory` shape if `report-data-loaders.ts`/`schemas.ts` pattern is extended, but this is
discretionary — the existing `MeetingResult` schema validation (`validateMeetingResult`) does not
cover `market.json`, and `market.json` is currently consumed without schema validation anywhere in
the codebase [VERIFIED: codebase grep — no `market.schema` file exists].

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Inline SVG (chosen, D-04) | Client-side chart lib (Chart.js, D3, ApexCharts) | Rejected by explicit decision D-04 — would require a CDN `<script>` tag or npm bundling step, contradicting "no external library, offline-viewable" requirement and the UI-SPEC's `Tool: none` registry gate |
| Full regeneration of index.html entries block (recommended) | Incremental marker-insert into nested `<details>` (keep current algorithm, patch to find/insert into month group) | Incremental insert is more surgical but must handle: creating a brand-new month accordion, re-opening/closing `open` attributes when a new latest month appears, and it cannot self-heal if the file was ever hand-edited. Full regen from a stable in-memory model (or re-parsed existing entries) is simpler to test and idempotent |
| `yahoo-finance2 chart()` (recommended) | `yahoo-finance2 historicalData()` / legacy `historical()` | `historical()` is deprecated in yahoo-finance2 v3+ in favor of `chart()` per the module's own JSDoc (`@see historical` cross-reference exists but `chart` is the documented primary API) [CITED: node_modules/yahoo-finance2 esm/src/modules/chart.d.ts JSDoc header: "It's the primary source for building charts"] |

**Installation:** None. No `npm install` required for this phase.

**Version verification:** `yahoo-finance2` confirmed at `3.13.2` via `package.json` and
`node_modules/yahoo-finance2/package.json` — already installed, no registry check needed since no
new package is added.

## Package Legitimacy Audit

**Not applicable — this phase installs zero external packages.** All work uses already-installed
dependencies (`yahoo-finance2`, `zod` optionally) and native browser/Node APIs (SVG, `<details>`,
CSS media queries). No `slopcheck` run performed because there is nothing to audit.

**Packages removed due to slopcheck [SLOP] verdict:** none (no packages evaluated)
**Packages flagged as suspicious [SUS]:** none (no packages evaluated)

## Architecture Patterns

### System Architecture Diagram

```
launchd (daily 8AM)
  └─ scripts/run.sh
       ├─ [checksum] record sha256 of docs/index.html, docs/portfolio.html
       ├─ claude --dangerously-skip-permissions -p "/invest"  (agentic pipeline)
       │    ├─ collect-data.ts
       │    │    ├─ fetchAllMarketData() ──> tmp/market.json { indices[], sectors[], vixHistory[] }  <-- NEW FIELD (D-08)
       │    │    │     └─ fetchVixHistory() ──> yahooFinance.chart("^VIX", {period1: <30d ago Date>}) <-- NEW FN (D-06/D-07)
       │    │    ├─ news collection (unaffected)
       │    │    └─ portfolio collection (unaffected)
       │    ├─ 5 analysts + moderator meeting ──> tmp/meeting-result.json (unaffected)
       │    ├─ generate-report.ts (main)
       │    │    ├─ reads tmp/meeting-result.json, tmp/websearch/*, tmp/reeval/*
       │    │    ├─ NEW: reads tmp/market.json ──> { sectors, vixHistory }
       │    │    ├─ generateDailyReportHtml(result, webSearch, reeval, marketData) <-- NEW PARAM
       │    │    │     └─ inserts renderSectorBarChart(sectors) + renderVixLineChart(vixHistory) SVG
       │    │    ├─ generateMeetingMinutesHtml(...)  (mobile CSS only, no chart)
       │    │    ├─ generatePortfolioReportHtml(...) (mobile CSS only, no chart)
       │    │    └─ writes docs/{date}/{daily-report,meeting-minutes,portfolio-report}.html
       │    └─ update-index.ts
       │         ├─ updateIndexHtml(date) ──> REWRITTEN: parse existing entries + hero + month accordions
       │         │     └─ writes docs/index.html (hero + <details> per YYYY-MM, D-01/D-02)
       │         └─ updatePortfolioHtml(date) ──> mobile CSS only, existing marker-insert logic OK to keep (no accordion requirement per CONTEXT.md — only index.html gets D-01/D-02 hero+accordion; portfolio.html only needs D-09 responsive CSS)
       ├─ [checksum] verify docs/index.html, docs/portfolio.html vs pre-run hashes; git checkout -- <file> if mismatched with HEAD (protects against un-committed stray edits — see OPS-02 pitfall below)
       └─ git commit + push (inside the agentic session, per project memory "auto git push for GitHub Pages")
```

### Recommended Project Structure
```
src/scripts/
├── report-utils.ts        # EXTEND: generateBaseStyles() gets new responsive media-query block; shared chart color helpers (barColor, etc.) can live here or in report-charts.ts
├── report-charts.ts        # NEW: renderSectorBarChart(sectors), renderVixLineChart(vixHistory) — pure SVG string functions
├── generate-daily-report.ts  # EXTEND: accept marketData param, call report-charts.ts, insert chart sections
├── generate-report.ts      # EXTEND: load tmp/market.json, pass to generateDailyReportHtml
├── update-index.ts         # REWRITE updateIndexHtml(): parse existing entries, group by month, render hero + accordions
└── report-data-loaders.ts  # OPTIONAL: add loadMarketData() following existing loadRound1Results() pattern

src/data/
└── market.ts               # EXTEND: add fetchVixHistory(), include in fetchAllMarketData() return
```

### Pattern 1: SVG string generation as pure functions

**What:** Chart rendering is a pure function `(data) => string` returning a `<svg>...</svg>`
fragment, matching the existing `formatXxxHtml(result)` pattern already used throughout
`generate-daily-report.ts`.

**When to use:** For both the sector bar chart and VIX line chart.

**Example (sector bar chart, matches UI-SPEC exactly):**
```typescript
// New file: src/scripts/report-charts.ts
import { escapeHtml } from "./report-utils.js";

export interface SectorDatum {
  readonly sector: string;
  readonly changePercent: number;
}

export function renderSectorBarChart(sectors: ReadonlyArray<SectorDatum>): string {
  if (sectors.length === 0) {
    return `<div class="chart-empty">
      <p><strong>データ取得エラー</strong></p>
      <p>セクターパフォーマンスデータを取得できませんでした。次回のレポート生成をお待ちください。</p>
    </div>`;
  }

  const sorted = [...sectors].sort((a, b) => b.changePercent - a.changePercent);
  const maxAbs = Math.max(...sorted.map((s) => Math.abs(s.changePercent)), 1);
  const barHeight = 24;
  const gap = 8;
  const rowHeight = barHeight + gap;
  const svgHeight = sorted.length * rowHeight;
  const chartWidth = 400; // viewBox unit; scales via width:100%
  const labelWidth = 140;
  const barAreaWidth = chartWidth - labelWidth;
  const centerX = labelWidth + barAreaWidth / 2;

  const bars = sorted.map((s, i) => {
    const y = i * rowHeight;
    const barWidth = (Math.abs(s.changePercent) / maxAbs) * (barAreaWidth / 2 - 4);
    const color = s.changePercent >= 0 ? "#10b981" : "#ef4444";
    const x = s.changePercent >= 0 ? centerX : centerX - barWidth;
    const sign = s.changePercent >= 0 ? "+" : "";
    return `
      <text x="${labelWidth - 8}" y="${y + barHeight / 2 + 4}" font-size="13" fill="#e0e0e0" text-anchor="end">${escapeHtml(s.sector)}</text>
      <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="${color}" rx="2"/>
      <text x="${s.changePercent >= 0 ? x + barWidth + 4 : x - 4}" y="${y + barHeight / 2 + 4}" font-size="13" fill="#e0e0e0" text-anchor="${s.changePercent >= 0 ? "start" : "end"}">${sign}${s.changePercent.toFixed(2)}%</text>
    `;
  }).join("");

  return `<svg viewBox="0 0 ${chartWidth} ${svgHeight}" width="100%" role="img" aria-label="セクターパフォーマンス">
    <line x1="${centerX}" y1="0" x2="${centerX}" y2="${svgHeight}" stroke="#333" stroke-width="1"/>
    ${bars}
  </svg>`;
}
```

**Example (VIX line chart, matches UI-SPEC exactly — viewBox, threshold lines, dots):**
```typescript
export interface VixDatum {
  readonly date: string; // YYYY-MM-DD
  readonly close: number;
}

export function renderVixLineChart(history: ReadonlyArray<VixDatum>): string {
  if (history.length === 0) {
    return `<div class="chart-empty">
      <p><strong>データ取得エラー</strong></p>
      <p>VIX推移データを取得できませんでした。次回のレポート生成をお待ちください。</p>
    </div>`;
  }

  const width = 600;
  const height = 200;
  const padding = { top: 10, right: 40, bottom: 20, left: 10 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  const values = history.map((h) => h.close);
  const minV = Math.min(...values, 15); // ensure 20/30 thresholds stay visible
  const maxV = Math.max(...values, 35);
  const yFor = (v: number) => padding.top + plotH - ((v - minV) / (maxV - minV)) * plotH;
  const xFor = (i: number) => padding.left + (i / (history.length - 1 || 1)) * plotW;

  const points = history.map((h, i) => `${xFor(i)},${yFor(h.close)}`).join(" ");
  const dots = history.map((h, i) =>
    `<circle cx="${xFor(i)}" cy="${yFor(h.close)}" r="3" fill="#3b82f6"/>`,
  ).join("");

  const thresholdLine = (level: number) => `
    <line x1="${padding.left}" y1="${yFor(level)}" x2="${width - padding.right}" y2="${yFor(level)}"
          stroke="#6b7280" stroke-width="1" stroke-dasharray="4,4"/>
    <text x="${width - padding.right + 4}" y="${yFor(level) + 4}" font-size="13" fill="#6b7280">${level}</text>
  `;

  return `<svg viewBox="0 0 ${width} ${height}" width="100%" role="img" aria-label="VIX推移">
    ${thresholdLine(20)}
    ${thresholdLine(30)}
    <polyline points="${points}" fill="none" stroke="#3b82f6" stroke-width="2"/>
    ${dots}
    <text x="${padding.left}" y="${height - 4}" font-size="13" fill="#888">${escapeHtml(history[0]?.date ?? "")}</text>
    <text x="${width - padding.right}" y="${height - 4}" font-size="13" fill="#888" text-anchor="end">${escapeHtml(history[history.length - 1]?.date ?? "")}</text>
  </svg>`;
}
```

**Always escape data-derived text** (sector names, dates) with `escapeHtml` even though the
current source is a trusted API (Yahoo Finance) — consistent with the codebase's existing
practice of escaping all interpolated strings in every `formatXxxHtml` function.

### Pattern 2: Month-grouped accordion regeneration (index.html)

**What:** Replace the current single-marker string insert with a two-step process: (1) parse all
existing `<li class="report-item">` blocks out of the current `docs/index.html` (or maintain a
running list — see Open Questions), (2) group by `YYYY-MM`, sort months descending, render the
newest entry as the hero, and render one `<details>` per month (latest `open`, rest closed).

**When to use:** `update-index.ts::updateIndexHtml()`.

**Example:**
```typescript
interface ReportEntry {
  readonly date: string; // YYYY-MM-DD
  readonly links: ReadonlyArray<{ label: string; href: string }>;
}

// Regex-parse existing entries to preserve their actual (possibly 2-link) href sets.
function parseExistingEntries(html: string): ReportEntry[] {
  const entries: ReportEntry[] = [];
  const itemRe = /<li class="report-item">\s*<div class="report-date">([\d-]+)<\/div>\s*<div class="report-links">([\s\S]*?)<\/div>\s*<\/li>/g;
  const linkRe = /<a href="([^"]+)">([^<]+)<\/a>/g;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(html))) {
    const [, date, linksHtml] = m;
    const links: { label: string; href: string }[] = [];
    let lm: RegExpExecArray | null;
    while ((lm = linkRe.exec(linksHtml))) links.push({ href: lm[1], label: lm[2] });
    entries.push({ date, links });
  }
  return entries;
}

function groupByMonth(entries: ReportEntry[]): Map<string, ReportEntry[]> {
  const groups = new Map<string, ReportEntry[]>();
  for (const e of entries) {
    const month = e.date.slice(0, 7); // YYYY-MM
    if (!groups.has(month)) groups.set(month, []);
    groups.get(month)!.push(e);
  }
  return groups;
}

function renderAccordion(groups: Map<string, ReportEntry[]>): string {
  const months = [...groups.keys()].sort().reverse();
  return months.map((month, i) => {
    const [y, mo] = month.split("-");
    const items = groups.get(month)!;
    const itemsHtml = items.map((e) => `<li class="report-item">
        <div class="report-date">${e.date}</div>
        <div class="report-links">${e.links.map((l) => `<a href="${l.href}">${l.label}</a>`).join("\n")}</div>
      </li>`).join("\n");
    return `<details class="month-group"${i === 0 ? " open" : ""}>
      <summary>${y}年${Number(mo)}月 (${items.length}件)</summary>
      <ul class="report-list">${itemsHtml}</ul>
    </details>`;
  }).join("\n");
}
```

**Ordering note:** existing entries are already sorted descending (newest first) inside the raw
HTML, but `groupByMonth` + `months.sort().reverse()` does not guarantee within-month order is
preserved from parse order — explicitly sort `items` within each month by `date` descending too,
since dates can arrive out of order if a backfill or re-run ever happens.

### Anti-Patterns to Avoid
- **Assuming all entries have 3 links:** Building a template that hardcodes Daily/Meeting
  Minutes/Portfolio Report links will silently 404 for the ~9 oldest entries (2026-03-05 through
  2026-06-23-ish) that predate the Portfolio Report generator. Always use the actual link set
  found (or looked up from `docs/{date}/`) — see Open Questions for the safer alternative.
- **Editing `docs/index.html` / `docs/portfolio.html` "by hand" during Wave testing and leaving
  the change uncommitted:** the `scripts/run.sh` checksum-and-`git checkout` safety net (OPS-02,
  Phase 13) will silently discard any uncommitted change to these two files at the end of the
  *next* pipeline run. Not a blocker for Phase 14 development, but a pitfall for manual QA (see
  Common Pitfalls).
- **Client-side JS chart libraries or `<script>` tags for charts:** explicitly forbidden by D-04
  and the UI-SPEC (`Tool: none`, "no component framework, no bundler, no npm UI dependencies").
- **Fixed pixel `width`/`height` on the `<svg>` root element:** breaks the 375px responsive
  requirement (D-10, UI-SPEC "SVG charts" row). Always use `viewBox` + `width="100%"`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Month/date grouping | Custom fiscal-calendar or locale library | Native JS `Date`/string slicing (`date.slice(0,7)`) already used elsewhere in codebase (`toLocaleString("ja-JP", {timeZone:"Asia/Tokyo"})` pattern in `generate-daily-report.ts`) | Dates in this project are always `YYYY-MM-DD` strings from `meeting-result.json`; no timezone math needed for grouping, only for the existing generation timestamp |
| SVG path/curve smoothing for the VIX line | A charting/curve library (d3-shape, etc.) | Plain `<polyline>` (straight segments between points) | UI-SPEC does not request smoothing/curves; a straight polyline is visually adequate for 30 daily points and avoids adding any dependency, consistent with D-04 |
| HTML escaping | Custom regex or a new escaping helper | Existing `escapeHtml()` in `report-utils.ts` | Already exported and used by all other generators — do not duplicate |

**Key insight:** Every "don't hand-roll" concern in a normal web app (routing, state, auth,
escaping frameworks) does not apply here because the project deliberately has zero runtime and
zero framework. The actual hand-rolling risk in this phase is date/month grouping logic and SVG
math — both are simple enough that the existing native-JS patterns in the codebase are the
correct (and only sanctioned) approach.

## Common Pitfalls

### Pitfall 1: `period1` type mismatch in `yahoo-finance2 chart()`
**What goes wrong:** CONTEXT.md's D-07 example, `chart("^VIX", { period1: "30d ago" })`, is not a
valid value for `ChartOptions.period1`, which is typed `Date | string | number` — `"30d ago"` is
not a parseable date string and will likely throw or silently misbehave.
**Why it happens:** D-07 says "相当で" (roughly equivalent), signaling this was always meant as an
approximation of intent, not literal code.
**How to avoid:** Compute an explicit `Date`: `new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)`,
or an ISO date string `YYYY-MM-DD` computed the same way. [VERIFIED: node_modules/yahoo-finance2
esm/src/modules/chart.d.ts — `ChartOptions.period1: Date | string | number`]
**Warning signs:** `chart()` throwing a validation error, or `vixHistory` ending up empty in
`market.json`.

### Pitfall 2: `chart()` default return shape includes `Date` objects, not strings
**What goes wrong:** `yahoo-finance2 chart()` (default `return: "array"`) resolves to
`ChartResultArray.quotes: Array<{ date: Date, close: number|null, ... }>`. Directly
`JSON.stringify`-ing this into `market.json` will serialize `date` as an ISO datetime string with
time component (e.g. `2026-06-01T13:30:00.000Z`), not the `YYYY-MM-DD` shape D-08 specifies
(`vixHistory: [{date, close}]`).
**Why it happens:** The raw SDK return type doesn't match the storage schema decided in D-08.
**How to avoid:** Map explicitly: `quotes.map(q => ({ date: q.date.toISOString().slice(0,10), close: q.close ?? 0 }))`. Also filter out entries where `close === null` (can happen for the
current/incomplete trading day) or coerce to a sensible fallback — decide explicitly, don't let
`null` flow into the SVG math (`NaN` coordinates break the polyline).
**Warning signs:** VIX chart rendering with a broken/invisible line, or dates displaying with
timestamps in the SVG axis labels.

### Pitfall 3: index.html regeneration breaks OPS-02 checksum protection flow
**What goes wrong:** `scripts/run.sh` snapshots `sha256(docs/index.html)` before the pipeline
runs and, after the pipeline, `git checkout -- docs/index.html` if the working-tree hash differs
from HEAD. This is a no-op in the *intended* flow (update-index.ts writes the file, then the
pipeline's own `git commit` step commits it, so working-tree == HEAD by the time the checksum is
re-checked). If the new `updateIndexHtml()` accidentally fails to write deterministically (e.g.
non-deterministic `Map` iteration order, or a bug that leaves the file only partially rewritten)
and the commit step runs before the write settles, the checksum-restore could revert a legitimate
change, or — if the commit captures a broken intermediate state — commit broken HTML.
**Why it happens:** This is a re-entrant, git-coupled pipeline; ordering assumptions matter.
**How to avoid:** `updateIndexHtml()` must remain synchronous-in-effect (fully compute the new
HTML string, then a single `writeFile`), exactly as the current implementation does. Do not
introduce partial/streaming writes. Add a test asserting deterministic month ordering (`Map`
insertion order + explicit `.sort()`, not relying on object key iteration order for anything).
**Warning signs:** Pipeline logs showing `HTML保護: docs/index.html を復元しました` (restored)
unexpectedly on a day where a real update-index.ts change was intended.

### Pitfall 4: Missing/incomplete `sectors` or `vixHistory` at render time
**What goes wrong:** `collect-data.ts` already has a pattern of catching failures per-section
(news, portfolio) and writing an empty-array fallback rather than crashing the whole pipeline.
`fetchSectorPerformance()` can return fewer than 11 items if any ETF quote fails
(`fetchQuoteSafe` swallows errors and filters nulls). If `generateDailyReportHtml` assumes exactly
11 sectors or a non-empty `vixHistory`, a partial data day will crash report generation.
**Why it happens:** Existing `fetchQuoteSafe` design already tolerates partial failure silently;
new chart code must inherit that tolerance.
**How to avoid:** Both `renderSectorBarChart` and `renderVixLineChart` must handle `length === 0`
(UI-SPEC's explicit empty state: "データ取得エラー" heading) and gracefully degrade for partial
data (fewer than 11 sectors is fine, don't assume a fixed count).
**Warning signs:** `generate-report.test.ts` failing when mocking with `sectors: []` — write this
test case explicitly (see Validation Architecture).

### Pitfall 5: `<details open>` semantics vs. `D-02`'s "latest month expanded" requirement
**What goes wrong:** If the accordion-render function always marks `months[0]` (i.e., array index
0 after `.sort().reverse()`) as `open`, but the underlying data has zero entries for the
"current" calendar month (e.g., pipeline hasn't run yet this month, or a gap), the "latest month"
is correctly still the most recent month *with entries*, not necessarily today's calendar month.
The example in Pattern 2 already handles this correctly (opens whichever month is index 0 after
sorting existing data), but this must be preserved if the algorithm is later "simplified" to use
`new Date()` to determine "current month" instead of data-derived latest month.
**Why it happens:** Two plausible "latest" definitions (data-derived vs. wall-clock) that
disagree if there's a multi-day gap.
**How to avoid:** Always derive "latest" from the entry data itself, not `new Date()`.
**Warning signs:** An accordion for a month with zero entries appearing (or the wrong month
defaulting open) after a pipeline outage.

### Pitfall 6: Existing test mocks assume `sectors: []` shape without `vixHistory`
**What goes wrong:** `collect-data.test.ts` mocks `fetchAllMarketData` to resolve
`{ indices: [...], sectors: [] }` (no `vixHistory` key). Adding `vixHistory` as a required field
to the `market.json` writer without updating this mock will not break the *existing* assertions
(since the test doesn't currently assert on `vixHistory`), but any *new* test asserting
`vixHistory` presence in `collect-data.ts` output must extend this mock, and `market.ts`'s
`fetchAllMarketData()` return type change needs a corresponding type update everywhere it's
consumed.
**Why it happens:** Existing test file predates this phase.
**How to avoid:** When adding `fetchVixHistory()`, update `collect-data.test.ts`'s
`mockMarketData` object and any TypeScript consumers of `fetchAllMarketData()`'s return type.
**Warning signs:** TypeScript compile errors in `collect-data.test.ts` after the `market.ts`
change (missing `vixHistory` on the mock's return-type-inferred shape), or `tsc --noEmit` failures
in CI/pre-commit if one exists (none currently configured — see Validation Architecture).

## Code Examples

### Extending `market.ts` with VIX history (D-06/D-07/D-08)
```typescript
// src/data/market.ts — add alongside existing exports
export interface VixHistoryPoint {
  readonly date: string;    // YYYY-MM-DD
  readonly close: number;
}

export async function fetchVixHistory(): Promise<ReadonlyArray<VixHistoryPoint>> {
  try {
    const period1 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const result = await yahooFinance.chart("^VIX", { period1 }); // default return: "array"
    return result.quotes
      .filter((q) => q.close !== null)
      .map((q) => ({
        date: q.date.toISOString().slice(0, 10),
        close: q.close as number,
      }));
  } catch (error) {
    console.error("Failed to fetch VIX history:", error);
    return [];
  }
}

export async function fetchAllMarketData() {
  const [indices, sectors, vixHistory] = await Promise.all([
    fetchMarketIndices(),
    fetchSectorPerformance(),
    fetchVixHistory(),
  ]);

  return { indices, sectors, vixHistory } as const;
}
```
Source: pattern matches existing `fetchQuoteSafe`/`fetchMarketIndices` error-tolerant style in
the same file [VERIFIED: read from `src/data/market.ts`]. `chart()` signature and `period1` typing
[VERIFIED: `node_modules/yahoo-finance2/esm/src/modules/chart.d.ts`].

### Loading market.json in generate-report.ts (data plumbing gap fix)
```typescript
// src/scripts/generate-report.ts — add near loadWebSearchResults/loadReevalResults
interface MarketData {
  readonly sectors: ReadonlyArray<{ sector: string; symbol: string; changePercent: number }>;
  readonly vixHistory: ReadonlyArray<{ date: string; close: number }>;
}

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
This mirrors the existing `loadWebSearchResults`/`loadReevalResults` try/catch-empty-fallback
pattern already in the same file [VERIFIED: read from `src/scripts/generate-report.ts`].

### Responsive CSS addition to `generateBaseStyles` (D-09/D-10/D-11)
```typescript
// src/scripts/report-utils.ts — append inside the returned <style> block
`
  @media (max-width: 768px) {
    body { padding: 1rem; }
    .container { max-width: 100%; }
    table { display: block; overflow-x: auto; white-space: nowrap; }
    h1 { font-size: 1.4rem; }
    .report-links a, summary { min-height: 44px; display: inline-flex; align-items: center; }
  }
`
```
Rationale for `table { display:block; overflow-x:auto }`: this is the implementer's-discretion
option explicitly permitted by the UI-SPEC's Mobile Responsive Contract row for 375px tables
("Tables: wrap in `overflow-x: auto` container OR switch to stacked `display: block` row layout
— implementer's discretion"); `overflow-x: auto` on the table itself (rather than wrapping every
table call site in a new `<div>`) is the lower-diff option since `report-utils.ts` is the single
shared style source already used by all 3 report generators.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `docs/index.html` flat marker-insert list (current codebase state) | Hero + month-grouped `<details>` accordion | This phase (14) | `update-index.ts::updateIndexHtml()` requires a rewrite, not an incremental patch — plan tasks accordingly (see Architecture Patterns, Pattern 2) |
| `yahoo-finance2` `historical()` (legacy, pre-v2 API) | `chart()` (current primary API per module JSDoc) | v2+ of `yahoo-finance2` (project already on v3.13.2) | Not directly relevant to existing code (project never used `historical()`), but rules out using it for VIX history — use `chart()` |

**Deprecated/outdated:** None specific to this codebase; `yahoo-finance2 chart()` is the currently
documented primary historical-data API as of the installed v3.13.2 [CITED: module JSDoc header].

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | "10b981"/"ef4444" bar coloring convention (green=positive/red=negative) generalizes cleanly to a `changePercent === 0` edge case (no observed 0% sector in sampled `market.json`) | Code Examples (sector bar chart) | Low — `>= 0` check already handles exactly-zero as "positive" (green), consistent with existing `idx.changePercent >= 0` pattern in `generate-daily-report.ts::formatMarketOverviewHtml` [VERIFIED against existing code], so this is actually consistent, not truly assumed — included for completeness only |
| A2 | Full regeneration of `docs/index.html`'s entries block (re-parsing existing `<li>` blocks) is safer than an incremental month-aware insert | Architecture Patterns, Pattern 2 | Medium — if the planner instead chooses incremental insert, extra edge-case handling (creating new `<details>` blocks, moving `open` attribute when a new month starts) must be planned explicitly; recommend confirming this architectural choice during planning rather than research, since it is within "Claude's Discretion" per CONTEXT.md (index.html hero section design details are discretionary) |
| A3 | `portfolio.html` does NOT require the D-01/D-02 hero+accordion treatment, only D-09 responsive CSS | Architecture Patterns diagram, Pattern 2 header note | Medium — CONTEXT.md's D-01/D-02 decisions are scoped under "index.html リデザイン (UI-01)" heading specifically, and the Phase Boundary line only mentions index.html for the redesign ("index.htmlをモバイルレスポンシブ対応に刷新し...過去のレポートは月別のアコーディオン"); portfolio.html is separately listed only under "全HTMLレポート...もモバイル対応する". If this reading is wrong, portfolio.html would also need hero+accordion — confirm with user/CONTEXT.md re-read if planner is uncertain |

**If this table is empty:** N/A — see entries above. A1 is a false-positive assumption (verified,
not actually assumed) included for transparency; A2 and A3 are genuine open architectural choices
within the phase's declared "Claude's Discretion" scope, not verified facts.

## Open Questions

1. **Should `docs/index.html` entry regeneration re-parse the existing HTML, or should
   `update-index.ts` instead read the list of dated folders directly from `docs/` (via
   `readdir`) to build the entry list authoritatively?**
   - What we know: `docs/` already has 118 dated subdirectories (`ls docs | wc -l` = 118, though
     only ~74 currently appear as `<li>` entries in `index.html` — some directories may be
     missing entries, e.g. very old ones, or duplicates need checking); each dated folder's
     actual file listing (`daily-report.html`, `meeting-minutes.html`, `portfolio-report.html`
     presence) can be checked directly with `readdir`, which is a more authoritative source of
     "which links are valid for this date" than parsing old HTML.
   - What's unclear: Whether the 118 vs ~74 discrepancy indicates that `index.html` is already
     missing some entries (a pre-existing bug/gap unrelated to this phase), or whether some
     `docs/` folders are non-report artifacts.
   - Recommendation: The planner should include a task to `ls docs/` and diff against parsed
     `index.html` entries at implementation time, and prefer **reading `docs/` directory
     contents directly** (via `readdir` + checking which of the 3 report files exist per folder)
     over re-parsing old HTML — this is more robust and self-healing, and naturally fixes any
     pre-existing drift. This changes `updateIndexHtml()`'s data source but not the accordion
     rendering logic in Pattern 2.

2. **Exact viewBox dimensions and hero section content are explicitly "Claude's Discretion" per
   CONTEXT.md — no further research needed, but flagging that the code examples above use
   `viewBox="0 0 400 <dynamic>"` (sector) and `viewBox="0 0 600 200"` (VIX, matching UI-SPEC's
   example verbatim) as reasonable starting points, not mandates.**

## Environment Availability

Skipped — this phase has no new external tool/service dependencies. `yahoo-finance2` is already
installed and used; no Docker, database, or new CLI tooling is introduced. `docs/` is served via
GitHub Pages (existing, unaffected).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest `^4.0.18` [VERIFIED: package.json] |
| Config file | none found — vitest runs with zero-config defaults (no `vitest.config.ts` in repo root) [VERIFIED: file listing] |
| Quick run command | `npx vitest run src/scripts/generate-report.test.ts` (or `src/data/market.test.ts` once created) |
| Full suite command | `npm test` (→ `vitest run`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UI-02 | `renderSectorBarChart` sorts descending, colors green/red correctly, handles empty array | unit | `npx vitest run src/scripts/report-charts.test.ts -t "sector"` | ❌ Wave 0 (new file) |
| UI-02 | `renderVixLineChart` renders threshold lines at 20/30, handles empty array, uses viewBox not fixed width/height | unit | `npx vitest run src/scripts/report-charts.test.ts -t "vix"` | ❌ Wave 0 (new file) |
| UI-02 | `fetchVixHistory()` maps `chart()` quotes to `{date, close}` shape, filters null closes, catches errors→`[]` | unit | `npx vitest run src/data/market.test.ts` | ❌ Wave 0 (new file — no existing `market.test.ts`) |
| UI-02 | `generateDailyReportHtml` output includes both chart SVGs when market data present | integration | `npx vitest run src/scripts/generate-report.test.ts -t "chart"` | ⚠️ Wave 0 (extend existing file, new test cases) |
| UI-01 | `update-index.ts` groups entries by month, latest month has `open` attribute, older months don't | unit | `npx vitest run src/scripts/update-index.test.ts` | ❌ Wave 0 (new file — no existing test for this script) |
| UI-01 | Mobile CSS media query present in `generateBaseStyles()` output (`@media (max-width: 768px)`) | unit | `npx vitest run src/scripts/generate-report.test.ts -t "responsive"` | ⚠️ Wave 0 (extend existing `report-utils` describe block) |

### Sampling Rate
- **Per task commit:** targeted `npx vitest run <touched-file>.test.ts`
- **Per wave merge:** `npm test` (full suite, currently ~30 existing test cases across
  `generate-report.test.ts`, `collect-data.test.ts`, `validate-meeting.test.ts`)
- **Phase gate:** Full suite green before `/gsd-verify-work 14`

### Wave 0 Gaps
- [ ] `src/scripts/report-charts.test.ts` — new file, covers UI-02 chart rendering (sort order,
      colors, empty-state, viewBox presence)
- [ ] `src/data/market.test.ts` — new file, covers `fetchVixHistory()` mapping/error-tolerance
      (mock `yahoo-finance2` the same way `collect-data.test.ts` already does)
- [ ] `src/scripts/update-index.test.ts` — new file, covers month-grouping/accordion logic; no
      existing test infrastructure for `update-index.ts` at all currently
- [ ] Extend `src/scripts/generate-report.test.ts`'s `"Daily Report"` describe block with cases
      for market-data-present and market-data-empty scenarios
- [ ] Extend `collect-data.test.ts`'s `mockMarketData` object to include `vixHistory: []` so the
      mock stays type-consistent with the updated `fetchAllMarketData()` return shape

## Security Domain

`security_enforcement` is not set in `.planning/config.json` — treat as enabled per protocol
default.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No | Static site, no auth, no user accounts |
| V3 Session Management | No | No sessions; GitHub Pages static hosting |
| V4 Access Control | No | No access control surface; all reports are public static files |
| V5 Input Validation | Yes (narrow) | All Yahoo Finance API response data interpolated into HTML/SVG must go through the existing `escapeHtml()` before insertion — even though the API is a trusted first-party data source, this matches the codebase's existing universal-escaping convention and prevents a broken/malformed API response (e.g. a sector name containing `<` from an API glitch) from corrupting the HTML/SVG structure |
| V6 Cryptography | No | No secrets, tokens, or crypto operations introduced by this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| HTML/SVG injection via unescaped API data (sector names, dates) interpolated into template literals | Tampering | Route every interpolated string through `escapeHtml()` — already the codebase convention, must be extended to the new `report-charts.ts` module (see Code Examples — both example functions already call `escapeHtml` on sector names and date strings) |
| Unauthorized mutation of `docs/index.html`/`docs/portfolio.html` outside the sanctioned script path | Tampering | Already mitigated by existing OPS-02 checksum+`git checkout` mechanism (Phase 13) and by `.claude/commands/invest.md`'s explicit instruction that only `update-index.ts` may modify these files — Phase 14 must preserve this invariant, not bypass it with inline edits during report generation |

## Sources

### Primary (HIGH confidence)
- `node_modules/yahoo-finance2/esm/src/modules/chart.d.ts` — `chart()` signature, `ChartOptions.period1: Date | string | number`, `ChartResultArray.quotes[].date: Date`, `.close: number | null` [VERIFIED: read directly from installed package source]
- `node_modules/yahoo-finance2/package.json` — version `3.13.2` [VERIFIED]
- `/Users/arai/invest/src/data/market.ts` — existing `fetchMarketIndices`/`fetchSectorPerformance`/`fetchAllMarketData` implementation and error-tolerance pattern [VERIFIED: read]
- `/Users/arai/invest/src/scripts/report-utils.ts` — `generateBaseStyles()`, `escapeHtml()`, color tokens (`#0f0f1a`, `#1e1e2e`, `#3b82f6`, `#10b981`, `#ef4444`, `#f59e0b`) [VERIFIED: read]
- `/Users/arai/invest/src/scripts/generate-daily-report.ts`, `generate-report.ts`, `update-index.ts`, `collect-data.ts` — full pipeline data flow, `MeetingResult` consumption, `tmp/market.json` write/read points [VERIFIED: read]
- `/Users/arai/invest/docs/index.html` — actual current flat marker-insert structure, 74 `<li>` entries, inconsistent link counts across date ranges [VERIFIED: read, full file]
- `/Users/arai/invest/docs/portfolio.html` — existing style block, `#10b981` accent theme [VERIFIED: read, partial]
- `/Users/arai/invest/scripts/run.sh` — OPS-02 checksum protection mechanism and pipeline step ordering (`collect-data.ts` → agentic meeting → `generate-report.ts` → `update-index.ts` → checksum verify → git commit/push) [VERIFIED: read]
- `/Users/arai/invest/.claude/commands/invest.md` — explicit instruction forbidding direct edits to `docs/index.html`/`docs/portfolio.html` outside `update-index.ts`; pipeline step ordering confirmation (line 42 collect-data, line 1673 generate-report, line 1746 update-index) [VERIFIED: grep + read]
- `/Users/arai/invest/src/scripts/generate-report.test.ts`, `collect-data.test.ts` — existing test patterns, mocking conventions, `mockMarketData` shape lacking `vixHistory` [VERIFIED: read]
- `/Users/arai/invest/package.json` — Vitest `^4.0.18`, no test config file present [VERIFIED: read + directory listing]
- `.planning/phases/14-report-ui/14-CONTEXT.md`, `14-UI-SPEC.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md` — user decisions, UI design contract, requirement IDs [VERIFIED: read]

### Secondary (MEDIUM confidence)
None — all claims in this research were verified directly against the installed package source
or the project's own codebase; no web search was required for this phase since it involves no
external library evaluation.

### Tertiary (LOW confidence)
None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies, all claims verified against installed `node_modules` and existing `package.json`
- Architecture: HIGH — all pipeline ordering, file structures, and data shapes read directly from the actual codebase (not inferred)
- Pitfalls: HIGH — each pitfall traced to a specific, verified code location (existing mocks, existing checksum script, existing type signatures)

**Research date:** 2026-07-01
**Valid until:** 30 days (stable, self-contained codebase with no external API surface changes expected; re-verify `yahoo-finance2` version if `npm update` runs before implementation)

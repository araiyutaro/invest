# Phase 26: Weekly Urgency Rollup Display - Research

**Researched:** 2026-07-04
**Domain:** Deterministic TS aggregation + server-side HTML rendering (existing report-generation pipeline)
**Confidence:** HIGH

## Summary

Phase 26 is a pure read-and-render extension of an already-complete pipeline. Phase 25 (`src/portfolio/urgency-history.ts`, `src/scripts/write-urgency-history.ts`) persists `data/urgency-history.json` — a `Record<"YYYY-MM-DD", HoldingUrgencySnapshot[]>` — via a dedicated Step 3f before deploy. This phase adds: (1) a new pure aggregation module `src/portfolio/urgency-rollup.ts` that filters the history to a 7-calendar-day window anchored on `meetingResult.date` and derives per-symbol urgent-occurrence dates + decision-change events, (2) a new `format*Html` renderer function in `src/scripts/generate-portfolio-report.ts` inserted between `overallCommentHtml` and `holdingEvaluationsHtml`, wired through a new 4th, default-valued parameter on `generatePortfolioReportHtml`, and (3) a thin fail-soft loader added to `src/scripts/report-data-loaders.ts` + wired into `src/scripts/generate-report.ts`. No new pipeline step, no new page, no LLM calls — 100% consistent with every design decision already locked in `26-CONTEXT.md`.

I verified all canonical references against the live code. Almost everything in CONTEXT.md's `<canonical_refs>` matches the actual file exactly (line numbers included). I found one factual mismatch (a wrong file path for `attachDecisionChanges`) and two implementation risks CONTEXT.md does not resolve: (a) `formatPublishedAtJst` is unsuitable for the `MM/DD` short-date format D-07 wants (it expects a full ISO datetime and adds hour:minute, no zero-padding on month/day); (b) `generatePortfolioReportHtml`'s null-`portfolioAnalysis` early-return branch (L110-129) currently never computes `overallCommentHtml`/section HTML at all — the planner must decide explicitly whether the weekly rollup should also render on days the portfolio analysis fails (my recommendation: yes, since it strengthens the fail-soft story and the rollup's only true dependency is `urgencyHistory`, not `portfolioAnalysis`).

**Primary recommendation:** Build `computeWeeklyUrgencyRollup(history, anchorDate)` as a pure, throw-free function using pure string/UTC-timestamp date math (no local-timezone `Date` parsing of date-only keys), defensively filtering `Object.keys(history)` through the already-exported `isValidDateKey` before use (this doubles as prototype-pollution protection), and render dates with a new trivial `MM/DD` string-slice formatter rather than reusing `formatPublishedAtJst`.

## Architectural Responsibility Map

This project has no browser/client runtime — it is a build-time Node.js/TypeScript pipeline that emits static HTML consumed passively via GitHub Pages. All capabilities below live in the "backend/build-time script" tier; there is no client-tier or CDN-tier code to write.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| History persistence (`data/urgency-history.json`) | Storage (flat JSON file, git-tracked) | — | Phase 25, already complete; read-only in this phase |
| History loading (fail-soft loader) | Backend / Build-time script (`report-data-loaders.ts`) | — | Mirrors existing `loadHoldingNews`/`loadPrevPortfolioAnalysis` pattern; no I/O elsewhere |
| 7-day window aggregation | Backend / Build-time (pure business logic, `src/portfolio/`) | — | Deterministic, no I/O, no LLM — matches `decision-diff.ts`/`holding-news.ts` precedent |
| HTML section rendering | Backend / Build-time (view/template, `generate-portfolio-report.ts`) | — | Concern separation: aggregation (data) vs. rendering (view) already established in this codebase |
| Final output | Static / CDN (GitHub Pages, `docs/{date}/portfolio-report.html`) | — | No dynamic behavior after generation; output is static HTML |

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Aggregation logic**
- D-01: "直近7日" = 7-calendar-day window anchored on `meeting-result.json`'s `date` (today inclusive, back 6 days). Only history dateKeys within this window are aggregated. Missing days are not an error — use only what exists.
- D-02: Decision-change detection = compare `decision` enum across **consecutive recorded dates within the window** (not calendar-adjacent days). Mirrors `attachDecisionChanges`'s single-day-diff philosophy, mapped onto a history sequence. No LLM self-report.
- D-03: Urgent flag = per-symbol list of dates where `urgent === true` within the window. Symbols never `true` in-window do not appear in this aggregation.
- D-04: Symbol matching key = the already-normalized `symbol` as persisted by Phase 25 (`normalizeHoldingSymbol` already applied at write time) — no re-normalization needed on read.

**Display format**
- D-05: Show only symbols with movement (urgent-became-true OR decision-changed within the window) as a bullet list (no table — consistent with existing dark-theme/long-text policy). Symbols with zero movement are omitted entirely.
- D-06: Each symbol entry shows (a) urgent-flag occurrence dates (e.g. "⚠ 緊急フラグ: 07/02, 07/04") and (b) decision changes (e.g. "判断変更: 07/03 保持 → 買増"), reusing existing badge color language (red `#dc2626`-family = urgent, amber `#f59e0b` = decision change). Symbol heading format: `{symbol} -- {nameJa}`.
- D-07: Dates displayed as `MM/DD` (JST) for readability; internal aggregation keeps `YYYY-MM-DD` keys. All dynamic strings (symbol/nameJa/decision) must go through existing `escapeHtml`.

**Placement & empty/partial state**
- D-08: Section placed immediately after `overallCommentHtml`, before `holdingEvaluationsHtml`. Heading wording is planner's/executor's discretion, matching existing heading tone.
- D-09: Three-tier fallback, never an error:
  - No history file / 0 entries → "まだ緊急フラグ・判断変更の履歴がありません（履歴は日次で蓄積されます）"-style message.
  - History exists but 0 movement this week → "今週は緊急フラグ・判断変更はありませんでした"-style message.
  - <7 days of history → aggregate what exists + a "(過去N日分の履歴に基づく)"-style footnote.
- D-10: Whether the heading itself renders when history is completely empty (vs. hiding the whole section) is planner's discretion; **default is show heading + empty-state message** (surface feature existence).

**Module structure & data flow**
- D-11: New pure module `src/portfolio/urgency-rollup.ts` (no I/O, no throw, `.test.ts` co-located, mirrors `holding-news.ts`/`urgency-history.ts`). Input: `UrgencyHistoryFile` + anchor date. Output: a new result type (e.g. `WeeklyUrgencyRollup`) capturing per-symbol urgent dates + decision changes. TDD covers window filter, cross-history decision comparison, missing days, 0 movement, <7 days, immutability.
- D-12: New `format*Html` function added to `generate-portfolio-report.ts`. `generatePortfolioReportHtml` gets a **4th parameter** (e.g. `urgencyHistory: UrgencyHistoryFile = {}`, default = empty = backward compatible), mirroring the existing Test 38 backward-compat pattern used for the 3rd parameter.
- D-13: A thin loader is added in `generate-report.ts` (immediately before the `generatePortfolioReportHtml` call) that reads `data/urgency-history.json`, falling back to `{}` on missing/corrupt, following the existing `readFile` + tmp/*.json loader pattern. Zod schema vs. type-assertion is planner's discretion (existing precedent for self-generated TS artifacts is type-assertion — see Findings below).
- D-14: **Fail-soft**: any failure in history read/parse/aggregation must not block portfolio.html or the other 3 reports — the rollup section falls back to its empty state. No new pipeline step or `[STEP:*]` marker needed (this closes inside existing `generate-report.ts` execution).

### Claude's Discretion
- Exact section heading wording and exact empty-state message wording (D-08/D-09/D-10) — match existing report tone.
- Exact shape of the aggregation result type (`WeeklyUrgencyRollup` etc.) — array vs. Record, how urgent-dates and decision-changes are grouped per symbol — must retain: symbol, urgent-occurrence date list, decision-change list (date + before/after decision).
- Zod schema vs. type-assertion for the history loader (D-13).
- Whether the empty-history section shows a heading or is fully hidden (D-10) — default: show heading + empty-state message.
- Comparison basis when dates are missing inside the window for decision-change detection (D-02) — default: compare adjacent **recorded** dates, not adjacent **calendar** dates. Lock this via aggregation tests.

### Deferred Ideas (OUT OF SCOPE)
- Rollups longer than 7 days (monthly/quarterly) or historical trend graphing — fixed at 7 days for HIST-03; longer-range views are a future phase candidate.
- History pruning or a dedicated history-viewer page — Phase 25 keeps an append-only full history; this phase adds no new page.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| HIST-03 | ユーザーは portfolio.html で直近7日間の緊急フラグ・判断変更履歴のロールアップセクションを見ることができる | Verified data shape (`UrgencyHistoryFile`/`HoldingUrgencySnapshot`), verified insertion point + backward-compat signature pattern (Test 38), verified loader precedent (`loadHoldingNews`/`loadPrevPortfolioAnalysis`), designed concrete 7-day-window/decision-diff algorithm below, verified badge color/escapeHtml conventions, verified empty-state precedent (`formatHoldingEvaluationsHtml`) |

## Project Constraints (from CLAUDE.md)

- GSD commands must always use hyphens (`/gsd-execute-phase`), never colons (`/gsd:execute-phase`) — applies to all GSD skill references, including any mentioned in generated docs. Not directly relevant to code changes in this phase, but must be honored in any planner/executor prose that references GSD commands.
- No project-specific coding/testing directives beyond the global user rules (immutability, small files, TDD-first, vitest, no `console.log` in shipped code — note existing code in this repo uses `console.warn`/`console.error` for logging, not `console.log`, which is consistent with the global "no console.log" rule and should be followed for the new loader/module too).

## Standard Stack

No new libraries are required. This phase reuses the project's existing stack exclusively.

### Core (existing, reused — no install needed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| typescript | ^5.9.3 (confirmed in package.json) | Type-safe pure aggregation module | Already the project's only language |
| vitest | ^4.0.18 (confirmed in package.json) | Unit tests for `urgency-rollup.ts` + updated `generate-portfolio-report.test.ts`/`generate-report.test.ts` | Already the project's only test framework, no config file (uses vitest defaults, `*.test.ts` convention) |
| zod | ^4.3.6 (confirmed in package.json) | Optional: validating `data/urgency-history.json` shape on load | Already used for `portfolioAnalysisSchema` etc., but **not** used for other self-generated TS JSON artifacts (see Findings) |

### Supporting
None — no new supporting libraries needed.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Type-assertion loader (`JSON.parse(raw) as UrgencyHistoryFile`) | A new zod schema for `UrgencyHistoryFile` | Zod gives runtime shape safety on a file this codebase itself writes (no external/LLM input) — existing precedent (`loadHoldingNews`, and `write-urgency-history.ts`'s own `loadExistingHistory`) skips zod for exactly this kind of self-generated artifact. Adding zod here would be inconsistent with precedent without a clear benefit, since the aggregation function must already defensively survive malformed/missing keys via `isValidDateKey` filtering regardless. |

**Installation:** None required — `npm install` needs no changes for this phase.

**Version verification:**
```
$ cat package.json | grep -E '"vitest"|"typescript"|"zod"'
"typescript": "^5.9.3"
"vitest": "^4.0.18"
"zod": "^4.3.6"
```
Verified directly from `/Users/arai/invest/package.json` — no registry lookup needed since these are pre-existing devDependencies/dependencies already in use, not new installs.

## Package Legitimacy Audit

**Not applicable.** This phase introduces zero new external packages. All functionality is built from files already present in `node_modules` per the existing `package.json` (typescript, vitest, zod — all already used elsewhere in this codebase for equivalent purposes). No `npm install`, no slopcheck run needed.

## Architecture Patterns

### System Architecture Diagram

```
tmp/meeting-result.json ──┐
                          │ readFile (existing, generate-report.ts L119-120)
                          ▼
                   meetingResult.date  ──────────────────────┐  (anchor date, D-01)
                                                              │
data/urgency-history.json ──┐                                │
                             │ NEW: loadUrgencyHistory()      │
                             │ (report-data-loaders.ts,       │
                             │  fail-soft: missing/corrupt→{})│
                             ▼                                │
                     UrgencyHistoryFile                       │
                             │                                │
                             ▼                                ▼
              NEW: computeWeeklyUrgencyRollup(history, anchorDate)
                     (src/portfolio/urgency-rollup.ts, pure, no I/O, no throw)
                             │
                             │  WeeklyUrgencyRollup
                             │  { windowStart, windowEnd, daysCovered, symbols[] }
                             ▼
              NEW: formatWeeklyUrgencyRollupHtml(rollup)
                     (generate-portfolio-report.ts, escapeHtml everywhere)
                             │
                             ▼
        generatePortfolioReportHtml(result, portfolioAnalysis, resolvedHoldingNews, urgencyHistory)
                 [4th param, default {} — backward compatible]
                             │
        composes: overallCommentHtml → weeklyRollupHtml (NEW, D-08) →
                  holdingEvaluationsHtml → rebalanceActionsHtml
                             │
                             ▼
                docs/{date}/portfolio-report.html  (static output, GitHub Pages)
```

Entry point: `generate-report.ts main()`'s `Promise.all` loader batch (add `loadUrgencyHistory()` alongside the other 9 existing loaders). Processing stages: load → aggregate (pure) → render (HTML string) → compose into existing template → write file (unchanged). No branching that can throw uncaught: every new function in the chain is fail-soft by construction.

### Recommended Project Structure
```
src/
├── portfolio/
│   ├── urgency-history.ts       # Phase 25 — unchanged, reused for types
│   ├── urgency-rollup.ts        # NEW — pure aggregation (D-11)
│   └── urgency-rollup.test.ts   # NEW — TDD for aggregation
├── scripts/
│   ├── report-data-loaders.ts   # +loadUrgencyHistory (D-13)
│   ├── report-data-loaders.test.ts  # + new describe block
│   ├── generate-portfolio-report.ts # +formatWeeklyUrgencyRollupHtml, +4th param (D-12)
│   └── generate-report.ts       # +DATA_DIR const, +loader wiring (D-13)
```

### Pattern 1: Pure aggregation over a date-keyed history map
**What:** Filter `Object.keys(history)` to valid, in-window dateKeys; build a per-symbol ordered timeline from only those dates; derive urgent-dates and decision-change events from the timeline.
**When to use:** Exactly this phase's core algorithm.
**Example (verified against live types in `src/portfolio/urgency-history.ts`):**
```typescript
// src/portfolio/urgency-rollup.ts
import { isValidDateKey } from "./urgency-history.js";
import type { HoldingUrgencySnapshot, UrgencyHistoryFile } from "./urgency-history.js";

const WINDOW_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface DecisionChangeEvent {
  readonly date: string; // YYYY-MM-DD, date of the "after" state
  readonly from: HoldingUrgencySnapshot["decision"];
  readonly to: HoldingUrgencySnapshot["decision"];
}

export interface WeeklySymbolRollup {
  readonly symbol: string;
  readonly nameJa: string;
  readonly urgentDates: ReadonlyArray<string>;       // ascending YYYY-MM-DD
  readonly decisionChanges: ReadonlyArray<DecisionChangeEvent>; // ascending
}

export interface WeeklyUrgencyRollup {
  readonly windowStart: string;  // YYYY-MM-DD, anchor - 6 days
  readonly windowEnd: string;    // YYYY-MM-DD, anchor
  readonly daysCovered: number;  // distinct valid dateKeys found within window
  readonly symbols: ReadonlyArray<WeeklySymbolRollup>; // only symbols with movement (D-05)
}

// UTC-timestamp math avoids local-timezone parsing pitfalls on date-only strings (Pitfall 1 below).
function addDaysUtc(dateKey: string, days: number): string {
  const ms = Date.parse(`${dateKey}T00:00:00Z`) + days * DAY_MS;
  return new Date(ms).toISOString().slice(0, 10);
}

export function computeWeeklyUrgencyRollup(
  history: UrgencyHistoryFile,
  anchorDate: string,
): WeeklyUrgencyRollup {
  if (!isValidDateKey(anchorDate)) {
    // Garbage-in guard: never throw. Degrade to an empty rollup with anchor echoed as both bounds.
    return { windowStart: anchorDate, windowEnd: anchorDate, daysCovered: 0, symbols: [] };
  }

  const windowStart = addDaysUtc(anchorDate, -(WINDOW_DAYS - 1));
  const windowEnd = anchorDate;

  // Defensive: filter through isValidDateKey (rejects "__proto__" etc. — Pitfall 2 below),
  // then lexicographic string comparison (safe for zero-padded ISO dates).
  const matchedDates = Object.keys(history)
    .filter(isValidDateKey)
    .filter((d) => d >= windowStart && d <= windowEnd)
    .sort();

  const timelines = new Map<string, { nameJa: string; entries: Array<{ date: string; urgent: boolean; decision: HoldingUrgencySnapshot["decision"] }> }>();

  for (const date of matchedDates) {
    const snapshots = history[date];
    if (!Array.isArray(snapshots)) continue; // corrupt entry — skip, never throw
    for (const s of snapshots) {
      if (!s || typeof s.symbol !== "string") continue; // corrupt element — skip
      const timeline = timelines.get(s.symbol) ?? { nameJa: s.nameJa, entries: [] };
      timeline.entries.push({ date, urgent: s.urgent, decision: s.decision });
      timeline.nameJa = s.nameJa; // keep freshest nameJa
      timelines.set(s.symbol, timeline);
    }
  }

  const symbols: WeeklySymbolRollup[] = [];
  for (const [symbol, { nameJa, entries }] of timelines) {
    const urgentDates = entries.filter((e) => e.urgent).map((e) => e.date);
    const decisionChanges: DecisionChangeEvent[] = [];
    for (let i = 1; i < entries.length; i++) {
      if (entries[i].decision !== entries[i - 1].decision) {
        decisionChanges.push({ date: entries[i].date, from: entries[i - 1].decision, to: entries[i].decision });
      }
    }
    if (urgentDates.length > 0 || decisionChanges.length > 0) {
      symbols.push({ symbol, nameJa, urgentDates, decisionChanges });
    }
  }

  return {
    windowStart,
    windowEnd,
    daysCovered: matchedDates.length,
    symbols: symbols.sort((a, b) => a.symbol.localeCompare(b.symbol)), // deterministic order
  };
}
```
This directly satisfies D-01 (7-calendar-day window via UTC date math), D-02 (adjacent **recorded** dates within window, not calendar-adjacent — first entry in a symbol's window timeline is a baseline, never itself a "change"), D-03 (urgent dates list), D-04 (symbol key used as-is, no re-normalization), and D-05 (movement-only filter).

### Pattern 2: Short date formatting for pure date keys (D-07)
**What:** `YYYY-MM-DD` → `MM/DD`, without going through `Date`/`toLocaleString` at all.
**When to use:** Rendering `urgentDates`/`decisionChanges[].date` in the rollup HTML.
**Example:**
```typescript
// generate-portfolio-report.ts (new local helper, not exported)
function formatDateKeyShort(dateKey: string): string {
  // "2026-07-02" -> "07/02". Pure string slice — no Date object, no TZ ambiguity,
  // safe because dateKey is already the canonical calendar date (D-07: no timezone conversion needed).
  return dateKey.slice(5).replace("-", "/");
}
```
See **Pitfalls > Pitfall 3** below for why reusing `formatPublishedAtJst` here is wrong.

### Pattern 3: Backward-compatible optional 4th parameter (verified against Test 38)
**What:** Add `urgencyHistory: UrgencyHistoryFile = {}` as `generatePortfolioReportHtml`'s 4th parameter.
**Example (verified current signature, `src/scripts/generate-portfolio-report.ts` L102-106):**
```typescript
export function generatePortfolioReportHtml(
  result: MeetingResult,
  portfolioAnalysis: PortfolioAnalysis | null,
  resolvedHoldingNews: Record<string, ReadonlyArray<ResolvedHoldingNewsItem>> = {},
  urgencyHistory: UrgencyHistoryFile = {}, // NEW — D-12
): string {
```
A new test mirroring existing Test 38 (`src/scripts/generate-report.test.ts` L473-479) should assert the 2-argument and 3-argument call forms still work unchanged.

### Anti-Patterns to Avoid
- **Re-deriving today's date via `Date.now()`/JST offset math inside the rollup module:** D-01 explicitly mandates using `meetingResult.date` as the single source of truth (same pattern Phase 25 D-05 already locked in for `write-urgency-history.ts`). Do not reintroduce a second date-derivation path.
- **Reusing `formatUrgentBadgeHtml`/`formatDecisionChangedBadgeHtml` as-is for the rollup:** those two functions render exactly one badge for one holding's *current-day* state (a single boolean / a single before-after pair). The rollup needs multiple dates and multiple changes per symbol — write new bespoke markup that reuses the **color values** (`#ef4444` red-family for urgent-language consistency, `#f59e0b` amber for decision-change) but not the functions themselves.
- **Iterating `for...in` over the parsed history object:** enumerates inherited/prototype-chain properties. Use `Object.keys`/`Object.entries` (already the pattern in `resolvePortfolioHoldingNews`).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Date-only key validation | A new regex or ad-hoc date check | `isValidDateKey` (already exported from `urgency-history.ts`, L54-56) | Single source of truth — Phase 25 and Phase 26 must never disagree on what counts as a valid date key; also already hardened against `"__proto__"` |
| Symbol normalization | Re-normalizing symbols on read | Nothing — Phase 25 already normalized at write time (D-04); reading side must NOT re-apply `normalizeHoldingSymbol`, since keys are already canonical and re-normalizing is redundant work, not a bug per se, but adds an unnecessary import/dependency for zero benefit | Keeps the aggregation module's only import from `urgency-history.js` to just the two things it needs (`isValidDateKey`, types) |
| HTML escaping | Custom escaping / template literals without escaping | `escapeHtml` (`report-utils.ts` L26) | Single existing XSS defense across the whole report suite; already covers `&`, `<`, `>`, `"`, `'` |
| JST date/time formatting | Ad-hoc `Intl.DateTimeFormat`/manual offset math for the `MM/DD` display | New trivial `dateKey.slice(5).replace("-","/")` helper (see Pattern 2) — **not** `formatPublishedAtJst` | `formatPublishedAtJst` is designed for full ISO datetime strings and injects hour:minute + no zero-padding; using it here would need extra pre/post-processing to strip time and zero-pad, more complex than the direct slice |

**Key insight:** Every piece of infrastructure this phase needs (date validation, symbol normalization, escaping) already exists in the codebase from Phase 19–25. The only genuinely new logic is the aggregation algorithm itself (window filter + cross-history decision diff) and the rendering markup — everything else should be reused, not reimplemented.

## Common Pitfalls

### Pitfall 1: Parsing date-only strings with local-timezone `Date` construction
**What goes wrong:** `new Date("2026-07-02")` is parsed as UTC midnight per the ES2015+ spec, but naive code that does `new Date(dateKey).getDate()` (local getters, not `getUTCDate()`) can shift the calendar day depending on the host machine's timezone (e.g. any timezone west of UTC would show `2026-07-01` for local date methods).
**Why it happens:** Mixing UTC-parsed `Date` objects with local-timezone getter methods (`getDate()`/`getMonth()` vs. `getUTCDate()`/`getUTCMonth()`).
**How to avoid:** Do all window-boundary arithmetic in UTC milliseconds (`Date.parse(`${key}T00:00:00Z`)` in, `.toISOString().slice(0,10)` out — both UTC-only), and do the `MM/DD` display formatting via plain string slicing (Pattern 2), never through `Date` at all.
**Warning signs:** Off-by-one-day window boundaries in aggregation tests that only fail depending on which timezone CI/dev machine runs in.

### Pitfall 2: Trusting `Object.keys(history)` without validation on the read side
**What goes wrong:** Phase 25's write path validates every dateKey with `isValidDateKey` before writing (D-06), but a hand-edited or externally-tampered `data/urgency-history.json` could contain non-date keys — including the literal string `"__proto__"`, which `JSON.parse` creates as a normal *own* enumerable property (a well-known but frequently-misremembered V8/spec behavior, not classic prototype-chain pollution, but still a key that must not be treated as a symbol-date entry).
**Why it happens:** The read side is a new code path that doesn't automatically inherit the write side's validation.
**How to avoid:** Filter `Object.keys(history)` through `isValidDateKey` before using them (see Pattern 1) — this is already unit-tested behavior (`urgency-history.test.ts` L157-159: `"__proto__"` → `false`), so reusing it for free-rides on that existing guarantee.
**Warning signs:** A crafted or corrupted history file causing the rollup to silently include garbage "dates" in `daysCovered` or crash on `entries[i-1].decision` comparisons.

### Pitfall 3: Reusing `formatPublishedAtJst` for the `MM/DD` display (D-07)
**What goes wrong:** `formatPublishedAtJst` (verified at `report-utils.ts` L13-24) takes a full ISO **datetime** string, converts to JST, and formats as `M/D HH:MM` (no zero-padding on month/day, always includes time). Feeding it a bare `"2026-07-02"` date key would either throw/produce `Invalid Date` behavior downstream or produce a string like `"7/2 09:00"` — not the `"07/02"` zero-padded format the CONTEXT.md examples show (`⚠ 緊急フラグ: 07/02, 07/04`).
**Why it happens:** Superficial similarity (both are "JST date formatting" functions) masks a real signature/purpose mismatch — one is for timestamp display, the other needed here is a pure calendar-date label.
**How to avoid:** Write a new one-line helper (Pattern 2) that slices `"MM-DD"` out of the already-canonical date key and swaps the separator — zero timezone conversion needed since D-01/D-07 already establish these are calendar dates with no time component.
**Warning signs:** Rollup output showing `"7/2"` instead of `"07/02"`, or including an unwanted time-of-day, or the aggregation module needing to import `Date`-heavy formatting logic it never actually needs.

### Pitfall 4: The null-`portfolioAnalysis` early return skips ALL section HTML, including the new rollup
**What goes wrong:** `generatePortfolioReportHtml`'s current null-analysis branch (`generate-portfolio-report.ts` L110-129) returns a minimal "本日のポートフォリオ分析は生成されませんでした。" page and never computes `overallCommentHtml` and friends. If the new rollup section is only wired into the non-null branch (as a literal reading of D-08's "immediately after `overallCommentHtml`" would suggest), the weekly rollup — which has **no dependency on today's `portfolioAnalysis`** — would silently disappear on exactly the days the pipeline most needs a fail-soft signal (a failed portfolio-analyst run).
**Why it happens:** D-08 describes the *insertion point relative to existing sections*, all of which live inside the non-null branch; CONTEXT.md doesn't explicitly discuss the null branch.
**How to avoid:** Recommend rendering the weekly rollup section in **both** branches — compute `weeklyRollupHtml = formatWeeklyUrgencyRollupHtml(computeWeeklyUrgencyRollup(urgencyHistory, result.date))` once, before the null check, and insert it into both HTML templates. This is a small, low-risk change (the 4th parameter is already available in scope) and is consistent with D-14's fail-soft philosophy. **Flag this explicitly for planner sign-off** — it is not locked in CONTEXT.md.
**Warning signs:** A test that intentionally passes `portfolioAnalysis = null` alongside non-empty `urgencyHistory` and asserts the rollup section is missing would currently be "correct" under a literal-only reading of D-08, but likely contradicts the phase's spirit.

## Code Examples

### Loader (mirrors `loadHoldingNews`/`loadPrevPortfolioAnalysis`, `report-data-loaders.ts`)
```typescript
// report-data-loaders.ts — add alongside existing loaders
import type { UrgencyHistoryFile } from "../portfolio/urgency-history.js";

// NEW constant — TMP_DIR already exists at L8; DATA_DIR does not exist yet in this file.
const DATA_DIR = join(import.meta.dirname, "../../data");

/**
 * data/urgency-history.json（Phase 25生成）を fail-soft で読み込む。
 * 自社TS生成物のため zod は使わず、loadHoldingNews と同じ型アサーションを用いる。
 * 欠損（初回実行・履歴未蓄積）は正常系のため console.warn を用いる
 * （loadPrevPortfolioAnalysis と同じ severity 方針、D-13/D-14）。
 */
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
Test pattern to mirror (`report-data-loaders.test.ts` L55-80, `vi.mock("node:fs/promises", ...)` + `mockRejectedValueOnce(new Error("ENOENT"))` — no `.code` property, matching this codebase's mock convention).

### Wiring into `generate-report.ts`
```typescript
// generate-report.ts — add DATA_DIR const (does not currently exist in this file)
const DATA_DIR = join(import.meta.dirname, "../../data");

// add loadUrgencyHistory to the existing Promise.all import + call list (L122-133)
import { /* ...existing... */ loadUrgencyHistory } from "./report-data-loaders.js";

const [/* ...existing 10 results... */, urgencyHistory] = await Promise.all([
  /* ...existing 10 loaders... */,
  loadUrgencyHistory(),
]);

// L152 call site — add 4th argument
const portfolioHtml = generatePortfolioReportHtml(meetingResult, enrichedPortfolioAnalysis, resolvedHoldingNews, urgencyHistory);
```

## State of the Art

No external ecosystem shift applies here — this is entirely internal-codebase pattern reuse. Nothing is deprecated; nothing needs a version bump.

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| N/A | N/A | N/A | This phase introduces new internal modules following existing established patterns; no prior approach is being replaced |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The exact wording of section heading and empty-state messages recommended (e.g. "今週の緊急フラグ・判断変更ロールアップ") are suggestions only — CONTEXT.md explicitly defers final wording to planner/executor discretion | Standard Stack / User Constraints | None — this is explicitly a discretion area, not a locked fact |
| A2 | Recommendation to render the weekly rollup section in the null-`portfolioAnalysis` branch too (Pitfall 4) is my analysis, not a decision from CONTEXT.md | Common Pitfalls > Pitfall 4 | If the planner instead decides to only render in the non-null branch, the rollup silently disappears on portfolio-analysis-failure days — low risk (cosmetic), but should be an explicit choice, not an accident |
| A3 | `console.warn` (not `console.error`) is recommended for the new loader's failure path, by analogy to `loadPrevPortfolioAnalysis`'s severity convention rather than `loadHoldingNews`/`loadPortfolioAnalysis`'s `console.error` | Code Examples | Low risk — purely a log-severity/style choice, doesn't affect functional behavior or fail-soft guarantee either way |

**All other claims in this research were verified directly against the live source files** (line numbers, signatures, test patterns) listed in Sources below — no user confirmation needed for those.

## Open Questions

1. **Should the weekly rollup render when `portfolioAnalysis` is `null`?**
   - What we know: The null-analysis branch (`generate-portfolio-report.ts` L110-129) currently renders a minimal page with none of the other sections; the rollup's only true data dependency is `urgencyHistory` + `result.date`, both available regardless of `portfolioAnalysis`.
   - What's unclear: CONTEXT.md's D-08 placement decision only speaks to the non-null branch's section order.
   - Recommendation: Render in both branches (see Pitfall 4). Planner should make this an explicit task/acceptance-criterion rather than leaving it to executor improvisation.

2. **Exact section heading and 3-tier empty-state copy (D-08/D-09/D-10)**
   - What we know: CONTEXT.md gives illustrative Japanese phrasing for all 3 states and explicitly defers final wording.
   - What's unclear: Nothing blocking — just needs a concrete decision recorded in the plan so tests can assert on exact strings.
   - Recommendation: Lock exact copy at plan-writing time (not implementation time) so tests are written against final strings, avoiding rework.

## Environment Availability

Skipped — this phase has no new external tool/service dependencies. It reads an internal build artifact (`data/urgency-history.json`) already produced by Phase 25's existing Step 3f, using the same Node.js/tsx/vitest toolchain already installed and exercised by every other phase in this repository. `npm test` (`vitest run`) already runs the full existing suite including `urgency-history.test.ts` and `write-urgency-history.test.ts`.

## Validation Architecture

`.planning/config.json` has no `workflow.nyquist_validation` key (absent = enabled per policy), so this section is included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^4.0.18 (confirmed in `package.json`) |
| Config file | none — vitest defaults, `*.test.ts` naming convention, co-located with source |
| Quick run command | `npx vitest run src/portfolio/urgency-rollup.test.ts` |
| Full suite command | `npm test` (= `vitest run`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| HIST-03 | 7-day window filters history to `[anchor-6, anchor]` inclusive, missing days tolerated | unit | `npx vitest run src/portfolio/urgency-rollup.test.ts -t "window"` | ❌ Wave 0 — new file |
| HIST-03 | Decision-change detected only between adjacent **recorded** dates within window (not calendar-adjacent) | unit | `npx vitest run src/portfolio/urgency-rollup.test.ts -t "decision"` | ❌ Wave 0 |
| HIST-03 | Urgent dates collected per symbol, symbols with 0 movement excluded (D-05) | unit | `npx vitest run src/portfolio/urgency-rollup.test.ts -t "urgent"` | ❌ Wave 0 |
| HIST-03 | Immutability — input `history` never mutated | unit | `npx vitest run src/portfolio/urgency-rollup.test.ts -t "immutable"` | ❌ Wave 0 |
| HIST-03 | `<7` days of history aggregates what exists, no error | unit | `npx vitest run src/portfolio/urgency-rollup.test.ts -t "partial"` | ❌ Wave 0 |
| HIST-03 | `generatePortfolioReportHtml` 4th-arg default `{}` is backward compatible (mirrors Test 38) | unit | `npx vitest run src/scripts/generate-report.test.ts -t "urgencyHistory"` | ❌ Wave 0 (extend existing file) |
| HIST-03 | Section placement (after overallComment, before holdingEvaluations), badge colors, escapeHtml on symbol/nameJa/decision | unit | `npx vitest run src/scripts/generate-report.test.ts -t "rollup"` | ❌ Wave 0 (extend existing file) |
| HIST-03 | Loader fail-soft: missing/corrupt `data/urgency-history.json` → `{}` | unit | `npx vitest run src/scripts/report-data-loaders.test.ts -t "loadUrgencyHistory"` | ❌ Wave 0 (extend existing file) |

### Sampling Rate
- **Per task commit:** `npx vitest run src/portfolio/urgency-rollup.test.ts` (or the relevant single file being touched)
- **Per wave merge:** `npm test` (full suite — this repo already has ~20 co-located `.test.ts` files, all fast/no I/O beyond mocked `fs/promises`)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/portfolio/urgency-rollup.ts` + `src/portfolio/urgency-rollup.test.ts` — new pure module, covers all HIST-03 aggregation behaviors (does not exist yet)
- [ ] New `describe` blocks in `src/scripts/generate-report.test.ts` — covers 4th-arg backward compat + section rendering
- [ ] New `describe` block in `src/scripts/report-data-loaders.test.ts` — covers `loadUrgencyHistory` fail-soft
- Framework install: none — vitest already installed and configured via `package.json` `"test": "vitest run"`

## Security Domain

`.planning/config.json` has no `security_enforcement` key (absent = enabled per policy), so this section is included.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | This is a static-HTML build pipeline with no auth surface |
| V3 Session Management | No | No sessions involved |
| V4 Access Control | No | No access-control surface — output is public static HTML |
| V5 Input Validation | Yes | `isValidDateKey` filter on all history dateKeys before use (rejects malformed/`"__proto__"`-style keys); `Array.isArray`/shape guards on each snapshot entry before use — never trust `data/urgency-history.json` blindly on read, even though the write side already validates (defense in depth, since the file is git-tracked and could theoretically be hand-edited) |
| V6 Cryptography | No | No cryptographic operations in this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Stored XSS via unescaped `symbol`/`nameJa`/`decision` strings rendered into HTML | Tampering / Elevation of Privilege (if a GitHub Pages viewer's browser executes injected script) | `escapeHtml` (verified `report-utils.ts` L26) on every dynamic string in the new rollup renderer — same discipline already applied to every other section of this report |
| JSON key masquerading as `"__proto__"` in a hand-edited or corrupted `data/urgency-history.json` | Tampering | `isValidDateKey` filter before iterating history keys (already unit-tested for this exact case in `urgency-history.test.ts` L157-159); use `Object.keys`/`Object.entries`, never `for...in` |
| Malformed/partial JSON causing an unhandled exception that crashes report generation for all 3 reports (not just portfolio) | Denial of Service (self-inflicted, via corrupted local file) | Fail-soft loader (`try`/`catch` → `{}`) + defensive shape-checking inside `computeWeeklyUrgencyRollup` (never throws even on malformed snapshot entries) — matches D-14 |

## Sources

### Primary (HIGH confidence — verified directly against live repository files in this session)
- `/Users/arai/invest/src/portfolio/urgency-history.ts` (57 lines, read in full) — `HoldingUrgencySnapshot` (L9-14), `UrgencyHistoryFile` (L20), `extractUrgencySnapshots` (L27-36), `appendUrgencySnapshot` (L42-48), `isValidDateKey` (L54-56)
- `/Users/arai/invest/src/portfolio/urgency-history.test.ts` (165 lines, read in full) — vitest test conventions, `"__proto__"` rejection test (L157-159)
- `/Users/arai/invest/src/scripts/generate-portfolio-report.ts` (153 lines, read in full) — `formatUrgentBadgeHtml` (L48-51), `formatDecisionChangedBadgeHtml` (L58-65), `formatHoldingEvaluationsHtml` (L67-92), `generatePortfolioReportHtml` (L102-153, null branch L110-129, template composition L131-133/147-149)
- `/Users/arai/invest/src/scripts/generate-report.ts` (172 lines, read in full) — `main()` (L116-171), loader `Promise.all` (L122-133), `TMP_DIR`/`DOCS_DIR` consts (L13-14, **no `DATA_DIR` currently defined**), `generatePortfolioReportHtml` call site (L152), `meetingResult.date` usage (L120, L147)
- `/Users/arai/invest/src/scripts/report-data-loaders.ts` (134 lines, read in full) — `loadPortfolioAnalysis` (L82-90), `loadPrevPortfolioAnalysis` (L97-105), `loadHoldingNews` (L125-133), `TMP_DIR` const (L8, **no `DATA_DIR` currently defined**)
- `/Users/arai/invest/src/scripts/report-data-loaders.test.ts` — `vi.mock("node:fs/promises")` pattern (L12-18), `loadHoldingNews`/`loadPrevPortfolioAnalysis` test blocks (L55-108)
- `/Users/arai/invest/src/scripts/report-utils.ts` (243 lines, read in full) — `formatPublishedAtJst` (L13-24), `escapeHtml` (L26-33), `generateBaseStyles` (L98-242)
- `/Users/arai/invest/src/scripts/generate-report.test.ts` (L460-519 read) — Test 38 backward-compat pattern (L473-479), Tests 40-43 for urgent/decisionChanged badges
- `/Users/arai/invest/src/scripts/write-urgency-history.ts` (84 lines, read in full) — `DATA_DIR`/`HISTORY_PATH` const pattern (L9-10), `loadExistingHistory` dual-ENOENT-check pattern (L12-26), fail-soft main() (L32-83)
- `/Users/arai/invest/src/portfolio/decision-diff.ts` (42 lines, read in full) — `attachDecisionChanges` (L19-42) — **note: this file is at `src/portfolio/decision-diff.ts`, NOT `src/meeting/decision-diff.ts` as CONTEXT.md's canonical_refs states (see mismatch note below)**
- `/Users/arai/invest/src/portfolio/holding-news.ts` (214 lines, read in full) — `normalizeHoldingSymbol` (L32-34), pure-function/no-throw module template
- `/Users/arai/invest/src/meeting/types.ts` (L38-140 read) — `MeetingResult.date` (L39), `HoldingEvaluation` (L110-131), `PortfolioAnalysis` (L134-140)
- `/Users/arai/invest/src/meeting/schemas.ts` (L232-277 read) — `portfolioAnalysisSchema` zod pattern (used for LLM-adjacent artifacts, not self-generated ones)
- `/Users/arai/invest/.claude/commands/invest.md` (L2056-2235 read) — Step 3f (L2056-2078), Step 4 deploy git flow incl. `git add docs/ data/` (L2129-2133)
- `/Users/arai/invest/package.json` — vitest ^4.0.18, typescript ^5.9.3, zod ^4.3.6 (no new deps needed)
- `/Users/arai/invest/.gitignore` — confirms only `tmp/` ignored, `data/` tracked (Phase 25 D-12, still true)
- `/Users/arai/invest/.planning/config.json` — confirms absence of `workflow.nyquist_validation` and `security_enforcement` keys (both treated as enabled per policy)
- `.planning/phases/26-weekly-urgency-rollup-display/26-CONTEXT.md`, `.planning/phases/25-urgency-history-persistence/25-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `.planning/ROADMAP.md` (Phase 26 section, L136-143) — all read in full

### Secondary (MEDIUM confidence)
None — no external web research was needed; this phase is entirely internal-codebase pattern application.

### Tertiary (LOW confidence)
None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all versions confirmed directly from `package.json`
- Architecture: HIGH — insertion points, signatures, and line numbers verified directly against live source files, not from memory or CONTEXT.md's claims alone
- Pitfalls: HIGH — all 4 pitfalls derived from actual code inspection (date-parsing semantics, `formatPublishedAtJst`'s real signature, the null-branch's real control flow), not speculation

**CONTEXT.md mismatch found:** `26-CONTEXT.md`'s `<canonical_refs>` cites `src/meeting/decision-diff.ts` for `attachDecisionChanges`. The actual file is `src/portfolio/decision-diff.ts` (confirmed via `find` + `Read`). This is a path error only — the function signature and behavior described in CONTEXT.md otherwise match the live code exactly. Planner should reference the corrected path.

**Research date:** 2026-07-04
**Valid until:** 2026-08-03 (30 days — stable internal codebase, no external ecosystem dependency to go stale)

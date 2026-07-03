# Phase 18: Index/Nav Integration & Validation - Pattern Map

**Mapped:** 2026-07-03
**Files analyzed:** 2 (both existing files, modified in place — no new files)
**Analogs found:** 2 / 2 (self-analog: both files are their own closest pattern source; a third file, `write-news-digest.ts`, supplies the fs-path-provenance/security convention)

This phase has **no new files**. Both files in scope already exist and are extended in place. The "analog" for each is therefore the file itself (extend existing conventions), cross-referenced with `write-news-digest.ts` for the fs-access/date-provenance convention and `report-utils.ts` for `escapeHtml`.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `src/scripts/update-index.ts` (modified: add `withNewsDigestLink` + wiring) | build-script / transform (HTML generator) | file-I/O + transform (read → parse → derive-from-fs → render → write) | itself (`updateIndexHtml`, `parseExistingEntries`, `renderEntryLinks`) + `src/scripts/write-news-digest.ts` (fs-access & date-provenance convention) | exact (self) |
| `src/scripts/update-index.test.ts` (modified: extend `vi.mock` factory + 3-4 new `it` cases) | test | request-response (unit test of a pure/async transform) | itself (existing `describe("update-index.ts", ...)` block, `beforeEach` fixture, `vi.mock("node:fs/promises", ...)` factory) | exact (self) |

## Pattern Assignments

### `src/scripts/update-index.ts` (build-script, file-I/O + transform)

**Analog:** itself (lines 1-238, full file already read) + `write-news-digest.ts` for fs-access convention

**Imports pattern** (update-index.ts, lines 1-5):
```typescript
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PORTFOLIO_HOLDINGS } from "../portfolio/holdings.js";
import { escapeHtml } from "./report-utils.js";
```
Extend by adding `access` to the same `node:fs/promises` import (do not introduce `node:fs` sync APIs — zero existing sync-fs usage anywhere in `src/`, confirmed by RESEARCH.md's `grep -rn "existsSync\|from \"node:fs\""` finding):
```typescript
import { access, readFile, writeFile } from "node:fs/promises";
```

**Existing constants to reuse** (lines 7-11):
```typescript
const DOCS_DIR = join(import.meta.dirname, "../../docs");
```
The new existence check must build its path from `DOCS_DIR`, exactly like every other path in this file (`join(DOCS_DIR, "index.html")` at line 175, `join(DOCS_DIR, "portfolio.html")` at line 203).

**Core pattern to copy — `ReportLink`/`ReportEntry` are already link-count-agnostic** (lines 13-21):
```typescript
export interface ReportLink {
  readonly href: string;
  readonly label: string;
}

export interface ReportEntry {
  readonly date: string;
  readonly links: ReadonlyArray<ReportLink>;
}
```
No schema change needed — `withNewsDigestLink` returns a new `ReportEntry` with a new `links` array (immutability convention already established via `readonly`/`ReadonlyArray`).

**`buildStandardLinks` — leave completely unchanged** (lines 29-35, D-03):
```typescript
function buildStandardLinks(date: string): ReportLink[] {
  return [
    { href: `${date}/daily-report.html`, label: "Daily Report" },
    { href: `${date}/meeting-minutes.html`, label: "Meeting Minutes" },
    { href: `${date}/portfolio-report.html`, label: "Portfolio Report" },
  ];
}
```
Do not add a 4th conditional link here (Pitfall 1 in RESEARCH.md) — this function only runs for the "today" entry, not the ~118 historical entries that also need the fs-derived News Digest link.

**`mergeEntry` — reuse as-is, new date wins** (lines 61-68):
```typescript
export function mergeEntry(
  existing: ReadonlyArray<ReportEntry>,
  newEntry: ReportEntry,
): ReportEntry[] {
  const filtered = existing.filter((e) => e.date !== newEntry.date);
  return [...filtered, newEntry];
}
```

**Insertion point — `updateIndexHtml`, right after `mergeEntry`, before `buildRegion`** (lines 186-192, current code):
```typescript
const existingEntries = parseExistingEntries(existingRegion);

const newEntry: ReportEntry = { date, links: buildStandardLinks(date) };
const merged = mergeEntry(existingEntries, newEntry);

const regionHtml = buildRegion(merged);
```
New wiring (per RESEARCH.md Pattern 1, D-01/D-02/D-06 compliant — `buildRegion`/`renderHero`/`renderAccordion`/`renderEntryLinks` remain completely untouched, so the hero block gets the new link "for free"):
```typescript
const existingEntries = parseExistingEntries(existingRegion);

const newEntry: ReportEntry = { date, links: buildStandardLinks(date) };
const merged = mergeEntry(existingEntries, newEntry);
const withDigestLinks = await Promise.all(merged.map(withNewsDigestLink)); // NEW

const regionHtml = buildRegion(withDigestLinks); // was: buildRegion(merged)
```

**New helper functions to add** (placed near `buildStandardLinks`, before `updateIndexHtml`):
```typescript
const NEWS_DIGEST_LABEL = "News Digest";

async function newsDigestFileExists(date: string): Promise<boolean> {
  try {
    await access(join(DOCS_DIR, date, "news-digest.html"));
    return true;
  } catch {
    return false;
  }
}

/**
 * Re-derives the News Digest link for a single entry strictly from fs state,
 * every run (D-01/D-02). Never trusts a parsed "News Digest" link — always
 * strips it first, then re-adds only if the file exists right now.
 */
async function withNewsDigestLink(entry: ReportEntry): Promise<ReportEntry> {
  const baseLinks = entry.links.filter((l) => l.label !== NEWS_DIGEST_LABEL);
  const exists = await newsDigestFileExists(entry.date);
  const links = exists
    ? [...baseLinks, { href: `${entry.date}/news-digest.html`, label: NEWS_DIGEST_LABEL }]
    : baseLinks;
  return { ...entry, links };
}
```
Note the immutable style (`[...baseLinks, ...]`, spread into a new object `{ ...entry, links }`) matches the project's global coding-style rule (never mutate) and this file's existing conventions (`[...filtered, newEntry]` in `mergeEntry`, `[...entries].sort()` in `buildRegion`).

**Rendering pattern — no change needed, already shared** (lines 92-98, 110-118, 124-139):
```typescript
function renderEntryLinks(entry: ReportEntry): string {
  return entry.links
    .map(
      (l) => `<a href="${escapeHtml(l.href)}">${escapeHtml(l.label)}</a>`,
    )
    .join("\n          ");
}
```
`renderHero` and `renderAccordion`/`renderEntryItem` both call `renderEntryLinks(entry)` — since `withNewsDigestLink` appends to `entry.links` before `buildRegion` runs, both hero and accordion render the News Digest link automatically (D-06 satisfied with zero changes to these three functions).

**Escaping convention — reuse, no new escaping logic** (`report-utils.ts`, lines 8-14):
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
The new link's `href`/`label` flow through the existing `renderEntryLinks` call, which already calls `escapeHtml` on both fields — no new call site needed.

**Date-provenance / path-traversal convention** (`write-news-digest.ts`, lines 12-17):
```typescript
// date は上流で検証済みの meeting-result.json からのみ取得する。
// news-curation.json (LLM生成、信頼できない) から date を導出しない (T-17-03: パストラバーサル対策)。
const meetingRaw = await readFile(join(TMP_DIR, "meeting-result.json"), "utf-8");
const { date } = JSON.parse(meetingRaw) as { date: string };

const dateDir = join(DOCS_DIR, date);
```
Applies by inheritance, not by new code: `withNewsDigestLink(entry)` only ever receives `entry.date`, which for the new entry comes from `getDate()` (already-validated `tmp/meeting-result.json`, same provenance as `write-news-digest.ts`) and for historical entries comes from `parseExistingEntries`'s regex capture `([\d-]+)` against this script's own prior, self-authored output — never externally/LLM-supplied. No new validation call needed in `update-index.ts`; do not widen the date source.

**Error handling pattern — no new try/catch at the `updateIndexHtml` level; `access` failure handled locally inside `newsDigestFileExists`**:
The only new error handling is the `try { await access(...); return true } catch { return false }` inside `newsDigestFileExists` above — this is intentionally a boolean-returning existence check, not a propagating error path (an ENOENT from `access` is the *expected*, common case: absence of the file, not a fault). This differs from `write-news-digest.ts`'s pipeline-level `try/catch` (which distinguishes fatal-vs-fallback), because here "file absent" is a normal, frequent branch, not an error condition.

---

### `src/scripts/update-index.test.ts` (test, request-response/unit)

**Analog:** itself (lines 1-168, full file already read)

**Mock-factory extension pattern — Pitfall 4 in RESEARCH.md is the single most load-bearing fact here** (current, lines 3-8):
```typescript
vi.mock("node:fs/promises", () => ({
  readFile: vi.fn().mockRejectedValue(new Error("ENOENT")),
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
  readdir: vi.fn().mockResolvedValue([]),
}));
```
Must become (add `access`, default = "file does not exist" so all pre-existing tests keep passing unmodified since they don't set up `access` and expect no News Digest link to appear):
```typescript
vi.mock("node:fs/promises", () => ({
  readFile: vi.fn().mockRejectedValue(new Error("ENOENT")),
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
  readdir: vi.fn().mockResolvedValue([]),
  access: vi.fn().mockRejectedValue(new Error("ENOENT")), // NEW: default = file does not exist
}));
```
`vi.mock` with a factory function is an **exhaustive replacement** of the module's exports — any export used by the implementation but omitted from the mock factory becomes `undefined` at runtime (`TypeError: access is not a function`), not auto-mocked or passed-through to the real implementation. This is the single highest-risk gotcha for Wave 0.

**`beforeEach` fixture pattern to extend** (current, lines 52-62):
```typescript
beforeEach(async () => {
  const fsMock = await import("node:fs/promises");
  (fsMock.writeFile as ReturnType<typeof vi.fn>).mockClear();
  (fsMock.readFile as ReturnType<typeof vi.fn>).mockReset();
  (fsMock.readFile as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
    if (String(path).includes("index.html")) {
      return Promise.resolve(HEAD_SCAFFOLD);
    }
    return Promise.reject(new Error("ENOENT"));
  });
});
```
Per-test `access` behavior (do NOT put a specific-date implementation in the shared `beforeEach` — only reset there; configure per-test inside each new `it(...)` so each of the 4 D-08 scenarios controls its own resolve/reject map, following the existing per-test-override style already used for `readFile` inside individual `it` blocks where needed):
```typescript
// Inside a specific it(...) block, before calling updateIndexHtml:
const fsMock = await import("node:fs/promises");
(fsMock.access as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
  if (String(path).includes("2026-07-01/news-digest.html")) return Promise.resolve(undefined);
  return Promise.reject(new Error("ENOENT"));
});
```

**Fixture-HTML pattern to extend for the "stale link removal" test case** (current `HEAD_SCAFFOLD`, lines 12-47): the existing fixture has two entries (`2026-07-01` with 3 links, `2026-06-10` with 2 links, no News Digest link in either). The D-08 case 3 test ("パース済みリンクの除去 fs不在時") needs either a new fixture variant, or an inline-modified copy of `HEAD_SCAFFOLD` with a pre-existing `<a href="2026-07-01/news-digest.html">News Digest</a>` line inserted into one entry's `report-links` block, combined with `access` rejecting for that same date — asserting the output no longer contains that href/label pair. Follow the existing string-template fixture style (backtick template literal, not a separate `.html` file) rather than introducing file-based fixtures (Claude's Discretion note in CONTEXT.md: "テンポラリディレクトリ fixture vs 実在チェック関数の注入 — 既存の慣例に従う" resolves to: continue mocking the module, no temp-directory fixtures).

**Test-assertion pattern to copy** (existing test, lines 95-113, "preserves the 2-link entry" — this is the exact model for the D-08 case 4 "既存3リンクの保存" regression test):
```typescript
it("preserves the 2-link entry's exact hrefs without fabricating a 3rd link", async () => {
  const fsMock = await import("node:fs/promises");
  const { updateIndexHtml } = await import("./update-index.js");

  await updateIndexHtml(NEW_DATE);

  const writeCalls = (fsMock.writeFile as ReturnType<typeof vi.fn>).mock.calls;
  const indexCall = writeCalls.find((call) => String(call[0]).includes("index.html"));
  const output = String(indexCall![1]);

  const juneEntryMatch = output.match(
    /<div class="report-date">2026-06-10<\/div>\s*<div class="report-links">([\s\S]*?)<\/div>/,
  );
  expect(juneEntryMatch).toBeTruthy();
  const juneLinksHtml = juneEntryMatch![1];
  expect(juneLinksHtml).toContain("2026-06-10/daily-report.html");
  expect(juneLinksHtml).toContain("2026-06-10/meeting-minutes.html");
  expect(juneLinksHtml).not.toContain("portfolio-report.html");
});
```
New tests should copy this exact shape: import `updateIndexHtml` fresh, await it, find the `index.html` write call via `writeCalls.find(...)`, regex-extract the relevant `<div class="report-links">` block for a specific date, and assert on substring presence/absence of `news-digest.html` / `News Digest`.

**`afterEach` reset pattern — reuse unchanged** (line 64-66):
```typescript
afterEach(() => {
  vi.restoreAllMocks();
});
```

---

## Shared Patterns

### Fs API surface consistency (async-only, no sync fs)
**Source:** `src/scripts/update-index.ts` (lines 1, 176, 198), `src/scripts/write-news-digest.ts` (lines 1, 14, 18, 28, 33), confirmed by RESEARCH.md's `grep -rn "existsSync\|from \"node:fs\"" src/` → zero hits
**Apply to:** the new `access()` call in `update-index.ts` — must come from `node:fs/promises`, not `node:fs`'s sync `existsSync`. This keeps a single fs import surface across the whole file and codebase.

### Immutability (readonly / spread, never mutate)
**Source:** `src/scripts/update-index.ts` — `ReportEntry`/`ReportLink` interfaces use `readonly`/`ReadonlyArray` (lines 13-21), `mergeEntry` returns `[...filtered, newEntry]` (line 67), `buildRegion` uses `[...entries].sort(...)` (line 147)
**Apply to:** `withNewsDigestLink` — must return a new `ReportEntry` object (`{ ...entry, links }`), never mutate `entry.links` in place. Matches the user's global coding-style rule (immutability, CRITICAL).

### HTML escaping
**Source:** `src/scripts/report-utils.ts` lines 8-14 (`escapeHtml`), consumed at `src/scripts/update-index.ts` line 95 (`renderEntryLinks`)
**Apply to:** No new call needed — the new News Digest link object flows through the existing `renderEntryLinks` call path unchanged, since it's appended to `entry.links` before `buildRegion`/`renderHero`/`renderAccordion` run.

### Date provenance / path-traversal safety
**Source:** `src/scripts/write-news-digest.ts` lines 12-13 (comment: "date は上流で検証済みの meeting-result.json からのみ取得する... T-17-03: パストラバーサル対策")
**Apply to:** `update-index.ts`'s `getDate()` (already-existing, unchanged) for the new entry, and `parseExistingEntries`'s regex-captured `date` (already-existing, unchanged) for historical entries — no new validation code required, but do not widen either date source when adding `withNewsDigestLink`.

### Vitest module-mock exhaustiveness
**Source:** `src/scripts/update-index.test.ts` lines 3-8 (`vi.mock("node:fs/promises", () => ({...}))`)
**Apply to:** Any new fs-promises export used by the implementation (`access`) MUST be added to this same factory object, or it will be `undefined` at test time — this is Pitfall 4 from RESEARCH.md and the single highest-risk gap for Wave 0.

## No Analog Found

None. Both files in scope are existing files being extended, and every new piece of logic (fs-access existence check, immutable link-list derivation, extended vi.mock factory) has a direct, concrete analog either within the same file or in `write-news-digest.ts`/`report-utils.ts`. No new file, no new role, no new data-flow pattern is introduced by this phase.

## Metadata

**Analog search scope:** `src/scripts/` (all 20 files listed), with deep reads of `update-index.ts`, `update-index.test.ts`, `write-news-digest.ts`, and a targeted grep of `report-utils.ts`'s `escapeHtml`.
**Files scanned:** 20 files in `src/scripts/` (directory listing) + 4 fully/partially read for pattern extraction.
**Pattern extraction date:** 2026-07-03

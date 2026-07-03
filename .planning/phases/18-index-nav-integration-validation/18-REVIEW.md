---
phase: 18-index-nav-integration-validation
reviewed: 2026-07-03T01:45:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - src/scripts/update-index.ts
  - src/scripts/update-index.test.ts
  - docs/index.html
findings:
  critical: 0
  warning: 3
  info: 4
  total: 7
status: issues_found
---

# Phase 18: Code Review Report

**Reviewed:** 2026-07-03T01:45:00Z
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Reviewed the Phase 18 conditional News Digest link derivation in `src/scripts/update-index.ts`, its test suite, and the generated `docs/index.html`. The phase-specific logic is correct: `withNewsDigestLink` strips any parsed "News Digest" link and re-derives it strictly from fs state per entry, the hero block inherits the derived link set, and the live `docs/index.html` output was verified against disk state (only `docs/2026-07-03/news-digest.html` exists; exactly the 2026-07-03 hero + entry carry the link). All 9 tests pass, including add/omit/stale-removal/ordering cases. Determinism was verified by test and by tracing the marker-splice reconstruction.

However, the review surfaced three warnings: a latent parse/re-escape round-trip asymmetry that breaks idempotence for any entity-containing content, missing validation of the date read from `tmp/meeting-result.json` (which flows into fs paths and published hrefs unchecked), and silent no-op failure modes in `updatePortfolioHtml` that log success even when nothing was written. No critical issues found.

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: Parse/render round-trip double-escapes HTML entities (idempotence breaks for non-ASCII-safe links)

**File:** `src/scripts/update-index.ts:70,79,120`
**Issue:** `parseExistingEntries` captures href/label text in its already-HTML-escaped form (e.g., `&amp;` stays `&amp;` — no unescaping at line 79), but `renderEntryLinks` re-applies `escapeHtml` to those parsed values (line 120). Any href or label containing `&`, `'`, or `"` would become `&amp;amp;` on the next run, growing one level of escaping per run. This directly violates the determinism/idempotence contract the module documents (D-01/D-02) and that the determinism test asserts — the test only passes because current dates/labels are entity-free ASCII. It also silently breaks `withNewsDigestLink`'s strip-by-label comparison (`l.label !== "News Digest"`, line 54) for any label that ever round-trips through escaping. Latent today, but a single future link label with an ampersand (e.g., "Q&A Digest") corrupts the index cumulatively.
**Fix:** Unescape captured values in `parseExistingEntries` so the in-memory model is always raw text:
```typescript
function unescapeHtml(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&"); // must be last
}
// in parseExistingEntries:
links.push({ href: unescapeHtml(lm[1]), label: unescapeHtml(lm[2]) });
```

### WR-02: `getDate()` performs no validation on the date read from tmp/meeting-result.json

**File:** `src/scripts/update-index.ts:23-27,41`
**Issue:** `JSON.parse(raw) as { date: string }` is a blind cast. If `date` is missing, the failure path is confusing: `join(DOCS_DIR, undefined, ...)` throws inside `newsDigestFileExists` but is swallowed by the bare `catch` (line 43, returns `false`), and the run only dies later with an unrelated `TypeError` from `escapeHtml(undefined)`. If `date` is a malformed string (e.g., `"2026-7-3"` or `"../../something"`), no error occurs at all: the value flows unvalidated into `join(DOCS_DIR, date, "news-digest.html")` (fs probe outside `docs/` for traversal-shaped input), into published hrefs on the GitHub Pages index, and into `groupByMonth`'s `slice(0, 7)` (wrong month bucket for non-zero-padded dates). The tmp file is produced by the project's own pipeline, so this is a robustness gap rather than an exploitable boundary — but a partially-written or corrupted `meeting-result.json` currently results in publishing garbage entries rather than failing loudly.
**Fix:** Validate before use and fail with a clear message:
```typescript
async function getDate(): Promise<string> {
  const raw = await readFile(join(TMP_DIR, "meeting-result.json"), "utf-8");
  const result = JSON.parse(raw) as { date?: unknown };
  if (typeof result.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(result.date)) {
    throw new Error(`meeting-result.json: 不正な date 値です: ${String(result.date)}`);
  }
  return result.date;
}
```

### WR-03: `updatePortfolioHtml` silently no-ops and logs success when markers/patterns are missing

**File:** `src/scripts/update-index.ts:237-250`
**Issue:** Two silent failure modes, in contrast to `updateIndexHtml` which throws when its markers are missing (line 206-208):
1. Line 240: `content.replace(MARKER, ...)` — if `<!-- REPORT_ENTRIES -->` is absent from `portfolio.html`, `replace` is a no-op, yet line 239 has already logged `エントリを追加しました` (the log fires before/regardless of whether the marker matched).
2. Lines 244-247: if the `<div class="holdings-list">` pattern is absent, the holdings replace is also a no-op, yet line 250 unconditionally logs `ホールディングスリストを更新しました`.
A structurally-drifted `portfolio.html` loses the day's entry with success-looking logs, making the failure invisible in launchd output.
**Fix:** Guard both patterns and throw, mirroring `updateIndexHtml`:
```typescript
if (!content.includes(MARKER)) {
  throw new Error("portfolio.html: REPORT_ENTRIES マーカーが見つかりません。");
}
// and after the holdings replace:
if (!/(<div class="holdings-list">)/.test(withEntry)) {
  throw new Error("portfolio.html: holdings-list ブロックが見つかりません。");
}
```

## Info

### IN-01: Duplicate marker constants

**File:** `src/scripts/update-index.ts:9-11`
**Issue:** `MARKER` (line 11) is byte-identical to `START_MARKER` (line 9). Two names for the same value invite drift — if one is ever edited, `updateIndexHtml` and `updatePortfolioHtml` would silently target different markers.
**Fix:** Delete `MARKER` and use `START_MARKER` in `updatePortfolioHtml`.

### IN-02: Indentation drift in rendered link lists

**File:** `src/scripts/update-index.ts:122,129` (visible in `docs/index.html:149-152`)
**Issue:** `renderEntryLinks` joins links with `"\n          "` (10 spaces) but `renderEntryItem` indents the first link with 12 spaces (line 129), so the first anchor is misaligned relative to subsequent anchors in every rendered entry — observable throughout the generated `docs/index.html`. Cosmetic only (the parse regex tolerates it via `\s*`/lazy matches), but it makes generated-output diffs noisier than necessary.
**Fix:** Use a consistent indent, e.g. join with `"\n            "` (12 spaces) to match the first-link position.

### IN-03: Test coverage gaps and inert test scaffolding

**File:** `src/scripts/update-index.test.ts:3-11`
**Issue:** (1) `updatePortfolioHtml`, `getDate`, and `main` have zero test coverage — notably the silent no-op path in WR-03 is untested. (2) The `mkdir`/`readdir` entries in the fs mock (lines 6-7) are never used by the module under test — dead scaffolding. (3) The `vi.spyOn(process, "exit")` guard (line 11) is restored by `vi.restoreAllMocks()` in `afterEach` after the first test, so tests 2-9 run without it; it is only harmless because the `process.argv[1]` guard in `update-index.ts:259` never triggers under vitest anyway.
**Fix:** Add tests for `updatePortfolioHtml` (including missing-marker behavior once WR-03 is fixed); remove unused mock entries; move the `process.exit` spy into `beforeEach` or drop it.

### IN-04: In-place `writeFile` is non-atomic

**File:** `src/scripts/update-index.ts:224,249`
**Issue:** `index.html` and `portfolio.html` are rewritten in place. A crash or power loss mid-write leaves a truncated file; the next run would then fail marker detection (index) or silently drop content (portfolio). The docblock (line 196-197) notes reliance on OPS-02 checksum protection, which detects but does not prevent corruption.
**Fix:** Write to a temp file in the same directory and `rename` over the target for atomic replacement:
```typescript
const tmpPath = `${filePath}.tmp`;
await writeFile(tmpPath, updated, "utf-8");
await rename(tmpPath, filePath);
```

---

_Reviewed: 2026-07-03T01:45:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

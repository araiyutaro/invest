# Phase 18: Index/Nav Integration & Validation - Research

**Researched:** 2026-07-03
**Domain:** Static-site build script (Node.js/TypeScript) — conditional link derivation from filesystem state, in an existing HTML index generator
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### 実在チェックの適用範囲（遡及反映）
- **D-01:** `updateIndexHtml()` は実行のたびに、パース済みの**全エントリ**に対して `docs/{date}/news-digest.html` の fs 実在チェックを行う（forward-only 不採用）。約109件の existsSync コストは無視できる。冪等・自己修復的で、Phase 17 ライブ実行で生成済みの 2026-07-03 の欠落リンクも次回実行で自動反映される。一回限りのマイグレーションスクリプトは作らない。
- **D-02:** news-digest リンクは**毎回 fs から完全導出**する。実在→付与、不在→除去。パース結果に含まれる news-digest リンクは信用せず上書きする（ファイルが消えればリンクも消える。404リンクの残存余地を構造的に排除）。
- **D-03:** 既存3レポートリンク（daily-report / meeting-minutes / portfolio-report）には実在チェックを**広げない**。従来通りパース保存（過去エントリ）/ 固定生成（当日エントリ）のまま。変更面積を news-digest に限定し、成功基準3「既存ロジックに回帰なし」に忠実。

#### リンクの見せ方
- **D-04:** リンクラベルは **"News Digest"**（英語）。既存の Daily Report / Meeting Minutes / Portfolio Report と統一し、Phase 16 D-13 のページタイトル「News Digest - YYYY-MM-DD」とも一致。
- **D-05:** 配置は**末尾（4番目）**: Daily Report / Meeting Minutes / Portfolio Report / News Digest。加法的でレイアウトを乱さず、リンクなしの過去日付との見た目差分も最小。
- **D-06:** ヒーローブロック（最新レポート枠）にも News Digest リンクを表示する。`renderEntryLinks()` がヒーローとアコーディオンで共有されているため専用分岐は追加しない（最新日は Phase 17 D-08 によりファイル常時実在のため404リスクなし）。
- **D-07:** News Digest リンクは**他リンクと同じ見た目**。index.html への CSS 追加・変更は行わない（パープル強調不採用。OPS-02 チェックサム保護下の docs HTML への変更を最小化）。

#### 検証（Validation）
- **D-08:** 検証は**ユニットテスト + ライブ実行**の2段構え。TDD で `update-index.test.ts` に「実在→リンク付与」「不在→リンクなし」「パース済みリンクの除去（fs不在時）」「既存3リンクの保存」ケースを追加したうえで、実機で index.html への反映を確認する。
- **D-09:** 成功基準2（生成されなかった日はリンクなし）の実環境確認は、news-digest.html を持たない**既存の約108日分の過去エントリで自然検証**する。意図的な失敗注入・ファイル一時退避は行わない。
- **D-10:** ライブ検証は **`update-index.ts` の単体実行**（`npx tsx src/scripts/update-index.ts`、tmp/meeting-result.json が存在する状態）で行う。フル `/invest` 再実行はしない（パイプライン自体は Phase 17 で実証済み、本フェーズの変更は update-index.ts のみ）。翌朝の launchd 自動実行が自然な E2E となる。

### Claude's Discretion
- 実在チェックの実装詳細（`existsSync` 同期 vs `access` 非同期、チェック関数の切り出し方・命名）— 既存コードの慣例に従う
- テストにおける fs 依存の扱い（テンポラリディレクトリ fixture vs 実在チェック関数の注入）— 既存 `update-index.test.ts` の慣例に従う
- 当日エントリの構築方式（`buildStandardLinks` に条件付き4本目を足すか、全エントリ共通の導出パスに統一するか）— D-01/D-02 を満たす限り自由
- ライブ検証後の docs/index.html のコミット・デプロイの扱い（既存の deploy 慣例に従う）

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UI-04 | index.htmlの日付エントリに news-digest.html へのリンクがファイル実在時のみ追加される（欠落日は404リンクを生成しない） | Existing `parseExistingEntries`/`renderEntryLinks` already support variable link counts per entry (no schema change needed). Recommended design: single shared post-merge normalization step that strips any parsed "News Digest" link and re-derives it from `access()` fs check for every entry (old + new), leaving `buildStandardLinks` and the other 3 links completely untouched. See Architecture Patterns and Code Examples below. |
</phase_requirements>

## Summary

This phase is a small, well-bounded change to a single file (`src/scripts/update-index.ts`) that already has the structural flexibility needed: `parseExistingEntries()` explicitly does not assume a fixed link count per entry (existing code comment: "do not assume 3 links per entry"), and `renderEntryLinks()`/`renderHero()`/`renderAccordion()` already render whatever `entry.links` array is passed in. No schema change, no new dependency, no CSS change is required — the entire feature is a data-derivation problem: for every entry (not just the day being written), determine whether `docs/{date}/news-digest.html` exists on disk, and make `entry.links` reflect that truth exactly, discarding any previously-parsed News Digest link as untrusted.

The codebase currently has **zero existing usage of any file-existence check** (`existsSync`, `access`, `stat`) anywhere in `src/`. Every fs interaction in this project is async via `node:fs/promises` (`readFile`/`writeFile`/`mkdir`/`readdir`). This is a genuinely new pattern for the codebase, so the natural choice — for consistency with 100% of existing code and with `Promise.all`-friendly batching across ~118 entries — is `access()` from `node:fs/promises`, not the sync `existsSync` from `node:fs`. This keeps the file's imports on a single fs API surface and composes cleanly with `Promise.all(entries.map(...))`.

The cleanest implementation shape (offered as the Claude's Discretion "unify into a common derivation path" option in CONTEXT.md D-#) is: leave `buildStandardLinks(date)` completely unchanged (still returns exactly 3 links, D-03 compliant, zero regression risk to existing tests), merge as today, and then run one new async normalization pass over **every** merged entry (both the freshly-built today entry and every parsed historical entry) that (1) strips any link whose label is `"News Digest"` from `entry.links`, then (2) appends a fresh `{ href: "{date}/news-digest.html", label: "News Digest" }` link if and only if `access(docs/{date}/news-digest.html)` resolves. This single function is called uniformly for all ~118+1 entries, satisfies D-01/D-02 (full fs-derived truth every run) without touching D-03's 3 standard links, and requires no branching between "today" vs "historical" entries.

**Primary recommendation:** Add one new async helper (e.g., `withNewsDigestLink(entry: ReportEntry): Promise<ReportEntry>`) using `access()` from `node:fs/promises`, applied via `Promise.all` to the full merged entry list right after `mergeEntry()` and before `buildRegion()`; extend the existing `vi.mock("node:fs/promises", ...)` in `update-index.test.ts` to also mock `access` (currently absent from the mock), controlling per-path resolve/reject to simulate presence/absence in each test case.

## Architectural Responsibility Map

This project has no server/client tier split — it is a Node.js CLI build script that generates static HTML deployed to GitHub Pages. Tiers are mapped to this project's actual architecture (build script / static output / deploy / scheduler) rather than a classic web-app stack.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| news-digest.html existence check | Build Script (`update-index.ts`, Node CLI) | Filesystem (`docs/{date}/`) | Only the build script has both the merged entry list and fs access; the check must happen at generation time, not at view time (no client-side JS exists in `index.html`) |
| Conditional link derivation/rendering | Build Script (`renderEntryLinks`/normalization pass) | Static Output (`docs/index.html`) | Link markup is baked into static HTML at generation time; there is no runtime/client logic to defer this to |
| Existing 3 report links (unchanged) | Build Script (`buildStandardLinks`/`parseExistingEntries`) | Static Output | Explicitly out of scope for change (D-03); already correct |
| Deploy / commit of updated index.html | invest.md Step 4 (git-based deploy) | OPS-02 checksum protection (`run.sh` `PROTECT_FILES`) | Unchanged integration point; update-index.ts failure is still a hard-fail for the deploy step (existing invest.md behavior, confirmed unchanged) |
| Live E2E validation | OS Scheduler (launchd, next-morning `/invest` run) | Build Script (single-script live execution, D-10) | Per D-10, full pipeline re-run is deliberately deferred to the next natural scheduled run; this phase's live validation is `update-index.ts` alone |

## Standard Stack

### Core
No new libraries. This phase modifies one existing TypeScript file using only Node.js built-ins already present in `package.json`.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:fs/promises` (`access`, alongside existing `readFile`/`writeFile`) | Node.js built-in (project runtime: Node 20+ per existing `tsx`/`import.meta.dirname` usage) | Async file-existence check | 100% of existing fs usage in this codebase is via `node:fs/promises`; introducing sync `existsSync` from `node:fs` would be the only sync-fs call in the entire `src/` tree |
| `vitest` | Already a devDependency (existing `update-index.test.ts` uses it) | Test framework, `vi.mock("node:fs/promises")` | Established convention — no change needed |

### Supporting
No supporting libraries needed — `escapeHtml()` (already imported from `report-utils.ts`) continues to be used for the new link's `href`/`label`, matching every other interpolation site.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `access()` from `node:fs/promises` | `existsSync()` from `node:fs` (sync) | Simpler call syntax, no `Promise.all` needed, but introduces the codebase's first sync-fs call and a second fs import surface (`node:fs` + `node:fs/promises`) in a file/codebase that is otherwise 100% async. Rejected for consistency (also the discretion note explicitly frames this exact choice). |
| `access()` | `stat()` | Functionally equivalent for existence-only checks; `access()` is marginally more idiomatic for a pure existence check (no need for the returned `Stats` object) and is what most Node style guides recommend for "does this path exist" rather than "get metadata about this path." Either is fine; `access()` chosen for intent-clarity. |
| Per-entry `access()` calls via `Promise.all` (~118 calls) | Single `readdir(DOCS_DIR)` sweep + filter to build a Set of dated dirs, then per-entry `access(join(dir, date, "news-digest.html"))` only for dirs that exist | The `Promise.all`-of-118-`access()`-calls approach is simpler and was explicitly pre-approved as negligible cost in D-01 ("約109件の existsSync コストは無視できる"). A `readdir`-based optimization is unnecessary premature optimization for this scale and adds a second traversal step for no measurable benefit at ~118 entries. |

**Installation:**
No installation needed — no new packages.

**Version verification:** N/A — no new package.json dependencies are introduced by this phase.

## Package Legitimacy Audit

**Not applicable.** This phase installs no external packages — it exclusively uses Node.js built-in `node:fs/promises` APIs already imported in the target file, plus the existing `vitest`/`escapeHtml` already present in the codebase. No `npm install`, no new `package.json` entries, no slopcheck/registry verification required.

## Architecture Patterns

### System Architecture Diagram

```
tmp/meeting-result.json (date)
        │
        ▼
┌───────────────────────────┐
│  updateIndexHtml(date)     │
│  (src/scripts/update-index.ts)
└───────────────────────────┘
        │
        ├─► readFile(docs/index.html)
        │        │
        │        ▼
        │   parseExistingEntries(existingRegion)
        │        │  (unchanged — variable link count already supported)
        │        ▼
        │   existingEntries: ReportEntry[]  (~118, may include a stale "News Digest" link)
        │
        ├─► buildStandardLinks(date)  ──► newEntry (3 fixed links, UNCHANGED per D-03)
        │
        ▼
   mergeEntry(existingEntries, newEntry)  ──► merged: ReportEntry[]  (new date wins)
        │
        ▼
┌─────────────────────────────────────────────┐
│  NEW: Promise.all(merged.map(withNewsDigestLink))  │  ◄── D-01/D-02: runs for EVERY entry, every run
│                                               │
│  for each entry:                             │
│    1. strip any link labeled "News Digest"   │  ◄── D-02: never trust parsed news-digest link
│    2. access(docs/{entry.date}/news-digest.html)
│         resolves → append fresh News Digest link (D-04/D-05: label "News Digest", position 4th)
│         rejects  → leave entry.links as-is (3 or fewer links, no 404)
└─────────────────────────────────────────────┘
        │
        ▼
   entriesWithDigestLinks: ReportEntry[]
        │
        ▼
   buildRegion(entriesWithDigestLinks)
        │  (UNCHANGED — sorts, builds hero + month accordion)
        ├─► renderHero(newest)        ──► shares renderEntryLinks() — D-06 satisfied automatically
        └─► renderAccordion(groups)   ──► shares renderEntryLinks() — D-06 satisfied automatically
        │
        ▼
   regionHtml → spliced back between REPORT_ENTRIES markers
        │
        ▼
   writeFile(docs/index.html)  (single read + single write, UNCHANGED — OPS-02 checksum-safe)
```

### Recommended Project Structure

No new files or folders. Single file modified:

```
src/scripts/
├── update-index.ts        # Add: withNewsDigestLink() helper + wiring in updateIndexHtml()
├── update-index.test.ts   # Add: 4 new test cases (D-08), extend vi.mock to include `access`
└── report-utils.ts         # UNCHANGED (escapeHtml already exported/used)
```

### Pattern 1: Fs-derived link normalization (uniform across all entries)

**What:** A single async function applied uniformly to every merged entry (not branched by "is this today's entry" vs "is this historical") that discards any parsed News Digest link and re-derives it strictly from current fs state.

**When to use:** Whenever a report link's validity depends on external, potentially-absent state (a file that a separate, fallible pipeline step may or may not have written) rather than on data the current script itself just generated.

**Example:**
```typescript
// New code, following the existing async fs/promises convention already used
// throughout this file (readFile/writeFile) and write-news-digest.ts.
import { access, readFile, writeFile } from "node:fs/promises";

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

Wired into `updateIndexHtml`:
```typescript
// Source: pattern derived from existing updateIndexHtml() structure (update-index.ts:174-200)
const merged = mergeEntry(existingEntries, newEntry);
const withDigestLinks = await Promise.all(merged.map(withNewsDigestLink)); // NEW line
const regionHtml = buildRegion(withDigestLinks); // was: buildRegion(merged)
```

### Anti-Patterns to Avoid

- **Trusting the parsed News Digest link as a cache:** Do not skip the fs check "if a News Digest link is already present in the parsed HTML." The whole point of D-02 is that a file that existed yesterday may have been removed/renamed/corrupted, or (inverse case) this run may be the first time the file exists for a date that previously had no link. Always strip-then-recheck.
- **Branching `buildStandardLinks` by "does news-digest exist for today":** Adding an `if (existsSync(...))` conditional 4th push directly inside `buildStandardLinks(date)` only fixes the *today* entry and does nothing for the ~118 historical entries (which need the exact same fs-derived treatment per D-01). The unified normalization pass after merge is strictly more correct and requires less code (one function, not two).
- **Adding CSS/markup for a distinct News Digest visual style:** D-07 explicitly rejects this. Do not add a new class or accent color even if it seems like a natural UX improvement — it is out of scope and increases the OPS-02 checksum-protected diff unnecessarily.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Detecting whether a file exists | A custom `try { readFileSync } catch` wrapper, or a homegrown directory-listing cache | `access()` from `node:fs/promises` (or `stat()`) | Node's built-in is the canonical, race-condition-documented way to check existence; a `readFile`-based check would read the entire file content unnecessarily just to test existence |
| Parsing/preserving variable-length link lists per entry | A new parser | Existing `parseExistingEntries()` — already handles variable link counts per entry, no change needed | Already implemented, tested, and explicitly designed for "do not assume N links per entry" |
| HTML escaping for the new link's href/label | New escaping logic | Existing `escapeHtml()` from `report-utils.ts`, already used by `renderEntryLinks()` for every link | Consistency with every other interpolation site in the codebase; avoids reintroducing an XSS/attribute-breakout risk this project has already solved once |

**Key insight:** This phase adds zero new abstractions — it composes three already-tested primitives (`parseExistingEntries`, `access()`, `escapeHtml()`/`renderEntryLinks()`) with one small new pure-ish async function. Resisting the urge to build a bespoke caching layer, a new schema, or a separate rendering branch for News Digest keeps the diff minimal and the regression risk (success criterion 3) low.

## Common Pitfalls

### Pitfall 1: Checking existence only for the "today" entry, not historical entries

**What goes wrong:** A developer adds a 4th conditional link inside `buildStandardLinks(date)` (the function that builds only the newly-written date's links), satisfying success criterion 1 for the current run but leaving all ~118 previously-parsed entries untouched — including the already-known gap where 2026-07-03's entry (written by Phase 17's live run) is currently missing the News Digest link despite the file existing on disk.
**Why it happens:** `buildStandardLinks` is the obvious/nearest code to touch since it's the only function that currently deals with "the 3 standard links"; it's easy to miss that historical entries flow through a completely separate code path (`parseExistingEntries`) that also needs the same treatment.
**How to avoid:** Apply the fs-derived normalization pass to the full `merged` array (both the new entry and every historical entry) as a single uniform step, per D-01/Pattern 1 above — never special-case "today."
**Warning signs:** A test that only checks the newly-passed date's entry, with no assertion about historical entries in the fixture gaining/losing a News Digest link.

### Pitfall 2: Not stripping the previously-parsed News Digest link before re-deriving

**What goes wrong:** If the normalization pass only *appends* a News Digest link when the file exists, but never removes one that was already present in the parsed HTML from a prior run, a stale link survives indefinitely once added — even after the underlying file is deleted or the entry is otherwise stale. This structurally reintroduces the exact 404 risk the phase exists to eliminate (D-02 exists specifically to close this gap).
**Why it happens:** "Append if exists" alone looks correct in the common case (file created once, never removed) and passes a naive test; the removal half only matters in the file-deletion/rename edge case, which is easy to skip without a dedicated test.
**How to avoid:** Always filter out any link labeled `"News Digest"` from `entry.links` first, unconditionally, before conditionally re-adding it based on the current fs check (Pattern 1's `withNewsDigestLink`).
**Warning signs:** A test named something like "removal of stale link when file is deleted" is missing from `update-index.test.ts` (D-08 explicitly calls out this exact test case: "パース済みリンクの除去（fs不在時）").

### Pitfall 3: Widening the fs-existence pattern to the other 3 report links

**What goes wrong:** Once `access()`-based existence checking exists in the file, it's tempting to "improve" the daily-report/meeting-minutes/portfolio-report links the same way for symmetry. This directly contradicts D-03 and inflates the diff/regression surface for links that have never had a 404 problem (they are always written together by the same trusted, always-succeeding `Promise.all` in `generate-report.ts`).
**Why it happens:** Symmetry/consistency instinct — "if we check one link's existence, why not all four?"
**How to avoid:** Scope the new `withNewsDigestLink()` function's filter/append logic strictly to the `"News Digest"` label; leave the other 3 links exactly as they flow through `parseExistingEntries`/`buildStandardLinks` today, unmodified.
**Warning signs:** A code review diff touching `buildStandardLinks`'s daily-report/meeting-minutes/portfolio-report entries, or a new fs check keyed on `daily-report.html`/`meeting-minutes.html`/`portfolio-report.html`.

### Pitfall 4: Vitest mock gap — `access` not present in `vi.mock("node:fs/promises", ...)`

**What goes wrong:** The existing `update-index.test.ts` fully mocks the `node:fs/promises` module (`vi.mock("node:fs/promises", () => ({ readFile: ..., writeFile: ..., mkdir: ..., readdir: ... }))`, lines 3-8). If `access` is added to `update-index.ts` without also adding it to this mock object, `access` will be `undefined` in the test environment (since the mock factory replaces the entire module), causing a `TypeError: access is not a function` at test run time — not a clean "existence check failed" — because Vitest's `vi.mock` factory fully replaces named exports rather than partially patching them.
**Why it happens:** `vi.mock` with a factory function is an exhaustive replacement of the module's exports; any export used by the implementation but omitted from the mock factory becomes `undefined`, not "the real implementation" or "auto-mocked."
**How to avoid:** Add `access: vi.fn()` to the existing mock factory object, then configure per-test `mockImplementation` (resolve for paths that should exist, reject for paths that should not) exactly like the existing pattern already used for `readFile`'s `mockImplementation((path) => ...)` in `beforeEach`.
**Warning signs:** A newly-added test crashes with "access is not a function" or similar rather than a clean assertion failure.

## Code Examples

### Extending the existing test mock to support `access` (D-08 test infrastructure)

```typescript
// Source: pattern extends existing update-index.test.ts (lines 1-8, 52-62)
vi.mock("node:fs/promises", () => ({
  readFile: vi.fn().mockRejectedValue(new Error("ENOENT")),
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
  readdir: vi.fn().mockResolvedValue([]),
  access: vi.fn().mockRejectedValue(new Error("ENOENT")), // NEW: default = file does not exist
}));

// In a test that needs a specific date's news-digest.html to "exist":
beforeEach(async () => {
  const fsMock = await import("node:fs/promises");
  (fsMock.access as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
    // Simulate news-digest.html existing only for these dates:
    if (String(path).includes("2026-07-01/news-digest.html")) return Promise.resolve(undefined);
    return Promise.reject(new Error("ENOENT"));
  });
});
```

### Test case matrix required by D-08

```typescript
// Source: derived directly from D-08's four named cases
// 1. "実在→リンク付与" — access() resolves for a date → News Digest link appended, at position 4
// 2. "不在→リンクなし" — access() rejects for a date → no News Digest link, no 404 possibility
// 3. "パース済みリンクの除去（fs不在時）" — fixture HTML already contains a News Digest link for
//    a date whose access() now rejects → link must be stripped from output (Pitfall 2)
// 4. "既存3リンクの保存" — regression check: daily-report/meeting-minutes/portfolio-report hrefs
//    for both historical and new entries are byte-identical to input/buildStandardLinks output
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `buildStandardLinks(date)` unconditionally emits exactly 3 links, always trusted to correspond to files that exist | Fs-derived, per-entry, per-run normalization for the News Digest link only; the 3 standard links remain unconditionally trusted (D-03) | This phase (Phase 18) | The News Digest link becomes the first link in this codebase whose presence in `index.html` is not a static assumption but a live fs fact, re-verified every run |

**Deprecated/outdated:** None — no existing pattern is being replaced; this is additive.

## Runtime State Inventory

Not applicable — this phase is not a rename/refactor/migration. It is additive: a new derivation rule for an existing, already-extensible link-rendering mechanism. No datastore keys, service configs, OS-registered state, secrets, or build artifacts carry any renamed identifier. (Explicitly confirmed per the "skip for greenfield phases" instruction — this phase is additive-greenfield relative to `update-index.ts`'s existing structure, even though the target file itself is pre-existing.)

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Node.js `access()` from `node:fs/promises` resolves for an accessible path and rejects (throws) for a missing one, with no other required arguments for a plain existence check | Architecture Patterns, Code Examples | Extremely low — this is a foundational, long-stable Node.js core API (present since Node 10+); if wrong, the unit test suite (D-08) would fail immediately at TDD RED/GREEN stage, well before any live validation, so the blast radius of this assumption being wrong is a same-session test failure, not a production incident |
| A2 | The project's Node.js runtime version supports `node:fs/promises` `access` (it already supports `readFile`/`writeFile`/`mkdir`/`readdir` from the same module, per existing code) | Standard Stack | None realistically — `access` has been part of `fs/promises` since its introduction (Node 10+), strictly older than the `mkdir`/`readdir` promise APIs already in use in this exact file |

**Both assumptions are LOW risk and self-verifying via the TDD unit tests mandated by D-08** — if either is wrong, the planner's Wave 0 test-writing step will surface it immediately, not at live-execution or production time.

## Open Questions (RESOLVED)

None outstanding. CONTEXT.md's "Claude's Discretion" items are fully resolved by this research:
- Sync vs async existence check → async `access()` (Standard Stack, Alternatives Considered)
- Test fs-dependency handling → extend existing `vi.mock("node:fs/promises")` factory (Pitfall 4, Code Examples)
- Today-entry construction approach → unify into one shared post-merge normalization pass, `buildStandardLinks` untouched (Summary, Pattern 1)
- Live-verification deploy/commit handling → unchanged, follows existing invest.md Step 4 deploy convention (Architectural Responsibility Map)

## Environment Availability

Skipped — this phase has no external tool/service/runtime dependencies beyond the project's own existing Node.js/tsx/vitest toolchain, all of which are already installed and in active use by the very file being modified (confirmed via direct inspection; no `command -v` probing needed for built-in `node:fs/promises` APIs).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest (version pinned in `package.json` devDependencies; already used by `update-index.test.ts`) |
| Config file | none — `package.json` `"test": "vitest run"` script, no dedicated `vitest.config.*` found in repo root |
| Quick run command | `npx vitest run src/scripts/update-index.test.ts` |
| Full suite command | `npm test` (runs `vitest run` across all `*.test.ts`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|--------------------|--------------|
| UI-04 | News Digest link appended when `docs/{date}/news-digest.html` exists | unit | `npx vitest run src/scripts/update-index.test.ts -t "adds News Digest link"` | ❌ Wave 0 (new test case, D-08 case 1) |
| UI-04 | No News Digest link (no 404) when file absent | unit | `npx vitest run src/scripts/update-index.test.ts -t "omits News Digest link"` | ❌ Wave 0 (new test case, D-08 case 2) |
| UI-04 | Stale parsed News Digest link removed when file no longer exists | unit | `npx vitest run src/scripts/update-index.test.ts -t "removes stale News Digest link"` | ❌ Wave 0 (new test case, D-08 case 3) |
| UI-04 (success criterion 3) | Existing 3 report links unaffected (no regression) | unit | `npx vitest run src/scripts/update-index.test.ts -t "preserves the 2-link entry"` (existing test, must still pass unmodified) + one new test asserting daily/meeting/portfolio hrefs on an entry that also gains a News Digest link | ✅ existing test file already covers the 3-link case; ❌ Wave 0 for the combined 3+News-Digest assertion |
| UI-04 (success criteria 1+2, real environment) | Live single-script execution against real `docs/` tree | manual (D-10) | `npx tsx src/scripts/update-index.ts` (with `tmp/meeting-result.json` present) — verify `docs/index.html` gains a News Digest link only for 2026-07-03 (and any other date with a real `news-digest.html`), and the ~108 dates without the file show no link | N/A — live execution, not part of the automated suite; this is D-08's second validation leg |

### Sampling Rate
- **Per task commit:** `npx vitest run src/scripts/update-index.test.ts` (quick, file-scoped)
- **Per wave merge:** `npm test` (full suite — confirm no cross-file regression, e.g. in `generate-news-digest.test.ts` or other consumers of `report-utils.ts`)
- **Phase gate:** Full suite green, plus the D-10 live single-script execution against the real `docs/` tree, before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] Extend `vi.mock("node:fs/promises", ...)` in `src/scripts/update-index.test.ts` to include `access: vi.fn()` (currently absent — see Pitfall 4)
- [ ] Add 3-4 new `it(...)` cases to `update-index.test.ts` per D-08's named scenarios (exists→link, absent→no link, stale-link-removed, existing-3-preserved-alongside-4th)
- [ ] No new test file needed — all new tests belong in the existing `update-index.test.ts` (same module under test, same fixture conventions)

## Security Domain

`security_enforcement` is not explicitly disabled in `.planning/config.json` (only `workflow._auto_chain_active: false` is present) — treat as enabled, per default rule.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No | Static, unauthenticated GitHub Pages site — no auth boundary anywhere in this project |
| V3 Session Management | No | No sessions; fully static output |
| V4 Access Control | No | No access-control boundary; single-operator local CLI script |
| V5 Input Validation | Yes | The `date` string used to build the fs path (`docs/{date}/news-digest.html`) originates from `tmp/meeting-result.json`'s `date` field, already validated upstream (Phase 14.1 convention: `^\d{4}-\d{2}-\d{2}$`, per `17-CONTEXT.md`'s cited pattern). For historical entries, `date` comes from `parseExistingEntries()`'s regex capture `([\d-]+)` against already-deployed, self-authored `index.html` — not externally attacker-controlled input. No new validation needed; the existing `date` provenance chain already satisfies path-traversal safety (mirrors `write-news-digest.ts`'s explicit T-17-03 comment: never derive `date` from untrusted LLM output). |
| V6 Cryptography | No | Not applicable — no cryptographic operations in this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Path traversal via a malformed `date` string used to build an fs path (e.g., `../../etc/passwd`) | Tampering | Already mitigated upstream: `date` for the new entry comes only from `tmp/meeting-result.json` (Phase 14.1-validated `^\d{4}-\d{2}-\d{2}$`); `date` for historical entries comes from regex capture group `([\d-]+)` in `parseExistingEntries`, itself only ever populated by this same script's own prior writes — not externally-supplied. No new mitigation required in this phase, but do not widen the regex or accept `date` from any new untrusted source without re-validating the pattern. |
| Stored XSS via an unescaped href/label for the new News Digest link | Tampering / Spoofing | Continue using `escapeHtml()` (already imported in `update-index.ts`) for both `href` and `label` on the new link, exactly as `renderEntryLinks()` already does for all other links — no new escaping logic needed, just ensure the new link object flows through the same `renderEntryLinks()` call path (it does, since it's appended to `entry.links` before rendering) |

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection: `/Users/arai/invest/src/scripts/update-index.ts` (full file, all functions read)
- Direct codebase inspection: `/Users/arai/invest/src/scripts/update-index.test.ts` (full file, existing mock/fixture conventions read)
- Direct codebase inspection: `/Users/arai/invest/src/scripts/write-news-digest.ts` (fs write conventions, date-provenance/path-traversal comment T-17-03)
- Direct codebase inspection: `/Users/arai/invest/src/scripts/report-utils.ts` (`escapeHtml` implementation)
- Direct codebase inspection: `/Users/arai/invest/docs/index.html` (real REPORT_ENTRIES markup, confirmed identical shape to test fixture)
- Direct codebase inspection: `/Users/arai/invest/docs/2026-07-03/` (confirmed `news-digest.html` exists) vs `/Users/arai/invest/docs/2026-06-10/` (confirmed it does not) — live ground truth for D-09's "natural verification" claim
- Direct codebase inspection: `/Users/arai/invest/.claude/commands/invest.md` lines 1835-1863 (Step 4 deploy integration point, confirmed unchanged hard-fail behavior)
- Shell command: `grep -rn "existsSync\|from \"node:fs\"" src/` — confirmed zero existing sync-fs usage anywhere in `src/`
- Shell command: `ls docs/ | grep -E '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' | wc -l` → 118 dated directories (confirms D-01's "約109件" estimate is in the right order of magnitude, slightly higher at research time)
- `.planning/phases/17-pipeline-integration-orchestration/17-CONTEXT.md` — D-08 (fallback page always written), D-10 (script ordering)
- `.planning/research/SUMMARY.md`, `.planning/research/PITFALLS.md` — Phase 4/Pitfall 4 (dangling 404 links), confirmed the recommended conditional-link approach

### Secondary (MEDIUM confidence)
None used — all claims in this research are grounded in direct codebase inspection or well-established Node.js core API behavior.

### Tertiary (LOW confidence)
None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; recommendation is a Node.js core API (`access` from `node:fs/promises`) already structurally consistent with 100% of existing fs usage in this file and codebase
- Architecture: HIGH — directly grounded in reading the actual `update-index.ts` implementation and its already-flexible `parseExistingEntries`/`renderEntryLinks` design; the recommended pattern is a natural extension of existing code shape, not a novel architecture
- Pitfalls: HIGH — all four pitfalls are grounded in specific line-level evidence from the actual test file's `vi.mock` factory (Pitfall 4), the actual `buildStandardLinks` function shape (Pitfall 1/3), and D-02's explicit rationale (Pitfall 2)

**Research date:** 2026-07-03
**Valid until:** 30 days (stable domain — no external API/library surface to go stale; the only staleness risk is if `update-index.ts` itself changes before planning begins, which the planner should re-check via a fresh `Read` at plan time)

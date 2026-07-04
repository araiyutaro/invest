---
phase: 24-digest-meeting-cross-reference
reviewed: 2026-07-04T02:05:09Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - src/meeting/digest-crossref.ts
  - src/meeting/digest-crossref.test.ts
  - src/scripts/generate-news-digest.ts
  - src/scripts/generate-news-digest.test.ts
  - src/scripts/report-utils.ts
  - src/scripts/write-news-digest.ts
  - src/scripts/write-news-digest.test.ts
  - .claude/commands/invest.md
findings:
  critical: 1
  warning: 4
  info: 2
  total: 7
status: issues_found
---

# Phase 24: Code Review Report

**Reviewed:** 2026-07-04T02:05:09Z
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Reviewed the deterministic (no-LLM) digest-meeting cross-reference feature: the matcher (`digest-crossref.ts`), the renderer additions (`generate-news-digest.ts` / `report-utils.ts`), the pipeline glue (`write-news-digest.ts`), and the surgical `invest.md` Step 3e edit. Most of the explicitly-called-out invariants hold up: every rendered chip string (ticker, verdict, theme keyword) passes through `escapeHtml`; the fail-soft crossref computation is properly isolated in its own nested `try/catch` and never calls `process.exit`/rethrows/sets exit code; the byte-identical no-annotation contract is respected at the document level; there is no dependency on `calculatePriorityScore`/`filter.js`; sector-label bracket stripping and case-insensitive title matching work as documented; and `invest.md`'s Step 3e never emits `[PIPELINE:FAIL]` for crossref failures.

However, I found one concrete, reproducible **BLOCKER**: because `DigestCrossRefMap` is a plain JS object (`Record<string, DigestCrossRef>`) indexed by attacker/upstream-controlled `article.id` strings, any article whose `id` happens to equal an inherited `Object.prototype` member name (e.g. `"toString"`, `"constructor"`, `"valueOf"`, `"hasOwnProperty"`) causes `crossRefMap[a.id]` to resolve to an inherited function instead of `undefined`, which then crashes `formatDigestCrossRefChipsHtml` when it dereferences `.tickerMatches.length` on that function. This exception propagates out of `generateNewsDigestHtml` inside the *non-isolated* part of `write-news-digest.ts`'s try block, causing the entire day's digest to fall back to the "生成できませんでした" page — a real, provable regression that does not require any crossref match to exist (an empty `crossRefMap = {}` is sufficient to trigger it). I verified this behavior directly with `node`.

Additional warnings cover a ticker-dedup gap in the cap logic, false-positive-prone substring theme matching, a documentation gap in `invest.md` for the "neither `[digest-crossref] OK` nor `FAIL`" case, and a minor redundant-parse code smell in `write-news-digest.ts`. Info-level items note a misleading no-op `.slice()` and missing regression tests for the above.

## Critical Issues

### CR-01: `crossRefMap[a.id]` lookup can crash the whole digest via inherited `Object.prototype` properties

**File:** `src/scripts/generate-news-digest.ts:95` (lookup site) and `src/scripts/generate-news-digest.ts:51` (crash site), root cause in `src/meeting/digest-crossref.ts:28,79` (`DigestCrossRefMap` / `map` typed as plain `Record<string, DigestCrossRef>`)

**Issue:** `DigestCrossRefMap` is defined as `Record<string, DigestCrossRef>` — a plain JS object literal. `formatMarketGroupsHtml` looks up annotations with `crossRefMap?.[a.id]` (line 95), and `formatDigestCrossRefChipsHtml` immediately dereferences the result:

```ts
function formatDigestCrossRefChipsHtml(annotation: DigestCrossRef | undefined): string {
  if (annotation === undefined) return "";
  if (annotation.tickerMatches.length === 0 && annotation.themeMatches.length === 0) return "";
  ...
```

Because plain objects inherit from `Object.prototype`, a bracket lookup for a key that was *never explicitly set* on the map still returns a truthy value if that key name collides with an inherited property — e.g. `"toString"`, `"constructor"`, `"valueOf"`, `"hasOwnProperty"`, `"isPrototypeOf"`, `"propertyIsEnumerable"`, `"toLocaleString"`. In that case `annotation === undefined` is `false`, but `annotation.tickerMatches` is `undefined` (since the inherited function has no such property), so `.length` throws `TypeError: Cannot read properties of undefined (reading 'length')`.

Reproduced directly:
```js
const map = {};                     // crossRefMap can be genuinely empty ({}) — no match needed
console.log(map['toString'] === undefined); // false
map['toString'].length;             // TypeError: Cannot read properties of undefined (reading 'length')
```

This means: if ANY curated article has `id === "toString"` (or any other `Object.prototype` member name) — regardless of whether it has a real crossref match — rendering that day's digest throws. Since `generateNewsDigestHtml(curation, date, crossRefMap)` is called inside the *outer* try block in `write-news-digest.ts` (not the isolated crossref-only try/catch), this exception is caught by the outer `catch`, which overwrites the entire digest with the null-fallback page ("本日のニュースキュレーションは生成できませんでした") and sets `process.exit(1)` — i.e. a single unlucky/adversarial article id wipes out the *entire* day's curated news display, not just its own crossref annotation. `article.id` originates from the news article pool (`tmp/news.json`), which is populated from upstream news-source data and is explicitly treated as untrusted input elsewhere in this codebase (see T-17-03 comment in `write-news-digest.ts:15`).

**Fix:** Use a `Map<string, DigestCrossRef>` instead of a `Record`, which has no prototype-chain lookup ambiguity, or guard the lookup with `hasOwnProperty`:

```ts
// digest-crossref.ts
export type DigestCrossRefMap = ReadonlyMap<string, DigestCrossRef>;
// build with: const map = new Map<string, DigestCrossRef>(); map.set(article.id, {...});

// generate-news-digest.ts
function formatMarketGroupsHtml(
  articles: ReadonlyArray<CuratedArticle>,
  crossRefMap?: ReadonlyMap<string, DigestCrossRef>,
): string {
  ...
  : groupArticles.map((a) => formatArticleCardHtml(a, crossRefMap?.get(a.id))).join("\n");
```

If keeping `Record` for API simplicity, at minimum guard the read:
```ts
const annotation = crossRefMap && Object.prototype.hasOwnProperty.call(crossRefMap, a.id)
  ? crossRefMap[a.id]
  : undefined;
```

## Warnings

### WR-01: Duplicate tickers within a single article are not deduplicated before capping

**File:** `src/meeting/digest-crossref.ts:82-98`
**Issue:** The per-article loop pushes one `tickerMatches` entry per element of `article.tickers` with no de-duplication. If `article.tickers` contains a repeated (or case/whitespace-variant) ticker — e.g. `["XLV", "XLV", "XLF"]`, or `["xlv", "XLV"]` which both normalize to `"XLV"` — the subsequent `slice(0, MAX_TICKER_MATCHES_PER_ARTICLE)` (cap = 2) can be entirely consumed by duplicate entries of the same symbol, silently dropping a legitimate distinct second match (`XLF` in the example). This is a genuine correctness gap in the "cap is stable-order slice" contract, since the cap is meant to bound *distinct* matches, not raw array entries.
**Fix:** De-duplicate by normalized symbol before capping, e.g. track a `Set<string>` of already-added symbols:
```ts
const seen = new Set<string>();
for (const ticker of article.tickers) {
  const norm = normalizeHoldingSymbol(ticker);
  if (seen.has(norm)) continue;
  seen.add(norm);
  if (verdictByTicker.has(norm)) tickerMatches.push({ symbol: norm, verdict: verdictByTicker.get(norm) });
  else if (scoredTickerSet.has(norm)) tickerMatches.push({ symbol: norm });
}
```

### WR-02: Theme keyword substring matching has no word-boundary check, risking false-positive chips

**File:** `src/meeting/digest-crossref.ts:39-45` (`titleIncludesAny`), used at line 100-102 for theme matching
**Issue:** `titleIncludesAny` performs plain `String.includes` on lowercased text with no word-boundary enforcement. This is fine for ticker-symbol matching (exact set membership after normalization), but it is also reused for theme-keyword matching against article titles. If `extractThemeKeyword` ever produces a short keyword (e.g. a sector labeled just `"AI"`, `"EV"`, or `"PC"` without a following ticker), it will match as a *substring* of unrelated words — e.g. `"ai"` matches inside `"Taiwan"`, `"explain"`, `"maintain"`; `"ev"` matches inside `"Steve"`, `"never"`. Since `sectorRecommendations[].sector` is LLM-generated (untrusted per review scope) and not guaranteed to always be a multi-character full sector name, this can silently attach misleading "🗣 関連テーマ" chips to unrelated articles.
**Fix:** Add a minimum-length guard (e.g. keywords shorter than ~3 chars are excluded from theme matching) and/or use a word-boundary-aware regex (`new RegExp("\\b" + escapeRegExp(keyword) + "\\b", "i")`) instead of plain substring `includes`.

### WR-03: `invest.md` Step 3e has no instruction for the "neither `[digest-crossref] OK` nor `FAIL`" case

**File:** `.claude/commands/invest.md:2021-2033`
**Issue:** `write-news-digest.ts` only ever prints `[digest-crossref] OK` or `[digest-crossref] FAIL: ...` when the crossref computation is *reached* — i.e. only after `news-curation.json` validation and `resolveNewsCuration` succeed (see `write-news-digest.ts:22-41`). If the outer try block fails earlier (e.g. `news-curation.json` missing/invalid, or `news.json` pool missing), the crossref block never runs and neither marker is ever printed to stdout/stderr. The Step 3e instructions only describe what to do "if `[digest-crossref] OK]` appears" / "if `[digest-crossref] FAIL]` appears" — there is no fallback instruction for when neither string appears in the captured output, leaving the pipeline-operating LLM without guidance (it might invent an ad-hoc marker, or silently skip emitting `[STEP:digest-crossref:*]` entirely, which is inconsistent behavior not specified by the workflow).
**Fix:** Add an explicit branch, e.g.: "出力に `[digest-crossref]` を含む行が一切ない場合（ニュースキュレーション自体が失敗した日）は `[STEP:digest-crossref:SKIP]` を出力し、これも `[PIPELINE:FAIL]` の対象にしないこと。"

### WR-04: Redundant duplicate `JSON.parse` of `meetingRaw` in `write-news-digest.ts`

**File:** `src/scripts/write-news-digest.ts:17,33`
**Issue:** `meetingRaw` is parsed once at the top (`JSON.parse(meetingRaw) as { date: string }`, line 17, unvalidated cast) and then parsed again inside the crossref try block (`validateMeetingResult(JSON.parse(meetingRaw))`, line 33). This duplicate parse of the identical string is unnecessary work and a minor maintenance smell — a future edit to one parse call site could silently diverge from the other (e.g. different error handling assumptions) since they're not obviously linked.
**Fix:** Parse once and reuse the parsed value for both the `date` field access and the zod validation, e.g. `const meetingRawParsed = JSON.parse(meetingRaw); const { date } = meetingRawParsed as { date: string }; ... const meetingResult = validateMeetingResult(meetingRawParsed);`.

## Info

### IN-01: `.slice(0, MAX_THEME_MATCHES_PER_ARTICLE)` on a single-element array is a no-op that misrepresents the cap

**File:** `src/meeting/digest-crossref.ts:106-109`
**Issue:** `sectorKeywords.find(...)` returns at most one match, so `[{ keyword: matchedKeyword }].slice(0, MAX_THEME_MATCHES_PER_ARTICLE)` is always a no-op (array length is always ≤ 1 already). This reads as if the theme cap were being enforced by the slice, but it's actually enforced upstream by `.find()` returning only the first match — the slice call is misleading/dead code from a reviewer's perspective.
**Fix:** Either drop the `.slice()` call and rely on (and comment) the `.find()`-enforced cap, or if the intent is genuinely to support multiple theme matches in the future, change `.find()` to `.filter()` and let the constant do real work.

### IN-02: Missing regression tests for cap-with-duplicates and reserved-property-name article ids

**File:** `src/meeting/digest-crossref.test.ts`, `src/scripts/generate-news-digest.test.ts`
**Issue:** Neither test file exercises the duplicate-ticker cap edge case (WR-01) nor an article `id` equal to a reserved `Object.prototype` member name (CR-01). Both are now-known failure modes with no regression coverage.
**Fix:** Add a `digest-crossref.test.ts` case with `tickers: ["XLV", "XLV", "XLF"]` asserting the cap still surfaces two distinct symbols, and a `generate-news-digest.test.ts` case with an article `id: "toString"` (and an empty/undefined `crossRefMap`) asserting `generateNewsDigestHtml` does not throw.

---

_Reviewed: 2026-07-04T02:05:09Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

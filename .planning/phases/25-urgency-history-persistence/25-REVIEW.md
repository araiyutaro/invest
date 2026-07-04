---
phase: 25-urgency-history-persistence
reviewed: 2026-07-04T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - src/portfolio/urgency-history.ts
  - src/portfolio/urgency-history.test.ts
  - src/scripts/write-urgency-history.ts
  - src/scripts/write-urgency-history.test.ts
  - .claude/commands/invest.md
findings:
  critical: 0
  warning: 2
  info: 4
  total: 6
status: issues_found
---

# Phase 25: Code Review Report

**Reviewed:** 2026-07-04T00:00:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Reviewed the urgency-history persistence feature: a pure library module
(`urgency-history.ts`), a fail-soft CLI wrapper (`write-urgency-history.ts`),
their vitest suites, and the new Step 3f / Step 4 blocks in `invest.md`.

The security-sensitive surfaces are sound. Prototype pollution is structurally
blocked on two independent levels: (1) `isValidDateKey` rejects `__proto__`
before any keyed write, and (2) the merge uses a computed-key object literal
(`{ ...history, [dateKey]: snapshots }`), which creates an own property and does
not mutate the prototype even for the literal `__proto__` string. Immutability
holds throughout (spread + `.map`, no in-place mutation). The Step 4 `node -e`
deploy block validates the LLM-supplied `date` against `/^\d{4}-\d{2}-\d{2}$/`
before interpolation and uses `spawnSync` with an argv array for
commit/push — no shell-injection surface. The `mkdir(DATA_DIR, {recursive:true})`
git-add-128 guard is correctly the first statement and is double-defended by the
`existsSync('data')` check in Step 4. No data-loss path exists: corrupted
existing history exits before any write, and a missing file legitimately starts
from `{}`.

The two warnings both concern the fail-soft contract: certain malformed-input
paths throw out of `main()` and surface as a generic `Fatal error:` / exit 1
instead of the documented `[urgency-history] FAIL:` signal that Step 3f expects
to summarize. No blockers.

## Warnings

### WR-01: `extractUrgencySnapshots` can throw on a malformed holding, contradicting its "throw なし" contract and the fail-soft design

**File:** `src/portfolio/urgency-history.ts:27-36` (via `holding-news.ts:32-34`)
**Issue:** The doc comment (line 26) declares `extractUrgencySnapshots` a pure
function that never throws, but it calls `normalizeHoldingSymbol(h.symbol)`,
which executes `symbol.trim().toUpperCase()`. If any holding in the parsed
artifact lacks a `symbol` (or it is `null`/non-string), `.trim()` throws a
`TypeError`. Because the script deliberately uses plain `JSON.parse` with no zod
validation (by design), and this call at `write-urgency-history.ts:72` is not
wrapped in try/catch, the throw rejects `main()` and is caught only by the CLI
entrypoint (`write-urgency-history.ts:79-82`), which prints `Fatal error:` and
exits 1. That violates the fail-soft intent (a malformed/partial artifact should
skip, not hard-fail) and emits a non-standard signal that Step 3f cannot map to
`[urgency-history] FAIL:`. Additionally, holdings missing `nameJa`/`decision`
(but with a valid `symbol`) are silently persisted as objects whose `undefined`
fields are dropped by `JSON.stringify`, producing malformed snapshots.
**Fix:** Guard extraction so bad holdings degrade gracefully instead of
throwing, e.g. filter/skip entries with a non-string `symbol`, and correct the
"throw なし" comment to note the `normalizeHoldingSymbol` precondition:
```ts
export function extractUrgencySnapshots(
  analysis: PortfolioAnalysis,
): ReadonlyArray<HoldingUrgencySnapshot> {
  return analysis.holdings
    .filter((h) => typeof h.symbol === "string" && h.symbol.trim() !== "")
    .map((h) => ({
      symbol: normalizeHoldingSymbol(h.symbol),
      nameJa: h.nameJa,
      urgent: h.urgent,
      decision: h.decision,
    }));
}
```
Alternatively wrap the extract/merge/write block in `write-urgency-history.ts`
in a try/catch that emits `[urgency-history] FAIL: ...` before `process.exit(1)`.

### WR-02: `meeting-result.json` read is unguarded — missing/corrupt file bypasses the documented fail-soft signal

**File:** `src/scripts/write-urgency-history.ts:63-64`
**Issue:** Unlike `portfolio-analysis.json` (read inside try/catch at lines
48-54) and the existing history (guarded in `loadExistingHistory`), the
`meeting-result.json` read and its `JSON.parse` are bare. If that file is
missing or corrupt at Step 3f, `readFile`/`JSON.parse` throws, `main()` rejects,
and the CLI entrypoint prints `Fatal error:` and exits 1. Step 3f
(`invest.md:2073-2076`) instructs the operator to summarize the
`[urgency-history] FAIL:` line — which will not exist in this path — so the
failure is mis-signaled. The existing output file is preserved (no write
occurred), so there is no data loss, but the contract that every non-zero exit
emits a `[urgency-history] FAIL:` line is broken.
**Fix:** Wrap the read/parse and emit the standard signal on failure:
```ts
let dateKey: string;
try {
  const meetingRaw = await readFile(join(TMP_DIR, "meeting-result.json"), "utf-8");
  ({ date: dateKey } = JSON.parse(meetingRaw) as { date: string });
} catch {
  console.error("[urgency-history] FAIL: meeting-result.json の読み込み/parse に失敗");
  process.exit(1);
  return;
}
```

## Info

### IN-01: `loadExistingHistory` treats valid-JSON-but-non-object as healthy

**File:** `src/scripts/write-urgency-history.ts:14-15`
**Issue:** `JSON.parse` of a file containing `null`, a bare array, or a
primitive (e.g. `123`, `"x"`) succeeds, so `corrupted` stays `false`. The value
is then spread at `appendUrgencySnapshot` (`urgency-history.ts:47`). For an array
this spreads numeric indices into the merged object (`{...[a,b]}` →
`{0:a,1:b}`); for `null`/primitive it yields `{}` — silently discarding whatever
was on disk without flagging corruption. This is a corrupted file that escapes
the D-14 preservation guard.
**Fix:** After parse, assert shape before trusting it:
```ts
const parsed = JSON.parse(raw);
if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
  return { history: {}, corrupted: true };
}
return { history: parsed as UrgencyHistoryFile, corrupted: false };
```

### IN-02: `isValidDateKey` accepts format-valid but calendar-invalid dates

**File:** `src/portfolio/urgency-history.ts:54-55`
**Issue:** `/^\d{4}-\d{2}-\d{2}$/` accepts `2026-13-45`. As a history object key
this is harmless (no date arithmetic is performed), and the regex intentionally
mirrors Step 4, so this is noted rather than flagged as a defect. If stricter
validation is ever wanted, parse with `Date` and confirm round-trip equality.
**Fix:** Optional — no change required unless calendar correctness becomes a
requirement.

### IN-03: Corrupted-history exit 1 fires even when there is nothing to write

**File:** `src/scripts/write-urgency-history.ts:37-45`
**Issue:** The corruption check runs before the input (`portfolio-analysis.json`)
is read. If the existing history is corrupt AND the input is missing/empty (a
would-be skip / exit 0 case), the script still exits 1. Surfacing corruption is
defensible, but it turns an otherwise no-op run into a failure signal.
**Fix:** Optional — if skip should dominate, move the corruption check after the
skip determination, or emit skip when there is no new snapshot to persist.

### IN-04: `git add data/` stages the entire directory, not just the history file

**File:** `.claude/commands/invest.md:2133`
**Issue:** `git add docs/ data/` stages every file under `data/`. If future code
writes other artifacts there, they will be committed and pushed to the public
GitHub Pages repo unintentionally. Currently `data/` holds only
`urgency-history.json`, so impact is nil today.
**Fix:** Optional — narrow to `git add docs/ data/urgency-history.json` (guarded
by `existsSync`) to keep the deploy staging explicit.

---

_Reviewed: 2026-07-04T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

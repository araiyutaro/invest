---
phase: 01-data-layer-skill-foundation
reviewed: 2026-06-24T00:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - .claude/commands/invest.md
  - src/scripts/collect-data.test.ts
  - src/scripts/collect-data.ts
findings:
  critical: 1
  warning: 4
  info: 2
  total: 7
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-06-24T00:00:00Z
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Three files were reviewed: the `/invest` command definition, the `collect-data.ts` script, and its corresponding Vitest test suite. The implementation is well-structured overall — error handling is thoughtful, immutability is respected, and the collect-data flow is clean. However, there is one critical defect in the test suite that causes a test to fabricate its own outcome rather than actually testing the implementation, plus several warnings around module-level side effects, test isolation, incomplete assertions, and an unsafe access pattern. Two info-level items (console.log usage, magic number) round out the findings.

## Structural Findings (fallow)

No structural pre-pass was provided.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Test 5 fabricates `process.exit(1)` call instead of exercising the implementation

**File:** `src/scripts/collect-data.test.ts:129-134`

**Issue:** The test for "fetchAllMarketData が reject したとき process.exit(1) が呼ばれる" is supposed to verify that the module-level catch block in `collect-data.ts` (line 78-81) calls `process.exit(1)` on fatal error. Instead, the test manually replicates the catch logic itself:

```typescript
await main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);   // <-- the TEST is calling process.exit, not the implementation
});
expect(processExitSpy).toHaveBeenCalledWith(1);
```

This test will always pass even if the module-level catch block is deleted from `collect-data.ts`, because the test itself is the one calling `process.exit(1)`. The real production behavior (the `main().catch(...)` at module top-level, lines 78-81 of `collect-data.ts`) is never exercised.

The root cause is that the top-level `main().catch(...)` runs at import time, not inside `main()`, making it hard to test directly. The fix is to either:

1. Restructure `collect-data.ts` so `main()` itself throws and callers decide to call `process.exit`, OR
2. Test the behavior by re-importing the module after setting up the rejection, OR
3. Accept the architectural limitation and have the test honestly verify that `main()` rejects (not that `process.exit` is called):

```typescript
// Option 3 — honest test for what is actually testable
it("Test 5: fetchAllMarketData が reject したとき main() が reject される", async () => {
  const marketMock = await import("../data/market.js");
  (marketMock.fetchAllMarketData as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
    new Error("Market data fetch failed"),
  );

  const { main } = await import("./collect-data.js");
  await expect(main()).rejects.toThrow("Market data fetch failed");
  // process.exit(1) is called by the module's top-level catch, which runs once at import time
  // and cannot be retested per module load in Vitest's module cache
});
```

Option 1 (restructure the module) is the most testable architecture:

```typescript
// collect-data.ts — preferred restructure
export async function main() { /* ... */ }

// Entry point separated; not exported
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
```

---

## Warnings

### WR-01: Module-level side effect `main()` always runs on import — breaks test isolation

**File:** `src/scripts/collect-data.ts:78-81`

**Issue:** The top-level `main().catch(...)` call (lines 78-81) executes unconditionally whenever the module is imported. In the test suite, every `import("./collect-data.js")` triggers a real `main()` invocation. Vitest's module cache means this fires once per test file (on first import), but any test that clears the module registry (`vi.resetModules()`) would cause a second uncontrolled invocation.

Currently the tests do not reset the module registry between tests, so the behavior is accidental — the same module instance (including the already-executed top-level call) is reused. If test isolation is tightened later, this will produce unexpected `writeFile` calls from the module-level invocation that pollute spy call counts.

The canonical fix is an `import.meta.url` guard:

```typescript
import { fileURLToPath } from "node:url";

// ...export async function main() { ... }

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
```

---

### WR-02: `fetchAllFinnhubNews` rejection silently produces an empty `news.json` with no runtime signal

**File:** `src/scripts/collect-data.ts:47-50`

**Issue:** When the outer `try/catch` for news collection catches an error (line 47), it writes `"[]"` to `news.json` and continues. This is intentional for resilience, but the error is only logged to `console.error` — it is not reflected in the summary output, not written to a status field in the JSON output, and not surfaced to the caller in any machine-readable way.

Downstream agents (Phase 2 analysts) reading `tmp/news.json` will see an empty array and have no way to distinguish "no news today" from "fetch failed silently." This can cause analysts to produce subtly incorrect analysis (e.g., "no significant news" when news was simply unavailable).

**Fix:** Write a metadata wrapper rather than a bare empty array on failure, or add a separate `tmp/collection-status.json` that records which sources succeeded/failed:

```typescript
} catch (e) {
  console.error("ニュース収集失敗（続行）:", e);
  await writeFile(
    join(TMP_DIR, "news.json"),
    JSON.stringify({ error: true, articles: [] }, null, 2),
    "utf-8",
  );
}
```

Alternatively, keep the bare `[]` but ensure the collection summary (lines 67-75) logs the failure status explicitly so the command output reveals degraded data quality.

---

### WR-03: Unsafe array index access `marketData.indices[0]` without length guard

**File:** `src/scripts/collect-data.ts:66`

**Issue:** `const topIndex = marketData.indices[0]` accesses the first element without first checking that the array is non-empty. The `if (topIndex)` guard on line 68 handles the undefined case for the log output, but `marketData.indices` could be empty if all Yahoo Finance quote fetches fail (all return `null` and are filtered out by `fetchMarketIndices`). In that case the summary just skips the index line silently — no error is reported even though zero indices were fetched.

This is a correctness gap: a completely failed market data fetch (network outage, API rate limit) passes through `fetchAllMarketData()` returning `{ indices: [], sectors: [] }`, gets written to `market.json`, and the script exits normally with code 0. The operator has no indication that all data is empty.

**Fix:** Add an explicit validation after fetching market data:

```typescript
const marketData = await fetchAllMarketData();
if (marketData.indices.length === 0) {
  throw new Error("市場データ取得失敗: 全インデックスのクォート取得に失敗しました");
}
```

---

### WR-04: Test 6 asserts `newsJsonCall![1]` equals `"[]"` but this does not test the full news pipeline failure path

**File:** `src/scripts/collect-data.test.ts:137-152`

**Issue:** Test 6 mocks `fetchAllFinnhubNews` to reject, but `fetchGoogleNewsJapan` and `fetchAllRssNews` are still mocked to resolve (with `[]`). Inside `collect-data.ts`, `fetchAllFinnhubNews` is called via `Promise.all` (line 30). When `fetchAllFinnhubNews` rejects, the entire `Promise.all` rejects (because `.catch()` is only applied to `fetchGoogleNewsJapan` and `fetchAllRssNews`, not to `fetchAllFinnhubNews`). The outer `try/catch` (line 28/47) then catches the rejection and writes `"[]"`.

The test happens to pass, but it is asserting the fallback path for an unhandled exception inside `Promise.all`, not a clean individual-source failure. The assertion `expect(newsJsonCall![1]).toBe("[]")` will match the minified empty-array string only — but the `main()` implementation writes `"[]"` (without whitespace, line 49) while successful writes use `JSON.stringify(allArticles, null, 2)`. This difference is load-bearing: if the fallback were changed to `JSON.stringify([], null, 2)`, the test would fail even though the behavior is semantically correct.

**Fix:** The assertion should be semantically robust:

```typescript
const parsed = JSON.parse(newsJsonCall![1] as string);
expect(Array.isArray(parsed)).toBe(true);
expect(parsed).toHaveLength(0);
```

---

## Info

### IN-01: Multiple `console.log` statements in production script

**File:** `src/scripts/collect-data.ts:14, 17, 24-26, 29, 46, 53, 59-60, 67-75`

**Issue:** Per project coding style (`/Users/arai/.claude/rules/coding-style.md`: "No console.log statements"), the script uses `console.log` extensively for progress reporting. For a scheduled script (`launchd`, daily 8AM) that runs unattended, unstructured stdout logging is not a substitute for structured output or a proper logging library.

**Fix:** For a CLI/scheduled script, `console.log` progress output is common and pragmatic. The recommendation is to confine logging to a single structured summary at the end, or use a minimal logger abstraction that can be silenced in tests without `vi.spyOn`. The test currently must mock `console.log` to avoid noisy output.

---

### IN-02: Magic string `"utf-8"` repeated across multiple `writeFile` calls

**File:** `src/scripts/collect-data.ts:22, 43, 49, 56, 63`

**Issue:** The encoding string `"utf-8"` appears 5 times. If encoding ever needs to change (unlikely, but possible), all five call sites must be updated.

**Fix:** Extract to a named constant at the top of the file:

```typescript
const FILE_ENCODING = "utf-8" as const;
```

---

_Reviewed: 2026-06-24T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

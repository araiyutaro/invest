# Phase 30: Buy-Timing Judgment Agent - Pattern Map

**Mapped:** 2026-07-15
**Files analyzed:** 6 (2 new source files, 2 modified source files, 1 modified doc/pipeline file, 1 new test file)
**Analogs found:** 6 / 6

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/portfolio/watchlist-judgment.ts` (NEW) | utility (pure functions) | transform | `src/portfolio/decision-diff.ts` | exact (change-detection shape) |
| `src/scripts/write-watchlist-judgment.ts` (NEW) | CLI / controller | file-I/O, batch | `src/scripts/write-watchlist.ts` | exact |
| `src/meeting/schemas.ts` (MODIFY — add schema) | model (validation schema) | transform | same file, `rawHoldingSchema`→`holdingEvaluationSchema` (lines 196-227) | exact |
| `src/meeting/types.ts` (MODIFY — add type) | model (type def) | — | same file, `HoldingEvaluation` type | exact |
| `.claude/commands/invest.md` (MODIFY — insert Step 3-J) | config / pipeline orchestration | event-driven (agent orchestration) | Step 3-P block (lines 1340-1476) + Step 3d block (lines 1798-1890) | exact (two analogs, different concerns) |
| `src/portfolio/watchlist-judgment.test.ts` (NEW) | test | — | `src/portfolio/decision-diff.test.ts` | exact |

## Pattern Assignments

### `src/portfolio/watchlist-judgment.ts` (utility, transform)

**Analog:** `src/portfolio/decision-diff.ts` (full file, 42 lines) + `src/portfolio/holding-news.ts` (`normalizeHoldingSymbol`)

**Imports pattern** (mirror `decision-diff.ts` top):
```typescript
import { normalizeHoldingSymbol } from "./holding-news.js";
import type { HoldingEvaluation } from "../meeting/types.js";
```
For Phase 30, import the new `WatchlistJudgment`-family types from `../meeting/types.js` instead.

**Core change-detection pattern** (verbatim structural clone, `decision-diff.ts` full file):
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
**Discipline to replicate exactly** for the new `attachActionChanges`-analog (D-11):
1. Today's judgments array is the **primary** loop driver — never iterate `prevJudgments` directly (guarantees today-only tickers always appear in output).
2. Prior data accessed only via `Map.get(...)` lookup.
3. `prevJudgments === null` → plain spread, **no** `previousAction`/`actionChanged` keys at all (absence, not `undefined` value).
4. When matched, always attach both fields via enum equality (`prev.todayAction !== j.todayAction`).
5. Ticker-key matching via `normalizeHoldingSymbol` (trim + toUpperCase), imported from `src/portfolio/holding-news.ts`.

**Additional pure functions needed in this module** (no direct codebase analog exists — compose from Established Patterns):
- `applyConfluenceGate` — D-07 downgrade gate. New function; pattern is "read only post-transform `.signals.length`, never raw LLM field." No existing confluence-style gate in codebase; write fresh but keep pure/synchronous like all functions in `decision-diff.ts`.
- `deriveMarket(ticker): "US" | "JP"` — mirror the `.T`-suffix regex convention from `src/scripts/extract-tickers.ts` (lines ~71-72, `/(\d{4})\.T\b/` style check).
- Skipped-status builder for D-20 — no direct analog; compose using the same "positive record, not omission" discipline documented in Phase 29 D-17 downstream contract.

**Error handling pattern:** None needed — pure functions, no I/O, no try/catch (matches `decision-diff.ts` which has zero error handling; all fallibility lives in the CLI wrapper, not the pure module).

---

### `src/scripts/write-watchlist-judgment.ts` (CLI, file-I/O + batch)

**Analog:** `src/scripts/write-watchlist.ts` (192 lines) for defensive-read shape; `src/scripts/collect-watchlist-data.ts` for `main()`/STEP-marker/multi-ticker structure; `src/scripts/validate-portfolio-research.ts` (63 lines) for raw-Agent-output validation CLI shape.

**ENOENT-vs-corrupted defensive read pattern** (`write-watchlist.ts` lines 29-50):
```typescript
export async function loadExistingWatchlist(): Promise<{
  watchlist: WatchlistFile;
  corrupted: boolean;
}> {
  try {
    const raw = await readFile(WATCHLIST_PATH, "utf-8");
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return { watchlist: {}, corrupted: true };
    }
    return { watchlist: parsed as WatchlistFile, corrupted: false };
  } catch (error) {
    const isMissing =
      (error as NodeJS.ErrnoException).code === "ENOENT" ||
      (error instanceof Error && error.message.includes("ENOENT"));
    return isMissing ? { watchlist: {}, corrupted: false } : { watchlist: {}, corrupted: true };
  }
}
```
**Critical:** MUST check both `.code === "ENOENT"` AND `.message.includes("ENOENT")` — this codebase's test-mock convention uses plain `Error("ENOENT")` with no `.code` property. Apply this exact double-check when reading `tmp/prev-watchlist-judgment.json`.

**CLI `main()` structural checklist** (from `collect-watchlist-data.ts`, apply identically):
- `await mkdir(TMP_DIR, { recursive: true })` unconditionally at top.
- On `corrupted: true` for input reads → write empty valid output + `[STEP:watchlist-judgment:FAIL:corrupted]` to stderr, `return` (never `throw`).
- Active-tickers-count === 0 → write empty valid `judgments: []` output + `[STEP:watchlist-judgment:OK]` (D-19: empty is success, not failure).
- Independent try/catch per ticker in the validation loop — one ticker's failure never blocks others (D-18).
- Top-level guard: `if (process.argv[1] === fileURLToPath(import.meta.url))` before invoking `main()`, with `.catch()` writing empty outputs as last resort + `process.exitCode = 1` (never `process.exit()` inside `main()`).
- ALL STEP markers → `console.error` (stderr). Human-readable audit lines → `console.log` (stdout).

**Raw-output validation loop shape** (`validate-portfolio-research.ts`, 63 lines total — read this file directly for the exact per-file zod-parse-then-catch loop structure before implementing; it is the closest existing precedent for "read N per-symbol raw files, zod-validate each independently, collect successes, log failures").

**STEP marker exact formats** (D-17, mirrors Step 3-P wording in invest.md):
```
[STEP:watchlist-judgment:OK]
[STEP:watchlist-judgment:FAIL:<短い理由>]
[STEP:watchlist-judgment:FAIL:{N}/{M}銘柄失敗（{ティッカー}）]
```
Note the denominator `{M}` is the active-watchlist count (dynamic), unlike Step 3-P's fixed `/12`.

---

### `src/meeting/schemas.ts` (model, transform) — MODIFY

**Analog:** same file, `rawHoldingSchema` → `holdingEvaluationSchema` + `lenientBoolean` (lines 196-227)

**Exact template to clone:**
```typescript
const lenientBoolean = z
  .union([z.boolean(), z.enum(["true", "false"]).transform((v) => v === "true")])
  .optional();

const rawHoldingSchema = z.object({
  symbol: z.string(),
  nameJa: z.string().optional(),
  decision: decisionEnum.optional(),
  action: decisionEnum.optional(),        // alias
  rationale: z.string().optional(),
  reason: z.string().optional(),          // alias
  ...
}).passthrough();

export const holdingEvaluationSchema = rawHoldingSchema.transform((raw) => {
  return {
    symbol: raw.symbol,
    decision: raw.decision ?? raw.action ?? "保持",
    rationale: raw.rationale ?? raw.reason ?? "",
    ...
  };
  // previousDecision/decisionChanged NEVER referenced here — structurally
  // impossible for raw LLM output to populate them.
});
```

**Applied shape for Phase 30** (illustrative; exact alias list is planner/implementer discretion per D-05):
```typescript
const rawWatchlistJudgmentSchema = z.object({
  ticker: z.string(),
  todayAction: z.enum(["buy", "wait"]).optional(),
  action: z.enum(["buy", "wait"]).optional(),       // alias
  verdict: z.string().optional(),                    // alias, may carry "買い"/"待ち"
  buyToday: lenientBoolean,                           // alias (boolean form), reuse lenientBoolean
  rationale: z.string().optional(),
  signals: z.array(z.string()).optional(),
}).passthrough();

export const watchlistJudgmentSchema = rawWatchlistJudgmentSchema.transform((raw) => ({
  ticker: raw.ticker,
  todayAction: normalizeTodayAction(raw), // resolves todayAction/action/verdict/buyToday
  rationale: raw.rationale ?? "",
  signals: raw.signals ?? [],
  // previousAction / actionChanged / asOf / market: ABSENT here (D-08) —
  // attached deterministically by write-watchlist-judgment.ts post-validation.
}));
```
**Import block context:** existing imports at top of `schemas.ts` (lines 1-9) show the project convention — `import { z } from "zod";` plus `import type { ... } from "./types.js";`. Add the new judgment type import alongside existing type imports.

**Anti-pattern warning:** Never add `market`/`asOf` as optional fields with a `raw.market ?? deriveMarket(ticker)` fallback inside the schema transform — these fields must be structurally absent from the raw schema (same as `previousDecision`/`decisionChanged`), computed entirely outside zod in the CLI's post-validation step.

---

### `src/meeting/types.ts` (model, type def) — MODIFY

**Analog:** same file, existing `HoldingEvaluation` type definition

Add a `WatchlistJudgment` type (canonical, post-transform shape) alongside `HoldingEvaluation`, following the same readonly-field convention used throughout `types.ts`. Exact field list: `ticker`, `todayAction: "buy" | "wait"`, `rationale`, `signals: readonly string[]`, `asOf?`, `market?: "US" | "JP"`, `previousAction?`, `actionChanged?`, `status?: "skipped"` (D-20).

---

### `.claude/commands/invest.md` (pipeline orchestration) — MODIFY

**Analog 1 — parallel Agent + raw-file separation + partial-failure marker:** Step 3-P block (lines 1340-1476)
```
- Directory reset: rm -rf tmp/portfolio-research && mkdir -p tmp/portfolio-research (line 1363)
  → apply identically to tmp/watchlist-judgment-raw/
- Agent naming: portfolio-research-{symbol}, .T suffix preserved, "/" replaced with "-" (line 1371)
  → analog: watchlist-judgment-{ticker}
- Model: sonnet (line 1372) — exact precedent for D-01
- Fallback JSON written for EVERY ticker including failures (lines 1444-1449)
- Partial-failure marker (line 1458):
  echo '[STEP:portfolio-research:FAIL:{N}/12銘柄失敗（{失敗ティッカー}）]'
  → analog: [STEP:watchlist-judgment:FAIL:{N}/{M}銘柄失敗（{ティッカー}）] (M = dynamic active count)
- [PIPELINE:FAIL] is NEVER emitted (line 1461)
```

**Analog 2 — date-guarded retreat + independent-then-compare prompt:** Step 3d block (lines 1798-1890)

Retreat script (lines 1798-1818, adapt date-key source per D-09 — do NOT re-derive JST inline; read from already-loaded `tmp/meeting-result.json`'s `date` field instead):
```bash
node -e "
const fs = require('fs');
try {
  const prev = JSON.parse(fs.readFileSync('/Users/arai/invest/tmp/watchlist-judgment.json', 'utf-8'));
  // Phase 30 deviation from Step 3d: use meeting-result.json's date field,
  // NOT new Date(Date.now()+9*3600*1000) inline JST computation.
  if (prev.date === meetingResultDate) {
    console.log('[前日判定] 同日データのため退避スキップ（既存の prev を保持）');
  } else if (Array.isArray(prev.judgments) && prev.judgments.length > 0) {
    fs.writeFileSync('/Users/arai/invest/tmp/prev-watchlist-judgment.json', JSON.stringify(prev, null, 2));
    console.log('[前日判定] ' + prev.judgments.length + '銘柄分の前日判定を保存');
  } else {
    console.log('前日判定なし');
  }
} catch(e) {
  console.log('前日判定なし');
}
"
```

Independent-then-compare prompt wording (lines 1885-1890, reuse near-verbatim):
```
（tmp/prev-watchlist-judgment.json が存在する場合のみ以下を含めること）
## 前日の判定（参考情報）
まず本日の供給データ（テクニカル指標・ニュース）のみに基づいて独立に判定すること。その後に、以下の前日判定と比較すること。
[tmp/prev-watchlist-judgment.json の当該銘柄について「- {ticker}: {todayAction}（{rationale要約}）」の形式で記載する]
前日と判定が異なる場合は、rationale でその変更理由に触れることを推奨する。
（tmp/prev-watchlist-judgment.json が存在しない、または当該銘柄のエントリが無い場合はこのセクション全体を省略）
```

**Insertion point:** immediately after the `---` separator ending Step 3-P (line 1481), before the `### Step 3a` heading (line 1483). Must complete before Step 3c (line 2039) — same "must run before report generation" hard requirement as Step 3f (lines 2013-2036).

---

### `src/portfolio/watchlist-judgment.test.ts` (test) — NEW

**Analog:** `src/portfolio/decision-diff.test.ts` (full file read — mock/assertion conventions verified directly)

**Exact mock/assertion pattern to mirror:**
```typescript
import { describe, it, expect } from "vitest";
import { attachDecisionChanges } from "./decision-diff.js";
import type { HoldingEvaluation } from "../meeting/types.js";

const makeHolding = (overrides: Partial<HoldingEvaluation>): HoldingEvaluation => ({
  symbol: "TEST",
  nameJa: "テスト株式会社",
  decision: "保持",
  rationale: "デフォルト理由",
  urgent: false,
  ...overrides,
});

describe("attachDecisionChanges (PORT-05)", () => {
  it("prevHoldings が null の場合、全結果に previousDecision/decisionChanged プロパティが存在しない", () => {
    const holdings = [makeHolding({ symbol: "MRNA" })];
    const result = attachDecisionChanges(holdings, null);
    expect(result[0]).not.toHaveProperty("previousDecision");
    expect(result[0]).not.toHaveProperty("decisionChanged");
  });
  // ... same-decision (changed:false), different-decision (changed:true),
  // today-only ticker not in prev (property absent, not undefined-valued),
  // normalizeHoldingSymbol key-matching (whitespace/case) cases follow.
});
```
Use a `makeJudgment(overrides)` factory analogous to `makeHolding`, and mirror the exact five-case structure: (1) `prevJudgments === null` → properties absent, (2) same `todayAction` → `actionChanged: false`, (3) different `todayAction` → `actionChanged: true`, (4) today-only ticker not in prev → properties absent (not `undefined`-valued, verified via `.not.toHaveProperty` + `.toBeUndefined()` double-check), (5) key matching is normalization-tolerant (whitespace/case) via `normalizeHoldingSymbol`.

**Additional cases required by D-23** (no direct existing analog — compose fresh, following the same `describe`/`it` structure and plain-object fixture style):
- "buy で signals 1件 → wait 降格" (confluence gate test)
- "prev なし → プロパティ非付与" (covered by case 1 above, reused for the judgment-specific function)
- "同日再実行 → 退避スキップ" — this is CLI-level logic (date-guard), not pure-function logic; if tested, follow the ENOENT-double-check + plain-`Error("ENOENT")` mock convention from `write-watchlist.test.ts` / `collect-watchlist-data.test.ts` (same convention flagged in Pitfall 1 of RESEARCH.md).

**Schema test analog:** for the new `watchlistJudgmentSchema` alias-hardening tests, mirror `src/meeting/schemas.test.ts`'s structure for `holdingEvaluationSchema` (alias resolution per field, passthrough tolerance of unknown fields, TS-only field stripping verified via `.not.toHaveProperty`).

---

## Shared Patterns

### "TS 側決定論を信用の起点とする" (LLM self-report never trusted for structurally-derivable fields)
**Source:** `src/meeting/schemas.ts` (`holdingEvaluationSchema`'s exclusion of `previousDecision`/`decisionChanged` from the raw schema) + `src/portfolio/decision-diff.ts` (change detection is pure TS, never LLM-reported)
**Apply to:** `watchlist-judgment.ts` (confluence gate, market/asOf derivation, change detection), `schemas.ts` (raw schema must omit `previousAction`/`actionChanged`/`asOf`/`market` entirely)

### Fail-soft CLI shape (defensive read, empty-is-success, stderr STEP markers)
**Source:** `src/scripts/write-watchlist.ts` (lines 29-50, defensive read) + `src/scripts/collect-watchlist-data.ts` (`main()` shape, STEP markers)
**Apply to:** `src/scripts/write-watchlist-judgment.ts`

### Two-stage alias-hardened schema (`passthrough().transform()`)
**Source:** `src/meeting/schemas.ts` lines 196-227
**Apply to:** new `rawWatchlistJudgmentSchema` → `watchlistJudgmentSchema` in `schemas.ts`

### Per-ticker parallel Agent + raw-file separation + partial-failure marker
**Source:** invest.md Step 3-P (lines 1340-1476)
**Apply to:** new Step 3-J block in invest.md

### Date-guarded prior-snapshot retreat (independent-then-compare)
**Source:** invest.md Step 3d (lines 1798-1890)
**Apply to:** new Step 3-J retreat sub-step in invest.md (with D-09's meeting-result-date-field deviation)

## No Analog Found

| File/Function | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `applyConfluenceGate` (in `watchlist-judgment.ts`) | utility | transform | No existing confluence/downgrade-gate pattern in codebase; new business logic per D-07. Compose as a pure function following `decision-diff.ts`'s purity/synchronicity discipline. |
| Skipped-status builder (D-20) | utility | transform | No existing "positive absence record" builder; compose fresh using Phase 29 D-17's downstream-contract discipline as the design reference (documented in CONTEXT.md, not existing code). |
| `deriveMarket` ticker classification | utility | transform | Closest precedent is a regex convention inside `extract-tickers.ts` (not a standalone exported function) — reusable as a pattern, not as an importable function. |

## Metadata

**Analog search scope:** `src/portfolio/`, `src/meeting/`, `src/scripts/`, `.claude/commands/invest.md`
**Files read directly:** `src/meeting/schemas.ts` (imports), `src/portfolio/decision-diff.ts` (full, 42 lines), `src/portfolio/decision-diff.test.ts` (full), `src/scripts/write-watchlist.ts` (line count + cross-referenced via RESEARCH.md verified excerpts), `.planning/phases/30-buy-timing-judgment-agent/30-CONTEXT.md`, `.planning/phases/30-buy-timing-judgment-agent/30-RESEARCH.md`
**Note:** RESEARCH.md (this phase) already contains VERIFIED direct-read excerpts with exact line numbers for `schemas.ts` L196-227, `decision-diff.ts` (full), `write-watchlist.ts` L29-50, `collect-watchlist-data.ts` L150-266, invest.md Step 3-P (L1340-1476) and Step 3d (L1798-1890) — this PATTERNS.md reuses those verified excerpts directly rather than re-reading identical ranges.
**Pattern extraction date:** 2026-07-15
</content>

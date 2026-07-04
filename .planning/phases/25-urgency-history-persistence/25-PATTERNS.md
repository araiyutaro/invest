# Phase 25: Urgency History Persistence - Pattern Map

**Mapped:** 2026-07-04
**Files analyzed:** 5 (2 new source + 2 new test + 2 modified)
**Analogs found:** 5 / 5

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|---------------|
| `src/portfolio/urgency-history.ts` | utility (pure-function module) | transform (CRUD-like merge) | `src/portfolio/holding-news.ts` (+ `decision-diff.ts` for symbol-keyed merge shape) | exact |
| `src/portfolio/urgency-history.test.ts` | test | — | `src/portfolio/holding-news.test.ts` / `src/portfolio/decision-diff.test.ts` | exact |
| `src/scripts/write-urgency-history.ts` | service (CLI wrapper) | file-I/O | `src/scripts/write-news-digest.ts` (+ `src/scripts/report-data-loaders.ts` for read style) | exact |
| `src/scripts/write-urgency-history.test.ts` | test | — | `src/scripts/write-news-digest.test.ts` | exact |
| `.claude/commands/invest.md` (Step 3f insert + Step 4 `git add` extension) | config (pipeline orchestration doc) | event-driven (pipeline step) | `.claude/commands/invest.md` §Step 3e (news-digest) + §Step 4 (deploy) | exact |
| `src/meeting/types.ts` (possible `HoldingUrgencySnapshot` addition) | model (type definition) | — | `src/meeting/types.ts` §`HoldingEvaluation`/`PortfolioAnalysis` (same file, sibling interface style) | exact |

## Pattern Assignments

### `src/portfolio/urgency-history.ts` (utility, pure-function/transform)

**Analogs:** `src/portfolio/holding-news.ts` (primary — pure-function module shape, `normalizeHoldingSymbol` reuse, no-throw/no-I/O discipline), `src/portfolio/decision-diff.ts` (secondary — single-purpose transform function with a terse JSDoc block citing decision IDs), `src/scripts/update-index.ts` §`mergeEntry` (same-key-wins merge shape to map onto an object).

**Imports pattern** (`holding-news.ts` lines 1-4, `decision-diff.ts` lines 1-2):
```typescript
import { calculatePriorityScore } from "../data/news/filter.js";
import type { NewsArticleWithId } from "../data/news/article-id.js";
import type { NewsArticlePoolEntry } from "../meeting/schemas.js";
import type { PortfolioHolding } from "./holdings.js";
```
```typescript
import { normalizeHoldingSymbol } from "./holding-news.js";
import type { HoldingEvaluation } from "../meeting/types.js";
```
`urgency-history.ts` should import `normalizeHoldingSymbol` from `./holding-news.js` (D-10, exact same relative-import style as `decision-diff.ts`) and `type { PortfolioAnalysis } from "../meeting/types.js"`.

**normalizeHoldingSymbol — single source of truth to reuse, do not reimplement** (`holding-news.ts` lines 24-34):
```typescript
/**
 * 銘柄シンボル正規化の単一情報源（Open Questions Q2 RESOLVED）。
 * trim + toUpperCase のみを行い、内部文字は変えない（例: " 8522.t " → "8522.T", "mrna" → "MRNA"）。
 */
export function normalizeHoldingSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}
```

**Core pattern — pure extraction + immutable same-day-overwrite merge** (mirrors `holding-news.ts`'s `buildHoldingNewsMap`, lines 199-213, and `update-index.ts`'s `mergeEntry`, lines 86-93):
```typescript
// buildHoldingNewsMap shape (holding-news.ts:199-213) — decision-neutral field mapping, no throw
export function buildHoldingNewsMap(
  articles: ReadonlyArray<NewsArticleWithId>,
  holdings: ReadonlyArray<PortfolioHolding>,
): HoldingNewsFile {
  const entries = holdings.map((holding) => {
    const matches = matchArticlesForHolding(articles, holding);
    const ranked = rankAndCapHoldingArticles(matches, now, portfolioTickers);
    return [holding.symbol, ranked] as const;
  });
  return Object.fromEntries(entries);
}
```
```typescript
// mergeEntry shape (update-index.ts:86-93) — array "new date wins" precedent that
// appendUrgencySnapshot maps onto an object (D-04): { ...history, [dateKey]: snapshots }
/** New date wins if it already exists in `existing`. */
export function mergeEntry(
  existing: ReadonlyArray<ReportEntry>,
  newEntry: ReportEntry,
): ReportEntry[] {
  const filtered = existing.filter((e) => e.date !== newEntry.date);
  return [...filtered, newEntry];
}
```
Target implementation for `urgency-history.ts` (per RESEARCH.md Pattern 1/2, verified consistent with the two analogs above):
```typescript
export interface HoldingUrgencySnapshot {
  readonly symbol: string;
  readonly nameJa: string;
  readonly urgent: boolean;
  readonly decision: "保持" | "買増" | "一部売却" | "全売却";
}
export type UrgencyHistoryFile = Record<string, ReadonlyArray<HoldingUrgencySnapshot>>;

export function extractUrgencySnapshots(
  analysis: PortfolioAnalysis,
): ReadonlyArray<HoldingUrgencySnapshot> {
  return analysis.holdings.map((h) => ({
    symbol: normalizeHoldingSymbol(h.symbol),
    nameJa: h.nameJa,
    urgent: h.urgent,
    decision: h.decision,
  }));
}

export function appendUrgencySnapshot(
  history: UrgencyHistoryFile,
  dateKey: string,
  snapshots: ReadonlyArray<HoldingUrgencySnapshot>,
): UrgencyHistoryFile {
  return { ...history, [dateKey]: snapshots };
}

export function isValidDateKey(dateKey: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateKey);
}
```

**Error handling pattern:** None — pure functions never throw (matches `holding-news.ts`'s and `decision-diff.ts`'s explicit "純関数: throw なし、I/O なし" JSDoc convention, e.g. `decision-diff.ts` line 17). No try/catch belongs in this file; all fail-soft handling lives in the CLI wrapper.

**JSDoc convention** (both analogs use decision-ID-tagged block comments directly above each exported function, e.g. `decision-diff.ts` lines 4-18): every exported function in `urgency-history.ts` should carry a short JSDoc citing the relevant `D-0x` decision, matching this project's established documentation-as-traceability style.

---

### `src/portfolio/urgency-history.test.ts` (test)

**Analogs:** `src/portfolio/holding-news.test.ts` (factory-function + `describe` blocks named after decision IDs), `src/portfolio/decision-diff.test.ts` (simpler single-function-under-test shape — closer match for `urgency-history.ts`'s scope).

**Imports + factory pattern** (`decision-diff.test.ts` lines 1-12):
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
```
For `urgency-history.test.ts`, build an analogous `makeAnalysis`/`makeHoldingEvaluation` factory returning a full `PortfolioAnalysis`/`HoldingEvaluation`, following this exact overrides-spread shape.

**Describe/it structure keyed to decision IDs** (`decision-diff.test.ts` lines 14-65 — one `describe` per function, `it` names in Japanese describing the exact behavior/decision being verified):
```typescript
describe("attachDecisionChanges (PORT-05)", () => {
  it("prevHoldings が null の場合、全結果に previousDecision/decisionChanged プロパティが存在しない", () => {
    const holdings = [makeHolding({ symbol: "MRNA" })];
    const result = attachDecisionChanges(holdings, null);
    expect(result[0]).not.toHaveProperty("previousDecision");
  });
  // ...
});
```
Apply the same shape: `describe("extractUrgencySnapshots (D-02, D-10)", ...)`, `describe("appendUrgencySnapshot (D-04)", ...)`, `describe("isValidDateKey (D-06)", ...)`.

**Normalization test pattern** (`holding-news.test.ts` lines 219-235 — exact tests to replicate for symbol normalization inside `extractUrgencySnapshots`):
```typescript
describe("normalizeHoldingSymbol (Q2 RESOLVED)", () => {
  it("前後空白を除去し大文字化する（正規化）", () => {
    expect(normalizeHoldingSymbol(" 8522.t ")).toBe("8522.T");
  });
  it("小文字ティッカーを大文字化する", () => {
    expect(normalizeHoldingSymbol("mrna")).toBe("MRNA");
  });
});
```

**Immutability test pattern** (`holding-news.test.ts` lines 327-341 — required per project's global immutability rule and RESEARCH.md's `appendUrgencySnapshot` immutability requirement):
```typescript
describe("buildHoldingNewsMap immutability", () => {
  it("呼び出し後、入力 articles / holdings 配列が不変", () => {
    const originalHoldings = [...holdings];
    buildHoldingNewsMap(articles, holdings);
    expect(holdings).toEqual(originalHoldings);
  });
});
```
For `urgency-history.test.ts`, the equivalent test asserts `appendUrgencySnapshot(history, dateKey, snapshots)` does not mutate the input `history` object (`toEqual` on the original reference before/after the call — per RESEARCH.md Pitfall 3, use `toEqual` not `toBe` throughout since JSON round-trips erase `readonly`).

**Same-day overwrite test (HIST-02, the single most important test in this file):**
```typescript
it("同一 dateKey で2回呼ぶと2回目のスナップショットのみが残る（重複しない）", () => {
  const h1 = appendUrgencySnapshot({}, "2026-07-04", [snapshotA]);
  const h2 = appendUrgencySnapshot(h1, "2026-07-04", [snapshotB]);
  expect(h2["2026-07-04"]).toEqual([snapshotB]);
  expect(Object.keys(h2)).toEqual(["2026-07-04"]);
});
```

---

### `src/scripts/write-urgency-history.ts` (service, file-I/O CLI wrapper)

**Analogs:** `src/scripts/write-news-digest.ts` (primary — fail-soft `main()` shape, STEP-marker-adjacent `console.error` convention, mkdir-first-then-fail-soft-branches ordering), `src/scripts/report-data-loaders.ts` (secondary — `loadPortfolioAnalysis`/`loadHoldingNews` plain-JSON-parse vs zod-validated read style distinction).

**Imports pattern** (`write-news-digest.ts` lines 1-8):
```typescript
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
```
Plus for this phase: `import { extractUrgencySnapshots, appendUrgencySnapshot, isValidDateKey } from "../portfolio/urgency-history.js";` and `import type { UrgencyHistoryFile } from "../portfolio/urgency-history.js";` and `import type { PortfolioAnalysis } from "../meeting/types.js";`.

**Directory constants pattern** (`write-news-digest.ts` lines 10-11):
```typescript
const TMP_DIR = join(import.meta.dirname, "../../tmp");
const DOCS_DIR = join(import.meta.dirname, "../../docs");
```
For this phase: `const DATA_DIR = join(import.meta.dirname, "../../data"); const HISTORY_PATH = join(DATA_DIR, "urgency-history.json");`

**Core fail-soft `main()` pattern — mkdir FIRST, then date-from-meeting-result, then try/catch around the risky read, exit-code-as-signal** (`write-news-digest.ts` lines 13-56, full function):
```typescript
export async function main(): Promise<void> {
  // date は上流で検証済みの meeting-result.json からのみ取得する。
  const meetingRaw = await readFile(join(TMP_DIR, "meeting-result.json"), "utf-8");
  const meetingParsed = JSON.parse(meetingRaw) as { date: string };
  const { date } = meetingParsed;

  const dateDir = join(DOCS_DIR, date);
  await mkdir(dateDir, { recursive: true });

  try {
    const rawJson = await readFile(join(TMP_DIR, "news-curation.json"), "utf-8"); // ENOENT時: Agent失敗
    // ... build + write happy path ...
    console.log(`news-digest.html generated: ${curation.articles.length} articles`);
  } catch (error) {
    // D-08: 失敗時もフォールバックを必ず書き出す
    console.error("news-digest fallback:", error instanceof Error ? error.message : error);
    process.exit(1); // exit codeがOK/FAILシグナル
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
```
`write-urgency-history.ts` must mirror this exact shape, with `mkdir(DATA_DIR, { recursive: true })` as the **unconditional first statement** in `main()` (RESEARCH.md Pitfall 1 — this must run before any D-13/D-14/D-06 skip/fail branch so `data/` exists on disk regardless of outcome).

**Read pattern — plain JSON.parse for self-generated artifacts (no zod)** (`report-data-loaders.ts` lines 82-90, `loadPortfolioAnalysis`, and lines 121-133 `loadHoldingNews` — the latter is the closer analog since it treats a first-party TS-generated JSON file, not LLM output):
```typescript
/**
 * tmp/holding-news.json（銘柄別ID参照, Phase 19生成）を fail-soft で読み込む。
 * 欠損/パース失敗時は throw せず {} を返す (D-09: 欠損は全銘柄0件と同一扱い)。
 */
export async function loadHoldingNews(): Promise<HoldingNewsFile> {
  try {
    const raw = await readFile(join(TMP_DIR, "holding-news.json"), "utf-8");
    return JSON.parse(raw) as HoldingNewsFile;
  } catch (error) {
    console.error("Holding news load failed:", error instanceof Error ? error.message : error);
    return {};
  }
}
```
Per RESEARCH.md Pitfall 4, `write-urgency-history.ts` should use this exact plain-`readFile`/`JSON.parse`/try-catch idiom for both `tmp/portfolio-analysis.json` (D-13 skip semantics) and `data/urgency-history.json` (D-14 corrupted-preserve semantics) — NOT `loadPortfolioAnalysis()`'s zod-validated path, to avoid layering two different severity/logging conventions for the same missing-input condition.

**console.error / console.warn severity convention** (established across `report-data-loaders.ts`: `loadPortfolioAnalysis` uses `console.error` for a "should generally succeed" load; `loadPrevPortfolioAnalysis` uses `console.warn` for an "expected on first run" load, per its comment at lines 92-96): `write-urgency-history.ts` should use `console.error` for the STEP-marker-adjacent OK/FAIL signal lines (matching `write-news-digest.ts`'s `[digest-crossref] OK`/`FAIL` convention at lines 38-43), e.g. `console.error("[urgency-history] OK: ...")` / `console.error("[urgency-history] FAIL: ...")`.

**Error handling pattern:** `process.exit(1)` on unrecoverable failure (invalid date, corrupted history file) exactly as `write-news-digest.ts` line 54; a top-level `main().catch(...)` guard exactly as line 59-62.

---

### `src/scripts/write-urgency-history.test.ts` (test)

**Analog:** `src/scripts/write-news-digest.test.ts` (exact structural match — `vi.mock("node:fs/promises")`, `beforeEach`/`afterEach`, `process.exit` spy).

**Mock setup pattern** (`write-news-digest.test.ts` lines 1-7):
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn().mockRejectedValue(new Error("ENOENT")),
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));
```

**beforeEach/afterEach pattern** (lines 47-58):
```typescript
describe("write-news-digest main()", () => {
  beforeEach(async () => {
    const fsMock = await import("node:fs/promises");
    (fsMock.writeFile as ReturnType<typeof vi.fn>).mockClear();
    (fsMock.mkdir as ReturnType<typeof vi.fn>).mockClear();
    (fsMock.readFile as ReturnType<typeof vi.fn>).mockClear();
    vi.spyOn(process, "exit").mockImplementation((() => {}) as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
```

**Path-based readFile routing mock pattern** (lines 60-78 — route mocked `readFile` responses by substring match on the path argument, exactly the shape needed for `write-urgency-history.ts`'s two-file read: `tmp/portfolio-analysis.json` + `tmp/meeting-result.json` + `data/urgency-history.json`):
```typescript
it("Test 1: 正常系 -- ... から ... を書き出す", async () => {
  const fsMock = await import("node:fs/promises");
  (fsMock.readFile as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
    const p = String(path);
    if (p.includes("meeting-result.json")) return Promise.resolve(validMeetingResultJson);
    if (p.includes("news-curation.json")) return Promise.resolve(validRawCurationJson);
    if (p.includes("news.json")) return Promise.resolve(validPoolJson);
    return Promise.reject(new Error("ENOENT"));
  });

  const { main } = await import("./write-news-digest.js");
  await main();

  const writeCalls = (fsMock.writeFile as ReturnType<typeof vi.fn>).mock.calls;
  const digestCall = writeCalls.find((call) => String(call[0]).includes("news-digest.html"));
  expect(digestCall).toBeDefined();
  expect(process.exit).not.toHaveBeenCalledWith(1);
});
```
Map this directly onto the Wave-0 test map in RESEARCH.md: 正常系 (writes `data/urgency-history.json` with correct dateKey), skip (missing/0-holdings input, D-13, `process.exit` NOT called with 1), corrupted (existing history unparseable, D-14, exit 1, preserved), 不正な date (isValidDateKey fails, exit 1, no write).

**Exit-code assertion pattern** (lines 144-161, ENOENT case):
```typescript
it("Test 2: curation欠損(ENOENT) -- フォールバックHTMLを書き出し exit code 1", async () => {
  // ... mock readFile to reject on the target file ...
  const { main } = await import("./write-news-digest.js");
  await main();
  expect(process.exit).toHaveBeenCalledWith(1);
});
```

---

### `.claude/commands/invest.md` — new Step 3f + Step 4 extension (config, pipeline orchestration)

**Analog:** `.claude/commands/invest.md` §Step 3e (lines 1985-2052, news-digest) for the new step template; §Step 4 deploy block (lines 2086-2136) for the `git add` extension point.

**Step 3e template to copy structurally for new Step 3f** (lines 1985-2019, abbreviated to the reusable skeleton):
```markdown
### Step 3e: ニュースダイジェスト生成

「ニュースダイジェストを生成中...」とユーザーに表示してください。

以下のBashコマンドを実行してください:

\`\`\`bash
cd /Users/arai/invest && npx tsx src/scripts/write-news-digest.ts
\`\`\`

スクリプトの終了コードに関わらず、Step 4 へ進んでください（fail-soft, D-09）。

終了コードが 0 の場合:
\`\`\`bash
echo '[STEP:news-digest:OK]'
\`\`\`

終了コードが非0の場合:
\`\`\`bash
echo '[STEP:news-digest:FAIL:キュレーション生成またはHTML書き出しに失敗（詳細はログのconsole.error出力を参照）]'
\`\`\`

**`[PIPELINE:FAIL]` は絶対に出力しないこと** — この失敗は既存3レポート・デプロイをブロックしない（OPS-04）。
```
New Step 3f (insert between line 2052 and the `---`/`## Step 4` boundary at line 2056) should be a direct substitution: `news-digest`/`write-news-digest.ts` → `urgency-history`/`write-urgency-history.ts`, matching Phase 25's own D-09 decision and the RESEARCH.md Code Examples §"invest.md new step" verbatim.

**Pipeline-metrics timestamp bookend pattern** (used before/after every step, e.g. lines 1989-1999 and 2042-2052 for Step 3e): if the planner wants Step 3f to participate in the Pipeline Timing summary (optional, not required by any locked decision), follow this exact `node -e "..."` read-modify-write-to-tmp/pipeline-metrics.json idiom with a new `m.urgencyHistoryStart`/`m.urgencyHistoryEnd` key pair.

**Step 4 `git add` extension point — exact diff target** (line 2104 in the currently-read file):
```javascript
// docs/ をステージング
execSync('git add docs/', { stdio: 'inherit' });
```
Per RESEARCH.md's verified Pitfall 1 (`git add` on a non-existent pathspec exits 128 and would crash the entire deploy step, uncaught, since this line is not wrapped in its own try/catch — only the later commit/push calls are, see lines 2119-2134), the extension must be:
```javascript
// data/urgency-history.json は write-urgency-history.ts の mkdir(DATA_DIR, {recursive:true})
// により Step 3f 完了時点で必ず存在する。念のため二重防御で存在確認する。
if (!fs.existsSync('data')) fs.mkdirSync('data', { recursive: true });
execSync('git add docs/ data/', { stdio: 'inherit' });
```
`fs` is already required at the top of this same `node -e` block (line 2091: `const fs = require('fs');`), so no new import is needed inside the deploy script. No other line in the deploy block (`git diff --staged --quiet` at 2109, commit message at 2120, push at 2126) needs to change — they operate on whatever is staged.

**Date validation regex already present at the integration point** (line 2098, reuse verbatim for `isValidDateKey` in `urgency-history.ts` per D-06):
```javascript
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  console.error('不正なdate形式: ' + date);
  process.exit(1);
}
```

**JST date-derivation snippet (Step 3d, lines 1701-1719)** — reference only, NOT to be used as `dateKey`'s source per RESEARCH.md Pitfall 2 (use `meeting-result.json`'s `date` field instead, for exact alignment with Step 4's `docs/{date}/` and commit message):
```javascript
const todayJst = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
```

---

### `src/meeting/types.ts` — possible `HoldingUrgencySnapshot` addition (model)

**Analog:** same file, existing sibling interfaces `HoldingEvaluation` (lines 110-132) and `PortfolioAnalysis` (lines 134-140) — the source types this phase's snapshot type derives from.

**Existing type to derive the 4 fields from** (lines 110-140, verbatim):
```typescript
export interface HoldingEvaluation {
  readonly symbol: string;
  readonly nameJa: string;
  readonly decision: "保持" | "買増" | "一部売却" | "全売却";
  readonly rationale: string;
  readonly riskNote?: string;
  readonly urgent: boolean;
  readonly previousDecision?: "保持" | "買増" | "一部売却" | "全売却";
  readonly decisionChanged?: boolean;
}

export interface PortfolioAnalysis {
  readonly date: string;
  readonly generatedAt: string;
  readonly overallComment: string;
  readonly holdings: ReadonlyArray<HoldingEvaluation>;
  readonly rebalanceActions: ReadonlyArray<string>;
}
```
**Decision guidance (D-02, Claude's Discretion in CONTEXT.md):** the codebase's existing convention for a narrowed field subset is a **freestanding new interface with the same literal union type repeated** (see `HoldingEvaluation.decision`'s union type, which is not extracted into a shared type alias elsewhere in this file) rather than `Pick<HoldingEvaluation, ...>`. If the planner chooses this convention (recommended for consistency — none of the 6 interfaces in this file use `Pick`/`Omit` derivation), place `HoldingUrgencySnapshot`/`UrgencyHistoryFile` in `src/portfolio/urgency-history.ts` itself (matching D-07's file-placement decision), NOT in `meeting/types.ts` — `meeting/types.ts` is reserved for LLM-output-shaped types (`AnalystRoundNOutput`, `MeetingResult`, `HoldingEvaluation`, `PortfolioAnalysis`, `NewsCuration`), while `HoldingUrgencySnapshot` is a derived/persisted type belonging to the `portfolio/` domain, consistent with `HoldingNewsEntry`/`HoldingNewsFile` living in `holding-news.ts` rather than `meeting/types.ts`.

## Shared Patterns

### Fail-soft pipeline step, never `[PIPELINE:FAIL]`
**Source:** `.claude/commands/invest.md` §Step 3e (lines 2007, 2019) and `src/scripts/write-news-digest.ts` (`process.exit(1)` on failure, but the pipeline continues regardless)
**Apply to:** `write-urgency-history.ts`, the new Step 3f block
```markdown
スクリプトの終了コードに関わらず、Step 4 へ進んでください（fail-soft）。
**`[PIPELINE:FAIL]` は絶対に出力しないこと**
```

### Pure-function module discipline (no throw, no I/O, immutable inputs)
**Source:** `src/portfolio/holding-news.ts` (JSDoc: "副作用なし... throwしない...") and `src/portfolio/decision-diff.ts` (JSDoc: "純関数: throw なし、I/O なし。入力配列は変更しない。")
**Apply to:** `src/portfolio/urgency-history.ts` (all three exported functions)

### Symbol normalization single source of truth
**Source:** `src/portfolio/holding-news.ts` lines 24-34, `normalizeHoldingSymbol`
**Apply to:** `src/portfolio/urgency-history.ts`'s `extractUrgencySnapshots` (D-10) — import and reuse, never reimplement `.trim().toUpperCase()` locally.

### Self-generated-artifact read = plain JSON.parse, never zod
**Source:** `src/scripts/report-data-loaders.ts` §`loadHoldingNews` (lines 121-133)
**Apply to:** `write-urgency-history.ts`'s read of both `data/urgency-history.json` (its own prior output) and (per RESEARCH.md recommendation) `tmp/portfolio-analysis.json` inside this script specifically (avoiding the zod-validated `loadPortfolioAnalysis()` to keep D-13's skip-with-OK semantics distinct from that loader's own `console.error` convention).

### `mkdir(DIR, { recursive: true })` as first/unconditional statement before any fail-soft branching
**Source:** `src/scripts/write-news-digest.ts` line 23 (`await mkdir(dateDir, { recursive: true });` placed immediately after the date is known, before the risky `try` block begins)
**Apply to:** `write-urgency-history.ts` — `await mkdir(DATA_DIR, { recursive: true });` must be the first statement in `main()`, per RESEARCH.md's verified Pitfall 1 (Step 4's `git add docs/ data/` will crash with exit 128 if `data/` never existed on disk).

### Date-format validation regex reused verbatim across the codebase
**Source:** `.claude/commands/invest.md` line 2098 (`/^\d{4}-\d{2}-\d{2}$/`)
**Apply to:** `isValidDateKey` in `urgency-history.ts` (D-06) — use the identical regex, not a re-derived or `Date.parse`-based check, so the two validation points can never disagree.

### Same-day / same-key overwrite = "new value wins", expressed as either array-filter-then-append or object-key-spread
**Source:** `src/scripts/update-index.ts` §`mergeEntry` (lines 86-93, array form) — `src/scripts/generate-report.ts` §`resolvePrevHoldingsForDiff` also encodes the same "same-date = special-cased" semantics (not read in full this session; referenced in CONTEXT.md/RESEARCH.md canonical refs, L94-118)
**Apply to:** `appendUrgencySnapshot` (D-04) — the object-map form (`{ ...history, [dateKey]: snapshots }`) is strictly simpler than the array form since object keys are inherently unique; no filter/dedup step is needed at all.

## No Analog Found

None. All 5 new/modified files (including the type-definition discretion point) have a direct, exact-match analog already implemented and tested in this codebase. This phase is a structural transplant, not novel design — every pattern needed already exists in `src/portfolio/`, `src/scripts/`, and `.claude/commands/invest.md`.

## Metadata

**Analog search scope:** `src/portfolio/`, `src/scripts/`, `src/meeting/types.ts`, `.claude/commands/invest.md`, `.gitignore`
**Files scanned:** `holding-news.ts`, `holding-news.test.ts`, `decision-diff.ts`, `decision-diff.test.ts`, `update-index.ts`, `write-news-digest.ts`, `write-news-digest.test.ts`, `report-data-loaders.ts`, `meeting/types.ts`, `.claude/commands/invest.md` (Step 3d/3e/Step 4 sections), `.gitignore`
**Pattern extraction date:** 2026-07-04

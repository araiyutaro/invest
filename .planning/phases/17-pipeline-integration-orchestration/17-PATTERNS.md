# Phase 17: Pipeline Integration & Orchestration - Pattern Map

**Mapped:** 2026-07-02
**Files analyzed:** 3 (1 new production file, 1 new test file, 1 modified orchestration file)
**Analogs found:** 3 / 3

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `src/scripts/write-news-digest.ts` | CLI orchestrator script (service-like) | file-I/O + transform (read tmp/*.json → validate → resolve → render → write docs/*.html) | `src/scripts/validate-meeting.ts` (exit-code CLI convention) + `src/scripts/report-data-loaders.ts` `loadPortfolioAnalysis()` (graceful-null loader) + `src/scripts/generate-report.ts` `main()` (multi-file orchestration + `fileURLToPath` entrypoint guard) | exact (composite of 3 established conventions, no single file covers all of it) |
| `src/scripts/write-news-digest.test.ts` | test | request-response (module import) + file-I/O mock | `src/scripts/generate-report.test.ts` (`describe("3-report output")` block, `vi.mock("node:fs/promises")` + `main()` invocation) | exact |
| `.claude/commands/invest.md` (Step 3d block) | route/orchestration (Markdown-as-pipeline-DSL, Agent invocation) | event-driven (Agent tool call) + request-response | same file, existing Step 3d `portfolio-analyst` single-Agent block (lines 1564-1636) + existing 5-way parallel Agent header pattern (lines 148, 519, 899, 1347) | exact (in-file precedent) |
| `.claude/commands/invest.md` (new Step 3e block: CLI invocation + STEP marker + metrics) | route/orchestration (Bash step in pipeline DSL) | file-I/O + event-driven | same file, existing Step 3c `generate-report.ts` invocation block (lines 1654-1721) — **but deliberately diverge on failure-handling text (D-09), do not copy the "stop the pipeline" branch** | role-match with explicit divergence required |

## Pattern Assignments

### `src/scripts/write-news-digest.ts` (CLI orchestrator, file-I/O + transform)

**Primary analog:** `src/scripts/generate-report.ts` (129 lines) for the overall shape (imports, `TMP_DIR`/`DOCS_DIR` constants, `main()` + `fileURLToPath` entrypoint guard, `mkdir` before `writeFile`).
**Secondary analog:** `src/scripts/validate-meeting.ts` (23 lines) for the minimal exit-code-on-failure CLI convention.
**Tertiary analog:** `src/scripts/report-data-loaders.ts` `loadPortfolioAnalysis()` (lines 74-82) for the "catch → console.error → return null/fallback" graceful-degradation shape that D-08's null-fallback branch mirrors.

**Imports + directory constants pattern** (`generate-report.ts` lines 1-12):
```typescript
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { validateMeetingResult, validateWebSearchResult, validateReevaluationOutput } from "../meeting/schemas.js";
import type { MeetingResult, WebSearchResult, ReevaluationOutput, PortfolioAnalysis } from "../meeting/types.js";
import { generateDailyReportHtml } from "./generate-daily-report.js";
// ...

const TMP_DIR = join(import.meta.dirname, "../../tmp");
const DOCS_DIR = join(import.meta.dirname, "../../docs");
```
For `write-news-digest.ts`, replace the daily-report-specific imports with:
```typescript
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { validateRawNewsCuration, resolveNewsCuration } from "../meeting/schemas.js";
import type { NewsArticlePoolEntry } from "../meeting/schemas.js";
import { generateNewsDigestHtml } from "./generate-news-digest.js";
```

**Graceful-null loader pattern to mirror for the D-08 fallback** (`report-data-loaders.ts` lines 74-82):
```typescript
export async function loadPortfolioAnalysis(): Promise<PortfolioAnalysis | null> {
  try {
    const raw = await readFile(join(TMP_DIR, "portfolio-analysis.json"), "utf-8");
    return portfolioAnalysisSchema.parse(JSON.parse(raw) as unknown) as PortfolioAnalysis;
  } catch (error) {
    console.error('Portfolio analysis load failed:', error instanceof Error ? error.message : error);
    return null;
  }
}
```
This is the exact shape `generateNewsDigestHtml(curation: NewsCuration | null, date: string)` was designed around (Phase 16) — `write-news-digest.ts`'s `try/catch` should produce `curation = null` on any failure and let the renderer's existing null-branch do the fallback HTML, rather than hand-rolling a separate fallback string.

**`main()` orchestration + entrypoint guard pattern** (`generate-report.ts` lines 89-129):
```typescript
export async function main(): Promise<void> {
  console.log("レポート生成開始...");
  const raw = await readFile(join(TMP_DIR, "meeting-result.json"), "utf-8");
  const meetingResult = validateMeetingResult(JSON.parse(raw) as unknown);
  // ... parallel loaders via Promise.all ...
  const dateDir = join(DOCS_DIR, meetingResult.date);
  await mkdir(dateDir, { recursive: true });
  // ... render ...
  await Promise.all([
    writeFile(join(dateDir, "daily-report.html"), dailyHtml, "utf-8"),
    // ...
  ]);
  console.log("レポート生成完了: docs/" + meetingResult.date + "/");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
```
**Critical divergence for `write-news-digest.ts` (per D-08/D-10/Pitfall 2 in RESEARCH.md):** unlike `generate-report.ts`, the success/failure signal must be the process **exit code**, decoupled from "did the file get written" (the file is written on every run per D-08). Wrap the curation-specific logic (read `tmp/news-curation.json` → `validateRawNewsCuration` → read `tmp/news.json` pool → `resolveNewsCuration` → `generateNewsDigestHtml(curation, date)`) in its own inner `try { ... } catch (error) { generateNewsDigestHtml(null, date); ...; process.exit(1); }`, separate from the outer `main().catch(...)` fatal-error guard that `validate-meeting.ts`/`generate-report.ts` both already use.

**Minimal exit-code CLI convention** (`validate-meeting.ts`, full file, 23 lines):
```typescript
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { validateMeetingResult } from "../meeting/schemas.js";

const TMP_DIR = join(import.meta.dirname, "../../tmp");

export async function validate() {
  const filePath = join(TMP_DIR, "meeting-result.json");
  const raw = await readFile(filePath, "utf-8");
  const data = JSON.parse(raw) as unknown;
  const result = validateMeetingResult(data);
  console.log("Validation passed");
  return result;
}

validate().catch((error) => {
  console.error("Validation failed:", error);
  process.exit(1);
});
```
Note this file calls the top-level async function directly (no `fileURLToPath` guard) because it's always run as a CLI, never imported as a library. `write-news-digest.ts` should use `generate-report.ts`'s `fileURLToPath` guard instead (since it also exports `main()` for the test file to import), not this simpler pattern.

**Phase 15/16 contracts this script calls, verbatim signatures** (`src/meeting/schemas.ts` lines 222-291, `src/scripts/generate-news-digest.ts` line 122):
```typescript
export function validateRawNewsCuration(data: unknown): RawNewsCuration; // THROWS on structural violation (bad enum/type)
export interface NewsArticlePoolEntry {
  readonly id: string;
  readonly title: string;
  readonly url: string;
  readonly source: string;
  readonly publishedAt: string;
  readonly ticker?: string;
}
export function resolveNewsCuration(
  raw: RawNewsCuration,
  pool: ReadonlyArray<NewsArticlePoolEntry>,
  date: string,
  generatedAt: string,
): NewsCuration; // NEVER throws — drops unknown/duplicate IDs + empty commentary via console.warn, soft-clamps to 15

export function generateNewsDigestHtml(curation: NewsCuration | null, date: string): string;
```
Do not reimplement any of this logic (see RESEARCH.md "Don't Hand-Roll" table) — `write-news-digest.ts` is purely a thin caller sequencing these four calls plus `readFile`/`writeFile`/`mkdir`.

**Recommended full shape** (synthesized from the 3 analogs above, RESEARCH.md Code Examples section, already vetted against D-08/D-10/Pitfall 2):
```typescript
export async function main(): Promise<void> {
  const meetingRaw = await readFile(join(TMP_DIR, "meeting-result.json"), "utf-8");
  const date = (JSON.parse(meetingRaw) as { date: string }).date;
  const dateDir = join(DOCS_DIR, date);
  await mkdir(dateDir, { recursive: true });

  try {
    const rawJson = await readFile(join(TMP_DIR, "news-curation.json"), "utf-8"); // may ENOENT (D-07: agent failed twice)
    const raw = validateRawNewsCuration(JSON.parse(rawJson)); // may throw (structural violation)
    const poolRaw = await readFile(join(TMP_DIR, "news.json"), "utf-8");
    const pool = JSON.parse(poolRaw) as ReadonlyArray<NewsArticlePoolEntry>;
    const curation = resolveNewsCuration(raw, pool, date, new Date().toISOString()); // never throws
    const html = generateNewsDigestHtml(curation, date);
    await writeFile(join(dateDir, "news-digest.html"), html, "utf-8");
    console.log("news-digest.html generated: " + curation.articles.length + " articles");
  } catch (error) {
    const html = generateNewsDigestHtml(null, date); // D-08: fallback page written on EVERY failure path
    await writeFile(join(dateDir, "news-digest.html"), html, "utf-8");
    console.error("news-digest fallback:", error instanceof Error ? error.message : error);
    process.exit(1); // exit code IS the OK/FAIL signal invest.md reads (D-10)
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
```

---

### `src/scripts/write-news-digest.test.ts` (test, file-I/O mock + request-response)

**Analog:** `src/scripts/generate-report.test.ts`, `describe("3-report output")` block (lines 382-509), specifically Test 9/11/14.

**Mock setup pattern** (lines 1-11):
```typescript
vi.mock("node:fs/promises", () => ({
  readFile: vi.fn().mockRejectedValue(new Error("ENOENT")),
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
  readdir: vi.fn().mockResolvedValue([]),
}));

vi.spyOn(process, "exit").mockImplementation((() => {}) as never);
```
(`write-news-digest.ts` doesn't need `readdir`, so drop it from the mock object.)

**Per-test conditional `readFile` mock + `main()` invocation + `writeFile` call assertion pattern** (lines 395-417, adapt path substrings):
```typescript
it("Test 9: main() が docs/YYYY-MM-DD/daily-report.html にファイルを書き出す（fs mock 経由で確認）", async () => {
  const fsMock = await import("node:fs/promises");
  const meetingResultJson = JSON.stringify(validMeetingResult);
  (fsMock.readFile as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
    if (String(path).includes("meeting-result.json")) {
      return Promise.resolve(meetingResultJson);
    }
    return Promise.reject(new Error("ENOENT"));
  });
  const { main } = await import("./generate-report.js");
  await main();
  const writeCalls = (fsMock.writeFile as ReturnType<typeof vi.fn>).mock.calls;
  const reportCall = writeCalls.find((call) => String(call[0]).includes("daily-report.html"));
  expect(reportCall).toBeDefined();
  expect(String(reportCall![0])).toContain("2026-06-24");
});
```
For `write-news-digest.ts`'s test file, this pattern directly covers RESEARCH.md's 3 required manual/integration scenarios (normal day / malformed JSON / missing file) — mock `tmp/news-curation.json` present+valid for the happy path, mock it `mockRejectedValue(new Error("ENOENT"))` for the missing-file path, and mock it resolving to invalid JSON (bad enum value) for the malformed path — asserting in each case that `writeFile(..., "news-digest.html", ...)` is called (D-08: always written) and, for the failure paths, that `process.exit` was called with `1` (via the `vi.spyOn(process, "exit")` mock already shown above).

**`beforeEach`/`afterEach` mock-reset pattern** (lines 383-393):
```typescript
beforeEach(async () => {
  const fsMock = await import("node:fs/promises");
  (fsMock.writeFile as ReturnType<typeof vi.fn>).mockClear();
  (fsMock.mkdir as ReturnType<typeof vi.fn>).mockClear();
  (fsMock.readFile as ReturnType<typeof vi.fn>).mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});
```

---

### `.claude/commands/invest.md` — Step 3d: add `news-curator` as 2nd parallel Agent (D-01, D-02)

**Analog (in-file):** existing single-Agent Step 3d block for `portfolio-analyst` (lines 1564-1636) + existing 5-way parallel-Agent header convention used 3x elsewhere in the same file (lines 148, 519, 899, 1347).

**Current single-Agent header to convert to 2-Agent parallel header:**
```
**1つの Agent ツールを呼び出してください:**

- name: `portfolio-analyst`
- model: `opus`
- prompt: 以下の内容を含めてください
    [... existing portfolio-analyst prompt, unchanged ...]
```
**Target shape** (per D-01, mirroring the existing 5-way parallel header phrasing exactly, just N=2):
```
**以下2つの Agent ツールを同時に（1つのメッセージで並列）呼び出してください:**

- name: `portfolio-analyst`
  model: `opus`
  prompt: [... existing portfolio-analyst prompt, unchanged ...]

- name: `news-curator`
  model: `opus`
  prompt: [... new prompt satisfying D-03/D-04/D-05/D-06, structural JSON example below ...]
```
The 5-way parallel precedent's exact header text (verified, line 148 of the current file):
```
**以下5つの Agent ツールを同時に（1つのメッセージで並列）呼び出してください:**
```

**JSON-output-only instruction convention to reuse verbatim for `news-curator`'s prompt** (`portfolio-analyst` block, lines 1592-1595):
```
以下のJSONフォーマット**のみ**を出力してください。他のテキストは一切出力しないでください。
マークダウンコードブロック（```json）も不要です。JSONオブジェクトのみを出力してください。

**重要: フィールド名は以下の通り正確に使用すること。独自のフィールド名（...）に変えてはならない。**
```

**"Step 3d 完了後の処理" file-handoff convention to extend for `news-curator`** (lines 1631-1636):
```
**Step 3d 完了後の処理:**

エージェントの応答を JSON としてパースし、以下のファイルに保存してください:
- `portfolio-analyst` の出力 -> `/Users/arai/invest/tmp/portfolio-analysis.json`

出力が有効な JSON でない場合は、エージェントを1回リトライしてください。2回目も失敗した場合は「警告: ポートフォリオ分析の生成に失敗しました。フォールバック表示で続行します。」とユーザーに表示して続行してください（portfolio-analysis.json を作成しない）。
```
Add a second bullet + a second retry-then-skip paragraph for `news-curator` -> `tmp/news-curation.json`, substituting the D-07 warning text: 「警告: ニュースキュレーションの生成に失敗しました。フォールバック表示で続行します。」（tmp/news-curation.json を作成しない）— **copy this template verbatim per RESEARCH.md Pattern 2, do not invent a different retry mechanism.**

**`portfolioStart`/`portfolioEnd` metrics-timestamp Bash block to mirror for a `newsCurationStart`/`newsCurationEnd` (or similar) key** (lines 1546-1553, 1642-1650):
```bash
node -e "
const fs = require('fs');
let m = {};
try { m = JSON.parse(fs.readFileSync('/Users/arai/invest/tmp/pipeline-metrics.json', 'utf-8')); } catch(e) {}
m.portfolioStart = Date.now();
fs.writeFileSync('/Users/arai/invest/tmp/pipeline-metrics.json', JSON.stringify(m, null, 2));
"
```
Since `news-curator` runs in the *same parallel window* as `portfolio-analyst` (D-01), the timing key naming should make clear it shares the `portfolioStart`/`portfolioEnd` window rather than implying a separate serial duration — exact key naming is Claude's Discretion per CONTEXT.md, but should not double-count wall-clock time in the final timing table (see next section).

---

### `.claude/commands/invest.md` — new Step 3e: `write-news-digest.ts` CLI invocation + STEP marker (D-09, D-10, D-11)

**Analog (in-file, with required divergence):** existing Step 3c `generate-report.ts` invocation block (lines 1654-1721) for the overall shape (timestamp-start → `npx tsx` command → timestamp-end → STEP marker), and Step 4's `update-index.ts` invocation (lines 1743-1753) as the second-nearest precedent for "run script, branch on exit behavior."

**Structural pattern to copy** (`invest.md` lines 1658-1721, timestamp + command + STEP marker shape):
```
以下のBashコマンドで レポート生成 の計測タイムスタンプを記録してください:
[node -e timestamp-start block, sets m.reportStart]

以下のBashコマンドを実行してください:
```bash
cd /Users/arai/invest && npx tsx src/scripts/generate-report.ts
```
[... error handling ...]

以下のBashコマンドで レポート生成完了 タイムスタンプを記録してください:
[node -e timestamp-end block, sets m.reportEnd]

```bash
echo '[STEP:report-generation:OK]'
```
```

**CRITICAL DIVERGENCE — do not copy this error-handling text (this is the exact regression RESEARCH.md's Pitfall 1 warns against):**
```
`generate-report.ts` がエラーで終了した場合は、以下を実行してからパイプラインを停止してください:
```bash
echo '[STEP:report-generation:FAIL:レポート生成スクリプトがエラーで終了]'
echo '[PIPELINE:FAIL] ステップ: report-generation, エラー: レポート生成スクリプトがエラーで終了'
```
```
For `write-news-digest.ts`, the new Step 3e prose must instead say the opposite — continue to Step 4 regardless of exit code, choosing only the STEP marker line based on it:
```
以下のBashコマンドを実行してください:
```bash
cd /Users/arai/invest && npx tsx src/scripts/write-news-digest.ts
```

スクリプトの終了コードに関わらず、Step 4 へ進んでください（fail-soft, D-09）。
終了コードが 0 の場合:
```bash
echo '[STEP:news-digest:OK]'
```
終了コードが非0の場合:
```bash
echo '[STEP:news-digest:FAIL:キュレーション生成またはHTML書き出しに失敗（詳細はログのconsole.error出力を参照）]'
```
**`[PIPELINE:FAIL]` は絶対に出力しないこと** — この失敗は既存3レポート・デプロイをブロックしない（OPS-04）。
```
This exact wording distinction — "パイプラインを停止してください" (existing, hard-fail steps) vs. "Step 4 へ進んでください" (new, fail-soft step) — is the single most important thing to get right in this file per RESEARCH.md's Pitfall 1/Warning signs section.

**Placement:** insert as a new `### Step 3e: ニュースダイジェスト生成` heading, positioned after Step 3c's `[STEP:report-generation:OK]` echo (line ~1721) and before `## Step 4` (line 1725) — per RESEARCH.md Open Question 1's recommendation (separate heading, own STEP-marker-scoped unit of work, matches this file's existing one-heading-per-STEP-marker convention).

**Pipeline Timing summary table row to add** (`invest.md` lines 1887-1891, extend this `console.log` block):
```javascript
console.log('  ポートフォリオ分析      ' + fmt(m.portfolioEnd - m.portfolioStart));
console.log('  レポート生成            ' + fmt(m.reportEnd - m.reportStart));
```
Add a `ニュースキュレーション/ダイジェスト` row using whatever key names were chosen for the Step 3e timestamps, following the same `fmt(m.XEnd - m.XStart)` call shape and the same 2-space-indent-under-`Step 3:` visual grouping already used for `ポートフォリオ分析`/`レポート生成`.

---

## Shared Patterns

### File-handoff convention (`tmp/*.json`)
**Source:** `invest.md` lines 1631-1636 (`portfolio-analyst` → `tmp/portfolio-analysis.json`)
**Apply to:** `news-curator`'s Agent output → `tmp/news-curation.json`
Every Agent step's "完了後の処理" prose explicitly instructs saving the parsed JSON response to a `tmp/*.json` file before any downstream script reads it — this is the sole TS↔Claude boundary in this codebase (never assume a script can read an Agent's raw stdout). `write-news-digest.ts` must only ever read `tmp/news-curation.json` (never anything Agent-authored directly), consistent with `generate-report.ts`'s existing `loadPortfolioAnalysis()`/`loadRound1Results()` pattern of reading exclusively from `tmp/*.json`.

### Retry-once-then-skip (fail-soft Agent output handling)
**Source:** `invest.md` line 1636 (verbatim)
**Apply to:** `news-curator`'s Step 3d completion handling (D-07)
```
出力が有効な JSON でない場合は、エージェントを1回リトライしてください。2回目も失敗した場合は
「警告: [...]」とユーザーに表示して続行してください（[ファイル名] を作成しない）。
```
Do not invent a different retry mechanism — this is the codebase's single established convention for "optional Agent step that may fail."

### STEP marker + fail-soft vs. hard-fail distinction
**Source:** `invest.md` — contrast `report-generation`/`deploy` (hard-fail, lines 1676-1680, 1749-1753, 1816-1820) vs. the new `news-digest` marker (fail-soft, D-09)
**Apply to:** all new Step 3e Bash/prose
```
echo '[STEP:news-digest:OK]'         # success
echo '[STEP:news-digest:FAIL:<reason>]'  # failure — log-only, never paired with [PIPELINE:FAIL]
```
Verified mechanism (RESEARCH.md, direct read of `scripts/run.sh` lines 35-79): `run.sh`'s success/failure notification is gated solely by the `claude ... -p "/invest"` process's own `EXIT_CODE`, not by STEP-marker-FAIL-count — so emitting `[STEP:news-digest:FAIL:...]` is always safe for OPS-04's log-visibility requirement as long as `invest.md`'s own prose never itself decides to stop or emit `[PIPELINE:FAIL]` because of it.

### Pipeline-metrics timestamp bookkeeping
**Source:** `invest.md`, repeated `node -e` block pattern (e.g. lines 1546-1553, 1642-1650, 1658-1668, 1707-1717)
**Apply to:** new `news-digest` timing keys (D-11)
```javascript
node -e "
const fs = require('fs');
let m = {};
try { m = JSON.parse(fs.readFileSync('/Users/arai/invest/tmp/pipeline-metrics.json', 'utf-8')); } catch(e) {}
m.<keyName> = Date.now();
fs.writeFileSync('/Users/arai/invest/tmp/pipeline-metrics.json', JSON.stringify(m, null, 2));
"
```
This exact block (only the `m.<keyName>` line changes) is copy-pasted 10+ times already in `invest.md` — follow it exactly for both the Step 3d parallel-window key and the Step 3e CLI-invocation key.

### Escaping / XSS mitigation (already handled, do not touch)
**Source:** `src/scripts/generate-news-digest.ts` (`escapeHtml`, `safeHref` — lines 60-63, used throughout `formatArticleCardHtml`)
**Apply to:** N/A for this phase — `write-news-digest.ts` must never re-implement or bypass this; it only calls `generateNewsDigestHtml()` as an opaque function.

## No Analog Found

None. Every file this phase touches has at least one strong in-codebase analog (the new CLI script composites 3 existing conventions; the new test file has a near-identical `main()`-testing precedent; the `invest.md` edits extend existing in-file blocks).

## Metadata

**Analog search scope:** `src/scripts/`, `.claude/commands/invest.md`, `src/meeting/schemas.ts`, `src/meeting/types.ts`, `scripts/run.sh`
**Files scanned:** `validate-meeting.ts`, `validate-meeting.test.ts`, `report-data-loaders.ts`, `generate-report.ts`, `generate-report.test.ts`, `generate-news-digest.ts`, `schemas.ts` (News Curation Contract section), `invest.md` (Step 3d/3c/4/pipeline-completion sections, 5-way parallel Agent header precedent), `data/news/types.ts`
**Pattern extraction date:** 2026-07-02

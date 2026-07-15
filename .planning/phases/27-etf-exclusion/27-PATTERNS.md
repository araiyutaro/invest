# Phase 27: ETF Exclusion - Pattern Map

**Mapped:** 2026-07-15
**Files analyzed:** 4 (3 new + 1 modified; 4 reference-only)
**Analogs found:** 4 / 4

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `src/portfolio/etf-exclusion.ts` | utility (pure classification module) | transform | `src/portfolio/urgency-history.ts` | exact |
| `src/portfolio/etf-exclusion.test.ts` | test | transform | `src/portfolio/urgency-history.test.ts` | exact |
| `src/scripts/filter-etf-stocks.ts` | script (fail-soft CLI wrapper) | file-I/O + request-response (batch API call) | `src/scripts/write-urgency-history.ts` | exact |
| `.claude/commands/invest.md` (Step 2a x5, Step 2f, Step 2g insert) | config/prompt (pipeline orchestration text) | event-driven (pipeline step sequencing) | Step 3f `write-urgency-history` fail-soft block (same file, lines 1916-1938) | exact |

## Pattern Assignments

### `src/portfolio/etf-exclusion.ts` (utility, transform)

**Analog:** `src/portfolio/urgency-history.ts` (57 lines, full file read)

**Imports pattern** (lines 1-2):
```typescript
import { normalizeHoldingSymbol } from "./holding-news.js";
import type { PortfolioAnalysis } from "../meeting/types.js";
```
For this phase, replace with:
```typescript
import type { MeetingResult } from "../meeting/types.js";
```
No other project imports needed — this is a zero-dependency pure module (mirrors the "no I/O" shape).

**Type/interface pattern** (lines 9-20, JSDoc + type):
```typescript
/**
 * data/urgency-history.json の1日1銘柄分のスナップショット。
 * D-02: 保存フィールドは symbol/nameJa/urgent/decision の4つのみ。
 */
export interface HoldingUrgencySnapshot {
  readonly symbol: string;
  readonly nameJa: string;
  readonly urgent: boolean;
  readonly decision: "保持" | "買増" | "一部売却" | "全売却";
}

export type UrgencyHistoryFile = Record<string, ReadonlyArray<HoldingUrgencySnapshot>>;
```
Apply the same "readonly interface + decision-doc-comment referencing the locked decision ID" convention for `QuoteTypeLookup` / `EtfExclusionResult` (see RESEARCH.md Pattern 1 for the target shape — reuse verbatim, it already mirrors this analog's style).

**Core pure-function pattern** (lines 27-36 and 42-48):
```typescript
/**
 * D-02, D-10: PortfolioAnalysis.holdings から最小4フィールドを決定論的に抽出する。
 * 純関数: throw なし、I/O なし。入力 analysis は変更しない。
 */
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

/**
 * D-04: 同日ガードは日付キー上書き。immutable spread で history を一切 mutate しない。
 */
export function appendUrgencySnapshot(
  history: UrgencyHistoryFile,
  dateKey: string,
  snapshots: ReadonlyArray<HoldingUrgencySnapshot>,
): UrgencyHistoryFile {
  return { ...history, [dateKey]: snapshots };
}
```
Copy the shape exactly for `filterEtfStocks`: JSDoc citing the locked decision IDs (D-01/D-04), signature takes plain-data inputs only (no network/fs types), body is a single `for`/`.map` loop building new arrays, never mutates the input parameter. RESEARCH.md's Pattern 1 code block already gives the exact target implementation — use it verbatim as the file body, keeping this analog's doc-comment style (Japanese, decision-ID-cited).

**Validation-guard pattern** (lines 50-56):
```typescript
/**
 * D-06: 書き込み前の date キー検証。
 * "__proto__" のような prototype-pollution 狙いのキーも構造的に拒否する。
 */
export function isValidDateKey(dateKey: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateKey);
}
```
Relevant precedent for the security note in RESEARCH.md ("prefer Map over plain object for ticker keys to avoid prototype pollution") — `QuoteTypeLookup` must be a `ReadonlyMap<string, ...>` parameter, not a `Record<string, ...>`, following this same defensive-key philosophy even though no analog function is byte-identical here.

**Error handling:** None — this file must contain zero try/catch, zero throw, per D-06 ("純関数モジュール... ネットワーク非依存") and this analog's own convention (`urgency-history.ts` has no try/catch anywhere; all fallibility lives in the CLI wrapper).

---

### `src/portfolio/etf-exclusion.test.ts` (test, transform)

**Analog:** `src/portfolio/urgency-history.test.ts` (164 lines, full file read)

**Imports + fixture-factory pattern** (lines 1-40):
```typescript
import { describe, it, expect } from "vitest";
import {
  extractUrgencySnapshots,
  appendUrgencySnapshot,
  isValidDateKey,
  type UrgencyHistoryFile,
  type HoldingUrgencySnapshot,
} from "./urgency-history.js";
import type { HoldingEvaluation, PortfolioAnalysis } from "../meeting/types.js";

const makeHoldingEvaluation = (
  overrides: Partial<HoldingEvaluation>,
): HoldingEvaluation => ({
  symbol: "TEST",
  nameJa: "テスト株式会社",
  decision: "保持",
  rationale: "デフォルト理由",
  urgent: false,
  ...overrides,
});
```
Reuse this "factory function with `Partial<T>` overrides + sane defaults" convention for a `makeHighlightedStock(overrides)` fixture builder and a `makeQuoteTypeLookup(overrides)` builder (`{ status: "ok", quoteType: "EQUITY" }` default).

**Test structure / describe-per-function pattern** (lines 42-106, 108-142, 144-164):
```typescript
describe("extractUrgencySnapshots (D-02, D-10)", () => {
  it("holdings 全件について symbol/nameJa/urgent/decision の4フィールドのみを返す", () => {
    ...
  });
  it("呼び出し後、入力 analysis.holdings が不変", () => {
    const holdings = [makeHoldingEvaluation({ symbol: "MRNA" })];
    const analysis = makeAnalysis(holdings);
    const originalHoldings = [...analysis.holdings];
    extractUrgencySnapshots(analysis);
    expect(analysis.holdings).toEqual(originalHoldings);
  });
});
```
Mirror one `describe` block per exported function (`describe("filterEtfStocks (D-01/D-04)", ...)`), with each `it` title in Japanese naming the specific decision ID it verifies — matches D-15's required test matrix (US ETF/JP ETF/US equity/JP equity/lookup-failure) directly as five `it` blocks inside one `describe`. Include an explicit immutability assertion test (input array unchanged after call), copying the exact "capture originalHoldings, call fn, assert unchanged" idiom from lines 99-105.

**Edge-case coverage convention** (lines 144-164, `isValidDateKey` describe block): a short, single-assertion `it` per boundary case (empty string, malformed format, prototype-pollution key) — apply the same density (short one-liner tests) for quoteType edge cases (`undefined` quoteType, missing map entry, non-`"EQUITY"` values like `"MUTUALFUND"`/`"INDEX"`).

---

### `src/scripts/filter-etf-stocks.ts` (script, file-I/O + request-response)

**Analog:** `src/scripts/write-urgency-history.ts` (84 lines, full file read)

**Imports pattern** (lines 1-6):
```typescript
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { extractUrgencySnapshots, appendUrgencySnapshot, isValidDateKey } from "../portfolio/urgency-history.js";
import type { UrgencyHistoryFile } from "../portfolio/urgency-history.js";
import type { PortfolioAnalysis } from "../meeting/types.js";
```
For this phase (no `mkdir` needed — writing to existing `tmp/`, no new `data/` dir; add `yahoo-finance2` import per `src/data/market.ts` line 3 pattern below):
```typescript
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import YahooFinance from "yahoo-finance2";
import { filterEtfStocks } from "../portfolio/etf-exclusion.js";
import type { MeetingResult } from "../meeting/types.js";
```

**yahoo-finance2 instantiation pattern** (`src/data/market.ts` line 3, verified directly):
```typescript
const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });
```
Existing per-symbol call convention to AVOID copying (line 64, `market.ts`):
```typescript
const result = await yahooFinance.quote(symbol);
```
D-05 requires the single-batch-array form instead — `await yahooFinance.quote([...tickers])` once, per RESEARCH.md Pattern 2 (already fully worked out there; use verbatim).

**Path constants pattern** (lines 8-10):
```typescript
const TMP_DIR = join(import.meta.dirname, "../../tmp");
const DATA_DIR = join(import.meta.dirname, "../../data");
const HISTORY_PATH = join(DATA_DIR, "urgency-history.json");
```
Adapt to:
```typescript
const TMP_DIR = join(import.meta.dirname, "../../tmp");
const MEETING_RESULT_PATH = join(TMP_DIR, "meeting-result.json");
```

**Fail-soft read + parse guard pattern** (lines 12-26, the ENOENT dual-check convention — D-02's whole-mechanism-failure precedent):
```typescript
async function loadExistingHistory(): Promise<{ history: UrgencyHistoryFile; corrupted: boolean }> {
  try {
    const raw = await readFile(HISTORY_PATH, "utf-8");
    return { history: JSON.parse(raw) as UrgencyHistoryFile, corrupted: false };
  } catch (error) {
    // NodeJS.ErrnoException.code は本番実行では必ず "ENOENT" を持つが、
    // このプロジェクトの既存テスト規約は プレーンな Error(message) で ENOENT をシミュレートするため、
    // code と message の両方をチェックして一致させる。
    const isMissing =
      (error as NodeJS.ErrnoException).code === "ENOENT" ||
      (error instanceof Error && error.message.includes("ENOENT"));
    return isMissing ? { history: {}, corrupted: false } : { history: {}, corrupted: true };
  }
}
```
For this phase, the read-failure branch is simpler (no "corrupted" distinction needed — any read/parse failure is unconditionally D-02 fail-soft: log FAIL, skip write, exit). Use the RESEARCH.md Code Examples CLI-wrapper skeleton verbatim (already fully adapted for this phase, includes the exact try/catch boundaries needed for D-01/D-02/D-03 separation).

**main() orchestration + STEP-marker convention** (lines 32-76): read tmp artifact → guard early-return for empty/degenerate input (line 56-60, D-13 precedent: `console.error("[urgency-history] OK (skip: ...)")`") → call pure function → write result → single-line success log with counts (line 75: `` `[urgency-history] OK: ${dateKey} に${snapshots.length}銘柄分を記録` ``). Adapt success log to:
```typescript
console.error(`[filter-etf-stocks] OK: ${excluded.length}件除外, ${kept.length}件残存`);
```

**Entry-point guard pattern** (lines 78-83, identical in both analog and target):
```typescript
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
```
Copy verbatim — no adaptation needed.

**D-13 exclusion-logging convention** (new pattern this phase, no direct analog line, but same log-prefix style as `[urgency-history] OK/FAIL:`):
```typescript
console.log(`ETF除外: ${item.ticker} (quoteType=${item.quoteType})`);
console.log(`ETF除外: ${item.ticker} (quoteType取得失敗, fail-closed)`);
```
Use `console.log` for per-exclusion audit lines (D-13, human-readable stdout) and `console.error` for the STEP-status summary line (matches `write-urgency-history.ts`'s `console.error` convention for all `[urgency-history] ...` status lines — `console.error` is the established channel for STEP/status output in this codebase, `console.log` reserved for per-item audit detail).

---

### `.claude/commands/invest.md` (config/prompt, event-driven pipeline step)

**Analog A — Step 2a prompt-block insertion (5 identical blocks: lines 190, 235, 280, 325, 370):**

Current exact text (verified, appears 5x identically):
```
注意: picksのtickerは必ず英数字ティッカー形式（例: AAPL, 7203.T）で記入してください。
ニュース・市況から新規の注目銘柄を 1〜3 銘柄に絞って推奨してください。ポートフォリオ保有銘柄の評価は対象外です。
analysis フィールドは必ずエスケープされた JSON 文字列（改行は \n）として出力してください。
```
Insertion: append one new line to all 5 occurrences (D-10):
```
ETF・投資信託・インデックスファンド（例: SPY, QQQ, 1306.T等）は picks に含めないこと。個別企業株のみを推奨してください。
```

**Analog B — Step 2f moderator block (lines 1071-1076):**

Current exact text (verified):
```
## 重要な注意事項
- highlightedStocks には Round 3 でスコアリングされた銘柄（tmp/moderator-tickers.json のリスト）のみを含めること
- ポートフォリオ保有銘柄（MRNA, JOBY, HII, POWL, BRBR, EE, 8522.T, 5885.T, 5576.T, 7711.T, NXT, BWMX）は highlightedStocks に絶対に含めないこと。デイリーミーティングはポートフォリオとは独立した市場分析である
- 注目銘柄は中小型株を優先（NVIDIA、Apple、Microsoft、Google等の大型株は避ける）
- 各銘柄の verdict は必ずスコア計算結果に基づく
- レポート内容は日本語で記述
```
Insertion: new bullet appended to this list (D-11):
```
- ETF・投資信託・インデックスファンドは highlightedStocks に含めないこと（個別企業株のみ）。TS側でも quoteType による除外チェックを行うため、疑わしい銘柄は含めないこと
```

**Analog C — Step 2g pipeline insertion point, modeled on Step 3f's fail-soft STEP-marker block (lines 1916-1938, the closest structural analog for D-07/D-08):**

Full analog block (verified, this is the pattern to mirror exactly):
```markdown
### Step 3f: 緊急度履歴の追記（レポート生成の前に実行 — 当日分を当日レポートに含めるため）

「緊急度履歴を記録中...」とユーザーに表示してください。

以下のBashコマンドを実行してください:

\`\`\`bash
cd /Users/arai/invest && npx tsx src/scripts/write-urgency-history.ts
\`\`\`

スクリプトの終了コードに関わらず、次のステップ（Step 3c: レポート生成）へ進んでください（fail-soft, D-09）。
write-urgency-history.ts は tmp/portfolio-analysis.json（Step 3d の出力）から当日の緊急度スナップショットを
data/urgency-history.json に追記する。generate-report.ts はこの履歴を読んで週次ロールアップを描画するため、
**必ずレポート生成（Step 3c）より前に実行すること**。

終了コードが 0 の場合:
\`\`\`bash
echo '[STEP:urgency-history:OK]'
\`\`\`

終了コードが非0の場合、標準エラー出力の `[urgency-history] FAIL:` 行に続く理由を短く要約して出力してください:
\`\`\`bash
echo '[STEP:urgency-history:FAIL:<短い理由>]'
\`\`\`

**`[PIPELINE:FAIL]` は絶対に出力しないこと** — この失敗は既存3レポート・ニュースダイジェスト・デプロイをブロックしない。
```

Existing Step 2g content this new block precedes (lines 1148-1166, verified):
```markdown
### Step 2g: バリデーション

「meeting-result.json のバリデーションを実行中...」とユーザーに表示してください。

...(pipeline-metrics timestamp bash block)...

\`\`\`bash
cd /Users/arai/invest && npx tsx src/scripts/validate-meeting.ts
\`\`\`
```

Target insertion (new content, placed inside Step 2g, immediately before the `validate-meeting.ts` bash block — RESEARCH.md's Pattern 4 already gives the exact worked-out Japanese prose; use it verbatim, structured identically to the Step 3f analog above):
```markdown
以下のBashコマンドを実行してください:

\`\`\`bash
cd /Users/arai/invest && npx tsx src/scripts/filter-etf-stocks.ts
\`\`\`

終了コードに関わらず、次のバリデーションステップへ進んでください（fail-soft, D-02）。
filter-etf-stocks.ts は tmp/meeting-result.json の highlightedStocks から
yahoo-finance2 の quoteType 照合によりETFを決定論的に除外し、同ファイルを
書き戻す。**必ず validate-meeting.ts より前に実行すること**。

終了コードが 0 の場合:
\`\`\`bash
echo '[STEP:etf-exclusion:OK]'
\`\`\`

終了コードが非0の場合、標準エラー出力の `[filter-etf-stocks] FAIL:` 行に
続く理由を短く要約して出力してください:
\`\`\`bash
echo '[STEP:etf-exclusion:FAIL:<短い理由>]'
\`\`\`

**`[PIPELINE:FAIL]` は絶対に出力しないこと**（D-02）— このステップの失敗は
既存4レポートの生成・デプロイを一切ブロックしない。
```

---

## Shared Patterns

### Pure module + fail-soft CLI wrapper separation
**Source:** `src/portfolio/urgency-history.ts` + `src/scripts/write-urgency-history.ts`
**Apply to:** `src/portfolio/etf-exclusion.ts` + `src/scripts/filter-etf-stocks.ts`
- Pure module: no I/O, no throw, JSDoc citing decision IDs, immutable-spread construction, exported types + functions only.
- CLI wrapper: owns all `readFile`/`writeFile`/network calls, wraps each fallible step in its own try/catch, distinct STEP-marker log lines (`[name] OK: ...` / `[name] FAIL: ...`), `process.exitCode`/`process.exit(1)` on failure but never an uncaught throw, entry-point guard `if (process.argv[1] === fileURLToPath(import.meta.url))`.

### Fail-soft vs. fail-closed separation (D-01/D-02/D-03)
**Source:** `src/scripts/write-urgency-history.ts` lines 37-45 (corrupted-file guard, analogous mechanism-level failure) vs. lines 56-60 (empty-input skip, analogous per-item safe-default)
**Apply to:** `filter-etf-stocks.ts` main()
- Mechanism-level failure (file read fails, batch `quote()` call rejects) -> log `FAIL`, do NOT write, exit non-zero, leave original file untouched (D-02).
- Per-ticker failure (missing from quote response, quoteType not `"EQUITY"`) -> exclude that ticker only, continue processing others, log via D-13 stdout lines (D-01).

### STEP marker + fail-soft pipeline prose convention
**Source:** `.claude/commands/invest.md` Step 3f block (lines 1916-1938)
**Apply to:** New Step 2g insertion block
- Structure: intro user-facing message -> bash block -> "終了コードに関わらず次へ進む" instruction -> conditional `echo '[STEP:name:OK]'` / `echo '[STEP:name:FAIL:<reason>]'` -> explicit "`[PIPELINE:FAIL]` は絶対に出力しないこと" warning with rationale.

### yahoo-finance2 instantiation
**Source:** `src/data/market.ts` line 3
**Apply to:** `filter-etf-stocks.ts`
```typescript
const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });
```
Note: do NOT copy `market.ts` line 64's per-symbol `await yahooFinance.quote(symbol)` call pattern — D-05 requires a single batched `await yahooFinance.quote([...tickers])` array call instead (see RESEARCH.md Pattern 2 for the fully worked-out defensive-parsing implementation).

### Vitest mock convention for yahoo-finance2
**Source:** `src/data/market.test.ts` (`vi.hoisted` + `vi.mock("yahoo-finance2", ...)` convention, cited in RESEARCH.md Code Examples — not re-read here as RESEARCH.md already quotes the exact block verbatim)
**Apply to:** future `src/scripts/filter-etf-stocks.test.ts` (not in this phase's file list per CONTEXT.md, but noted for completeness since D-15/RESEARCH.md test map references it)

## No Analog Found

None — all 4 in-scope files (3 new + 1 modified) have exact-match analogs found in the codebase.

## Reference-Only Files (not modified, read for type/contract context)

| File | Purpose |
|------|---------|
| `src/meeting/schemas.ts` (line 69) | `highlightedStocks: z.array(...)` zod schema — confirms shape, NOT to be modified (D-09) |
| `src/meeting/types.ts` (lines 55-64) | `MeetingResult["highlightedStocks"]` type: `{ ticker, averageScore, verdict, summary, agentScores }` — the exact array-element shape `filterEtfStocks` must accept/return |
| `src/scripts/collect-technicals.ts` | Additional yahoo-finance2 call-pattern reference (not read this session; `market.ts` already gave the canonical instantiation + per-symbol-call pattern to avoid) |
| `src/data/market.ts` (lines 3, 64) | `new YahooFinance({...})` instantiation convention + the per-symbol `.quote(symbol)` call pattern that D-05 explicitly says NOT to replicate (must batch instead) |

## Metadata

**Analog search scope:** `src/portfolio/`, `src/scripts/`, `.claude/commands/invest.md`, `src/meeting/`, `src/data/`
**Files scanned:** 8 (urgency-history.ts, write-urgency-history.ts, urgency-history.test.ts, invest.md, schemas.ts, types.ts, market.ts, market.test.ts referenced not re-read)
**Pattern extraction date:** 2026-07-15
</content>

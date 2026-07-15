# Phase 27: ETF Exclusion - Research

**Researched:** 2026-07-15
**Domain:** Deterministic ETF/equity classification layered on top of an existing multi-agent LLM investment-analysis pipeline (TypeScript + tsx, yahoo-finance2 v3, zod v4, Claude Code subagents)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**安全側方針（lookup失敗時の扱い）— 二段構えのフェイル設計**
- D-01: 銘柄単位の quoteType lookup 失敗は fail-closed（= その銘柄を highlightedStocks から除外）。research PITFALLS Pitfall 1 の明示推奨。ETF混入がウォッチリスト（Phase 28以降）の追跡履歴を汚染すると遡及修正が必要になるため、疑わしきは除外する
- D-02: フィルタ処理全体（スクリプト実行）の失敗は fail-soft（= 元の tmp/meeting-result.json を維持してパイプライン継続）。1つの新機能の障害が既存4レポートの生成・デプロイを止めない（OPS方針踏襲）。throw せず `[STEP:etf-exclusion:FAIL:<理由>]` を出力し、`[PIPELINE:FAIL]` は絶対に出さない
- D-03: 上記の使い分けを明確に区別する: 「個別銘柄の判定不能 → 除外（安全側）」「フィルタ機構そのものの故障 → 未フィルタで継続（可用性側）」。この2つを混同しない

**ETF判定基準**
- D-04: allowlist 方式 — `quoteType === "EQUITY"` のみ通過。ETF / MUTUALFUND / INDEX / CRYPTOCURRENCY 等はすべて除外。日本のETF・REIT・投信（1306.T 等）を列挙不要で網羅でき、fail-closed 思想（D-01）と整合する
- D-05: quoteType の照合は yahoo-finance2 の batch quote()（シンボル配列渡し）1回で実施。highlightedStocks は高々数銘柄であり、per-ticker 逐次呼び出しによるレート制限リスク（research Pitfall 3）を構造的に回避する

**TS側フィルタの統合ポイント**
- D-06: 純関数モジュール `src/portfolio/etf-exclusion.ts` ＋ 薄い fail-soft CLI ラッパー `src/scripts/filter-etf-stocks.ts` の分離構成。`urgency-history.ts` + `write-urgency-history.ts` の実証済みパターンを踏襲（純関数は quote 結果を引数で受け取りネットワーク非依存 → 単体テスト容易）
- D-07: 実行位置は invest.md Step 2g（バリデーション）内、`validate-meeting.ts` 実行の**前**に挿入。tmp/meeting-result.json を読み、ETF除外済みの highlightedStocks で同ファイルを書き戻す（イミュータブルに新オブジェクト構築）。既存の Step 2g バリデーション・サマリー表示は除外後のデータを自然に検証・表示する
- D-08: 専用 STEP マーカー `[STEP:etf-exclusion:OK]` / `[STEP:etf-exclusion:FAIL:<理由>]` を出力（既存 STEP マーカー規約に準拠）
- D-09: meeting-result.json のスキーマ（src/meeting/schemas.ts）は変更しない。highlightedStocks の要素を除去するのみで、フィールド追加は行わない（Phase 28 のウォッチリスト側で必要になればそこで設計）

**プロンプト指示の挿入箇所（第1層）**
- D-10: `.claude/commands/invest.md` の Round 1 5アナリストブロック（Step 2a）の各出力契約部分に、ETF除外指示を追記。既存の「注意: picksのtickerは必ず英数字ティッカー形式…」の並びに「ETF・投資信託・インデックスファンドは picks に含めないこと（個別企業株のみ）」の趣旨を追加。5ブロックすべてに同一文言を適用
- D-11: Step 2f モデレーター最終統合プロンプトの「重要な注意事項」にも同趣旨の除外指示を追加（highlightedStocks 生成点での防御）
- D-12: `src/agents/*.ts` の systemPrompt は変更しない。picks の出力契約が定義されているのは invest.md であり、そこが指示の正準位置。二重管理を避ける

**除外の可視性・監査性**
- D-13: 除外が発生した場合、除外ティッカー・quoteType・理由（ETF判定 / lookup失敗）を CLI の標準出力に記録（例: `ETF除外: SPY (quoteType=ETF)` / `ETF除外: XYZ (quoteType取得失敗, fail-closed)`）。launchdログから事後監査可能
- D-14: 新規の永続ファイル（除外履歴 JSON 等）は作らない。Phase 27 はログ出力で十分。永続的な監査トレイルが必要になるのは Phase 28 のウォッチリスト状態テーブル（removedReason 方式）であり、そちらで担う

**テスト方針**
- D-15: 単体テストは純関数（etf-exclusion.ts）に対して実施: 米国ETF（例: SPY）・日本ETF（例: 1306.T）・米国個別株・日本個別株（7203.T 等）・quoteType 欠損/lookup失敗の各分類を検証（Success Criteria 4）。ネットワークモックは既存テスト規約（プレーン Error でのシミュレート等、write-news-digest.test.ts / urgency-history.test.ts 参照）に合わせる

### Claude's Discretion
- 純関数のシグネチャ・型定義の詳細（WatchlistEntry 等は Phase 28 の管轄。本フェーズは MeetingResult の highlightedStocks 型のみ扱う）
- CLI ラッパーのエラーメッセージ文言・ログフォーマットの詳細
- batch quote() のレスポンスから quoteType を取り出す際の防御的パース実装

### Deferred Ideas (OUT OF SCOPE)
- Step 2b（extract-tickers.ts）段階での早期ETFフィルタ: Round 3 のスコアリング・テクニカル収集の無駄を省ける最適化だが、API呼び出し追加とのトレードオフがあり、Success Criteria が要求する確定後フィルタ（Step 2g）で要件は満たせる。必要になれば将来フェーズで検討
- 除外履歴の永続化（data/ への監査ファイル）: Phase 28 の removedReason 付きウォッチリスト状態テーブルが担うため本フェーズでは実装しない
- ウォッチリスト admission 側の防御的二重フィルタ: Phase 28 の管轄（本フェーズの純関数を再利用）
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ETF-01 | アナリストの推奨銘柄（picks / highlightedStocks）からETFを除外するプロンプト指示が全アナリストエージェントに適用される | Confirmed exact insertion points in invest.md: 5x Round 1 analyst blocks (Step 2a, each ending with "注意: picksのtickerは必ず英数字ティッカー形式…" — see Code Examples), plus Step 2f moderator "重要な注意事項" list. Both locations verified by direct file read below. |
| ETF-02 | meeting-result 確定後、TS側で yahoo-finance2 quote().quoteType 照合により highlightedStocks からETFを決定論的に除外する（米国・日本ETF両対応、lookup失敗時も throw せず安全側に処理） | `quoteType` discriminated union verified directly against installed `yahoo-finance2@3.13.2` type declarations (`QuoteEquity.quoteType: "EQUITY"`, `QuoteEtf.quoteType: "ETF"`, `QuoteMutualfund.quoteType: "MUTUALFUND"`, `QuoteIndex.quoteType: "INDEX"`). Batch-call support and pure-module/fail-soft-CLI-wrapper pattern verified against existing `urgency-history.ts` + `write-urgency-history.ts` pair. |
</phase_requirements>

## Summary

This phase adds a two-layer ETF exclusion defense to an already-shipping daily investment-analysis pipeline. Layer 1 (probabilistic) is a one-line prompt addition repeated identically across 6 existing prompt blocks in `.claude/commands/invest.md` (5 Round-1 analyst blocks + the Step 2f moderator block) — no new files, no schema changes. Layer 2 (deterministic) is a brand-new pure TypeScript module + fail-soft CLI wrapper pair, structurally identical to the already-shipped `src/portfolio/urgency-history.ts` + `src/scripts/write-urgency-history.ts` pattern, inserted into the pipeline immediately before the existing `npx tsx src/scripts/validate-meeting.ts` call in Step 2g.

The technical foundation is unusually solid for this milestone: zero new npm dependencies, and the exact discriminating field (`quoteType`) has already been confirmed by this project's own research phase via live runtime calls against the installed `yahoo-finance2@3.13.2` package for both US tickers (`SPY`→`ETF`, `AAPL`→`EQUITY`) and Japan tickers (`1306.T`→`ETF`, `7203.T`→`EQUITY`). The `.T` suffix carries no fund-vs-equity signal — `quoteType` is the only reliable check, and it works identically across both markets, which directly satisfies Success Criterion 2's explicit requirement.

The one genuinely new pattern in this phase (not yet done anywhere in this codebase) is a true single **batched** `yahoo-finance2.quote(string[])` call. Every existing per-ticker Yahoo Finance call in this repo (`fetchStockQuotes` in `market.ts`, `fetchTechnicalSnapshots` in `technicals.ts`) uses `Promise.all` over N *separate* single-symbol calls, not one array-argument call. D-05 explicitly requires the latter (a single batched invocation), so implementers must not copy the `Promise.all`-of-singles idiom by default — they should call `yahooFinance.quote(tickers)` once with the array, matching the batch verification already done in `.planning/research/STACK.md`.

**Primary recommendation:** Build `src/portfolio/etf-exclusion.ts` as a pure function `filterEtfStocks(highlightedStocks, quoteResults)` (no I/O, no network) that takes the `MeetingResult["highlightedStocks"]` array and a pre-fetched map/array of `quoteType` lookups, and returns the filtered array plus an exclusion log array — mirroring `appendUrgencySnapshot`'s immutable-spread, pure-function shape exactly. Wrap it in `src/scripts/filter-etf-stocks.ts`, which does the single batched `yahooFinance.quote(tickers)` call, handles per-ticker fail-closed and whole-script fail-soft per D-01/D-02, and rewrites `tmp/meeting-result.json` immutably before `validate-meeting.ts` runs.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Prompt-level ETF exclusion instruction (Layer 1) | LLM prompt (invest.md) | — | Probabilistic guidance injected at the exact point picks/highlightedStocks are generated; no code executes this, it's text in the agent instructions |
| Deterministic quoteType classification (Layer 2) | Backend/CLI script (`src/scripts/filter-etf-stocks.ts`) | Pure module (`src/portfolio/etf-exclusion.ts`) | This is a Node.js/tsx CLI script layer (equivalent to "API/Backend" in a web app) — it owns network I/O (yahoo-finance2 call), error handling, and file I/O (tmp/meeting-result.json read/write) |
| ETF/equity classification logic | Pure module (`src/portfolio/etf-exclusion.ts`) | — | Zero I/O, testable in isolation — takes quote results as plain data input, returns filtered array; this is the "business logic" tier, deliberately separated from the CLI wrapper per D-06 |
| Pipeline orchestration / step sequencing | Orchestration layer (`.claude/commands/invest.md` Step 2g) | — | invest.md is the pipeline definition — it decides *when* filter-etf-stocks.ts runs relative to validate-meeting.ts, not the script itself |
| meeting-result.json schema/shape | Data contract (`src/meeting/schemas.ts` / `types.ts`) | — | Explicitly NOT modified this phase (D-09) — the filter only removes array elements, never adds fields |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `yahoo-finance2` | `3.13.2` (already installed, `^3.13.2` in package.json) | `quote()` batch call → `quoteType` field for deterministic ETF/equity classification | Already the exclusive Yahoo Finance client throughout this codebase (`market.ts`, `technicals.ts`, `data.ts`); `quoteType` is a discriminated-union literal directly on the base `Quote` response — no extra API surface needed |
| Node `fs/promises` (built-in) | Node runtime (project uses Node 24.x per `@types/node ^25.3.3`) | Read/rewrite `tmp/meeting-result.json` | Identical to every existing `tmp/*.json` handoff script (`write-urgency-history.ts`, `write-news-digest.ts`) |
| `tsx` | `4.21.0` (installed) | Execution runtime for `src/scripts/filter-etf-stocks.ts` | Unchanged existing convention for all `src/scripts/*.ts` CLI entrypoints |
| `vitest` | `4.0.18` (installed) | Unit tests for `etf-exclusion.ts` pure functions | Existing test runner (`npm test` = `vitest run`); no config changes needed |

**Version verification performed:**
```bash
$ npm ls yahoo-finance2 zod tsx vitest
```
All four packages are already present in `package.json` at the versions above — confirmed by direct read of `/Users/arai/invest/package.json`. **No installation step is required for this phase; zero new dependencies.**

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| — | — | — | None needed. This phase requires no new supporting libraries — `yahoo-finance2` + built-in `fs` cover the entire scope. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `quote().quoteType` | Ticker-string heuristics (`.T` suffix, known-ETF-ticker denylist) | Rejected — `.T` suffix does not distinguish JP equities from JP ETFs/REITs (`1306.T` is an ETF, `7203.T` is an equity, both `.T`). A hand-maintained denylist goes stale and cannot cover novel tickers. `quoteType` is authoritative, free (no extra API call beyond what's already needed), and verified live against both markets. |
| `quote().quoteType` | `quoteSummary()` with `assetProfile`/`fundProfile` modules | Only relevant if deeper fund metadata (expense ratio, holdings) were needed for a future feature — unnecessary extra API surface for a simple boolean-ish gate this phase requires. |
| Single batched `quote(string[])` call | N sequential/parallel single-symbol `quote(symbol)` calls (the `Promise.all` idiom used elsewhere in this repo) | D-05 explicitly locks the single-batch-call approach to avoid the exact rate-limit risk flagged in PITFALLS.md Pitfall 3. Do not default to the `Promise.all`-of-singles pattern seen in `market.ts`/`technicals.ts` — those predate this phase's explicit batching requirement. |

**Installation:**
```bash
# No installation needed — confirm existing versions if desired:
npm ls yahoo-finance2 zod tsx vitest
```

## Package Legitimacy Audit

**Not applicable — this phase installs zero external packages.** All required functionality (`yahoo-finance2@3.13.2`, `zod@4.3.6`, `tsx@4.21.0`, `vitest@4.0.18`) is already present in `package.json` and already in active use elsewhere in this codebase. No `npm install` step exists in this phase's task list; the Package Legitimacy Gate protocol is skipped per its own scope condition ("whenever this phase installs external packages").

**Packages removed due to [SLOP] verdict:** none (no new packages)
**Packages flagged as suspicious [SUS]:** none (no new packages)

## Architecture Patterns

### System Architecture Diagram

```
                                                        Step 2f (existing, unmodified)
tmp/round-1/*.json ─┐                                   Moderator Agent (Claude)
tmp/round-2/*.json ─┼──> Round 1-3 (unmodified) ──────> reads all rounds + moderator-tickers.json
tmp/round-3/*.json ─┘                                    │
                                                          ▼
                                              writes tmp/meeting-result.json
                                              (highlightedStocks may still
                                               contain ETF tickers here —
                                               Layer 1 prompt guidance is
                                               probabilistic, not guaranteed)
                                                          │
                                                          ▼
                              ══════════ NEW: Step 2g pre-validation insert ══════════
                                                          │
                              ┌───────────────────────────┴────────────────────────────┐
                              │  src/scripts/filter-etf-stocks.ts (CLI, fail-soft)      │
                              │                                                          │
                              │  1. read tmp/meeting-result.json                        │
                              │  2. extract tickers from highlightedStocks              │
                              │  3. ONE batched call: yahooFinance.quote(tickers)  ──────┼──> Yahoo Finance API
                              │  4. map ticker -> quoteType (or lookup failure)         │
                              │  5. call PURE filterEtfStocks(highlightedStocks, map)   │
                              │  6. rewrite tmp/meeting-result.json (new object,        │
                              │     highlightedStocks only — no schema change)          │
                              │  7. log exclusions to stdout (D-13)                     │
                              │  8. emit [STEP:etf-exclusion:OK|FAIL:<reason>]           │
                              │     — NEVER [PIPELINE:FAIL] (D-02)                       │
                              └───────────────────────────┬────────────────────────────┘
                                                          │
                                    ┌─────────────────────┴─────────────────────┐
                                    │  src/portfolio/etf-exclusion.ts (PURE)      │
                                    │  filterEtfStocks(stocks, quoteTypeByTicker) │
                                    │   - allowlist: only "EQUITY" passes (D-04)  │
                                    │   - lookup failure => exclude (D-01)        │
                                    │   - immutable: returns NEW array            │
                                    │   - no I/O, no throw, unit-testable         │
                                    └─────────────────────────────────────────────┘
                                                          │
                                                          ▼
                              tmp/meeting-result.json (ETF-free highlightedStocks)
                                                          │
                                                          ▼
                              Step 2g (existing, unmodified): npx tsx validate-meeting.ts
                                                          │
                                                          ▼
                              Step 3+ report generation / prev-highlighted-stocks
                              injection / Phase 28 watchlist admission (future)
                              — all consume already-ETF-free data, no further
                              filtering needed downstream this phase
```

### Recommended Project Structure
```
src/
├── portfolio/
│   └── etf-exclusion.ts        # NEW — pure module: quoteType classification + filter logic
│   └── etf-exclusion.test.ts   # NEW — unit tests (D-15)
├── scripts/
│   └── filter-etf-stocks.ts    # NEW — fail-soft CLI wrapper (network + file I/O)
│   └── filter-etf-stocks.test.ts # NEW — CLI wrapper tests (mock yahoo-finance2 + fs/promises)
.claude/
└── commands/
    └── invest.md                # MODIFIED — Step 2a (5 blocks) + Step 2f + Step 2g (new insert)
```

### Pattern 1: Pure classification function + fail-soft CLI wrapper split
**What:** A pure function module with zero I/O (`etf-exclusion.ts`) that accepts already-fetched data and returns a transformed result, paired with a thin CLI script (`filter-etf-stocks.ts`) that owns all network calls, file reads/writes, and error-boundary logic.
**When to use:** Any time TS-side deterministic logic needs to run against LLM-produced JSON in this pipeline — this is the established convention (`urgency-history.ts`/`write-urgency-history.ts`).
**Example:**
```typescript
// Source: src/portfolio/urgency-history.ts (existing, shipped pattern to mirror)
export function appendUrgencySnapshot(
  history: UrgencyHistoryFile,
  dateKey: string,
  snapshots: ReadonlyArray<HoldingUrgencySnapshot>,
): UrgencyHistoryFile {
  return { ...history, [dateKey]: snapshots };
}
```
Applying this shape to Phase 27:
```typescript
// src/portfolio/etf-exclusion.ts (new, to be written this phase)
export type QuoteTypeLookup =
  | { readonly status: "ok"; readonly quoteType: string }
  | { readonly status: "failed" };

export interface EtfExclusionResult {
  readonly kept: ReadonlyArray<MeetingResult["highlightedStocks"][number]>;
  readonly excluded: ReadonlyArray<{
    readonly ticker: string;
    readonly reason: "etf" | "lookup-failed";
    readonly quoteType?: string;
  }>;
}

const ALLOWED_QUOTE_TYPE = "EQUITY";

export function filterEtfStocks(
  stocks: MeetingResult["highlightedStocks"],
  quoteTypeByTicker: ReadonlyMap<string, QuoteTypeLookup>,
): EtfExclusionResult {
  const kept: Array<MeetingResult["highlightedStocks"][number]> = [];
  const excluded: Array<{ ticker: string; reason: "etf" | "lookup-failed"; quoteType?: string }> = [];

  for (const stock of stocks) {
    const lookup = quoteTypeByTicker.get(stock.ticker);
    if (!lookup || lookup.status === "failed") {
      // D-01: fail-closed — 疑わしきは除外
      excluded.push({ ticker: stock.ticker, reason: "lookup-failed" });
      continue;
    }
    if (lookup.quoteType !== ALLOWED_QUOTE_TYPE) {
      // D-04: allowlist — EQUITY以外はすべて除外
      excluded.push({ ticker: stock.ticker, reason: "etf", quoteType: lookup.quoteType });
      continue;
    }
    kept.push(stock);
  }

  return { kept, excluded };
}
```

### Pattern 2: Single batched `quote()` call (D-05) — the one genuinely new pattern this phase introduces
**What:** Call `yahooFinance.quote(tickers)` ONCE with an array of symbols, not `Promise.all(tickers.map(t => yahooFinance.quote(t)))`.
**When to use:** Any time multiple tickers need the same field from Yahoo Finance in a single pipeline run — this phase is the first to require true batching in this codebase; existing code (`market.ts`'s `fetchStockQuotes`, `technicals.ts`'s `fetchTechnicalSnapshots`) uses per-symbol `Promise.all`, which does NOT satisfy D-05's explicit single-call requirement.
**Example:**
```typescript
// Source: verified live against installed yahoo-finance2@3.13.2, per .planning/research/STACK.md
// yf.quote(["SPY","AAPL","1306.T"]) returns an array of Quote, each retaining its own quoteType
import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

async function fetchQuoteTypes(
  tickers: ReadonlyArray<string>,
): Promise<ReadonlyMap<string, QuoteTypeLookup>> {
  const result = new Map<string, QuoteTypeLookup>();
  if (tickers.length === 0) return result;
  try {
    const quotes = await yahooFinance.quote([...tickers]); // single batched call
    const quoteArray = Array.isArray(quotes) ? quotes : [quotes];
    for (const q of quoteArray) {
      const symbol = (q as { symbol?: string }).symbol;
      const quoteType = (q as { quoteType?: string }).quoteType;
      if (symbol && quoteType) {
        result.set(symbol, { status: "ok", quoteType });
      }
    }
    // Any ticker requested but absent from the response is an implicit lookup failure —
    // caller must treat missing map entries as "failed" (handled by filterEtfStocks above).
  } catch {
    // Whole-batch failure: every ticker in this batch becomes a lookup failure.
    // Per-ticker fail-closed (D-01) still applies naturally since none get "ok" entries.
  }
  return result;
}
```
**Important type-signature note:** `yahooFinance.quote()`'s TypeScript overload returns a single `Quote` for a string argument and `Quote[]` for an array argument (per `node_modules/yahoo-finance2/esm/src/modules/quote.d.ts`). When called with an array, always narrow/assert to array shape defensively — do not assume the return type without a runtime `Array.isArray` check, since a single-element array input's typed overload resolution can be brittle across yahoo-finance2 minor versions.

### Pattern 3: invest.md prompt-block insertion (Layer 1, D-10/D-11)
**What:** Append one line to the existing "注意:" block that already exists in all 5 Round-1 analyst prompts, and one line to Step 2f's existing "重要な注意事項" bullet list.
**When to use:** This exact insertion point — do not create new prompt sections; extend existing ones to minimize prompt-contract churn.
**Example (verified exact current text to extend, from direct read of `.claude/commands/invest.md` lines 190-192, repeated near-identically at lines 235-237, 280-282, 325-327, 370-372):**
```
注意: picksのtickerは必ず英数字ティッカー形式（例: AAPL, 7203.T）で記入してください。
ニュース・市況から新規の注目銘柄を 1〜3 銘柄に絞って推奨してください。ポートフォリオ保有銘柄の評価は対象外です。
analysis フィールドは必ずエスケープされた JSON 文字列（改行は \n）として出力してください。
```
Recommended addition (append as a new line in this same block, all 5 analyst prompts):
```
ETF・投資信託・インデックスファンド（例: SPY, QQQ, 1306.T等）は picks に含めないこと。個別企業株のみを推奨してください。
```
**Step 2f moderator block** — verified exact current "重要な注意事項" list (lines 1071-1076):
```
## 重要な注意事項
- highlightedStocks には Round 3 でスコアリングされた銘柄（tmp/moderator-tickers.json のリスト）のみを含めること
- ポートフォリオ保有銘柄（MRNA, JOBY, HII, POWL, BRBR, EE, 8522.T, 5885.T, 5576.T, 7711.T, NXT, BWMX）は highlightedStocks に絶対に含めないこと。デイリーミーティングはポートフォリオとは独立した市場分析である
- 注目銘柄は中小型株を優先（NVIDIA、Apple、Microsoft、Google等の大型株は避ける）
- 各銘柄の verdict は必ずスコア計算結果に基づく
- レポート内容は日本語で記述
```
Recommended addition (new bullet in this same list):
```
- ETF・投資信託・インデックスファンドは highlightedStocks に含めないこと（個別企業株のみ）。TS側でも quoteType による除外チェックを行うため、疑わしい銘柄は含めないこと
```

### Pattern 4: Step 2g pipeline insertion point (D-07/D-08)
**What:** Insert the new script call and STEP marker logic immediately before the existing `validate-meeting.ts` invocation, mirroring the exact fail-soft STEP-marker prose style already used for Step 3f (`urgency-history`).
**Verified exact current Step 2g content** (from direct read, lines 1148-1166):
```markdown
### Step 2g: バリデーション

「meeting-result.json のバリデーションを実行中...」とユーザーに表示してください。
...
\`\`\`bash
cd /Users/arai/invest && npx tsx src/scripts/validate-meeting.ts
\`\`\`
```
**Recommended insertion (new subsection or new paragraph before the existing validate-meeting.ts bash block), modeled directly on the Step 3f prose style** (verified lines 1916-1938 above):
```markdown
以下のBashコマンドを実行してください:

\`\`\`bash
cd /Users/arai/invest && npx tsx src/scripts/filter-etf-stocks.ts
\`\`\`

終了コードに関わらず、次のバリデーションステップへ進んでください（fail-soft, D-02）。
filter-etf-stocks.ts は tmp/meeting-result.json の highlightedStocks から
yahoo-finance2 の quoteType 照合によりETFを決定論的に除外し、同ファイルを
書き戻す。**必ず validate-meeting.ts より前に実行すること**（除外後のデータを
以降のバリデーション・サマリー表示・レポート生成が自然に参照するため）。

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
既存4レポートの生成・デプロイを一切ブロックしない。フィルタが失敗した場合、
元の tmp/meeting-result.json（未フィルタ）のまま次のステップへ進む。
```
Then the existing `validate-meeting.ts` bash block continues unchanged immediately after.

### Anti-Patterns to Avoid
- **Fail-open on lookup failure:** Defaulting an unrecognized/missing `quoteType` to "include" defeats the entire feature invisibly (explicit warning in both STACK.md and PITFALLS.md Pitfall 1). Always fail-closed per D-01.
- **Per-ticker sequential/`Promise.all` quote() calls:** Satisfies neither D-05's letter nor its rate-limit-avoidance intent. Use one array-argument `quote()` call.
- **Modifying `src/agents/*.ts` systemPrompts:** D-12 explicitly locks prompt changes to `invest.md` only — the systemPrompt files are not the canonical location for the `picks` output contract.
- **Adding new fields to `meeting-result.json` schema:** D-09 explicitly forbids this. The filter must only remove array elements from `highlightedStocks`, never add annotation fields (e.g., no `excludedReason` field on kept/removed stocks this phase — that's Phase 28's `removedReason` watchlist design).
- **Conflating whole-script failure with per-ticker failure:** D-03 requires these to be handled with opposite policies (per-ticker → exclude; whole-script → don't filter at all, keep original file). A single try/catch that swallows both into the same "exclude everything" behavior would violate D-02 (fail-soft for the whole mechanism failing must preserve the ORIGINAL data, not an empty/broken one).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| ETF vs. equity classification | Ticker-suffix heuristics, hand-maintained ETF ticker denylist | `yahoo-finance2` `quote().quoteType` | Authoritative, free (same API call pattern already used for price data elsewhere), verified live against both US and JP tickers including the edge case `1306.T` (JP ETF with equity-looking `.T` suffix) |
| Batch quote fetching | Custom concurrency-limiting/queueing wrapper around N single calls | Native `yahooFinance.quote(string[])` array-argument call | The library already supports multi-symbol batching natively — verified in STACK.md; no need to reinvent request batching |
| JSON handoff read/write with corruption/missing-file handling | New generic "safe JSON file" utility | Mirror `write-urgency-history.ts`'s `loadExistingHistory`-style try/catch with ENOENT detection (both `.code === "ENOENT"` AND `error.message.includes("ENOENT")`, per the existing test-mock convention) | This project has already hit and fixed this exact bug class (see Phase 25 Plan 02 decision log in STATE.md); reusing the fixed pattern avoids reintroducing it |

**Key insight:** Every piece of infrastructure this phase needs (classification field, batching API, file I/O pattern, fail-soft/fail-closed split, STEP marker format) already exists either in the installed `yahoo-finance2` package or in this project's own shipped code. This phase's job is assembly and correct wiring, not invention.

## Common Pitfalls

### Pitfall 1: Prompt-only ETF exclusion without TS-side deterministic verification
**What goes wrong:** LLMs still surface ETFs (especially thematic/sector ETFs) despite prompt instructions saying not to, because prompt instructions are probabilistic, not structural.
**Why it happens:** LLMs reason over "attractive investment opportunities" topically and will surface a diversified vehicle when it fits a narrative (e.g., a sector-rotation call suggesting `XLK`).
**How to avoid:** Layer 2 (TS `quoteType` check) must be the authoritative gate; Layer 1 (prompt) is best-effort only. Never treat Layer 1 alone as sufficient for Success Criterion 1.
**Warning signs:** Any ETF ticker appearing in `docs/` Daily Report highlight cards despite the prompt instruction being present; `quoteType` lookup failing/timing out silently and defaulting to "allow."

### Pitfall 2: Treating `.T` suffix as a fund-vs-equity signal
**What goes wrong:** Code that special-cases "if ticker ends in `.T`, treat differently" for ETF detection will misclassify `1306.T` (an ETF) the same way it treats `7203.T` (an equity), since both carry the same suffix.
**Why it happens:** `.T` indicates *exchange/locale* (Tokyo Stock Exchange), not *security type*. These are orthogonal facts about a ticker.
**How to avoid:** Only use `quoteType` for the fund-vs-equity decision. `.T` suffix handling (if any exists elsewhere in the codebase for other purposes) must never be conflated with this check.
**Warning signs:** A JP ETF ticker like `1306.T` passing through the filter because it "looks like" a normal JP equity ticker.

### Pitfall 3: Confusing "lookup failed" with "not an EQUITY"
**What goes wrong:** If the implementation doesn't distinguish "we got a response and quoteType was ETF/MUTUALFUND/INDEX" from "we got no response / an error / an undefined quoteType field," the D-13 audit log requirement (distinguishing "ETF判定" from "lookup失敗") cannot be satisfied, and D-01's fail-closed policy becomes unauditable.
**Why it happens:** A naive `quoteType !== "EQUITY"` check on a `try/catch`-wrapped call that returns `undefined` on error conflates both cases into the same boolean, losing the distinction the decisions require.
**How to avoid:** Model the lookup result as an explicit discriminated type (see Pattern 1's `QuoteTypeLookup`) with distinct `"ok"` / `"failed"` states, so downstream logging and filtering logic can cite the correct reason.
**Warning signs:** Exclusion log output that can't distinguish "SPY excluded because quoteType=ETF" from "XYZ excluded because lookup failed" — this is a testable requirement per D-13's example format.

### Pitfall 4: Whole-script failure wiping out the original meeting-result.json
**What goes wrong:** If the CLI wrapper reads `tmp/meeting-result.json`, then the network call throws before the write step, and the code has already started constructing a new (empty or partial) object to write — a bug could overwrite the original file with garbage even though D-02 requires preserving it untouched.
**Why it happens:** Fail-soft is easy to get wrong directionally — the instinct is "catch everything, write what you have," but D-02 specifically requires "keep original file if the whole mechanism fails," not "write a best-effort partial result."
**How to avoid:** Structure the script so the write step only happens after successful in-memory computation of the new `highlightedStocks` array. On any error (parse failure, network failure, unexpected shape), skip the write entirely — the original `tmp/meeting-result.json` remains on disk untouched, satisfying D-02's "元の tmp/meeting-result.json を維持" requirement literally.
**Warning signs:** A test that simulates network failure and then asserts `writeFile` was never called (or was called with the original unchanged data) — this is a direct, testable assertion for the fail-soft path.

## Code Examples

### CLI wrapper skeleton (fail-soft outer shell, mirrors `write-urgency-history.ts`)
```typescript
// Source: modeled on src/scripts/write-urgency-history.ts (existing, shipped pattern)
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import YahooFinance from "yahoo-finance2";
import { filterEtfStocks } from "../portfolio/etf-exclusion.js";
import type { MeetingResult } from "../meeting/types.js";

const TMP_DIR = join(import.meta.dirname, "../../tmp");
const MEETING_RESULT_PATH = join(TMP_DIR, "meeting-result.json");

export async function main(): Promise<void> {
  let meetingResult: MeetingResult;
  try {
    const raw = await readFile(MEETING_RESULT_PATH, "utf-8");
    meetingResult = JSON.parse(raw) as MeetingResult;
  } catch (error) {
    // D-02: 読み込み自体が失敗 = メカニズム全体の故障。ファイルには一切触れず終了。
    console.error("[filter-etf-stocks] FAIL: tmp/meeting-result.json の読み込みに失敗しました。フィルタをスキップします。", error);
    process.exitCode = 1;
    return;
  }

  const tickers = meetingResult.highlightedStocks.map((s) => s.ticker);
  if (tickers.length === 0) {
    console.error("[filter-etf-stocks] OK (skip: highlightedStocks 0件)");
    return;
  }

  let quoteTypeByTicker: ReadonlyMap<string, { status: "ok"; quoteType: string } | { status: "failed" }>;
  try {
    quoteTypeByTicker = await fetchQuoteTypes(tickers); // see Pattern 2 above
  } catch (error) {
    // D-02: バッチ呼び出し自体の例外 = メカニズム故障。元ファイルを維持して終了。
    console.error("[filter-etf-stocks] FAIL: quoteType一括取得に失敗しました。フィルタをスキップします。", error);
    process.exitCode = 1;
    return;
  }

  const { kept, excluded } = filterEtfStocks(meetingResult.highlightedStocks, quoteTypeByTicker);

  for (const item of excluded) {
    // D-13: 除外理由を可視化
    if (item.reason === "etf") {
      console.log(`ETF除外: ${item.ticker} (quoteType=${item.quoteType})`);
    } else {
      console.log(`ETF除外: ${item.ticker} (quoteType取得失敗, fail-closed)`);
    }
  }

  const updated: MeetingResult = { ...meetingResult, highlightedStocks: kept };
  await writeFile(MEETING_RESULT_PATH, JSON.stringify(updated, null, 2), "utf-8");
  console.error(`[filter-etf-stocks] OK: ${excluded.length}件除外, ${kept.length}件残存`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
```

### Test mock convention for yahoo-finance2 batch calls
```typescript
// Source: modeled on src/data/market.test.ts (existing, shipped pattern) — vi.hoisted + vi.mock
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { quoteMock } = vi.hoisted(() => ({ quoteMock: vi.fn() }));

vi.mock("yahoo-finance2", () => ({
  default: vi.fn().mockImplementation(function YahooFinanceMock() {
    return { quote: quoteMock };
  }),
}));

describe("filter-etf-stocks main()", () => {
  beforeEach(() => quoteMock.mockReset());
  afterEach(() => vi.restoreAllMocks());

  it("ETF(SPY)とlookup失敗銘柄をfail-closedで除外し、EQUITYのみ残す", async () => {
    quoteMock.mockResolvedValue([
      { symbol: "AAPL", quoteType: "EQUITY" },
      { symbol: "SPY", quoteType: "ETF" },
      // XYZ intentionally absent from the response => lookup failure
    ]);
    // ... assert filterEtfStocks-driven output keeps only AAPL
  });

  it("quote()がrejectした場合、元のtmp/meeting-result.jsonをwriteFileしない（D-02）", async () => {
    quoteMock.mockRejectedValue(new Error("Yahoo Finance API error"));
    // ... assert writeFile was never called with a modified payload
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| No ETF classification anywhere in this codebase | `quoteType`-based deterministic filter, this phase's first use of the field | This phase (v2.7 Phase 27) | Establishes a reusable pure function (`etf-exclusion.ts`) that Phase 28's watchlist admission will import and reuse directly, per CONTEXT.md's "Specific Ideas" note |

**Deprecated/outdated:** None — this is a net-new capability, not a replacement of an existing mechanism.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `yahooFinance.quote(tickers)` called with an array argument returns `Quote[]` (not a single `Quote`) at runtime for all array lengths including length-1 arrays | Code Examples / Pattern 2 | If a length-1 array unexpectedly returns a bare object instead of a 1-element array (a known brittleness area in some JS API overload designs), the `Array.isArray` defensive check in the recommended snippet already guards against this — but implementers should still write an explicit unit test for the single-highlighted-stock case (kept as `[CITED]` from STACK.md's live verification, which used multi-element batches; single-element batch behavior was not separately re-verified this session) |
| A2 | The exact current text of the 5 Round-1 analyst prompt blocks and the Step 2f moderator block (quoted verbatim in Pattern 3) will not have changed between this research session and plan/execution — verified by direct `Read` of `.claude/commands/invest.md` in this session (line numbers cited), so this is `[VERIFIED: direct file read]`, not assumed | Architecture Patterns / Pattern 3 | Low risk — if invest.md changes before execution, the planner should re-verify line numbers before inserting, but the insertion *shape* (append to the existing "注意:" block / "重要な注意事項" list) will remain valid regardless of exact line numbers |

**If this table is empty:** N/A — see A1/A2 above; both are low-risk, narrowly-scoped assumptions with concrete mitigation already noted.

## Open Questions (RESOLVED)

1. **Should the exclusion log distinguish MUTUALFUND/INDEX from ETF in the D-13 stdout message, or bucket them all as "ETF除外"?**
   - What we know: D-04 allowlists only `EQUITY`; ETF/MUTUALFUND/INDEX/CRYPTOCURRENCY etc. are all excluded identically.
   - What's unclear: D-13's example format shows `ETF除外: SPY (quoteType=ETF)` — it's ambiguous whether a `MUTUALFUND`-classified ticker should log as `ETF除外: XYZ (quoteType=MUTUALFUND)` (reusing the "ETF除外" label for all non-equity types) or use a more generic label.
   - Recommendation: Reuse the `quoteType` value verbatim in the log message (as the example format already does), keeping the outer label "ETF除外" as a catch-all for "excluded because not classified as an individual equity" — this requires no further design decision and is consistent with D-04's allowlist framing ("ETF / MUTUALFUND / INDEX / CRYPTOCURRENCY 等はすべて除外" are all lumped under the same D-13 exclusion example format).

2. **Exact quoteType values beyond the four enumerated in D-04 (ETF, MUTUALFUND, INDEX, CRYPTOCURRENCY) — is the allowlist logic `quoteType === "EQUITY"` (allowlist) or a denylist of the 4 named types?**
   - What we know: D-04 explicitly states "allowlist 方式 — quoteType === 'EQUITY' のみ通過" — this is unambiguous: allowlist, not denylist.
   - What's unclear: Nothing — this is fully locked. Listed here only to flag for the planner that the implementation must NOT accidentally invert this into a denylist of named non-equity types (which would silently admit any of the other 7 quoteType variants confirmed in Stack Research: CURRENCY, ECNQUOTE, FUTURE, OPTION, MONEYMARKET, ALTSYMBOL, and any future Yahoo-added type).
   - Recommendation: Implement strictly as `quoteType !== "EQUITY"` → exclude (allowlist), never as a hardcoded denylist array — this is both simpler code and correctly fail-closed against unknown future `quoteType` values, consistent with D-01.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `yahoo-finance2` | ETF-02 (quoteType lookup) | ✓ | 3.13.2 (installed, confirmed via package.json) | — |
| `zod` | Not directly needed this phase (no schema changes, D-09) | ✓ | 4.3.6 (installed) | — |
| `tsx` | Running `filter-etf-stocks.ts` | ✓ | 4.21.0 (installed) | — |
| `vitest` | Unit tests (D-15) | ✓ | 4.0.18 (installed) | — |
| Network access to Yahoo Finance API | `quote()` batch call at pipeline runtime | Not verifiable statically this session — assumed available per existing pipeline's daily production use of the same client (`market.ts`, `technicals.ts` already depend on live Yahoo Finance access) | — | Fail-soft (D-02): if network unavailable at runtime, whole-script failure preserves original `tmp/meeting-result.json` and pipeline continues unfiltered |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** Yahoo Finance network access — already has a documented, locked fallback behavior (D-02 fail-soft).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.0.18 |
| Config file | none detected as a separate file — `vitest run` invoked directly via `npm test` (package.json `scripts.test`); no `vitest.config.ts` found, defaults are used |
| Quick run command | `npx vitest run src/portfolio/etf-exclusion.test.ts src/scripts/filter-etf-stocks.test.ts` |
| Full suite command | `npm test` (= `vitest run`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ETF-01 | Prompt instruction text present in all 5 Round-1 blocks + Step 2f block | manual/static review (invest.md is not executable TS, no automated test possible) | `grep -c "ETF・投資信託・インデックスファンド" .claude/commands/invest.md` (expect 6: 5 analyst blocks + 1 moderator block) | ❌ Wave 0 (no test file — this is a grep-based manual verification step, documented here for the planner) |
| ETF-02 (US ETF exclusion) | `filterEtfStocks` excludes a ticker with `quoteType: "ETF"` (e.g. SPY) | unit | `npx vitest run src/portfolio/etf-exclusion.test.ts -t "ETF"` | ❌ Wave 0 |
| ETF-02 (JP ETF exclusion) | `filterEtfStocks` excludes a `.T`-suffixed ticker with `quoteType: "ETF"` (e.g. 1306.T), proving suffix is NOT used as the signal | unit | `npx vitest run src/portfolio/etf-exclusion.test.ts -t "1306"` | ❌ Wave 0 |
| ETF-02 (equity pass-through) | `filterEtfStocks` keeps tickers with `quoteType: "EQUITY"` for both US (AAPL) and JP (7203.T) | unit | `npx vitest run src/portfolio/etf-exclusion.test.ts -t "EQUITY"` | ❌ Wave 0 |
| ETF-02 (lookup failure fail-closed) | `filterEtfStocks` excludes a ticker with no entry / failed lookup in the quoteType map | unit | `npx vitest run src/portfolio/etf-exclusion.test.ts -t "lookup"` | ❌ Wave 0 |
| ETF-02 (whole-script fail-soft) | `filter-etf-stocks.ts` main() does not call `writeFile` (or preserves original content) when the batch `quote()` call rejects | unit (mocked yahoo-finance2 + fs/promises) | `npx vitest run src/scripts/filter-etf-stocks.test.ts -t "fail-soft"` | ❌ Wave 0 |
| Success Criterion 3 (no throw on lookup failure) | Pipeline continues (`process.exitCode`, not `process.exit(1)` uncaught throw) when individual ticker lookups fail but the batch call itself succeeds | unit | `npx vitest run src/scripts/filter-etf-stocks.test.ts -t "partial"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/portfolio/etf-exclusion.test.ts src/scripts/filter-etf-stocks.test.ts`
- **Per wave merge:** `npm test` (full suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/portfolio/etf-exclusion.test.ts` — covers ETF-02 classification logic (US ETF, JP ETF, US equity, JP equity, lookup-failure cases per D-15)
- [ ] `src/scripts/filter-etf-stocks.test.ts` — covers ETF-02 CLI wrapper fail-soft/fail-closed split (D-01/D-02/D-03), STEP marker emission (D-08), exclusion logging format (D-13)
- [ ] Framework install: none — vitest already configured and running (`npm test`)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No | This is a local batch pipeline script with no user-facing auth surface |
| V3 Session Management | No | Not applicable — no sessions involved |
| V4 Access Control | No | Not applicable — single-operator local pipeline |
| V5 Input Validation | Yes | `tmp/meeting-result.json` is a self-generated pipeline artifact (already validated by `validate-meeting.ts`'s zod schema downstream) — this phase's script reads it with `JSON.parse` inside a try/catch (matching existing `write-urgency-history.ts` convention of not re-validating self-generated artifacts with zod), and treats any parse/shape failure as whole-mechanism fail-soft (D-02), never crashing the pipeline |
| V6 Cryptography | No | No cryptographic operations in this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Malformed/adversarial ticker string used as a prototype-pollution vector when used as an object key (e.g., `"__proto__"` as a ticker) | Tampering | Follow the existing `isValidDateKey`-style defensive pattern: if building any `Record<string, ...>` keyed by ticker, prefer a `Map` (which this research's recommended `QuoteTypeLookup` type already uses) over a plain object literal, since `Map` keys cannot trigger prototype pollution the way `obj[key] = ...` can. The `urgency-history.ts` precedent guards this for date keys via regex; tickers here should use `Map` structurally rather than needing a similar regex guard. |
| Unbounded/untrusted ticker list causing excessive API calls | Denial of Service (self-inflicted, not attacker-driven) | Not a realistic external threat in this single-operator local pipeline — `highlightedStocks` size is bounded by the existing Round 3 scoring process (a handful of tickers per day), and D-05's single-batch-call design inherently caps the request count to 1 per run regardless of ticker count |

---

## Sources

### Primary (HIGH confidence)
- Direct inspection of `/Users/arai/invest/package.json` — confirmed exact installed versions of `yahoo-finance2`, `zod`, `tsx`, `vitest`
- Direct inspection of `/Users/arai/invest/node_modules/yahoo-finance2/esm/src/modules/quote.d.ts` — confirmed `quoteType` discriminated union literal values (`EQUITY`, `ETF`, `MUTUALFUND`, `INDEX`, `CRYPTOCURRENCY`, `CURRENCY`, `ECNQUOTE`, `FUTURE`, `OPTION`, `MONEYMARKET`, `ALTSYMBOL`)
- Direct inspection of `/Users/arai/invest/src/portfolio/urgency-history.ts`, `urgency-history.test.ts`, `/Users/arai/invest/src/scripts/write-urgency-history.ts` — confirmed pure-module/fail-soft-CLI-wrapper pattern, immutable-spread convention, ENOENT dual-check convention
- Direct inspection of `/Users/arai/invest/src/data/market.ts`, `market.test.ts`, `/Users/arai/invest/src/data/technicals.ts` — confirmed `new YahooFinance({...})` instantiation convention, existing (non-batched) per-symbol call pattern, and the `vi.hoisted` + `vi.mock("yahoo-finance2", ...)` test mock convention
- Direct inspection of `/Users/arai/invest/.claude/commands/invest.md` (Step 2a lines 128-387, Step 2f lines 985-1144, Step 2g lines 1148-1180+, Step 3f lines 1916-1938) — confirmed exact current prompt text, insertion points, and STEP-marker prose conventions to mirror
- Direct inspection of `/Users/arai/invest/src/meeting/schemas.ts`, `types.ts` — confirmed `MeetingResult["highlightedStocks"]` shape and that no schema modification is needed (D-09)
- Direct inspection of `/Users/arai/invest/src/scripts/validate-meeting.ts`, `write-news-digest.test.ts` — confirmed the exact fs/promises mock convention (plain `Error("ENOENT")`, not `.code`-bearing errors) and the insertion-point-adjacent script this phase's new script must precede
- `.planning/research/STACK.md`, `PITFALLS.md`, `SUMMARY.md` (v2.7 milestone research, 2026-07-15) — live-verified `quoteType` values against both US and JP tickers including `1306.T`, confirmed batch-call support

### Secondary (MEDIUM confidence)
- None required this session — all findings for this narrowly-scoped phase were directly verifiable against the installed package and the existing codebase; no external web research was needed beyond what the upstream v2.7 milestone research already performed and this session re-verified against actual files.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies, all versions confirmed directly from package.json, `quoteType` field confirmed directly from installed package type declarations
- Architecture: HIGH — every integration point (5 analyst prompt blocks, moderator block, Step 2g insertion point) verified by direct file read with exact line numbers cited
- Pitfalls: HIGH — grounded in upstream v2.7 milestone PITFALLS.md research (itself MEDIUM-HIGH) plus this session's direct codebase verification of the exact patterns to avoid (e.g., confirming existing code uses per-symbol `Promise.all`, not batching, which is the trap D-05 is designed to avoid)

**Research date:** 2026-07-15
**Valid until:** 30 days (stable internal codebase extension; yahoo-finance2 API surface for `quoteType` is a stable, long-standing field unlikely to change on this timescale)

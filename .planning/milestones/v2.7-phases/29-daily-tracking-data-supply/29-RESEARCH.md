# Phase 29: Daily Tracking Data Supply - Research

**Researched:** 2026-07-15
**Domain:** TypeScript batch data-collection extension of an existing daily investment pipeline — per-ticker technical indicator fetch (Yahoo Finance) + deterministic news matching against an existing article pool, fail-soft at per-ticker granularity
**Confidence:** HIGH

## Summary

Phase 29 is a pure extension phase: every technical building block it needs already exists in the codebase and is explicitly locked by CONTEXT.md's 21 decisions (D-01〜D-21). There is no new library, no new architecture pattern, and no ambiguity about shape — `TechnicalSnapshot`, `buildHoldingNewsMap`, `getActiveWatchlistEntries`, and the fail-soft CLI + `[STEP:*]` marker convention are all shipped, tested code from Phase 27/28. The work is glue: (1) a new pure module mapping `WatchlistEntry[]` → `PortfolioHolding[]` shape so `buildHoldingNewsMap` can be reused verbatim (Pattern 4, already proven), (2) a new chunking helper around the existing single-ticker `fetchTechnicalSnapshot` (not yet exported — must add) to bound concurrency without touching `fetchTechnicalSnapshots`, and (3) a same-day cache read from `tmp/technicals.json` before hitting the network at all.

The single most important verified fact for planning: `fetchTechnicalSnapshot` (singular, per-ticker) exists in `src/data/technicals.ts` but is **not currently exported to any script** — only `fetchTechnicalSnapshots` (plural, `Promise.all`-parallel) is consumed by `collect-technicals.ts`. Since `technicals.ts` is off-limits for behavioral changes (D-08), the only safe move is adding `fetchTechnicalSnapshot` to the export surface (additive, zero risk to existing behavior) and building the new chunking/staggering logic in the new CLI or a new pure module that calls it directly. This matches D-09's explicit discretion grant.

**Primary recommendation:** Build one new pure module (`src/portfolio/watchlist-data.ts` or similar — naming is Claude's discretion) holding the shape-mapping, chunking, and cache-merge pure functions, and one new fail-soft CLI (`src/scripts/collect-watchlist-data.ts`) that does all I/O, chunked network calls, and STEP-marker emission — mirroring the `urgency-history.ts`/`write-urgency-history.ts` and `watchlist.ts`/`write-watchlist.ts` split exactly. Insert as invest.md Step 2i, immediately after Step 2h.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Active watchlist ticker derivation | Backend (TS pure module) | — | `getActiveWatchlistEntries` already reads `data/watchlist.json`; no new tier |
| Technical indicator fetch (Yahoo Finance) | Backend (TS CLI, external API) | — | Network I/O confined to the new CLI wrapper, mirrors `collect-technicals.ts` |
| Same-day technicals cache reuse | Backend (TS pure module) | — | Pure read/merge against `tmp/technicals.json`; no network |
| News matching (ticker/name against pool) | Backend (TS pure module, no I/O) | — | `buildHoldingNewsMap` is already a pure function; matching itself has zero network dependency |
| Fail-soft per-ticker isolation | Backend (TS CLI) | — | try/catch already isolates per-ticker in `fetchTechnicalSnapshot`; new chunking logic must preserve this |
| STEP marker / pipeline continuation | Orchestration (invest.md + CLI stderr) | — | Script self-emits marker to stderr; invest.md ignores exit code (Phase 28 precedent) |
| Output file persistence (2 files) | Backend (TS CLI, fs/promises) | — | `tmp/watchlist-technicals.json` / `tmp/watchlist-news.json`, both TS↔downstream-agent handoff boundary |

No browser/frontend/CDN tier involvement — this phase is 100% backend batch data supply with zero LLM participation (per CONTEXT.md's "TS決定論" established pattern).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**パイプライン配置とステップ設計**
- D-01: 実行位置は invest.md Step 2h（ウォッチリスト更新）直後の新ステップ（Step 2i）。Step 2h でウォッチリスト状態が確定した後・Step 3 のレポート系より前に配置し、Phase 30 の判定ステップが常に当日確定済みのウォッチリストに対する追跡データを参照できる順序を構造的に保証する。
- D-02: 単一の fail-soft CLI `src/scripts/collect-watchlist-data.ts` がテクニカルとニュースの両方を収集し、2ファイルを出力する。1 CLI = 1 STEP マーカーで invest.md の配線を最小化。
- D-03: 専用 STEP マーカーは `[STEP:watchlist-data:OK]` / `[STEP:watchlist-data:FAIL:<短い理由>]`。write-watchlist.ts と同様にスクリプト自身が stderr へマーカーを出力し、invest.md 側は終了コードに関わらず次ステップへ進む。`[PIPELINE:FAIL]` は絶対に出さない。
- D-04: 空ウォッチリスト（アクティブ0件）は正常系 — `[STEP:watchlist-data:OK]` を出し、空のスナップショット/空のニュースマップを持つ有効JSONを両ファイルに書き込む（0件ログ付き）。

**出力ファイル構成（Phase 30 への供給契約）**
- D-05: 出力は2ファイル分離 — `tmp/watchlist-technicals.json`（`{generatedAt, snapshots: TechnicalSnapshot[]}` — 既存 tmp/technicals.json と同一形状）と `tmp/watchlist-news.json`（`HoldingNewsFile` — 既存 tmp/holding-news.json と同じ銘柄キー×ID参照方式）。
- D-06: ニュースは ID 参照方式を維持（記事本文の複製埋め込みはしない）。
- D-07: `TechnicalSnapshot.asOf`（銘柄ごとの最終バー日付）と両ファイルの `generatedAt` をそのまま保持・出力する。形状は既存流用なので追加実装は不要だが、削らないことを契約として明記。

**レート制限対策の実装方式（TRAC-03）**
- D-08: 既存 `collect-technicals.ts` / `fetchTechnicalSnapshots` は変更しない。`fetchTechnicalSnapshots` は `Promise.all` の無制限並列で、固定小規模セット（Step 2b の moderator-tickers ~10数銘柄）向けの設計。成長するウォッチリストにそのまま適用しない。
- D-09: 新CLI側でチャンク化（少数並列＋チャンク間の短い待機）でテクニカルを取得する。1銘柄分の取得・スナップショット構築ロジック（chart 呼び出し・`buildSnapshot` 等 technicals.ts の純関数群）は再利用し、並列度の制御だけを新規実装する。チャンクサイズ・待機msの具体値は名前付き定数として1箇所定義。具体値はプランナー裁量（目安: 並列4〜5、チャンク間200〜500ms — 30日失効で実効上限~30〜50銘柄のリストに対し launchd 時間予算内に収まる範囲）。
- D-10: 銘柄単位 fail-closed ではなく fail-soft（skip） — 1銘柄の取得失敗はその銘柄をスナップショット欠落として記録し、他銘柄の処理を続行する。失敗銘柄は `⚠ 取得失敗: <tickers>` 様式で標準出力にログ。

**同日キャッシュ（重複取得の回避）**
- D-11: Step 2b が出力した `tmp/technicals.json` を同日キャッシュとして再利用する — アクティブ銘柄のうち tmp/technicals.json に既にスナップショットが存在する銘柄は再取得せずコピーし、欠落銘柄のみ新規取得する。
- D-12: キャッシュ読込は fail-soft — tmp/technicals.json が欠損・破損・形状不整合の場合は警告ログのみで全銘柄を新規取得にフォールバックする。

**ニュースマッチングの入力構成（Pattern 4 適用詳細）**
- D-13: `buildHoldingNewsMap`（holding-news.ts）を無改変で流用する。アクティブなウォッチリスト銘柄を `PortfolioHolding` 形状（`{symbol, name, nameJa, sector}`）にマップして渡すのみで、マッチング関数側の変更はしない。
- D-14: 形状マップには Phase 28 が保存した社名を使う — `symbol` = `WatchlistEntry.ticker`（normalizeHoldingSymbol 済み）、`name` = `entry.name ?? entry.ticker`、`nameJa` = `entry.nameJa`（undefined 可）、`sector` = `""`（マッチングロジック未使用）。
- D-15: `matchAliases` の人手キュレーションは行わない — ticker 完全一致＋社名一致のみで開始。
- D-16: 1銘柄あたりの記事供給上限は holding-news.ts の既存定数 `MAX_ARTICLES_PER_HOLDING`（5件）をそのまま継承。ウォッチリスト専用の別上限は設けない。

**欠損データ表現と下流契約（fail-soft 粒度）**
- D-17: テクニカル欠落は snapshots 配列からの omit で表現する（既存 technicals.json と同じ契約 — null 埋めやプレースホルダは入れない）。Phase 30 の判定エージェントは「スナップショット欠落銘柄 = データ不足として判定スキップ/保留」を実装する。
- D-18: ニュースマップは全アクティブ銘柄のキーを必ず持つ（マッチ0件は空配列 — buildHoldingNewsMap の D-08 保証をそのまま享受）。
- D-19: 入力の watchlist.json 読込は read-only・防御的 — `getActiveWatchlistEntries`（Phase 28 の安定シグネチャ）でアクティブ銘柄を導出する。watchlist.json が欠損（ENOENT）の場合は空ウォッチリストとして D-04 の正常系。JSON 破損・形状不整合の場合は `[STEP:watchlist-data:FAIL:<理由>]` を出しつつ空の有効JSON2ファイルを書いて終了する（watchlist.json 自体には一切書き込まない）。
- D-20: tmp/news.json の読込失敗はニュース側のみの欠落に留める — 記事プールが読めない場合、ニュースマップは全銘柄空配列で出力し、テクニカル収集は継続する。

**テスト方針**
- D-21: 純関数部分（watchlist→PortfolioHolding 形状マップ、キャッシュ突き合わせ、チャンク分割）を単体テストする。ネットワークモックは既存規約（プレーン Error シミュレート）。Success Criteria 3 の「1銘柄失敗が全体を止めないことのテスト確認」を必須ケースに含める。

### Claude's Discretion

- 純関数モジュールの配置（`src/portfolio/watchlist-data.ts` 等の新モジュール vs 既存モジュールへの追加）と正確な関数シグネチャ — D-13/D-14 の要件を満たす範囲で
- チャンクサイズ・チャンク間待機msの具体値と定数名（D-09 の目安の範囲内: 並列4〜5、チャンク間200〜500ms）
- technicals.ts から1銘柄取得ロジックを再利用する具体手段（`fetchTechnicalSnapshot` の export 追加 vs チャンク版ヘルパーの追加。既存 `fetchTechnicalSnapshots` の挙動を変えないことが唯一の制約）
- CLI のログ文言・フォーマット詳細（日本語ログ、console.log=監査ログ / console.error=STEPステータスのチャネル規約踏襲）
- 単体テストのケース構成の詳細

### Deferred Ideas (OUT OF SCOPE)

- watchlist ティッカーへの matchAliases 人手キュレーション: ticker 完全一致＋社名一致で開始し、マッチ精度不足が観測されたら追補（Phase 28 CONTEXT から継続。D-15）
- 判定LLM呼び出しのバッチ化（5〜8銘柄/コール）: アクティブ30銘柄超で検討するトリガーポイント。Phase 30 の管轄
- Finnhub 銘柄別カンパニーニュースのウォッチリスト適用: 現状は tmp/news.json 既存プールからの抽出のみ（TRAC-02 の文言どおり）。ウォッチリスト銘柄専用の追加ニュース取得は API 予算を消費するため、プール抽出の精度不足が観測されたら将来フェーズで検討
- アクティブ銘柄数の上限キャップ: Phase 28 deferred の継続（monitor first, cap later）。本フェーズの取得失敗ログ・実行時間ログが観測データを供給する
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TRAC-01 | ウォッチリスト銘柄の当日株価・テクニカル指標（MA/RSI/出来高等）が日次収集され判定エージェントに供給される（collect-technicals パターン流用） | `TechnicalSnapshot`/`buildSnapshot`/chart 取得ロジックが `src/data/technicals.ts` に既存・無改変で全指標カバー済み（MA20/50/200, RSI14, volumeRatio, 52週高安, asOf）。チャンク化ヘルパーのみ新規実装（D-09） |
| TRAC-02 | ウォッチリスト銘柄の関連ニュースが tmp/news.json からTS側決定論で抽出され判定エージェントに供給される（holding-news パターン流用） | `buildHoldingNewsMap` は既に `PortfolioHolding[]` 抽象で書かれており watchlist 用の形状マップを渡すだけで無改変流用可（Pattern 4、実コードで確認済み、D-13/D-14） |
| TRAC-03 | 追跡データ収集は銘柄単位で fail-soft（1銘柄の取得失敗が他銘柄の処理やパイプライン全体を止めない、バッチ化でレート制限を考慮） | `fetchTechnicalSnapshot` は既に try/catch で null を返す per-ticker fail-soft設計。新チャンクヘルパーはこの契約を壊さず並列度のみ制御する（D-09/D-10） |
| OPS-06 | ウォッチリスト関連の新パイプラインステップは fail-soft 設計（専用 [STEP:*] マーカー、失敗時も既存4レポートの生成・デプロイが継続） | `write-watchlist.ts` の stderr マーカー + 終了コード無視パターンを完全再現（D-03）。write-watchlist.test.ts の「全FAIL分岐で[PIPELINE:FAIL]が一度も出力されない」テストパターンをそのまま踏襲可能 |
</phase_requirements>

## Standard Stack

### Core

No new dependencies. All required capability is provided by packages already installed and already used identically elsewhere in this codebase.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| yahoo-finance2 | ^3.13.2 [VERIFIED: package.json + npm registry] | `chart()` OHLCV fetch inside `fetchTechnicalSnapshot`, reused unmodified | Already the sole price-data source across `technicals.ts`, `market.ts`, `portfolio/data.ts`; `npm view yahoo-finance2 version` confirms latest is 4.0.0, but this project is pinned to installed `^3.13.2` — do NOT bump as part of this phase (out of scope, would be an unrelated breaking-change risk) |
| Node `fs/promises` | built-in (Node 22+, project uses `node:fs/promises`) | `readFile`/`writeFile`/`mkdir` for the new CLI's I/O | Same convention as `write-watchlist.ts`, `write-urgency-history.ts`, `collect-technicals.ts` — no persistence library needed |
| `tsx` | ^4.21.0 [VERIFIED: package.json] | Execution runtime for the new script (`npx tsx src/scripts/collect-watchlist-data.ts`) | Unchanged existing convention for all `src/scripts/*.ts` CLIs |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | (installed, see package.json devDependencies) | Unit tests for new pure functions + CLI wrapper mocks | Matches D-21's test-mocking-convention requirement (`vi.mock("node:fs/promises")`, `vi.mock("yahoo-finance2")`) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled chunking loop | `p-limit` / `p-queue` npm packages | Rejected — zero-new-dependency constraint from research SUMMARY.md; a 10-line chunk-and-sleep helper is trivially testable and matches this project's existing preference for inlining small utilities rather than adding libraries for simple concurrency control |
| In-CLI sequential fetch (no concurrency) | Chunked parallel fetch (D-09) | Rejected as primary approach — pure sequential fetch for 30-50 tickers would risk exceeding the launchd daily time budget; chunking balances rate-limit safety against runtime |

**Installation:** None required — no new packages.

**Version verification:** `yahoo-finance2` — installed `^3.13.2` per `package.json`; `npm view yahoo-finance2 version` returns `4.0.0` as latest on registry [VERIFIED: npm registry, checked 2026-07-15], but the project has not adopted v4 anywhere else in the codebase and Phase 29 must not silently upgrade it (D-08 explicitly forbids changing `technicals.ts` behavior, and a major-version bump risks breaking `chart()`'s response shape). Treat the installed `^3.13.2` as the phase's baseline.

## Package Legitimacy Audit

No new packages are installed by this phase — it exclusively reuses `yahoo-finance2` (already installed, already legitimacy-vetted in Phase 27/research/STACK.md) and Node built-ins. The Package Legitimacy Gate is not applicable.

**Packages removed due to [SLOP] verdict:** none (no new packages evaluated)
**Packages flagged as suspicious [SUS]:** none (no new packages evaluated)

## Architecture Patterns

### System Architecture Diagram

```
data/watchlist.json (Phase 28, updated by Step 2h)
        │
        │ getActiveWatchlistEntries() [read-only, D-19]
        ▼
┌───────────────────────────────────────────────────────────┐
│ src/scripts/collect-watchlist-data.ts (NEW, Step 2i)        │
│ fail-soft CLI, single [STEP:watchlist-data:*] marker (D-02) │
│                                                               │
│  ┌─────────────────────┐      ┌──────────────────────────┐ │
│  │ Technical branch      │      │ News branch                │ │
│  │                        │      │                             │ │
│  │ tmp/technicals.json ──┼──►   cache hit? copy (D-11) ──┐ │      │ tmp/news.json (Step 1) │ │
│  │ (Step 2b output,       │      │                             │ │
│  │  same-day cache)       │      │ pool of NewsArticleWithId   │ │
│  │        │ cache miss    │      │        │                    │ │
│  │        ▼               │      │        ▼                    │ │
│  │ chunked fetch (D-09)   │      │ shape-map WatchlistEntry[]  │ │
│  │  → fetchTechnicalSnapshot│    │  → PortfolioHolding[] (D-14)│ │
│  │  (per-ticker try/catch, │      │        │                    │ │
│  │   fail-soft skip, D-10) │      │        ▼                    │ │
│  │        │                │      │ buildHoldingNewsMap()       │ │
│  │        ▼                │      │  (holding-news.ts, D-13,    │ │
│  │ merge cache + fresh      │      │   UNMODIFIED)                │ │
│  │  snapshots               │      │        │                    │ │
│  └────────┬─────────────────┘      └────────┬────────────────────┘ │
│           ▼                                  ▼                       │
│  tmp/watchlist-technicals.json      tmp/watchlist-news.json          │
│  {generatedAt, snapshots[]} (D-05)  HoldingNewsFile (D-05/D-06)      │
└───────────────────────────────────────────────────────────┘
        │                                       │
        └───────────────┬───────────────────────┘
                         ▼
        Phase 30 buy-timing judgment agent (consumer, out of phase scope)
```

### Recommended Project Structure

```
src/
├── portfolio/
│   ├── watchlist.ts              # existing (Phase 28) — getActiveWatchlistEntries, unmodified
│   ├── holding-news.ts           # existing — buildHoldingNewsMap, unmodified (D-13)
│   ├── holdings.ts               # existing — PortfolioHolding type, unmodified
│   └── watchlist-data.ts         # NEW (naming: Claude's discretion) — pure functions:
│                                  #   shape mapping, cache merge, chunk splitting
├── data/
│   └── technicals.ts             # existing — add `fetchTechnicalSnapshot` to exports if not
│                                  #   already exported (additive only, D-08 forbids behavior change)
└── scripts/
    ├── collect-technicals.ts     # existing — unchanged, pattern reference (D-08)
    ├── write-watchlist.ts        # existing (Phase 28) — fail-soft CLI + STEP marker template
    └── collect-watchlist-data.ts # NEW — fail-soft CLI, single STEP marker (D-02)
```

### Pattern 1: Pure Module + Fail-Soft CLI Wrapper (persistence pattern, reused)

**What:** Business logic (shape mapping, cache merge, chunk splitting) lives in a pure, synchronous, throw-free module. A thin CLI script does all I/O and network calls, calls the pure functions, and is the only place that emits `[STEP:watchlist-data:*]` markers.
**When to use:** This entire phase — it is a direct copy of the `urgency-history.ts`/`write-urgency-history.ts` and `watchlist.ts`/`write-watchlist.ts` split already validated twice in this codebase.
**Example:**
```typescript
// Source: analogous to src/portfolio/watchlist.ts (Phase 28) and
// src/portfolio/urgency-history.ts — pure functions only, no I/O.

import { normalizeHoldingSymbol } from "./holding-news.js";
import type { WatchlistEntry } from "./watchlist.js";
import type { PortfolioHolding } from "./holdings.js";

/** D-14: WatchlistEntry[] を PortfolioHolding[] 形状にマップし buildHoldingNewsMap
 *  への入力とする。sector は未使用のため空文字固定。純関数・throw-free。 */
export function toPortfolioHoldingShape(
  entries: ReadonlyArray<WatchlistEntry>,
): ReadonlyArray<PortfolioHolding> {
  return entries.map((entry) => ({
    symbol: entry.ticker, // 既に normalizeHoldingSymbol 済み（Phase 28 保証）
    name: entry.name ?? entry.ticker,
    nameJa: entry.nameJa ?? "",
    sector: "",
  }));
}
```

### Pattern 2: Chunked Concurrency (new — no direct in-repo analog, compose from D-09's spec)

**What:** Split an array of tickers into fixed-size chunks, fetch each chunk with `Promise.all` (bounded parallelism), and `await` a short delay between chunks. This bounds burst concurrency against Yahoo Finance without serializing every request.
**When to use:** Fetching technicals for watchlist tickers not present in the same-day cache (D-09).
**Trade-offs:** Slightly slower than unbounded `Promise.all` (acceptable — D-09 explicitly trades runtime for rate-limit safety); slightly faster than fully sequential.
**Example:**
```typescript
// Source: composed per CONTEXT.md D-09 (no direct precedent; named-constant convention
// per Phase 28 D-09's "マジックナンバー分散禁止" requirement)

const CHUNK_SIZE = 5; // 目安: 並列4〜5 (CONTEXT.md D-09)
const CHUNK_DELAY_MS = 300; // 目安: チャンク間200〜500ms (CONTEXT.md D-09)

function chunk<T>(items: ReadonlyArray<T>, size: number): ReadonlyArray<ReadonlyArray<T>> {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchChunked(
  tickers: ReadonlyArray<string>,
  fetchOne: (symbol: string) => Promise<TechnicalSnapshot | null>,
): Promise<ReadonlyArray<TechnicalSnapshot>> {
  const results: TechnicalSnapshot[] = [];
  for (const batch of chunk(tickers, CHUNK_SIZE)) {
    const batchResults = await Promise.all(batch.map(fetchOne));
    results.push(...batchResults.filter((r): r is TechnicalSnapshot => r !== null));
    if (batch !== chunk(tickers, CHUNK_SIZE).at(-1)) {
      await sleep(CHUNK_DELAY_MS);
    }
  }
  return results;
}
```
Note: `fetchOne` here is `fetchTechnicalSnapshot` (singular) from `technicals.ts`, which already fail-softs per-ticker internally (returns `null` on error, per D-10's "既存 fetchTechnicalSnapshot が null を返す挙動と同型").

### Pattern 3: Same-Day Cache Read-Through (new — compose per D-11/D-12)

**What:** Before fetching any ticker over the network, check whether a same-day snapshot already exists in `tmp/technicals.json` (written earlier in the pipeline by Step 2b's `collect-technicals.ts`). Only fetch tickers not found in that cache.
**When to use:** At the start of the technical-collection branch, before chunked fetch.
**Trade-offs:** Cache is best-effort only (D-12 — corrupted/missing cache silently falls back to full fetch, never blocks). The cache file's own `asOf`/`generatedAt` is not re-validated against "today" — D-11 relies on it being written earlier in the *same pipeline run*, so cross-day staleness is a non-issue given the pipeline runs once daily.
**Example:**
```typescript
// Source: composed per CONTEXT.md D-11/D-12 (no direct precedent)

interface TechnicalsCacheFile {
  readonly generatedAt: string;
  readonly snapshots: ReadonlyArray<TechnicalSnapshot>;
}

/** D-12: fail-soft cache load. 欠損・破損・形状不整合は空配列にフォールバックする。 */
async function loadSameDayCache(path: string): Promise<ReadonlyArray<TechnicalSnapshot>> {
  try {
    const raw = await readFile(path, "utf-8");
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !Array.isArray((parsed as TechnicalsCacheFile).snapshots)
    ) {
      console.error(`[watchlist-data] tmp/technicals.json の形状が不正なためキャッシュを無視します`);
      return [];
    }
    return (parsed as TechnicalsCacheFile).snapshots;
  } catch {
    // ENOENT・パース失敗を区別せず fail-soft（D-12: キャッシュは最適化であり正しさの依存点にしない）
    return [];
  }
}

/** キャッシュとチャンク取得結果をマージする純関数。tickers の元順を保持しない（呼び出し側でOK）。 */
export function mergeWithCache(
  activeTickers: ReadonlyArray<string>,
  cached: ReadonlyArray<TechnicalSnapshot>,
): { readonly cachedTickers: ReadonlySet<string>; readonly missingTickers: ReadonlyArray<string> } {
  const cachedTickers = new Set(cached.map((s) => s.symbol));
  const missingTickers = activeTickers.filter((t) => !cachedTickers.has(t));
  return { cachedTickers, missingTickers };
}
```

### Anti-Patterns to Avoid

- **Modifying `fetchTechnicalSnapshots` (plural) to accept a concurrency parameter:** D-08 explicitly forbids any behavior change to `technicals.ts`'s existing exports, even backward-compatible ones — Step 2b's existing regression risk must stay zero. Add new capability alongside, never modify in place.
- **Re-deriving `PortfolioHolding.sector` from any real data source:** D-14 fixes `sector: ""` — the matching logic in `holding-news.ts` never reads this field; populating it with real data would be wasted work and a false signal that it matters.
- **Treating `matchAliases` absence as a bug to fix in this phase:** D-15 explicitly defers human-curated aliases; the shape-mapped `PortfolioHolding` for watchlist tickers should simply omit `matchAliases` (undefined), which `holding-news.ts`'s `resolveNameMatchType` already handles gracefully (`if (holding.matchAliases && ...)`).
- **Writing `null`/placeholder entries for failed-fetch tickers into `snapshots`:** D-17 requires omission, not null-filling — matches existing `tmp/technicals.json` contract exactly (`fetchTechnicalSnapshots` already filters nulls via `.filter((r): r is TechnicalSnapshot => r !== null)`).
- **Emitting `[PIPELINE:FAIL]` from any failure branch:** OPS-06/D-03 forbid this absolutely — every failure path in the new CLI must return normally after emitting `[STEP:watchlist-data:FAIL:<reason>]` to stderr, exactly like `write-watchlist.ts`'s branches.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Technical indicator computation (MA/RSI/volume ratio/52w high-low) | Custom SMA/RSI/trend calculators | `buildSnapshot`, `computeSMA`, `computeRSI`, `classifyTrend` from `src/data/technicals.ts` | Already implemented, unit-tested (implicitly via `collect-technicals.test.ts` + production use), and locked from modification by D-08 |
| News-to-ticker matching (ticker exact-match, name/nameJa fallback, priority scoring, 5-article cap) | Custom string-matching / scoring logic | `buildHoldingNewsMap`, `matchArticlesForHolding`, `rankAndCapHoldingArticles` from `src/portfolio/holding-news.ts` | Already generalized against the `PortfolioHolding` abstraction (Pattern 4, verified in actual source — no watchlist-specific branch needed); reinventing risks divergent matching behavior between holdings and watchlist |
| Ticker string normalization (trim/uppercase) | Custom regex/normalization | `normalizeHoldingSymbol` from `src/portfolio/holding-news.ts` | Single source of truth already used by `watchlist.ts`, `write-watchlist.ts`, `urgency-history.ts` — reimplementing risks a second, subtly different normalization rule causing key-mismatch bugs (the exact class of bug fixed by WR-03 in Phase 28's own commit history) |
| Active-watchlist derivation | Custom filter over `WatchlistFile` | `getActiveWatchlistEntries`/`isActive` from `src/portfolio/watchlist.ts` | Phase 28's stable, tested API — CONTEXT.md D-19 mandates its use verbatim |
| Concurrency limiting library | `p-limit`/`p-queue`/similar npm package | Hand-rolled chunk-and-sleep helper (~15 lines, Pattern 2 above) | Zero-new-dependency constraint (research SUMMARY.md); the required behavior (fixed chunk size + fixed inter-chunk delay) is simpler than what a general-purpose concurrency library solves, and a hand-rolled version is trivially unit-testable per D-21 |

**Key insight:** Every "hard part" of this phase (indicator math, news matching, ticker normalization) is already solved and locked against modification. The only genuinely new code is the chunking/staggering wrapper and the cache-merge logic — both are small, pure, and directly specified by CONTEXT.md's decisions. Planners should resist any temptation to "improve" the reused modules; deviation from D-08/D-13 is explicitly flagged in CONTEXT.md as a design escape that must be surfaced, not silently done.

## Common Pitfalls

### Pitfall 1: Assuming `fetchTechnicalSnapshots` (plural) can be reused for chunking by wrapping it per-chunk

**What goes wrong:** Calling `fetchTechnicalSnapshots(chunkOfTickers)` per chunk seems convenient (it already does per-ticker fail-soft + null-filtering), but this exports/imports a symbol from `technicals.ts` that's designed for the small bounded `moderator-tickers` case and creates an implicit coupling where any future edit to `fetchTechnicalSnapshots` (e.g., adding a shared connection pool) could unintentionally affect the new chunking path too.
**Why it happens:** `fetchTechnicalSnapshots` already does exactly what one chunk needs (parallel fetch + fail-soft + filter), making it tempting to reuse directly instead of the singular `fetchTechnicalSnapshot`.
**How to avoid:** Use `fetchTechnicalSnapshot` (singular) as the atomic unit inside the new chunking helper, per D-09's explicit instruction ("1銘柄分の取得・スナップショット構築ロジック...は再利用し、並列度の制御だけを新規実装する"). This keeps the new chunking logic entirely independent of `fetchTechnicalSnapshots`'s unbounded-parallelism behavior — Step 2b's existing behavior is provably unaffected regardless of future changes to chunk size.
**Warning signs:** If the new CLI ever calls `fetchTechnicalSnapshots` (plural) with anything other than the full unbounded ticker list, that's a signal the chunking design has drifted from D-09.

### Pitfall 2: Forgetting `fetchTechnicalSnapshot` is not currently exported

**What goes wrong:** `src/data/technicals.ts` line 138 defines `export async function fetchTechnicalSnapshot` — it IS exported at the module level already [VERIFIED: direct source read 2026-07-15]. However, no existing script imports it (`collect-technicals.ts` only imports `fetchTechnicalSnapshots`). A planner might mistakenly believe an export needs to be *added*, when in fact it is already exported and can be imported directly — no `technicals.ts` edit needed at all.
**Why it happens:** CONTEXT.md's Claude's Discretion section frames this as "`fetchTechnicalSnapshot` の export 追加 vs チャンク版ヘルパーの追加" as if export status were unconfirmed.
**How to avoid:** Verified directly against source: `fetchTechnicalSnapshot` (singular) is already a named export. The new module can `import { fetchTechnicalSnapshot } from "../data/technicals.js"` with zero changes to `technicals.ts`. This eliminates any need to touch the off-limits file (D-08) at all — even an additive export change is unnecessary.
**Warning signs:** A plan task that includes "add export to technicals.ts" should be flagged as based on stale/incorrect assumption during plan review.

### Pitfall 3: Rate limits from unbatched per-ticker calls (Pitfall 3 in v2.7 research PITFALLS.md — restated here for phase-local emphasis)

**What goes wrong:** Firing `Promise.all` across all active watchlist tickers (potentially 30-50 after weeks of accumulation per EXPIRY_CALENDAR_DAYS=30) risks Yahoo Finance 429s — invisible during development with 3-5 test tickers, only surfacing in production after organic watchlist growth.
**Why it happens:** The existing `fetchTechnicalSnapshots` pattern (unbounded `Promise.all`) is the most obvious thing to copy, but it was designed for a small, roughly-fixed dataset (moderator-tickers, ~10-15).
**How to avoid:** D-09's chunking + D-11's same-day cache together bound both concurrency and total call volume — a ticker present in `tmp/technicals.json` (already fetched by Step 2b for that day's highlighted stocks) is never fetched twice. This is the single most load-bearing pitfall mitigation in the phase and must be present in the initial implementation, not retrofitted (explicit instruction in CONTEXT.md Specific Ideas).
**Warning signs:** Pipeline step duration for `watchlist-data` step scaling linearly (or worse) with watchlist size in `pipeline-metrics.json`; 429/error entries in the `⚠ 取得失敗` log growing disproportionately as watchlist grows.

### Pitfall 4: Silent divergence between technicals success/failure and news success/failure fail-soft granularity

**What goes wrong:** If the CLI's overall try/catch wraps both the technical and news branches together, a news-pool read failure (`tmp/news.json` missing) could accidentally also abort technical collection, violating D-20's explicit "片系の失敗が他系を道連れにしない" requirement.
**Why it happens:** It's structurally simpler to write one big try/catch around `main()` than to isolate two independent branches, especially when both write to the same STEP marker.
**How to avoid:** Wrap the technical-collection branch and the news-matching branch in independent try/catch blocks (or make the news branch itself throw-free by construction, since `buildHoldingNewsMap` never throws). Only the outermost fatal/mechanism failures (e.g., cannot read `watchlist.json` at all — D-19) should short-circuit both branches; per-branch data-source failures (news pool unreadable) must degrade only that branch's output.
**Warning signs:** A test where `tmp/news.json` is missing/corrupted but `tmp/watchlist-technicals.json` still ends up empty — that would indicate the two branches aren't actually independent.

### Pitfall 5: `tmp/` cleanup ordering silently discarding this phase's output before Phase 30 can read it

**What goes wrong:** CONTEXT.md's own Integration Points note flags this as an open question: "tmp/ 出力は日次揮発...プランナーは Step 3.0 の rm 対象に含めるか要確認". Step 3.0 currently does `rm -rf tmp/websearch tmp/reeval` — it does NOT currently touch `tmp/watchlist-technicals.json`/`tmp/watchlist-news.json` by name, but if a planner assumes these need to be added to a cleanup list (mirroring Step 3.0's pattern) without checking, they could accidentally schedule deletion of this phase's output before Phase 30 consumes it later in the same run.
**Why it happens:** Step 3.0's cleanup block targets *directories* (`tmp/websearch`, `tmp/reeval`, `tmp/portfolio-research`), not individual JSON files; this phase's two output files are flat files in `tmp/` root, which Step 3.0 never touches.
**How to avoid:** Verified directly against invest.md source: Step 3.0's `rm -rf` only targets `tmp/websearch` and `tmp/reeval` subdirectories; Step 3-P's separate `rm -rf tmp/portfolio-research` is similarly directory-scoped. Root-level files like `tmp/technicals.json`, `tmp/holding-news.json`, `tmp/portfolio.json` are simply overwritten in-place each run (no explicit `rm` needed) — this phase's two new root-level files should follow the identical pattern (CLI overwrites via `writeFile` each run, no `rm` step needed in invest.md at all).
**Warning signs:** A plan task proposing to add `tmp/watchlist-technicals.json`/`tmp/watchlist-news.json` to any `rm -rf` cleanup command — this would be inconsistent with how every other root-level `tmp/*.json` file in this pipeline is already handled (overwrite-in-place, no explicit delete).

## Code Examples

### Full CLI skeleton (fail-soft wrapper, mirrors write-watchlist.ts exactly)

```typescript
// Source: composed from src/scripts/write-watchlist.ts (structure) +
// src/scripts/collect-technicals.ts (technicals fail-soft empty-write pattern)

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchTechnicalSnapshot, type TechnicalSnapshot } from "../data/technicals.js";
import { getActiveWatchlistEntries } from "../portfolio/watchlist.js";
import type { WatchlistFile } from "../portfolio/watchlist.js";
import { buildHoldingNewsMap } from "../portfolio/holding-news.js";
import type { HoldingNewsFile } from "../portfolio/holding-news.js";
import type { NewsArticleWithId } from "../data/news/article-id.js";
// + toPortfolioHoldingShape, chunk helpers from the new pure module

const TMP_DIR = join(import.meta.dirname, "../../tmp");
const DATA_DIR = join(import.meta.dirname, "../../data");
const WATCHLIST_PATH = join(DATA_DIR, "watchlist.json");
const TECHNICALS_CACHE_PATH = join(TMP_DIR, "technicals.json");
const NEWS_POOL_PATH = join(TMP_DIR, "news.json");
const OUT_TECHNICALS_PATH = join(TMP_DIR, "watchlist-technicals.json");
const OUT_NEWS_PATH = join(TMP_DIR, "watchlist-news.json");

async function writeEmptyOutputs(): Promise<void> {
  // D-04: 空アクティブ0件 / D-19 破損時: 常に有効JSONを両ファイルに書く
  await writeFile(
    OUT_TECHNICALS_PATH,
    JSON.stringify({ generatedAt: new Date().toISOString(), snapshots: [] }),
    "utf-8",
  );
  await writeFile(OUT_NEWS_PATH, JSON.stringify({}), "utf-8");
}

export async function main(): Promise<void> {
  await mkdir(TMP_DIR, { recursive: true });

  // D-19: watchlist.json 読込は read-only・防御的
  let watchlist: WatchlistFile = {};
  try {
    const raw = await readFile(WATCHLIST_PATH, "utf-8");
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      console.error("[watchlist-data] data/watchlist.json の形状が不正です。空JSONで終了します。");
      await writeEmptyOutputs();
      console.error("[STEP:watchlist-data:FAIL:corrupted]");
      return;
    }
    watchlist = parsed as WatchlistFile;
  } catch (error) {
    const isMissing =
      (error as NodeJS.ErrnoException).code === "ENOENT" ||
      (error instanceof Error && error.message.includes("ENOENT"));
    if (!isMissing) {
      console.error("[watchlist-data] data/watchlist.json の読込に失敗しました。", error);
      await writeEmptyOutputs();
      console.error("[STEP:watchlist-data:FAIL:corrupted]");
      return;
    }
    // ENOENT は D-04 の正常系（初回実行）— watchlist は {} のまま続行
  }

  const activeEntries = getActiveWatchlistEntries(watchlist);
  // ... 技術・ニュース両ブランチはそれぞれ独立 try/catch（Pitfall 4）
  // ... 詳細は Pattern 2/3 参照

  console.error("[STEP:watchlist-data:OK]");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(async (error) => {
    console.error("Fatal error:", error);
    try {
      await writeEmptyOutputs();
    } catch {
      // 出力先にも書けない場合は invest.md 側のフォールバックに委ねる
    }
    // D-03: [PIPELINE:FAIL] は出さない。exit code は非0でも invest.md 側が無視する契約。
    process.exitCode = 1;
  });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|-------------------|---------------|--------|
| N/A — this is the first "growing ticker list" data-supply step in the codebase | Chunked/cached/fail-soft-per-ticker fetch design | Phase 29 (this phase) | Establishes the first precedent in this codebase for a data-supply step whose input size is unbounded (vs. the fixed ~12-holding or ~10-15-moderator-ticker sets every prior step handled) — this pattern should be the template for any future unbounded-list data supply |

**Deprecated/outdated:** None — this phase introduces net-new capability, nothing is being replaced.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|-----------------|
| A1 | Chunk size 5 / delay 300ms are reasonable defaults within CONTEXT.md D-09's stated range (4-5 parallel, 200-500ms) | Pattern 2 code example | Low — these are explicitly Claude's discretion per D-09; if wrong, easily tunable named constants, no structural risk |
| A2 | `data/watchlist.json` will realistically stay under ~30-50 active tickers given `EXPIRY_CALENDAR_DAYS = 30` | Pitfall 3 | Medium — if growth outpaces expiry (e.g., very high daily bullish-pick volume), chunked fetch could still approach the launchd time budget; monitored via existing `pipeline-metrics.json` instrumentation, not a blocking risk for initial implementation |

**If this table is empty:** N/A — two low/medium-risk assumptions logged above, both explicitly within CONTEXT.md's stated discretion bounds and monitorable post-ship via existing instrumentation.

## Open Questions

1. **Exact module name/path for the new pure module**
   - What we know: CONTEXT.md explicitly grants this as Claude's discretion (`src/portfolio/watchlist-data.ts` suggested as one option)
   - What's unclear: Whether to co-locate shape-mapping + chunk helpers in one file or split further
   - Recommendation: Single new file `src/portfolio/watchlist-data.ts` housing `toPortfolioHoldingShape`, `mergeWithCache`, and `chunk` — matches this codebase's existing granularity (one new pure module per phase, e.g., `urgency-history.ts`, `decision-diff.ts`, `watchlist.ts` are each single-file). Planner should confirm final name during plan-phase.

2. **Whether Step 2i should also validate `tmp/technicals.json`'s `generatedAt` against "today"**
   - What we know: D-11/D-12 specify the cache is read as-is, with fail-soft fallback on shape/parse failure, but do not mention date-freshness validation
   - What's unclear: Since the pipeline runs once daily and `tmp/` is overwritten each run (never explicitly cleared), a stale multi-day-old `tmp/technicals.json` should not exist in normal operation — but if a prior run crashed before Step 2b completed, a leftover file from a previous day is theoretically possible
   - Recommendation: Out of scope per D-11/D-12's explicit "fail-soft only, not a correctness dependency" framing — a stale cache entry would at worst cause one ticker's technicals to be one day older than ideal, degrading gracefully rather than breaking. Planner should not add date-validation logic beyond what D-11/D-12 specify; flag as a future refinement only if observed in production logs.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|--------------|-----------|---------|----------|
| Yahoo Finance (yahoo-finance2 API, external network) | TRAC-01 technical fetch | Assumed reachable (no official SLA — per v2.7 PITFALLS.md Pitfall 3) | n/a (unofficial scraper API) | D-10 per-ticker fail-soft skip; D-11 same-day cache reduces call volume |
| `tmp/technicals.json` (Step 2b output) | D-11 same-day cache | ✓ conditionally — exists only if Step 2b ran earlier in the same pipeline invocation | n/a (JSON file, not a service) | D-12 fail-soft: missing/corrupted → full fetch for all active tickers |
| `tmp/news.json` (Step 1 output) | TRAC-02 news matching | ✓ conditionally — exists if Step 1 succeeded (may be `[]` per collect-data.ts's own fail-soft empty-array write) | n/a (JSON file, not a service) | D-20 fail-soft: missing/corrupted → all-empty news map, technicals continue independently |
| `data/watchlist.json` (Phase 28 output) | D-19 active-ticker source | ✓ conditionally — ENOENT is normal on first run (D-04) | n/a (JSON file, not a service) | D-19: ENOENT → empty watchlist (normal); corrupted → FAIL marker + empty valid JSON outputs |

**Missing dependencies with no fallback:** None — every dependency in this phase has an explicit fail-soft path per CONTEXT.md's decisions.

**Missing dependencies with fallback:** All four listed above have documented fallback behavior (D-10 through D-20).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest [VERIFIED: package.json devDependencies + existing `*.test.ts` files across `src/portfolio/` and `src/scripts/`] |
| Config file | none dedicated found at repo root during this research pass — vitest appears to run via default config discovery; confirm exact invocation command from `package.json` `scripts` during planning if not already known |
| Quick run command | `npx vitest run src/portfolio/watchlist-data.test.ts src/scripts/collect-watchlist-data.test.ts` (adjust filenames to planner's final module names) |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|---------------------|--------------|
| TRAC-01 | Chunked technical fetch produces snapshots for all reachable tickers, omits unreachable ones | unit | `npx vitest run src/portfolio/watchlist-data.test.ts -t "chunk"` | ❌ Wave 0 |
| TRAC-01 | Same-day cache hit avoids re-fetching a ticker already present in `tmp/technicals.json` | unit | `npx vitest run src/portfolio/watchlist-data.test.ts -t "mergeWithCache"` | ❌ Wave 0 |
| TRAC-02 | Watchlist entries shape-mapped to `PortfolioHolding[]` produce correct `symbol`/`name`/`nameJa`/`sector` per D-14 | unit | `npx vitest run src/portfolio/watchlist-data.test.ts -t "toPortfolioHoldingShape"` | ❌ Wave 0 |
| TRAC-02 | `buildHoldingNewsMap` invoked with watchlist-shaped holdings returns a key for every active ticker (D-18) | unit (integration-style, exercises real `buildHoldingNewsMap`) | `npx vitest run src/scripts/collect-watchlist-data.test.ts -t "news"` | ❌ Wave 0 |
| TRAC-03 | One ticker's fetch throwing/rejecting does not prevent other tickers' snapshots from being collected | unit | `npx vitest run src/scripts/collect-watchlist-data.test.ts -t "fail-soft"` | ❌ Wave 0 |
| OPS-06 | `[STEP:watchlist-data:OK]` emitted on success; `[STEP:watchlist-data:FAIL:<reason>]` on each failure branch; `[PIPELINE:FAIL]` never emitted | unit (mirrors write-watchlist.test.ts's "全FAIL分岐で[PIPELINE:FAIL]が一度も出力されない" test) | `npx vitest run src/scripts/collect-watchlist-data.test.ts -t "STEP"` | ❌ Wave 0 |
| D-04 | Zero active tickers → valid empty JSON in both output files, `[STEP:watchlist-data:OK]` | unit | `npx vitest run src/scripts/collect-watchlist-data.test.ts -t "empty"` | ❌ Wave 0 |
| D-19 | Corrupted `watchlist.json` → FAIL marker + valid empty JSON outputs, no crash | unit | `npx vitest run src/scripts/collect-watchlist-data.test.ts -t "corrupted"` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run <changed-test-file>`
- **Per wave merge:** `npx vitest run` (full suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/portfolio/watchlist-data.test.ts` (or planner's chosen filename) — covers TRAC-01/TRAC-02 pure-function behavior (shape mapping, cache merge, chunk splitting)
- [ ] `src/scripts/collect-watchlist-data.test.ts` — covers TRAC-01/TRAC-03/OPS-06/D-04/D-19 CLI-level fail-soft behavior, mirroring `write-watchlist.test.ts`'s mocking conventions (`vi.mock("node:fs/promises")`, `vi.mock("yahoo-finance2")`)
- [ ] Framework install: none — vitest already installed and configured project-wide

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|-----------------|---------|---------------------|
| V2 Authentication | No | No auth surface introduced — this is an internal batch CLI, not a user-facing endpoint |
| V3 Session Management | No | Not applicable — no session concept in this pipeline |
| V4 Access Control | No | Not applicable — single-operator local/launchd execution context, matches existing codebase pattern |
| V5 Input Validation | Yes | JSON shape validation on `data/watchlist.json` read (D-19 — reject non-object/array/null shapes, mirrors `write-watchlist.ts`'s `loadExistingWatchlist` pattern exactly); no external user input reaches this CLI (all inputs are pipeline-internal `tmp/`/`data/` files or the Yahoo Finance API response) |
| V6 Cryptography | No | No secrets/credentials handled by this phase — Yahoo Finance `quote()`/`chart()` calls require no API key in this project's existing usage |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|------------------------|
| Malformed/corrupted `data/watchlist.json` causing a crash that propagates to `[PIPELINE:FAIL]` | Denial of Service (availability) | D-19's two-branch ENOENT-vs-corrupted load pattern (copied verbatim from `write-watchlist.ts`'s `loadExistingWatchlist`) — corrupted input never crashes, always degrades to a FAIL marker + valid empty JSON output |
| Untrusted third-party API response (Yahoo Finance `chart()`) causing unhandled exception mid-run | Denial of Service (availability) | Existing `fetchTechnicalSnapshot`'s try/catch (unmodified, D-08) already isolates this per-ticker; new chunking layer must not swallow/bypass this isolation |
| Article-ID lookup against `tmp/news.json`'s pool referencing a hallucinated/nonexistent ID | Tampering (data integrity) | Not a new risk in this phase — `resolvePortfolioHoldingNews`'s "drop unknown ID + console.warn" guard (already shipped, v2.5 Phase 19 design) applies identically when Phase 30 later resolves `tmp/watchlist-news.json` against the same pool; this phase only writes ID references, never resolves them, so the guard's enforcement point is downstream |

No new threat surface is introduced by this phase — it reuses established internal-pipeline trust boundaries (`tmp/*.json` as an already-trusted TS↔TS handoff, per CONTEXT.md's established "tmp/*.json ハンドオフ境界" pattern) and adds no network-facing endpoint, user input, or credential handling.

## Sources

### Primary (HIGH confidence)
- Direct source read: `/Users/arai/invest/src/data/technicals.ts` — confirmed `fetchTechnicalSnapshot` (singular) is already exported; confirmed `TechnicalSnapshot` shape and all indicator fields
- Direct source read: `/Users/arai/invest/src/portfolio/holding-news.ts` — confirmed `buildHoldingNewsMap` operates purely against `PortfolioHolding[]` abstraction with zero holdings-specific coupling (Pattern 4 verified against actual code, not just research doc)
- Direct source read: `/Users/arai/invest/src/portfolio/watchlist.ts` — confirmed `getActiveWatchlistEntries`/`isActive`/`WatchlistEntry`/`WatchlistFile` stable Phase 28 API
- Direct source read: `/Users/arai/invest/src/scripts/write-watchlist.ts` + `write-watchlist.test.ts` — confirmed fail-soft CLI structure, STEP marker convention, ENOENT-vs-corrupted two-branch load pattern, and vitest mocking conventions to replicate
- Direct source read: `/Users/arai/invest/src/scripts/collect-technicals.ts` + `collect-technicals.test.ts` — confirmed existing empty-snapshot fail-soft write pattern and `parseTickerList` test conventions
- Direct source read: `/Users/arai/invest/src/scripts/collect-data.ts` — confirmed `buildHoldingNewsMap` call-site pattern and `tmp/news.json`/`tmp/holding-news.json` write conventions
- Direct source read: `/Users/arai/invest/.claude/commands/invest.md` (Step 2g/2h/3.0) — confirmed exact insertion point, STEP marker echoing convention, and `tmp/` cleanup scope (directory-only, not root-level files)
- `.planning/phases/29-daily-tracking-data-supply/29-CONTEXT.md` — 21 locked decisions (D-01〜D-21), all cross-verified against source above
- `.planning/research/ARCHITECTURE.md` Pattern 4 and Data Flow section — verified consistent with actual `holding-news.ts` source
- `.planning/research/PITFALLS.md` Pitfall 3 — rate-limit mitigation checklist, verified consistent with CONTEXT.md D-09/D-11
- `.planning/phases/28-watchlist-persistence/28-PATTERNS.md` — confirmed established pure-module/fail-soft-CLI split conventions to replicate exactly

### Secondary (MEDIUM confidence)
- `npm view yahoo-finance2 version` [VERIFIED via tool, 2026-07-15] — confirmed registry latest is `4.0.0`; project remains on installed `^3.13.2`, phase must not silently upgrade

### Tertiary (LOW confidence)
- None — all findings for this phase were verifiable directly against the local codebase, requiring no external/web research beyond a single registry version check

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies, every capability already installed and verified against actual source code
- Architecture: HIGH — every pattern verified directly against real, currently-shipping source files (not just research-doc claims), including Pattern 4's "generalizing an existing matcher" claim confirmed by reading `holding-news.ts` itself
- Pitfalls: HIGH — Pitfalls 1-3 are project-specific and grounded in direct source inspection (e.g., confirming `fetchTechnicalSnapshot`'s actual export status resolves an open question in CONTEXT.md's own discretion framing); Pitfall 3 (rate limits) carries forward MEDIUM-confidence external grounding from v2.7 PITFALLS.md (Finnhub/Yahoo rate-limit sources)

**Research date:** 2026-07-15
**Valid until:** 30 days (stable internal codebase extension; primary external dependency is yahoo-finance2's unofficial API, which has no SLA and could change at any time — re-verify `chart()`/`quote()` response shape if this phase's implementation is delayed significantly past this window)
</content>

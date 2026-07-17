# Phase 28: Watchlist Persistence - Research

**Researched:** 2026-07-15
**Domain:** TypeScript pure-function state-machine persistence (ticker-keyed current-state table) extending an existing daily-batch investment pipeline
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**状態テーブルのスキーマ設計**
- D-01: `data/watchlist.json` は ticker キー方式の現在状態テーブル（date キー方式ではない）。research の4パスすべてが収束した構成。日付キー方式の履歴分析が将来必要になれば別ファイルで担う（urgency-history.json の前例）
- D-02: removedReason の enum は REQUIREMENTS.md の正準値 `"downgraded" | "purchased" | "expired"` を使用。research ARCHITECTURE.md 例示の `verdict-downgrade`/`entered-portfolio` は採用しない（要件文書が正）
- D-03: エントリの必須フィールドは `ticker` / `addedDate` / `lastVerdictDate`、除外時に `removedReason` / `removedDate` を付与。active なエントリは定義上すべて強気なので verdict フィールドの常時保持は不要（保持するかは Claude 裁量）。日付は既存規約どおり `YYYY-MM-DD` 文字列で `isValidDateKey`（urgency-history.ts）と同一の正規表現検証を再利用
- D-04: 会社名（name/nameJa）は登録時に取得して optional フィールドとして保存。取得は D-16 の batch quote() の `longName`/`shortName` を流用（ETF判定と同一コールで社名も得られるため追加API呼び出しゼロ）。取得失敗時は名前なしで登録し、下流表示は ticker にフォールバック

**再追加（re-admission）セマンティクス**
- D-05: 除外済み銘柄が再度強気評価された場合、新規エピソードとして再追加する（addedDate は再追加日）。その際、過去の除外記録（いつ・なぜ除外されたか）は破壊しない — Success Criteria 5「除外・失効後もレコードは履歴として保持され追跡できる」を再追加後も満たすため、除外エピソードを上書き消去する実装は不可
- D-06: 履歴保持の具体構造（ticker ごとのエピソード配列 vs 現行エントリ＋removalHistory 配列）はプランナー裁量。ただし「アクティブ銘柄一覧の導出が単純であること」（Phase 29/30 が消費する）と「除外履歴が同一ファイル内で追跡できること」の両立を要件とする

**時間ベース失効（WLST-04）**
- D-07: 失効基準は `lastVerdictDate`（最終強気確認日）からの経過暦日。営業日計算は日米の祝日カレンダーが必要になり複雑さに見合わないため暦日を採用（決定論・依存ゼロ）
- D-08: 失効閾値は 30 暦日（約20営業日）。research FEATURES が「swing-trader 的な高速回転は本プロジェクトの中長期リストに不適、generous window を推奨」、PITFALLS が「30-60日で50-150銘柄に肥大」と指摘するバランス点。強気で再言及されるたびに lastVerdictDate が更新されるため、失効するのは「1ヶ月間一度も強気再確認されなかった」銘柄のみ
- D-09: 閾値は名前付き定数（例: `EXPIRY_CALENDAR_DAYS = 30`）として watchlist.ts に一箇所定義。マジックナンバー分散禁止
- D-10: ウォッチリストのサイズ（active 件数・除外件数）を CLI 標準出力にログする。research PITFALLS「size instrumentation from day one」の直接適用。launchd ログから肥大傾向を事後監査可能にする

**除外トリガーの入力ソース（WLST-02/03）**
- D-11: downgraded 判定は当日 `tmp/meeting-result.json` の highlightedStocks を照合 — ウォッチリスト内 ticker が当日 verdict 中立/弱気で登場したら `downgraded`。当日言及がない銘柄は現状維持（lastVerdictDate 据え置き、失効カウント進行）
- D-12: purchased 判定は `src/portfolio/holdings.ts` の `PORTFOLIO_HOLDINGS` を正準ソースとする（`tmp/portfolio.json` ではない）。静的な単一情報源であり、collect-data ステップの成否に依存しない。ticker は完全一致（`.T` サフィックスそのまま、大文字化等の正規化詳細は extract-tickers.ts の既存規約に準拠）
- D-13: dateKey は `tmp/meeting-result.json` の `date` フィールドから取得（Phase 25 D-05 の前例踏襲。JST再導出しない）。Step 4 の docs/{date}/・コミットメッセージと必ず一致させる

**パイプライン統合・fail-soft・破損時ポリシー**
- D-14: 純関数モジュール `src/portfolio/watchlist.ts` ＋ fail-soft CLI ラッパー `src/scripts/write-watchlist.ts` の分離構成。`urgency-history.ts`＋`write-urgency-history.ts` の実証済みテンプレートを踏襲（純関数は I/O 非依存・throw-free、ラッパーのみが readFile/writeFile/mkdir と process.exit を持つ）
- D-15: 実行位置は invest.md Step 2g（filter-etf-stocks → validate-meeting）完了直後の新ステップ（research の Step 3-W 相当）。ETF除外済み・バリデーション済みの meeting-result を入力とし、Phase 29 のデータ供給・Phase 30 の判定より前にウォッチリスト状態が確定する順序を構造的に保証する
- D-16: 専用 STEP マーカー `[STEP:watchlist:OK]` / `[STEP:watchlist:FAIL:<理由>]` を出力し、終了コード非0でもパイプライン継続（OPS-06 の本フェーズ分担。`[PIPELINE:FAIL]` は絶対に出さない）
- D-17: 同日再実行は冪等 — ticker キーの merge 構築により同日2回実行しても addedDate は初回値を保持し重複登録が構造的に不可能（Phase 25 の spread merge パターン）。専用の同日ガードファイルは不要
- D-18: ファイル読み込みの二段フェイル設計 — ①ファイル欠損（ENOENT）→ 空の状態テーブルとして初期化し正常続行（初回実行がこのパス）。ENOENT 判定は `error.code === "ENOENT"` と `error.message.includes("ENOENT")` の両方をチェック（Phase 25 Plan 02 のテストモック規約）。②JSON 破損・スキーマ不整合 → 既存ファイルを上書きせず `[STEP:watchlist:FAIL:<理由>]` で当日の更新をスキップ（蓄積済み状態の保全を可用性より優先。破損ファイルを空で上書きすると全履歴を失う）
- D-19: zod は使わない — watchlist.json は LLM 出力ではなく TS 自己生成ファイルのため、alias 硬化は不要。読み込み時の防御的パースは `loadUrgencyHistory`（report-data-loaders.ts / urgency-rollup 系）の throw しない防御様式に合わせる
- D-20: Step 4 の `git add docs/ data/` は Phase 25 で既に data/ を含むため、watchlist.json のコミットに invest.md Step 4 の変更は不要（実装時に既存記述を確認・検証のみ行う）

**ETF防御的二重フィルタ（第2ゲート）**
- D-21: admission 内で Phase 27 の純関数 `filterEtfStocks`（src/portfolio/etf-exclusion.ts）を再利用。将来 highlightedStocks 以外の経路から候補が入っても ETF が構造的に混入しない独立ゲート（research の「2つの独立した呼び出し点」構成の後者。Phase 27 CONTEXT の deferred 項目を本フェーズで実装）
- D-22: quoteType lookup は新規登録候補ティッカーのみを対象に batch quote() 1回で実施。既存登録済み銘柄の再確認は不要（登録時に検証済み）。lookup 失敗銘柄は fail-closed で登録しない（Phase 27 D-01 踏襲）。このコールの応答から D-04 の会社名も同時取得する（1コール2役）
- D-23: quote() の呼び出しはラッパー側（write-watchlist.ts）で行い、純関数には lookup 結果を引数で渡す。etf-exclusion.ts の `QuoteTypeLookup` 型をそのまま受け渡しに使い、純関数のネットワーク非依存性（単体テスト容易性）を維持する

### Claude's Discretion
- WatchlistEntry / WatchlistFile の正確な型定義・エピソード構造の実装詳細（D-06 の要件を満たす範囲で）
- CLI ラッパーのログ文言・フォーマット詳細（日本語ログ、console.log=監査ログ / console.error=STEPステータスのチャネル規約踏襲）
- verdict フィールドを active エントリに保持するか（D-03）
- ticker 正規化の詳細（既存 extract-tickers.ts 規約への準拠方法）
- 単体テストのケース構成（admit 新規/既存更新/ETF拒否/lookup失敗、prune 3トリガー各種、再追加、冪等性、境界日数 — 既存テスト規約 urgency-history.test.ts / filter-etf-stocks.test.ts 参照）

### Deferred Ideas (OUT OF SCOPE)
- アクティブ銘柄数の上限キャップ（サイズベース強制除外）: 30暦日失効（D-08）とサイズログ（D-10)で肥大は実質的に抑止できる。ログで肥大傾向が観測されたら将来フェーズで検討（research PITFALLS の「monitor first, cap later」路線）
- 日付キー方式の判定履歴ログファイル: 買いタイミング判定の的中率検証（WLST-F2, Future Requirements）が必要になった時に別ファイルとして追加。watchlist.json への責務混載はしない（research ARCHITECTURE の明示的推奨）
- watchlist ティッカーへの matchAliases 人手キュレーション: Phase 29 のニュースマッチングで ticker 完全一致＋社名一致のみで開始し、精度不足が観測されたら追補（research Pattern 4 の指摘）
- 過去レポートからの遡及ブートストラップ: REQUIREMENTS.md Out of Scope で確定済み（再強気評価で自然に取り込まれる）
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WLST-01 | 当日ミーティングで `verdict: 強気` となった銘柄（ETF除外後）が `data/watchlist.json` に自動登録される（ticker キー方式、addedDate/lastVerdictDate 付き、当日以降の蓄積で過去分の遡及なし） | `admitBullishStocks()` design (Standard Stack / Code Examples); reuses `urgency-history.ts` spread-merge idempotency pattern; ETF re-filter via `filterEtfStocks` (D-21〜23) |
| WLST-02 | 再評価で verdict が中立/弱気に転落した銘柄はウォッチリストから自動除外される（TS側決定論） | `pruneWatchlist()` downgraded branch reading `tmp/meeting-result.json` highlightedStocks (D-11); Architecture Patterns Pattern 2 |
| WLST-03 | portfolio.json の保有銘柄に現れたティッカーは「購入済み」としてウォッチリストから自動除外される（TS側決定論） | `pruneWatchlist()` purchased branch reading `PORTFOLIO_HOLDINGS` (D-12); Pitfall/Gotcha table — canonical source is `holdings.ts`, NOT `tmp/portfolio.json` |
| WLST-04 | 強気再確認が一定期間ない銘柄は時間ベースで自動失効する（TS側決定論、リスト無限肥大の構造的防止） | `pruneWatchlist()` expired branch, calendar-day diff against `lastVerdictDate`, `EXPIRY_CALENDAR_DAYS = 30` constant (D-07〜09); Pitfall 2 mitigation |
| WLST-05 | 除外・失効はレコード削除ではなく理由付き（removedReason: downgraded/purchased/expired）で記録され、履歴として追跡できる | Runtime State / Schema design — history-preserving episode structure (D-05/D-06); see Architecture Patterns Pattern 2 and Don't Hand-Roll section |
</phase_requirements>

## Summary

Phase 28 is a **pure extension of an already-proven in-repo pattern**, not new architecture. The `urgency-history.ts` + `write-urgency-history.ts` pure-module/fail-soft-CLI-wrapper split — already shipped twice in this codebase (Phase 25, referenced again in Phase 26/27) — is the direct template for `watchlist.ts` + `write-watchlist.ts`. Zero new npm dependencies are required: `yahoo-finance2` (already installed, already used in Phase 27's `filter-etf-stocks.ts`) supplies both the ETF re-filter and the company-name lookup in a single batched `quote()` call; `zod` is deliberately NOT used (D-19) because this file is TS-self-generated, not LLM output.

The core design decision — already locked by CONTEXT.md — is that `data/watchlist.json` is a **ticker-keyed current-state table**, not a date-keyed append-only log like `urgency-history.json`. This is the single most important architectural distinction the planner must preserve: every reader (this phase's own prune logic, and future Phase 29/30 consumers) needs "what's active right now" to be a cheap, direct lookup, not a reconstruction across historical date keys. The removal policy (three triggers: downgraded, purchased, expired) must be designed in the same phase as the admission policy — CONTEXT.md's decisions already resolve the two genuinely open product-behavior questions research flagged (the 30-calendar-day expiry threshold, and the history-preservation requirement for re-admission) so the planner does not need to re-derive them, only implement them.

**Primary recommendation:** Build `src/portfolio/watchlist.ts` (pure: `admitBullishStocks`, `pruneWatchlist`, `isValidDateKey`-reuse, `EXPIRY_CALENDAR_DAYS` constant) + `src/scripts/write-watchlist.ts` (fail-soft CLI wrapper doing the single batch `quote()` call, readFile/writeFile, `[STEP:watchlist:*]` markers), wired into `invest.md` immediately after Step 2g's `filter-etf-stocks.ts` → `validate-meeting.ts` sequence, using an entry schema where each ticker key holds one active episode plus an array of past removal episodes (satisfying D-05/D-06's history-preservation requirement without a second file).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Watchlist admission (bullish ticker → state table) | Backend / Pipeline Script (TS) | — | Pure TS decision, no LLM involvement, reads finalized `tmp/meeting-result.json` |
| ETF defensive re-filter inside admission | Backend / Pipeline Script (TS) | — | Second independent gate reusing Phase 27's pure function; never delegated to LLM self-report |
| Downgrade/purchase/expiry pruning | Backend / Pipeline Script (TS) | — | All three triggers are fully TS-deterministic per requirements (no LLM judgment involved in this phase) |
| Company name enrichment (name/nameJa) | Backend / Pipeline Script (TS) | External API (Yahoo Finance) | Piggybacks on the same batch `quote()` call already needed for ETF re-filtering — zero marginal API cost |
| Persisted state storage | Database / Storage (flat file) | — | `data/watchlist.json`, mirrors `data/urgency-history.json`; no DB needed at this project's scale |
| Pipeline orchestration / STEP markers | Backend / Pipeline Script (invest.md orchestration) | — | New Step inserted between Step 2g and Step 3-P per D-15; fail-soft contract identical to existing Step 3f |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `yahoo-finance2` | 3.13.2 (installed; see Version Verification note below) | Batch `quote()` call for ETF re-filter (`quoteType`) + company name (`longName`/`shortName`) in one call | Already the project's sole market-data client; Phase 27's `filter-etf-stocks.ts` already demonstrates the exact batch-call idiom to copy verbatim |
| Node `fs/promises` (built-in) | Node runtime version installed | `readFile`/`writeFile`/`mkdir` for `data/watchlist.json` persistence | Zero-dependency persistence, mirrors `write-urgency-history.ts` exactly; no ORM/DB warranted at this file size (bounded to dozens of entries by D-08 expiry) |
| `tsx` | 4.21.0 (installed) | Execution runtime for the new CLI script | Unchanged existing convention for all `src/scripts/*.ts` |
| `vitest` | 4.1.10 (installed; latest npm registry version 4.0.18 note below) | Unit tests for `watchlist.ts` pure functions | Existing test runner (`urgency-history.test.ts`, `etf-exclusion.test.ts` both use it), `npm test` = `vitest run` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `src/portfolio/etf-exclusion.ts` (`filterEtfStocks`, `QuoteTypeLookup`) | in-repo, Phase 27 deliverable | Second independent ETF gate inside admission (D-21) | Called with lookup results for newly-candidate tickers only (D-22); never modify this module |
| `src/portfolio/holding-news.ts` (`normalizeHoldingSymbol`) | in-repo | Ticker key normalization (trim + toUpperCase) | Reuse directly for watchlist ticker keys — same normalization contract already governs `HoldingEvaluation.symbol` matching |
| `src/portfolio/holdings.ts` (`PORTFOLIO_HOLDINGS`) | in-repo | Canonical purchased-trigger source (D-12) | Read directly, NOT via `tmp/portfolio.json` — this is an explicit correction versus the milestone's literal wording that PITFALLS.md flagged |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Ticker-keyed current-state table (D-01, locked) | Date-keyed append-only log (urgency-history.ts shape) | Rejected by all 4 research passes and CONTEXT.md — forces every reader to reconstruct "currently active" by scanning/deduplicating across dates; breaks the removal-by-reason requirement which needs an explicit per-ticker state transition |
| zod schema validation (D-19, rejected) | Add a zod schema for `WatchlistFile` like `meeting/schemas.ts` does for LLM output | Rejected — this file is TS-self-generated (never touched by an LLM), so alias-hardening has no threat model to defend against; adds complexity with no benefit, inconsistent with `loadUrgencyHistory()`'s zod-free precedent |
| Business-day expiry calculation (D-07, rejected) | Calendar-day expiry (30 days) | Business-day math requires a US+JP holiday calendar dependency for marginal precision gain; calendar-day is deterministic, dependency-free, and the threshold is generous enough (30 days ≈ 20 trading days) that the distinction barely matters at this list size |

**Installation:**
No new packages required — this phase installs nothing. All libraries used are already present in `package.json`.

**Version verification:** Checked via `npm view <pkg> version` against the npm registry (2026-07-15). Installed versions in this repo (`yahoo-finance2@3.13.2`, `zod@4.3.6`, `vitest@4.0.18` per `package.json`) are **behind** the current npm registry latest (`yahoo-finance2@4.0.0`, `zod@4.4.3`, `vitest@4.1.10`). This phase does not require upgrading any of them — it only imports existing, already-used APIs (`quote()`, `QuoteTypeLookup`, `fs/promises`) that are stable across these installed versions. No action needed unless a separate maintenance phase decides to bump dependencies; flagging here only so the planner doesn't mistake "registry shows a newer version" for "this phase needs an upgrade."

## Package Legitimacy Audit

Not applicable — this phase introduces zero new npm packages. All imports are either Node built-ins (`node:fs/promises`, `node:path`, `node:url`) or already-installed, already-imported-elsewhere packages (`yahoo-finance2`). The Package Legitimacy Gate is skipped per its own trigger condition ("every phase that installs external packages").

## Architecture Patterns

### System Architecture Diagram

```
tmp/meeting-result.json (Step 2g output: ETF-free, validated highlightedStocks)
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│ [NEW] Step: write-watchlist.ts (fail-soft CLI, invest.md)       │
│                                                                   │
│  1. Read data/watchlist.json (current state; ENOENT → {})       │
│     ── if JSON malformed → FAIL, preserve file untouched (D-18) │
│  2. Read tmp/meeting-result.json → highlightedStocks + date      │
│  3. Read src/portfolio/holdings.ts → PORTFOLIO_HOLDINGS (D-12)   │
│  4. Batch quote() new-candidate tickers only (D-22)              │
│     → QuoteTypeLookup map + name (longName/shortName)            │
│         │                                                         │
│         ▼                                                         │
│  5. admitBullishStocks(watchlist, highlightedStocks[verdict=強気],│
│       quoteTypeByTicker, today) — pure                            │
│       - re-filters via filterEtfStocks (D-21, 2nd gate)          │
│       - idempotent spread-merge keyed by normalized ticker        │
│         │                                                         │
│         ▼                                                         │
│  6. pruneWatchlist(watchlist, highlightedStocks, PORTFOLIO_       │
│       HOLDINGS, today) — pure, 3 deterministic triggers:          │
│       - downgraded: ticker in watchlist AND today's verdict       │
│         is 中立/弱気 in highlightedStocks                         │
│       - purchased: ticker in watchlist AND ticker ∈ PORTFOLIO_    │
│         HOLDINGS                                                  │
│       - expired: today - lastVerdictDate > EXPIRY_CALENDAR_DAYS   │
│         │                                                         │
│         ▼                                                         │
│  7. Write data/watchlist.json (immutable result)                 │
│  8. console.log size instrumentation (active/removed counts, D-10)│
│  9. console.error [STEP:watchlist:OK] or [STEP:watchlist:FAIL:…] │
└─────────────────────────────────────────────────────────────────┘
        │
        ▼
data/watchlist.json (ticker-keyed current-state table)
        │
        ▼
  [Phase 29: data supply] ← [Phase 30: judgment] ← [Phase 31: report]
  (consume "active tickers" derived from this file — out of scope here)
```

### Recommended Project Structure
```
src/
├── portfolio/
│   ├── watchlist.ts             # NEW — pure: admitBullishStocks, pruneWatchlist,
│   │                             #       isValidDateKey (reuse or re-export),
│   │                             #       EXPIRY_CALENDAR_DAYS constant
│   ├── watchlist.test.ts        # NEW — unit tests (admit/prune/idempotency/expiry boundary)
│   ├── etf-exclusion.ts         # UNCHANGED — reused as-is (filterEtfStocks, QuoteTypeLookup)
│   ├── holdings.ts               # UNCHANGED — PORTFOLIO_HOLDINGS read for purchased trigger
│   └── holding-news.ts           # UNCHANGED — normalizeHoldingSymbol reused for ticker keys
├── scripts/
│   ├── write-watchlist.ts       # NEW — fail-soft CLI wrapper (batch quote(), I/O, STEP markers)
│   └── write-urgency-history.ts # UNCHANGED — pattern reference only
data/
└── watchlist.json                # NEW — ticker-keyed current-state table
.claude/commands/
└── invest.md                     # MODIFY — insert new step after Step 2g, before Step 3-P
```

### Pattern 1: Pure Module + Fail-Soft CLI Wrapper (persistence pattern — DIRECT TEMPLATE)

**What:** Business logic (`admitBullishStocks`, `pruneWatchlist`) lives in a pure, synchronous, throw-free module. A separate thin script does all I/O and is the only place that can `process.exit(1)`, only after emitting a `[watchlist] FAIL: <reason>` stderr line that `invest.md` surfaces as `[STEP:watchlist:FAIL:...]`.
**When to use:** This is the exact shape of the entire Phase 28 deliverable.
**Example (verified against actual in-repo source):**
```typescript
// Source: src/portfolio/urgency-history.ts (this repo, verified) — template to mirror exactly
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
```typescript
// Source: src/scripts/write-urgency-history.ts (this repo, verified) — ENOENT double-check
// to copy verbatim into write-watchlist.ts's loader function
const isMissing =
  (error as NodeJS.ErrnoException).code === "ENOENT" ||
  (error instanceof Error && error.message.includes("ENOENT"));
return isMissing ? { history: {}, corrupted: false } : { history: {}, corrupted: true };
```

### Pattern 2: Two-Layer ETF Defense (second independent gate)

**What:** Even though `tmp/meeting-result.json` has already been ETF-filtered by Phase 27's `filter-etf-stocks.ts` (Step 2g, before `validate-meeting.ts`), the watchlist admission function independently re-applies `filterEtfStocks` to whatever candidates it receives.
**When to use:** Inside `admitBullishStocks()`, always — even though in the current pipeline shape the input is already ETF-free by the time it arrives, per D-21 this is deliberate defense-in-depth against future code paths that might feed candidates from elsewhere.
**Example (verified against actual in-repo source, Phase 27 deliverable):**
```typescript
// Source: src/portfolio/etf-exclusion.ts (this repo, verified, Phase 27)
export function filterEtfStocks(
  stocks: MeetingResult["highlightedStocks"],
  quoteTypeByTicker: ReadonlyMap<string, QuoteTypeLookup>,
): EtfExclusionResult {
  // returns { kept, excluded } — kept = quoteType === "EQUITY", excluded = fail-closed
}
```
Call it a second time inside `admitBullishStocks`, passing only the batch-quote results for tickers that are candidates for *new* admission (D-22 — no need to re-verify already-active entries).

### Pattern 3: Ticker-Keyed Current-State Table with Episode History (schema design for D-05/D-06)

**What:** Each ticker key holds the **current episode** (if active) plus a **history array of past removal episodes**, so re-admission after removal creates a new current episode without destroying the old removal record.
**When to use:** This satisfies WLST-05 ("removed entries persist as history") and D-05 ("re-admission is a new episode, doesn't erase the old removal record") simultaneously, while keeping "what's currently active" a trivial single-field check (satisfies D-06's "active-list derivation must be simple" requirement for Phase 29/30 consumers).
**Example (illustrative — exact field names/shape are Claude's discretion per D-03/D-06):**
```typescript
// Illustrative schema satisfying D-01 through D-06 — NOT prescriptive on exact naming,
// but the shape (ticker key → { active?, history[] }) is the recommended structure.
export interface WatchlistRemovalEpisode {
  readonly addedDate: string;        // YYYY-MM-DD
  readonly lastVerdictDate: string;  // YYYY-MM-DD
  readonly removedReason: "downgraded" | "purchased" | "expired"; // D-02 canonical enum
  readonly removedDate: string;      // YYYY-MM-DD
}

export interface WatchlistEntry {
  readonly ticker: string;
  readonly name?: string;    // D-04, from batch quote() longName/shortName
  readonly nameJa?: string;  // D-04, optional — may be absent if lookup provides no JP name
  // Active episode fields — present only while the ticker is currently on the watchlist:
  readonly addedDate?: string;
  readonly lastVerdictDate?: string;
  // Removal history — every past episode's removal is preserved here, oldest to newest:
  readonly history: ReadonlyArray<WatchlistRemovalEpisode>;
}

export type WatchlistFile = Record<string, WatchlistEntry>; // keyed by normalizeHoldingSymbol(ticker)

// "Is this ticker currently active?" — trivial derivation for Phase 29/30 consumers (D-06):
function isActive(entry: WatchlistEntry): boolean {
  return entry.addedDate !== undefined;
}
```
**Alternative shape Claude may choose instead (also satisfies D-06):** a flat array of episodes per ticker (`Record<ticker, WatchlistEpisode[]>`) where the *last* episode with no `removedReason` is "active." Either shape is acceptable; the planner should pick one and document the choice, since Phase 29/30 will depend on whatever "active ticker list" derivation function this phase exports.

### Anti-Patterns to Avoid

- **Date-keyed watchlist storage (Anti-Pattern from ARCHITECTURE.md):** Do NOT copy `urgency-history.ts`'s `Record<dateKey, snapshot[]>` shape for the watchlist. The watchlist has membership lifecycle (added → active → removed), not a daily observation log; a date-keyed shape forces every reader to reconstruct "currently active" by scanning/deduplicating across all historical keys.
- **Trusting `tmp/portfolio.json` for the purchased trigger:** PITFALLS.md explicitly flags this as a gotcha — the milestone's literal wording implies `data/` for portfolio holdings, but the actual canonical source per D-12 is the static `src/portfolio/holdings.ts` `PORTFOLIO_HOLDINGS` constant, not a `tmp/` runtime artifact.
- **Fail-open on `quoteType` lookup failure during re-admission's ETF gate:** Must fail-closed (exclude the candidate) exactly like Phase 27's `filterEtfStocks` does — a silent "allow on lookup failure" defeats the entire ETF exclusion feature invisibly.
- **Making this pipeline step hard-fail the whole run:** Must follow the `write-urgency-history.ts` / Step 3f contract — `[STEP:watchlist:FAIL:...]`, never `[PIPELINE:FAIL]` (D-16).
- **Erasing/overwriting removal history on re-admission:** D-05 explicitly forbids this — a re-admitted ticker's new active episode must be added alongside, not instead of, its prior removal record(s).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| ETF/equity classification | Ticker-name regex or `.T`-suffix heuristics | `filterEtfStocks()` + `quoteType` from `yahoo-finance2` (already built, Phase 27) | JP ETFs/REITs also carry `.T` — suffix alone cannot distinguish; `quoteType` is the deterministic ground truth already verified live against US+JP tickers |
| Same-day re-run duplicate prevention | A separate guard file / lockfile | Spread-merge on ticker key (same pattern as `appendUrgencySnapshot`) | Object key assignment is structurally idempotent — re-running the same day just re-assigns the same key, no separate guard needed (D-17) |
| Calendar-day arithmetic for expiry | Manual date-string parsing/subtraction | `Date` object diff in milliseconds, or a tiny date-diff utility — but NOT a business-day/holiday-aware library | D-07 explicitly chose calendar days over trading days to avoid a holiday-calendar dependency; keep the diff logic dead simple |
| Company name lookup for new watchlist entries | A second API call to fetch company profile data | Reuse the same batch `quote()` response already needed for `quoteType` (D-04, D-22) — `longName`/`shortName` fields are present in the same response | Avoids doubling API calls / rate-limit pressure (Pitfall 3 from PITFALLS.md) |

**Key insight:** Every "hard" problem in this phase already has a proven, tested, in-repo solution from Phase 25/27. The planner's job is composition and correct sequencing, not invention.

## Runtime State Inventory

> Not applicable — this is a greenfield feature phase (new file `data/watchlist.json`, new module, new script), not a rename/refactor/migration. No existing runtime state references the strings/keys this phase introduces.

## Common Pitfalls

### Pitfall 1: Fail-open ETF filter on lookup failure during watchlist admission

**What goes wrong:** If the batch `quote()` call fails or a ticker isn't in the response, defaulting to "admit anyway" silently reintroduces ETFs into the watchlist even though Phase 27 already filtered `tmp/meeting-result.json` upstream.
**Why it happens:** It's tempting to treat "already filtered upstream" as sufficient and skip the defensive re-check, or to treat a lookup miss as "unknown, so allow."
**How to avoid:** Exactly mirror `filterEtfStocks`'s fail-closed behavior (D-01 pattern from Phase 27) inside `admitBullishStocks` — any candidate without an "ok" `QuoteTypeLookup` entry is excluded from admission, not admitted.
**Warning signs:** A ticker with `quoteType !== "EQUITY"` appearing in `data/watchlist.json`.

### Pitfall 2: Unbounded watchlist growth if the expiry trigger is implemented incorrectly

**What goes wrong:** If `lastVerdictDate` is not correctly updated every time a ticker is reconfirmed bullish (only updated on *initial* admission), tickers that are genuinely re-confirmed bullish daily would incorrectly expire after 30 days even though they're still actively bullish.
**Why it happens:** Conflating `addedDate` (set once, on first admission) with `lastVerdictDate` (must be updated on every day the ticker reappears with `verdict: 強気`) is an easy off-by-one-field bug.
**How to avoid:** `admitBullishStocks` must update `lastVerdictDate` to `today` for tickers already on the watchlist that reappear as 強気 today, not just for brand-new admissions. Test this explicitly (existing-entry-reconfirmation case, not just brand-new-entry case).
**Warning signs:** A ticker mentioned as 強気 every single day still shows an `lastVerdictDate` from weeks ago; the ticker expires despite continuous reconfirmation.

### Pitfall 3: Same-day double-processing when both admission and pruning run against a ticker with mixed signals

**What goes wrong:** If a ticker is both newly admitted (verdict 強気 today) AND already in `PORTFOLIO_HOLDINGS` (purchased), the order of admit-then-prune vs. prune-then-admit determines the final state — get this wrong and a just-purchased stock could be re-admitted right after being pruned, or vice versa.
**Why it happens:** `admitBullishStocks` and `pruneWatchlist` are separate pure functions; composing them in the wrong order for edge cases (ticker satisfies both an admission and a removal condition on the same day) produces inconsistent results depending on call order.
**How to avoid:** Decide and document a clear precedence (e.g., "prune runs first using yesterday's active list + today's signals, then admit runs on the pruned result" — since a ticker that's now in `PORTFOLIO_HOLDINGS` should never be re-admitted even if it also scored 強気 today, purchased should take precedence over admission). Write an explicit test case for "ticker is both 強気 today AND already purchased."
**Warning signs:** A ticker appears in `data/watchlist.json` as active despite already being in `PORTFOLIO_HOLDINGS`.

### Pitfall 4: JSON corruption handling accidentally discards the whole file instead of skipping the update

**What goes wrong:** A naive `try { JSON.parse } catch { return {} }` treats "file is corrupted" identically to "file doesn't exist," silently replacing months of accumulated watchlist history with an empty object on the next write.
**Why it happens:** The distinction between ENOENT (missing — safe to initialize empty) and a parse/schema error (corrupted — must NOT overwrite) is easy to collapse into one catch block if not deliberately separated, exactly as Phase 25's own commit history shows this bug was caught and fixed once already (`loadExistingHistory`'s two-branch design).
**How to avoid:** Copy the exact two-branch `isMissing` check from `write-urgency-history.ts`'s `loadExistingHistory()` verbatim (D-18) — ENOENT → `{}`  and continue; anything else → `corrupted: true` → FAIL without writing.
**Warning signs:** `data/watchlist.json` unexpectedly shrinks to `{}` after a run where the file previously had entries and no `[STEP:watchlist:FAIL:...]` was logged.

## Code Examples

Verified patterns from official in-repo sources (all directly inspected, not training-data recall):

### Batch quote() call reused verbatim for name + quoteType (Phase 27 template)
```typescript
// Source: src/scripts/filter-etf-stocks.ts (this repo, verified)
async function fetchQuoteTypes(
  tickers: ReadonlyArray<string>,
): Promise<ReadonlyMap<string, QuoteTypeLookup>> {
  const result = new Map<string, QuoteTypeLookup>();
  if (tickers.length === 0) return result;

  const quotes = await yahooFinance.quote([...tickers]);
  const quoteArray = Array.isArray(quotes) ? quotes : [quotes];
  for (const q of quoteArray) {
    const symbol = (q as { symbol?: string }).symbol;
    const quoteType = (q as { quoteType?: string }).quoteType;
    if (symbol && quoteType) {
      result.set(symbol, { status: "ok", quoteType });
    }
  }
  return result;
}
// For Phase 28: extend this to also capture (q as { longName?: string; shortName?: string })
// in the same loop — zero additional API calls (D-04, D-22 "1コール2役").
```

### ENOENT double-check for loading existing state (Phase 25 template, MUST copy exactly)
```typescript
// Source: src/scripts/write-urgency-history.ts (this repo, verified)
async function loadExistingHistory(): Promise<{ history: UrgencyHistoryFile; corrupted: boolean }> {
  try {
    const raw = await readFile(HISTORY_PATH, "utf-8");
    return { history: JSON.parse(raw) as UrgencyHistoryFile, corrupted: false };
  } catch (error) {
    const isMissing =
      (error as NodeJS.ErrnoException).code === "ENOENT" ||
      (error instanceof Error && error.message.includes("ENOENT"));
    return isMissing ? { history: {}, corrupted: false } : { history: {}, corrupted: true };
  }
}
```

### dateKey sourced from meeting-result.json, never re-derived (Phase 25 D-05 template)
```typescript
// Source: src/scripts/write-urgency-history.ts (this repo, verified)
const meetingRaw = await readFile(join(TMP_DIR, "meeting-result.json"), "utf-8");
const { date: dateKey } = JSON.parse(meetingRaw) as { date: string };

if (!isValidDateKey(dateKey)) {
  console.error(`[urgency-history] FAIL: 不正なdateキー形式: ${dateKey}`);
  process.exit(1);
  return;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| N/A — Phase 28 is a net-new feature | Ticker-keyed current-state table with episode history | Locked in CONTEXT.md 2026-07-15 (D-01 through D-23) | No prior watchlist implementation existed in this codebase; this establishes the pattern going forward |

**Deprecated/outdated:**
- None — this is greenfield within an established codebase convention set, not a migration from a prior implementation.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `yahoo-finance2`'s batch `quote()` response includes `longName`/`shortName` fields reliably for both US and JP tickers | Standard Stack, Code Examples | If name fields are frequently absent for JP tickers, D-04's "name via same call" assumption degrades to frequent ticker-only fallback — acceptable per D-04's own explicit fallback design, so risk is low, but worth spot-checking during implementation with a live JP ticker (e.g. an existing PORTFOLIO_HOLDINGS `.T` symbol) |
| A2 | The npm registry "latest" versions checked (`yahoo-finance2@4.0.0`, `zod@4.4.3`, `vitest@4.1.10`) do not introduce breaking changes relevant to the APIs this phase uses (`quote()`, `fs/promises`) | Standard Stack | Low risk — this phase does not upgrade any dependency, only imports already-used, already-installed APIs; flagged only for completeness per the research protocol's version-verification requirement |

**If this table is empty:** N/A — two low-risk assumptions logged above; neither blocks planning.

## Open Questions (RESOLVED)

1. **Exact WatchlistEntry/WatchlistFile shape (episode array vs. active+history object)**
   - What we know: D-06 explicitly leaves this to Claude's discretion, constrained by two requirements (simple active-list derivation; history preserved in the same file)
   - What's unclear: Whether Phase 29/30 will have a strong preference for one shape over the other once their own research begins
   - Recommendation: Pick the "active fields + history array" shape shown in Pattern 3 above (simpler `isActive()` check than scanning an episode array for "the last one without removedReason") and export a named `getActiveWatchlistEntries()` function so Phase 29/30 depend on a stable function signature, not directly on the JSON shape — this insulates future phases from a shape change if Phase 28's implementation is later revised.

2. **Precedence when a ticker satisfies both an admission signal and a removal signal on the same day (Pitfall 3 above)**
   - What we know: The three removal triggers (downgraded, purchased, expired) and the one admission trigger (verdict 強気 today) are all independently well-specified
   - What's unclear: The exact operation order (prune-then-admit vs. admit-then-prune) isn't specified in CONTEXT.md
   - Recommendation: Prune first (using yesterday's state + today's signals), then admit on the pruned result — this guarantees "purchased" and "downgraded" always take precedence over "still bullish today," which matches investor intent (a stock just bought should never simultaneously appear as an active watchlist candidate). Document this explicit ordering decision in the plan.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js runtime | All TS execution via `tsx` | ✓ | (project already runs on this machine daily via launchd) | — |
| `yahoo-finance2` (installed) | Batch quote() for ETF re-filter + name enrichment | ✓ | 3.13.2 | — |
| Network access to Yahoo Finance endpoints | Batch quote() call | Assumed ✓ (same endpoint Phase 27 already depends on in production) | — | Fail-soft: on quote() failure, `write-watchlist.ts` should FAIL the step (D-18-style, preserve existing file) rather than admit tickers without ETF verification |
| `data/` directory write access | Persisting `data/watchlist.json` | ✓ (already exists, holds `urgency-history.json`) | — | — |

**Missing dependencies with no fallback:** None identified.
**Missing dependencies with fallback:** Network failure during batch quote() — fallback is fail-soft STEP failure preserving the existing file (already the designed behavior per D-18, not a gap).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.0.18 (installed; `vitest run` via `npm test`) |
| Config file | none detected — vitest runs with zero-config defaults against `*.test.ts` files colocated with source (existing convention: `src/portfolio/urgency-history.test.ts`, `src/portfolio/etf-exclusion.test.ts`) |
| Quick run command | `npx vitest run src/portfolio/watchlist.test.ts` |
| Full suite command | `npm test` (runs `vitest run` across the whole repo) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WLST-01 | New 強気 ticker (ETF-free) is admitted with addedDate/lastVerdictDate = today | unit | `npx vitest run src/portfolio/watchlist.test.ts -t admitBullishStocks` | ❌ Wave 0 |
| WLST-01 | Same-day re-run does not duplicate or change addedDate (idempotency) | unit | `npx vitest run src/portfolio/watchlist.test.ts -t idempotent` | ❌ Wave 0 |
| WLST-01 | ETF candidate ticker rejected by defensive second gate even if upstream missed it | unit | `npx vitest run src/portfolio/watchlist.test.ts -t "ETF"` | ❌ Wave 0 |
| WLST-01 | Lookup-failed candidate ticker is fail-closed excluded from admission | unit | `npx vitest run src/portfolio/watchlist.test.ts -t "lookup"` | ❌ Wave 0 |
| WLST-02 | Active ticker with today's verdict 中立/弱気 in highlightedStocks becomes removedReason:downgraded | unit | `npx vitest run src/portfolio/watchlist.test.ts -t downgraded` | ❌ Wave 0 |
| WLST-02 | Active ticker with NO mention in today's highlightedStocks stays active (lastVerdictDate unchanged) | unit | `npx vitest run src/portfolio/watchlist.test.ts -t "no mention"` | ❌ Wave 0 |
| WLST-03 | Active ticker present in PORTFOLIO_HOLDINGS becomes removedReason:purchased | unit | `npx vitest run src/portfolio/watchlist.test.ts -t purchased` | ❌ Wave 0 |
| WLST-04 | Active ticker with lastVerdictDate exactly EXPIRY_CALENDAR_DAYS+1 days old expires | unit | `npx vitest run src/portfolio/watchlist.test.ts -t expired` | ❌ Wave 0 |
| WLST-04 | Active ticker with lastVerdictDate exactly EXPIRY_CALENDAR_DAYS days old does NOT expire (boundary) | unit | `npx vitest run src/portfolio/watchlist.test.ts -t boundary` | ❌ Wave 0 |
| WLST-04 | Ticker reconfirmed 強気 today has lastVerdictDate reset to today, avoiding false expiry | unit | `npx vitest run src/portfolio/watchlist.test.ts -t reconfirm` | ❌ Wave 0 |
| WLST-05 | Removed entry (any of 3 reasons) preserves removedReason + removedDate in history, is not deleted | unit | `npx vitest run src/portfolio/watchlist.test.ts -t history` | ❌ Wave 0 |
| WLST-05 | Re-admission after removal creates a new active episode without erasing prior removal history | unit | `npx vitest run src/portfolio/watchlist.test.ts -t re-admission` | ❌ Wave 0 |
| D-18 (fail-soft) | ENOENT on data/watchlist.json initializes empty state and continues normally | unit | `npx vitest run src/scripts/write-watchlist.test.ts -t ENOENT` | ❌ Wave 0 |
| D-18 (fail-soft) | Malformed JSON in data/watchlist.json causes FAIL without overwriting the file | unit | `npx vitest run src/scripts/write-watchlist.test.ts -t corrupted` | ❌ Wave 0 |
| D-16 (STEP markers) | Successful run emits `[STEP:watchlist:OK]`; failure emits `[STEP:watchlist:FAIL:<reason>]`, never `[PIPELINE:FAIL]` | smoke / manual | Run `npx tsx src/scripts/write-watchlist.ts` against fixture tmp/ files, grep stderr | ❌ Wave 0 (script itself) |

### Sampling Rate
- **Per task commit:** `npx vitest run src/portfolio/watchlist.test.ts` (and `src/scripts/write-watchlist.test.ts` once created)
- **Per wave merge:** `npm test` (full suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/portfolio/watchlist.test.ts` — covers WLST-01, WLST-02, WLST-03, WLST-04, WLST-05
- [ ] `src/scripts/write-watchlist.test.ts` — covers D-16, D-18 fail-soft/ENOENT/corruption paths (mirror `write-urgency-history.ts`'s test conventions if such a test file exists; if not, mirror `filter-etf-stocks.ts`'s CLI-wrapper testing approach)
- [ ] No new framework install needed — vitest already configured and running (`npm test`)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No | Single-user local pipeline, no auth surface introduced |
| V3 Session Management | No | Not applicable — batch CLI script, no sessions |
| V4 Access Control | No | Local file system only, no multi-tenant access control needed |
| V5 Input Validation | Yes | `isValidDateKey` regex validation on dateKey before use as an object key (prototype-pollution defense, same as `urgency-history.ts`'s existing `__proto__` test case); ticker normalization via `normalizeHoldingSymbol` |
| V6 Cryptography | No | No secrets/crypto surface in this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Prototype pollution via untrusted object key (`__proto__`, `constructor`, etc.) used as a ticker or date key when merging into `WatchlistFile` | Tampering | `isValidDateKey` regex validation (reused from `urgency-history.ts`, already has an explicit `__proto__ → false` test case); apply the same discipline to ticker keys via `normalizeHoldingSymbol` + a reasonable ticker-format check before using as an object key |
| Fail-open security-relevant filter (ETF exclusion) on external API failure | Tampering / Repudiation (silent policy bypass) | Fail-closed on `quoteType` lookup failure, exactly as Phase 27's `filterEtfStocks` already implements — treat this as a security-relevant control, not just a data-quality nicety, since bypassing it silently reintroduces excluded instrument types |
| Data corruption / partial write of `data/watchlist.json` destroying accumulated history | Tampering (integrity) | Two-branch ENOENT-vs-corrupted check (D-18) ensures a corrupted file is never silently overwritten with an empty object — the FAIL path preserves the existing file on disk |

## Sources

### Primary (HIGH confidence)
- Direct inspection of `.planning/phases/28-watchlist-persistence/28-CONTEXT.md` — all 23 locked decisions (D-01 through D-23)
- Direct inspection of `.planning/REQUIREMENTS.md` — WLST-01 through WLST-05 canonical definitions
- Direct inspection of `.planning/STATE.md` — v2.7 roadmap decisions, phase sequencing rationale
- Direct inspection of `.planning/research/SUMMARY.md`, `ARCHITECTURE.md`, `PITFALLS.md`, `FEATURES.md` — v2.7 milestone research (all dated 2026-07-15, HIGH/MEDIUM confidence per their own metadata)
- Direct inspection of `src/portfolio/urgency-history.ts`, `src/scripts/write-urgency-history.ts` — the exact pure-module/fail-soft-CLI-wrapper template this phase mirrors
- Direct inspection of `src/portfolio/etf-exclusion.ts`, `src/scripts/filter-etf-stocks.ts` — Phase 27 deliverables reused directly (D-21〜23)
- Direct inspection of `src/portfolio/holdings.ts` (`PORTFOLIO_HOLDINGS`), `src/portfolio/holding-news.ts` (`normalizeHoldingSymbol`)
- Direct inspection of `src/meeting/types.ts` (`MeetingResult.highlightedStocks` verdict enum: 強気/中立/弱気)
- Direct inspection of `.claude/commands/invest.md` Step 2f/2g region and Step 4 `git add docs/ docs_old/ data/` line
- Direct inspection of `src/portfolio/urgency-history.test.ts`, `src/portfolio/etf-exclusion.test.ts` — test mock conventions
- `npm view yahoo-finance2 version`, `npm view zod version`, `npm view vitest version` (registry check, 2026-07-15)

### Secondary (MEDIUM confidence)
- None beyond what's already embedded in the cited v2.7 research files above (this research pass is primarily internal/codebase-verification, not external ecosystem lookup)

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - zero new dependencies; all APIs directly verified against installed package source and existing call sites in this repo
- Architecture: HIGH - directly verified against current codebase (internal architecture-extension question, not external ecosystem lookup); CONTEXT.md has already locked all genuinely open design questions
- Pitfalls: HIGH for project-specific pitfalls (grounded in direct code/history inspection); MEDIUM for the general "watchlist growth" pattern (inherited from v2.7 milestone research, itself flagged MEDIUM confidence there)

**Research date:** 2026-07-15
**Valid until:** 30 days (stable internal architecture-extension; no external ecosystem churn risk since zero new dependencies)

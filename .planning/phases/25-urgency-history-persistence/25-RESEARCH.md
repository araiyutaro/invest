# Phase 25: Urgency History Persistence - Research

**Researched:** 2026-07-04
**Domain:** TypeScript pure-function data extraction/merge + Node.js fs I/O + git-based JSON persistence (no DB, no new packages)
**Confidence:** HIGH

## Summary

This phase adds a small, self-contained persistence layer on top of data that already exists: `HoldingEvaluation.urgent` / `.decision`, produced daily by the existing portfolio-analyst pipeline step and written to `tmp/portfolio-analysis.json`. There is no new LLM call, no new schema for LLM output, and no new external package. The work is a direct structural transplant of patterns the codebase already uses three times over (`holding-news.ts`, `decision-diff.ts`, `digest-crossref.ts` for pure-function design; `update-index.ts`'s `mergeEntry` for same-key-wins merge; `write-news-digest.ts`'s `main()` for the fail-soft CLI-wrapper-with-STEP-marker shape).

All 14 locked decisions in `25-CONTEXT.md` are internally consistent and map cleanly onto existing code shapes. The one area requiring independent verification (not covered by CONTEXT.md) is the **Step 4 git integration**: extending `git add docs/` to `git add docs/ data/` is unsafe if `data/` does not exist on disk at the moment that command runs, because `git add` on a non-existent pathspec exits non-zero and would abort the entire deploy step (verified empirically below, HIGH confidence). This is the single most important pitfall for the planner to design around; the fix is simple (unconditional `mkdir` before any conditional logic) but must not be skipped.

**Primary recommendation:** Implement `src/portfolio/urgency-history.ts` as a pure-function module (`extractUrgencySnapshots`, `appendUrgencySnapshot`, `isValidDateKey`) mirroring `holding-news.ts`'s no-throw/no-I/O/full-key-retention style, driven by a thin CLI wrapper `src/scripts/write-urgency-history.ts` that unconditionally `mkdir`s `data/` as its first statement (before any skip/fail branch), derives `dateKey` from `tmp/meeting-result.json` (not from `portfolioAnalysis.date` or JST re-derivation) to guarantee alignment with the Step 4 deploy date, and reuses the exact `main()`/STEP-marker/exit-code shape of `write-news-digest.ts`.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**履歴ファイルのスキーマ形状（History schema shape）**
- **D-01:** `data/urgency-history.json` のトップレベルは**日付キーのオブジェクト** `Record<"YYYY-MM-DD", HoldingUrgencySnapshot[]>` とする（例: `{ "2026-07-04": [ ... ], "2026-07-03": [ ... ] }`）。日付キーの単純代入で同日上書きが構造的に保証され、Phase 26 の日付フィルタ（直近7日）も自然に行える。update-index.ts の `mergeEntry`（新しい日付が勝つ）と同じ「date-keyed / new date wins」思想の object 版。
- **D-02:** 各スナップショットエントリは**最小4フィールド** `{ symbol, nameJa, urgent, decision }` とする。すべて `tmp/portfolio-analysis.json` の `HoldingEvaluation`（`symbol`/`nameJa`/`urgent: boolean`/`decision: "保持"|"買増"|"一部売却"|"全売却"`）から決定論的に抽出する。`rationale`/`riskNote`/`previousDecision`/`decisionChanged` は保存しない（履歴には生の日次状態のみを焼き込み、判断変更の計算は Phase 26 の読み取り側で日付間 decision 比較として行う。previousDecision を焼き込むと二重情報源になる）。
- **D-03:** 履歴は **append-only**（剪定なし）。全12保有銘柄を毎日保存する（`urgent: false` の銘柄も含む）。Phase 26 が「今週どの銘柄が緊急フラグ/判断変更の対象になったか」を出すには、全銘柄の日次 `urgent` 状態と `decision` の連続スナップショットが必要なため。

**同日再実行ガードの実装方式（Same-day guard mechanism）**
- **D-04:** 同日ガードは **TS 純関数側で日付キー上書き**として実装する。純関数 `appendUrgencySnapshot(history, dateKey, snapshots)` が `history` の当該 `dateKey` を上書きした**新しいオブジェクト**を返す（イミュータブル: `{ ...history, [dateKey]: snapshots }`）。object の同一キー代入なので重複は構造的に不可能。update-index.ts の `mergeEntry` の filter-and-append と同じ「同日は上書き」思想を object map で表現。
- **D-05:** 日付キー（`dateKey`）の導出は invest.md Step 3d の退避スニペットと**同一方式**で JST 基準とする: `new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)`。ただし本フェーズでは meeting-result.json の `date`（既に Step 4 デプロイでシェルインジェクション対策済みの正準日付）を単一情報源として優先利用する方が整合的。planner は「meeting-result.json の date を使う」か「JST 再導出」かを既存パターンとの整合で確定してよいが、**docs/ 配下の日付ディレクトリ・デプロイコミットの date と必ず一致させる**こと（同日判定の基準を揃える）。
- **D-06:** 日付文字列は書き込み前に `/^\d{4}-\d{2}-\d{2}$/` で検証する（Step 4 デプロイの date バリデーションと同方針。不正 date キーで履歴を汚染しない）。不正時はその日の追記をスキップし FAIL マーカーを出す。

**統合ポイント・型・fail-soft 隔離（Integration & fail-soft）**
- **D-07:** 抽出・マージロジックは**新規の純関数モジュール** `src/portfolio/urgency-history.ts` に実装する（holding-news.ts / digest-crossref.ts のファイル配置・純関数・副作用なし・throwしない設計を踏襲、`.test.ts` 併置）。純関数: `extractUrgencySnapshots(analysis: PortfolioAnalysis): HoldingUrgencySnapshot[]`（holdings から4フィールド抽出）と `appendUrgencySnapshot(history, dateKey, snapshots)`（D-04）。I/O は含めない。
- **D-08:** ファイル I/O は**薄い CLI ラッパースクリプト** `src/scripts/write-urgency-history.ts` が担当する: `tmp/portfolio-analysis.json` を読み込み → 純関数で抽出・マージ → `data/urgency-history.json` に書き出し（既存ファイルが無ければ空 `{}` から開始、`data/` ディレクトリは `mkdir -p` 相当で自動生成）。generate-report.ts には相乗りしない（関心の分離 = many small files。デプロイ前の独立ステップとして分離実行できる方が fail-soft 隔離が明快）。
- **D-09:** invest.md に**専用パイプラインステップ**を追加する（news-digest の Step 3e より後、Step 4 デプロイより前が自然。planner が既存ステップ番号採番に合わせて確定 — 例 Step 3f）。**専用の STEP マーカー** `[STEP:urgency-history:OK]` / `[STEP:urgency-history:FAIL:...]` で成否を可視化する。`[PIPELINE:FAIL]` は絶対に出力しない（Phase 24 / OPS-04 と同方針: この失敗は4レポート・デプロイをブロックしない）。
- **D-10:** シンボルは holding-news.ts の `normalizeHoldingSymbol`（trim + toUpperCase、内部文字不変）と同方式で正規化してから保存する（米国ティッカーと日本株 `8522.T` 等の表記揺れを構造的に吸収し、Phase 26 の日付間銘柄突合を安定させる）。既存関数の再利用 or 同一実装は planner が判断。

**git 永続化の統合（Git persistence integration）**
- **D-11:** `data/urgency-history.json` は既存の Step 4 デプロイの git フローに**相乗り**させる。`git add docs/` を `git add docs/ data/` に拡張し、既存の変更検知（`git diff --staged --quiet`）・commit（`report: {date} daily update`）・push（origin master）経路をそのまま流用する（新規のコミット/プッシュ経路は作らない。docs + data が1コミットにまとまる）。
- **D-12:** `data/` は `.gitignore` で無視されていない（`tmp/` のみ無視。確認済み）ため追加の gitignore 設定は不要。履歴は非公開 `data/` 配下のみに置き、公開 `docs/` には一切出さない（Success Criteria #2: 非公開 data/ に永続化、docs/ ではない）。

**空/欠損時のフォールバック（Empty/missing handling）**
- **D-13:** `tmp/portfolio-analysis.json` が読めない、または `holdings` が0件の日は、その日の追記を**スキップ**し既存 history を一切変更しない（分析0件の日は正常系。`[STEP:urgency-history:OK]` を skip ログ付きで出す）。JSON パース失敗・書き込み失敗・不正 date（D-06）のみ `[STEP:urgency-history:FAIL:...]` を出す。いずれの FAIL でもデプロイ（Step 4）はブロックしない。
- **D-14:** 既存 `data/urgency-history.json` の読み込みが破損等で失敗した場合、planner は「空 `{}` から再構築して当日分を書く（履歴喪失リスク）」か「その日はスキップして既存ファイルを保全」かを既存 fail-soft 方針に沿って選ぶ。デフォルトは**既存ファイル保全を優先**（監査履歴を破壊しない側に倒す）とし、パース失敗は FAIL マーカーで可視化する。

### Claude's Discretion
- 専用ステップの正確なステップ番号（Step 3f 等）と STEP マーカー発出箇所（スクリプト内 stderr か invest.md 側 echo か）は、既存の news-digest（Step 3e）/ digest-crossref のパターンに合わせて planner が選択してよい。
- `dateKey` を meeting-result.json の date とするか JST 再導出とするか（D-05）は、docs/ デプロイ日付との一致を満たす範囲で planner が確定してよい。
- `HoldingUrgencySnapshot` 型を新規定義するか `HoldingEvaluation` の Pick 派生とするかは planner が既存型定義スタイルに合わせて判断してよい（保存フィールドは D-02 の4つで固定）。
- 破損 history 読み込み失敗時の再構築 vs 保全（D-14）はデフォルト「保全」だが、planner が既存パターンを踏まえ最終決定してよい。

### Deferred Ideas (OUT OF SCOPE)
- 週次ロールアップの**表示**（portfolio.html への「今週の緊急フラグ履歴」セクション描画）— Phase 26 / HIST-03 の担当（本フェーズ scope 外）
- 履歴の剪定（古いエントリの自動削除・ローテーション）— 現時点は append-only の完全履歴を維持（監査要件）。ファイルサイズが問題になれば将来検討
- `rationale` / `riskNote` など詳細フィールドの履歴保存 — Phase 26 のロールアップに必要になれば D-02 のスキーマ拡張として検討。デフォルトは最小4フィールド（保守的）
- ロールアップの表示（Phase 26）、LLM呼び出し（一切なし）、meeting/portfolio分析スキーマ変更（tmp/portfolio-analysis.json は読み取り専用）、履歴の剪定、緊急度の再計算・差分ロジック（decision-diff.ts が担当済み）

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| HIST-01 | 日次実行ごとに保有銘柄の緊急度フラグ（urgent）と判断（decision）が `data/urgency-history.json` に追記保存され、git commit/push フローで永続化される | `extractUrgencySnapshots` (Code Examples) extracts the 4 fields per holding from the existing `tmp/portfolio-analysis.json`; `write-urgency-history.ts` skeleton persists via `writeFile`; Step 4 `git add docs/ data/` extension (Architecture Patterns, Pitfall 1) wires it into the existing commit/push flow |
| HIST-02 | 同日に複数回実行しても履歴が重複しない（同日エントリは上書き、v2.5 の同日再実行ガードと同方式） | `appendUrgencySnapshot` (Code Examples) — immutable `{ ...history, [dateKey]: snapshots }` — object key assignment makes duplication structurally impossible, mirroring `mergeEntry` in `update-index.ts` |

## Project Constraints (from CLAUDE.md)

From `/Users/arai/invest/.claude/CLAUDE.md` (project) and `~/.claude/CLAUDE.md` (global, applies to all work in this session):

- **GSD command format:** always hyphen (`/gsd-plan-phase`), never colon — applies to any GSD references the planner writes into PLAN.md, not to phase code itself.
- **TDD:** tests are written first, confirmed correct, committed, then implementation follows to make them pass. Every codebase precedent in this domain (`holding-news.test.ts`, `decision-diff.test.ts`, `write-news-digest.test.ts`) is a pre-existing `.test.ts` sibling — the planner should sequence tasks test-file-first per file.
- **Immutability:** never mutate inputs; always return new objects/arrays. `appendUrgencySnapshot`'s `{ ...history, [dateKey]: snapshots }` and `extractUrgencySnapshots`'s `.map(...)` already satisfy this; plans must not introduce `history[dateKey] = snapshots` (in-place mutation).
- **File organization:** many small files, 200-400 lines typical, 800 max. `urgency-history.ts` (2-3 small pure functions) and `write-urgency-history.ts` (thin CLI wrapper) will each land well under 100 lines — no risk of violating this ceiling.
- **Error handling:** comprehensive try/catch with user-friendly messages — matches the existing fail-soft precedent (`loadHoldingNews`, `write-news-digest.ts`'s `main()`) that this phase must replicate.
- **No hardcoded values / no console.log statements (general coding-style checklist):** existing precedent in this exact domain uses `console.warn`/`console.error` (not `console.log`) for machine-readable STEP-marker-adjacent signals (e.g. `[digest-crossref] OK`/`FAIL` via `console.error`) — the planner should follow this convention for `[urgency-history]` internal signals distinct from the `[STEP:urgency-history:*]` markers that invest.md itself echoes.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Extract urgent/decision snapshot from `PortfolioAnalysis` | Backend script (Node/TS, pure function) | — | Deterministic data transform of already-generated LLM output; no I/O, no framework — belongs in `src/portfolio/` alongside `holding-news.ts`/`decision-diff.ts` |
| Same-day overwrite merge into history object | Backend script (Node/TS, pure function) | — | Pure in-memory object operation; same tier as `mergeEntry` in `update-index.ts` |
| Read `tmp/portfolio-analysis.json`, read/write `data/urgency-history.json` | Backend script (Node/TS, CLI I/O wrapper) | — | Filesystem I/O against local JSON files; no network, no DB, no framework boundary crossed |
| Orchestrate step ordering, STEP markers, fail-soft messaging | Pipeline orchestration (invest.md / Claude Code skill) | — | invest.md is the sole orchestration layer for this project; no separate "backend service" tier exists |
| Persist `data/urgency-history.json` to git (commit + push) | Pipeline orchestration (invest.md Step 4, `git`) | — | Already the exclusive integration point for `docs/` persistence; extending it to `data/` avoids a second commit/push code path |
| Future weekly rollup display (Phase 26, out of scope here) | Static HTML generation (`docs/portfolio.html`) | — | Not implemented in this phase; noted only for boundary clarity |

There is no browser/client tier, no SSR tier, no CDN tier, and no database tier in this project — it is a single Node.js CLI pipeline that writes static JSON/HTML artifacts and pushes them via git. All capabilities in this phase live in the "backend script" and "pipeline orchestration" tiers described above.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | ^5.9.3 (existing) | Type-safe pure functions and CLI script | Already the project's sole language; `strict: true` in tsconfig.json |
| Node.js `node:fs/promises` | built-in (Node v24.3.0 runtime `[VERIFIED: node --version]`) | Read `tmp/portfolio-analysis.json`, read/write `data/urgency-history.json`, `mkdir` | Every existing script (`report-data-loaders.ts`, `write-news-digest.ts`, `update-index.ts`) uses this exact built-in; no wrapper library exists or is needed |
| vitest | ^4.0.18 (existing devDependency, confirmed installed: `vitest/4.0.18` `[VERIFIED: npx vitest --version]`) | Unit tests for pure functions and the CLI wrapper's `main()` | `npm test` == `vitest run` (package.json); every `.test.ts` in the codebase uses vitest's `describe/it/expect/vi` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | ^4.4.3 (existing, `npm view zod version` confirms current registry version `[VERIFIED: npm registry]`) | NOT needed for this phase's new code | `PortfolioAnalysis` is already zod-validated by the existing `loadPortfolioAnalysis()`/`portfolioAnalysisSchema` in `report-data-loaders.ts`/`schemas.ts`. `data/urgency-history.json` itself is a **self-generated TS artifact** (not LLM output), so per the existing `loadHoldingNews()` precedent, plain `JSON.parse` + type assertion is the established pattern — zod is reserved for validating untrusted/LLM-shaped input in this codebase, not for round-tripping the project's own deterministic output. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Plain JSON file at `data/urgency-history.json` | SQLite / other embedded DB | Explicitly rejected in `REQUIREMENTS.md` Out of Scope: "12銘柄×日次のデータ量には JSON 追記で十分、既存の tmp/JSON 文化と一貫" — do not introduce a DB dependency |
| Reading `dateKey` from `tmp/meeting-result.json` | Re-deriving JST date via `Date.now() + 9h` (Step 3d pattern) | JST re-derivation risks drifting from the date used by Step 4's `docs/{date}/` directory and git commit message if the script runs near a JST midnight boundary; reading the already-canonical `meeting-result.json.date` (same field Step 4 itself uses) removes that risk entirely — see Common Pitfalls |
| `data/urgency-history.json` read via plain `JSON.parse` | zod schema for the history file itself | Not needed: the file is 100% self-generated by this phase's own writer, never touched by an LLM; zod's value (defending against untrusted/malformed *external* input) doesn't apply here the way it does for `portfolio-analysis.json` |

**Installation:**
No new packages required. This phase uses only existing dependencies (`zod`, `vitest`) and Node.js built-ins (`node:fs/promises`, `node:path`, `node:url`).

**Version verification:** Verified directly in this environment:
```
node --version        -> v24.3.0
npx vitest --version  -> vitest/4.0.18 darwin-arm64 node-v24.3.0
npm view zod version  -> 4.4.3
```

## Package Legitimacy Audit

**Not applicable.** This phase introduces zero new external packages. All functionality is built from existing dependencies already present in `package.json` (`zod`, `vitest`, `dotenv`, `typescript`, `tsx`) and Node.js built-in modules (`node:fs/promises`, `node:path`, `node:url`). The Package Legitimacy Gate protocol (slopcheck, registry verification, postinstall script check) is skipped because there is nothing to install.

**Packages removed due to slopcheck [SLOP] verdict:** none (n/a — no packages evaluated)
**Packages flagged as suspicious [SUS]:** none (n/a — no packages evaluated)

## Architecture Patterns

### System Architecture Diagram

```
tmp/portfolio-analysis.json          tmp/meeting-result.json
(HoldingEvaluation[12], LLM-derived   (canonical `date` field, already
 urgent/decision, written by          used by Step 4 for docs/{date}/
 Step 3d portfolio-analyst)           and the git commit message)
        |                                     |
        |  read (JSON.parse, no zod --        |  read (JSON.parse, `.date`
        |  self-generated artifact,           |  field only -- same minimal
        |  loadHoldingNews precedent)         |  read as write-news-digest.ts)
        v                                     v
   +---------------------------------------------------------+
   |         src/scripts/write-urgency-history.ts (new)       |
   |  1. mkdir data/ (UNCONDITIONAL, first statement)          |
   |  2. load existing data/urgency-history.json (or {})       |
   |     -- corrupted? preserve + FAIL marker + exit 1 (D-14)  |
   |  3. if portfolio-analysis missing/0 holdings: SKIP,       |
   |     OK marker, no write (D-13)                            |
   |  4. validate dateKey via isValidDateKey (D-06)             |
   |     -- invalid? FAIL marker + exit 1, no write             |
   |  5. extractUrgencySnapshots(analysis)  <-- pure function   |
   |  6. appendUrgencySnapshot(history, dateKey, snapshots)     |
   |     <-- pure function, immutable same-day overwrite        |
   |  7. writeFile data/urgency-history.json                    |
   +---------------------------------------------------------+
        |
        |  calls (pure, no I/O)
        v
   +---------------------------------------------------------+
   | src/portfolio/urgency-history.ts (new, pure functions)   |
   |  extractUrgencySnapshots(analysis): HoldingUrgencySnapshot[] |
   |  appendUrgencySnapshot(history, dateKey, snapshots): UrgencyHistoryFile |
   |  isValidDateKey(dateKey): boolean                          |
   +---------------------------------------------------------+

Pipeline ordering (invest.md):
  Step 3d (portfolio-analysis.json generated)
     -> Step 3e (news-digest, existing, unaffected)
        -> Step 3f (NEW: run write-urgency-history.ts, emit [STEP:urgency-history:*])
           -> Step 4 (deploy: git add docs/ data/  <-- extended pathspec, D-11)
                       -> git diff --staged --quiet (change detection)
                       -> git commit -m "report: {date} daily update"
                       -> git push origin master
```

A reader can trace HIST-01/HIST-02 end-to-end: `tmp/portfolio-analysis.json` (input) -> pure extraction -> pure same-day-overwrite merge -> `data/urgency-history.json` (output) -> git commit/push (persistence), with the `tmp/meeting-result.json` date acting as the single synchronizing key between this new step and the pre-existing Step 4 deploy.

### Recommended Project Structure
```
src/
├── portfolio/
│   ├── urgency-history.ts        # NEW: pure functions (D-07) — extract, merge, date-validate
│   ├── urgency-history.test.ts   # NEW: unit tests (TDD-first per CLAUDE.md)
│   ├── holding-news.ts           # existing — normalizeHoldingSymbol reused (D-10)
│   └── decision-diff.ts          # existing — sibling pure-function precedent, not modified
├── scripts/
│   ├── write-urgency-history.ts       # NEW: thin CLI I/O wrapper (D-08)
│   ├── write-urgency-history.test.ts  # NEW: main() tests with vi.mock("node:fs/promises")
│   └── report-data-loaders.ts         # existing — NOT modified; write-urgency-history.ts
│                                        # reads tmp/portfolio-analysis.json directly with a
│                                        # plain try/catch (matches loadHoldingNews's
│                                        # self-generated-artifact pattern), not via
│                                        # loadPortfolioAnalysis()'s zod path (see Pitfall 4)
data/
└── urgency-history.json          # NEW at runtime, created by write-urgency-history.ts's
                                   # unconditional mkdir; tracked by git (not in .gitignore)
```

### Pattern 1: Pure extraction function (mirrors `holding-news.ts`)
**What:** A pure function that maps `PortfolioAnalysis.holdings` (12 `HoldingEvaluation` entries) to the minimal 4-field `HoldingUrgencySnapshot[]`, applying `normalizeHoldingSymbol` to the symbol.
**When to use:** Any time `tmp/portfolio-analysis.json` needs to be reduced to a persisted, audit-safe subset of fields.
**Example:**
```typescript
// Source: modeled on src/portfolio/holding-news.ts normalizeHoldingSymbol / buildHoldingNewsMap
import { normalizeHoldingSymbol } from "./holding-news.js";
import type { PortfolioAnalysis } from "../meeting/types.js";

export interface HoldingUrgencySnapshot {
  readonly symbol: string;
  readonly nameJa: string;
  readonly urgent: boolean;
  readonly decision: "保持" | "買増" | "一部売却" | "全売却";
}

export type UrgencyHistoryFile = Record<string, ReadonlyArray<HoldingUrgencySnapshot>>;

/**
 * D-02: 保存フィールドは symbol/nameJa/urgent/decision の4つのみ。
 * rationale/riskNote/previousDecision/decisionChanged は保存しない（二重情報源防止）。
 * D-10: symbol は normalizeHoldingSymbol で正規化してから保存する。
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
```

### Pattern 2: Immutable same-day overwrite merge (mirrors `update-index.ts`'s `mergeEntry`)
**What:** A pure function that returns a new history object with the given `dateKey` overwritten, structurally preventing duplication.
**When to use:** Any append-only, date-keyed history file where same-day re-runs must overwrite rather than duplicate.
**Example:**
```typescript
// Source: modeled on src/scripts/update-index.ts mergeEntry (L86-92) — object-map analogue
/**
 * D-04: 同日ガードは日付キー上書き。immutable spread で history を一切 mutate しない。
 * オブジェクトの同一キー代入なので重複は構造的に不可能。
 */
export function appendUrgencySnapshot(
  history: UrgencyHistoryFile,
  dateKey: string,
  snapshots: ReadonlyArray<HoldingUrgencySnapshot>,
): UrgencyHistoryFile {
  return { ...history, [dateKey]: snapshots };
}

/** D-06: 書き込み前の date キー検証。Step 4 デプロイと同一の正規表現。 */
export function isValidDateKey(dateKey: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateKey);
}
```

### Pattern 3: Fail-soft CLI wrapper with STEP-marker-friendly exit codes (mirrors `write-news-digest.ts`)
**What:** A `main()` function that unconditionally creates its output directory first, then applies each fail-soft branch (D-13 skip / D-14 corruption-preserve / D-06 invalid-date) before writing, using `console.error`/`process.exit(1)` for machine-detectable failure signals that invest.md turns into `[STEP:urgency-history:*]` markers — exactly like `[digest-crossref] OK`/`FAIL` in `write-news-digest.ts`.
**When to use:** Any new pipeline step that must never abort the overall `invest.md` run.
**Example:**
```typescript
// Source: modeled on src/scripts/write-news-digest.ts main() (fail-soft shape, D-08/D-09)
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { extractUrgencySnapshots, appendUrgencySnapshot, isValidDateKey } from "../portfolio/urgency-history.js";
import type { UrgencyHistoryFile } from "../portfolio/urgency-history.js";
import type { PortfolioAnalysis } from "../meeting/types.js";

const TMP_DIR = join(import.meta.dirname, "../../tmp");
const DATA_DIR = join(import.meta.dirname, "../../data");
const HISTORY_PATH = join(DATA_DIR, "urgency-history.json");

async function loadExistingHistory(): Promise<{ history: UrgencyHistoryFile; corrupted: boolean }> {
  try {
    const raw = await readFile(HISTORY_PATH, "utf-8");
    return { history: JSON.parse(raw) as UrgencyHistoryFile, corrupted: false };
  } catch (error) {
    const isMissing = (error as NodeJS.ErrnoException).code === "ENOENT";
    return isMissing ? { history: {}, corrupted: false } : { history: {}, corrupted: true };
  }
}

export async function main(): Promise<void> {
  // Pitfall 1 mitigation: MUST run before any skip/fail branch below, so `data/` exists
  // on disk by the time Step 4 runs `git add docs/ data/`, regardless of outcome here.
  await mkdir(DATA_DIR, { recursive: true });

  const { history: existingHistory, corrupted } = await loadExistingHistory();
  if (corrupted) {
    // D-14 default: preserve existing file, do not overwrite, surface as FAIL.
    console.error("[urgency-history] FAIL: 既存の data/urgency-history.json が破損しています。保全のため今回の書き込みをスキップします。");
    process.exit(1);
    return;
  }

  let analysis: PortfolioAnalysis | null;
  try {
    const raw = await readFile(join(TMP_DIR, "portfolio-analysis.json"), "utf-8");
    analysis = JSON.parse(raw) as PortfolioAnalysis; // self-generated artifact, no zod (loadHoldingNews precedent)
  } catch {
    analysis = null;
  }

  if (analysis === null || !Array.isArray(analysis.holdings) || analysis.holdings.length === 0) {
    console.error("[urgency-history] OK (skip: tmp/portfolio-analysis.json 欠損または holdings 0件, D-13)");
    return; // existing history left untouched, exit 0
  }

  // D-05: dateKey は meeting-result.json 由来（Step 4 の docs/{date}/ と一致を保証）
  const meetingRaw = await readFile(join(TMP_DIR, "meeting-result.json"), "utf-8");
  const { date: dateKey } = JSON.parse(meetingRaw) as { date: string };

  if (!isValidDateKey(dateKey)) {
    console.error(`[urgency-history] FAIL: 不正なdateキー形式: ${dateKey}`);
    process.exit(1);
    return;
  }

  const snapshots = extractUrgencySnapshots(analysis);
  const updatedHistory = appendUrgencySnapshot(existingHistory, dateKey, snapshots);
  await writeFile(HISTORY_PATH, JSON.stringify(updatedHistory, null, 2), "utf-8");
  console.error(`[urgency-history] OK: ${dateKey} に${snapshots.length}銘柄分を記録`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
```

### Anti-Patterns to Avoid
- **Mutating `history` in place (`history[dateKey] = snapshots`):** violates the project's global immutability rule and defeats the point of the pure-function boundary; always return `{ ...history, [dateKey]: snapshots }`.
- **Deriving `dateKey` via JST re-derivation (`Date.now() + 9h`) instead of `meeting-result.json.date`:** creates two independent sources of "today's date" in the same pipeline run; if they ever diverge (e.g. a run straddling midnight JST), `data/urgency-history.json`'s date key and `docs/{date}/`'s directory name will mismatch, breaking the audit trail Phase 26 depends on.
- **Zod-validating `data/urgency-history.json` on read:** this file is a first-party artifact this phase's own writer produces; treat it like `loadHoldingNews()` treats `tmp/holding-news.json` (plain `JSON.parse` + fail-soft catch), not like untrusted LLM output.
- **Baking `previousDecision`/`decisionChanged` into the stored snapshot:** explicitly rejected by D-02 — Phase 26 must compute decision-change by comparing adjacent dateKey entries at read time, not by trusting a value baked in at write time (single source of truth).
- **Assuming `data/` exists before the first successful `write-urgency-history.ts` run:** see Pitfall 1 below — this is the single highest-impact mistake available in this phase.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Symbol normalization for cross-date matching | A second `.trim().toUpperCase()` implementation inside `urgency-history.ts` | Import and reuse `normalizeHoldingSymbol` from `holding-news.ts` (D-10) | Single source of truth for symbol normalization across `holding-news.ts`, `decision-diff.ts`, and now `urgency-history.ts` — a second implementation risks silent drift (e.g. one normalizes Unicode differently) |
| Same-day dedup / overwrite logic | A custom array-filter-and-push routine | Plain JS object key assignment (`{ ...history, [dateKey]: snapshots }`) | Object keys are inherently unique; this is *simpler* than the array-based `mergeEntry` it's modeled on, not more complex — no dedup logic needs to exist at all |
| Date format validation | A hand-rolled date parser or `Date.parse` check | The existing `/^\d{4}-\d{2}-\d{2}$/` regex already used at Step 4 (L2098) | Reusing the exact same regex guarantees the two validation points (this phase's write step and the existing deploy step) can never disagree about what counts as a valid date string |
| Directory creation for a new persisted-file location | Manual `existsSync` + `mkdirSync` branching | `mkdir(DATA_DIR, { recursive: true })` (idempotent, no-op if it already exists) | Matches the exact idiom already used for `dateDir` in both `generate-report.ts` and `write-news-digest.ts` — no new idiom introduced |

**Key insight:** Every piece of logic this phase needs (extraction, same-day merge, date validation, directory creation, fail-soft CLI shape) already has a working, tested precedent elsewhere in this exact codebase. There is no genuinely novel engineering problem here — the risk is entirely in *wiring* (getting the git integration and date-source consistency right), not in algorithm design.

## Common Pitfalls

### Pitfall 1: `git add docs/ data/` fails hard if `data/` does not yet exist on disk
**What goes wrong:** Extending Step 4's `execSync('git add docs/', { stdio: 'inherit' })` to `execSync('git add docs/ data/', ...)` will throw an uncaught exception — and crash the *entire* deploy step, including the docs/ push — if the `data/` directory has never been created on disk.
**Why it happens:** `git add` treats a non-existent pathspec as a hard error, not a silent no-op. Verified directly in this environment:
```
$ git add docs/ nonexistent-dir/
fatal: pathspec 'docs/' did not match any files
$ echo $?
128
```
`[VERIFIED: local git command, exit code 128]`. Since the `git add` call in Step 4 is **not** wrapped in its own try/catch (only the later `commit`/`push` calls are), an exception here propagates out of the entire `node -e "..."` block uncaught, which the pipeline will interpret as `[STEP:deploy:FAIL]` + `[PIPELINE:FAIL]` — i.e. this single missing directory would break the *existing, working* docs/ deployment that Phase 25 is not supposed to touch.
**How to avoid:** `write-urgency-history.ts`'s `mkdir(DATA_DIR, { recursive: true })` must be the **first statement** in `main()`, executed unconditionally before any of the D-13/D-14/D-06 fail-soft branches — this guarantees `data/` exists on disk after any invocation of the script that gets far enough to start running (see Pattern 3 above). As defense-in-depth (recommended, not required), Step 4's deploy script can additionally guard the `git add` call itself, e.g. `if (!fs.existsSync('data')) fs.mkdirSync('data', { recursive: true });` immediately before `execSync('git add docs/ data/', ...)` — mirroring the existing "always check fs state directly, never assume" philosophy already used in `update-index.ts`'s `newsDigestFileExists()` (D-01/D-02 there).
**Warning signs:** First-ever pipeline run after this phase ships (before `data/urgency-history.json` has ever been written) is the highest-risk moment; also any future scenario where `write-urgency-history.ts` fails so early it never reaches the `mkdir` line (e.g. a `tsx`/import-time error) — extremely unlikely but worth the belt-and-suspenders check.

### Pitfall 2: Using `portfolioAnalysis.date` or JST re-derivation instead of `meeting-result.json.date` as the dateKey
**What goes wrong:** If the dateKey written into `data/urgency-history.json` is derived independently of the date Step 4 uses for `docs/{date}/` and the git commit message, a same-day re-run edge case (or a run that straddles JST midnight) can produce a history entry under a different date than the day's actual report directory — breaking the audit guarantee ("同日エントリは重複追加されず上書きされる") and desynchronizing Phase 26's future weekly rollup from the displayed reports.
**Why it happens:** There are three plausible date sources in this pipeline at the point `write-urgency-history.ts` would run: (1) `tmp/portfolio-analysis.json`'s own `date` field, (2) a fresh JST computation (`Date.now() + 9h`), (3) `tmp/meeting-result.json`'s `date` field. Only (3) is guaranteed to be the exact value Step 4 already uses for both the `docs/{date}/` directory and the `report: {date} daily update` commit message.
**How to avoid:** Read `tmp/meeting-result.json` in `write-urgency-history.ts` and use its `date` field directly (same minimal-trust snippet already used in `write-news-digest.ts`'s `main()`: `const { date } = JSON.parse(meetingRaw) as { date: string };`), not `portfolioAnalysis.date` and not a fresh JST computation.
**Warning signs:** A `data/urgency-history.json` entry whose date key does not correspond to any existing `docs/{date}/` directory in git history — this would only be detectable in review, not by any automated test unless the planner adds a cross-check.

### Pitfall 3: JSON round-trip erases `readonly`/type safety — tests must use `toEqual`, not `toBe`, and must not rely on TS types at runtime
**What goes wrong:** `HoldingUrgencySnapshot`'s `readonly` modifiers and the `UrgencyHistoryFile`'s `Record<...>` shape are compile-time-only; after `JSON.parse(await readFile(...))`, nothing prevents an accidental mutation or a malformed shape from passing through un-detected at runtime.
**Why it happens:** This is a known, already-documented pattern risk in this codebase (see `holding-news.ts`'s `publishedAt` comment: "JSON往復後は必ずstring"). It is not new to this phase, but the same discipline must be applied.
**How to avoid:** Since `data/urgency-history.json` is a first-party artifact (not zod-validated per the earlier "Don't Hand-Roll" guidance), rely on TypeScript's compile-time checking of the *writer* (`extractUrgencySnapshots`'s return type) and treat the *reader* path (`loadExistingHistory`) defensively — wrap it in try/catch and never assume the parsed shape matches `UrgencyHistoryFile` without at least a basic `typeof === "object"` sanity check, consistent with D-14's "corrupted -> preserve" fallback.
**Warning signs:** A test that uses `toBe` (reference equality) on a JSON round-tripped object will always fail even when the data is logically identical — use `toEqual` throughout, matching every existing `.test.ts` in this codebase.

### Pitfall 4: Reusing `loadPortfolioAnalysis()` (zod-validated) instead of a plain read for `write-urgency-history.ts`
**What goes wrong:** `report-data-loaders.ts`'s `loadPortfolioAnalysis()` uses `console.error` on failure and returns `null` — which is a reasonable input, but it is designed for the *report generation* fail-soft context, not this phase's D-13 "skip silently, no history change" semantics. If reused blindly, the two failure paths' logging/severity conventions could get tangled (D-13 wants an `OK` skip marker on missing input, not the `console.error` `loadPortfolioAnalysis()` already emits).
**Why it happens:** It's tempting to reuse the existing loader for DRY reasons, since it is the canonical `tmp/portfolio-analysis.json` reader already zod-validating the schema.
**How to avoid:** The planner may reuse `loadPortfolioAnalysis()` for its zod validation benefit — this is a legitimate design choice — but if so, must explicitly re-map its `null` return to D-13's "skip, OK marker" semantics inside `write-urgency-history.ts`, not let `loadPortfolioAnalysis()`'s own `console.error` be the only signal. Alternatively, a plain local `readFile`/`JSON.parse`/try-catch (as shown in Pattern 3) avoids this ambiguity entirely and matches `loadHoldingNews()`'s "self-generated-artifact, no zod" precedent for scripts that are themselves optional/fail-soft pipeline steps. Either is acceptable; the research recommends the plain local read for simplicity and to avoid layering two different severity conventions.
**Warning signs:** Duplicate or contradictory log lines for the same missing-input condition (e.g. both `loadPortfolioAnalysis()`'s `console.error` and this phase's own `[urgency-history] OK (skip...)` firing for the same event) would make pipeline log auditing confusing.

## Code Examples

Verified patterns from this codebase (all file:line references confirmed by direct read in this research session):

### Pure extraction + immutable merge module
See "Pattern 1" and "Pattern 2" above (`src/portfolio/urgency-history.ts`).

### Fail-soft CLI wrapper with mkdir-first ordering
See "Pattern 3" above (`src/scripts/write-urgency-history.ts`).

### invest.md new step (Step 3f, inserted between existing Step 3e and Step 4)
```markdown
### Step 3f: 緊急度履歴の追記

「緊急度履歴を記録中...」とユーザーに表示してください。

以下のBashコマンドを実行してください:

\`\`\`bash
cd /Users/arai/invest && npx tsx src/scripts/write-urgency-history.ts
\`\`\`

スクリプトの終了コードに関わらず、Step 4 へ進んでください（fail-soft, D-09）。

終了コードが 0 の場合:
\`\`\`bash
echo '[STEP:urgency-history:OK]'
\`\`\`

終了コードが非0の場合、標準エラー出力の `[urgency-history] FAIL:` 行に続く理由を短く要約して出力してください:
\`\`\`bash
echo '[STEP:urgency-history:FAIL:<短い理由>]'
\`\`\`

**`[PIPELINE:FAIL]` は絶対に出力しないこと** — この失敗は既存3レポート・ニュースダイジェスト・デプロイをブロックしない（HIST-01/HIST-02の永続化失敗は既存パイプラインの継続を妨げない）。
```
This is a direct structural copy of the existing Step 3e template (L1985-2019), substituting `news-digest`/`write-news-digest.ts` for `urgency-history`/`write-urgency-history.ts`. Placing it as a **new Step 3f** (rather than renumbering existing steps) avoids touching any of the surrounding, already-shipped step numbering.

### Step 4 deploy script extension (exact diff target)
```diff
 // docs/ をステージング
-execSync('git add docs/', { stdio: 'inherit' });
+// data/urgency-history.json は write-urgency-history.ts の mkdir(DATA_DIR, {recursive:true})
+// により Step 3f 完了時点で必ず存在する（Pitfall 1）。念のため二重防御で存在確認する。
+if (!fs.existsSync('data')) fs.mkdirSync('data', { recursive: true });
+execSync('git add docs/ data/', { stdio: 'inherit' });
```
Target location: `.claude/commands/invest.md` Step 4, the `git add docs/` line (confirmed at L2104 in this research session). No other line in the deploy block needs to change — `git diff --staged --quiet`, the commit message, and `git push origin master` all operate on whatever is staged, so they automatically pick up `data/` changes once staged.

## State of the Art

Not applicable in the conventional sense (no external library/framework version drift to track) — this phase is entirely internal architecture. The one "state of the art" consideration is: the codebase's own conventions have evolved over v2.4/v2.5/v2.6 toward (1) pure-function modules with co-located `.test.ts`, (2) fail-soft pipeline steps with dedicated `[STEP:*]` markers that never emit `[PIPELINE:FAIL]`, and (3) date-keyed object maps for same-day-overwrite semantics. This phase should be built as the newest instance of all three conventions, not as a novel design.

**Deprecated/outdated:** None relevant — no prior implementation of urgency history exists to deprecate.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `tmp/portfolio-analysis.json`'s `date` field is generated in the same pipeline run and would, in the vast majority of cases, match `tmp/meeting-result.json`'s `date` field — but this research recommends using `meeting-result.json`'s date specifically *because* exact equality across two independently-LLM/TS-generated artifacts cannot be guaranteed by inspection alone | Architecture Patterns, Pitfall 2 | Low — this assumption only matters if the planner considers using `portfolioAnalysis.date` instead of the recommended `meeting-result.json.date`; the recommendation itself is a defensive design choice specifically to avoid depending on this assumption being true |
| A2 | No other pipeline step or script currently reads or writes anything under `data/` (i.e. this phase is the first user of that top-level directory in the repo) | Architecture Patterns, Recommended Project Structure | Low — verified: `ls /Users/arai/invest/data` returns "No such file or directory" `[VERIFIED: local ls]`; if some other in-flight phase/branch also targets `data/`, naming could collide, but no such collision was found in the current `src/` tree |
| A3 | Extending `git add docs/` to `git add docs/ data/` is safe for the commit-message/push logic that follows, since both directories are added to the same commit as before (no separate commit needed) | Architecture Patterns, Code Examples | Low — this is a direct, mechanical consequence of how `git add`/`git diff --staged`/`git commit` compose; no plausible failure mode was found beyond Pitfall 1 (missing directory), which is separately addressed |

**If this table is empty:** N/A — see above; all three assumptions are LOW risk and are already mitigated by the recommendations in this document.

## Open Questions

1. **Should `data/urgency-history.json`'s top-level date keys be written in sorted order for git-diff readability?**
   - What we know: D-04's exact reference implementation (`{ ...history, [dateKey]: snapshots }`) appends the new key at object-insertion-order end, not sorted. `JSON.stringify` preserves that insertion order for non-numeric-like string keys (confirmed: `"YYYY-MM-DD"` keys are not valid array indices, so insertion order is preserved, not renumbered).
   - What's unclear: The phase's goal explicitly frames this as "監査可能な履歴" (an auditable history) — a human reviewing `git diff` on this file might find a sorted (e.g. descending) key order easier to audit than pure append order, especially since D-03 guarantees no pruning, so the file only grows.
   - Recommendation: Not required by any locked decision or success criterion — leave as insertion-order (D-04's literal spec) unless the planner judges the audit-readability benefit worth a small additional step (e.g. sort keys immediately before `JSON.stringify` in `write-urgency-history.ts`, outside the pure `appendUrgencySnapshot` function so the pure function's contract stays exactly as D-04 specifies).

2. **Does `write-urgency-history.ts` need to guard against `tmp/meeting-result.json` itself being missing/malformed?**
   - What we know: `write-news-digest.ts`'s existing precedent reads `meeting-result.json` *outside* its own outer try/catch, so a missing/malformed file there simply throws, gets caught by `main().catch(...)`, and exits 1 — which is fine because news-digest's failure is already fail-soft at the invest.md pipeline level.
   - What's unclear: Whether the planner wants `write-urgency-history.ts` to treat a missing `meeting-result.json` as its own distinct D-13-style "skip, OK" case (since technically no urgency data can be attributed to a date without it) versus simply inheriting the same throw-and-exit-1 behavior as the news-digest precedent (which becomes a `[STEP:urgency-history:FAIL:...]`, still fail-soft at the pipeline level either way).
   - Recommendation: Either choice satisfies HIST-01/HIST-02 and the fail-soft requirement (D-09) since both result in the pipeline continuing regardless; for consistency with the established `write-news-digest.ts` precedent, this research recommends *not* special-casing this (let it throw and be caught by the outer `main().catch()`, surfacing as `[STEP:urgency-history:FAIL:...]`) rather than adding a new distinct skip path — but this is a low-stakes discretionary choice for the planner.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All script execution | Yes `[VERIFIED]` | v24.3.0 | — |
| npx tsx | Running `.ts` scripts directly in the pipeline (existing convention) | Yes (already used by every other pipeline step) | ^4.21.0 (package.json) | — |
| git | Step 4 commit/push (existing, unmodified command surface) | Yes (repo is already a git repo with an `origin` remote per existing Step 4 usage) | — (not version-sensitive) | — |
| vitest | Test execution | Yes `[VERIFIED]` | 4.0.18 | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none — this phase introduces no new external dependency of any kind; it exclusively reuses tooling every prior phase already depends on.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.0.18 `[VERIFIED: npx vitest --version]` |
| Config file | none — project uses vitest defaults (no `vitest.config.ts` present) |
| Quick run command | `npx vitest run src/portfolio/urgency-history.test.ts src/scripts/write-urgency-history.test.ts` |
| Full suite command | `npm test` (== `vitest run`, per package.json) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| HIST-01 | `extractUrgencySnapshots` returns exactly the 4 fields (`symbol`, `nameJa`, `urgent`, `decision`) for all 12 holdings, including `urgent: false` entries | unit | `npx vitest run src/portfolio/urgency-history.test.ts -t "extractUrgencySnapshots"` | ❌ Wave 0 |
| HIST-01 | `extractUrgencySnapshots` normalizes symbols via `normalizeHoldingSymbol` (e.g. `" 8522.t "` -> `"8522.T"`) | unit | `npx vitest run src/portfolio/urgency-history.test.ts -t "normalize"` | ❌ Wave 0 |
| HIST-01 | `write-urgency-history.ts`'s `main()` writes `data/urgency-history.json` containing the correct dateKey with all 12 snapshots, given a valid `tmp/portfolio-analysis.json` and `tmp/meeting-result.json` (mocked fs) | integration | `npx vitest run src/scripts/write-urgency-history.test.ts -t "正常系"` | ❌ Wave 0 |
| HIST-01 | `main()` skips writing (no history change) when `tmp/portfolio-analysis.json` is missing or has 0 holdings (D-13), and emits an OK-with-skip signal | integration | `npx vitest run src/scripts/write-urgency-history.test.ts -t "skip"` | ❌ Wave 0 |
| HIST-01 | `main()` preserves the existing `data/urgency-history.json` and exits 1 when the existing file is corrupted/unparseable (D-14 default) | integration | `npx vitest run src/scripts/write-urgency-history.test.ts -t "corrupted"` | ❌ Wave 0 |
| HIST-01 | `main()` rejects an invalid dateKey (fails `isValidDateKey`) without writing, exits 1 (D-06) | integration | `npx vitest run src/scripts/write-urgency-history.test.ts -t "不正なdate"` | ❌ Wave 0 |
| HIST-02 | `appendUrgencySnapshot(history, dateKey, snapshots)` called twice with the **same** `dateKey` produces a history where that key holds only the second call's snapshots (no duplication, no array growth) | unit | `npx vitest run src/portfolio/urgency-history.test.ts -t "同日"` | ❌ Wave 0 |
| HIST-02 | `appendUrgencySnapshot` does not mutate the input `history` object (immutability) | unit | `npx vitest run src/portfolio/urgency-history.test.ts -t "immutability"` | ❌ Wave 0 |
| (integration) | Extending `git add docs/` to `git add docs/ data/` does not throw when `data/` exists but is empty, and does throw (pre-fix) when `data/` does not exist — documents Pitfall 1 | manual verification (git behavior, not unit-testable against the actual invest.md markdown) | n/a (verified once during this research session; recommend planner re-verify behaviorally if desired) | n/a |

### Sampling Rate
- **Per task commit:** `npx vitest run src/portfolio/urgency-history.test.ts src/scripts/write-urgency-history.test.ts` (quick run, targets only this phase's new files)
- **Per wave merge:** `npm test` (full suite — cheap enough here given the whole suite is vitest-based and fast; no reason to skip)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/portfolio/urgency-history.test.ts` — new file, covers HIST-01/HIST-02 pure-function behavior (extraction, same-day overwrite, immutability, date validation)
- [ ] `src/scripts/write-urgency-history.test.ts` — new file, covers HIST-01/HIST-02 CLI-wrapper behavior (skip on missing input, corruption preservation, invalid-date rejection, normal-path write), following the exact `vi.mock("node:fs/promises")` + `beforeEach`/`afterEach` shape of `write-news-digest.test.ts`
- [ ] No framework install needed — vitest is already configured and running (`npm test`)

*(Both files above are new-file creation, not "framework gaps" — the test infrastructure itself is fully in place.)*

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth surface in this phase (local CLI pipeline, no network-facing endpoint) |
| V3 Session Management | no | n/a |
| V4 Access Control | no | n/a |
| V5 Input Validation | yes | `isValidDateKey` regex validation (`/^\d{4}-\d{2}-\d{2}$/`) before using `dateKey` as an object key/persisted value — reuses the exact pattern already validated at Step 4 (L2098) for the same purpose |
| V6 Cryptography | no | No secrets, no encryption surface introduced |
| V12 Files and Resources | yes | `HISTORY_PATH`/`DATA_DIR` are **hardcoded constants**, never constructed from `dateKey` or any other variable input — this structurally eliminates the path-traversal risk that `write-news-digest.ts` explicitly has to defend against (its `docs/{date}/` directory *is* built from a date-derived value, hence its own D-06/T-17-03 note). Confirm in implementation that no future edit introduces `join(DATA_DIR, dateKey + ".json")` or similar per-date file naming, which would reopen that class of risk. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed/out-of-format `dateKey` polluting the history object (e.g. `"__proto__"`, a non-date string, or a string that could confuse a future date-range reader) | Tampering | `isValidDateKey` regex gate (D-06) before any write; note the codebase already has a documented precedent for defending against `__proto__`/prototype-pollution-style keys in map-like structures (see recent commit `c91df24 fix(24): harden crossref map against prototype keys`) — the planner should check whether `appendUrgencySnapshot`'s `{ ...history, [dateKey]: snapshots }` spread needs a similar guard if `dateKey` could ever be attacker-influenced. In this phase `dateKey` originates from `tmp/meeting-result.json`, which is itself produced by an internal pipeline (not directly user-supplied), and is additionally regex-validated — residual risk is LOW but the precedent is directly on point and worth the planner's explicit attention. |
| Silent, permanent data loss in the audit trail (existing history file corrupted and blindly overwritten) | (Integrity/Availability, not classic STRIDE) | D-14 default: preserve existing file on corrupted read, do not overwrite, surface `[STEP:urgency-history:FAIL:...]` so a human notices and can recover/restore from git history (the file is git-tracked, so even a bad overwrite would be recoverable via `git log`/`git checkout` — an additional safety net beyond D-14 itself) |

## Sources

### Primary (HIGH confidence)
- `/Users/arai/invest/src/portfolio/holding-news.ts` + `.test.ts` — pure-function module template, `normalizeHoldingSymbol`, fail-soft/full-key-retention design
- `/Users/arai/invest/src/portfolio/decision-diff.ts` — sibling pure-function precedent (Map-based lookup, immutability discipline)
- `/Users/arai/invest/src/scripts/update-index.ts` — `mergeEntry` same-date-wins reference implementation
- `/Users/arai/invest/src/scripts/write-news-digest.ts` + `.test.ts` — fail-soft CLI wrapper `main()` shape, STEP-marker-adjacent `console.error` signal convention, `vi.mock("node:fs/promises")` test pattern
- `/Users/arai/invest/src/scripts/report-data-loaders.ts` — `loadPortfolioAnalysis`/`loadHoldingNews` read patterns (zod-validated vs. self-generated-artifact plain-parse distinction)
- `/Users/arai/invest/src/scripts/generate-report.ts` — `resolvePrevHoldingsForDiff` same-day guard semantics
- `/Users/arai/invest/src/meeting/types.ts` — `HoldingEvaluation`/`PortfolioAnalysis` source types
- `/Users/arai/invest/src/meeting/schemas.ts` — `portfolioAnalysisSchema`/`holdingEvaluationSchema` (confirms `urgent`/`decision` field shapes and defaults)
- `/Users/arai/invest/src/portfolio/holdings.ts` — `PortfolioHolding`/`PORTFOLIO_HOLDINGS` (12-holding list, confirms symbol formats requiring normalization, e.g. `8522.T`)
- `/Users/arai/invest/.claude/commands/invest.md` §Step 3d (L1699-1719), §Step 3e (L1985-2052), §Step 4 (L2056-2153) — exact pipeline step templates and the `git add docs/` integration point
- `/Users/arai/invest/.gitignore` — confirms `data/` is not ignored (only `tmp/` is)
- `/Users/arai/invest/package.json` — confirms vitest 4.0.18 devDependency, `npm test` script, zod 4.3.6 dependency
- Local shell verification in this research session: `node --version` (v24.3.0), `npx vitest --version` (4.0.18), `npm view zod version` (4.4.3), `git add <nonexistent-dir>/` behavior (exit code 128, confirmed via isolated `/tmp` git repo)

### Secondary (MEDIUM confidence)
- None — all findings in this research were directly verified against the codebase or a local tool invocation; no web search was required since this phase is purely internal-architecture work.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all tooling versions directly verified in this environment
- Architecture: HIGH — every recommended pattern is a direct structural mirror of an existing, tested, shipped module in this exact codebase
- Pitfalls: HIGH — Pitfall 1 (git add pathspec failure) was independently verified with a live `git` command in this research session, not merely inferred

**Research date:** 2026-07-04
**Valid until:** 2026-08-03 (30 days — stable internal architecture, no external API/library surface subject to fast-moving change)

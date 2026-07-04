# Phase 24: Digest-Meeting Cross-Reference - Research

**Researched:** 2026-07-04
**Domain:** Internal TypeScript codebase (deterministic string/set matching, static HTML rendering, fail-soft pipeline integration). No external libraries, no external web research required.
**Confidence:** HIGH (all findings are direct code reads + live `tmp/` data inspection from this repo)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**照合ソースと優先順位（Match signal & priority）**
- **D-01:** マッチは2系統。**(1) ティッカー一致（優先）**: `CuratedArticle.tickers` を、ミーティングで議論されたティッカー集合と照合する。**(2) テーマキーワード照合（フォールバック）**: 記事の `title` にセクター名等のテーマ語が含まれるかを照合する。holding-news.ts の「ticker一致 > 社名一致」設計思想を踏襲する。
- **D-02:** ティッカー一致のソースは `meeting-result.json` の `highlightedStocks[].ticker`（10銘柄前後、`verdict`/`averageScore`/`summary` を保持しリッチな表示に使える）を第一とし、加えて `roundSummary.scoredTickers`（全スコア対象ティッカー）をマッチ専用の補助集合として使う。`highlightedStocks` に含まれる場合は verdict を注記に使える利点がある。
- **D-03:** テーマキーワード照合のソースは `sectorRecommendations[].sector`（セクター名）を第一とする。照合対象は記事の **title のみ**（holding-news.ts の title-only 照合 = filter.ts のタイトルのみ照合パターンを踏襲、commentary は評価しない）。大小文字区別なし（`includes`、toLowerCase）。
- **D-04:** ティッカー一致がある記事はテーマ照合を評価しない（ticker一致で確定。holding-news.ts の `matchArticlesForHolding` の early-continue 踏襲）。ティッカー不一致の場合のみテーマ照合にフォールバックする。

**注記の内容（Annotation content）**
- **D-05:** ティッカー一致の注記は「銘柄シンボル + verdict（強気/中立/弱気）」を表示する（例: `NVDA 強気`）。verdict は一致した `highlightedStocks[].verdict` から決定論的に取得。`scoredTickers` のみ一致（highlightedStocks 非該当）の場合は verdict なしでシンボルのみ表示する。
- **D-06:** テーマ一致の注記はマッチしたセクター名を表示する（例: `半導体`）。
- **D-07:** 注記テキストは meeting-result.json のフィールド値から決定論的に導出し、LLM 生成の散文は一切含めない（幻覚防止・再現性）。文言のプレフィックス（例: 「🗣 ミーティング言及:」「🗣 関連テーマ:」）は固定文字列とする。

**視覚的マーカーの配置とスタイル（Visual placement）**
- **D-08:** 注記は各記事カード（`.news-card`）内で、既存の `news-meta` 行（ソース・時刻・ティッカーピル）の**下**に独立した注記行/チップとして追加する。h4 の importance バッジや見出しリンクは変更しない（既存レイアウトへの加法的変更）。
- **D-09:** スタイルは既存の `.ticker-pill`（report-utils.ts）を踏襲したチップ表現に、ミーティング用のアクセント色を付ける。`escapeHtml` を必ず通す。一致0件の記事には注記行を一切描画しない（Success Criteria #4: 注記なしで通常表示、レイアウト崩れなし）。

**複数一致時のキャップ（Multi-match cap）**
- **D-10:** 1記事が複数ティッカー/テーマに一致する場合、ティッカー一致を先頭に最大2件、テーマ一致は最大1件でキャップする（holding-news.ts の `MAX_ARTICLES_PER_HOLDING` / rank-and-cap と同じ「上限超過時は確実性の高いticker一致を優先して残す」思想）。順序は決定論的（ティッカー→テーマ、各内は元順序の安定順）。

**統合ポイント・型・fail-soft 隔離（Integration & fail-soft）**
- **D-11:** マッチングは新規の純関数モジュール `src/meeting/digest-crossref.ts` に実装する（holding-news.ts のファイル配置・純関数・副作用なし・throwしない設計を踏襲）。入力は `NewsCuration`（または `CuratedArticle[]`）と `MeetingResult`、出力は記事ID→注記の決定論的マップ（例: `Record<articleId, DigestCrossRef>`）。
- **D-12:** レンダラー `generateNewsDigestHtml` には注記マップを**任意（オプショナル）引数**として追加する（加法的、未指定時は現行の0注記描画と完全に同一）。`formatArticleCardHtml` が記事IDで注記を引いて描画する。
- **D-13:** クロスリファレンス計算は `write-news-digest.ts` の中で行うが、**既存の digest 生成 try/catch とは独立した専用 try/catch で隔離**する。クロスリファレンス例外時は空注記にフォールバックし、digest 本体は正常に（注記なしで）生成・書き出しされる（Success Criteria #3: crossref 例外が digest/既存3レポートをブロックしない）。crossref 失敗が digest の null フォールバック（「生成できませんでした」）を誤発火させてはならない。
- **D-14:** crossref の成否は**専用の STEP マーカー**で可視化する（例: `[STEP:digest-crossref:OK]` / `[STEP:digest-crossref:FAIL:...]`）。既存の `[STEP:news-digest:*]` とは別系統。`[PIPELINE:FAIL]` は絶対に出力しない（OPS-04 と同方針）。マーカーの発出主体（write-news-digest.ts 内 vs invest.md Step 3e）は planner が既存パターンに合わせて決定してよいが、crossref 専用であることは固定。

**シンボル正規化（Symbol normalization）**
- **D-15:** ティッカー比較は holding-news.ts の `normalizeHoldingSymbol`（trim + toUpperCase のみ、内部文字は変えない）と同方式で正規化してから照合する。米国ティッカー（大文字）と日本株（`8522.T` 等）の表記揺れを構造的に吸収する。既存関数の再利用 or 同一実装を planner が判断。

### Claude's Discretion
- STEP マーカーの発出箇所（スクリプト内 stderr か invest.md 側 echo か）は既存の news-digest / portfolio-research のパターンに合わせて planner が選択してよい。
- 注記の具体的な絵文字/プレフィックス文言・チップの正確な CSS 色値は、既存 news-digest のパープルアクセント（#8b5cf6）系との調和を保つ範囲で planner/実装時に確定してよい。
- テーマキーワード照合を `sectorRecommendations[].sector` 以外（`weeklyEvents[].event` 等）にも広げるかは、誤マッチ（過剰注記）のノイズを増やさない範囲で planner が判断してよい。デフォルトはセクター名のみ（保守的）。

### Deferred Ideas (OUT OF SCOPE)
- テーマ照合の対象を `weeklyEvents[].event` や `riskWarnings[].description` にも拡張 — 過剰注記のノイズが問題になった場合に検討（デフォルトはセクター名のみの保守的照合）
- ミーティング未議論の記事に「議論なし」等の明示ラベルを出す案 — Success Criteria #4 は「注記なしで通常表示」なので現時点では不要、必要になれば将来
- 緊急度履歴・週次ロールアップ — Phase 25/26 の担当（本フェーズ scope 外）
- LLM ベースの関連注記生成（決定論マッチングのみ）
- ミーティングデータ側の変更（meeting-result.json のスキーマ・生成フローは触らない、読み取り専用）
- news-digest 以外のレポート（daily/portfolio/meeting-minutes）への注記付与
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| XREP-01 | ユーザーはニュースダイジェスト（news-digest.html）の記事に、当日ミーティングで議論されたテーマ・銘柄への関連注記を見ることができる（meeting-result.json とのTS側決定論的マッチング — ティッカー一致優先+テーマキーワード照合、holding-news.ts と同じ設計思想） | `holding-news.ts` design template fully documented (Pattern 1-4); real production `sectorRecommendations`/`highlightedStocks`/`scoredTickers`/`CuratedArticle.tickers` shapes verified via live `tmp/*.json` inspection; Pitfall 1 identifies a concrete gap (sector string format) the planner must resolve for theme matching to actually work; renderer extension pattern (additive optional param) fully specified with exact line references |
| XREP-02 | クロスリファレンス付与が失敗しても news-digest.html の生成と既存3レポートの生成・デプロイは継続する（fail-soft、専用 STEP マーカーで失敗可視化） | Pitfall 2 documents the exact isolation shape required in `write-news-digest.ts` (nested try/catch, never touching `process.exit`); STEP marker convention verified exhaustively (all markers `echo`'d from `invest.md`, zero exceptions in `src/`); Open Question 1 flags the one genuinely novel design choice (how the isolated script signals crossref failure to invest.md for the dedicated STEP marker) with two concrete recommended options |
</phase_requirements>

## Summary

Phase 24 adds a new pure-function module, `src/meeting/digest-crossref.ts`, that maps each `CuratedArticle` in `NewsCuration` to a deterministic annotation ("this article was discussed in today's meeting") by matching against `MeetingResult`. The design template to mirror exactly is `src/portfolio/holding-news.ts`: ticker-match-first with early-continue, title-only keyword fallback, stable rank-and-cap, `normalizeHoldingSymbol` reuse, zero throws, zero side effects. The renderer (`generate-news-digest.ts`) gets an **additive optional parameter** so 0-annotation output stays byte-identical to today. The pipeline integration point (`write-news-digest.ts`) already reads `meeting-result.json` for `date` — it needs a **second, independently-scoped try/catch** around crossref computation so a crossref exception cannot flip the digest's own exit code or trigger the null-fallback "本日のニュースキュレーションは生成できませんでした" page. All `[STEP:*]` markers in this codebase are emitted from `.claude/commands/invest.md` (bash `echo`), never from inside `src/*.ts` — this is a hard, verified convention with zero exceptions found across the whole `src/scripts/` tree.

One concrete, verified pitfall this research surfaces that CONTEXT.md's illustrative example did not anticipate: real `sectorRecommendations[].sector` values in production `tmp/meeting-result.json` are formatted as `"Healthcare (XLV)"`, `"Semiconductors (SMH)"` — English name + parenthetical ETF ticker, not a clean Japanese label like "半導体". A naive `title.includes(sector)` will essentially never match a real headline because of the trailing `" (XLV)"` suffix. The planner must decide how digest-crossref extracts the matchable keyword from this string (see Pitfall 1).

**Primary recommendation:** Implement `src/meeting/digest-crossref.ts` as a structural mirror of `holding-news.ts` (same function names/shapes translated to the digest domain: `matchesArticleTicker`, `resolveThemeMatch`, `matchAnnotationsForArticle`, `rankAndCapAnnotations`, `buildDigestCrossRefMap`), strip the trailing `" (TICKER)"` parenthetical from `sector` strings before keyword matching, extend `generateNewsDigestHtml`/`formatArticleCardHtml` with an optional 4th/2nd argument respectively, and isolate the crossref call in `write-news-digest.ts` inside its own try/catch that never sets `process.exitCode`/calls `process.exit(1)` and never causes the `curation === null` branch to fire.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Ticker/theme matching logic | Backend script (Node/TS, build-time) | — | Pure deterministic function, no runtime server exists in this project — everything is a batch script invoked by invest.md and its output is static HTML |
| Meeting data read (`meeting-result.json`) | Backend script | — | Already read in `write-news-digest.ts`; digest-crossref only needs to consume it, not read the file itself |
| Annotation → article ID join | Backend script | — | Computed once at generation time, embedded as static HTML in the output file (no client-side JS exists in these reports) |
| Visual chip rendering | Backend script (HTML string templates) | Browser (passive display only) | `generate-news-digest.ts` emits static HTML; the browser only renders it, no client-side logic |
| Fail-soft isolation / STEP marker | Orchestration layer (`invest.md`, executed by the calling agent) | Backend script (exit code / stderr signal) | Verified: every `[STEP:*]` marker in this codebase is `echo`'d from `.claude/commands/invest.md`, never printed from within `src/*.ts` (`grep -rn "STEP:" src/` returns zero matches) |

## Standard Stack

Not applicable — this phase introduces zero new dependencies. It uses:

| Library | Version | Purpose | Why Standard (for this repo) |
|---------|---------|---------|-------------------------------|
| zod | (already in package.json) | Not needed for crossref itself (`MeetingResult`/`NewsCuration` are already parsed upstream); no new schema required | Existing project standard for all `tmp/*.json` boundary validation |
| vitest | (already in package.json, `"test": "vitest run"`) | Unit tests for `digest-crossref.ts` and renderer | Existing project's sole test runner |

**Installation:** None required.

## Package Legitimacy Audit

Not applicable — this phase installs no external packages. No `npm view`/slopcheck run was needed or performed.

## Architecture Patterns

### System Architecture Diagram

```
tmp/meeting-result.json ──┐
                           ├─▶ digest-crossref.ts::buildDigestCrossRefMap(curation, meetingResult)
tmp/news-curation.json ───┤        │
  (already resolved to    │        ├─ 1. per article: matchesArticleTicker (ticker set from
   NewsCuration by         │        │     highlightedStocks[].ticker ∪ roundSummary.scoredTickers)
   resolveNewsCuration) ───┘        │     → early-continue if matched (ticker wins, D-04)
                                    ├─ 2. else: resolveThemeMatch (title-only, sectorRecommendations[].sector,
                                    │     case-insensitive substring, keyword extracted from "Name (TICKER)")
                                    ├─ 3. rankAndCapAnnotations: ticker-matches first (max 2), theme-matches
                                    │     next (max 1), stable order within each group
                                    └─▶ Record<articleId, DigestCrossRef>  (pure, no throw, no I/O)
                                             │
write-news-digest.ts ◀──────────────────────┘  (isolated try/catch — exception → {} empty map)
     │
     ├─ existing try/catch: resolveNewsCuration → generateNewsDigestHtml(curation, date, crossRefMap)
     │        (curation===null or invalid → fallback HTML, exit 1 — UNCHANGED by crossref)
     │
     ▼
generateNewsDigestHtml → formatMarketGroupsHtml → formatArticleCardHtml(article, crossRefMap[article.id])
     │
     ▼
docs/{date}/news-digest.html  (static, deployed via existing Step 4 pipeline — unaffected)
```

### Recommended Project Structure
```
src/meeting/
├── digest-crossref.ts       # NEW: pure matching module (mirrors holding-news.ts)
├── digest-crossref.test.ts  # NEW: unit tests (mirrors holding-news.test.ts)
├── types.ts                 # UNCHANGED (read-only consumption of MeetingResult/CuratedArticle)
└── schemas.ts                # UNCHANGED (read-only)

src/scripts/
├── generate-news-digest.ts       # MODIFIED: optional crossRefMap param, additive only
├── generate-news-digest.test.ts  # MODIFIED: add cases for the new optional param (existing cases must still pass unmodified)
├── write-news-digest.ts          # MODIFIED: isolated inner try/catch around crossref
└── write-news-digest.test.ts     # MODIFIED: add crossref-throws-but-digest-succeeds case

src/scripts/report-utils.ts   # UNCHANGED (reuse escapeHtml, generateBaseStyles; optionally add one CSS rule for the new chip class)

.claude/commands/invest.md    # MODIFIED: Step 3e gets one more conditional echo block for [STEP:digest-crossref:*]
```

### Pattern 1: Ticker-priority matching with early-continue (from `holding-news.ts:149-165`)
**What:** For each article, check ticker match first; if matched, record and `continue` (skip theme check entirely) — never evaluate both signals for the same article.
**When to use:** Any place two match signals exist with an explicit priority order (D-01, D-04).
**Example (existing code to mirror):**
```typescript
// Source: src/portfolio/holding-news.ts:149-165
export function matchArticlesForHolding(
  articles: ReadonlyArray<NewsArticleWithId>,
  holding: PortfolioHolding,
): ReadonlyArray<HoldingArticleMatch> {
  const matches: HoldingArticleMatch[] = [];
  for (const article of articles) {
    if (matchesTicker(article, holding)) {
      matches.push({ article, matchType: "ticker" });
      continue;
    }
    const nameMatchType = resolveNameMatchType(article.title, holding);
    if (nameMatchType !== null) {
      matches.push({ article, matchType: nameMatchType });
    }
  }
  return matches;
}
```
**Digest-crossref translation:** invert the loop direction — `holding-news.ts` iterates "per holding, scan all articles"; digest-crossref should iterate "per article, scan match signals" since the output is `Record<articleId, annotation>` keyed by article, not by holding/ticker. The matching primitives (ticker-first, early-continue) are what to reuse; the iteration shape is naturally different because the join key differs (article ID vs. holding symbol).

### Pattern 2: Title-only keyword matching (from `holding-news.ts:105-130`)
**What:** `titleIncludesAny` lower-cases the title once, then does `.some(c => lowerTitle.includes(c.toLowerCase()))` over a candidate list. Only `title` is ever passed — `commentary`/`summary` fields are never evaluated (D-03).
**Example (existing code to mirror):**
```typescript
// Source: src/portfolio/holding-news.ts:105-111
function titleIncludesAny(
  title: string,
  candidates: ReadonlyArray<string>,
): boolean {
  const lowerTitle = title.toLowerCase();
  return candidates.some((c) => lowerTitle.includes(c.toLowerCase()));
}
```
**Digest-crossref translation:** candidates = extracted sector keywords from `sectorRecommendations[].sector` (see Pitfall 1 for the extraction step — do not pass the raw `"Healthcare (XLV)"` string as-is).

### Pattern 3: Rank-and-cap with type priority (from `holding-news.ts:172-192`)
**What:** Split matches by type, keep the higher-priority type's full list, cap the combined list.
**Example (existing code, note the score-based sort which digest-crossref does NOT need — see Pitfall 4):**
```typescript
// Source: src/portfolio/holding-news.ts:172-192
export function rankAndCapHoldingArticles(
  matches: ReadonlyArray<HoldingArticleMatch>,
  now: number,
  portfolioTickers: ReadonlyArray<string>,
): ReadonlyArray<HoldingNewsEntry> {
  const scored = matches.map((m) => ({ ...m, score: calculatePriorityScore(m.article, now, portfolioTickers) }));
  const tickerMatches = scored.filter((m) => m.matchType === "ticker").sort((a, b) => b.score - a.score);
  const nameMatches = scored.filter((m) => m.matchType !== "ticker").sort((a, b) => b.score - a.score);
  return [...tickerMatches, ...nameMatches].slice(0, MAX_ARTICLES_PER_HOLDING).map(...);
}
```
**Digest-crossref translation (per D-10):** No score/`calculatePriorityScore` needed — D-10 mandates "順序は決定論的（ティッカー→テーマ、各内は元順序の安定順）", i.e., ticker matches first (cap 2), theme matches next (cap 1), **stable original-array order within each group** (no re-sorting by recency/score). This is simpler than `holding-news.ts` — do not import `calculatePriorityScore` for this module; `Array.prototype.sort` is not even needed, just `.filter(...).slice(0, N)` twice, preserving array iteration order (JS array methods are order-preserving).

### Pattern 4: Additive optional-parameter renderer extension
**What:** `generateNewsDigestHtml(curation, date)` → `generateNewsDigestHtml(curation, date, crossRefMap?)`. When `crossRefMap` is `undefined` (or omitted), output must be byte-identical to current behavior.
**Example (current signature to extend, `src/scripts/generate-news-digest.ts:104`):**
```typescript
export function generateNewsDigestHtml(curation: NewsCuration | null, date: string): string {
```
becomes:
```typescript
export function generateNewsDigestHtml(
  curation: NewsCuration | null,
  date: string,
  crossRefMap?: Readonly<Record<string, DigestCrossRef>>,
): string {
```
`formatArticleCardHtml(a: CuratedArticle)` (line 47) similarly gains an optional 2nd param `annotation?: DigestCrossRef`, and `formatMarketGroupsHtml` must thread `crossRefMap[a.id]` through to each card call. Because parameters are added at the end and are optional, all existing call sites (including `write-news-digest.ts`'s current call and all existing tests in `generate-news-digest.test.ts`) continue to compile and behave identically without modification — this is what "byte-identical 0-annotation rendering" requires structurally, not just conceptually.

### Anti-Patterns to Avoid
- **Re-sorting theme/ticker matches by recency or priority score:** `holding-news.ts` does this because it curates a *ranked feed*; digest-crossref only needs a deterministic annotation per already-selected article, so importing `calculatePriorityScore` or doing an extra `Date.now()`-based sort adds untested complexity D-10 doesn't ask for.
- **Passing `commentary` into keyword matching:** D-03 explicitly restricts theme matching to `title` only, mirroring `filter.ts`'s title-only denylist pattern (cited in `holding-news.ts:117` comment) — do not widen this without a corresponding CONTEXT.md decision update.
- **Making the crossref try/catch share scope with the digest try/catch:** the existing `write-news-digest.ts` try block (lines 20-36) already ends with `generateNewsDigestHtml(curation, date)` and its catch sets `process.exit(1)` — if crossref computation is placed inside that same try block, any crossref exception will incorrectly trigger the `curation === null` fallback page and exit 1, which is exactly the bug D-13 exists to prevent.
- **Emitting `[STEP:digest-crossref:*]` from inside `digest-crossref.ts` or `write-news-digest.ts` via `console.log`/`console.error` and expecting it to literally become a `[STEP:...]` line in invest.md's transcript:** the STEP markers are always `echo`'d as separate bash commands in invest.md, driven by a condition the orchestrating agent evaluates (exit code, or — as shown in the Round 1 pattern — the agent's own observation of prior output/counts). A script's `console.error` output is *visible* to the calling agent (as tool-call stdout/stderr) but does not automatically become a `[STEP:...]` line; invest.md must add an explicit `echo '[STEP:digest-crossref:...]'` block that the agent runs after inspecting the result.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Symbol normalization | A new normalizer for digest-crossref | `normalizeHoldingSymbol` from `src/portfolio/holding-news.ts` (import it directly — it's already exported) | D-15 explicitly mandates reuse; duplicating trim+toUpperCase logic in two files risks divergence if one is ever changed |
| HTML escaping | A new escape function | `escapeHtml` from `src/scripts/report-utils.ts` | Already the single source of truth for HTML-safety in every renderer in this repo; the annotation chip text (verdict, sector name) must go through it just like every other user/LLM-derived string |
| Case-insensitive substring matching helper | A new helper | Copy the exact `titleIncludesAny` pattern (or literally import/reuse it if visibility allows) from `holding-news.ts:105-111` | Already proven correct via `holding-news.test.ts`; re-deriving it risks subtly different `.toLowerCase()` semantics |

**Key insight:** This phase is 95% "port an existing, tested design to a new join key (article ID instead of holding symbol)" — the only genuinely new logic is (a) building the ticker-set from `highlightedStocks[].ticker ∪ roundSummary.scoredTickers`, (b) extracting a matchable keyword from `sectorRecommendations[].sector` strings that contain a parenthetical ETF ticker, and (c) the fail-soft try/catch isolation in the pipeline script.

## Common Pitfalls

### Pitfall 1: `sectorRecommendations[].sector` is not a clean matchable keyword
**What goes wrong:** Real production data (`tmp/meeting-result.json`, inspected directly this session) shows `sector` values like `"Healthcare (XLV)"`, `"Financials (XLF)"`, `"Energy (XLE)"`, `"Technology (XLK)"`, `"Semiconductors (SMH)"` — an English sector label plus a parenthetical ETF ticker suffix. CONTEXT.md's illustrative example (`半導体`) implies a clean Japanese label, but that is not what the field actually contains today. `title.toLowerCase().includes("healthcare (xlv)")` will essentially never match a real news headline because headlines don't reproduce this exact bracketed-ticker format.
**Why it happens:** `sectorRecommendations[].sector` was designed for tabular display in `daily-report.html` (`generate-daily-report.ts:33`: `<td><strong>${escapeHtml(s.sector)}</strong></td>`), not for substring matching against free-text titles.
**How to avoid:** Extract the matchable keyword by stripping the trailing parenthetical before calling the title-includes check, e.g. `sector.replace(/\s*\([^)]*\)\s*$/, "").trim()` → `"Healthcare"`, `"Semiconductors"`. This is a plain, deterministic string transform (no LLM), consistent with D-07's "決定論的に導出" requirement. The planner should decide (Claude's Discretion, per CONTEXT.md) whether the *displayed* chip text uses the stripped label or the raw string — stripped is more readable and avoids showing a redundant ticker inside a theme-match chip.
**Warning signs:** If digest-crossref.test.ts is written using only synthetic/clean sector strings (e.g. `"半導体"`) and never a realistic `"Semiconductors (SMH)"` fixture, this bug will not be caught by tests. **The planner must include at least one test fixture using the real `"Name (TICKER)"` format.**

### Pitfall 2: Isolating the crossref try/catch — exact code shape matters
**What goes wrong:** `write-news-digest.ts`'s existing structure (lines 20-36) is a single try block covering: read `news-curation.json` → validate → read `news.json` pool → `resolveNewsCuration` → `generateNewsDigestHtml` → `writeFile`. Its catch sets `process.exit(1)` and renders the `curation === null` fallback. If the crossref computation (which needs the *already-resolved* `curation` plus the *already-loaded* `meeting-result.json` raw JSON) is inserted anywhere inside that block without its own try/catch, any crossref exception is caught by the **outer** catch and misreported as a full digest generation failure — exactly the failure mode D-13 forbids ("crossref 失敗が digest の null フォールバックを誤発火させてはならない").
**Why it happens:** The natural place to compute crossref is right before calling `generateNewsDigestHtml`, which is textually inside the existing try block — an isolated try/catch must be nested there, not simply "added nearby".
**How to avoid:** Wrap only the crossref call in its own try/catch that always resolves to a `crossRefMap` value (empty object `{}` on any exception), e.g.:
```typescript
let crossRefMap: Readonly<Record<string, DigestCrossRef>> = {};
try {
  const meetingResult = JSON.parse(meetingRaw) as MeetingResult; // meetingRaw already read above for `date`
  crossRefMap = buildDigestCrossRefMap(curation, meetingResult);
} catch (crossRefError) {
  console.error("digest-crossref failed:", crossRefError instanceof Error ? crossRefError.message : crossRefError);
  // crossRefMap stays {} — digest generation below is completely unaffected
}
const html = generateNewsDigestHtml(curation, date, crossRefMap);
```
This must sit *inside* the existing outer try block (so it has access to `curation`) but the nested try/catch must **never rethrow and never touch `process.exit`/`process.exitCode`** — its only observable effect is the value of `crossRefMap`.
**Warning signs:** A test where `MeetingResult` JSON is deliberately malformed/incompatible but `news-curation.json`/`news.json` are valid — if `write-news-digest.test.ts`'s exit-code expectation becomes `1` in that scenario, isolation has failed (it must stay `0`/undefined, i.e. digest still succeeds).

### Pitfall 3: `meeting-result.json` is currently only partially parsed in `write-news-digest.ts`
**What goes wrong:** Today's code (`write-news-digest.ts:15`) does `const { date } = JSON.parse(meetingRaw) as { date: string }` — it discards everything except `date`. If digest-crossref needs `highlightedStocks`/`sectorRecommendations`/`roundSummary`, the raw JSON must be re-cast to the full `MeetingResult` type (or re-parsed with `validateMeetingResult` from `schemas.ts` for structural safety) — a naive `as { date: string }` cast elsewhere in the file will not give TypeScript-level access to the other fields.
**How to avoid:** Either broaden the existing cast/parse to the full `MeetingResult` shape once (reusing the already-parsed `JSON.parse(meetingRaw)` value — no need to re-read the file) and pass it into the crossref try/catch, or call `validateMeetingResult(JSON.parse(meetingRaw))` for schema safety (accepting that this can throw — but since it must happen *inside* the isolated crossref try/catch per Pitfall 2, a validation throw here is a legitimate, correctly-contained crossref failure mode, not a digest failure).
**Warning signs:** TypeScript compile errors accessing `.highlightedStocks` etc. on a value typed as `{ date: string }`.

### Pitfall 4: Reusing `calculatePriorityScore`/`Date.now()` unnecessarily
**What goes wrong:** Copy-pasting `rankAndCapHoldingArticles` verbatim would pull in `calculatePriorityScore(article, now, portfolioTickers)`, which needs `article.publishedAt` as a `Date` and a `now: number` — but D-10 for digest-crossref explicitly wants stable original-order slicing, not recency scoring. Importing this dependency adds an untested, unnecessary coupling to `src/data/news/filter.ts` and to wall-clock time (`Date.now()`), which the project's own conventions (STATE.md: "`performance.now()` 採用: NTPジャンプによる負値防止のため `Date.now()` 禁止") flag as a pattern to avoid for anything beyond simple wall-clock display.
**How to avoid:** Do not import `calculatePriorityScore`. Cap with plain `.filter(...).slice(0, N)`, relying on JS's guaranteed array/iteration order.
**Warning signs:** `digest-crossref.ts` importing anything from `src/data/news/filter.ts`.

### Pitfall 5: Ticker format mismatch is a non-issue in practice — but only if both sides use the same source fields
**What goes wrong (avoided if noted):** In principle, one might worry `CuratedArticle.tickers` (US: `"NVDA"`, JP: bare `"7203"`) could mismatch `highlightedStocks[].ticker`/`scoredTickers` (JP: `"7203.T"` with suffix). **Verified against real production data** (`tmp/news-curation.json`, `tmp/meeting-result.json` inspected this session): JP tickers in `CuratedArticle.tickers` are already suffixed identically (`"6835.T"`, `"6326.T"`), matching `highlightedStocks`/`scoredTickers` JP format 1:1. This convention is also explicitly enforced in every LLM prompt in `invest.md` (`"picksのtickerは必ず英数字ティッカー形式（例: AAPL, 7203.T）で記入してください"`, appearing 5 times) and in `tmp/moderator-tickers.json` generation (`tickerSet.add(m[1] + '.T')`, line 463). So `normalizeHoldingSymbol` (trim+uppercase only) per D-15 is sufficient — no `.T`-suffix reconciliation logic is needed.
**Why flag it anyway:** A test fixture using the simplified synthetic format seen in `generate-news-digest.test.ts` (`tickers: ["7203"]`, no suffix) does NOT represent real JP ticker format and should not be used as the sole JP fixture in `digest-crossref.test.ts` — use `"6326.T"`-style fixtures to match reality.
**Warning signs:** None expected if `normalizeHoldingSymbol` is reused per D-15; this pitfall is here purely to preempt an unnecessary reconciliation layer being built.

## Code Examples

### `report-utils.ts` reusable primitives (exact excerpts)
```typescript
// Source: src/scripts/report-utils.ts:8-11
export function safeHref(url: string): string | null {
  return url.startsWith("http://") || url.startsWith("https://") ? url : null;
}

// Source: src/scripts/report-utils.ts:26-33
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
```

### `.ticker-pill` / `.news-card` / `.news-meta` CSS (exact excerpt, `report-utils.ts` approx L194-216 within `generateBaseStyles`)
```css
.ticker-pill {
  display: inline-block;
  background: #2a2a3e;
  color: #c4b5fd;
  font-size: 0.8rem;
  padding: 0.15rem 0.5rem;
  margin-right: 0.4rem;
  margin-bottom: 0.3rem;
  border-radius: 999px;
  border: 1px solid #3f3f5a;
}
.news-meta {
  color: #888;
  font-size: 0.85rem;
  margin-bottom: 0.5rem;
}
```
Purple accent used by news-digest.html: `generateNewsDigestHtml` calls `generateBaseStyles("#8b5cf6")` (`generate-news-digest.ts:105`); `ACCENT_VARIANTS["#8b5cf6"]` resolves to `{ light: "#a78bfa", lighter: "#c4b5fd" }` (`report-utils.ts:1-6`). A new `.digest-crossref-chip` class should reuse one of these three existing purple tones (`#8b5cf6`/`#a78bfa`/`#c4b5fd`) rather than introducing a fourth arbitrary color, per D-09's "既存のパープルアクセントとの調和" and CONTEXT.md's discretion note.

### Card structure to extend (exact excerpt, `generate-news-digest.ts:47-64`)
```typescript
function formatArticleCardHtml(a: CuratedArticle): string {
  const badge = importanceBadgeHtml(a.importance);
  const timeJst = formatPublishedAtJst(a.publishedAt);
  const tickersHtml = formatTickerPillsHtml(a);
  const href = safeHref(a.url);
  const titleHtml = href
    ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(a.title)}</a>`
    : escapeHtml(a.title);
  const metaTail = tickersHtml ? ` ・ ${tickersHtml}` : "";

  return `<div class="agent-card news-card">
      <h4>${badge} ${titleHtml}</h4>
      <p class="news-meta">${escapeHtml(a.source)} ・ ${escapeHtml(timeJst)}${metaTail}</p>
      <p>${escapeHtml(a.commentary)}</p>
    </div>`;
}
```
Per D-08, the new annotation row must be inserted as an additional line **below** `.news-meta` and **above or below** the commentary `<p>` (D-08 says "news-meta 行の下"; exact position relative to the commentary paragraph is Claude's Discretion per CONTEXT.md as long as it doesn't touch the `<h4>` badge/title line). When there is no annotation for an article (`crossRefMap[a.id]` is `undefined`), the function must render **zero extra markup** — not an empty `<p>` tag — per D-09/Success Criteria #4 ("注記行を一切描画しない").

### Real `sectorRecommendations` production shape (verified via `tmp/meeting-result.json`, this session)
```json
{
  "rank": 1,
  "sector": "Healthcare (XLV)",
  "rationale": "...",
  "outlook": "強気"
}
```

### Real `highlightedStocks`/`scoredTickers` production shape (verified via `tmp/meeting-result.json`, this session)
```json
{
  "highlightedStocks": [
    { "ticker": "XLV", "averageScore": 6.4, "verdict": "強気", "summary": "...", "agentScores": [...], "nominatedBy": [...] },
    { "ticker": "6326.T", "averageScore": 6, "verdict": "強気", "summary": "...", ... }
  ],
  "roundSummary": { "scoredTickers": ["XLV", "6326.T", "FXY", "XLF", "XLE", "KRKNF", "AXTI", "6835.T", "SMH", "USO"] }
}
```
Note `scoredTickers` contains entries (`FXY`, `KRKNF`, `AXTI`, `USO`) that are **not** in `highlightedStocks` — these are the D-05 "verdict なし" case (ticker matched via `scoredTickers` only, display symbol without verdict).

### Real `CuratedArticle.tickers` matching a `scoredTickers`/`highlightedStocks` entry (verified via `tmp/news-curation.json`, this session)
```json
{ "id": "n47", "tickers": ["XLE", "USO"], "market": "global", "importance": "high", ... }
```
`XLE` and `USO` both appear in the `scoredTickers` list above — this is a real, working ticker-match example the planner can use as an integration test fixture.

## State of the Art

Not applicable in the external-library sense — this is a purely internal architectural pattern question. The relevant "current approach" is the project's own v2.4/v2.5 established convention:

| Old Approach (pre-v2.4) | Current Approach (v2.4+) | When Changed | Impact |
|--------------------------|---------------------------|---------------|--------|
| N/A (no cross-referencing existed before) | ID-referenced, TS-side deterministic matching (holding-news.ts, Phase 19) | v2.5 (Phase 19-20) | Phase 24 extends this exact pattern from "holding ↔ portfolio news" to "digest article ↔ meeting discussion" |

**Deprecated/outdated:** None — this phase is additive to an established, still-current pattern.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The exact CSS color values / emoji prefixes for the new chip are left to implementation-time discretion per CONTEXT.md; this research recommends reusing `#8b5cf6`/`#a78bfa`/`#c4b5fd` without inventing a new hex value | Code Examples | Low — purely cosmetic, explicitly marked as Claude's Discretion in CONTEXT.md, no functional risk |
| A2 | STEP marker for crossref should be emitted from `invest.md` (not from within the TS script) based on the agent observing the script's console output for a crossref-specific error string | Anti-Patterns / Pitfall 2 | Medium — if the planner instead expects the script itself to somehow directly control the STEP marker text, the implementation will need an explicit signal-passing mechanism (e.g., writing a status field to a small JSON, or a distinctly-greppable stderr line) that the invest.md Step 3e block conditionally reads; this needs to be spelled out precisely in the plan since it's a new pattern (existing patterns rely on exit codes, which are unavailable here per D-13's isolation requirement) |
| A3 | Stripping the trailing `" (TICKER)"` parenthetical from `sector` strings via regex before theme-keyword matching is the correct fix for Pitfall 1 | Pitfall 1 | Medium — this is a reasonable, deterministic, testable fix, but it is a new design decision not explicitly present in CONTEXT.md's D-03/D-06; the planner (or a lightweight discuss-phase follow-up) should confirm this approach before implementation, since an alternative (e.g., also matching on the bracketed ETF ticker as an extra "theme ticker" signal) is possible and was not evaluated by the user |

**If this table is empty:** N/A — see entries above; none of these threaten the phase's core Success Criteria, but A2 and A3 should be surfaced to the planner as concrete design choices to make explicit in PLAN.md rather than left implicit.

## Open Questions (RESOLVED)

> **Both resolved during planning (Phase 24 plans 24-01..24-03).**
> - **Q1 → RESOLVED (Plan 24-03, "LOCKED DESIGN DECISION"):** Option (a) — `write-news-digest.ts`'s isolated crossref catch emits a distinctly-prefixed stderr line (`[digest-crossref] OK` / `[digest-crossref] FAIL:`); `invest.md` Step 3e observes it and echoes the dedicated `[STEP:digest-crossref:OK|FAIL:...]` marker. Chosen over (b) for zero new file I/O and to preserve the existing invest.md-only STEP-echo invariant.
> - **Q2 → RESOLVED (24-UI-SPEC.md Copywriting Contract):** Display the stripped English sector label as-is (e.g. "🗣 関連テーマ: Healthcare"); no English→Japanese translation dictionary introduced this phase (consistent with `generate-daily-report.ts:33` displaying `sector` verbatim). Japanese labels are a deferred follow-up.

1. **How exactly should the crossref STEP marker be signaled from script to `invest.md`?**
   - What we know: Every existing `[STEP:*]` marker is `echo`'d directly in `invest.md`, driven either by a shell exit code (`news-digest`, `deploy`, `report-generation`) or by the calling agent's own count/observation during the pipeline (`round-1`'s "3人以上失敗" check happens in agent-executed logic, not a script exit code). `write-news-digest.ts`'s single exit code is already claimed by `[STEP:news-digest:*]` and, per D-13, must NOT be affected by crossref failure — so a second, independent signal channel is needed.
   - What's unclear: Whether the planner should (a) have the isolated catch block `console.error` a distinctly-prefixed message (e.g., `"[digest-crossref] failed:"`) that the invest.md Step 3e instructions tell the agent to grep for in the just-executed command's output, or (b) have `write-news-digest.ts` write a tiny separate status indicator (e.g., append `crossRefOk: boolean` to an existing small JSON like `tmp/pipeline-metrics.json`, which invest.md already reads/writes in this exact step) that invest.md reads before echoing the marker.
   - Recommendation: Option (b) is slightly more robust (parseable JSON vs. string-matching stdout) and reuses the `tmp/pipeline-metrics.json` file `write-news-digest.ts`'s surrounding invest.md block already touches for timestamps — but option (a) requires zero new file I/O. Planner should pick one explicitly in PLAN.md; either satisfies D-14's constraint that the marker be crossref-specific and independent of `[STEP:news-digest:*]`.

2. **Should the theme-match display chip show the stripped sector keyword (`"Healthcare"`) or something else (e.g., a Japanese translation)?**
   - What we know: CONTEXT.md D-06's example (`半導体`) implies Japanese display text, but the actual `sectorRecommendations[].sector` field is English + parenthetical ticker (see Pitfall 1). There is no existing English→Japanese sector name mapping anywhere in this codebase.
   - What's unclear: Whether introducing a small English→Japanese sector label dictionary is in scope, or whether displaying the English sector name as-is (e.g., "🗣 関連テーマ: Healthcare") is acceptable for this phase.
   - Recommendation: Display the stripped English label as-is (no translation dictionary) to keep this phase's scope minimal and avoid introducing an unmaintained mapping table; this is consistent with `daily-report.html` already displaying `sector` verbatim in English today (`generate-daily-report.ts:33`). If Japanese labels are desired, treat as a follow-up decision, not blocking Phase 24.

## Environment Availability

Skipped — this phase has no new external tool/service/runtime dependencies. It uses only the existing Node.js/tsx/vitest toolchain already required by every other phase in this repo.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (already configured via `package.json` `"test": "vitest run"`, no `vitest.config.ts` present — uses vitest defaults) |
| Config file | none — see Wave 0 |
| Quick run command | `npx vitest run src/meeting/digest-crossref.test.ts` |
| Full suite command | `npm test` (runs `vitest run` across the whole repo) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| XREP-01 | Ticker match produces annotation with symbol+verdict when in `highlightedStocks` | unit | `npx vitest run src/meeting/digest-crossref.test.ts -t "ticker"` | ❌ Wave 0 |
| XREP-01 | Ticker match via `scoredTickers`-only produces symbol without verdict | unit | `npx vitest run src/meeting/digest-crossref.test.ts -t "scoredTickers"` | ❌ Wave 0 |
| XREP-01 | Theme match against realistic `"Name (TICKER)"` sector string succeeds after keyword extraction | unit | `npx vitest run src/meeting/digest-crossref.test.ts -t "theme"` | ❌ Wave 0 |
| XREP-01 | Ticker match takes priority over theme match (early-continue) | unit | `npx vitest run src/meeting/digest-crossref.test.ts -t "priority"` | ❌ Wave 0 |
| XREP-01 | Cap: max 2 ticker + max 1 theme annotation per article, stable order | unit | `npx vitest run src/meeting/digest-crossref.test.ts -t "cap"` | ❌ Wave 0 |
| XREP-01 | Renderer: 0-annotation call produces byte-identical HTML to pre-Phase-24 baseline | unit | `npx vitest run src/scripts/generate-news-digest.test.ts` (existing suite must still pass unmodified) | ✅ (existing file, extend) |
| XREP-01 | Renderer: annotated article shows chip below `.news-meta`, escaped | unit | `npx vitest run src/scripts/generate-news-digest.test.ts -t "crossref"` | ❌ Wave 0 (new cases in existing file) |
| XREP-02 | `write-news-digest.ts`: crossref throws → digest still writes, exit code unaffected (stays 0 when curation is otherwise valid) | integration | `npx vitest run src/scripts/write-news-digest.test.ts -t "crossref"` | ❌ Wave 0 (new case in existing file) |
| XREP-02 | `write-news-digest.ts`: crossref throws does NOT trigger `curation === null` fallback text | integration | `npx vitest run src/scripts/write-news-digest.test.ts -t "fallback"` | ❌ Wave 0 (new case in existing file) |
| XREP-02 | Success Criteria #4: article with zero meeting-discussion overlap renders with no annotation row, no layout break | unit | `npx vitest run src/scripts/generate-news-digest.test.ts -t "no annotation"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/meeting/digest-crossref.test.ts src/scripts/generate-news-digest.test.ts src/scripts/write-news-digest.test.ts`
- **Per wave merge:** `npm test` (full suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/meeting/digest-crossref.ts` — implementation does not exist yet (this entire phase)
- [ ] `src/meeting/digest-crossref.test.ts` — new test file, follow `src/portfolio/holding-news.test.ts` structure (describe blocks per D-number, `makeArticle`/`makeMeetingResult` factory helpers with sensible defaults + overrides, exactly as `holding-news.test.ts`'s `makeArticleWithId`/`makeHolding` factories do)
- [ ] No new test framework/config install needed — vitest already fully configured

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Static site generator, no auth surface touched by this phase |
| V3 Session Management | no | No sessions in this codebase |
| V4 Access Control | no | No access control surface touched |
| V5 Input Validation | yes | `MeetingResult`/`CuratedArticle` are already validated upstream via `schemas.ts` zod schemas before reaching digest-crossref; digest-crossref itself should not re-validate (it's a pure consumer) but must not `throw` on malformed-but-schema-valid data (e.g., empty arrays) — fail-soft via safe defaults, not zod |
| V6 Cryptography | no | Not applicable |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via unescaped LLM-derived or meeting-derived text in the new annotation chip (verdict string, sector name) | Tampering/Information Disclosure | Every string interpolated into the chip HTML (symbol, verdict, sector keyword) MUST go through `escapeHtml` from `report-utils.ts`, exactly as every other field in `formatArticleCardHtml` already does — this is the single existing control in this codebase and must be applied to 100% of new interpolated strings, with no exceptions for "trusted" TS-derived values (verdict enum values are safe today, but `sector`/`ticker` strings ultimately originate from LLM output validated only by zod `z.string()`, not an enum, so they are not guaranteed-safe and must be escaped) |
| Crossref exception uncontrolled propagation causing pipeline-wide failure (a form of Denial of Service against the reporting pipeline) | Denial of Service | The isolated try/catch (Pitfall 2) is precisely this phase's DoS mitigation — enforced by XREP-02/D-13, tested via Validation Architecture's integration test row |

## Sources

### Primary (HIGH confidence — direct code reads this session)
- `/Users/arai/invest/src/portfolio/holding-news.ts` (full file) — design template
- `/Users/arai/invest/src/portfolio/holding-news.test.ts` (full file) — test pattern template
- `/Users/arai/invest/src/meeting/types.ts` (full file) — `MeetingResult`/`CuratedArticle`/`NewsCuration` shapes
- `/Users/arai/invest/src/meeting/schemas.ts` (partial, L1-220) — `meetingResultSchema`, `curatedArticleRawSchema`, `holdingEvaluationSchema` lenient-parsing patterns
- `/Users/arai/invest/src/scripts/generate-news-digest.ts` (full file) — renderer to extend
- `/Users/arai/invest/src/scripts/generate-news-digest.test.ts` (partial, L1-150) — test pattern
- `/Users/arai/invest/src/scripts/write-news-digest.ts` (full file) — pipeline integration point
- `/Users/arai/invest/src/scripts/write-news-digest.test.ts` (full file) — integration test pattern (fs mocking style)
- `/Users/arai/invest/src/scripts/report-utils.ts` (L1-260) — `escapeHtml`, `safeHref`, `.ticker-pill`/`.news-card`/`.news-meta`, `generateBaseStyles`/`ACCENT_VARIANTS`
- `/Users/arai/invest/.claude/commands/invest.md` (Step 3e region, L1950-2040; STEP marker grep across full file) — pipeline orchestration and STEP marker convention (verified: zero `[STEP:` occurrences inside `src/`, confirming markers are invest.md-only)
- `/Users/arai/invest/src/data/news/filter.ts` (L235-270) — `calculatePriorityScore` (confirmed NOT needed for digest-crossref, per Pitfall 4)
- `/Users/arai/invest/src/data/news/article-id.ts` (full file) — article ID assignment scheme (`n01`..`n80`), confirms ID is the join key
- `/Users/arai/invest/tmp/meeting-result.json` (live production data, inspected this session) — real `sectorRecommendations`/`highlightedStocks`/`scoredTickers` shapes, revealing Pitfall 1
- `/Users/arai/invest/tmp/news-curation.json` (live production data, inspected this session) — real `CuratedArticle.tickers` JP ticker format, resolving Pitfall 5
- `/Users/arai/invest/.planning/phases/24-digest-meeting-cross-reference/24-CONTEXT.md` — all D-01..D-15 locked decisions
- `/Users/arai/invest/.planning/REQUIREMENTS.md`, `/Users/arai/invest/.planning/STATE.md`, `/Users/arai/invest/.planning/ROADMAP.md` (Phase 24 section) — requirement/roadmap traceability
- `/Users/arai/invest/package.json`, `/Users/arai/invest/tsconfig.json` — confirmed vitest test runner, ES2022/bundler module resolution, no separate vitest.config

### Secondary (MEDIUM confidence)
- None — no WebSearch/Context7 lookups were performed or needed for this internal-codebase-only phase.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: N/A — no new dependencies
- Architecture (mirroring holding-news.ts): HIGH — verified via direct, complete file reads of both the template and its test suite
- STEP marker convention: HIGH — verified via exhaustive `grep -rn "STEP:"` across both `invest.md` (22 matches, all `echo`) and `src/` (zero matches)
- Pitfall 1 (sector string format): HIGH — verified via live production `tmp/meeting-result.json` data, not assumption
- Pitfall 5 (ticker format reconciliation): HIGH — verified via live production `tmp/news-curation.json` + `invest.md` prompt text enforcing `.T` suffix convention
- Open Question 1 (STEP marker signaling mechanism) and Assumption A3 (sector keyword extraction approach): MEDIUM — these are genuinely novel design decisions this phase introduces; the recommendation is sound but was not user-confirmed in CONTEXT.md, so the planner should make the choice explicit in PLAN.md

**Research date:** 2026-07-04
**Valid until:** Indefinite for the internal-codebase findings (they reflect the current committed state of the repo, not an external moving target) — re-verify only if `holding-news.ts`, `write-news-digest.ts`, `generate-news-digest.ts`, or `meeting/types.ts` are modified by another phase before Phase 24 executes.

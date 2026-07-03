# Pitfalls Research

**Domain:** Adding per-holding news injection + WebSearch re-evaluation to an existing unattended daily AI investment pipeline (v2.5 Portfolio News Intelligence)
**Researched:** 2026-07-03
**Confidence:** HIGH (grounded directly in current codebase: `src/data/news/finnhub.ts`, `src/data/news/filter.ts`, `src/meeting/schemas.ts`, `src/scripts/generate-report.ts`, `src/scripts/generate-portfolio-report.ts`, `.claude/commands/invest.md` Step 3a-3d, `src/portfolio/holdings.ts`) plus MEDIUM-confidence external verification (WebSearch rate-limit reports, LLM anchoring-bias literature).

> **Note:** This file supersedes the v2.4-era PITFALLS.md (news-digest report addition pitfalls), which is no longer the active milestone. Those findings remain valid in the shipped code but are not repeated here — this file is scoped exclusively to the v2.5 Portfolio News Intelligence milestone.

This is a **subsequent milestone** on a live system with an established convention set (fail-soft STEP markers, ID-reference anti-hallucination pattern, zod raw→transform field-name aliasing, per-file try/catch degradation). Most pitfalls below are about **violating or inconsistently applying those existing conventions** when extending the pipeline — not generic AI-pipeline mistakes.

## Critical Pitfalls

### Pitfall 1: Reusing `tmp/websearch/` and `tmp/reeval/` for holdings research contaminates the Daily Report

**What goes wrong:**
The Daily Report's `loadWebSearchResults()` / `loadReevalResults()` in `src/scripts/generate-report.ts` read **every** `*.json` file in `tmp/websearch/` and `tmp/reeval/` wholesale (`readdir` + parse-all, no filtering by origin) and render them into `generate-daily-report.ts`'s WebSearch/re-evaluation sections. This directory pair is already used by the existing `highlightedStocks` (new-candidate) WebSearch+re-evaluation round (Step 3a/3b in `invest.md`). If the new per-holding WebSearch research/re-evaluation for the 12 portfolio holdings writes its output files into the same two directories, holding-ticker research will silently leak into the Daily Report (and vice versa, candidate-ticker research could leak into the Portfolio Report if the holdings loader is written the same "read-everything" way).

**Why it happens:**
The existing loaders were written for a single WebSearch round (`highlightedStocks` only) and have no `source`/`origin` discriminator field — they trust "everything in this directory belongs to me." When a second WebSearch round is bolted on for a different purpose (holdings vs candidates), the most natural implementation mistake is to reuse the same directory names/patterns since the prompt template is being copy-pasted from Step 3a/3b.

**How to avoid:**
Use distinct directories for holdings research (e.g. `tmp/websearch-holdings/`, `tmp/reeval-holdings/`), with dedicated loader functions scoped to `generate-portfolio-report.ts` only. Do not extend or repurpose `loadWebSearchResults`/`loadReevalResults` in `generate-report.ts`. Verify with a grep after implementation: `tmp/websearch/` and `tmp/websearch-holdings/` (or equivalent) must never be written to by the same Agent step.

**Warning signs:**
Daily Report suddenly shows portfolio-holding tickers (MRNA, JOBY, HII, POWL, FLNC, EE, NXT, BWMX, or the 4 JP tickers) in its WebSearch/re-evaluation section, or the Portfolio Report shows `highlightedStocks` candidate tickers in holding cards.

**Phase to address:**
Phase implementing "保有銘柄ごとのWebSearchリサーチと売却・保有判断の再評価" — must be scoped/tested for directory isolation before merging, ideally with an integration test asserting `generate-daily-report.ts` output is byte-identical with and without holdings-research files present.

---

### Pitfall 2: Removing the new-candidates renderer breaks the `portfolioAnalysis === null` fallback path

**What goes wrong:**
`formatNewCandidatesHtml(result)` in `src/scripts/generate-portfolio-report.ts` is called **twice**: once at line ~103 inside the `portfolioAnalysis === null` fallback branch (rendered when the `portfolio-analyst` agent fails/retries twice and no `portfolio-analysis.json` is produced — an explicitly documented fail-soft path in `invest.md` Step 3d), and once at line ~128 in the normal success branch. A naive removal (e.g., deleting the function call from the success branch only, because that's the "visible" path exercised in manual testing) leaves the fallback branch calling a function that either no longer exists (compile error) or still renders the now-supposed-to-be-removed section only on failure days — an inconsistent, confusing regression that is easy to miss because the fallback path is rarely exercised (only triggers when the agent fails twice, which is rare and unattended).

**Why it happens:**
Manual verification of "did the section disappear?" naturally checks the happy path. The failure-path branch is a separate, rarely-executed code path that isn't hit by a normal test run of the pipeline, so it's easy to forget it exists.

**How to avoid:**
Grep for every call site of `formatNewCandidatesHtml` (and the `newCandidatesHtml` variable) before removing — both the null-branch and success-branch usages — and remove all of them together. Keep `MeetingResult.highlightedStocks` flowing into the `portfolio-analyst` prompt context (per PROJECT.md: "portfolio-analystへの文脈情報は維持") — only the *rendering* function/call sites should be deleted, not the underlying data plumbing. Add/update a test that constructs a `portfolioAnalysis === null` report and asserts the new-candidates table is absent from the fallback HTML too.

**Warning signs:**
`grep -n formatNewCandidatesHtml src/scripts/generate-portfolio-report.ts` returns more than zero matches after the "removal" commit. Fallback-path snapshot test (if one exists) fails or was never updated.

**Phase to address:**
Phase implementing "ポートフォリオレポートから新規組入候補セクションを削除" — verification step must explicitly exercise the `portfolioAnalysis === null` path, not just the happy path.

---

### Pitfall 3: Fixing the finnhub.ts index-as-ticker bug has silent downstream ripple effects

**What goes wrong:**
`fetchNewsByCategory()` in `src/data/news/finnhub.ts` (general/merger categories) does `.filter(...).map(toRawArticle)`. Because `Array.prototype.map` invokes its callback as `(item, index, array)`, and `toRawArticle(item, ticker?)`'s second parameter is positionally `ticker`, **every general/merger article silently receives `ticker: <array index>`** (a number, despite the field being typed `string`) instead of `ticker: undefined`. This is exactly the classic `.map(parseInt)` footgun, and TypeScript did not catch it here (optional-parameter bivariance in method-callback assignability). Concretely: the article at index 0 gets `ticker: 0` (which is **falsy** in JS — any downstream `if (article.ticker)` check silently treats it as "no ticker," while the article at index 1 gets `ticker: 1`, which is truthy and *will* render as a bogus ticker badge/pill if any UI does `if (article.ticker) renderPill(article.ticker)`).
When fixing this (removing the leaked index, i.e. `fetchNewsByCategory` should call `toRawArticle(item)` with no second arg, e.g. `(item) => toRawArticle(item)`), several downstream consumers change behavior:
- `filter.ts` `calculatePriorityScore()`: `portfolioTickers.includes(article.ticker)` — comparing a `string[]` against a stray number already always evaluated to `false`, so the score itself was accidentally correct; **but the bug fix changes `article.ticker` from `number` to `undefined`**, which is a type-correctness fix with no scoring behavior change — good to note in the fix's test assertions so a reviewer doesn't think the fix "does nothing."
- `filter.test.ts` / `finnhub.test.ts`: existing tests may assert on current (buggy) numeric-ticker behavior, or simply not assert on `ticker` at all for general/merger fixtures — must add an explicit regression test asserting `ticker === undefined` for non-company-news articles post-fix.
- News-digest ticker pills (`generate-news-digest.ts` `formatTickerPillsHtml`) and any future per-holding matching (`article.ticker === holding.symbol`) must not accidentally start matching numeric-string coincidences (unrealistic here since all 12 holding symbols are alphabetic or `.T`-suffixed, but any *new* code added for v2.5 that does loose `==` comparison instead of `===` is at risk).

**Why it happens:**
`.map(callbackWithExtraOptionalParam)` is a well-known but easy-to-miss JS pitfall; it compiles cleanly, produces no runtime error, and only manifests as subtly wrong data (extra falsy/truthy noise) rather than a crash — exactly the kind of bug that survives in a codebase for multiple phases (this shipped through v2.3 and v2.4 undetected).

**How to avoid:**
Fix by wrapping explicitly: `.map((item) => toRawArticle(item))`. Never pass a multi-arg function directly as a `.map`/`.forEach`/`.filter` callback unless its signature exactly matches `(value, index, array)`. Add an ESLint rule or code-review checklist item for this pattern project-wide (it's a class of bug, not a one-off). Add a unit test asserting `fetchNewsByCategory` output has `ticker === undefined` for all items regardless of array position (catches both the original bug and any regression).

**Warning signs:**
Any article with `category !== "company"` (i.e., general/merger sourced) showing a defined `ticker` field. Any UI element showing a numeric ticker badge (e.g., "0", "1", "2" pills) instead of a stock symbol.

**Phase to address:**
Phase implementing "finnhub.ts の汎用ニュース ticker 汚染バグ修正" — per PROJECT.md this is explicitly called out as the foundational fix ("本機能のデータ土台") and should land **before** the per-holding news injection phase, since the injection logic will filter `tmp/news.json` by `article.ticker === holding.symbol` and must not be built/tested against contaminated data.

---

### Pitfall 4: Per-holding news injection silently under-covers most holdings (especially JP small caps)

**What goes wrong:**
Only `finnhub.ts`'s `fetchCompanyNews()` (the per-ticker Finnhub `company-news` endpoint call, already shipped in v2.3) sets `article.ticker`. Neither `google-news.ts` nor `rss-sources.ts` ever populate the `ticker` field — they have no per-article company attribution at all. This means "supply per-holding news matched by ticker" (`tmp/news.json` filtered by `article.ticker === symbol`) will **only** ever surface Finnhub company-news hits. For the 4 Japanese small-cap holdings (`8522.T` The Bank of Nagoya, `5885.T` GDEP Advance, `5576.T` O.B.System, `7711.T` Sukagawa Electric — all micro/small caps), Finnhub's `company-news` endpoint is US-market-centric and frequently returns **zero or near-zero** results for thinly-covered Japanese small caps, even though the pipeline already ingests 5 Japanese RSS feeds that might well carry relevant news — those RSS articles simply never get ticker-matched because no code attributes them to a symbol.
The result: the feature will "work" (no errors, no fail-soft trigger) but silently produce an empty or near-empty news list for roughly a third of the portfolio, every day, indefinitely — giving false confidence that "no ticker-tagged news = no relevant news today" when it may really mean "this source never tags tickers."

**Why it happens:**
The `ticker` field was designed and shipped in v2.3 for Finnhub's own API-parameterized fetch (precise, no false positives) — not as a general cross-source attribution scheme. Extending "supply news matched by ticker" naively assumes the field is populated consistently across all sources.

**How to avoid:**
Before building the injection logic, explicitly decide and document the coverage boundary: either (a) accept Finnhub-only ticker attribution as MVP scope and make the empty case visibly distinct in the prompt/UI (e.g., portfolio-analyst prompt explicitly states "本銘柄については本日Finnhub提携ニュースなし" rather than silently omitting the section, so the agent doesn't infer "no news = fine" when it's really "no coverage"), or (b) add lightweight keyword/company-name matching against RSS/Google News titles for JP holdings specifically (using `nameJa`/`name` from `PORTFOLIO_HOLDINGS`) as a second-pass matcher — but if doing (b), see Pitfall 5 for the false-positive risk this introduces.
At minimum, log/measure per-holding match counts during a live pipeline run to quantify actual coverage before shipping, rather than assuming.

**Warning signs:**
Manual audit of a week's `tmp/news.json` shows JP holding tickers (`8522.T` etc.) essentially never appear in the `ticker` field. Portfolio Report's per-holding news cards are empty every day for the same subset of holdings.

**Phase to address:**
Phase implementing "保有銘柄別ニュースの portfolio-analyst への供給" — scope decision (Finnhub-only vs. add keyword matching) should be made explicit in that phase's plan, not discovered during live verification.

---

### Pitfall 5: Ticker-only WebSearch queries collide with unrelated real-world entities

**What goes wrong:**
Two of the 12 holdings have 2-3 letter tickers that collide with well-known non-ticker entities: **`EE`** (Excelerate Energy) is also the brand name of EE Limited, a major UK mobile network operator frequently in British news; **`NXT`** (Nextpower, per `src/portfolio/holdings.ts`) is also the London Stock Exchange ticker for **NEXT plc**, a large UK retailer, and historically the ticker for the Nxt cryptocurrency. The existing WebSearch research prompt template for `highlightedStocks` (Step 3a in `invest.md`) issues bare-ticker queries like `"{ticker} latest news 2026"` — if the same template is reused verbatim for holdings, queries like `"EE latest news 2026"` or `"NXT latest news 2026"` will return a meaningful fraction of results about the wrong company. Because the WebSearch research feeds directly into the re-evaluation round's sell/hold judgment (per the existing `reevaluationOutputSchema` pattern), contaminated research doesn't just add noise to a report — it can distort an actual investment decision (e.g., agent reads about EE Limited's UK telecom price hikes and mistakenly attributes relevance to Excelerate Energy's LNG business).

**Why it happens:**
The candidate-stock WebSearch template (Step 3a) was designed for tickers extracted from analyst discussion, which in practice tend to be less generic/collision-prone; reusing that exact prompt template for a fixed, known holdings list without auditing individual tickers for collision risk is the natural shortcut when copy-adapting an existing pattern.

**How to avoid:**
Always include the full company name alongside the ticker in WebSearch queries for holdings (e.g., `"Excelerate Energy (EE) stock latest news"` rather than `"EE latest news"`) — `PORTFOLIO_HOLDINGS` already has `name` and `nameJa` available for this. Additionally instruct the WebSearch sub-agent to verify each result's company identity against the provided name/sector before including it in `positiveFindings`/`negativeFindings` (a one-line prompt instruction: "結果が {name}（{ticker}）に関するものか必ず確認し、別企業・別銘柄の情報は除外すること"). Spot-check EE and NXT results manually during phase verification since these are the two known highest-risk tickers in this specific portfolio.

**Warning signs:**
WebSearch research summary for EE mentions mobile phone plans, roaming charges, or UK telecom regulation. Research for NXT mentions clothing/retail or unrelated crypto price action.

**Phase to address:**
Phase implementing "保有銘柄ごとのWebSearchリサーチと売却・保有判断の再評価" — query template must include company name, and verification checklist should explicitly re-check EE and NXT output.

---

### Pitfall 6: Doubling WebSearch fan-out increases rate-limit exposure and pipeline duration without a documented budget

**What goes wrong:**
The pipeline already runs one WebSearch research round + one 5-agent re-evaluation round for `highlightedStocks` (0-15ish candidate tickers, Step 3a/3b). Adding a second, structurally identical round for all 12 fixed holdings **roughly doubles** the peak parallel Agent/WebSearch fan-out within a single unattended run (up to ~27 parallel Agent invocations across both rounds on a busy day, each doing 2-3 WebSearch calls plus WebFetch). Publicly reported Claude Code issues show WebSearch/parallel-subagent workloads hitting 429 "rate limit reached" and 529 "overloaded" errors under sustained concurrent load, with **no automatic backoff** — a subagent that hits this simply fails outright rather than retrying. Because this runs unattended via `launchd` at a fixed morning time (when the scheduling load on Anthropic's infrastructure may also be non-trivial), a rate-limit spike could silently degrade a large fraction of the 12-holding research round on any given day, and PROJECT.md already flags "パイプライン実行時間が増加" as an open, unresolved concern before this phase even starts.

**Why it happens:**
Fan-out cost is invisible until you count it: each new "per-holding, parallel-agent" round *looks* like just "one more parallel step" in isolation, but stacks additively on an already-present parallel round doing the same kind of work.

**How to avoid:**
Decide explicitly whether the two WebSearch rounds (candidates + holdings) should run sequentially (bounding peak concurrency, at the cost of total duration) or fully parallel (bounding duration, at the cost of peak concurrency/rate-limit risk) — this tradeoff should be a named decision in the phase plan, not an accident of implementation order. Apply the existing per-agent fail-soft convention already used for candidate WebSearch (`"WebSearch完了: N/{total}銘柄リサーチ成功"` partial-success reporting) to the holdings round too, so a rate-limited subset of holdings degrades gracefully (missing research for that holding, not pipeline failure) rather than blocking the whole portfolio analysis. Track and log pipeline step duration for the new round explicitly (the pipeline already has `pipeline-metrics.json` timestamp infrastructure — reuse it, e.g., `m.holdingsResearchStart`/`m.holdingsResearchEnd`) so duration growth is visible over time, not just assumed.

**Warning signs:**
`invest.md` pipeline metrics show WebSearch-related steps growing week over week. Notification/log shows partial failures like "WebSearch完了: 8/12銘柄" recurring frequently (vs. rare/occasional).

**Phase to address:**
Phase implementing "保有銘柄ごとのWebSearchリサーチ" — the phase plan itself must state the sequential-vs-parallel decision and include partial-failure handling, not defer it to implementation-time improvisation.

---

## Moderate Pitfalls

### Pitfall 7: `catch { return null }` in the existing WebSearch/reeval loaders swallows failures with zero diagnostic trace

**What goes wrong:**
`loadWebSearchResults()`/`loadReevalResults()` in `generate-report.ts` catch per-file parse/validation errors and silently `return null` — there is no `console.warn`/`console.error` logging the reason, unlike `resolveNewsCuration()` in `schemas.ts` (Phase 15/CURA), which explicitly `console.warn`s every drop reason (duplicate ID, unknown ID, empty commentary). If v2.5 copies this exact loader pattern for holdings research/re-evaluation (a very likely implementation shortcut, since it's the closest existing precedent), any schema drift (agent inventing a field name, missing a required field) will silently reduce holding coverage with **no trace in logs**, in a pipeline that already had a documented incident of a fail-soft check masking a real bug (see PROJECT.md Key Decision: "Phase 13の誤判定→14.1で実修正").

**Why it happens:**
"Fail soft" was implemented as "don't crash," but the two existing loaders conflate "don't crash the pipeline" with "don't log the reason" — an easy oversight when the original author already trusted the schema wouldn't drift for a narrow, single-purpose feature.

**How to avoid:**
When adding loaders for holdings research/re-evaluation, add `console.warn` on every catch with the filename and error, mirroring `resolveNewsCuration`'s convention, before returning `null`/skipping. Consider fixing the existing `loadWebSearchResults`/`loadReevalResults` at the same time, since the same class of bug already exists there.

**Warning signs:**
A day where `websearch-holdings/{ticker}.json` files exist but a holding's research doesn't appear anywhere in the report, with no corresponding log line.

**Phase to address:**
Phase implementing the holdings WebSearch loader — apply logging convention at the same time the loader is written, not as an afterthought.

---

### Pitfall 8: New JSON contracts for holding research/re-evaluation repeat the field-name-invention incident

**What goes wrong:**
This project has an explicit, documented history of agents inventing field names (`portfolioSummary` vs `overallComment`, `action` vs `decision`, `reason` vs `rationale`) — mitigated in `portfolioAnalysisSchema` via a `rawPortfolioSchema.passthrough().transform()` pattern that accepts both the correct and common wrong field names and normalizes them. The **existing** `webSearchResultSchema`/`reevaluationOutputSchema` (used for `highlightedStocks` research) do **not** have this alias-transform safety net — they are strict `z.object()` schemas with no fallback field mapping. If v2.5 either reuses these schemas as-is for holdings, or copies them verbatim for a new holdings-specific schema, the same field-invention failure mode this project has already been burned by once is reintroduced verbatim, this time for 12 more per-holding prompts (12x more surface area for an agent to drift on field names than the single portfolio-analyst call).

**Why it happens:**
The existing candidate-stock WebSearch/reeval schemas predate the field-name-invention incident/fix that was later applied specifically to `portfolioAnalysisSchema`; the fix was never backported to the sibling schemas because they hadn't (yet) caused a visible failure.

**How to avoid:**
Apply the same `rawXSchema.passthrough().transform()` aliasing pattern used in `portfolioAnalysisSchema` to any new holding-research/holding-reevaluation schema, and strongly consider backporting it to `webSearchResultSchema`/`reevaluationOutputSchema` too. Keep the explicit "フィールド名のルール（厳守）" block convention in the prompt (already used for `portfolio-analyst` and `news-curator` in `invest.md`) for any new agent prompt introduced.

**Warning signs:**
`zod.parse()` throws for a holding-research file that is valid JSON but uses a slightly different field name than specified; the per-file `catch → null` swallows it (compounds with Pitfall 7).

**Phase to address:**
Phase implementing per-holding WebSearch research/re-evaluation — schema design should be reviewed against this precedent before the agent prompts are finalized.

---

### Pitfall 9: Re-evaluation round anchors on the original decision instead of genuinely reconsidering

**What goes wrong:**
The existing re-evaluation pattern (Step 3b, and the analogous holdings re-evaluation this milestone adds) explicitly feeds each agent its own prior score/decision ("あなたのRound 3 スコア（参考）" / "先ほどの分析") alongside new research, then asks "did your view change?". LLM anchoring-bias research shows models exposed to a prior value/judgment systematically under-revise toward it even when new evidence would justify a larger change — the practical risk here is a re-evaluation round that produces `"changed": false` / "変化なし" responses even when the WebSearch research surfaced material new information, because the framing ("here is your prior answer, has it changed?") biases toward confirmation rather than independent reassessment. This would make the entire re-evaluation feature — the core value proposition of v2.5 ("売却・保有再考をポートフォリオ分析に復活させ") — look functional (valid JSON, `"changed": false` is a legitimate value) while actually rubber-stamping the original judgment most days.

**Why it happens:**
Presenting "your prior answer" as reference context is the natural, simplest prompt design (it's also how the existing `highlightedStocks` re-evaluation round already works) — but it is exactly the anchoring setup the bias-mitigation literature warns about.

**How to avoid:**
In the prompt, explicitly instruct the agent to weigh the new WebSearch findings independently before comparing to the prior score, e.g. "まず調査結果のみに基づいて独立に評価し、その後に前回スコアとの差分を確認すること" (evaluate independently first, compare second) rather than "here's your prior score, has it changed?" as the framing. Track the `changed: true/false` ratio in the pipeline over a few weeks of live data as a health metric — if it's persistently near-0% "changed" across all holdings, that's a strong signal of anchoring, not a strong signal of decision stability.

**Warning signs:**
Weeks of `tmp/reeval-holdings/*.json` (or equivalent) showing `"changed": false` for every holding despite visibly different WebSearch findings day to day.

**Phase to address:**
Phase implementing "保有銘柄ごとのWebSearchリサーチと売却・保有判断の再評価" — prompt framing choice should be made deliberately, and the changed-ratio metric should be part of that phase's success criteria/verification, not just "valid JSON produced."

---

## Minor Pitfalls

### Pitfall 10: Prompt bloat from injecting unbounded per-holding article counts into an already multi-tasking agent

**What goes wrong:**
`portfolio-analyst` already juggles 12 holdings' price data, meeting-result context, and (with v2.5) WebSearch research + matched news per holding, all in a single opus call. If per-holding news injection has no per-holding cap, a holding with a burst-news day (e.g. earnings, M&A rumor) could inject a disproportionately large number of articles for that one holding relative to the other 11, skewing prompt attention and increasing token cost/latency without a corresponding accuracy benefit (the existing pool-level cap is MIN=20/MAX=80 total, not per-holding).

**How to avoid:**
Cap injected articles per holding (e.g., top 3-5 by the existing priority score) rather than injecting every ticker-matched article for that day.

**Phase to address:**
Phase implementing per-holding news injection — cap should be decided alongside the injection format, not left unbounded.

---

### Pitfall 11: Stale/unchanged news presented as if freshly re-evaluated, eroding trust in the daily feature

**What goes wrong:**
On a quiet day for a given holding (no new Finnhub company-news, WebSearch returning the same top article as yesterday since it's genuinely still the most recent), the re-evaluation section will still be present and phrased as if fresh analysis occurred, when nothing materially changed. Repeated daily "re-evaluation" text that doesn't reflect new developments undermines the credibility of the one feature this milestone is meant to restore.

**How to avoid:**
Have the agent explicitly distinguish "no new material information since yesterday" from "reassessed and unchanged" in its output (a `hasNewInformation: boolean`-style field, or explicit wording instruction), and have the portfolio card visually de-emphasize holdings with no new news that day.

**Phase to address:**
Phase implementing "保有銘柄カードへの関連ニュース表示" — UI should differentiate "no news today" from "news present, re-evaluated."

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|-----------------|------------------|
| Reuse `webSearchResultSchema`/`reevaluationOutputSchema` as-is for holdings (no alias-transform) | Faster to ship, less new code | Repeats the field-name-invention failure mode across 12x more prompts (Pitfall 8) | Never — the aliasing pattern is cheap to add and directly addresses a known project incident |
| Bare-ticker WebSearch queries copied from Step 3a template | No prompt-authoring effort | Silent contamination for EE/NXT-style collisions (Pitfall 5) | Acceptable only for holdings with unambiguous, unique tickers — audit each ticker individually, don't blanket-apply |
| Finnhub-only ticker matching for per-holding news (no RSS keyword fallback) | Simple, reuses existing v2.3 data | Silent near-zero coverage for JP small-cap holdings (Pitfall 4) | Acceptable as an explicit documented MVP scope decision, not as an unexamined default |
| `catch { return null }` with no logging in new loaders | Matches existing loader style, less code | Silent data loss with no diagnostic trail (Pitfall 7) | Never — logging the reason costs one line and directly prevents recurrence of the Phase 13/14.1 incident class |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|-----------------|-------------------|
| Finnhub `company-news` (per-holding) | Assuming ticker coverage is uniform across US and JP holdings | Verify actual JP small-cap coverage empirically; document Finnhub-only scope boundary explicitly (Pitfall 4) |
| Claude Code WebSearch tool (12x parallel Agent fan-out) | No retry/backoff on 429/529, assuming all 12 will always succeed | Apply the existing "N/{total}成功" partial-success pattern from Step 3a; never make holdings analysis hard-fail on partial WebSearch loss (Pitfall 6) |
| `tmp/websearch/` & `tmp/reeval/` directories | Reusing existing directories for a second, unrelated WebSearch round | Use separate directories + separate loaders per round, scoped to the correct report generator only (Pitfall 1) |
| ID-reference news rendering (existing news-digest convention) | Letting `portfolio-analyst` output raw title/url text for per-holding news "for convenience" since it's a different agent than `news-curator` | Apply the exact same ID-only-reference constraint used for `news-curator`; TS resolves URL from the ticker-matched pool subset, and the resolver should validate the ID was actually present in *that holding's* subset, not just anywhere in the full pool |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|-----------------|
| Doubling parallel WebSearch/Agent fan-out (12 holdings + existing candidates round) | Growing `pipeline-metrics.json` durations, occasional partial-success ratios below 12/12 | Sequential-vs-parallel decision made explicitly; per-round fail-soft partial success (Pitfall 6) | Becomes visible immediately (12 more holdings is already the full scale — no further growth expected since holdings count is fixed at 12) |
| Unbounded per-holding article injection into `portfolio-analyst` prompt | Slow/expensive opus calls on burst-news days, one holding dominating output length | Cap articles per holding (Pitfall 10) | Any day with an earnings/M&A event on one holding |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Letting `portfolio-analyst` (or any new holdings-research agent) output raw URLs/titles instead of IDs | Reintroduces the exact hallucinated-URL class this project already solved structurally for news-digest (Phase 15) | Enforce ID-reference-only output contract identically to `news-curator`'s existing prompt constraint; validate at the TS layer that referenced IDs exist in the specific holding's matched subset |
| Portfolio ticker list (`PORTFOLIO_HOLDINGS`) embedded directly in WebSearch queries with no company-name disambiguation | Research contamination feeding into real sell/hold decisions (Pitfall 5) — not a classic "security" bug, but a decision-integrity bug with real financial consequence given this is a personal investment tool | Always pair ticker + company name in queries; verify agent cross-checks entity identity |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-------------------|
| Holding cards showing empty news section with no explanation | User can't tell "no news today" from "the feature is broken" | Explicit "本日関連ニュースなし（Finnhub該当記事なし）" messaging rather than silently omitting the section |
| Re-evaluation text implying fresh analysis on a stale/quiet news day | Erodes trust in the daily re-evaluation feature over time (Pitfall 11) | Distinguish "no new information" from "reassessed, unchanged" explicitly in both data and rendering |
| New-candidates section abruptly disappearing from Portfolio Report with no migration note | User may think the report is broken/regressed rather than intentionally redesigned | Not strictly required, but consider a one-time note in the report or changelog that new-candidate discovery now lives only in the Daily Report |

## "Looks Done But Isn't" Checklist

- [ ] **finnhub.ts ticker fix:** Often missing a regression test asserting `ticker === undefined` for general/merger articles at every array index (not just index 0) — verify with a fixture array of 3+ items.
- [ ] **New-candidates section removal:** Often missing the `portfolioAnalysis === null` fallback-branch removal — verify with `grep -n formatNewCandidatesHtml` returning zero results, and a fallback-path test.
- [ ] **Per-holding news injection:** Often missing explicit handling of the "no ticker-matched articles for this holding" case — verify by checking a JP holding's rendered card on a live run, not just a US holding with guaranteed Finnhub coverage.
- [ ] **Per-holding WebSearch research:** Often missing directory isolation from the existing candidate-stock WebSearch round — verify `tmp/websearch/` vs the new holdings directory are never both non-empty and cross-read by the wrong report generator.
- [ ] **Re-evaluation round:** Often missing any measurement of whether `changed: true` ever actually fires — verify over several days of live data, not a single test run (Pitfall 9).
- [ ] **ID-reference news links on holding cards:** Often missing validation that a referenced article ID actually belongs to that specific holding's matched subset (as opposed to merely existing somewhere in the full `tmp/news.json` pool) — verify the resolver rejects/logs cross-holding ID leakage.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|----------------|------------------|
| Directory collision contaminating Daily Report (Pitfall 1) | LOW | Rename/move holdings-research output to a new directory, add loader isolation test, redeploy — no data model changes needed |
| Renderer fallback-path regression (Pitfall 2) | LOW | Remove remaining call site, add fallback-path test, redeploy |
| finnhub.ts fix ripple (Pitfall 3) | LOW-MEDIUM | Update affected test fixtures, re-run full 188-test suite, verify no downstream consumer relied on the buggy numeric ticker |
| Silent JP holding under-coverage discovered post-launch (Pitfall 4) | MEDIUM | Add RSS/Google News keyword-matching pass for JP holdings as a follow-up phase; requires new matching logic + false-positive review |
| Ticker collision contamination discovered in production research (Pitfall 5) | LOW | Patch WebSearch query template to include company name; no data model change, re-verify EE/NXT specifically |
| Anchoring bias discovered via near-zero "changed" ratio (Pitfall 9) | MEDIUM | Rework prompt framing to independent-then-compare structure; re-collect changed-ratio metric over a new observation window |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|-------------------|----------------|
| 1. Directory collision contaminates Daily Report | Holdings WebSearch research phase | Loader isolation test; Daily Report output identical with/without holdings-research files present |
| 2. New-candidates removal breaks fallback path | New-candidates removal phase | `grep formatNewCandidatesHtml` returns 0; fallback-path (`portfolioAnalysis === null`) test passes |
| 3. finnhub.ts ticker bug fix ripple | Ticker bug fix phase (foundational, should run first) | New regression test for multi-index array; full 188-test suite green; downstream consumers (filter.ts, news-digest pills) reviewed |
| 4. Silent per-holding news under-coverage | Per-holding news injection phase | Live-run audit of match counts per holding, especially the 4 JP tickers; explicit "no coverage" messaging shipped |
| 5. Ticker collision in WebSearch queries | Holdings WebSearch research phase | Manual spot-check of EE and NXT research output; query template includes company name |
| 6. WebSearch fan-out rate limits / duration growth | Holdings WebSearch research phase | Sequential-vs-parallel decision documented; partial-success fail-soft pattern applied; pipeline-metrics timestamps added |
| 7. Silent schema-validation swallowing | Holdings WebSearch/reeval loader implementation | `console.warn` present on every catch branch; verified via a forced-bad-JSON test |
| 8. Field-name invention on new schemas | Holdings WebSearch/reeval schema design | Alias-transform pattern applied, mirroring `portfolioAnalysisSchema` |
| 9. Anchoring bias in re-evaluation | Holdings WebSearch research phase | Changed-ratio tracked over multiple live days; not 0% across the board |
| 10. Prompt bloat per holding | Per-holding news injection phase | Per-holding article cap implemented and tested |
| 11. Stale news presented as fresh | Holding news UI phase | "No new information" vs "reassessed, unchanged" distinguished in data and rendering |

## Sources

- `/Users/arai/invest/.planning/PROJECT.md` — milestone scope, constraints, prior incidents (Phase 13/14.1 fail-soft masking a real bug; field-name invention precedent)
- `/Users/arai/invest/src/data/news/finnhub.ts`, `filter.ts`, `types.ts` — ticker field origin/scope, index-as-ticker bug (code-verified)
- `/Users/arai/invest/src/meeting/schemas.ts` — existing zod contracts, alias-transform pattern (`portfolioAnalysisSchema`) vs. strict schemas (`webSearchResultSchema`, `reevaluationOutputSchema`)
- `/Users/arai/invest/src/scripts/generate-report.ts`, `generate-portfolio-report.ts`, `generate-daily-report.ts` — directory-wide loader pattern, double call site of `formatNewCandidatesHtml`
- `/Users/arai/invest/.claude/commands/invest.md` (Step 3a-3d) — existing WebSearch research + re-evaluation pattern for `highlightedStocks`, ID-reference convention for `news-curator`
- `/Users/arai/invest/src/portfolio/holdings.ts` — confirmed `EE` = Excelerate Energy, `NXT` = Nextpower (collision-prone tickers)
- Git history `ba01275^:src/portfolio/runner.ts`, `ba01275^:src/data/research.ts` — v1.0 precedent for research→re-evaluation flow structure
- [GitHub: WebSearch "Rate limit reached" on subscription accounts (anthropics/claude-code#27074)](https://github.com/anthropics/claude-code/issues/27074) — MEDIUM confidence, community-reported
- [GitHub: 529 overloaded hard-fails parallel sessions/subagents with no backoff (anthropics/claude-code#68502)](https://github.com/anthropics/claude-code/issues/68502) — MEDIUM confidence, community-reported
- Anchoring bias in LLMs: arXiv 2412.03605 (CBEval), arXiv 2505.15392 (Understanding the Anchoring Effect of LLM) — MEDIUM confidence, academic literature on general LLM anchoring, applied here as a reasoned risk for this project's specific re-evaluation prompt design (not project-specific empirical data)

---
*Pitfalls research for: Portfolio News Intelligence (v2.5) — per-holding news injection, WebSearch re-evaluation, ID-reference news UI, new-candidates removal, ticker-attribution bug fix*
*Researched: 2026-07-03*

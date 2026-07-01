# Pitfalls Research

**Domain:** Adding an LLM-curated news digest step (news-digest.html, 4th daily report) to an existing automated multi-agent investment pipeline (v2.4 milestone)
**Researched:** 2026-07-02
**Confidence:** HIGH (all findings grounded in current codebase: `.claude/commands/invest.md`, `src/scripts/generate-report.ts`, `src/scripts/update-index.ts`, `src/scripts/report-utils.ts`, `src/meeting/schemas.ts`, `src/data/news/filter.ts`, `src/data/news/types.ts`, `scripts/run.sh`)

> **Note:** This file supersedes the v2.2-era PITFALLS.md (news dedup/filter/metrics pitfalls), which is no longer the active milestone. Historical v2.2 findings remain valid in the shipped code but are not repeated here — this file is scoped exclusively to the v2.4 news-digest-report addition.

## Critical Pitfalls

### Pitfall 1: Promise.all collapses all 4 reports if the digest generator throws

**What goes wrong:**
`src/scripts/generate-report.ts` builds `dailyHtml`, `minutesHtml`, `portfolioHtml` as plain synchronous consts, then writes all three via a single `Promise.all([writeFile(...), writeFile(...), writeFile(...)])` (lines 108-116). If a 4th `generateNewsDigestHtml(...)` call is added to that same sequence and it throws (malformed curated-article data, undefined field access, etc.), the thrown error propagates out of `main()` before any `writeFile` calls execute — **zero** reports get written for that day, not just the digest. This is a strict regression versus the current baseline where a bad 4th feature would ideally degrade gracefully, not kill 3 previously-reliable reports.

**Why it happens:**
The existing 3-report generation was written when "all reports come from the same trusted, schema-validated `meeting-result.json`" was a safe assumption. The digest introduces a second, less-trusted LLM output (freeform article curation) into the same all-or-nothing code path without anyone re-examining the failure semantics.

**How to avoid:**
- Wrap `generateNewsDigestHtml(...)` in its own `try/catch` inside `generate-report.ts`, independent from the other 3 generators.
- On failure, log a warning, skip writing `news-digest.html` for that day, and let the other 3 `writeFile` calls proceed unaffected (do not include the digest write in the same `Promise.all` group as the other three, or guard it separately).
- `update-index.ts` must not link to a `news-digest.html` that was never written for that date (see Pitfall 4).

**Warning signs:** A local test where the digest curation agent returns malformed JSON causes `daily-report.html`/`meeting-minutes.html`/`portfolio-report.html` to also go missing for that day.

**Phase to address:** The phase that adds `generate-news-digest.ts` and wires it into `generate-report.ts`'s `main()`.

---

### Pitfall 2: Hallucinated/mismatched article references (title, URL, or content not matching the supplied article)

**What goes wrong:**
The curation agent is asked to pick 10-15 of 20-80 supplied articles and write commentary. LLMs frequently paraphrase/retype titles or URLs from memory instead of copying the supplied strings verbatim, producing digest entries whose `url` doesn't resolve to the article that was actually filtered/scored, or whose title doesn't match any article in `tmp/news.json`. Because the underlying articles are legitimate URLs (Finnhub/Google News/RSS), a hallucinated or slightly-mangled URL can point to a 404, an unrelated page, or (worst case) a URL fragment that happens to look valid but leads nowhere useful — degrading user trust in a report that looks authoritative.

**Why it happens:**
This project has already hit this exact class of problem and solved it differently elsewhere: the WebSearch research step's `keyArticles` schema (`src/meeting/schemas.ts`, `webSearchResultSchema`) deliberately has **no `url` field** — only `title` and `summary`. The precedent is: never trust an LLM to reproduce a URL byte-for-byte in output.

**How to avoid:**
- Do not ask the curation agent to output the article `url` (or full title) as free text. Instead, assign each filtered article a stable index/ID before the agent sees it (e.g., `tmp/news.json` array index, or an explicit `id` field added during `collect-data.ts`/filter step), and have the agent select **by ID only** (`{"articleId": 17, "commentary": "..."}`).
- TypeScript-side (`generate-news-digest.ts`) then looks up the real `title`/`url`/`source` from `tmp/news.json` by ID and renders those verbatim — the LLM never controls the href that ends up in HTML.
- Reject/drop any selected ID that doesn't exist in the supplied article list (defensive bounds check) rather than trusting the agent's echo of the ID back.

**Warning signs:** Digest entries whose rendered URL doesn't match any URL in `tmp/news.json`; manual click-through reveals dead links or unrelated pages.

**Phase to address:** The phase that designs the curation agent's output contract (prompt + schema), before any HTML rendering work begins.

---

### Pitfall 3: Rigid 10-15 count validation causes a hard pipeline failure

**What goes wrong:**
`filter.ts` supplies a variable article pool (MIN=20/MAX=80, per `collect-data.ts` lines 51-57). If the digest schema enforces `z.array(...).min(10).max(15)` and the agent returns 9 or 16 items (common LLM count drift, especially near the boundary of "10-15"), `zod.parse()` throws. If validation follows the existing `validate-meeting.ts` pattern (`process.exit(1)` on schema failure), this kills the whole step.

**Why it happens:**
Analogous to `analystRound1OutputSchema`/`meetingResultSchema`, but those fields (picks, scores) already tolerate variable-length arrays without hard min/max because count instability wasn't safety-critical there. A digest is the first place in this codebase where the roadmap explicitly wants a *bounded* count (10-15), which is inherently harder for an LLM to hit exactly than "give me your picks."

**How to avoid:**
- Follow the project's own established mitigation pattern for LLM field/shape drift: `portfolioAnalysisSchema` and `holdingEvaluationSchema` (`src/meeting/schemas.ts`, lines 141-186) use `.passthrough()` + optional fields + `.transform()` to tolerate LLM deviations (wrong field names like `action` vs `decision`) rather than hard-rejecting.
- For the digest, validate count with a **soft clamp**, not a hard schema reject: accept the schema with a loose bound (e.g., `min(5).max(20)`) and then in TS code truncate to the top N (by score/priority order already present in `tmp/news.json`) if the agent over-selects, or accept a shorter list (with a logged warning) if under-selects, rather than failing the pipeline outright.
- Treat "exactly 10-15" as a target communicated in the prompt, not a hard contract enforced by `zod.parse()` throwing.

**Warning signs:** Occasional `[STEP:news-digest:FAIL]` on days where the agent selected 9 or 16 articles despite a reasonable curation.

**Phase to address:** Schema/contract design phase, same phase as Pitfall 2.

---

### Pitfall 4: `update-index.ts` links to a `news-digest.html` that was never generated (dangling 404)

**What goes wrong:**
`buildStandardLinks(date)` in `src/scripts/report-utils.ts` (lines 29-35) is a hardcoded list of exactly 3 links, always included regardless of whether the corresponding file actually exists on disk. If a 4th link is added the same way (unconditionally), and the digest step is skipped/fails for a given day (empty article pool, curation agent failure — see Pitfall 1/3), `index.html` will permanently point to a `news-digest.html` that was never written for that date. Unlike `portfolio.html`'s entry logic (`updatePortfolioHtml`, which checks `content.includes(...)` before inserting), there is no existence check for the standard 3 (soon 4) links today — this gap simply hasn't mattered yet because those 3 files are always written together by the same trusted, always-succeeding code path.

**Why it happens:**
The digest is the first of the 4 reports whose successful generation is not guaranteed (depends on a second LLM curation step with its own failure modes). The existing `buildStandardLinks` function was designed for a world where "3 links always exist together."

**How to avoid:**
- Make `buildStandardLinks` conditional: only include the `news-digest.html` link if the file was actually written this run (pass a boolean/flag from `generate-report.ts` → `update-index.ts`, e.g., check file existence with `existsSync` before building the entry, or read a marker written by the digest generator).
- Since `parseExistingEntries`/`ReportEntry.links` already supports variable link counts per entry (see code comment: "do not assume 3 links per entry" in `report-utils.ts` line 39) — this flexibility already exists and should be leveraged, not fought.
- Historical index entries prior to the digest's launch date will correctly retain 3 links (unaffected, per existing merge-by-date-wins logic) — verify this is the intended behavior with the user/roadmap before implementation.

**Warning signs:** `index.html` "最新レポート" hero block links to `news-digest.html` returning 404 on GitHub Pages; `docs/YYYY-MM-DD/` directory missing `news-digest.html` despite the index entry existing.

**Phase to address:** The phase that modifies `update-index.ts`/`report-utils.ts` to add the 4th link.

---

### Pitfall 5: HTML injection via unescaped curated-article text or LLM-controlled `href`

**What goes wrong:**
Every existing report generator (`generate-daily-report.ts`) wraps 100% of LLM-derived string fields in `escapeHtml()` before interpolation — confirmed across ~20 call sites (index names, summaries, tickers, rationale, WebSearch findings, etc.). Critically, even `keyArticles` (an LLM-curated article list) is rendered as `<li><strong>${escapeHtml(a.title)}</strong>: ${escapeHtml(a.summary)}</li>` — **plain text, never an `<a href>` built from LLM output**. A news digest naturally wants "click to read" links, which is new territory: if a developer builds `<a href="${article.url}">` using the LLM's own emitted URL string (unescaped, and/or without validating it's `http(s)://`), this reintroduces both an XSS vector (`javascript:` URIs, `"` breaking out of the attribute) and reinforces Pitfall 2's hallucination risk.

**Why it happens:**
Building an anchor tag with the correct href *and* correct escaping *and* a real (non-hallucinated) URL simultaneously requires combining two separate precedents in this codebase (escapeHtml everywhere + never trust LLM-echoed URLs) that no single existing report needed to combine before.

**How to avoid:**
- Reuse `escapeHtml` from `report-utils.ts` for all commentary/title/summary text, matching existing convention exactly (no new escaping logic).
- Source the `href` value from the TS-side lookup by article ID (Pitfall 2's fix), not from LLM output, and still run it through `escapeHtml()` when interpolating into the `href="..."` attribute (URLs can contain `&` which must be escaped even for legitimate hrefs).
- Optionally validate the URL scheme is `http:`/`https:` before rendering as a link (defense in depth, since even TS-sourced URLs originate from RSS/Finnhub feeds parsed with minimal validation — see `filter.ts`/`types.ts`, no URL scheme check currently exists anywhere in the pipeline).

**Warning signs:** A code review of the new `generate-news-digest.ts` that does not import/call `escapeHtml`, or that string-concatenates an `<a href="${...}">` with a raw agent-output field.

**Phase to address:** Same phase as HTML template implementation for news-digest.html.

---

### Pitfall 6: Market classification (US / JP / Global) is not derivable from any existing reliable field

**What goes wrong:**
The `category` field on `RawNewsArticle` (`src/data/news/types.ts`) is not a market classifier — it is an artifact of *which fetch path* produced the article: `"company"`/`"general"`/`"merger"` come from Finnhub (whose `company` category only ever queries `usTickers` — US portfolio symbols without a `.` — per `collect-data.ts` lines 32-34, but `general`/`merger` are broad wire categories that can cover any geography), while `"japan_market"` comes exclusively from Google News Japan and the 5 JP RSS feeds. There is no `"us_market"` or `"global"` category, and nothing distinguishes "US-relevant macro/Fed news" from "JP-relevant macro/BOJ news" from genuinely cross-market news (e.g., oil prices, USD/JPY FX, global supply chain). Asking the curation LLM to freely classify each article into US/JP/Global is a judgment call with no ground truth to check it against — expect systematic misclassification of dual-listed companies (e.g., Sony ADR vs 6758.T), Fed/macro news mislabeled as "US" when it's genuinely "Global," and JP RSS articles about US markets (Nikkei covering Wall Street) landing in the wrong bucket.

**Why it happens:**
The `category` field was designed for the filter pipeline's own internal needs (denylist matching, cross-language dedup grouping via `isJapaneseTitle()`), not for market taxonomy. It happens to correlate loosely with geography but was never intended as ground truth for a 3-way US/JP/Global split.

**How to avoid:**
- Do not treat `category` as authoritative market classification. Use it only as a weak prior/heuristic (e.g., `"japan_market"` → JP by default, `ticker` matching `/\.T$/` → JP, `ticker` present without `.` suffix → US) and let the curation agent override with explicit reasoning, rather than the reverse.
- Explicitly instruct the agent in the prompt on the 3-way taxonomy with concrete disambiguation rules (e.g., "macro/Fed/BOJ/FX/commodity news that isn't specific to a single market → Global"), and validate the returned market value is one of exactly 3 enum values via zod (`z.enum(["US", "JP", "Global"])`), matching the existing enum-validation pattern already used for `verdict`/`trend`/`severity` in `meetingResultSchema`.
- Accept that misclassification will happen occasionally (LOW-stakes UX issue, not a data-integrity issue) — this is a "best effort grouping," not a hard requirement; do not gate pipeline success on classification accuracy.

**Warning signs:** Manual review of a digest showing Fed rate articles under "US" when Global was more accurate, or JP RSS wire articles about US earnings appearing under "JP".

**Phase to address:** Prompt/schema design phase for the curation agent (same phase as Pitfall 2/3).

---

### Pitfall 7: New digest step treated as a hard-fail gate, blocking deploy of the other 3 already-working reports

**What goes wrong:**
The pipeline's STEP marker convention (`invest.md`) already distinguishes hard-fail steps (`data-collection`, `round-1` with a ≥3-analyst-failure threshold, `round-3` moderator failure, `report-generation`, `deploy` — each emits `[PIPELINE:FAIL]` and stops the run) from soft-warn steps (Round 2's discussion-length check only prints a warning, never fails). If the new digest curation Agent call and its validation are inserted into the existing `report-generation` step without a dedicated fail-soft path, any digest failure (agent returns malformed JSON, curation quality too low, 0 articles after filter that day) will trip the *existing* `report-generation:FAIL` handler — which today only exists to catch `generate-report.ts` crashing entirely — and block Step 4 (deploy) for the **entire day's pipeline**, even though `daily-report.html`, `meeting-minutes.html`, and `portfolio-report.html` were generated successfully.

**Why it happens:**
The path of least resistance is to bolt the new curation Agent call onto Step 3 (report generation) without introducing a new STEP marker or a fail-soft branch, since Step 3 already has an established `[STEP:report-generation:...]` wrapper.

**How to avoid:**
- Introduce a distinct `[STEP:news-digest:START/OK/FAIL]` marker pair, and treat a `FAIL` here the same way Round 2 quality warnings are treated: log/notify but do **not** emit `[PIPELINE:FAIL]` or block Step 4 (deploy). The other 3 reports and the deploy of `index.html`/`portfolio.html` must succeed independently of digest curation success.
- If the digest curation agent's output is invalid, fall back to *not writing* `news-digest.html` for that day (see Pitfall 4's conditional-link fix) rather than halting the pipeline — mirroring the existing `portfolio-analyst` retry-once-then-fallback-without-file pattern (`invest.md` line 1636).
- `run.sh`'s SHA256 checksum protection (`PROTECT_FILES=("docs/index.html" "docs/portfolio.html")`) does **not** cover per-date report files including `news-digest.html` — a buggy digest generator could corrupt/leave malformed `docs/YYYY-MM-DD/news-digest.html` without triggering the existing restore-from-checksum safety net. This is acceptable only if the digest failure path never touches `index.html`/`portfolio.html` content it shouldn't (i.e., Pitfall 4's fix is in place).

**Warning signs:** A day with 0 filtered articles (edge case already logged as a warning in `collect-data.ts` when `finalArticles.length < 20`) causes the entire pipeline to fail and no reports deploy at all, when previously (pre-digest) that same day would have deployed 3 reports fine.

**Phase to address:** Pipeline orchestration phase — updating `invest.md`'s STEP markers and `run.sh`/deploy-gating logic.

---

### Pitfall 8: `tmp/*` handoff convention violation (stdout doesn't reach `invest.md`; stale leftover files from prior days)

**What goes wrong:**
Two distinct failure modes tied to this project's established file-handoff convention:
1. **stdout-doesn't-reach convention violation:** This project's core lesson (documented in memory/PROJECT.md) is that subagent stdout never reaches the orchestrating `invest.md` skill — only files under `tmp/` do. If the digest curation agent's output is threaded through inline prompt text or assumed to be readable from an Agent tool's return value rather than written to a `tmp/*.json` file and re-read via the `Read` tool (the pattern every other step in `invest.md` uses, e.g. `tmp/websearch/{ticker}.json`, `tmp/reeval/*.json`), the digest data will silently be unavailable to `generate-report.ts`.
2. **Stale directory listings:** `generate-report.ts`'s `loadWebSearchResults()`/`loadReevalResults()` (lines 23-65) read **every file** in `tmp/websearch/`/`tmp/reeval/` each run via `readdir()`, with no cleanup of those directories between daily runs (`run.sh`/`invest.md` never `rm -rf tmp/websearch` or similar — confirmed no cleanup step exists anywhere in the pipeline). If the digest output is similarly designed as "one file per market group" in a directory (e.g., `tmp/news-digest/us.json`, `tmp/news-digest/jp.json`, `tmp/news-digest/global.json`) and one group is skipped on a given day (e.g., 0 Global articles selected), a stale file from a previous day's run would leak into today's digest under the wrong date.

**Why it happens:**
Directory-of-files-per-item is the established pattern in this codebase for per-ticker/per-agent outputs (where the item set is naturally small and stable), but it silently assumes every run fully repopulates the directory — which has not yet been tested against a day where an expected file is legitimately absent.

**How to avoid:**
- Follow the file-handoff convention exactly: curation agent(s) write to a single `tmp/news-digest.json` (or a fixed small set of well-known filenames if split by market), never rely on Agent tool stdout being read directly downstream.
- Prefer a **single JSON file** over a directory-of-files pattern for the digest output (all 10-15 curated articles + market grouping in one document), since the "10-15 items, 3 fixed market groups" shape doesn't need per-item files the way per-ticker WebSearch results do — this sidesteps the stale-file risk entirely.
- If a directory pattern is used regardless, explicitly clear/recreate it at the start of the digest step (`rm -rf tmp/news-digest && mkdir -p tmp/news-digest`), matching how `collect-data.ts` fully overwrites `tmp/news.json` each run rather than appending.

**Warning signs:** Digest report shows a market group with articles that don't appear in that day's filtered `tmp/news.json`, or a group is unexpectedly empty despite the agent having selected articles for it (stdout not persisted).

**Phase to address:** Pipeline integration phase — defining where/how the curation agent writes its output in `invest.md`.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|-----------------|------------------|
| Let curation agent free-type article URLs instead of ID-based selection | Faster to prompt/implement | Hallucinated/broken links erode trust in reports (Pitfall 2) | Never |
| Hard `min(10).max(15)` zod array bound on selection count | Simple schema | Sporadic pipeline hard-failures on off-by-one counts (Pitfall 3) | Never — use soft clamp instead |
| Bolt digest onto existing `report-generation` STEP marker without a dedicated fail-soft path | Less `invest.md` editing | Digest bugs block deploy of 3 working reports (Pitfall 7) | Never |
| Unconditional 4th link in `buildStandardLinks` | Simpler code, matches existing 3-link pattern | Dangling 404 links in index.html on digest-failure days (Pitfall 4) | Only if digest generation is proven to never fail (unrealistic for an LLM step) |
| Skip explicit US/JP/Global validation enum, let agent output freeform strings | Faster prompt iteration | Typos/variants ("USA", "米国", "us") break grouping logic downstream | Only during early prototyping, must add zod enum before roadmap "done" |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|-----------------|-------------------|
| `generate-report.ts` main() | Adding digest HTML generation into the same `Promise.all` as the 3 existing writes | Isolate digest generation in its own try/catch; don't let it block the other 3 writes |
| `update-index.ts` / `report-utils.ts` | Hardcoding the 4th link unconditionally in `buildStandardLinks` | Conditionally include the link only if `news-digest.html` exists for that date |
| `invest.md` STEP markers | Reusing `report-generation:FAIL` for digest failures | Add a distinct `news-digest` STEP marker with fail-soft (warn-only) semantics |
| `tmp/*.json` handoff | Assuming Agent tool stdout reaches `invest.md` directly | Always write curated output to a `tmp/*.json` file, re-read via `Read` tool, per existing convention |
| `src/meeting/schemas.ts` (zod) | Hard-rejecting on LLM field-name drift (e.g., agent uses `articles` instead of `selectedArticles`) | Use `.passthrough()` + optional fields + `.transform()` aliasing, matching `portfolioAnalysisSchema`'s established pattern |
| `filter.ts` output (`tmp/news.json`) | Re-deriving market classification purely from LLM judgment with no fallback | Seed classification with a cheap heuristic (ticker suffix, `category` field, source name) and let the agent refine, validated against a strict 3-value enum |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Rendering curated article `href` from raw LLM-echoed URL string | XSS via `javascript:`/`data:` URI, or attribute-breakout via unescaped `"` | Source href from TS-side article lookup by ID (never LLM-echoed), still pass through `escapeHtml()`, validate scheme is http(s) |
| Interpolating curated commentary text without `escapeHtml()` | Stored XSS in a publicly deployed GitHub Pages report (same class of risk already flagged historically in CONCERNS.md for LLM-generated content) | Use `escapeHtml()` for every LLM-derived string field, exactly as done in `generate-daily-report.ts` |
| Treating `docs/YYYY-MM-DD/news-digest.html` as covered by the existing SHA256 checksum protection in `run.sh` | False sense of safety — `PROTECT_FILES` only covers `docs/index.html`/`docs/portfolio.html`, not per-date report files | Don't rely on `run.sh`'s checksum restore for digest content integrity; rely on generation-time validation/escaping instead |

## "Looks Done But Isn't" Checklist

- [ ] **Article references:** Often "done" by asking the LLM for title+url directly — verify selection uses article IDs looked up server-side, not LLM-echoed URLs (Pitfall 2)
- [ ] **Count validation:** Often "done" with a strict zod `min(10).max(15)` — verify a soft-clamp/truncate strategy exists instead of a hard throw (Pitfall 3)
- [ ] **Failure isolation:** Often "done" by wrapping the whole Step 3 in a try/catch already present — verify the digest specifically cannot prevent the other 3 reports from writing or block deploy (Pitfall 1, 7)
- [ ] **Index integration:** Often "done" by adding a 4th link to `buildStandardLinks` — verify the link is conditional on the file actually existing for that date (Pitfall 4)
- [ ] **Escaping:** Often "done" by copy-pasting existing render functions — verify every new interpolation site (including any new `href` attributes) calls `escapeHtml()` (Pitfall 5)
- [ ] **Market grouping:** Often "done" by trusting the LLM's freeform US/JP/Global label — verify a zod enum constrains output to exactly 3 values with a documented disambiguation rule for macro/global news (Pitfall 6)
- [ ] **File handoff:** Often "done" by assuming the Agent tool result is directly usable — verify curated output is written to and re-read from a `tmp/*.json` file per the project's established convention (Pitfall 8)
- [ ] **Stale data:** Often "done" without directory cleanup — verify no per-run directory (if used) can leak yesterday's files into today's digest (Pitfall 8)

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|----------------|------------------|
| Promise.all collapse (Pitfall 1) already shipped | LOW | Isolate the digest write path in a follow-up patch; re-run pipeline manually for any missed day |
| Hallucinated URLs already in a published digest | LOW | Re-run digest generation with ID-based selection fix; overwrite `docs/YYYY-MM-DD/news-digest.html` (not checksum-protected, safe to regenerate) |
| Dangling 404 index links (Pitfall 4) | LOW | One-off script to conditionally strip the news-digest link from historical `index.html` entries where the file is missing, then fix `update-index.ts` going forward |
| Hard-fail blocking deploy (Pitfall 7) | LOW-MEDIUM | Re-run `/invest` manually after relaxing the STEP marker to fail-soft; check `logs/invest-*.log` for the exact FAIL step first |
| Market misclassification discovered post-launch | LOW | Cosmetic-only issue; no data recovery needed, just prompt/schema tuning in the next iteration |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|-------------------|----------------|
| Hallucinated article references (2) | Curation agent prompt/schema design phase | Confirm agent output schema has no free-text URL field; all rendered hrefs traceable to `tmp/news.json` entries by ID |
| Rigid count validation (3) | Curation agent prompt/schema design phase | Test with agent returning 9 and 16 items; pipeline should not hard-fail |
| Promise.all collapse (1) | HTML generation integration phase | Force `generateNewsDigestHtml` to throw in a test; confirm other 3 files still get written |
| Dangling index links (4) | index/update-index integration phase | Simulate a digest failure day; confirm `index.html` entry has only 3 links, no 404 |
| HTML injection (5) | HTML generation integration phase | Curated commentary containing `<script>`/`"` renders as escaped text, not executed markup |
| Market misclassification (6) | Curation agent prompt/schema design phase | zod enum limited to `["US","JP","Global"]`; spot-check a week of digests for obviously wrong buckets |
| Hard-fail blocking deploy (7) | Pipeline orchestration (`invest.md`/`run.sh`) phase | Simulate 0-article day; confirm `[PIPELINE:OK]` still emitted and deploy proceeds without digest |
| tmp handoff / stale files (8) | Pipeline integration phase | Run pipeline twice in a row with different article sets; confirm second run's digest has no leftover data from the first |

## Sources

- `/Users/arai/invest/.claude/commands/invest.md` — full pipeline orchestration (STEP markers, Agent invocation patterns, fallback/retry conventions, deploy logic)
- `/Users/arai/invest/scripts/run.sh` — launchd entrypoint, SHA256 checksum protection scope, EXIT_CODE handling
- `/Users/arai/invest/src/scripts/generate-report.ts` — Promise.all report-writing pattern
- `/Users/arai/invest/src/scripts/update-index.ts` and `src/scripts/report-utils.ts` — index merge/link-building logic, existing `escapeHtml` usage, `parseExistingEntries` flexible-link-count precedent
- `/Users/arai/invest/src/scripts/generate-daily-report.ts` — confirms `keyArticles` schema/rendering precedent (no URL field, escaped title+summary only)
- `/Users/arai/invest/src/meeting/schemas.ts` — zod validation patterns, including field-name-drift tolerance (`portfolioAnalysisSchema`, `holdingEvaluationSchema`)
- `/Users/arai/invest/src/data/news/filter.ts` and `src/data/news/types.ts` — `category` field semantics, MIN=20/MAX=80 pool sizing
- `/Users/arai/invest/src/scripts/collect-data.ts` — US-ticker-only Finnhub company news fetch, no market field in output
- `/Users/arai/invest/.planning/codebase/CONCERNS.md` — historical (2026-04-08, pre-v2.0) HTML injection concern, referenced for continuity though the specific files cited are since superseded
- `/Users/arai/invest/.planning/milestones/v2.3-REQUIREMENTS.md` — CURA-01 scope-cut context

---
*Pitfalls research for: LLM-curated news digest report integration into an existing daily investment pipeline*
*Researched: 2026-07-02*

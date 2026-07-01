# Stack Research

**Domain:** AI-curated news digest HTML report (news-digest.html) — 4th daily report added to an existing multi-agent investment analysis pipeline
**Researched:** 2026-07-02
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

**ZERO new runtime dependencies are needed.** The existing stack fully covers this feature. Verified by reading the actual codebase (not assumed):

| Technology | Version (installed) | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| TypeScript + tsx | `typescript@^5.9.3`, `tsx@^4.21.0` | Report generator script (`generate-news-digest.ts`) | Identical pattern to the 3 existing generators (`generate-daily-report.ts`, `generate-meeting-minutes.ts`, `generate-portfolio-report.ts`) — no reason to deviate |
| Claude Code `Agent` tool (built-in, no package) | N/A | Single AI curation call: select 10-15 articles from the 20-80 filtered set, group by market, write Japanese commentary | Same mechanism already used for the 5 analysts and for the one-off "Portfolio Analysis" agent (`invest.md` Step 3d) — a single non-analyst Agent invocation is an established pattern, not a new capability |
| `zod@^4.3.6` (installed) | 4.x (latest published: 4.4.3) | Validate the curation agent's JSON output before it reaches the report generator | Every AI JSON output in this pipeline is validated via a zod schema in `src/meeting/schemas.ts` (e.g. `meetingResultSchema`, `analystRound1OutputSchema`). A `newsCurationResultSchema` following the same shape is the correct, consistent approach — do not skip validation for this report just because it's new |
| tmp/*.json handoff (file convention, no package) | N/A | Claude Code Agent (curation) → TS report generator boundary | Explicitly the only supported TS↔Claude boundary in this project (`tmp/*.json ハンドオフ境界` decision in PROJECT.md) — stdout is not reliably captured. Curation output should be written to `tmp/news-curation.json`, mirroring `tmp/meeting-result.json` |

### Supporting Libraries (already installed, reused as-is)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `src/scripts/report-utils.ts` (internal, not a package) | n/a | `escapeHtml`, `markdownToHtml`, `generateBaseStyles`, `scoreColor`, `verdictColor` | Reuse directly for news-digest.html to guarantee identical dark-theme styling and to avoid re-implementing HTML escaping (XSS-relevant since article titles/summaries are external, untrusted text) |
| `src/scripts/report-charts.ts` (internal pure SVG-string generator) | n/a | Pure SVG-string chart helpers | Not needed for this feature (no chart requirement in scope) — noted only to confirm the "no external chart library" pattern extends here too if a future milestone wants a source/market-mix chart |
| `fast-xml-parser@^5.5.6` | 5.x | RSS parsing | Already used by the existing news collection step (upstream of `filter.ts`); curation consumes `filter.ts`'s already-filtered output, so no new parsing is needed |
| `dotenv@^17.3.1` | 17.x | Env vars | No new env vars anticipated — curation runs inside the same Claude Code Agent context, not a separate external API |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `vitest@^4.0.18` | TDD for `generate-news-digest.ts`, the new zod schema, and any pure grouping/ordering helper functions | Follow existing test-alongside-source convention (`generate-report.test.ts`, `report-utils.test.ts`) — write `generate-news-digest.test.ts` and a schema validation test against fixture data before implementation, per project's TDD rule |

## Installation

```bash
# No installation needed — zero new dependencies.
# All required packages (typescript, tsx, zod, fast-xml-parser, vitest) are already in package.json.
```

## New Source Files Needed (not packages — first-party code following existing patterns)

This is the "genuinely missing" piece: not a library gap, but new files that don't exist yet, each following a pattern already present in the repo:

| File | Pattern to Follow | Purpose |
|------|--------------------|---------|
| `src/scripts/generate-news-digest.ts` | `src/scripts/generate-portfolio-report.ts` (simplest existing generator — single data source, no multi-round aggregation) | Reads `tmp/news-curation.json`, renders `news-digest.html` string, reuses `report-utils.ts` helpers |
| `newsCurationResultSchema` — add to `src/meeting/schemas.ts` (or a new `src/news-curation/schemas.ts` if kept separate from meeting types) | `meetingResultSchema` / `analystRound1OutputSchema` in `src/meeting/schemas.ts` | Validates AI curation output: array of 10-15 items with fields such as `{ ticker/topic, market: "米国株"\|"日本株"\|"グローバル", importanceRank, headline, commentary (Japanese), sourceUrl, sourceName }` before it's trusted by the HTML generator |
| New Step in `.claude/commands/invest.md` (after news collection/filter, before HTML report generation — e.g. inserted as its own step prior to "Step 3c: HTMLレポート生成") | Step 3d "ポートフォリオ分析" — a single embedded-prompt Agent call, not a 5-way parallel round | Curation prompt embedded inline (not read from `src/agents/*.ts`, since curation is not one of the 5 analyst personas per the "5+1構成を維持" constraint) — takes the filtered articles (from `tmp/news.json` post-`filter.ts`) as input, writes `tmp/news-curation.json` |
| Edit to `src/scripts/generate-report.ts` | Existing `Promise.all([...writeFile...])` block that writes the 3 current reports | Add a `generateNewsDigestHtml(...)` call + `writeFile(join(dateDir, "news-digest.html"), ...)` alongside the 3 existing writes |
| Edit to `src/scripts/update-index.ts` | Existing nav-entry logic for the 3 reports | Add the 4th report link to `docs/index.html` month-accordion entries — do not hand-edit `docs/index.html` directly per the project's explicit constraint ("エントリの追加は update-index.ts が行う") |

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|--------------------------|
| Single embedded-prompt Agent call in `invest.md` (mirrors Portfolio Analysis, Step 3d) | A 6th named analyst persona in `src/agents/` with its own system-prompt file | Only if curation logic needed to be reused across multiple pipeline steps or needed a stable identity/role like the 5 analysts. Out of scope per PROJECT.md constraint ("5+1構成を維持…キュレーションは既存パイプライン内のステップとして実装") |
| zod schema validation of curation output | Trusting raw Claude JSON output unvalidated | Never — every other AI output in this codebase is validated (`validateMeetingResult`, `validateWebSearchResult`, `validateReevaluationOutput`). Skipping validation for curation would be an inconsistency, not a simplification |
| Reuse `report-utils.ts` (`escapeHtml`, `generateBaseStyles`) | New standalone CSS/escaping for news-digest.html | Only if the digest needed a genuinely different visual language than the other 3 reports — not the case, since the goal is explicitly "既存3レポートと同じBloomberg風ダークテーマ・ナビゲーション" (PROJECT.md) |
| Plain string-template HTML generation (existing pattern) | A templating library (e.g. `mustache`, `handlebars`, `ejs`) | Only if HTML generation logic became deeply nested/conditional across many report variants — the existing 3 generators show plain TS template literals scale fine at this project's complexity; introducing a template engine would be an inconsistent one-off |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|--------------|
| External LLM API (OpenAI, Gemini, Anthropic API directly) for curation | PROJECT.md constraint: "Claude Code エコシステム内で完結"; Gemini was explicitly removed in v2.0 ("Gemini API 依存は v2.0 Phase 4 で完全除去済み") | Claude Code's own `Agent` tool, invoked from `invest.md`, exactly like the 5 analysts and moderator |
| A new HTML templating engine (EJS/Handlebars/etc.) | Inconsistent with existing plain-TS-template-literal generators; adds a dependency for no architectural gain at this scale | Plain TypeScript template literals, mirroring `generate-portfolio-report.ts` |
| A new chart/visualization library for a "topic mix" or "source breakdown" chart | Not in scope (feature spec has no chart requirement); PROJECT.md explicitly settled on pure SVG-string generation with zero external chart libraries | If a future milestone wants a chart, extend `report-charts.ts` with a new pure-SVG-string function, not a new library |
| ML/LLM-based per-article relevance scoring as a *new* mechanism feeding curation | PROJECT.md Out of Scope: "ML/LLMベース関連性スコアリング — 1記事ごとのAPI呼び出しはコスト非現実的" | The existing `filter.ts` (denylist + Jaccard dedup + recency scoring) already narrows ~160→20-80 articles. The *new* curation Agent call operates once on that pre-filtered batch (a single call, not per-article), which is a different and cost-acceptable pattern — do not conflate the two or add per-article scoring calls |
| MinHash/LSH or other heavy dedup for curation-stage article selection | PROJECT.md Out of Scope: "MinHash/LSH重複排除 — 160件/日にはJaccardで十分" | If the curation Agent needs to avoid near-duplicate picks among the 20-80 candidates, reuse the existing `jaccardSimilarity` / `normalizeTitle` / `tokenize` exports from `src/data/news/filter.ts` rather than adding a new dedup library — but note the AI Agent doing the selection can generally avoid duplicates via its own reasoning, since it sees full context, unlike the earlier mechanical filter stage |

## Stack Patterns by Variant

**If the curation step needs deterministic re-runs for testing (TDD):**
- Write `generate-news-digest.test.ts` against a fixture `NewsCurationResult` object (bypassing the Agent call entirely), the same way `generate-daily-report.test.ts` tests against a fixture `MeetingResult`
- Because the AI call itself is not unit-testable; only the deterministic TS rendering logic is — this matches how the rest of the pipeline is tested

**If the article count from `filter.ts` is at the low end (MIN=20):**
- The curation prompt should instruct the Agent to select "10-15, or fewer if insufficient quality articles exist" rather than forcing exactly 10-15
- Because forcing a fixed count when only 20 candidates exist risks including low-relevance filler; this mirrors the existing philosophy of flexible supply ("アナリストへの記事供給数柔軟化（MIN=20/MAX=80）")

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `zod@^4.3.6` | Existing `src/meeting/schemas.ts` patterns (`.object()`, `.enum()`, `.array()`, `.regex()`) | No API changes needed; latest published zod is 4.4.3 but no upgrade is required or in scope for this feature — the installed 4.x range already supports everything needed |
| `typescript@^5.9.3` / `tsx@^4.21.0` | `module: "ES2022"`, `moduleResolution: "bundler"` (tsconfig.json) | New files must use `.js` extension in relative imports (ESM convention already followed throughout `src/`, e.g. `from "./report-utils.js"`) |
| Node.js (runtime) | v24.3.0 (local dev environment) | No Node API surface needed beyond what's already used (`node:fs/promises`, `node:path`, `node:url`) |

## Sources

- Direct codebase inspection (HIGH confidence — ground truth, not training data):
  - `/Users/arai/invest/package.json` — confirmed full dependency list, no gaps
  - `/Users/arai/invest/src/scripts/generate-report.ts`, `generate-daily-report.ts` — confirmed report-generator pattern and multi-file write orchestration
  - `/Users/arai/invest/src/meeting/schemas.ts` — confirmed zod validation pattern for all AI JSON outputs
  - `/Users/arai/invest/src/data/news/filter.ts`, `src/data/news/types.ts` — confirmed `RawNewsArticle` / `NewsFilterResult` shape that curation will consume, and the existing dedup helpers available for reuse
  - `/Users/arai/invest/.claude/commands/invest.md` — confirmed pipeline orchestration pattern (Bash + Agent tool calls, tmp/*.json handoff, embedded one-off prompts like "Step 3d: ポートフォリオ分析" as the closest analog to the new curation step)
  - `/Users/arai/invest/.planning/PROJECT.md` — confirmed explicit constraints (5+1 agent structure, tmp/*.json boundary, no external LLM APIs, no chart libraries, no ML relevance scoring, no MinHash/LSH)
- `npm view zod version` / `npm view fast-xml-parser version` / `npm view vitest version` (executed 2026-07-02, live npm registry) — confirmed installed versions are current/compatible; no forced upgrades needed for this feature — HIGH confidence

---
*Stack research for: AI-curated news digest report (news-digest.html), v2.4 milestone*
*Researched: 2026-07-02*

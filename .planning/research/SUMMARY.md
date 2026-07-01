# Project Research Summary

**Project:** Investment Agent — v2.4 News Curation Report
**Domain:** AI-curated financial news digest, added as a 4th generated HTML report inside an existing multi-agent daily investment analysis pipeline
**Researched:** 2026-07-02
**Confidence:** HIGH

## Executive Summary

This milestone adds `news-digest.html` — an AI-curated selection of 10-15 articles (grouped by market: US / Japan / Global, ranked by importance, with short Japanese "why it matters" commentary) — as the 4th daily report in an already-mature pipeline. The research is unusually conclusive: **zero new runtime dependencies, no new folders, no new external services.** Every piece needed already exists as an established pattern in this codebase (single-purpose Agent step like `portfolio-analyst`, pure-function HTML generator like `generate-portfolio-report.ts`, zod-validated `tmp/*.json` contract like `meeting/schemas.ts`, shared dark-theme CSS in `report-utils.ts`). This is additive, not novel, work.

The recommended approach: (1) design the curation output contract first — a single Agent call reads the existing `tmp/news.json` (already filtered to 20-80 articles by `filter.ts`) and emits `tmp/news-curation.json` with ID-based article selection (never LLM-echoed URLs/titles), a 3-value market enum, and a soft-bounded article count; (2) build `generate-news-digest.ts` as a pure, null-tolerant function mirroring `generate-portfolio-report.ts`; (3) wire it into the pipeline as an isolated step that can never block the other 3 reports or deploy; (4) make the index/nav link conditional on the file actually existing for that date. This order directly follows the dependency chain surfaced by architecture research and pre-empts the two costliest pitfalls (hard pipeline failure, dangling 404 links).

The dominant risk is not technical complexity but **LLM output trustworthiness at a boundary this codebase hasn't combined before**: rendering clickable `<a href>` links built from AI-selected content. Pitfalls research is unusually specific and actionable here — the project's own `keyArticles` precedent (title+summary only, no URL field) exists precisely because this class of problem was already encountered. The fix (ID-based selection, TS-side lookup of the real URL, `escapeHtml()` on every interpolation, fail-soft isolation of the new step) is well-defined and low-risk to implement, but easy to skip if a developer treats this as "just a 4th report" rather than "the first optional/fallible report in the pipeline." All four research files converge tightly on this same risk from different angles (stack: validate everything; features: link-out instead of paraphrase to limit hallucination surface; architecture: null-fallback pattern; pitfalls: 5 of 8 findings are directly about this boundary) — that convergence is itself a strong signal the roadmap must treat the curation contract as its own dedicated phase, not a footnote inside HTML rendering.

## Key Findings

### Recommended Stack

No installation is required. The existing stack (TypeScript + tsx, Claude Code's built-in `Agent` tool, `zod@^4.3.6` for validation, `fast-xml-parser` already used upstream, `vitest` for TDD) fully covers this feature. The only "new" work is first-party source files following patterns already present in the repo — a new generator script, a new zod schema, a new pipeline step in `invest.md`, and small edits to the report orchestrator and index builder.

**Core technologies:**
- TypeScript + tsx: report generator script — identical pattern to the 3 existing generators, no reason to deviate
- Claude Code `Agent` tool (built-in): single AI curation call — same mechanism as the 5 analysts and the existing one-off "Portfolio Analysis" step, not a new capability
- `zod@^4.3.6`: validates curation JSON output — every AI JSON output in this pipeline is validated this way; skipping it here would be inconsistent
- `tmp/*.json` file handoff (convention, not a package): the only supported TS↔Claude boundary in this project — curation output goes to `tmp/news-curation.json`, mirroring `tmp/portfolio-analysis.json`

**Explicitly rejected (per PROJECT.md constraints, confirmed by stack research):** external LLM APIs, new HTML templating engines, new chart libraries, per-article ML/LLM relevance scoring, MinHash/LSH dedup.

### Expected Features

Feature research (MEDIUM confidence — competitor analysis of Bloomberg Five Things, Axios Smart Brevity, TLDR, Morning Brew, cross-checked against the actual `RawNewsArticle` data shape available in this codebase) converges on a clear MVP.

**Must have (table stakes):**
- Per-article headline + source + timestamp + link to original — near-zero cost, data already exists
- "Why it matters" Japanese commentary per article (1-2 sentences) — the actual value-add of curation; this is the CURA-01 core deliverable
- Market grouping (US / Japan / Global), importance-ordered within each group
- Concise count (10-15 of 20-80) — curation value comes from what's excluded as much as included
- Consistent Bloomberg dark-theme visual identity, reused from `report-utils.ts`

**Should have (competitive, v1.x):**
- Impact/importance badge (High/Medium/Low) — derived from the same score already needed for ordering, no extra AI call
- Related-tickers tag per article — partial free win from existing `ticker` field, full coverage needs light extraction in the same curation prompt
- Top-of-page lede paragraph summarizing the day

**Defer (v2+):**
- Cross-report thematic linking to meeting minutes (introduces pipeline-ordering dependencies)
- Historical digest archive/search (existing index.html accordion likely sufficient)
- **Explicitly reject:** per-article sentiment/confidence numeric scores (false precision, hallucination risk), full article paraphrase/rewrite (duplicates effort, multiplies hallucination surface), real-time updates, personalization controls, multi-language toggle — all conflict with PROJECT.md's existing Out-of-Scope decisions or the single-user/daily-batch nature of the tool.

### Architecture Approach

Architecture research (HIGH confidence, grounded in direct codebase inspection) confirms this is purely additive within the existing `meeting/` (contracts) and `scripts/` (generators/orchestration) domains — no new top-level folders. The curation step is a single-purpose Agent call (Pattern 1, same shape as `portfolio-analyst`, not a 6th standing analyst persona), producing a validated JSON contract that a pure-function generator renders with graceful null-fallback (Pattern 2, same shape as `generate-portfolio-report.ts`'s handling of a missing `portfolio-analysis.json`). Market classification and importance ranking are LLM-authored inside the JSON output, not recomputed via TS heuristics (Pattern 3) — mirroring how every other nuanced judgment (verdicts, sector views, picks) is always LLM-authored in this codebase.

**Major components:**
1. `meeting/types.ts` + `meeting/schemas.ts` (modified) — `NewsCuration`/`CuratedArticle` types and `newsCurationSchema`, colocated with every other pipeline JSON contract
2. **News Curation Agent (new)** — single Agent invocation in `invest.md`, reads `tmp/news.json`, writes `tmp/news-curation.json`; can run in parallel with the existing Step 3d Portfolio Analysis call
3. `generate-news-digest.ts` (new) — pure function `(NewsCuration | null) => string`, TDD, reuses `report-utils.ts` styling/escaping
4. `generate-report.ts`, `report-data-loaders.ts`, `update-index.ts` (modified) — orchestration wiring, graceful null loading, conditional 4th nav link

### Critical Pitfalls

Pitfalls research (HIGH confidence, grounded in direct reading of `invest.md`, `generate-report.ts`, `update-index.ts`, `schemas.ts`) identifies 8 findings; the top ones that must shape the roadmap:

1. **`Promise.all` collapses all 4 reports if the digest generator throws** — isolate `generateNewsDigestHtml()` in its own try/catch, outside the existing 3-report write batch, so a digest bug never takes down the 3 previously-reliable reports.
2. **Hallucinated/mismatched article URLs** — never let the curation agent free-type titles/URLs; assign stable article IDs, have the agent select by ID only, and look up the real title/url/source server-side in TS. This mirrors the project's own existing precedent (`keyArticles` schema deliberately has no `url` field).
3. **Rigid `min(10).max(15)` count validation causes hard pipeline failure** — use a soft clamp/truncate strategy instead of a hard zod throw, following the established `.passthrough()`/optional-field tolerance pattern already used for LLM field drift elsewhere in `schemas.ts`.
4. **`update-index.ts` links to a `news-digest.html` that was never generated** — make the 4th link conditional on the file actually existing for that date; `buildStandardLinks` currently assumes all reports always exist together, which is no longer true once one report depends on a fallible second LLM step.
5. **HTML injection via unescaped commentary or LLM-controlled `href`** — source the `href` from TS-side ID lookup (never LLM-echoed), and run it through `escapeHtml()` like every other interpolation site in this codebase, including the URL itself (not just title/commentary text).

Two additional findings worth flagging for planning: market classification (US/JP/Global) has no reliable ground-truth field to derive from (`category` is a fetch-path artifact, not a geography classifier) — treat this as a best-effort, low-stakes UX issue, not a data-integrity gate; and the digest step must get its own STEP marker with fail-soft semantics so a digest failure never blocks Step 4 deploy of the other 3 reports.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Curation Contract & Schema
**Rationale:** Nothing downstream (generator, orchestration, index) can be built or tested without this contract existing first. This is also where the highest-risk pitfalls (2, 3, 6) must be designed away, not patched in later.
**Delivers:** `NewsCuration`/`CuratedArticle` types in `meeting/types.ts`, `newsCurationSchema`/`validateNewsCuration` in `meeting/schemas.ts` with ID-based article selection, soft-bounded count validation, and a strict 3-value market enum — plus schema unit tests against fixture JSON (TDD RED).
**Addresses:** Table-stakes "Why it matters" commentary, market grouping, importance ordering (FEATURES.md P1 items) via a contract design, not yet rendering.
**Avoids:** Pitfall 2 (hallucinated URLs — ID-based selection), Pitfall 3 (rigid count — soft clamp), Pitfall 6 (unreliable market classification — enum + disambiguation rules in prompt).

### Phase 2: Report Generator (HTML Rendering)
**Rationale:** Fully testable against Phase 1's fixtures with zero pipeline wiring — matches this codebase's established TDD-generator convention and lets rendering/escaping risk be resolved in isolation before touching the live pipeline.
**Delivers:** `generate-news-digest.ts` + `.test.ts` (pure function, null-fallback shell, market-grouped rendering, 4th `ACCENT_VARIANTS` color in `report-utils.ts`).
**Uses:** `zod` validation from Phase 1, `report-utils.ts` (`escapeHtml`, `generateBaseStyles`) per STACK.md's explicit reuse recommendation.
**Implements:** Architecture Pattern 2 (pure-function generator + graceful-null fallback), Pattern 3 (LLM-side classification, TS-side rendering only).
**Avoids:** Pitfall 5 (HTML injection — escapeHtml on every field including href).

### Phase 3: Pipeline Integration & Orchestration
**Rationale:** With contract and renderer both independently tested, this phase focuses purely on wiring — the highest-risk *integration* pitfalls (isolated failure, fail-soft deploy gating, correct file-handoff) live here, separate from content-correctness concerns already resolved in Phases 1-2.
**Delivers:** New curation Agent step in `invest.md` (parallel with existing Step 3d Portfolio Analysis, per architecture research's recommendation), `loadNewsCuration()` in `report-data-loaders.ts`, `generate-report.ts` wiring with an isolated try/catch around the digest write (not inside the existing 3-report `Promise.all`), a dedicated `[STEP:news-digest:...]` marker with fail-soft semantics.
**Addresses:** End-to-end delivery of the AI curation/selection feature (FEATURES.md P1 core deliverable).
**Avoids:** Pitfall 1 (Promise.all collapse), Pitfall 7 (hard-fail blocking deploy of 3 working reports), Pitfall 8 (tmp/*.json handoff convention violation, stale files).

### Phase 4: Index/Nav Integration & Validation
**Rationale:** This must come last — it depends on the digest reliably existing-or-not from Phase 3's fail-soft path, and is the phase where the "looks done but isn't" risk (dangling links) is easiest to miss if done earlier or bundled in.
**Delivers:** `update-index.ts`'s `buildStandardLinks()` extended to a conditional 4th link (only included if `news-digest.html` was actually written for that date), updated `update-index.test.ts`, end-to-end pipeline validation (0-article day, malformed-JSON day, and a normal day all producing correct deploy behavior).
**Addresses:** Product coherence requirement — "既存3レポートと同じBloomberg風ダークテーマ・ナビゲーション" (PROJECT.md).
**Avoids:** Pitfall 4 (dangling 404 index links).

### Phase Ordering Rationale

- **Contract-first ordering is directly dictated by architecture research's "Suggested Build Order"** (JSON contract → generator → data loader → orchestration → index wiring → pipeline wiring → validation) — collapsing that 8-step sequence into 4 phases groups steps that share the same risk class and can be fully tested in isolation before the next phase depends on them.
- **Pitfalls cluster naturally by phase:** contract-design pitfalls (2, 3, 6) all resolve via schema/prompt decisions in Phase 1; rendering pitfalls (5) resolve in Phase 2; integration/failure-isolation pitfalls (1, 7, 8) resolve in Phase 3; the index-specific pitfall (4) resolves in Phase 4. This mapping was explicit in PITFALLS.md's own "Pitfall-to-Phase Mapping" table and is preserved here.
- **Deferring index/nav to last avoids a known trap:** research explicitly warns that "often done" checklists miss the conditional-link requirement because it's easy to add the 4th link unconditionally at the same time as the other wiring — sequencing it as its own phase, after fail-soft behavior is proven in Phase 3, forces an explicit verification step rather than an assumption.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1 (Curation Contract & Schema):** the prompt design for market classification disambiguation rules (Fed/macro/FX news → "Global" vs "US") is a judgment call with no ground truth in the codebase; consider `--research-phase` if the initial enum/prompt approach shows high misclassification in early testing.

Phases with standard patterns (skip research-phase):
- **Phase 2 (Report Generator):** directly mirrors `generate-portfolio-report.ts`, an existing, working pattern — no new research needed.
- **Phase 3 (Pipeline Integration):** directly mirrors the existing `portfolio-analyst` Step 3d Agent-call pattern and STEP-marker conventions already documented in `invest.md` — no new research needed.
- **Phase 4 (Index/Nav Integration):** `report-utils.ts` already documents flexible link-count support ("do not assume 3 links per entry") — the conditional-link change is additive to an existing, well-understood mechanism.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Verified via direct codebase inspection (package.json, existing generators, schemas.ts) plus live npm registry checks; zero ambiguity, zero new dependencies needed |
| Features | MEDIUM | Grounded in the project's actual data shapes (HIGH) but the competitive-format analysis (Bloomberg/Axios/TLDR/Morning Brew) relies on MEDIUM/LOW-confidence third-party sources for newsletter-format conventions |
| Architecture | HIGH | Entirely grounded in direct reading of the live pipeline (`invest.md`, `generate-report.ts`, `schemas.ts`, `update-index.ts`) — proposed contract and build order are extrapolations from proven existing patterns, not speculative |
| Pitfalls | HIGH | All 8 findings are grounded in specific line-level codebase evidence (existing `keyArticles` precedent, `Promise.all` structure, `buildStandardLinks` hardcoding, STEP marker fail-hard/fail-soft distinction) |

**Overall confidence:** HIGH

### Gaps to Address

- **Market classification accuracy is unverifiable in advance:** no existing field is authoritative for US/JP/Global; the roadmap should treat this as "best-effort UX, not a blocking quality gate" and plan a lightweight manual spot-check after the first week of production digests rather than trying to perfect the prompt before shipping (per PITFALLS.md Pitfall 6 recommendation).
- **Parallel vs. sequential placement of the curation Agent call in `invest.md`** (extending Step 3d to 2 parallel Agents vs. a standalone sequential Step 3e) is a phase-level implementation decision, not fully resolved by research — architecture research recommends parallel for wall-clock savings but flags sequential as an acceptable lower-risk alternative; decide during Phase 3 planning based on implementation-time risk appetite.
- **Article count guardrail strictness** (soft clamp with truncation logic vs. simple warn-and-accept-shorter-list) needs a concrete implementation decision in Phase 1 — research recommends soft validation over hard rejection but doesn't prescribe the exact truncation algorithm; use `filter.ts`'s existing `sortByPriorityScore()` as the tie-breaker if the agent over-selects.

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection: `/Users/arai/invest/package.json`, `/Users/arai/invest/src/scripts/generate-report.ts`, `generate-portfolio-report.ts`, `generate-daily-report.ts`, `report-utils.ts`, `report-data-loaders.ts`, `update-index.ts`
- `/Users/arai/invest/src/meeting/types.ts`, `/Users/arai/invest/src/meeting/schemas.ts` — existing TS↔Claude JSON contract and validation patterns
- `/Users/arai/invest/src/data/news/filter.ts`, `/Users/arai/invest/src/data/news/types.ts` — `RawNewsArticle` shape, filter pipeline, MIN=20/MAX=80 sizing
- `/Users/arai/invest/.claude/commands/invest.md` — full pipeline orchestration, STEP marker conventions, existing Agent-call patterns
- `/Users/arai/invest/scripts/run.sh` — launchd entrypoint, `PROTECT_FILES` checksum scope
- `/Users/arai/invest/.planning/PROJECT.md` — milestone goal, explicit constraints and Out-of-Scope rationale
- `npm view zod version` / `npm view fast-xml-parser version` / `npm view vitest version` (2026-07-02, live registry checks)

### Secondary (MEDIUM confidence)
- Bloomberg "5 things to start your day" / "Five Things You Need to Know" — newsletter format pattern (WebSearch, cross-checked across archived editions)
- Axios Smart Brevity / "Why it matters" methodology — third-party analysis, consistent across multiple independent write-ups; corroborated by an Axios press release primary source
- arXiv: "AI use in American newspapers is widespread, uneven, and rarely disclosed" — academic source on AI-generated news hallucination rates, informs the link-out-not-paraphrase recommendation

### Tertiary (LOW confidence)
- Morning Brew newsletter deep dive (Markets section) — single-source third-party pattern description, needs no further validation since it only informed a non-binding stylistic comparison
- TLDR Newsletter Review 2026 — third-party review, WebSearch only, informed item-count comparison only (not a hard requirement)

---
*Research completed: 2026-07-02*
*Ready for roadmap: yes*

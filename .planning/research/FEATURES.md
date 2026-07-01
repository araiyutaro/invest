# Feature Research

**Domain:** AI-curated financial news digest (daily HTML report, personal investment tool)
**Researched:** 2026-07-02
**Confidence:** MEDIUM

Scope note: This research covers only the NEW feature — `news-digest.html`, the 4th daily
report (v2.4 milestone, CURA-01). It assumes the existing filtered article pool (20-80
articles/day, deduped, denylist-filtered, from `src/data/news/filter.ts`) as the sole input.
Fields available per article from `RawNewsArticle`: `title`, `summary`, `source`, `url`,
`publishedAt`, `category`, `ticker?`. There is no existing "importance" signal beyond
`priorityScore` (recency + portfolio-ticker bonus used for supply ordering to analysts) — the
digest's importance ranking must be produced fresh by the curation step; it cannot be reused
as-is since recency ≠ importance.

This supersedes the previous FEATURES.md content (v2.2 News Quality milestone, dated
2026-06-26), which covered dedup/relevance-filter features that are now already shipped
(v2.2/v2.3) and out of scope for this research pass.

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist in any curated news digest. Missing these = the digest reads as
a raw article dump, not a "curated" product.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Per-article headline + source + timestamp | Every digest format studied (Bloomberg Five Things, Axios, TLDR, Morning Brew) leads each item with what/who/when before commentary | LOW | Already available directly from `RawNewsArticle` (title, source, publishedAt) — no new data collection needed |
| Link to original article | Digest is a curation layer, not a replacement; readers expect to click through to verify or read more. Also mitigates AI-hallucination risk (see Pitfalls below) by anchoring every claim to a checkable source | LOW | `url` field already present; render as anchor tag |
| "Why it matters" / commentary per article | Axios's Smart Brevity ("Why it matters", "The bottom line") and Bloomberg's framing both center on explaining significance, not just repeating the headline — this is the entire value-add of curation over a raw feed | MEDIUM | Requires a new AI generation step (1-2 sentence Japanese commentary per selected article); this is the CURA-01 core deliverable per PROJECT.md |
| Section grouping (by market/theme) | Every reviewed format groups items (Morning Brew's Markets section, Axios's categorized items, TLDR's themed sections) — an unsorted list of 10-15 unrelated headlines is harder to scan | LOW-MEDIUM | Milestone already specifies US / Japan / Global grouping — requires the curation step to assign a market tag per article (new small classification task) |
| Importance-based ordering within section | Bloomberg "Five Things", Axios, TLDR all rank by significance, not just recency — readers scan top-to-bottom expecting most important first | MEDIUM | Requires the AI curation step to produce a rank/score, not just a selection; recency-based `priorityScore` from filter.ts is an insufficient proxy (recency ≠ importance) |
| Concise item count (10-15, not all 20-80) | Every studied format is explicitly a *reduction* of the raw feed (TLDR: "5 minutes per edition"; Axios: "six or so items"; Bloomberg: literally "Five Things") — curation value comes from what's excluded as much as what's included | LOW | Already specified in milestone scope (10-15 of 20-80) |
| Consistent visual identity with other 3 reports | User already has Bloomberg-style dark theme + nav across daily/meeting/portfolio reports; a 4th report with a different look would break the "single product" feel | LOW | Reuse existing CSS/layout partials from `report-utils.ts` / existing report generators rather than building new styling |
| Publish/generation date visible | All reviewed digests are dated editions (Bloomberg "5 things to start your day" is date-stamped) — readers need to know freshness, especially since input articles are filtered to a 24h window | LOW | Reuse existing date-header pattern from other 3 reports |

### Differentiators (Competitive Advantage)

Features that set this digest apart from a generic newsletter clone. Should tie back to the
project's Core Value (multi-angle AI-assisted daily decision support for a single power user).

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Related tickers / portfolio relevance tag per article | Bloomberg terminal news and Seeking Alpha both tag articles with affected tickers; for this user (own portfolio + watchlist), flagging "this affects your holding X" turns a generic digest into a personalized one — directly serves Core Value ("individual investor decision support") | LOW-MEDIUM | `ticker` field already exists on some articles (Finnhub company news); for articles without an explicit ticker, the AI curation step can extract tickers mentioned in title/summary as a lightweight step (no new API calls) |
| Impact/importance badge (e.g., High/Medium impact) | Gives at-a-glance visual triage beyond ordinal position — useful for a single reader scanning quickly before market open, echoes Axios's scannable "Smart Brevity" design philosophy | LOW | Derived directly from the same importance score already needed for ordering; just needs a 3-tier bucketing + badge styling, no extra AI calls |
| Cross-report thematic link (digest ↔ daily report/meeting minutes) | Existing pipeline already does previous-day report injection for analyst memory (ANLQ-01, v2.3); the digest can note "この記事は本日のミーティングで議論された [テーマ] に関連" to bridge the 4 reports into one coherent daily narrative | MEDIUM | Requires digest generation step to run after/alongside meeting analysis and cross-reference topics — nice-to-have, not required for v1; depends on meeting output being available at digest-generation time |
| Short top-of-page lede/overview paragraph | Bloomberg Five Things and Morning Brew both open with a 2-3 sentence "here's what's moving markets today" framing before the itemized list — gives context for someone who reads only the top | LOW-MEDIUM | One additional short AI-generated paragraph synthesizing the day's digest; cheap since it reuses the already-curated article set |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems for this specific project (personal daily tool,
single AI curation pass, existing cost/complexity constraints already documented in
PROJECT.md Out of Scope).

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|------------------|-------------|
| Per-article sentiment score / numeric AI confidence score | Looks quantitative and "data-driven," common in fintech news products | Adds a fabricated precision (a "73% bullish" score from an LLM reads as more authoritative than it is) — high hallucination/false-precision risk for a personal decision tool; PROJECT.md already rejected "ML/LLMベース関連性スコアリング" per-article as cost/complexity-not-worth-it | Keep impact tagging qualitative (High/Medium/Low) tied to the same importance judgment already needed for ordering — no separate scoring subsystem |
| Full-length AI paraphrase/rewrite of each article body | Seems like it saves the reader a click | Multiplies hallucination surface area (research shows AI-labeled news articles are markedly more likely to contain a hallucinated claim than human-written ones) for content the user could otherwise read at the source; also duplicates effort already done well by existing analyst Round 1/2 prose in the other 3 reports | Keep commentary short (1-2 sentence "why it matters"), always link to source, let the reader click through for full text |
| Real-time/intraday digest updates | "Fresher is better" instinct | PROJECT.md already explicitly rejects real-time streaming ("日次バッチで十分"); this is a daily personal tool run once via launchd at 8am — intraday updates would require a second pipeline run and duplicate infra | Single daily generation, same cadence as the other 3 reports |
| New dedicated news fetching/scoring pipeline for the digest | Tempting to fetch a differently-curated article set optimized for "digest-worthiness" | PROJECT.md explicitly scopes this milestone to reuse the existing filtered pipeline output ("新規取得ロジックは不要") — building a parallel fetch path duplicates the news pipeline (Finnhub + Google News + RSS + filter.ts) for no proven benefit | Curation step selects from the same `NewsFilterResult.articles` already produced for the 5 analysts |
| Reader personalization controls (topic filters, mute keywords, saved articles) | Feels like a "real newsletter product" feature | This is a single-user personal tool with no auth/settings infrastructure; adding stateful preferences is out of proportion to a static daily HTML report generator deployed to GitHub Pages | None needed — the digest is already implicitly personalized via portfolio-ticker awareness in the existing pipeline |
| Multi-language toggle (EN/JP switch) | Source articles are a mix of English and Japanese | Existing 3 reports and the whole product are Japanese-language by convention (per PROJECT.md, analyst prose is Japanese); a toggle adds UI/generation complexity with no stated user need (single Japanese-speaking user) | All curated commentary in Japanese regardless of source article language, same as the existing analyst reports handle mixed-language input today |

## Feature Dependencies

```
[Table Stakes: Per-article headline/source/link]
    └──requires──> [existing filter.ts output] (already built, no dependency risk)

[Table Stakes: "Why it matters" commentary]
    └──requires──> [New: AI curation/selection step]
                       └──requires──> [existing filtered article pool as input]

[Table Stakes: Importance-based ordering]
    └──requires──> [New: AI curation step producing an importance judgment]
                       └──enhances──> [Differentiator: Impact/importance badge] (same score, different rendering)

[Table Stakes: Section grouping (US/Japan/Global)]
    └──requires──> [New: AI curation step producing a market classification per article]

[Differentiator: Related tickers tag]
    └──partially satisfied by──> [existing `ticker` field on Finnhub company-news articles]
    └──requires (for full coverage)──> [New: lightweight ticker extraction within curation step]

[Differentiator: Top-of-page lede paragraph]
    └──requires──> [New: AI curation step's selected+ranked article set as input]
    └──enhances──> [overall digest, not required for MVP]

[Table Stakes: Consistent visual identity]
    └──requires──> [existing report-utils.ts / CSS / dark theme partials]

[Differentiator: Cross-report thematic link]
    └──requires──> [Table Stakes: "Why it matters" commentary]
    └──requires──> [meeting analysis output being available at digest-generation time]
    └──conflicts with──> [pipeline step ordering if digest generation is scheduled independently of the meeting]
```

### Dependency Notes

- **All table-stakes content features (commentary, ordering, grouping) require a single new
  "AI curation step":** rather than three separate AI calls, the curation prompt should
  produce selection + ranking + market classification + commentary in one structured pass
  over the filtered article pool. This keeps cost proportional to the existing pipeline (one
  additional Claude Code step, not three).
- **Importance ordering and impact badge share the same underlying score:** design the
  curation step to output a single importance judgment (e.g., ordinal rank or 3-tier label)
  and derive both list order and badge from it — avoid computing two different "importance"
  signals that could disagree.
- **Related tickers tag is only a *partial* free win:** articles from Finnhub company-news
  already carry `ticker`, but Google News/RSS articles do not. Full ticker coverage requires
  the curation step to also extract mentioned tickers from title/summary text — a small
  additional instruction in the same prompt, not a new pipeline stage.
- **Cross-report thematic link conflicts with independent scheduling:** if news-digest.html
  generation runs before or in parallel with the meeting (rather than after), it cannot
  reference meeting themes. This is a good reason to treat it as a v2+ feature rather than
  building pipeline-ordering complexity into v1.
- **Visual identity reuse is a hard dependency, not optional:** the existing dark-theme CSS,
  navigation, and date-header patterns already live in `report-utils.ts` / existing report
  generators (`generate-report.ts`, `generate-portfolio-report.ts`) — this dependency should
  be treated as "reuse, don't rebuild" given the SHA256 checksum protection already in place
  on other generated docs (OPS-02, v2.3).

## MVP Definition

### Launch With (v1)

Minimum viable digest — what's needed to validate "AI-curated digest is more useful than the
raw filtered feed."

- [ ] Single AI curation step selecting 10-15 articles from the existing filtered pool (20-80) — this is the entire point of "curation"; without a real reduction it's just a re-listing
- [ ] Per-article: headline, source, published time, link to original — non-negotiable table stakes, near-zero cost since data already exists
- [ ] Per-article Japanese "why it matters" commentary (1-2 sentences) — the core value-add distinguishing this from a plain article list; this is literally what CURA-01 specifies
- [ ] Market grouping (US / Japan / Global) — explicitly scoped in PROJECT.md milestone target features
- [ ] Importance-ordered within each group — without ranking, "curated" reduces to "randomly selected," undermining trust
- [ ] Reuse existing Bloomberg dark-theme layout, nav, and deploy flow (docs/YYYY-MM-DD/news-digest.html) — required for product coherence and explicitly stated in milestone scope

### Add After Validation (v1.x)

Features to add once the core digest is shipped and the user has used it for real daily
decisions for a few weeks.

- [ ] Impact/importance badge (visual High/Medium/Low tag) — add once the underlying importance score from v1's ranking has proven reliable/trustworthy in practice
- [ ] Related-tickers tag per article (including extraction beyond the existing `ticker` field) — add once basic digest format is validated; nice-to-have personalization layer
- [ ] Top-of-page lede/overview paragraph — add if user finds jumping straight into the list per section lacks context; cheap to add later since it only needs the already-curated set

### Future Consideration (v2+)

Features to defer until the digest itself has proven valuable in daily use.

- [ ] Cross-report thematic linking to meeting minutes/daily report — defer because it introduces pipeline-ordering dependencies (digest must run after meeting analysis) that add operational complexity to a currently-working launchd pipeline; validate the standalone digest first
- [ ] Historical digest archive/search — defer; the existing index.html monthly accordion navigation may already suffice, revisit only if browsing 4 reports/day becomes unwieldy over months

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| AI curation/selection (10-15 of 20-80) | HIGH | MEDIUM | P1 |
| Per-article headline/source/link | HIGH | LOW | P1 |
| "Why it matters" Japanese commentary | HIGH | MEDIUM | P1 |
| Market grouping (US/Japan/Global) | HIGH | LOW-MEDIUM | P1 |
| Importance ordering within group | HIGH | MEDIUM | P1 |
| Reuse existing dark theme/nav/deploy | HIGH | LOW | P1 |
| Impact/importance badge | MEDIUM | LOW | P2 |
| Related tickers tag | MEDIUM | LOW-MEDIUM | P2 |
| Top-of-page lede paragraph | MEDIUM | LOW-MEDIUM | P2 |
| Cross-report thematic linking | LOW-MEDIUM | MEDIUM-HIGH | P3 |
| Sentiment/confidence numeric scores | LOW | MEDIUM | Reject (anti-feature) |
| Full article paraphrase/rewrite | LOW | MEDIUM | Reject (anti-feature) |

**Priority key:**
- P1: Must have for launch (v1 of news-digest.html)
- P2: Should have, add when possible (v1.x)
- P3: Nice to have, future consideration (v2+)

## Competitor Feature Analysis

| Feature | Bloomberg Five Things / Axios | TLDR / Morning Brew | Our Approach |
|---------|-------------------------------|----------------------|--------------|
| Item count | Bloomberg: literally 5 items; Axios: ~6 items per newsletter (Smart Brevity discipline) | TLDR: enough for "5 minutes"; sectioned by theme | 10-15 items — larger than a consumer newsletter because this is a single power-user tool wanting fuller market coverage, still a major reduction from 20-80 |
| Significance framing | Axios: explicit "Why it matters" labeled block; Bloomberg: narrative framing, less labeled | TLDR: terse 2-3 sentence summary, less explicit "why" framing | Adopt Axios-style explicit "why it matters" commentary per article — clearest, most scannable pattern found, matches CURA-01's "解説コメント" requirement |
| Grouping | Bloomberg groups by region edition (Americas/Asia); Axios groups by topic | TLDR groups by theme (Big Tech, Science, Misc) | Group by market (US/Japan/Global) — matches this tool's existing US+Japan stock dual focus better than a topic-based grouping |
| Personalization | None of the reviewed newsletter formats personalize to an individual portfolio (they're mass-market products) | Same — no personalization | Ticker-relevance tagging tied to the user's own portfolio — a genuine differentiator vs. all reviewed newsletter formats, since this tool already has portfolio context the mass-market products lack |
| Source transparency | Both link out to full articles; neither replaces the source | Both link out; TLDR explicitly avoids long-form paraphrase | Always link to original `url`; keep commentary short — directly mitigates AI hallucination risk noted in research (AI-labeled news articles show markedly higher hallucination rates than human-written ones per recent academic study) |

## Sources

- [Bloomberg "5 things to start your day"](https://link.mail.bloombergbusiness.com/public/14190293) — MEDIUM confidence (WebSearch, cross-checked across multiple Bloomberg newsletter pages; note the "Five Things" newsletter itself was retired in Oct 2024 in favor of "Markets Daily," but the format pattern is well documented across years of archived editions)
- [Bloomberg Five Things You Need to Know — Americas edition](https://www.bloomberg.com/news/newsletters/2024-10-07/five-things-you-need-to-know-to-start-your-day-americas) — MEDIUM confidence
- [Axios Smart Brevity / "Why it matters" methodology](https://writewithai.substack.com/p/axios-newsletter-template-for-content) — MEDIUM confidence (third-party analysis of a well-documented, publicly discussed Axios methodology; not primary source but consistent across multiple independent write-ups)
- [Axios Macro newsletter launch](https://www.axios.com/press-past-releases/axios-launches-axios-macro-newsletter) — MEDIUM confidence (Axios press release, primary source for format description)
- [Morning Brew newsletter deep dive — Markets section](https://theaudiencers.com/deep-dive-into-the-morning-brew-newsletter-andy-griffiths/) — LOW-MEDIUM confidence (third-party analysis, single-source pattern description)
- [TLDR Newsletter Review 2026](https://www.readless.app/blog/tldr-newsletter-review-2026) — LOW-MEDIUM confidence (third-party review, WebSearch only, not independently cross-verified against a raw TLDR archive)
- [arXiv: AI use in American newspapers is widespread, uneven, and rarely disclosed](https://arxiv.org/pdf/2510.18774) — MEDIUM confidence (academic paper, primary source on AI-generated news hallucination rates)
- [AI hallucination risk in financial services](https://launchlemonade.app/blog/ai-hallucination-risk-in-financial-services-what-your-firm-needs-to-know) — LOW-MEDIUM confidence (industry blog, corroborates directionally but not independently verified)
- Codebase inspection: `/Users/arai/invest/src/data/news/filter.ts`, `/Users/arai/invest/src/data/news/types.ts`, `/Users/arai/invest/src/report/`, `/Users/arai/invest/.planning/PROJECT.md` — HIGH confidence (direct source reading, defines actual available data fields and existing pipeline constraints)

---
*Feature research for: AI-curated financial news digest (news-digest.html, v2.4 milestone)*
*Researched: 2026-07-02*

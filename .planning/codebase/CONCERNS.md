# Codebase Concerns

**Analysis Date:** 2026-04-08

## Tech Debt

**Unsafe Type Casting in Market Data Fetching:**
- Issue: Type casting with `as unknown as Record<string, unknown>` in `src/data/market.ts:60` bypasses TypeScript's type system for API responses
- Files: `src/data/market.ts:60`, `src/data/news/analyzer.ts:101`
- Impact: Breaking changes in yahoo-finance2 API structure are not caught by TypeScript at compile time. Downstream code receives data with missing or unexpected fields, causing silent data loss (null values propagated)
- Fix approach: Implement proper type guards using Zod schemas for API responses from yahoo-finance2 and Finnhub APIs instead of broad `unknown` casts

**Inconsistent Error Handling in Report Generation:**
- Issue: Silent failures in `src/report/generator.ts:301` and `src/report/portfolio-generator.ts:241` with bare `catch` blocks that only log errors
- Files: `src/report/generator.ts:301-303`, `src/report/portfolio-generator.ts:241-243`
- Impact: If index.html or portfolio.html updates fail, the system silently continues, leaving indices out of sync with actual reports. Users won't discover this until checking the docs directory manually
- Fix approach: Re-throw errors with context or track index update failures; consider validation pass before file writes

**Unvalidated News Article Parsing:**
- Issue: Complex XML parsing in `src/data/news/google-news.ts` and `src/data/news/rss-sources.ts` with minimal validation of RSS/XML structure
- Files: `src/data/news/google-news.ts:65-71`, `src/data/news/rss-sources.ts:60-80`
- Impact: Malformed feeds, missing fields, or structural changes silently degrade to partial data (e.g., empty title, missing publishedAt defaults to now())
- Fix approach: Add Zod validation schemas for RssItem and parsed XML structures before type conversion

## Performance Bottlenecks

**Serial API Calls in News Fetching:**
- Issue: While individual news source fetches run in parallel (`src/data/news.ts:14-18`), the analysis phase serializes all analyses through Gemini API in `src/data/news/analyzer.ts:84-96` with no rate limiting consideration
- Files: `src/data/news/analyzer.ts:78-102`
- Impact: Analysis generation is the slowest phase. With 5 analysis configs, if Gemini API rate limit is hit mid-run, entire job fails. No retry mechanism or circuit breaker
- Improvement path: Add exponential backoff retry logic; consider batching analyses by priority; cache recent analyses to avoid regenerating identical content

**Unoptimized Markdown-to-HTML Conversion:**
- Issue: Multiple sequential regex passes in `src/report/generator.ts:14-52` with no early exit or memoization for repeated markdown conversions
- Files: `src/report/generator.ts:14-52`
- Impact: Every report generation runs ~50+ regex operations on potentially large markdown strings. No caching of converted sections
- Improvement path: Cache inline conversions; consider lazy evaluation for conditionally-rendered sections; profile actual performance first

**No Parallel Chart Generation with API Call Limits:**
- Issue: `generateSectorChart` and `generateMarketOverviewChart` in `src/data/charts.ts` run concurrently but share the same API quota
- Files: `src/index.ts:80-83`, `src/data/charts.ts`
- Impact: If chart generation fails for one, both fail. Concurrent requests may hit NanoBanana rate limits without backoff strategy
- Improvement path: Add rate-limiting queue; implement graceful degradation (skip charts if generation fails, not fatal)

## Fragile Areas

**Portfolio Report Generation Has No Fallback:**
- Issue: Main flow in `src/index.ts:102-117` wraps portfolio meeting in try-catch that only logs error, but portfolio failure blocks progression to final summary step
- Files: `src/index.ts:102-117`
- Why fragile: If any single portfolio stock fails to fetch (bad ticker, market closed, API throttle), entire `fetchPortfolioData` returns fewer stocks, which changes agent analysis quality. No minimum data threshold enforced
- Safe modification: Add retry for individual stock fetches; require minimum 70% success rate before proceeding; validate holdings against valid symbol list
- Test coverage: No tests cover portfolio fetch failure paths; missing coverage for partial stock data scenarios

**Markdown-to-HTML Renderer Not RFC-Compliant:**
- Issue: Custom regex-based markdown parser in `src/report/generator.ts:14-52` and duplicated in `src/report/portfolio-generator.ts:14-52` does not properly escape generated HTML
- Files: `src/report/generator.ts:14-52`, `src/report/portfolio-generator.ts:14-52`
- Why fragile: Agent outputs containing `<script>`, `&lt;` entities, or special regex characters can break HTML rendering or be misescaped. Example: `**<img src=x onerror=alert(1)>**` becomes `<strong><img src=x onerror=alert(1)></strong>` (not escaped)
- Safe modification: Use a proper markdown parser library (marked, showdown) instead of regex; validate all HTML output
- Test coverage: No tests for XSS vectors in agent-generated content

**Gemini Model Version Lock without Fallback:**
- Issue: Hard-coded `gemini-3.1-pro-preview` in `src/gemini.ts:21` and `gemini-2.5-flash-image` in `src/data/charts.ts:20`
- Files: `src/gemini.ts:15-27`, `src/data/charts.ts:14-42`
- Why fragile: "Preview" models are unstable and may be deprecated without notice. No fallback to stable model. If API deprecates `gemini-3.1-pro-preview`, entire agent system stops working
- Safe modification: Add model availability checking on startup; implement graceful downgrade to `gemini-2.5-pro` (stable); add configuration for model selection
- Test coverage: No tests for API unavailability or model version mismatch

**News Analyzer Fabricates Data on Missing Articles:**
- Issue: `src/data/news/analyzer.ts:17` returns fallback string encouraging LLM to use "latest knowledge" when no articles found
- Files: `src/data/news/analyzer.ts:13-18`
- Why fragile: When RSS feeds are empty or API fails silently, analyzer prompt explicitly instructs Gemini to hallucinate based on training data, producing outdated/false information presented as current analysis
- Safe modification: Return explicit "Data unavailable" marker; skip analysis if insufficient articles (no fallback to hallucination); require minimum article count
- Test coverage: No tests verify behavior when feeds return empty results

## Known Issues

**Silent Null Propagation in Stock Quote Fields:**
- Symptoms: Stock analysis may show "N/A" for PER, market cap if API returns missing fields
- Files: `src/data/market.ts:75-78`, `src/portfolio/data.ts:36-41`
- Trigger: yahoo-finance2 returns null/undefined for discontinued stocks, delisted symbols, or market closure
- Workaround: Add fallback values in display layer; add stock validation pass before analysis

**Console Logging Pollutes Logs:**
- Symptoms: Console includes both progress logs and error logs mixed; no structured logging
- Files: `src/index.ts` (13 console calls), `src/meeting/runner.ts` (3 console calls), `src/portfolio/runner.ts` (3 console calls), `src/data/news.ts`, `src/data/market.ts:62`, `src/data/charts.ts:39`, `src/data/news/analyzer.ts:92`, `src/report/generator.ts:302`, `src/report/portfolio-generator.ts:242`
- Trigger: Every run; automated execution via launchd makes logs difficult to parse for failures
- Workaround: Pipe to structured logging (e.g., Winston, Pino); separate stderr for errors

**Index HTML Update Race Condition:**
- Symptoms: If multiple concurrent meeting runs execute, duplicate index entries possible or index corruption
- Files: `src/report/generator.ts:277-303`, `src/report/portfolio-generator.ts:218-243`
- Trigger: Multiple cronjobs or manual runs of `src/index.ts` within same day
- Workaround: Add file locking; use atomic read-modify-write with temp file; validation before write

## Security Considerations

**API Keys Hardcoded in Model Names (Low Risk):**
- Risk: Models like "gemini-3.1-pro-preview" are public, but token exposure would be critical
- Files: `src/gemini.ts:15-27` uses `process.env.GEMINI_API_KEY` (safe), `src/data/news/finnhub.ts:50` uses `process.env.FINNHUB_API_KEY` (safe)
- Current mitigation: Environment variables not committed (`.env` in `.gitignore`)
- Recommendations: Add .env validation at startup; add logging for missing credentials; rotate keys periodically

**HTML Injection from Agent-Generated Content:**
- Risk: LLM outputs embedded directly into HTML without escaping in agent card sections
- Files: `src/report/generator.ts:210-211`, `src/report/portfolio-generator.ts:161`
- Current mitigation: `escapeHtml` function used before `markdownToHtml`, but markdown parser output is not re-escaped
- Recommendations: Use markdown library with HTML sanitization; validate all LLM outputs against whitelist patterns

**No Input Validation on Stock Symbols:**
- Risk: Arbitrary symbols passed to yahoo-finance2 could be exploited for DoS or information leakage
- Files: `src/portfolio/holdings.ts:8-16` hardcoded (safe), but `src/data/market.ts` uses constant symbols (safe)
- Current mitigation: Only predefined symbols used; static holdings config
- Recommendations: Add symbol validation regex; prevent shell injection in any dynamic symbol addition

## Scaling Limits

**News Analysis Not Batched by LLM Token Usage:**
- Current capacity: ~5 analyses per run, each ~500-1000 tokens of articles
- Limit: If expanding to 50+ articles per analysis, prompt token cost explodes, hitting Gemini API limits
- Scaling path: Implement prompt truncation; batch articles into priority cohorts; cache recurring analyses

**Portfolio Size Hardcoded to 7 Holdings:**
- Current capacity: 7 stocks as per `src/portfolio/holdings.ts`
- Limit: If expanding to 50+ holdings, portfolio analysis prompt balloons, API response may exceed context limits
- Scaling path: Paginate portfolio analysis (5 stocks per round); use hierarchical summary (sector > individual stock)

**Chart Generation Sequential on Two Endpoints:**
- Current capacity: 2 concurrent chart requests
- Limit: If expanding to sector breakdown + technical patterns, API quota may be exceeded
- Scaling path: Queue chart requests; implement fallback to text-based charts

## Dependencies at Risk

**@google/generative-ai v0.24.1 on Deprecated gemini-3.1-pro-preview:**
- Risk: Google Cloud marks preview models as unstable; gemini-3.1-pro-preview may be deprecated
- Impact: All agent analysis stops working without code change
- Migration plan: Add model fallback chain (3.1-pro → 2.5-pro → 2.5-flash); upgrade package to latest version monthly

**yahoo-finance2 v3.13.2 with Unstable API:**
- Risk: Stock quote API structure changed multiple times; no stable SemVer guarantee
- Impact: Market data fetching fails silently due to type casting bypass
- Migration plan: Implement Zod schema validation; consider alternative provider (Alpha Vantage, Twelve Data); add API schema versioning

**fast-xml-parser v5.5.6 with Complex Nested Parsing:**
- Risk: RSS feed structure changes break XML parsing without warning
- Impact: News analysis falls back to hallucination mode
- Migration plan: Use well-tested XML library (xml2js); validate against XSD schemas

## Missing Critical Features

**No Data Persistence Between Runs:**
- Problem: Each run is stateless; no tracking of historical analyses, no ability to compare day-over-day changes
- Blocks: Trend detection, anomaly alerts, historical performance audit
- Solution priority: Medium (useful for retrospective analysis)

**No Testing Framework Configured:**
- Problem: `package.json` includes vitest but no test files exist in `src/`
- Blocks: Regression detection, confidence in refactoring, CI/CD validation
- Solution priority: High (critical for reducing bugs introduced by changes)

**No Rate Limiting or Retry Logic:**
- Problem: If Finnhub or Gemini APIs throttle, entire job fails without backoff
- Blocks: Resilience to API hiccups, graceful degradation
- Solution priority: High (reliability issue)

## Test Coverage Gaps

**No Unit Tests for Core Data Fetching:**
- What's not tested: `src/data/market.ts`, `src/data/news.ts`, `src/portfolio/data.ts` - all API integration points
- Files: `src/data/market.ts`, `src/data/news/finnh ub.ts`, `src/data/news/google-news.ts`, `src/data/news/analyzer.ts`
- Risk: Silent API failures, data mutation bugs, null propagation go undetected
- Priority: High - these are most likely to fail in production

**No Tests for Report Generation:**
- What's not tested: HTML generation, markdown parsing, index updates in `src/report/generator.ts` and `src/report/portfolio-generator.ts`
- Files: `src/report/generator.ts`, `src/report/portfolio-generator.ts`
- Risk: HTML injection, index corruption, malformed reports sent to users
- Priority: High - user-facing deliverable

**No Tests for Agent Orchestration:**
- What's not tested: Meeting flow, prompt construction, error handling in `src/meeting/runner.ts`, `src/portfolio/runner.ts`
- Files: `src/meeting/runner.ts`, `src/portfolio/runner.ts`
- Risk: Agent coordination bugs, cascading failures when one agent times out
- Priority: Medium - complex logic but less likely to fail

**No Integration Tests:**
- What's not tested: Full flow from data fetch to report save, with mock APIs
- Files: All files in sequence (`src/index.ts` orchestration)
- Risk: Configuration bugs, environment variable issues, file system permission errors discovered only at deploy time
- Priority: Medium - would catch integration issues early

---

*Concerns audit: 2026-04-08*

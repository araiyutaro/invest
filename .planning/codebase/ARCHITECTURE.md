# Architecture

**Analysis Date:** 2026-04-08

## Pattern Overview

**Overall:** Multi-agent system with sequential pipeline architecture

**Key Characteristics:**
- Independent specialized agents (6 profiles) providing domain-specific analysis
- Data collection layer feeding market and portfolio information
- Central meeting orchestrator coordinating agent interactions
- Report generation as final output layer
- Immutable data structures throughout (readonly types)
- LLM-based reasoning via Gemini API for all analysis

## Layers

**Data Collection Layer:**
- Purpose: Fetch and normalize real-time market data from external sources
- Location: `src/data/`
- Contains: Market indices, sector performance, news aggregation, chart generation
- Depends on: Yahoo Finance API, Finnhub API, Google News, RSS feeds, Gemini image generation
- Used by: Meeting orchestrator, portfolio analyzer

**Agent Layer:**
- Purpose: Provide specialized investment analysis from different perspectives
- Location: `src/agents/`
- Contains: 6 agent profiles (Fundamentals, TenBagger, Macro, Technical, Risk Manager, Moderator)
- Depends on: Gemini API for text generation, market context provided by orchestrator
- Used by: Meeting runner to collect analyses

**Meeting Orchestration Layer:**
- Purpose: Coordinate agent interactions, manage discussion rounds, synthesize final report
- Location: `src/meeting/runner.ts` and `src/portfolio/runner.ts`
- Contains: Agent execution sequencing, context building, multi-round discussion logic
- Depends on: Agent layer, Gemini API, data collection layer
- Used by: Main entry point

**Portfolio Analysis Layer:**
- Purpose: Provide portfolio-specific analysis parallel to market analysis
- Location: `src/portfolio/`
- Contains: Holdings registry, portfolio data fetching, portfolio-specific meetings
- Depends on: Yahoo Finance, data collection, agent layer
- Used by: Main entry point

**Report Generation Layer:**
- Purpose: Transform meeting outcomes into HTML reports with embedded charts
- Location: `src/report/`
- Contains: Markdown-to-HTML conversion, styling, chart embedding, file I/O
- Depends on: Meeting records, generated chart images
- Used by: Main entry point

**Gemini Integration Layer:**
- Purpose: Unified LLM interface for all text and image generation
- Location: `src/gemini.ts` and `src/data/charts.ts`
- Contains: Text generation wrapper, chat history management, image generation
- Depends on: Google Generative AI SDK, Google GenAI SDK (separate packages)
- Used by: Agent system, chart generator, news analyzer

## Data Flow

**Daily Report Generation Flow:**

1. **Data Collection Phase** (Parallel):
   - Fetch market indices (S&P 500, NASDAQ, Dow, Nikkei, TOPIX, VIX) via `fetchMarketIndices()`
   - Fetch sector ETF performance via `fetchSectorPerformance()`
   - Aggregate news from Finnhub (US market, mergers), Google News (Japan), RSS feeds via `fetchMarketNews()`
   - Generate market overview and sector performance charts via Gemini image model

2. **Meeting Phase** (Sequential rounds):
   - **Round 1 - Presentations**: Each agent (Fundamentals, TenBagger, Macro, Technical, Risk Manager) receives market context and generates independent analysis in parallel via `getAgentAnalysis()`
   - **Round 2 - Discussion**: Each agent comments on others' analyses in parallel via `getDiscussionComments()`
   - **Synthesis**: Moderator generates final summary from all presentations and discussion via `generateFinalSummary()`

3. **Report Generation Phase**:
   - Convert meeting minutes (markdown) to HTML with dark Bloomberg-style theme via `markdownToHtml()`
   - Embed generated sector and market overview chart images
   - Save HTML report and meeting minutes to `docs/YYYY-MM-DD/` directory

**Portfolio Analysis Flow:**

1. Parallel to daily report, fetch portfolio holdings data (7 stocks) via `fetchPortfolioData()`
2. Build portfolio context combining holdings, market data, and news
3. Run portfolio-specific agent meeting via `runPortfolioMeeting()`
4. Generate portfolio analysis report and save to `docs/YYYY-MM-DD/portfolio-report.html`

**State Management:**
- No persistent state between runs - all data is transient
- Immutable data structures enforced via `readonly` types throughout
- Market context passed as immutable snapshots to agents
- Error handling: Portfolio report failure doesn't block daily report (graceful degradation)

## Key Abstractions

**AgentProfile:**
- Purpose: Represents a specialized investment analyst with unique perspective
- Examples: `src/agents/fundamentals.ts`, `src/agents/tenbagger.ts`, `src/agents/macro.ts`
- Pattern: Immutable data structure with id, name, role, and system prompt for LLM

**MeetingRecord:**
- Purpose: Captures complete meeting output (date, context, discussion rounds, synthesis)
- Examples: Used in `src/meeting/runner.ts`, `src/report/generator.ts`
- Pattern: Immutable nested structure with readonly arrays of presentations and comments

**MarketNews:**
- Purpose: Categorized market information aggregated from multiple sources
- Examples: `src/data/news/types.ts`, produced by `fetchMarketNews()`
- Pattern: Five categories (usMarket, japanMarket, macro, sectors, earnings) as analyzed summaries

**StockData & MarketIndex:**
- Purpose: Normalized market data from Yahoo Finance, ready for agent consumption
- Examples: `src/data/market.ts`, `src/portfolio/data.ts`
- Pattern: Immutable snapshots with null-safe optional fields (peRatio | null)

## Entry Points

**Main Entry (`src/index.ts`):**
- Location: `src/index.ts`
- Triggers: Invoked by `npm start` or launchd scheduler (daily 8 AM)
- Responsibilities: 
  - Orchestrate 7-step process (data fetch → chart generation → meetings → report save)
  - Format market data summary for agent context
  - Handle portfolio report failure gracefully
  - Report progress and timing to console

**Meeting Runner Entry (`src/meeting/runner.ts`):**
- Location: `src/meeting/runner.ts`
- Triggers: Called from `src/index.ts` with market context
- Responsibilities:
  - Execute two-round meeting (presentations + discussion)
  - Build market context string combining indices, sectors, news by category
  - Parallel agent execution for presentations and discussion comments

**Portfolio Meeting Entry (`src/portfolio/runner.ts`):**
- Location: `src/portfolio/runner.ts`
- Triggers: Called from `src/index.ts` with portfolio context
- Responsibilities:
  - Portfolio-specific agent analysis of holdings
  - Agent discussion on portfolio positioning and changes
  - Moderator synthesis for portfolio recommendations

## Error Handling

**Strategy:** Graceful degradation - partial failures don't block full execution

**Patterns:**
- `fetchQuoteSafe()`: Wraps API calls in try-catch, returns null on failure, filtered from results
- Portfolio report wrapped in try-catch: Failure logs error and continues with daily report already saved
- Missing chart images: Filtered out but don't halt pipeline (chartImages.filter(c => c !== null))
- API response validation: Unsafe type casts with nullish coalescing (quote.field ?? 0)

## Cross-Cutting Concerns

**Logging:** 
- Console logging for progress tracking (Step 1/7 format)
- Error logging via console.error() on API failures and fatal errors
- No structured logging framework - simple console output

**Validation:**
- No input validation framework (no Zod usage despite being in dependencies)
- Type safety via TypeScript strict mode
- Runtime checks on Yahoo Finance responses (nullish coalescing)

**Authentication:**
- GEMINI_API_KEY via environment variable (required, throws on missing)
- No other authentication layers (Yahoo Finance and Finnhub are unauthenticated public APIs)
- No rate limiting or quota management

**Async Coordination:**
- Promise.all() for parallel operations (data fetch, agent analyses, chart generation)
- Sequential rounds enforced in meeting (presentations must complete before discussion)
- No concurrency control or queue system

---

*Architecture analysis: 2026-04-08*

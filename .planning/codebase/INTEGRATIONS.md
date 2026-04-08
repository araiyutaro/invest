# External Integrations

**Analysis Date:** 2026-04-08

## APIs & External Services

**AI/LLM:**
- Google Gemini API - Agent reasoning and analysis
  - SDK/Client: `@google/generative-ai` 0.24.1
  - Auth: Environment variable `GEMINI_API_KEY`
  - Used in: `src/gemini.ts`, `src/agents/` (all 6 agent implementations)
  - Models: `gemini-3.1-pro-preview` for text analysis
- Google Generative AI (Image) - Chart image generation
  - SDK/Client: `@google/genai` 1.44.0
  - Auth: Same `GEMINI_API_KEY`
  - Used in: `src/data/charts.ts`
  - Model: `gemini-2.5-flash-image` for chart visualization

**Market Data:**
- Yahoo Finance API - Real-time stock and index data
  - SDK/Client: `yahoo-finance2` 3.13.2
  - Auth: None required (public API)
  - Used in: `src/data/market.ts`, `src/portfolio/data.ts`
  - Data fetched:
    - Major indices: S&P 500, NASDAQ, Dow Jones, Nikkei 225, TOPIX, VIX
    - Sector ETFs: 11 XL* sector trackers (XLK, XLV, XLF, XLY, XLI, XLE, XLU, XLRE, XLB, XLC, XLP)
    - Stock quotes: Portfolio holdings (MRNA, JOBY, HII, POWL, CLS, FLNC, MOD)
    - Fields: Price, change, change percent, volume, market cap, P/E ratio, 52-week high/low

**News:**
- Finnhub API - US market news and merger/acquisition news
  - SDK/Client: Direct HTTP via `fetch()`
  - Auth: Environment variable `FINNHUB_API_KEY`
  - Location: `src/data/news/finnhub.ts`
  - Endpoint: `https://finnhub.io/api/v1/news`
  - Categories: "general", "merger"
  - Fallback: If API key missing, gracefully returns empty arrays
  - Filter: Only articles from past 24 hours

**News (RSS Feeds):**
- Google News - Japan market news
  - SDK/Client: Direct HTTP via `fetch()` + XML parsing with `fast-xml-parser`
  - Auth: None required
  - Location: `src/data/news/google-news.ts`
  - Feeds: 2 Google News RSS feeds searching for Nikkei, stock market, earnings
  - Parser: XMLParser with attribute normalization
  - Return limit: 20 articles, sorted by date

- Investing.com - Japan market RSS
  - Location: `src/data/news/rss-sources.ts`
  - Feeds: 3 RSS feeds (news general, overviews)
  - Return limit: 20 articles

- Yahoo! ニュース - Japan business and stock news
  - Location: `src/data/news/rss-sources.ts`
  - Feeds: 2 RSS feeds (business, stock market section)
  - Return limit: 15 articles

- 東洋経済オンライン - Japanese business publication
  - Location: `src/data/news/rss-sources.ts`
  - Feed: 1 RSS feed
  - Return limit: 10 articles

- 日経ビジネス - Nikkei Business publication
  - Location: `src/data/news/rss-sources.ts`
  - Feed: 1 RSS feed (RDF format)
  - Return limit: 10 articles

- NHK経済 - NHK economics/business news
  - Location: `src/data/news/rss-sources.ts`
  - Feed: 1 RSS feed
  - Return limit: 10 articles

## Data Storage

**Databases:**
- None - No database integration

**File Storage:**
- Local filesystem only
  - Reports output: `docs/YYYY-MM-DD/` directory
  - Files: HTML reports (`daily-report.html`, `meeting-minutes.html`, `portfolio-report.html`)
  - Files: PNG chart images (`sector-performance.png`, `market-overview.png`)

**Caching:**
- None - No explicit caching layer

## Authentication & Identity

**Auth Provider:**
- None - No user authentication system
- API authentication via environment variables:
  - `GEMINI_API_KEY` - Required for Google Gemini API calls
  - `FINNHUB_API_KEY` - Optional, gracefully skipped if missing

## Monitoring & Observability

**Error Tracking:**
- None detected - No error tracking service integrated

**Logs:**
- Console logging only
  - Uses `console.error()` and `console.log()`
  - Logged to stdout/stderr
  - Timestamps managed by launchd scheduler

## CI/CD & Deployment

**Hosting:**
- macOS localhost - Single machine execution
- Scheduler: launchd (macOS native scheduling)
- Config: `com.arai.invest-agent.plist`
- Frequency: Daily at 8 AM (Asia/Tokyo timezone)

**CI Pipeline:**
- None detected - No CI/CD service configured
- Manual execution: `npm start` or scheduled via launchd

## Environment Configuration

**Required env vars:**
- `GEMINI_API_KEY` - Google Gemini API key (required)

**Optional env vars:**
- `FINNHUB_API_KEY` - Finnhub API key (optional, gracefully skipped if missing)

**Secrets location:**
- `.env` file in project root
- Not committed to git (listed in `.gitignore`)
- Must be created locally per `package.json`

## Webhooks & Callbacks

**Incoming:**
- None - No webhook endpoints exposed

**Outgoing:**
- None - No webhooks to external services

## Data Flow

**Daily Meeting Pipeline:**

1. **Market Data Collection** (parallel):
   - `fetchMarketIndices()` → Yahoo Finance API for 6 major indices
   - `fetchSectorPerformance()` → Yahoo Finance API for 11 sector ETFs
   - Result: Price, change, change % for all instruments

2. **News Collection** (parallel):
   - `fetchAllFinnhubNews()` → Finnhub API (general + merger categories)
   - `fetchGoogleNewsJapan()` → Google News RSS feeds
   - `fetchAllRssNews()` → 5 Japanese financial news RSS sources
   - Processing: Deduplication by title, sorting by date, limiting by count

3. **News Analysis** (AI):
   - `generateAllAnalyses()` → Google Gemini API
   - Input: All collected news articles
   - Output: Structured analysis (usMarket, japanMarket, macro, sectors, earnings)

4. **Chart Generation** (parallel):
   - `generateSectorChart()` → Google Gemini API (gemini-2.5-flash-image)
   - `generateMarketOverviewChart()` → Google Gemini API (gemini-2.5-flash-image)
   - Prompts describe data with Bloomberg-style dark theme requirements
   - Output: PNG files saved to disk

5. **Agent Meeting** (sequential):
   - 5 analysts process market context:
     - Fundamentals Analyst
     - Ten-Bagger Hunter
     - Macro Economist
     - Technical Strategist
     - Risk Manager
   - Each calls `generateText()` → Google Gemini API
   - Moderator synthesizes via `generateChat()` (multi-turn conversation)

6. **Portfolio Analysis** (optional):
   - `fetchPortfolioData()` → Yahoo Finance API for 7 holdings
   - Portfolio agents analyze holdings performance
   - Synthesized into portfolio report

7. **Report Generation**:
   - HTML output saved to `docs/YYYY-MM-DD/`
   - Markdown → HTML conversion in `src/report/generator.ts`
   - Images embedded as file paths or base64

---

*Integration audit: 2026-04-08*

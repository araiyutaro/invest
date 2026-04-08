# Codebase Structure

**Analysis Date:** 2026-04-08

## Directory Layout

```
/Users/arai/invest/
├── src/                      # TypeScript source code
│   ├── index.ts             # Main entry point, orchestrates daily workflow
│   ├── gemini.ts            # Gemini API abstraction (text + image generation)
│   ├── agents/              # AI agent definitions (investment analysts)
│   │   ├── index.ts         # Agent exports and types
│   │   ├── types.ts         # Type definitions (AgentProfile, MeetingRecord)
│   │   ├── fundamentals.ts  # Fundamentals Analyst agent
│   │   ├── tenbagger.ts     # Ten-Bagger Hunter agent (growth stocks)
│   │   ├── macro.ts         # Macro Economist agent
│   │   ├── technical.ts     # Technical Strategist agent
│   │   ├── risk-manager.ts  # Risk Manager agent
│   │   └── moderator.ts     # Meeting Moderator agent
│   ├── data/                # Market data collection and processing
│   │   ├── market.ts        # Yahoo Finance market indices and sector ETFs
│   │   ├── news.ts          # News aggregation orchestrator
│   │   ├── charts.ts        # Gemini image generation for charts
│   │   └── news/            # News aggregation subsystem
│   │       ├── types.ts     # News type definitions
│   │       ├── analyzer.ts  # News analysis and categorization
│   │       ├── finnhub.ts   # Finnhub API integration
│   │       ├── google-news.ts # Google News Japan integration
│   │       └── rss-sources.ts # RSS feed aggregation
│   ├── meeting/             # Meeting orchestration
│   │   └── runner.ts        # Market analysis meeting coordinator
│   ├── portfolio/           # Portfolio analysis subsystem
│   │   ├── holdings.ts      # Hardcoded portfolio holdings registry
│   │   ├── data.ts          # Portfolio data fetching via Yahoo Finance
│   │   └── runner.ts        # Portfolio-specific meeting coordinator
│   └── report/              # Report generation and formatting
│       ├── generator.ts     # Daily and meeting minutes HTML generation
│       └── portfolio-generator.ts # Portfolio report HTML generation
├── docs/                    # Output directory for generated reports
│   └── YYYY-MM-DD/         # Date-organized report directories
│       ├── daily-report.html        # Daily market analysis report
│       ├── meeting-minutes.html     # Detailed meeting transcript
│       ├── portfolio-report.html    # Portfolio analysis report
│       ├── sector-performance.png   # Generated chart (Gemini)
│       └── market-overview.png      # Generated chart (Gemini)
├── scripts/                 # Utility scripts
│   └── run.sh              # Shell wrapper for npm start
├── .planning/              # Planning and analysis outputs
│   └── codebase/           # Codebase documentation
├── .claude/                # Claude integration config
├── .github/                # GitHub configuration
├── .vscode/                # VS Code settings
├── .idea/                  # IntelliJ IDEA settings
├── tsconfig.json           # TypeScript configuration
├── package.json            # Node.js dependencies and scripts
├── package-lock.json       # Dependency lock file
├── .env                    # Environment variables (GEMINI_API_KEY)
├── .gitignore              # Git ignore patterns
├── com.arai.invest-agent.plist # macOS launchd scheduler (daily 8 AM)
└── README.md               # Project documentation
```

## Directory Purposes

**src/:**
- Purpose: All TypeScript source code for the investment agent system
- Contains: Main entry, agents, data collection, meeting coordination, reporting
- Key files: `index.ts` (orchestrator), `agents/` (specialists), `data/` (market info), `report/` (output)

**src/agents/:**
- Purpose: Investment analyst agent definitions with specialized system prompts
- Contains: 6 immutable AgentProfile definitions with investment perspectives
- Key files: `fundamentals.ts`, `tenbagger.ts`, `macro.ts`, `technical.ts`, `risk-manager.ts`, `moderator.ts`

**src/data/:**
- Purpose: Market data collection from external APIs and news sources
- Contains: Yahoo Finance market data, Finnhub/Google News/RSS news aggregation, chart generation
- Key files: `market.ts` (indices/sectors), `news.ts` (orchestrator), `charts.ts` (image generation)

**src/data/news/:**
- Purpose: Specialized news aggregation and analysis
- Contains: Multiple news source integrations, analysis/categorization, type definitions
- Key files: `finnhub.ts` (US market), `google-news.ts` (Japan), `analyzer.ts` (Gemini analysis)

**src/meeting/:**
- Purpose: Daily market analysis meeting orchestration
- Contains: Two-round meeting logic (presentations → discussion), agent coordination
- Key files: `runner.ts` (main orchestrator)

**src/portfolio/:**
- Purpose: Portfolio-specific analysis separate from daily market reports
- Contains: Holdings registry, portfolio data collection, portfolio meeting logic
- Key files: `holdings.ts` (7-stock hardcoded list), `data.ts` (fetch portfolio quotes), `runner.ts` (meeting)

**src/report/:**
- Purpose: Convert meeting outcomes to HTML reports with embedded charts
- Contains: Markdown-to-HTML conversion, styling (dark Bloomberg theme), file I/O
- Key files: `generator.ts` (daily + minutes), `portfolio-generator.ts` (portfolio)

**docs/:**
- Purpose: Output directory for generated reports organized by date
- Contains: HTML reports and PNG charts, date-organized subdirectories (YYYY-MM-DD)
- Key files: `daily-report.html`, `meeting-minutes.html`, `portfolio-report.html`, `*.png` charts

## Key File Locations

**Entry Points:**
- `src/index.ts`: Main orchestrator - initiates 7-step daily workflow (data → meeting → report)
- `src/meeting/runner.ts`: Market analysis meeting - two-round agent discussion
- `src/portfolio/runner.ts`: Portfolio analysis meeting - holdings-specific analysis

**Configuration:**
- `tsconfig.json`: TypeScript compiler options (ES2022, strict mode, bundler resolution)
- `package.json`: Dependencies (Gemini APIs, Yahoo Finance, dotenv, Zod, tsx)
- `.env`: Environment configuration (GEMINI_API_KEY required)
- `com.arai.invest-agent.plist`: macOS launchd scheduler (daily 8 AM)

**Core Logic:**
- `src/agents/`: Agent definitions (6 specialized investment analysts)
- `src/data/market.ts`: Yahoo Finance integration (indices, sectors)
- `src/data/news/`: Multi-source news aggregation (Finnhub, Google, RSS)
- `src/gemini.ts`: Unified LLM interface for text and image generation

**Testing:**
- No test files present in repository (Vitest installed but unused)
- Run script: `npm test` (configured but no tests implemented)

## Naming Conventions

**Files:**
- Kebab-case for multi-word files: `risk-manager.ts`, `google-news.ts`, `portfolio-generator.ts`
- Single-word files in lowercase: `index.ts`, `market.ts`, `news.ts`, `charts.ts`
- Output files follow pattern: `{type}-{name}.{ext}` (daily-report.html, sector-performance.png)

**Directories:**
- Lowercase plural for feature domains: `agents/`, `data/`, `meeting/`, `portfolio/`, `report/`
- Nested feature structure: `data/news/` for news-specific functionality
- Date-organized outputs: `docs/YYYY-MM-DD/` format (ISO date with hyphens)

**Exports:**
- Barrel pattern in `agents/index.ts`: Exports all agents and types
- News subsystem aggregation: `src/data/news.ts` exports orchestrator, not individual sources
- Type re-exports: `src/agents/index.ts` re-exports types from `types.ts` for convenience

## Where to Add New Code

**New Agent (Analyst Specialist):**
- Create new file: `src/agents/{specialist-name}.ts`
- Define AgentProfile with id, name, role, and systemPrompt
- Export as named export: `export const {agentName}Agent: AgentProfile = { ... }`
- Add to `src/agents/index.ts` exports
- Add to `analysisAgents` array in `src/meeting/runner.ts` and `src/portfolio/runner.ts`
- Example: `src/agents/fundamentals.ts`

**New Data Source (Market/News):**
- For market data: Add function to `src/data/market.ts` following fetchQuoteSafe() pattern
- For news source: Create `src/data/news/{source-name}.ts` module
- Export aggregation function matching signature: `Promise<ReadonlyArray<NewsDigest>>`
- Update `src/data/news.ts` orchestrator to call new source in parallel Promise.all()
- Example: `src/data/news/finnhub.ts`

**New Report Type:**
- Create new file: `src/report/{report-name}-generator.ts`
- Follow pattern from `generator.ts`: Accept data, generate HTML, save to docs directory
- Use `markdownToHtml()` utility for consistent styling
- Embed charts by reading PNG files and base64 encoding
- Call from `src/index.ts` main orchestrator
- Example: `src/report/portfolio-generator.ts`

**Utility Functions:**
- Shared helpers: Add to appropriate `data/` or `report/` module
- Data conversion: Place in existing `data/*.ts` files or new `src/utils/` directory if needed
- Type definitions: Add to `src/agents/types.ts` or new `src/types/` directory
- Current pattern: No separate utils/ directory, utilities colocated with consumers

## Special Directories

**docs/:**
- Purpose: Generated report output directory
- Generated: Yes - created automatically by pipeline
- Committed: Yes - report history is tracked in git
- Structure: YYYY-MM-DD subdirectories, one per execution date

**.planning/codebase/:**
- Purpose: Codebase analysis and documentation
- Generated: No - manually maintained documentation
- Committed: Yes - planning documents tracked in git
- Contains: ARCHITECTURE.md, STRUCTURE.md, CONVENTIONS.md, etc.

**.env:**
- Purpose: Environment configuration (GEMINI_API_KEY required)
- Generated: No - manually configured
- Committed: No - listed in .gitignore for security
- Note: Must be set for application to run

**.idea/, .vscode/, .claude/:**
- Purpose: IDE and tool configurations
- Generated: No - maintained by tools and users
- Committed: Yes - development environment consistency
- Note: .vscode/ includes settings.json and launch configurations

---

*Structure analysis: 2026-04-08*

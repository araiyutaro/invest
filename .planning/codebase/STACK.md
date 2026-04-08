# Technology Stack

**Analysis Date:** 2026-04-08

## Languages

**Primary:**
- TypeScript 5.9.3 - All source code in `src/` directory
- JavaScript (ES2022) - Runtime module format

**Secondary:**
- Bash - Build and scheduling scripts in `scripts/` and launchd plist

## Runtime

**Environment:**
- Node.js 24.3.0 - JavaScript runtime

**Package Manager:**
- npm (included with Node.js)
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- No traditional web framework - Node.js pure implementation

**CLI/Execution:**
- tsx 4.21.0 - TypeScript executor for running `.ts` files directly via `tsx src/index.ts`

**Testing:**
- Vitest 4.0.18 - Unit and integration test runner
  - Config: Implicit (uses defaults, no explicit vitest config file)
  - Run: `npm run test`, `npm run test:watch`

**Build/Dev:**
- TypeScript 5.9.3 compiler
  - Config: `tsconfig.json` - ES2022 target, strict mode enabled
  - Output: `dist/` directory
  - Source root: `src/`

## Key Dependencies

**Critical - AI & Generation:**
- `@google/generative-ai` 0.24.1 - Google Gemini API client for text generation
  - Used in: `src/gemini.ts` for agent reasoning
  - Models: `gemini-3.1-pro-preview`
- `@google/genai` 1.44.0 - Google Generative AI client for image generation
  - Used in: `src/data/charts.ts` for chart visualization
  - Models: `gemini-2.5-flash-image`

**Critical - Financial Data:**
- `yahoo-finance2` 3.13.2 - Yahoo Finance API client
  - Used in: `src/data/market.ts`, `src/portfolio/data.ts`
  - Fetches: Market indices, sector ETF performance, stock quotes
  - Note: Must instantiate as `new YahooFinance()` not default import

**Data Processing:**
- `fast-xml-parser` 5.5.6 - XML parsing for RSS feeds
  - Used in: `src/data/news/google-news.ts`, `src/data/news/rss-sources.ts`
  - Purpose: Parse Google News and financial RSS feeds

**Validation:**
- `zod` 4.3.6 - TypeScript-first schema validation
  - Location: Used throughout for input validation

**Environment:**
- `dotenv` 17.3.1 - Environment variable loading
  - Used in: `src/index.ts` via `import "dotenv/config"`
  - Requires: `.env` file with `GEMINI_API_KEY` and `FINNHUB_API_KEY`

## Configuration

**Environment:**
- Loading: `dotenv` loads from `.env` file at runtime
- Key configs required:
  - `GEMINI_API_KEY` - Google Gemini API authentication token
  - `FINNHUB_API_KEY` - Finnhub API key (optional - falls back gracefully if missing)

**Build:**
- `tsconfig.json` - TypeScript compiler configuration
  - Target: ES2022 (modern JavaScript)
  - Module: ES2022 (ECMAScript modules)
  - Module resolution: bundler
  - Strict mode: enabled
  - Lib check: skipped for node_modules

**Scheduling:**
- `com.arai.invest-agent.plist` - macOS launchd configuration
  - Frequency: Daily at 8 AM (as noted in project memory)
  - Executes: `scripts/run.sh`

## Platform Requirements

**Development:**
- macOS system (launchd scheduling, uses `.plist` files)
- Node.js 24.3.0+
- npm for dependency management
- TypeScript knowledge for understanding source

**Production:**
- macOS system (scheduler via launchd)
- Node.js 24.3.0+ runtime
- Environment variables: `GEMINI_API_KEY` (required), `FINNHUB_API_KEY` (optional)
- Network access to:
  - Google Generative AI API
  - Yahoo Finance API
  - Finnhub API
  - Google News RSS feeds
  - Japanese financial news RSS sources

**Output:**
- Writes reports to `docs/YYYY-MM-DD/` directory as HTML files with embedded PNG chart images

---

*Stack analysis: 2026-04-08*

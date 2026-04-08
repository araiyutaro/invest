# Coding Conventions

**Analysis Date:** 2026-04-08

## Naming Patterns

**Files:**
- kebab-case for file names: `fundamentals.ts`, `risk-manager.ts`, `market-overview.ts`
- Index files use `index.ts` for barrel exports
- Utility files named by function: `analyzer.ts`, `generator.ts`, `runner.ts`

**Functions:**
- camelCase for function names: `fetchMarketIndices()`, `generateChartImage()`, `formatMarketDataSummary()`
- Prefix helper functions with their purpose: `fetchQuoteSafe()`, `buildMarketContext()`, `formatArticlesForPrompt()`
- Async functions clearly return Promise types

**Variables:**
- camelCase for constants and variables: `yahooFinance`, `REPORTS_DIR`, `analysisAgents`
- ALL_CAPS_WITH_UNDERSCORES for constants: `MAJOR_INDICES`, `SECTOR_ETFS`, `PORTFOLIO_HOLDINGS`, `SYSTEM_PROMPT`
- Const arrays use `ReadonlyArray` type annotation consistently

**Types:**
- PascalCase for interfaces and types: `AgentProfile`, `MarketNews`, `MeetingRecord`, `StockQuote`
- Interface properties use `readonly` keyword: `readonly id: string`, `readonly marketCap: number | null`
- Union types for optional values use `| null` rather than `| undefined`

## Code Style

**Formatting:**
- No explicit linter/formatter config detected in repo
- Consistent 2-space indentation used throughout
- Lines typically 80-100 characters, no hard limit enforced
- One blank line between logical sections

**Imports:**
- Node.js native imports first: `import { mkdir } from "node:fs/promises"`
- Third-party imports second: `import YahooFinance from "yahoo-finance2"`
- Local imports last, using `.js` extensions in ES modules: `import { fundamentalsAgent } from "./fundamentals.js"`
- Type imports separated: `import type { MarketNews } from "../data/news.js"`

## Error Handling

**Patterns:**
- Errors thrown during initialization: `if (!apiKey) { throw new Error("...") }`
- Try/catch for external API calls with console.error logging
- Null return pattern for graceful degradation: `Promise<string | null>` returns null on error
- Promise.all().filter() pattern to remove null results and maintain type safety

Example from `src/data/market.ts`:
```typescript
async function fetchQuoteSafe(symbol: string): Promise<Record<string, unknown> | null> {
  try {
    const result = await yahooFinance.quote(symbol);
    return result as unknown as Record<string, unknown>;
  } catch (error) {
    console.error(`Failed to fetch quote for ${symbol}:`, error);
    return null;
  }
}

// Caller filters nulls using type guard
return results.filter((r): r is MarketIndex => r !== null);
```

**Async Error Handling:**
- Fatal errors in main: `main().catch((error) => { console.error("Fatal error:", error); process.exit(1); })`
- Non-fatal errors in sub-processes: logged but execution continues (e.g., portfolio report generation in `src/index.ts` line 114-117)

## Logging

**Framework:** console methods (console.log, console.error)

**Patterns:**
- Progress indicators in main flow: `console.log("Step 1/7: 市場データを取得中...")`
- Arrow indicators for progress: `console.log("  -> 市場データ取得完了")`
- Error logging with context: `console.error(\`Failed to fetch quote for ${symbol}:\`, error)`
- Silent failures for non-critical operations (e.g., chart generation returning null vs throwing)

No centralized logger - direct console usage throughout.

## Comments

**When to Comment:**
- System prompts are documented as long strings with section headers
- Complex prompt construction documented inline
- API integration notes (e.g., "suppressNotices" for yahoo-finance2 in `src/data/market.ts`)
- Section comments use markdown headers in strings: `## 本日の市場データ`

**JSDoc/TSDoc:**
- Not used in this codebase
- Function purposes inferred from names and usage

## Function Design

**Size:** 20-60 lines typical, longest function is `markdownToHtml()` at 53 lines

**Parameters:** 
- Single object parameter with readonly properties preferred for complex data
- Use `ReadonlyArray<T>` for collection parameters
- Avoid mutable inputs - arrays spread/copied when needed

Example from `src/index.ts`:
```typescript
function formatMarketDataSummary(
  indices: ReadonlyArray<MarketIndex>,
  sectors: ReadonlyArray<SectorPerformance>,
): string {
  // ... uses [...sectors].sort() to create new array, never mutates input
}
```

**Return Values:**
- Promise<T | null> for operations that may fail gracefully
- Promise<T> with error throwing for critical paths
- Const/readonly return types: `return { indices, sectors } as const;`

## Immutability

**Critical Pattern - Always Used:**
- Spreads and copies arrays/objects: `[...sectors].sort()`, `{ ...user, name }`
- Readonly properties on all interfaces
- ReadonlyArray<T> type annotations prevent accidental mutation

Never mutates function parameters or external state.

## Module Design

**Exports:**
- Barrel files re-export typed APIs: `src/agents/index.ts` exports both values and types
- Types exported separately with `export type { ... }`
- Value exports named: `export const PORTFOLIO_HOLDINGS = [...]`

Example from `src/agents/index.ts`:
```typescript
export { fundamentalsAgent } from "./fundamentals.js";
export type {
  AgentProfile,
  AgentAnalysis,
  MeetingRecord,
} from "./types.js";
```

**File Organization:**
- Types in dedicated files: `types.ts` for shared interfaces
- Data files handle fetching and transformation
- Generator files handle output (HTML, reports)
- Runner files orchestrate workflows

## Specific Patterns

**Readonly Records for Constants:**
```typescript
const MAJOR_INDICES = [
  { name: "S&P 500", symbol: "^GSPC" },
  { ... }
] as const;
```

**Filter with Type Guard:**
```typescript
return results.filter((r): r is MarketIndex => r !== null);
```

**Safe External API Calls:**
```typescript
async function fetchQuoteSafe(symbol: string): Promise<...> {
  try {
    const result = await yahooFinance.quote(symbol);
    return /* transformation */;
  } catch (error) {
    console.error(`Failed to fetch...`, error);
    return null;
  }
}
```

**Promise.all for Parallel Operations:**
```typescript
const [result1, result2, result3] = await Promise.all([
  operation1(),
  operation2(),
  operation3(),
]);
```

---

*Convention analysis: 2026-04-08*

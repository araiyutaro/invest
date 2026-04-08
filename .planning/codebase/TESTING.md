# Testing Patterns

**Analysis Date:** 2026-04-08

## Test Framework

**Runner:**
- Vitest 4.0.18
- Config: Not present - uses Vitest defaults
- No custom configuration file detected

**Assertion Library:**
- Not detected - Vitest's built-in assertions would be used

**Run Commands:**
```bash
npm test                # Run all tests (vitest run)
npm run test:watch     # Watch mode
```

## Test File Organization

**Current Status:**
- No test files exist in `src/`
- No unit tests, integration tests, or E2E tests present
- Only devDependency is Vitest (no other testing utilities)

**Recommended Location Pattern:**
- Co-locate tests with implementation: `src/agents/fundamentals.test.ts` next to `src/agents/fundamentals.ts`
- Or use `src/__tests__/` directory for integration tests
- End-to-end test files in `e2e/` or similar

**Recommended Naming:**
- Unit tests: `*.test.ts` or `*.spec.ts` 
- Integration tests: `*.integration.test.ts`
- E2E tests: `*.e2e.test.ts` or in `e2e/` directory

## Priority Testing Areas

Based on codebase analysis, these areas should be tested first:

**Critical Path (High Priority):**
- `src/gemini.ts` - External API wrapper
  - Test token validation: error when GEMINI_API_KEY missing
  - Mock generateText() and generateChat() responses
  
- `src/data/market.ts` - Market data fetching
  - Test fetchQuoteSafe() error handling with network failures
  - Test filter pattern removes null entries correctly
  - Test readonly array contracts

- `src/meeting/runner.ts` - Core business logic
  - Test buildMarketContext() formats strings correctly
  - Test getAgentAnalysis() and getDiscussionComments() call order
  - Test Promise.all parallelization works
  - Mock generateText() to control outputs

**Secondary (Medium Priority):**
- `src/data/news/analyzer.ts` - News analysis coordination
  - Test buildAnalysisConfigs() creates correct prompts
  - Test generateAllAnalyses() transforms Promise results to MarketNews
  - Test error recovery in Promise.all map
  
- `src/report/generator.ts` - HTML generation
  - Test escapeHtml() prevents XSS
  - Test markdownToHtml() regex transformations
  - Test saveReports() creates files with correct paths
  - Test updateIndex() doesn't duplicate entries

- `src/portfolio/data.ts` - Portfolio data fetching
  - Test fetchStockSafe() error handling
  - Test formatPortfolioSummary() table generation

**Tertiary (Low Priority):**
- Agent profile definitions (`src/agents/*.ts`)
  - Just verify exports exist
  
- Type definitions
  - Use TypeScript compiler for validation

## Test Structure Pattern

For this codebase, recommended test structure:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

describe('MarketDataFetcher', () => {
  beforeEach(() => {
    // Setup mocks, clear state
  })

  afterEach(() => {
    // Cleanup
  })

  it('should fetch market indices successfully', async () => {
    // Arrange: setup test data
    const mockIndices = [{ name: 'S&P 500', symbol: '^GSPC', ... }]
    
    // Act: call function
    const result = await fetchMarketIndices()
    
    // Assert: verify result
    expect(result).toEqual(mockIndices)
  })

  it('should handle network errors gracefully', async () => {
    // Mock network failure
    vi.mock('yahoo-finance2', () => ({
      quote: vi.fn().mockRejectedValue(new Error('Network'))
    }))
    
    const result = await fetchQuoteSafe('INVALID')
    expect(result).toBeNull()
  })
})
```

## Mocking Strategy

**Framework:** Vitest's `vi` module (native)

**What to Mock:**
- External API calls: `yahoo-finance2.quote()`, `GoogleGenerativeAI.generateContent()`
- File I/O: `fs/promises` read/write operations
- Time-based operations: `Date.now()`, `setTimeout()`
- Environment variables (setup in test)

**What NOT to Mock:**
- Type transformations and calculations
- String formatting (escapeHtml, markdownToHtml)
- Data structure operations (filter, map, reduce)
- Pure helper functions

**Mocking Pattern for Gemini API:**

```typescript
import { vi } from 'vitest'
import { generateText } from './gemini'

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn(() => ({
    getGenerativeModel: vi.fn(() => ({
      generateContent: vi.fn().mockResolvedValue({
        response: { text: vi.fn().mockReturnValue('Mock analysis text') }
      })
    }))
  }))
}))
```

**Mocking Pattern for File I/O:**

```typescript
import { writeFile, mkdir } from 'node:fs/promises'

vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn(),
  writeFile: vi.fn(),
  readFile: vi.fn()
}))
```

## Fixtures and Test Data

**Recommended Location:**
- `src/__fixtures__/` or `src/__test__/fixtures/`
- Factory functions in `src/__test__/factories/`

**Factory Pattern Example:**

```typescript
// src/__test__/factories/market-data.ts
export function createMockMarketIndex(): MarketIndex {
  return {
    name: 'S&P 500',
    symbol: '^GSPC',
    price: 5000,
    change: 50,
    changePercent: 1.0
  }
}

export function createMockMarketIndices(count = 5): ReadonlyArray<MarketIndex> {
  return Array.from({ length: count }, (_, i) => ({
    ...createMockMarketIndex(),
    name: `Index ${i}`
  }))
}
```

## Coverage

**Requirements:** None currently enforced

**Recommended Target:** 80%+ for critical paths
- Core business logic: 90%+
- API wrappers: 85%+
- Data transformations: 80%+
- HTML generation: 70%+

**View Coverage:**
```bash
# Configure vitest.config.ts with coverage
npm test -- --coverage
```

**Recommended Config:**
```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/__test__/',
        '**/*.test.ts'
      ],
      lines: 80,
      functions: 80,
      branches: 75,
      statements: 80
    }
  }
})
```

## Test Types

**Unit Tests:**
- Scope: Single function or module
- Approach: Test pure functions with various inputs, mock dependencies
- Examples:
  - `escapeHtml()` with special characters
  - `buildMarketContext()` with different data shapes
  - `formatArticlesForPrompt()` with empty/full articles array

**Integration Tests:**
- Scope: Multiple modules working together
- Approach: Integration of real modules with mocked external APIs
- Examples:
  - `runMeeting()` with mocked Gemini API and market data
  - `fetchMarketNews()` with mocked API sources
  - `saveReports()` with mocked file system

**E2E Tests:**
- Current Status: Not implemented
- Recommended: Use Playwright for critical user flows
  - Daily report generation end-to-end
  - Portfolio analysis meeting workflow
  - Report file output verification

## Async Testing

**Pattern:**
```typescript
import { describe, it, expect } from 'vitest'

describe('Async Operations', () => {
  it('should fetch data asynchronously', async () => {
    const result = await fetchMarketIndices()
    expect(result).toBeDefined()
    expect(result.length).toBeGreaterThan(0)
  })

  it('should handle async errors', async () => {
    await expect(
      fetchMarketIndices() // or use vi.mock to inject error
    ).rejects.toThrow()
  })

  it('should handle Promise.all correctly', async () => {
    const [data1, data2] = await Promise.all([
      fetchMarketIndices(),
      fetchSectorPerformance()
    ])
    expect(data1).toBeDefined()
    expect(data2).toBeDefined()
  })
})
```

## Error Handling Testing

**Pattern:**
```typescript
describe('Error Handling', () => {
  it('should return null on API failure', async () => {
    vi.mock('yahoo-finance2', () => ({
      quote: vi.fn().mockRejectedValue(new Error('API Error'))
    }))
    
    const result = await fetchQuoteSafe('INVALID')
    expect(result).toBeNull()
  })

  it('should log errors to console', async () => {
    const errorSpy = vi.spyOn(console, 'error')
    
    // trigger error condition
    
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to fetch'),
      expect.any(Error)
    )
  })

  it('should exit process on fatal error', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {})
    
    // trigger main() error
    
    expect(exitSpy).toHaveBeenCalledWith(1)
  })
})
```

## Test Execution Strategy

**Phase 1 - Foundation (Week 1):**
- Write tests for `src/gemini.ts` (API wrapper validation)
- Write tests for `src/data/market.ts` (error handling, type guards)
- Set up mocking infrastructure for Gemini and yahoo-finance2

**Phase 2 - Business Logic (Week 2):**
- Write tests for `src/meeting/runner.ts` (orchestration)
- Write tests for `src/data/news/analyzer.ts` (prompt building)
- Write tests for `src/report/generator.ts` (HTML generation)

**Phase 3 - Integration (Week 3):**
- Write integration tests for `runMeeting()`
- Write integration tests for `saveReports()`
- Add E2E tests with Playwright if needed

**Phase 4 - Polish (Week 4):**
- Reach 80%+ coverage on critical paths
- Document test patterns in this file
- Add performance benchmarks if needed

---

*Testing analysis: 2026-04-08*

import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

export interface MarketIndex {
  readonly name: string;
  readonly symbol: string;
  readonly price: number;
  readonly change: number;
  readonly changePercent: number;
}

export interface StockQuote {
  readonly symbol: string;
  readonly name: string;
  readonly price: number;
  readonly change: number;
  readonly changePercent: number;
  readonly volume: number;
  readonly marketCap: number;
  readonly peRatio: number | null;
  readonly fiftyTwoWeekHigh: number;
  readonly fiftyTwoWeekLow: number;
}

export interface SectorPerformance {
  readonly sector: string;
  readonly symbol: string;
  readonly changePercent: number;
}

const MAJOR_INDICES = [
  { name: "S&P 500", symbol: "^GSPC" },
  { name: "NASDAQ", symbol: "^IXIC" },
  { name: "Dow Jones", symbol: "^DJI" },
  { name: "Nikkei 225", symbol: "^N225" },
  { name: "TOPIX", symbol: "^TOPX" },
  { name: "VIX", symbol: "^VIX" },
] as const;

const SECTOR_ETFS = [
  { sector: "Technology", symbol: "XLK" },
  { sector: "Healthcare", symbol: "XLV" },
  { sector: "Financials", symbol: "XLF" },
  { sector: "Consumer Discretionary", symbol: "XLY" },
  { sector: "Industrials", symbol: "XLI" },
  { sector: "Energy", symbol: "XLE" },
  { sector: "Utilities", symbol: "XLU" },
  { sector: "Real Estate", symbol: "XLRE" },
  { sector: "Materials", symbol: "XLB" },
  { sector: "Communication Services", symbol: "XLC" },
  { sector: "Consumer Staples", symbol: "XLP" },
] as const;

async function fetchQuoteSafe(
  symbol: string,
): Promise<Record<string, unknown> | null> {
  try {
    const result = await yahooFinance.quote(symbol);
    return result as unknown as Record<string, unknown>;
  } catch (error) {
    console.error(`Failed to fetch quote for ${symbol}:`, error);
    return null;
  }
}

export async function fetchMarketIndices(): Promise<ReadonlyArray<MarketIndex>> {
  const results = await Promise.all(
    MAJOR_INDICES.map(async ({ name, symbol }) => {
      const quote = await fetchQuoteSafe(symbol);
      if (!quote) return null;
      return {
        name: name as string,
        symbol: symbol as string,
        price: (quote.regularMarketPrice as number) ?? 0,
        change: (quote.regularMarketChange as number) ?? 0,
        changePercent: (quote.regularMarketChangePercent as number) ?? 0,
      };
    }),
  );
  return results.filter((r): r is MarketIndex => r !== null);
}

export async function fetchSectorPerformance(): Promise<
  ReadonlyArray<SectorPerformance>
> {
  const results = await Promise.all(
    SECTOR_ETFS.map(async ({ sector, symbol }) => {
      const quote = await fetchQuoteSafe(symbol);
      if (!quote) return null;
      return {
        sector: sector as string,
        symbol: symbol as string,
        changePercent: (quote.regularMarketChangePercent as number) ?? 0,
      };
    }),
  );
  return results.filter((r): r is SectorPerformance => r !== null);
}

export async function fetchStockQuotes(
  symbols: ReadonlyArray<string>,
): Promise<ReadonlyArray<StockQuote>> {
  const results = await Promise.all(
    symbols.map(async (symbol) => {
      const quote = await fetchQuoteSafe(symbol);
      if (!quote) return null;
      return {
        symbol,
        name: (quote.shortName as string) ?? symbol,
        price: (quote.regularMarketPrice as number) ?? 0,
        change: (quote.regularMarketChange as number) ?? 0,
        changePercent: (quote.regularMarketChangePercent as number) ?? 0,
        volume: (quote.regularMarketVolume as number) ?? 0,
        marketCap: (quote.marketCap as number) ?? 0,
        peRatio: (quote.trailingPE as number | undefined) ?? null,
        fiftyTwoWeekHigh: (quote.fiftyTwoWeekHigh as number) ?? 0,
        fiftyTwoWeekLow: (quote.fiftyTwoWeekLow as number) ?? 0,
      };
    }),
  );
  return results.filter((r): r is StockQuote => r !== null);
}

export async function fetchAllMarketData() {
  const [indices, sectors] = await Promise.all([
    fetchMarketIndices(),
    fetchSectorPerformance(),
  ]);

  return { indices, sectors } as const;
}

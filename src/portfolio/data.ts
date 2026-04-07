import YahooFinance from "yahoo-finance2";
import type { PortfolioHolding } from "./holdings.js";

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

export interface StockData {
  readonly symbol: string;
  readonly name: string;
  readonly nameJa: string;
  readonly sector: string;
  readonly price: number;
  readonly change: number;
  readonly changePercent: number;
  readonly marketCap: number | null;
  readonly peRatio: number | null;
  readonly volume: number | null;
  readonly fiftyTwoWeekHigh: number | null;
  readonly fiftyTwoWeekLow: number | null;
  readonly averageVolume: number | null;
}

async function fetchStockSafe(
  holding: PortfolioHolding,
): Promise<StockData | null> {
  try {
    const quote = await yahooFinance.quote(holding.symbol);

    return {
      symbol: holding.symbol,
      name: holding.name,
      nameJa: holding.nameJa,
      sector: holding.sector,
      price: quote.regularMarketPrice ?? 0,
      change: quote.regularMarketChange ?? 0,
      changePercent: quote.regularMarketChangePercent ?? 0,
      marketCap: (quote.marketCap as number | undefined) ?? null,
      peRatio: (quote.trailingPE as number | undefined) ?? null,
      volume: (quote.regularMarketVolume as number | undefined) ?? null,
      fiftyTwoWeekHigh: (quote.fiftyTwoWeekHigh as number | undefined) ?? null,
      fiftyTwoWeekLow: (quote.fiftyTwoWeekLow as number | undefined) ?? null,
      averageVolume: (quote.averageDailyVolume3Month as number | undefined) ?? null,
    };
  } catch (error) {
    console.error(`Failed to fetch data for ${holding.symbol}:`, error);
    return null;
  }
}

export async function fetchPortfolioData(
  holdings: ReadonlyArray<PortfolioHolding>,
): Promise<ReadonlyArray<StockData>> {
  const results = await Promise.all(holdings.map(fetchStockSafe));
  return results.filter((r): r is StockData => r !== null);
}

export function formatPortfolioSummary(
  stocks: ReadonlyArray<StockData>,
): string {
  const lines: string[] = ["### 保有銘柄サマリー", ""];
  lines.push("| 銘柄 | ティッカー | 価格 | 前日比 | 変動率 | PER | 時価総額 |");
  lines.push("|------|-----------|------|--------|--------|-----|---------|");

  for (const s of stocks) {
    const sign = s.change >= 0 ? "+" : "";
    const mcap = s.marketCap
      ? `$${(s.marketCap / 1e9).toFixed(1)}B`
      : "N/A";
    const pe = s.peRatio ? s.peRatio.toFixed(1) : "N/A";

    lines.push(
      `| ${s.nameJa} | ${s.symbol} | $${s.price.toFixed(2)} | ${sign}${s.change.toFixed(2)} | ${sign}${s.changePercent.toFixed(2)}% | ${pe} | ${mcap} |`,
    );
  }

  return lines.join("\n");
}

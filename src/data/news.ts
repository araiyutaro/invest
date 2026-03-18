export type { NewsDigest, MarketNews } from "./news/types.js";

import { fetchAllFinnhubNews } from "./news/finnhub.js";
import { fetchGoogleNewsJapan } from "./news/google-news.js";
import { generateAllAnalyses } from "./news/analyzer.js";
import type { MarketNews } from "./news/types.js";

export async function fetchMarketNews(): Promise<MarketNews> {
  console.log("  -> ニュースソース取得中 (Finnhub + Google News)...");

  const [finnhubNews, japanNews] = await Promise.all([
    fetchAllFinnhubNews(),
    fetchGoogleNewsJapan(),
  ]);

  const finnhubCount = finnhubNews.general.length + finnhubNews.merger.length;
  console.log(
    `  -> Finnhub: ${finnhubCount}件, Google News: ${japanNews.length}件 取得完了`,
  );

  console.log("  -> ニュース分析中 (Gemini API)...");
  const analysis = await generateAllAnalyses(finnhubNews, japanNews);

  return analysis;
}

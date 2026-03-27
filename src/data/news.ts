export type { NewsDigest, MarketNews } from "./news/types.js";

import { fetchAllFinnhubNews } from "./news/finnhub.js";
import { fetchGoogleNewsJapan } from "./news/google-news.js";
import { fetchAllRssNews } from "./news/rss-sources.js";
import { generateAllAnalyses } from "./news/analyzer.js";
import type { MarketNews } from "./news/types.js";

export async function fetchMarketNews(): Promise<MarketNews> {
  console.log(
    "  -> ニュースソース取得中 (Finnhub + Google News + RSS sources)...",
  );

  const [finnhubNews, googleNews, rssNews] = await Promise.all([
    fetchAllFinnhubNews(),
    fetchGoogleNewsJapan(),
    fetchAllRssNews(),
  ]);

  const finnhubCount = finnhubNews.general.length + finnhubNews.merger.length;
  const japanNews = [...googleNews, ...rssNews];
  console.log(
    `  -> Finnhub: ${finnhubCount}件, Google News: ${googleNews.length}件, RSS: ${rssNews.length}件 取得完了`,
  );

  console.log("  -> ニュース分析中 (Gemini API)...");
  const analysis = await generateAllAnalyses(finnhubNews, japanNews);

  return analysis;
}

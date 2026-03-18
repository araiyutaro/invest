import type { RawNewsArticle } from "./types.js";

interface FinnhubNewsItem {
  readonly category: string;
  readonly datetime: number;
  readonly headline: string;
  readonly id: number;
  readonly image: string;
  readonly related: string;
  readonly source: string;
  readonly summary: string;
  readonly url: string;
}

function toRawArticle(item: FinnhubNewsItem): RawNewsArticle {
  return {
    title: item.headline,
    summary: item.summary,
    source: item.source,
    url: item.url,
    publishedAt: new Date(item.datetime * 1000),
    category: item.category,
  };
}

async function fetchNewsByCategory(
  apiKey: string,
  category: string,
): Promise<ReadonlyArray<RawNewsArticle>> {
  const url = `https://finnhub.io/api/v1/news?category=${category}&token=${apiKey}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Finnhub API error: ${response.status} ${response.statusText}`);
  }

  const items: ReadonlyArray<FinnhubNewsItem> = await response.json();

  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  return items
    .filter((item) => item.datetime * 1000 > oneDayAgo)
    .map(toRawArticle);
}

export interface FinnhubNews {
  readonly general: ReadonlyArray<RawNewsArticle>;
  readonly merger: ReadonlyArray<RawNewsArticle>;
}

export async function fetchAllFinnhubNews(): Promise<FinnhubNews> {
  const apiKey = process.env.FINNHUB_API_KEY;

  if (!apiKey) {
    console.error("FINNHUB_API_KEY is not set. Skipping Finnhub news fetch.");
    return { general: [], merger: [] };
  }

  const [general, merger] = await Promise.all([
    fetchNewsByCategory(apiKey, "general").catch((error) => {
      console.error("Failed to fetch Finnhub general news:", error);
      return [] as ReadonlyArray<RawNewsArticle>;
    }),
    fetchNewsByCategory(apiKey, "merger").catch((error) => {
      console.error("Failed to fetch Finnhub merger news:", error);
      return [] as ReadonlyArray<RawNewsArticle>;
    }),
  ]);

  return { general, merger };
}

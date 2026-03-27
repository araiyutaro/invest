import { XMLParser } from "fast-xml-parser";
import type { RawNewsArticle } from "./types.js";

interface RssItem {
  readonly title: string;
  readonly link: string;
  readonly pubDate?: string;
  readonly description?: string;
  readonly source?: string | { readonly "#text": string };
}

interface RssSource {
  readonly name: string;
  readonly urls: ReadonlyArray<string>;
  readonly category: string;
  readonly maxArticles: number;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function stripHtmlTags(text: string): string {
  return text.replace(/<[^>]*>/g, "").trim();
}

function extractSource(item: RssItem, fallback: string): string {
  if (typeof item.source === "string") return item.source;
  if (item.source && typeof item.source === "object" && "#text" in item.source) {
    return item.source["#text"];
  }
  return fallback;
}

function toRawArticle(
  item: RssItem,
  sourceName: string,
  category: string,
): RawNewsArticle {
  const rawSummary = item.description || "";
  const summary = stripHtmlTags(decodeHtmlEntities(rawSummary));

  return {
    title: decodeHtmlEntities(stripHtmlTags(item.title || "")),
    summary,
    source: extractSource(item, sourceName),
    url: typeof item.link === "string" ? item.link : "",
    publishedAt: new Date(item.pubDate || Date.now()),
    category,
  };
}

async function fetchRssFeed(
  url: string,
  sourceName: string,
  category: string,
): Promise<ReadonlyArray<RawNewsArticle>> {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text",
  });

  const response = await fetch(url, {
    headers: { "User-Agent": "InvestAgent/1.0" },
  });

  if (!response.ok) {
    throw new Error(`${sourceName} RSS error: ${response.status}`);
  }

  const xml = await response.text();
  const parsed = parser.parse(xml);

  const channel = parsed?.rss?.channel ?? parsed?.["rdf:RDF"] ?? {};
  const items = channel?.item ?? [];
  const itemArray: ReadonlyArray<RssItem> = Array.isArray(items)
    ? items
    : [items];

  return itemArray.map((item) => toRawArticle(item, sourceName, category));
}

async function fetchSource(
  source: RssSource,
): Promise<ReadonlyArray<RawNewsArticle>> {
  const results = await Promise.all(
    source.urls.map((url) =>
      fetchRssFeed(url, source.name, source.category).catch((error) => {
        console.error(`  -> ${source.name} RSS取得失敗 (${url}):`, error);
        return [] as ReadonlyArray<RawNewsArticle>;
      }),
    ),
  );

  const allArticles = results.flat();
  const sorted = [...allArticles].sort(
    (a, b) => b.publishedAt.getTime() - a.publishedAt.getTime(),
  );

  return sorted.slice(0, source.maxArticles);
}

const RSS_SOURCES: ReadonlyArray<RssSource> = [
  {
    name: "Investing.com",
    urls: [
      "https://jp.investing.com/rss/news_25.rss",
      "https://jp.investing.com/rss/news_1.rss",
      "https://jp.investing.com/rss/market_overview.rss",
    ],
    category: "japan_market",
    maxArticles: 20,
  },
  {
    name: "Yahoo!ニュース",
    urls: [
      "https://news.yahoo.co.jp/rss/categories/business.xml",
      "https://news.yahoo.co.jp/rss/media/shikihoz/all.xml",
    ],
    category: "japan_market",
    maxArticles: 15,
  },
  {
    name: "東洋経済オンライン",
    urls: ["https://toyokeizai.net/list/feed/rss"],
    category: "japan_market",
    maxArticles: 10,
  },
  {
    name: "日経ビジネス",
    urls: ["https://business.nikkei.com/rss/sns/nb.rdf"],
    category: "japan_market",
    maxArticles: 10,
  },
  {
    name: "NHK経済",
    urls: ["https://www.nhk.or.jp/rss/news/cat5.xml"],
    category: "japan_market",
    maxArticles: 10,
  },
];

export async function fetchAllRssNews(): Promise<ReadonlyArray<RawNewsArticle>> {
  const results = await Promise.all(RSS_SOURCES.map(fetchSource));

  const allArticles = results.flat();

  const seen = new Set<string>();
  const deduplicated = allArticles.filter((article) => {
    const key = article.title.slice(0, 50);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return deduplicated.sort(
    (a, b) => b.publishedAt.getTime() - a.publishedAt.getTime(),
  );
}

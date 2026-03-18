import { XMLParser } from "fast-xml-parser";
import type { RawNewsArticle } from "./types.js";

interface RssItem {
  readonly title: string;
  readonly link: string;
  readonly pubDate: string;
  readonly description?: string;
  readonly source?: string | { readonly "#text": string };
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

function extractSource(item: RssItem): string {
  if (typeof item.source === "string") return item.source;
  if (item.source && typeof item.source === "object" && "#text" in item.source) {
    return item.source["#text"];
  }
  return "Google News";
}

function toRawArticle(item: RssItem): RawNewsArticle {
  return {
    title: decodeHtmlEntities(item.title || ""),
    summary: decodeHtmlEntities(item.description || ""),
    source: extractSource(item),
    url: item.link || "",
    publishedAt: new Date(item.pubDate || Date.now()),
    category: "japan_market",
  };
}

const GOOGLE_NEWS_URLS = [
  "https://news.google.com/rss/search?q=%E6%97%A5%E7%B5%8C%E5%B9%B3%E5%9D%87+OR+%E6%A0%AA%E5%BC%8F%E5%B8%82%E5%A0%B4+OR+TOPIX&hl=ja&gl=JP&ceid=JP:ja",
  "https://news.google.com/rss/search?q=%E6%B1%BA%E7%AE%97+%E6%A0%AA%E4%BE%A1+OR+%E6%A5%AD%E7%B8%BE&hl=ja&gl=JP&ceid=JP:ja",
] as const;

const MAX_ARTICLES = 20;

export async function fetchGoogleNewsJapan(): Promise<ReadonlyArray<RawNewsArticle>> {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text",
  });

  const allArticles: RawNewsArticle[] = [];

  const results = await Promise.all(
    GOOGLE_NEWS_URLS.map(async (url) => {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Google News RSS error: ${response.status}`);
        }
        const xml = await response.text();
        const parsed = parser.parse(xml);

        const items: ReadonlyArray<RssItem> =
          parsed?.rss?.channel?.item ?? [];
        const itemArray = Array.isArray(items) ? items : [items];

        return itemArray.map(toRawArticle);
      } catch (error) {
        console.error(`Failed to fetch Google News RSS:`, error);
        return [] as RawNewsArticle[];
      }
    }),
  );

  for (const articles of results) {
    allArticles.push(...articles);
  }

  allArticles.sort(
    (a, b) => b.publishedAt.getTime() - a.publishedAt.getTime(),
  );

  return allArticles.slice(0, MAX_ARTICLES);
}

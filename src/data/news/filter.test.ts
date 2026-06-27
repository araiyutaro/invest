import { describe, it, expect } from "vitest";
import { filterNewsArticles } from "./filter.js";
import type { RawNewsArticle } from "./types.js";

const makeArticle = (overrides: Partial<RawNewsArticle>): RawNewsArticle => ({
  title: "デフォルトタイトル",
  summary: "デフォルト本文",
  source: "TestSource",
  url: "https://example.com/article",
  publishedAt: new Date(),
  category: "japan_market",
  ...overrides,
});

describe("URL dedup (DEDUP-01)", () => {
  it("同一URLの記事が1件に集約される (DEDUP-01)", () => {
    const articles = [
      makeArticle({ url: "https://nikkei.com/article/1", summary: "短い" }),
      makeArticle({
        url: "https://nikkei.com/article/1",
        summary: "こちらの方が長い本文",
      }),
    ];
    const result = filterNewsArticles(articles);
    expect(result.articles).toHaveLength(1);
    expect(result.articles[0].summary).toBe("こちらの方が長い本文");
  });

  it("summaryが長い方が残る (DEDUP-01 / D-02)", () => {
    const articles = [
      makeArticle({
        url: "https://nikkei.com/article/2",
        summary: "これは非常に長い本文で情報量が多い記事です",
      }),
      makeArticle({ url: "https://nikkei.com/article/2", summary: "短い" }),
    ];
    const result = filterNewsArticles(articles);
    expect(result.articles).toHaveLength(1);
    expect(result.articles[0].summary).toBe(
      "これは非常に長い本文で情報量が多い記事です",
    );
  });

  it("URL正規化でクエリパラメータ除去後に同一URLが1件に集約される (DEDUP-01)", () => {
    const articles = [
      makeArticle({
        url: "https://nikkei.com/article/3?utm_source=twitter&ref=top",
        summary: "短い",
      }),
      makeArticle({
        url: "https://nikkei.com/article/3?utm_source=facebook",
        summary: "こちらの方が長い本文",
      }),
    ];
    const result = filterNewsArticles(articles);
    expect(result.articles).toHaveLength(1);
    expect(result.articles[0].summary).toBe("こちらの方が長い本文");
  });

  it("Google News CBMiリダイレクトURLが全記事で同一にならない (DEDUP-01)", () => {
    const articles = [
      makeArticle({
        url: "https://news.google.com/rss/articles/CBMiABCD1234?hl=ja",
        title: "日銀が政策金利を引き上げ円高が進む",
        summary: "記事A",
      }),
      makeArticle({
        url: "https://news.google.com/rss/articles/CBMiXYZW5678?hl=ja",
        title: "米国雇用統計が予想を上回りドル高に",
        summary: "記事B",
      }),
    ];
    const result = filterNewsArticles(articles);
    expect(result.articles).toHaveLength(2);
  });
});

describe("Title Jaccard dedup (DEDUP-02)", () => {
  it("【速報】プレフィックス付きの同一記事が1件に集約される (DEDUP-02 / D-01)", () => {
    const articles = [
      makeArticle({
        url: "https://nikkei.com/a",
        title: "【速報】日経平均株価が急上昇",
        summary: "短い",
      }),
      makeArticle({
        url: "https://nikkei.com/b",
        title: "日経平均株価が急上昇",
        summary: "こちらの方が長い本文",
      }),
    ];
    const result = filterNewsArticles(articles);
    expect(result.articles).toHaveLength(1);
    expect(result.articles[0].summary).toBe("こちらの方が長い本文");
  });

  it("異なる内容の記事は2件残る (DEDUP-02)", () => {
    const articles = [
      makeArticle({
        url: "https://nikkei.com/c",
        title: "スポーツ用品株が高騰",
        summary: "スポーツ用品メーカーの株価が上昇",
      }),
      makeArticle({
        url: "https://nikkei.com/d",
        title: "スポーツ選手が優勝",
        summary: "国内スポーツ大会で選手が優勝",
      }),
    ];
    const result = filterNewsArticles(articles);
    expect(result.articles).toHaveLength(2);
  });

  it("Jaccard類似度0.75以上の英語タイトルが1件に集約される (DEDUP-02 / D-01)", () => {
    // Apple Q3 2026 results... vs Apple Q3 results... → Jaccard 9/10 = 0.9 >= 0.75
    const articles = [
      makeArticle({
        url: "https://reuters.com/apple-q3-2026",
        title: "Apple Q3 2026 results beat analyst forecasts on services revenue",
        summary: "短い",
        source: "Reuters",
      }),
      makeArticle({
        url: "https://bloomberg.com/apple-q3",
        title: "Apple Q3 results beat analyst forecasts on services revenue",
        summary: "こちらの方が長い本文",
        source: "Bloomberg",
      }),
    ];
    const result = filterNewsArticles(articles);
    expect(result.articles).toHaveLength(1);
    expect(result.articles[0].summary).toBe("こちらの方が長い本文");
  });
});

describe("Language group separation (D-03)", () => {
  it("英語記事と日本語記事がJaccardで同一視されない (D-03)", () => {
    const articles = [
      makeArticle({
        url: "https://finnhub.com/en/1",
        title: "AI stocks surge as technology sector gains momentum",
        summary: "English article summary",
        source: "Finnhub",
      }),
      makeArticle({
        url: "https://rss.jp/1",
        title: "AI関連株が急騰、テクノロジーセクターが好調",
        summary: "日本語の記事本文",
        source: "NHK",
      }),
    ];
    const result = filterNewsArticles(articles);
    expect(result.articles).toHaveLength(2);
  });
});

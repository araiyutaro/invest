import { describe, it, expect } from "vitest";
import {
  filterNewsArticles,
  calculatePriorityScore,
  sortByPriorityScore,
} from "./filter.js";
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
        title: "日銀が利上げを決定した",
        summary: "日銀の金融政策決定会合で利上げが決定された",
      }),
      makeArticle({
        url: "https://nikkei.com/d",
        title: "米国雇用統計が予想を上回る結果",
        summary: "米国の雇用統計が市場予想を上回る強い結果となった",
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

describe("Relevance filter (FILT-01)", () => {
  it("「プロ野球選手が引退を発表」がdenylistで除外される (FILT-01)", () => {
    const articles = [
      makeArticle({
        title: "プロ野球選手が引退を発表",
        url: "https://example.com/baseball1",
      }),
    ];
    const result = filterNewsArticles(articles);
    expect(result.articles).toHaveLength(0);
  });

  it("「人気俳優が結婚を発表」がdenylistで除外される (FILT-01)", () => {
    const articles = [
      makeArticle({
        title: "人気俳優が結婚を発表",
        url: "https://example.com/actor1",
      }),
    ];
    const result = filterNewsArticles(articles);
    expect(result.articles).toHaveLength(0);
  });

  it("「台風15号が関東に接近」がdenylistで除外される (FILT-01)", () => {
    const articles = [
      makeArticle({
        title: "台風15号が関東に接近",
        url: "https://example.com/typhoon1",
      }),
    ];
    const result = filterNewsArticles(articles);
    expect(result.articles).toHaveLength(0);
  });

  it("「スポーツ用品株が高騰」がdenylistで除外されない (投資キーワード例外, FILT-01)", () => {
    const articles = [
      makeArticle({
        title: "スポーツ用品株が高騰",
        url: "https://example.com/sports-stock1",
      }),
    ];
    const result = filterNewsArticles(articles);
    expect(result.articles).toHaveLength(1);
  });

  it("「オリンピック関連銘柄の決算が好調」がdenylistで除外されない (投資キーワード例外, FILT-01)", () => {
    const articles = [
      makeArticle({
        title: "オリンピック関連銘柄の決算が好調",
        url: "https://example.com/olympic-stock1",
      }),
    ];
    const result = filterNewsArticles(articles);
    expect(result.articles).toHaveLength(1);
  });

  it("「日銀が金利政策を発表」がdenylist対象外 (政治・社会は除外しない, FILT-01)", () => {
    const articles = [
      makeArticle({
        title: "日銀が金利政策を発表",
        url: "https://example.com/boj1",
      }),
    ];
    const result = filterNewsArticles(articles);
    expect(result.articles).toHaveLength(1);
  });

  it("「テスラが新型EVを発表」がdenylist対象外 (テクノロジー記事は除外対象外, FILT-01)", () => {
    const articles = [
      makeArticle({
        title: "テスラが新型EVを発表",
        url: "https://example.com/tesla1",
      }),
    ];
    const result = filterNewsArticles(articles);
    expect(result.articles).toHaveLength(1);
  });
});

describe("Time filter (FILT-02)", () => {
  it("25時間前のpublishedAtを持つ記事が除外される (FILT-02)", () => {
    const articles = [
      makeArticle({
        title: "25時間前の古いニュース",
        url: "https://example.com/old25h",
        publishedAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
      }),
    ];
    const result = filterNewsArticles(articles);
    expect(result.articles).toHaveLength(0);
  });

  it("23時間前のpublishedAtを持つ記事が残る (FILT-02)", () => {
    const articles = [
      makeArticle({
        title: "23時間前の新しいニュース",
        url: "https://example.com/new23h",
        publishedAt: new Date(Date.now() - 23 * 60 * 60 * 1000),
      }),
    ];
    const result = filterNewsArticles(articles);
    expect(result.articles).toHaveLength(1);
  });

  it("new Date(0)エポック日時の記事が除外される (FILT-02)", () => {
    const articles = [
      makeArticle({
        title: "エポック日付の記事",
        url: "https://example.com/epoch1",
        publishedAt: new Date(0),
      }),
    ];
    const result = filterNewsArticles(articles);
    expect(result.articles).toHaveLength(0);
  });
});

describe("filterNewsArticles integration (全4Pass)", () => {
  it("全4Passのstatsが正しいカウントを返す", () => {
    const now = Date.now();
    const articles = [
      // Pass1で除外: 同一URL (2件→1件)
      makeArticle({
        url: "https://example.com/dup-url",
        title: "重複URL記事A",
        summary: "短い",
      }),
      makeArticle({
        url: "https://example.com/dup-url",
        title: "重複URL記事B",
        summary: "こちらの方が長い本文",
      }),
      // Pass2で除外: 類似タイトル英語 (2件→1件)
      makeArticle({
        url: "https://reuters.com/apple-integration",
        title: "Apple Q4 2026 earnings beat analyst forecasts on services revenue",
        summary: "短い",
        source: "Reuters",
      }),
      makeArticle({
        url: "https://bloomberg.com/apple-integration",
        title: "Apple Q4 earnings beat analyst forecasts on services revenue",
        summary: "こちらの方が長い本文",
        source: "Bloomberg",
      }),
      // Pass3で除外: denylistヒット (芸能)
      makeArticle({
        url: "https://example.com/entertain1",
        title: "人気アイドルグループが解散を発表",
        publishedAt: new Date(now - 1 * 60 * 60 * 1000),
      }),
      // Pass4で除外: 25時間前
      makeArticle({
        url: "https://example.com/old3",
        title: "古い経済ニュース記事",
        publishedAt: new Date(now - 25 * 60 * 60 * 1000),
      }),
      // 残る: 正常な投資記事
      makeArticle({
        url: "https://example.com/keep1",
        title: "日経平均が今週の最高値を更新",
        publishedAt: new Date(now - 1 * 60 * 60 * 1000),
      }),
    ];
    const result = filterNewsArticles(articles);
    expect(result.stats.raw).toBe(7);
    expect(result.stats.afterUrlDedup).toBe(6);
    expect(result.stats.afterTitleDedup).toBe(5);
    expect(result.stats.afterRelevance).toBe(4);
    expect(result.stats.final).toBe(3);
    expect(result.articles).toHaveLength(3);
  });
});

describe("calculatePriorityScore (NEWS-02 / D-04, D-05)", () => {
  const PORTFOLIO_TICKERS = ["MRNA", "JOBY", "HII", "POWL", "FLNC", "EE", "NXT", "BWMX"];

  it("5時間前の記事はtimeScore=1.0を返す (D-04: 0-6h tier)", () => {
    const article = makeArticle({
      publishedAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
    });
    const score = calculatePriorityScore(article, Date.now(), []);
    expect(score).toBeCloseTo(1.0);
  });

  it("9時間前の記事はtimeScore=0.7を返す (D-04: 6-12h tier)", () => {
    const article = makeArticle({
      publishedAt: new Date(Date.now() - 9 * 60 * 60 * 1000),
    });
    const score = calculatePriorityScore(article, Date.now(), []);
    expect(score).toBeCloseTo(0.7);
  });

  it("20時間前の記事はtimeScore=0.4を返す (D-04: 12-24h tier)", () => {
    const article = makeArticle({
      publishedAt: new Date(Date.now() - 20 * 60 * 60 * 1000),
    });
    const score = calculatePriorityScore(article, Date.now(), []);
    expect(score).toBeCloseTo(0.4);
  });

  it("ちょうど6時間前は0.7tierに入る (D-04: 境界値は上tier外)", () => {
    const article = makeArticle({
      publishedAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
    });
    const score = calculatePriorityScore(article, Date.now(), []);
    expect(score).toBeCloseTo(0.7);
  });

  it("ポートフォリオティッカー記事には+0.2ボーナスが付く (D-05)", () => {
    const article = makeArticle({
      publishedAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
      ticker: "MRNA",
    });
    const score = calculatePriorityScore(article, Date.now(), PORTFOLIO_TICKERS);
    expect(score).toBeCloseTo(1.2);
  });

  it("ポートフォリオ外ティッカーはボーナスなし (D-05)", () => {
    const article = makeArticle({
      publishedAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
      ticker: "AAPL",
    });
    const score = calculatePriorityScore(article, Date.now(), PORTFOLIO_TICKERS);
    expect(score).toBeCloseTo(1.0);
  });

  it("tickerフィールドなし記事はボーナスなし (D-05)", () => {
    const article = makeArticle({
      publishedAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
    });
    const score = calculatePriorityScore(article, Date.now(), PORTFOLIO_TICKERS);
    expect(score).toBeCloseTo(1.0);
  });
});

describe("sortByPriorityScore (NEWS-02 / D-06)", () => {
  const PORTFOLIO_TICKERS = ["MRNA", "JOBY"];

  it("高スコア記事が低スコア記事より前に来る", () => {
    const articles = [
      makeArticle({
        url: "https://example.com/old",
        publishedAt: new Date(Date.now() - 20 * 60 * 60 * 1000),
      }),
      makeArticle({
        url: "https://example.com/new",
        publishedAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
      }),
    ];
    const sorted = sortByPriorityScore(articles, []);
    expect(sorted[0].url).toBe("https://example.com/new");
  });

  it("ティッカーボーナスで古い記事が新しい記事を上回る", () => {
    const articles = [
      makeArticle({
        url: "https://example.com/new-nobonus",
        publishedAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
      }),
      makeArticle({
        url: "https://example.com/old-ticker",
        publishedAt: new Date(Date.now() - 9 * 60 * 60 * 1000),
        ticker: "MRNA",
      }),
    ];
    const sorted = sortByPriorityScore(articles, PORTFOLIO_TICKERS);
    expect(sorted[0].url).toBe("https://example.com/new-nobonus");
  });

  it("同スコアの場合は新しい記事が先", () => {
    const articles = [
      makeArticle({
        url: "https://example.com/a",
        publishedAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
      }),
      makeArticle({
        url: "https://example.com/b",
        publishedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
      }),
    ];
    const sorted = sortByPriorityScore(articles, []);
    expect(sorted[0].url).toBe("https://example.com/b");
  });

  it("元の配列を変更しない（immutable）", () => {
    const articles = [
      makeArticle({ url: "https://a.com", publishedAt: new Date(Date.now() - 20 * 60 * 60 * 1000) }),
      makeArticle({ url: "https://b.com", publishedAt: new Date(Date.now() - 1 * 60 * 60 * 1000) }),
    ];
    const original = [...articles];
    sortByPriorityScore(articles, []);
    expect(articles[0].url).toBe(original[0].url);
  });
});

describe("filterNewsArticles with portfolioTickers (NEWS-02 / D-06)", () => {
  it("portfolioTickersなしでも既存のfilterNewsArticlesが動作する（後方互換）", () => {
    const articles = [
      makeArticle({ url: "https://example.com/a" }),
    ];
    const result = filterNewsArticles(articles);
    expect(result.articles).toHaveLength(1);
  });

  it("filterNewsArticles結果はスコア降順になっている", () => {
    const now = Date.now();
    const articles = [
      makeArticle({
        url: "https://example.com/old",
        title: "古い記事です",
        publishedAt: new Date(now - 20 * 60 * 60 * 1000),
      }),
      makeArticle({
        url: "https://example.com/new",
        title: "新しい記事です",
        publishedAt: new Date(now - 1 * 60 * 60 * 1000),
      }),
    ];
    const result = filterNewsArticles(articles, ["MRNA"]);
    expect(result.articles[0].url).toBe("https://example.com/new");
  });
});

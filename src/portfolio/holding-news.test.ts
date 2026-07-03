import { describe, it, expect } from "vitest";
import {
  buildHoldingNewsMap,
  matchesTicker,
  matchesHoldingByName,
} from "./holding-news.js";
import type { NewsArticleWithId } from "../data/news/article-id.js";
import type { PortfolioHolding } from "./holdings.js";

const makeArticleWithId = (
  overrides: Partial<NewsArticleWithId> & { id: string },
): NewsArticleWithId => ({
  title: "デフォルトタイトル",
  summary: "デフォルト本文",
  source: "TestSource",
  url: "https://example.com/article",
  publishedAt: new Date(),
  category: "japan_market",
  ...overrides,
});

const makeHolding = (overrides: Partial<PortfolioHolding>): PortfolioHolding => ({
  symbol: "TEST",
  name: "Test Corp",
  nameJa: "テスト株式会社",
  sector: "Technology",
  ...overrides,
});

const ALL_12_HOLDINGS: ReadonlyArray<PortfolioHolding> = [
  { symbol: "MRNA", name: "Moderna", nameJa: "モデルナ", sector: "Healthcare" },
  { symbol: "JOBY", name: "Joby Aviation", nameJa: "ジョビー・アビエーション", sector: "Industrials", matchAliases: ["Joby"] },
  { symbol: "HII", name: "Huntington Ingalls Industries", nameJa: "ハンティントン・インガルス", sector: "Industrials" },
  { symbol: "POWL", name: "Powell Industries", nameJa: "パウエル・インダストリーズ", sector: "Industrials" },
  { symbol: "FLNC", name: "Fluence Energy", nameJa: "フルエンス・エナジー", sector: "Energy" },
  { symbol: "EE", name: "Excelerate Energy", nameJa: "エクセラレート・エナジー", sector: "Energy" },
  { symbol: "8522.T", name: "The Bank of Nagoya", nameJa: "名古屋銀行", sector: "Financials", matchAliases: ["名古屋銀"] },
  { symbol: "5885.T", name: "GDEP Advance", nameJa: "ジーデップ・アドバンス", sector: "Technology" },
  { symbol: "5576.T", name: "O.B.System", nameJa: "オービーシステム", sector: "Technology" },
  { symbol: "7711.T", name: "Sukagawa Electric", nameJa: "助川電気工業", sector: "Industrials" },
  { symbol: "NXT", name: "Nextpower", nameJa: "ネクストパワー", sector: "Energy" },
  { symbol: "BWMX", name: "Betterware de Mexico", nameJa: "ベターウェア・デ・メヒコ", sector: "Consumer" },
];

describe("matchesTicker (D-01)", () => {
  it("article.ticker が holding.symbol と一致すれば true", () => {
    const article = makeArticleWithId({ id: "n01", ticker: "MRNA" });
    const holding = makeHolding({ symbol: "MRNA" });
    expect(matchesTicker(article, holding)).toBe(true);
  });

  it("article.ticker が holding.symbol と不一致なら false", () => {
    const article = makeArticleWithId({ id: "n01", ticker: "AAPL" });
    const holding = makeHolding({ symbol: "MRNA" });
    expect(matchesTicker(article, holding)).toBe(false);
  });

  it("article.ticker が undefined なら false", () => {
    const article = makeArticleWithId({ id: "n01" });
    const holding = makeHolding({ symbol: "MRNA" });
    expect(matchesTicker(article, holding)).toBe(false);
  });
});

describe("matchesHoldingByName (D-02, D-03, D-04)", () => {
  it("タイトルに name が含まれれば true (D-02: 全銘柄均一)", () => {
    const holding = makeHolding({ name: "Moderna", nameJa: "モデルナ" });
    expect(matchesHoldingByName("Moderna announces new vaccine trial", holding)).toBe(true);
  });

  it("タイトルに nameJa が含まれれば true (D-02: 日本株限定にしない)", () => {
    const holding = makeHolding({ name: "The Bank of Nagoya", nameJa: "名古屋銀行" });
    expect(matchesHoldingByName("名古屋銀行が決算を発表", holding)).toBe(true);
  });

  it("タイトルに name/nameJa/matchAliases のいずれも含まれなければ false", () => {
    const holding = makeHolding({ name: "Moderna", nameJa: "モデルナ" });
    expect(matchesHoldingByName("無関係な記事タイトル", holding)).toBe(false);
  });

  it("summary にのみ銘柄名を含みタイトルには含まない場合は false (D-03)", () => {
    const holding = makeHolding({ name: "Moderna", nameJa: "モデルナ" });
    // タイトルは無関係、summaryにModernaが言及されている想定だが、
    // matchesHoldingByNameはtitleのみを引数に取るため、summary言及は構造的に評価されない
    expect(matchesHoldingByName("無関係な株式市場ニュース", holding)).toBe(false);
  });

  it("matchAliases がタイトル照合に参加する (D-04: Joby)", () => {
    const holding = makeHolding({
      symbol: "JOBY",
      name: "Joby Aviation",
      nameJa: "ジョビー・アビエーション",
      matchAliases: ["Joby"],
    });
    expect(matchesHoldingByName("Joby completes first commercial flight", holding)).toBe(true);
  });

  it("matchAliases がタイトル照合に参加する (D-04: 名古屋銀)", () => {
    const holding = makeHolding({
      symbol: "8522.T",
      name: "The Bank of Nagoya",
      nameJa: "名古屋銀行",
      matchAliases: ["名古屋銀"],
    });
    expect(matchesHoldingByName("名古屋銀が新支店を開設", holding)).toBe(true);
  });
});

describe("buildHoldingNewsMap fail-soft (D-08)", () => {
  it("記事が空配列でも12銘柄すべてのキーが存在し各値が空配列", () => {
    const result = buildHoldingNewsMap([], ALL_12_HOLDINGS);
    expect(Object.keys(result)).toHaveLength(12);
    for (const holding of ALL_12_HOLDINGS) {
      expect(result[holding.symbol]).toEqual([]);
    }
  });

  it("マッチする記事がない場合も throw しない", () => {
    const articles = [makeArticleWithId({ id: "n01", title: "無関係な記事" })];
    expect(() => buildHoldingNewsMap(articles, ALL_12_HOLDINGS)).not.toThrow();
  });
});

describe("buildHoldingNewsMap ticker優先 (D-01, D-02)", () => {
  it("ticker一致が社名一致より優先してマッチする", () => {
    const articles = [
      makeArticleWithId({ id: "n01", title: "Moderna announces earnings", ticker: "MRNA" }),
    ];
    const result = buildHoldingNewsMap(articles, ALL_12_HOLDINGS);
    expect(result.MRNA).toHaveLength(1);
    expect(result.MRNA[0]).toMatchObject({ id: "n01", matchType: "ticker" });
  });

  it("社名フォールバックは日本株に限定されず全12銘柄に適用される (D-02)", () => {
    const articles = [
      makeArticleWithId({ id: "n01", title: "Moderna announces new vaccine trial" }),
      makeArticleWithId({ id: "n02", title: "名古屋銀行が決算を発表" }),
    ];
    const result = buildHoldingNewsMap(articles, ALL_12_HOLDINGS);
    expect(result.MRNA).toHaveLength(1);
    expect(result.MRNA[0]).toMatchObject({ id: "n01", matchType: "name" });
    expect(result["8522.T"]).toHaveLength(1);
    expect(result["8522.T"][0]).toMatchObject({ id: "n02", matchType: "name" });
  });
});

describe("buildHoldingNewsMap 上限5件切り捨て (D-09, D-10)", () => {
  it("1銘柄あたり最大5件に切り捨てられる", () => {
    const articles = Array.from({ length: 8 }, (_, i) =>
      makeArticleWithId({
        id: `n${String(i + 1).padStart(2, "0")}`,
        title: "Moderna announces earnings",
        ticker: "MRNA",
        publishedAt: new Date(Date.now() - i * 60 * 60 * 1000),
      }),
    );
    const result = buildHoldingNewsMap(articles, ALL_12_HOLDINGS);
    expect(result.MRNA).toHaveLength(5);
  });

  it("上限超過時はticker一致が名前一致より優先して残る", () => {
    // 3件のticker一致 + 3件のname一致 → cap 5件で、ticker一致3件は必ず全て残る
    const tickerMatches = Array.from({ length: 3 }, (_, i) =>
      makeArticleWithId({
        id: `t${i}`,
        title: "無関係タイトル",
        ticker: "MRNA",
        publishedAt: new Date(Date.now() - 20 * 60 * 60 * 1000), // low time score
      }),
    );
    const nameMatches = Array.from({ length: 3 }, (_, i) =>
      makeArticleWithId({
        id: `m${i}`,
        title: "Moderna announces breaking news",
        publishedAt: new Date(Date.now() - 1 * 60 * 60 * 1000), // high time score
      }),
    );
    const articles = [...tickerMatches, ...nameMatches];
    const result = buildHoldingNewsMap(articles, ALL_12_HOLDINGS);
    expect(result.MRNA).toHaveLength(5);
    const tickerIds = result.MRNA.filter((e) => e.matchType === "ticker").map((e) => e.id);
    expect(tickerIds.sort()).toEqual(["t0", "t1", "t2"]);
  });

  it("同一matchType内はcalculatePriorityScore降順でtie-breakされる", () => {
    const articles = [
      makeArticleWithId({
        id: "old",
        title: "Moderna announces news",
        ticker: "MRNA",
        publishedAt: new Date(Date.now() - 20 * 60 * 60 * 1000),
      }),
      makeArticleWithId({
        id: "new",
        title: "Moderna announces news",
        ticker: "MRNA",
        publishedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
      }),
    ];
    const result = buildHoldingNewsMap(articles, ALL_12_HOLDINGS);
    expect(result.MRNA.map((e) => e.id)).toEqual(["new", "old"]);
  });
});

describe("buildHoldingNewsMap immutability", () => {
  it("呼び出し後、入力 articles / holdings 配列が不変", () => {
    const articles = [
      makeArticleWithId({ id: "n01", title: "Moderna news", ticker: "MRNA" }),
    ];
    const holdings = [...ALL_12_HOLDINGS];
    const originalArticles = [...articles];
    const originalHoldings = [...holdings];

    buildHoldingNewsMap(articles, holdings);

    expect(articles).toEqual(originalArticles);
    expect(holdings).toEqual(originalHoldings);
  });
});

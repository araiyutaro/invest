import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { RawNewsArticle } from "../data/news/types.js";

vi.mock("node:fs/promises", () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

const mockMarketData = {
  indices: [
    { name: "S&P 500", symbol: "^GSPC", price: 5000, change: 10, changePercent: 0.2 },
  ],
  sectors: [],
};

vi.mock("../data/market.js", () => ({
  fetchAllMarketData: vi.fn().mockResolvedValue(mockMarketData),
}));

vi.mock("../data/news/finnhub.js", () => ({
  fetchAllFinnhubNews: vi.fn().mockResolvedValue({ general: [], merger: [] }),
}));

vi.mock("../data/news/google-news.js", () => ({
  fetchGoogleNewsJapan: vi.fn().mockResolvedValue([]),
}));

vi.mock("../data/news/rss-sources.js", () => ({
  fetchAllRssNews: vi.fn().mockResolvedValue([]),
}));

vi.mock("../portfolio/data.js", () => ({
  fetchPortfolioData: vi.fn().mockResolvedValue([]),
}));

vi.mock("../portfolio/holdings.js", () => ({
  PORTFOLIO_HOLDINGS: [],
}));

vi.mock("../data/news/filter.js", () => ({
  filterNewsArticles: vi.fn().mockReturnValue({
    articles: [],
    stats: { raw: 0, afterUrlDedup: 0, afterTitleDedup: 0, afterRelevance: 0, final: 0 },
  }),
}));

describe("collect-data script", () => {
  let writeFileMock: ReturnType<typeof vi.fn>;
  let mkdirMock: ReturnType<typeof vi.fn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    const fsMock = await import("node:fs/promises");
    writeFileMock = fsMock.writeFile as ReturnType<typeof vi.fn>;
    mkdirMock = fsMock.mkdir as ReturnType<typeof vi.fn>;
    writeFileMock.mockClear();
    mkdirMock.mockClear();

    const marketMock = await import("../data/market.js");
    (marketMock.fetchAllMarketData as ReturnType<typeof vi.fn>).mockResolvedValue(mockMarketData);

    const finnhubMock = await import("../data/news/finnhub.js");
    (finnhubMock.fetchAllFinnhubNews as ReturnType<typeof vi.fn>).mockResolvedValue({ general: [], merger: [] });

    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("Test 1: main() を実行すると tmp/market.json が作成される", async () => {
    const { main } = await import("./collect-data.js");
    await main();

    const writeCalls = writeFileMock.mock.calls;
    const marketJsonCall = writeCalls.find((call) =>
      String(call[0]).includes("market.json"),
    );
    expect(marketJsonCall).toBeDefined();
  });

  it("Test 2: tmp/market.json の内容は indices と sectors キーを持つ", async () => {
    const { main } = await import("./collect-data.js");
    await main();

    const writeCalls = writeFileMock.mock.calls;
    const marketJsonCall = writeCalls.find((call) =>
      String(call[0]).includes("market.json"),
    );
    expect(marketJsonCall).toBeDefined();
    const parsed = JSON.parse(marketJsonCall![1] as string);
    expect(parsed).toHaveProperty("indices");
    expect(parsed).toHaveProperty("sectors");
    expect(Array.isArray(parsed.indices)).toBe(true);
    expect(Array.isArray(parsed.sectors)).toBe(true);
  });

  it("Test 3: tmp/news.json の内容は配列である", async () => {
    const { main } = await import("./collect-data.js");
    await main();

    const writeCalls = writeFileMock.mock.calls;
    const newsJsonCall = writeCalls.find((call) =>
      String(call[0]).includes("news.json"),
    );
    expect(newsJsonCall).toBeDefined();
    const parsed = JSON.parse(newsJsonCall![1] as string);
    expect(Array.isArray(parsed)).toBe(true);
  });

  it("Test 4: tmp/portfolio.json の内容は配列である", async () => {
    const { main } = await import("./collect-data.js");
    await main();

    const writeCalls = writeFileMock.mock.calls;
    const portfolioJsonCall = writeCalls.find((call) =>
      String(call[0]).includes("portfolio.json"),
    );
    expect(portfolioJsonCall).toBeDefined();
    const parsed = JSON.parse(portfolioJsonCall![1] as string);
    expect(Array.isArray(parsed)).toBe(true);
  });

  it("Test 5: fetchAllMarketData が reject したとき process.exit(1) が呼ばれる", async () => {
    const marketMock = await import("../data/market.js");
    (marketMock.fetchAllMarketData as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("Market data fetch failed"),
    );

    const { main } = await import("./collect-data.js");
    // main() が reject するとモジュールトップレベルの catch で process.exit(1) が呼ばれる
    // テスト内では main() を直接呼び出してエラーを捕捉し、process.exit(1) を呼ぶロジックを再現する
    await main().catch((error) => {
      console.error("Fatal error:", error);
      process.exit(1);
    });

    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it("Test 6: fetchAllFinnhubNews が reject したとき news.json に [] が書き込まれ続行される", async () => {
    const finnhubMock = await import("../data/news/finnhub.js");
    (finnhubMock.fetchAllFinnhubNews as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("Finnhub fetch failed"),
    );

    const { main } = await import("./collect-data.js");
    await main();

    const writeCalls = writeFileMock.mock.calls;
    const newsJsonCall = writeCalls.find((call) =>
      String(call[0]).includes("news.json"),
    );
    expect(newsJsonCall).toBeDefined();
    expect(newsJsonCall![1]).toBe("[]");
  });

  it("Test 7: main() 実行時にコンソールに「市場データ収集中...」を含むメッセージが出力される", async () => {
    const { main } = await import("./collect-data.js");
    await main();

    const logCalls = consoleLogSpy.mock.calls.map((call: unknown[]) => String(call[0]));
    const found = logCalls.some((msg: string) => msg.includes("市場データ収集中..."));
    expect(found).toBe(true);
  });
});

describe("news filter integration (INTG-01/FILT-03/FILT-04)", () => {
  let writeFileMock: ReturnType<typeof vi.fn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let filterMock: ReturnType<typeof vi.fn>;

  function makeArticle(overrides?: Partial<RawNewsArticle>): RawNewsArticle {
    return {
      title: "Test Article",
      summary: "Test Summary",
      source: "test-source",
      url: "https://example.com/article",
      publishedAt: new Date("2026-06-28T00:00:00Z"),
      category: "general",
      ...overrides,
    };
  }

  beforeEach(async () => {
    const fsMock = await import("node:fs/promises");
    writeFileMock = fsMock.writeFile as ReturnType<typeof vi.fn>;
    writeFileMock.mockClear();
    (fsMock.mkdir as ReturnType<typeof vi.fn>).mockClear();

    const marketMock = await import("../data/market.js");
    (marketMock.fetchAllMarketData as ReturnType<typeof vi.fn>).mockResolvedValue({
      indices: [{ name: "S&P 500", symbol: "^GSPC", price: 5000, change: 10, changePercent: 0.2 }],
      sectors: [],
    });

    const finnhubModule = await import("../data/news/finnhub.js");
    (finnhubModule.fetchAllFinnhubNews as ReturnType<typeof vi.fn>).mockResolvedValue({
      general: [],
      merger: [],
    });

    const filterModule = await import("../data/news/filter.js");
    filterMock = filterModule.filterNewsArticles as ReturnType<typeof vi.fn>;
    filterMock.mockReset();
    filterMock.mockReturnValue({
      articles: [],
      stats: { raw: 0, afterUrlDedup: 0, afterTitleDedup: 0, afterRelevance: 0, final: 0 },
    });

    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("filterNewsArticles が呼び出され、フィルタ済み記事のみが news.json に書き込まれる (INTG-01)", async () => {
    const article1 = makeArticle({ title: "Article 1", url: "https://example.com/1" });
    const article2 = makeArticle({ title: "Article 2", url: "https://example.com/2" });
    const article3 = makeArticle({ title: "Article 3", url: "https://example.com/3" });

    const finnhubModule = await import("../data/news/finnhub.js");
    (finnhubModule.fetchAllFinnhubNews as ReturnType<typeof vi.fn>).mockResolvedValue({
      general: [article1, article2, article3],
      merger: [],
    });

    filterMock.mockReturnValue({
      articles: [article1, article2],
      stats: { raw: 3, afterUrlDedup: 3, afterTitleDedup: 2, afterRelevance: 2, final: 2 },
    });

    const { main } = await import("./collect-data.js");
    await main();

    const newsJsonCall = writeFileMock.mock.calls.find((call) =>
      String(call[0]).includes("news.json"),
    );
    expect(newsJsonCall).toBeDefined();
    const parsed = JSON.parse(newsJsonCall![1] as string);
    expect(parsed).toHaveLength(2);
  });

  it("3段階の記事数統計がコンソールに出力される (FILT-03)", async () => {
    filterMock.mockReturnValue({
      articles: Array.from({ length: 65 }, (_, i) =>
        makeArticle({ url: `https://example.com/${i}` }),
      ),
      stats: { raw: 100, afterUrlDedup: 90, afterTitleDedup: 80, afterRelevance: 70, final: 65 },
    });

    const { main } = await import("./collect-data.js");
    await main();

    const logCalls = consoleLogSpy.mock.calls.map((call) => String(call[0]));
    const statsLine = logCalls.find(
      (msg) => msg.includes("100") && msg.includes("80") && msg.includes("65"),
    );
    expect(statsLine).toBeDefined();
  });

  it("フィルタ後80件超の場合、80件にトリミングされる (FILT-04 MAX)", async () => {
    filterMock.mockReturnValue({
      articles: Array.from({ length: 90 }, (_, i) =>
        makeArticle({ url: `https://example.com/${i}` }),
      ),
      stats: { raw: 100, afterUrlDedup: 95, afterTitleDedup: 92, afterRelevance: 91, final: 90 },
    });

    const { main } = await import("./collect-data.js");
    await main();

    const newsJsonCall = writeFileMock.mock.calls.find((call) =>
      String(call[0]).includes("news.json"),
    );
    expect(newsJsonCall).toBeDefined();
    const parsed = JSON.parse(newsJsonCall![1] as string);
    expect(parsed).toHaveLength(80);
  });

  it("フィルタ後20件未満の場合、警告が出力されるがそのまま使用される (FILT-04 MIN)", async () => {
    filterMock.mockReturnValue({
      articles: Array.from({ length: 10 }, (_, i) =>
        makeArticle({ url: `https://example.com/${i}` }),
      ),
      stats: { raw: 50, afterUrlDedup: 45, afterTitleDedup: 15, afterRelevance: 12, final: 10 },
    });

    const { main } = await import("./collect-data.js");
    await main();

    const logCalls = consoleLogSpy.mock.calls.map((call) => String(call[0]));
    const warningLine = logCalls.find(
      (msg) => msg.includes("10") && msg.includes("MIN=20"),
    );
    expect(warningLine).toBeDefined();

    const newsJsonCall = writeFileMock.mock.calls.find((call) =>
      String(call[0]).includes("news.json"),
    );
    expect(newsJsonCall).toBeDefined();
    const parsed = JSON.parse(newsJsonCall![1] as string);
    expect(parsed).toHaveLength(10);
  });
});

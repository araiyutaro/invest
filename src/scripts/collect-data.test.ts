import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

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

    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
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
    const { fetchAllMarketData } = await import("../data/market.js");
    (fetchAllMarketData as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("Market data fetch failed"),
    );

    const { main } = await import("./collect-data.js");
    await main().catch(() => {});

    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it("Test 6: fetchAllFinnhubNews が reject したとき news.json に [] が書き込まれ続行される", async () => {
    const { fetchAllFinnhubNews } = await import("../data/news/finnhub.js");
    (fetchAllFinnhubNews as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
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

    const logCalls = consoleLogSpy.mock.calls.map((call) => String(call[0]));
    const found = logCalls.some((msg) => msg.includes("市場データ収集中..."));
    expect(found).toBe(true);
  });
});

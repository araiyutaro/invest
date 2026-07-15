import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { quoteMock, readFileMock, writeFileMock } = vi.hoisted(() => ({
  quoteMock: vi.fn(),
  readFileMock: vi.fn(),
  writeFileMock: vi.fn(),
}));

vi.mock("yahoo-finance2", () => ({
  default: vi.fn().mockImplementation(function YahooFinanceMock() {
    return { quote: quoteMock };
  }),
}));

vi.mock("node:fs/promises", () => ({
  readFile: readFileMock,
  writeFile: writeFileMock,
}));

function makeHighlightedStock(overrides: {
  ticker: string;
  verdict?: "強気" | "中立" | "弱気";
}) {
  return {
    ticker: overrides.ticker,
    averageScore: 7.5,
    verdict: overrides.verdict ?? "強気",
    summary: `${overrides.ticker}のテストサマリー`,
    agentScores: [],
    nominatedBy: [],
  };
}

function makeMeetingResult(highlightedStocks: ReturnType<typeof makeHighlightedStock>[]) {
  return {
    date: "2026-07-15",
    generatedAt: "2026-07-15T00:00:00.000Z",
    marketOverview: {
      summary: "テスト市況",
      trend: "混合",
      keyIndices: [],
    },
    sectorRecommendations: [],
    highlightedStocks,
    riskWarnings: [],
    actionItems: [],
    weeklyEvents: [],
    indexInvestorAdvice: "テストアドバイス",
    roundSummary: {
      round1Count: 0,
      round2Count: 0,
      round3Count: 0,
      scoredTickers: [],
    },
  };
}

describe("filter-etf-stocks main()", () => {
  beforeEach(() => {
    quoteMock.mockReset();
    readFileMock.mockReset();
    writeFileMock.mockReset();
    writeFileMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("Test A: 正常フィルタ -- ETF(SPY, 1306.T)を除外しEQUITY(AAPL, 7203.T)のみでwriteFileが1回呼ばれる", async () => {
    const meetingResult = makeMeetingResult([
      makeHighlightedStock({ ticker: "AAPL" }),
      makeHighlightedStock({ ticker: "SPY" }),
      makeHighlightedStock({ ticker: "1306.T" }),
      makeHighlightedStock({ ticker: "7203.T" }),
    ]);
    readFileMock.mockResolvedValue(JSON.stringify(meetingResult));
    quoteMock.mockResolvedValue([
      { symbol: "AAPL", quoteType: "EQUITY" },
      { symbol: "SPY", quoteType: "ETF" },
      { symbol: "1306.T", quoteType: "ETF" },
      { symbol: "7203.T", quoteType: "EQUITY" },
    ]);

    const { main } = await import("./filter-etf-stocks.js");
    await main();

    expect(writeFileMock).toHaveBeenCalledTimes(1);
    const [, payload] = writeFileMock.mock.calls[0];
    const written = JSON.parse(payload as string);
    expect(written.highlightedStocks.map((s: { ticker: string }) => s.ticker)).toEqual(["AAPL", "7203.T"]);
  });

  it("Test B: partial lookup失敗で継続 -- 応答に欠けたtickerはfail-closedで除外されthrowしない", async () => {
    const meetingResult = makeMeetingResult([
      makeHighlightedStock({ ticker: "AAPL" }),
      makeHighlightedStock({ ticker: "XYZ" }),
    ]);
    readFileMock.mockResolvedValue(JSON.stringify(meetingResult));
    quoteMock.mockResolvedValue([{ symbol: "AAPL", quoteType: "EQUITY" }]);

    const { main } = await import("./filter-etf-stocks.js");
    await expect(main()).resolves.toBeUndefined();

    expect(writeFileMock).toHaveBeenCalledTimes(1);
    const [, payload] = writeFileMock.mock.calls[0];
    const written = JSON.parse(payload as string);
    expect(written.highlightedStocks.map((s: { ticker: string }) => s.ticker)).toEqual(["AAPL"]);
  });

  it("Test C: batch quote() reject で fail-soft -- writeFileが呼ばれずprocess.exitCodeが非0、throwしない", async () => {
    const meetingResult = makeMeetingResult([makeHighlightedStock({ ticker: "AAPL" })]);
    readFileMock.mockResolvedValue(JSON.stringify(meetingResult));
    quoteMock.mockRejectedValue(new Error("Yahoo Finance API error"));

    const originalExitCode = process.exitCode;
    process.exitCode = undefined;

    const { main } = await import("./filter-etf-stocks.js");
    await expect(main()).resolves.toBeUndefined();

    expect(writeFileMock).not.toHaveBeenCalled();
    expect(process.exitCode).not.toBe(0);
    expect(process.exitCode).toBeDefined();

    process.exitCode = originalExitCode;
  });

  it("Test D: 読み込み失敗で fail-soft -- writeFileが呼ばれずprocess.exitCodeが非0、throwしない", async () => {
    readFileMock.mockRejectedValue(new Error("ENOENT"));

    const originalExitCode = process.exitCode;
    process.exitCode = undefined;

    const { main } = await import("./filter-etf-stocks.js");
    await expect(main()).resolves.toBeUndefined();

    expect(writeFileMock).not.toHaveBeenCalled();
    expect(process.exitCode).not.toBe(0);
    expect(process.exitCode).toBeDefined();

    process.exitCode = originalExitCode;
  });

  it("Test E: highlightedStocks 0件でスキップ -- quote()を呼ばずwriteFileもせず正常終了", async () => {
    const meetingResult = makeMeetingResult([]);
    readFileMock.mockResolvedValue(JSON.stringify(meetingResult));

    const { main } = await import("./filter-etf-stocks.js");
    await expect(main()).resolves.toBeUndefined();

    expect(quoteMock).not.toHaveBeenCalled();
    expect(writeFileMock).not.toHaveBeenCalled();
  });

  it("Test F: D-13監査ログ -- ETF除外とlookup失敗除外がstdoutに区別されて記録される", async () => {
    const meetingResult = makeMeetingResult([
      makeHighlightedStock({ ticker: "SPY" }),
      makeHighlightedStock({ ticker: "XYZ" }),
    ]);
    readFileMock.mockResolvedValue(JSON.stringify(meetingResult));
    quoteMock.mockResolvedValue([{ symbol: "SPY", quoteType: "ETF" }]);

    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const { main } = await import("./filter-etf-stocks.js");
    await main();

    const loggedLines = consoleLogSpy.mock.calls.map((call) => call.join(" "));
    expect(loggedLines).toEqual(
      expect.arrayContaining([expect.stringContaining("ETF除外: SPY (quoteType=ETF)")]),
    );
    expect(loggedLines).toEqual(
      expect.arrayContaining([expect.stringContaining("ETF除外: XYZ (quoteType取得失敗, fail-closed)")]),
    );
  });

  it("Test G: single batch call (D-05) -- quoteMockが配列を第1引数として厳密に1回だけ呼ばれる", async () => {
    const meetingResult = makeMeetingResult([
      makeHighlightedStock({ ticker: "AAPL" }),
      makeHighlightedStock({ ticker: "SPY" }),
    ]);
    readFileMock.mockResolvedValue(JSON.stringify(meetingResult));
    quoteMock.mockResolvedValue([
      { symbol: "AAPL", quoteType: "EQUITY" },
      { symbol: "SPY", quoteType: "ETF" },
    ]);

    const { main } = await import("./filter-etf-stocks.js");
    await main();

    expect(quoteMock).toHaveBeenCalledTimes(1);
    expect(Array.isArray(quoteMock.mock.calls[0][0])).toBe(true);
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { quoteMock, readFileMock, writeFileMock, mkdirMock } = vi.hoisted(() => ({
  quoteMock: vi.fn(),
  readFileMock: vi.fn(),
  writeFileMock: vi.fn(),
  mkdirMock: vi.fn(),
}));

vi.mock("yahoo-finance2", () => ({
  default: vi.fn().mockImplementation(function YahooFinanceMock() {
    return { quote: quoteMock };
  }),
}));

vi.mock("node:fs/promises", () => ({
  readFile: readFileMock,
  writeFile: writeFileMock,
  mkdir: mkdirMock,
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

function makeMeetingResult(highlightedStocks: ReturnType<typeof makeHighlightedStock>[], date = "2026-07-15") {
  return {
    date,
    generatedAt: `${date}T00:00:00.000Z`,
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

describe("write-watchlist", () => {
  beforeEach(() => {
    quoteMock.mockReset();
    readFileMock.mockReset();
    writeFileMock.mockReset().mockResolvedValue(undefined);
    mkdirMock.mockReset().mockResolvedValue(undefined);
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("loadExistingWatchlist", () => {
    it("ENOENT の場合、corrupted:false で空のwatchlistを返す", async () => {
      readFileMock.mockRejectedValue(new Error("ENOENT"));

      const { loadExistingWatchlist } = await import("./write-watchlist.js");
      const result = await loadExistingWatchlist();

      expect(result).toEqual({ watchlist: {}, corrupted: false });
    });

    it("破損したJSONの場合、corrupted:true で空のwatchlistを返す", async () => {
      readFileMock.mockResolvedValue("{not valid json");

      const { loadExistingWatchlist } = await import("./write-watchlist.js");
      const result = await loadExistingWatchlist();

      expect(result).toEqual({ watchlist: {}, corrupted: true });
    });

    it("正常なJSONの場合、パースされたwatchlistをcorrupted:falseで返す", async () => {
      const existing = { AAPL: { ticker: "AAPL", addedDate: "2026-07-01", lastVerdictDate: "2026-07-01", history: [] } };
      readFileMock.mockResolvedValue(JSON.stringify(existing));

      const { loadExistingWatchlist } = await import("./write-watchlist.js");
      const result = await loadExistingWatchlist();

      expect(result).toEqual({ watchlist: existing, corrupted: false });
    });
  });

  describe("fetchQuoteTypesAndNames", () => {
    it("tickers が空配列の場合、quote() を呼ばず空のMapペアを返す", async () => {
      const { fetchQuoteTypesAndNames } = await import("./write-watchlist.js");
      const result = await fetchQuoteTypesAndNames([]);

      expect(quoteMock).not.toHaveBeenCalled();
      expect(result.quoteTypeByTicker.size).toBe(0);
      expect(result.nameByTicker.size).toBe(0);
    });

    it("batch quote() の結果から quoteType と longName を1回で取得する", async () => {
      quoteMock.mockResolvedValue([
        { symbol: "MRNA", quoteType: "EQUITY", longName: "Moderna, Inc." },
        { symbol: "SPY", quoteType: "ETF", shortName: "SPDR S&P 500" },
      ]);

      const { fetchQuoteTypesAndNames } = await import("./write-watchlist.js");
      const result = await fetchQuoteTypesAndNames(["MRNA", "SPY"]);

      expect(quoteMock).toHaveBeenCalledTimes(1);
      expect(result.quoteTypeByTicker.get("MRNA")).toEqual({ status: "ok", quoteType: "EQUITY" });
      expect(result.quoteTypeByTicker.get("SPY")).toEqual({ status: "ok", quoteType: "ETF" });
      expect(result.nameByTicker.get("MRNA")).toEqual({ name: "Moderna, Inc.", nameJa: undefined });
      expect(result.nameByTicker.get("SPY")).toEqual({ name: "SPDR S&P 500", nameJa: undefined });
    });
  });

  describe("main()", () => {
    it("既存 data/watchlist.json が破損している場合、writeFile を呼ばず [STEP:watchlist:FAIL:corrupted] を出力する", async () => {
      readFileMock.mockImplementation((path: string) => {
        const p = String(path);
        if (p.includes("watchlist.json")) return Promise.resolve("{not valid json");
        return Promise.reject(new Error("ENOENT"));
      });

      const { main } = await import("./write-watchlist.js");
      await main();

      expect(writeFileMock).not.toHaveBeenCalled();
      const errorCalls = (console.error as ReturnType<typeof vi.fn>).mock.calls.flat();
      expect(errorCalls.some((c) => String(c).includes("[STEP:watchlist:FAIL:corrupted]"))).toBe(true);
    });

    it("meeting-result.json の date が不正な形式の場合、writeFile を呼ばず FAIL マーカーで終了する", async () => {
      readFileMock.mockImplementation((path: string) => {
        const p = String(path);
        if (p.includes("meeting-result.json")) {
          return Promise.resolve(JSON.stringify(makeMeetingResult([makeHighlightedStock({ ticker: "MRNA" })], "2026-7-15")));
        }
        return Promise.reject(new Error("ENOENT"));
      });

      const { main } = await import("./write-watchlist.js");
      await main();

      expect(writeFileMock).not.toHaveBeenCalled();
      const errorCalls = (console.error as ReturnType<typeof vi.fn>).mock.calls.flat();
      expect(errorCalls.some((c) => String(c).includes("[STEP:watchlist:FAIL:invalid-date]"))).toBe(true);
    });

    it("batch quote() が例外を投げた場合、writeFile を呼ばず [STEP:watchlist:FAIL:quote] を出力する", async () => {
      readFileMock.mockImplementation((path: string) => {
        const p = String(path);
        if (p.includes("meeting-result.json")) {
          return Promise.resolve(JSON.stringify(makeMeetingResult([makeHighlightedStock({ ticker: "MRNA" })])));
        }
        return Promise.reject(new Error("ENOENT"));
      });
      quoteMock.mockRejectedValue(new Error("network error"));

      const { main } = await import("./write-watchlist.js");
      await main();

      expect(writeFileMock).not.toHaveBeenCalled();
      const errorCalls = (console.error as ReturnType<typeof vi.fn>).mock.calls.flat();
      expect(errorCalls.some((c) => String(c).includes("[STEP:watchlist:FAIL:quote]"))).toBe(true);
    });

    it("正常系: 強気銘柄をwatchlistに登録し [STEP:watchlist:OK] と active/removed 件数ログを出力する", async () => {
      readFileMock.mockImplementation((path: string) => {
        const p = String(path);
        if (p.includes("meeting-result.json")) {
          return Promise.resolve(JSON.stringify(makeMeetingResult([makeHighlightedStock({ ticker: "MRNA" })])));
        }
        if (p.includes("watchlist.json")) return Promise.reject(new Error("ENOENT"));
        return Promise.reject(new Error("ENOENT"));
      });
      quoteMock.mockResolvedValue([{ symbol: "MRNA", quoteType: "EQUITY", longName: "Moderna, Inc." }]);

      const { main } = await import("./write-watchlist.js");
      await main();

      expect(writeFileMock).toHaveBeenCalledTimes(1);
      const [writtenPath, writtenContent] = writeFileMock.mock.calls[0];
      expect(String(writtenPath)).toContain("watchlist.json");
      const written = JSON.parse(String(writtenContent));
      expect(written.MRNA).toBeDefined();
      expect(written.MRNA.addedDate).toBe("2026-07-15");

      const errorCalls = (console.error as ReturnType<typeof vi.fn>).mock.calls.flat();
      expect(errorCalls.some((c) => String(c).includes("[STEP:watchlist:OK]"))).toBe(true);

      const logCalls = (console.log as ReturnType<typeof vi.fn>).mock.calls.flat();
      expect(logCalls.some((c) => String(c).includes("active=") && String(c).includes("removed="))).toBe(true);
    });

    it("prune が admit より先に適用され、purchased(保有済み)が当日強気より優先して除外される", async () => {
      const existingWatchlist = {
        MRNA: { ticker: "MRNA", addedDate: "2026-07-01", lastVerdictDate: "2026-07-01", history: [] },
      };
      readFileMock.mockImplementation((path: string) => {
        const p = String(path);
        if (p.includes("meeting-result.json")) {
          return Promise.resolve(JSON.stringify(makeMeetingResult([makeHighlightedStock({ ticker: "MRNA" })])));
        }
        if (p.includes("watchlist.json")) return Promise.resolve(JSON.stringify(existingWatchlist));
        return Promise.reject(new Error("ENOENT"));
      });
      quoteMock.mockResolvedValue([]);

      const { main } = await import("./write-watchlist.js");
      await main();

      expect(writeFileMock).toHaveBeenCalledTimes(1);
      const [, writtenContent] = writeFileMock.mock.calls[0];
      const written = JSON.parse(String(writtenContent));
      // MRNA is in PORTFOLIO_HOLDINGS -> purchased プルーンが適用され非アクティブ化される
      expect(written.MRNA.addedDate).toBeUndefined();
      expect(written.MRNA.history.at(-1).removedReason).toBe("purchased");
    });

    it("すべての FAIL 分岐で [PIPELINE:FAIL] マーカーが一度も出力されない", async () => {
      readFileMock.mockImplementation((path: string) => {
        const p = String(path);
        if (p.includes("watchlist.json")) return Promise.resolve("{not valid json");
        return Promise.reject(new Error("ENOENT"));
      });

      const { main } = await import("./write-watchlist.js");
      await main();

      const errorCalls = (console.error as ReturnType<typeof vi.fn>).mock.calls.flat();
      expect(errorCalls.some((c) => String(c).includes("[PIPELINE:FAIL]"))).toBe(false);
    });
  });
});

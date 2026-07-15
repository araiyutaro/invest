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

    it.each([
      ["null", "null"],
      ["配列", "[1,2]"],
      ["文字列", JSON.stringify("plain string")],
      ["数値", "42"],
    ])("JSONとしてvalidだが形状が不正（%s）の場合、corrupted:true で空のwatchlistを返す", async (_label, raw) => {
      readFileMock.mockResolvedValue(raw);

      const { loadExistingWatchlist } = await import("./write-watchlist.js");
      const result = await loadExistingWatchlist();

      expect(result).toEqual({ watchlist: {}, corrupted: true });
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
      // NVDA は PORTFOLIO_HOLDINGS に含まれない銘柄を使う（保有銘柄は WLST-03 の
      // holdings ゲートで admit されないため、新規登録の正常系には使えない）
      readFileMock.mockImplementation((path: string) => {
        const p = String(path);
        if (p.includes("meeting-result.json")) {
          return Promise.resolve(JSON.stringify(makeMeetingResult([makeHighlightedStock({ ticker: "NVDA" })])));
        }
        if (p.includes("watchlist.json")) return Promise.reject(new Error("ENOENT"));
        return Promise.reject(new Error("ENOENT"));
      });
      quoteMock.mockResolvedValue([{ symbol: "NVDA", quoteType: "EQUITY", longName: "NVIDIA Corporation" }]);

      const { main } = await import("./write-watchlist.js");
      await main();

      expect(writeFileMock).toHaveBeenCalledTimes(1);
      const [writtenPath, writtenContent] = writeFileMock.mock.calls[0];
      expect(String(writtenPath)).toContain("watchlist.json");
      const written = JSON.parse(String(writtenContent));
      expect(written.NVDA).toBeDefined();
      expect(written.NVDA.addedDate).toBe("2026-07-15");

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
      // MRNA is in PORTFOLIO_HOLDINGS -> purchased プルーンが適用され非アクティブ化される。
      // admit 側の holdings ゲート（WLST-03）により当日強気でも re-admit/reconfirm されず、
      // prune の結果が同一 run 内で打ち消されないことを検証する
      expect(written.MRNA.addedDate).toBeUndefined();
      expect(written.MRNA.lastVerdictDate).toBeUndefined();
      expect(written.MRNA.history.at(-1).removedReason).toBe("purchased");
    });

    it("既に active な非保有銘柄が当日も強気なら quote() を呼ばずに lastVerdictDate が更新される（reconfirm, WLST-01/D-22）", async () => {
      // NVDA は PORTFOLIO_HOLDINGS に含まれない。D-22 で active 銘柄は quote() 対象外のため、
      // lookup 欠落でも fail-closed に落ちず reconfirm されることを検証する（CR-01 回帰テスト）
      const existingWatchlist = {
        NVDA: { ticker: "NVDA", addedDate: "2026-07-01", lastVerdictDate: "2026-07-01", history: [] },
      };
      readFileMock.mockImplementation((path: string) => {
        const p = String(path);
        if (p.includes("meeting-result.json")) {
          return Promise.resolve(JSON.stringify(makeMeetingResult([makeHighlightedStock({ ticker: "NVDA" })])));
        }
        if (p.includes("watchlist.json")) return Promise.resolve(JSON.stringify(existingWatchlist));
        return Promise.reject(new Error("ENOENT"));
      });
      quoteMock.mockResolvedValue([]);

      const { main } = await import("./write-watchlist.js");
      await main();

      // active 銘柄のみ強気 -> 新規候補ゼロ -> quote() は呼ばれない（D-22 のレート制限回避を維持）
      expect(quoteMock).not.toHaveBeenCalled();
      expect(writeFileMock).toHaveBeenCalledTimes(1);
      const [, writtenContent] = writeFileMock.mock.calls[0];
      const written = JSON.parse(String(writtenContent));
      expect(written.NVDA.addedDate).toBe("2026-07-01");
      expect(written.NVDA.lastVerdictDate).toBe("2026-07-15");
    });

    it("watchlist.json の内容が null の場合、クラッシュせず [STEP:watchlist:FAIL:corrupted] で終了する", async () => {
      readFileMock.mockImplementation((path: string) => {
        const p = String(path);
        if (p.includes("watchlist.json")) return Promise.resolve("null");
        if (p.includes("meeting-result.json")) {
          return Promise.resolve(JSON.stringify(makeMeetingResult([makeHighlightedStock({ ticker: "NVDA" })])));
        }
        return Promise.reject(new Error("ENOENT"));
      });

      const { main } = await import("./write-watchlist.js");
      await main();

      expect(writeFileMock).not.toHaveBeenCalled();
      const errorCalls = (console.error as ReturnType<typeof vi.fn>).mock.calls.flat();
      expect(errorCalls.some((c) => String(c).includes("[STEP:watchlist:FAIL:corrupted]"))).toBe(true);
    });

    it("highlightedStocks に ticker を欠く不正要素が混在してもクラッシュせず有効要素のみ処理する", async () => {
      readFileMock.mockImplementation((path: string) => {
        const p = String(path);
        if (p.includes("meeting-result.json")) {
          const meeting = makeMeetingResult([makeHighlightedStock({ ticker: "NVDA" })]);
          const withMalformed = {
            ...meeting,
            highlightedStocks: [
              ...meeting.highlightedStocks,
              { verdict: "強気", summary: "ticker欠落の不正要素" },
            ],
          };
          return Promise.resolve(JSON.stringify(withMalformed));
        }
        if (p.includes("watchlist.json")) return Promise.reject(new Error("ENOENT"));
        return Promise.reject(new Error("ENOENT"));
      });
      quoteMock.mockResolvedValue([{ symbol: "NVDA", quoteType: "EQUITY", longName: "NVIDIA Corporation" }]);

      const { main } = await import("./write-watchlist.js");
      await main();

      expect(writeFileMock).toHaveBeenCalledTimes(1);
      const [, writtenContent] = writeFileMock.mock.calls[0];
      const written = JSON.parse(String(writtenContent));
      expect(written.NVDA).toBeDefined();
      const errorCalls = (console.error as ReturnType<typeof vi.fn>).mock.calls.flat();
      expect(errorCalls.some((c) => String(c).includes("[STEP:watchlist:OK]"))).toBe(true);
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

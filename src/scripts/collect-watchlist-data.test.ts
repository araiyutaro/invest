import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { chartMock, readFileMock, writeFileMock, mkdirMock } = vi.hoisted(() => ({
  chartMock: vi.fn(),
  readFileMock: vi.fn(),
  writeFileMock: vi.fn(),
  mkdirMock: vi.fn(),
}));

vi.mock("yahoo-finance2", () => ({
  default: vi.fn().mockImplementation(function YahooFinanceMock() {
    return { chart: chartMock };
  }),
}));

vi.mock("node:fs/promises", () => ({
  readFile: readFileMock,
  writeFile: writeFileMock,
  mkdir: mkdirMock,
}));

function makeWatchlistEntry(overrides: {
  ticker: string;
  name?: string;
  nameJa?: string;
  addedDate?: string;
}) {
  return {
    ticker: overrides.ticker,
    name: overrides.name,
    nameJa: overrides.nameJa,
    addedDate: overrides.addedDate ?? "2026-07-01",
    lastVerdictDate: "2026-07-14",
    history: [],
  };
}

function makeChartBars(count = 30) {
  const bars = [];
  const base = new Date("2026-06-01T00:00:00.000Z").getTime();
  for (let i = 0; i < count; i++) {
    bars.push({
      date: new Date(base + i * 86_400_000),
      close: 100 + i,
      volume: 1_000_000,
    });
  }
  return bars;
}

function makeCachedSnapshot(symbol: string) {
  return {
    symbol,
    asOf: "2026-07-14",
    price: 100,
    changePercent: null,
    ma20: null,
    ma50: null,
    ma200: null,
    pctFromMa50: null,
    pctFromMa200: null,
    rsi14: null,
    fiftyTwoWeekHigh: null,
    fiftyTwoWeekLow: null,
    pctFrom52wHigh: null,
    volumeRatio: null,
    trendLabel: "テスト",
  };
}

function mockReadFileByPath(handlers: Record<string, () => Promise<string>>) {
  readFileMock.mockImplementation((path: string) => {
    const p = String(path);
    for (const [key, handler] of Object.entries(handlers)) {
      if (p.includes(key)) return handler();
    }
    return Promise.reject(new Error("ENOENT"));
  });
}

describe("collect-watchlist-data", () => {
  beforeEach(() => {
    chartMock.mockReset();
    readFileMock.mockReset();
    writeFileMock.mockReset().mockResolvedValue(undefined);
    mkdirMock.mockReset().mockResolvedValue(undefined);
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("main() - empty watchlist (D-04)", () => {
    it("アクティブ0件の場合、両ファイルに空JSONを書き込み [STEP:watchlist-data:OK] を出力し [PIPELINE:FAIL] は出力しない", async () => {
      mockReadFileByPath({
        "watchlist.json": () => Promise.resolve(JSON.stringify({})),
      });

      const { main } = await import("./collect-watchlist-data.js");
      await main();

      const writeCalls = writeFileMock.mock.calls;
      const technicalsCall = writeCalls.find((c) => String(c[0]).includes("watchlist-technicals.json"));
      const newsCall = writeCalls.find((c) => String(c[0]).includes("watchlist-news.json"));
      expect(technicalsCall).toBeDefined();
      expect(newsCall).toBeDefined();
      expect(JSON.parse(String(technicalsCall![1]))).toEqual({
        generatedAt: expect.any(String),
        snapshots: [],
      });
      expect(JSON.parse(String(newsCall![1]))).toEqual({});

      const errorCalls = (console.error as ReturnType<typeof vi.fn>).mock.calls.flat();
      expect(errorCalls.some((c) => String(c).includes("[STEP:watchlist-data:OK]"))).toBe(true);
      expect(errorCalls.some((c) => String(c).includes("[PIPELINE:FAIL]"))).toBe(false);
    });

    it("watchlist.json が ENOENT の場合、空扱いの正常系として処理され FAIL マーカーは出力しない", async () => {
      readFileMock.mockRejectedValue(new Error("ENOENT"));

      const { main } = await import("./collect-watchlist-data.js");
      await main();

      const errorCalls = (console.error as ReturnType<typeof vi.fn>).mock.calls.flat();
      expect(errorCalls.some((c) => String(c).includes("[STEP:watchlist-data:OK]"))).toBe(true);
      expect(errorCalls.some((c) => String(c).includes("[STEP:watchlist-data:FAIL"))).toBe(false);
      expect(errorCalls.some((c) => String(c).includes("[PIPELINE:FAIL]"))).toBe(false);
    });
  });

  describe("main() - corrupted watchlist (D-19)", () => {
    it.each([
      ["null", "null"],
      ["配列", "[1,2]"],
      ["非JSON", "{not valid json"],
    ])("watchlist.json が破損（%s）の場合、[STEP:watchlist-data:FAIL:corrupted] を出力し両ファイルに空JSONを書き込む", async (_label, raw) => {
      mockReadFileByPath({
        "watchlist.json": () => Promise.resolve(raw),
      });

      const { main } = await import("./collect-watchlist-data.js");
      await main();

      const writeCalls = writeFileMock.mock.calls;
      const technicalsCall = writeCalls.find((c) => String(c[0]).includes("watchlist-technicals.json"));
      const newsCall = writeCalls.find((c) => String(c[0]).includes("watchlist-news.json"));
      expect(technicalsCall).toBeDefined();
      expect(newsCall).toBeDefined();
      expect(JSON.parse(String(technicalsCall![1]))).toEqual({
        generatedAt: expect.any(String),
        snapshots: [],
      });
      expect(JSON.parse(String(newsCall![1]))).toEqual({});

      const errorCalls = (console.error as ReturnType<typeof vi.fn>).mock.calls.flat();
      expect(errorCalls.some((c) => String(c).includes("[STEP:watchlist-data:FAIL:corrupted]"))).toBe(true);
      expect(errorCalls.some((c) => String(c).includes("[PIPELINE:FAIL]"))).toBe(false);

      // watchlist.json 自体には書き込まない
      const watchlistWriteCall = writeCalls.find((c) => String(c[0]).includes("data") && String(c[0]).includes("watchlist.json") && !String(c[0]).includes("watchlist-"));
      expect(watchlistWriteCall).toBeUndefined();
    });
  });

  describe("main() - STEP markers, all branches", () => {
    it("全 FAIL 分岐で [PIPELINE:FAIL] マーカーが一度も出力されない (STEP)", async () => {
      mockReadFileByPath({
        "watchlist.json": () => Promise.resolve("null"),
      });

      const { main } = await import("./collect-watchlist-data.js");
      await main();

      const errorCalls = (console.error as ReturnType<typeof vi.fn>).mock.calls.flat();
      expect(errorCalls.some((c) => String(c).includes("[PIPELINE:FAIL]"))).toBe(false);
    });
  });

  describe("main() - technical branch cache/chunk", () => {
    it("全銘柄キャッシュヒットの場合、chart が呼ばれず全 snapshot がコピーされる", async () => {
      const watchlist = {
        AAA: makeWatchlistEntry({ ticker: "AAA" }),
        BBB: makeWatchlistEntry({ ticker: "BBB" }),
      };
      const cachedSnapshot = (symbol: string) => ({
        symbol,
        asOf: "2026-07-14",
        price: 100,
        changePercent: null,
        ma20: null,
        ma50: null,
        ma200: null,
        pctFromMa50: null,
        pctFromMa200: null,
        rsi14: null,
        fiftyTwoWeekHigh: null,
        fiftyTwoWeekLow: null,
        pctFrom52wHigh: null,
        volumeRatio: null,
        trendLabel: "テスト",
      });
      mockReadFileByPath({
        "watchlist.json": () => Promise.resolve(JSON.stringify(watchlist)),
        "technicals.json": () =>
          Promise.resolve(
            JSON.stringify({
              generatedAt: new Date().toISOString(),
              snapshots: [cachedSnapshot("AAA"), cachedSnapshot("BBB")],
            }),
          ),
        "news.json": () => Promise.resolve("[]"),
      });

      const { main } = await import("./collect-watchlist-data.js");
      await main();

      expect(chartMock).not.toHaveBeenCalled();
      const writeCalls = writeFileMock.mock.calls;
      const technicalsCall = writeCalls.find((c) => String(c[0]).includes("watchlist-technicals.json"));
      const written = JSON.parse(String(technicalsCall![1]));
      expect(written.snapshots.map((s: { symbol: string }) => s.symbol).sort()).toEqual(["AAA", "BBB"]);
    });

    it("一部キャッシュヒット + 一部新規の場合、欠落分のみ chart が呼び出される", async () => {
      const watchlist = {
        AAA: makeWatchlistEntry({ ticker: "AAA" }),
        BBB: makeWatchlistEntry({ ticker: "BBB" }),
      };
      mockReadFileByPath({
        "watchlist.json": () => Promise.resolve(JSON.stringify(watchlist)),
        "technicals.json": () =>
          Promise.resolve(
            JSON.stringify({
              generatedAt: new Date().toISOString(),
              snapshots: [
                {
                  symbol: "AAA",
                  asOf: "2026-07-14",
                  price: 100,
                  changePercent: null,
                  ma20: null,
                  ma50: null,
                  ma200: null,
                  pctFromMa50: null,
                  pctFromMa200: null,
                  rsi14: null,
                  fiftyTwoWeekHigh: null,
                  fiftyTwoWeekLow: null,
                  pctFrom52wHigh: null,
                  volumeRatio: null,
                  trendLabel: "テスト",
                },
              ],
            }),
          ),
        "news.json": () => Promise.resolve("[]"),
      });
      chartMock.mockResolvedValue({ quotes: makeChartBars() });

      const { main } = await import("./collect-watchlist-data.js");
      await main();

      expect(chartMock).toHaveBeenCalledTimes(1);
      expect(chartMock).toHaveBeenCalledWith("BBB", expect.anything());
      const writeCalls = writeFileMock.mock.calls;
      const technicalsCall = writeCalls.find((c) => String(c[0]).includes("watchlist-technicals.json"));
      const written = JSON.parse(String(technicalsCall![1]));
      expect(written.snapshots.map((s: { symbol: string }) => s.symbol).sort()).toEqual(["AAA", "BBB"]);
    });

    it("fail-soft: 1銘柄で chart が reject しても、その銘柄は omit され他銘柄の snapshot は保持される", async () => {
      const watchlist = {
        AAA: makeWatchlistEntry({ ticker: "AAA" }),
        BBB: makeWatchlistEntry({ ticker: "BBB" }),
      };
      mockReadFileByPath({
        "watchlist.json": () => Promise.resolve(JSON.stringify(watchlist)),
        "news.json": () => Promise.resolve("[]"),
      });
      chartMock.mockImplementation((symbol: string) => {
        if (symbol === "AAA") return Promise.reject(new Error("network error"));
        return Promise.resolve({ quotes: makeChartBars() });
      });

      const { main } = await import("./collect-watchlist-data.js");
      await main();

      const writeCalls = writeFileMock.mock.calls;
      const technicalsCall = writeCalls.find((c) => String(c[0]).includes("watchlist-technicals.json"));
      const written = JSON.parse(String(technicalsCall![1]));
      expect(written.snapshots.map((s: { symbol: string }) => s.symbol)).toEqual(["BBB"]);

      const logCalls = (console.log as ReturnType<typeof vi.fn>).mock.calls.flat();
      expect(logCalls.some((c) => String(c).includes("⚠ 取得失敗") && String(c).includes("AAA"))).toBe(true);
    });

    it("キャッシュにウォッチリスト外銘柄が含まれる場合、その snapshot は出力に含まれない (CR-01)", async () => {
      const watchlist = {
        AAA: makeWatchlistEntry({ ticker: "AAA" }),
      };
      mockReadFileByPath({
        "watchlist.json": () => Promise.resolve(JSON.stringify(watchlist)),
        "technicals.json": () =>
          Promise.resolve(
            JSON.stringify({
              generatedAt: new Date().toISOString(),
              // ZZZ は Step 2b のモデレーター候補（ウォッチリスト外）を模擬
              snapshots: [makeCachedSnapshot("AAA"), makeCachedSnapshot("ZZZ")],
            }),
          ),
        "news.json": () => Promise.resolve("[]"),
      });

      const { main } = await import("./collect-watchlist-data.js");
      await main();

      expect(chartMock).not.toHaveBeenCalled();
      const writeCalls = writeFileMock.mock.calls;
      const technicalsCall = writeCalls.find((c) => String(c[0]).includes("watchlist-technicals.json"));
      const written = JSON.parse(String(technicalsCall![1]));
      expect(written.snapshots.map((s: { symbol: string }) => s.symbol)).toEqual(["AAA"]);
    });

    it("キャッシュに同一 symbol の重複要素がある場合、出力へ重複させない (CR-01)", async () => {
      const watchlist = {
        AAA: makeWatchlistEntry({ ticker: "AAA" }),
      };
      mockReadFileByPath({
        "watchlist.json": () => Promise.resolve(JSON.stringify(watchlist)),
        "technicals.json": () =>
          Promise.resolve(
            JSON.stringify({
              generatedAt: new Date().toISOString(),
              snapshots: [makeCachedSnapshot("AAA"), makeCachedSnapshot("AAA")],
            }),
          ),
        "news.json": () => Promise.resolve("[]"),
      });

      const { main } = await import("./collect-watchlist-data.js");
      await main();

      const writeCalls = writeFileMock.mock.calls;
      const technicalsCall = writeCalls.find((c) => String(c[0]).includes("watchlist-technicals.json"));
      const written = JSON.parse(String(technicalsCall![1]));
      expect(written.snapshots.map((s: { symbol: string }) => s.symbol)).toEqual(["AAA"]);
    });

    it("キャッシュの generatedAt が当日（JST）でない場合、キャッシュを無視して全銘柄新規取得する (WR-01)", async () => {
      const watchlist = {
        AAA: makeWatchlistEntry({ ticker: "AAA" }),
      };
      // 24時間前 = JST 暦日で必ず前日以前になる
      const staleGeneratedAt = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      mockReadFileByPath({
        "watchlist.json": () => Promise.resolve(JSON.stringify(watchlist)),
        "technicals.json": () =>
          Promise.resolve(
            JSON.stringify({
              generatedAt: staleGeneratedAt,
              snapshots: [makeCachedSnapshot("AAA")],
            }),
          ),
        "news.json": () => Promise.resolve("[]"),
      });
      chartMock.mockResolvedValue({ quotes: makeChartBars() });

      const { main } = await import("./collect-watchlist-data.js");
      await main();

      expect(chartMock).toHaveBeenCalledTimes(1);
      expect(chartMock).toHaveBeenCalledWith("AAA", expect.anything());
    });

    it("キャッシュの generatedAt が欠落・不正な場合もキャッシュを無視する (WR-01)", async () => {
      const watchlist = {
        AAA: makeWatchlistEntry({ ticker: "AAA" }),
      };
      mockReadFileByPath({
        "watchlist.json": () => Promise.resolve(JSON.stringify(watchlist)),
        "technicals.json": () =>
          Promise.resolve(
            JSON.stringify({
              snapshots: [makeCachedSnapshot("AAA")],
            }),
          ),
        "news.json": () => Promise.resolve("[]"),
      });
      chartMock.mockResolvedValue({ quotes: makeChartBars() });

      const { main } = await import("./collect-watchlist-data.js");
      await main();

      expect(chartMock).toHaveBeenCalledTimes(1);
      expect(chartMock).toHaveBeenCalledWith("AAA", expect.anything());
    });

    it("キャッシュ snapshots に不正要素（null・symbol欠落）が混入しても、正常な要素は活かされ不正要素のみ除外される (WR-02)", async () => {
      const watchlist = {
        AAA: makeWatchlistEntry({ ticker: "AAA" }),
      };
      mockReadFileByPath({
        "watchlist.json": () => Promise.resolve(JSON.stringify(watchlist)),
        "technicals.json": () =>
          Promise.resolve(
            JSON.stringify({
              generatedAt: new Date().toISOString(),
              snapshots: [null, { asOf: "2026-07-15" }, makeCachedSnapshot("AAA")],
            }),
          ),
        "news.json": () => Promise.resolve("[]"),
      });

      const { main } = await import("./collect-watchlist-data.js");
      await main();

      // 有効なキャッシュ要素（AAA）は活かされ、新規取得は発生しない
      expect(chartMock).not.toHaveBeenCalled();
      const writeCalls = writeFileMock.mock.calls;
      const technicalsCall = writeCalls.find((c) => String(c[0]).includes("watchlist-technicals.json"));
      const written = JSON.parse(String(technicalsCall![1]));
      expect(written.snapshots.map((s: { symbol: string }) => s.symbol)).toEqual(["AAA"]);
    });

    it("キャッシュ破損の場合、全銘柄新規取得にフォールバックする (D-12)", async () => {
      const watchlist = {
        AAA: makeWatchlistEntry({ ticker: "AAA" }),
      };
      mockReadFileByPath({
        "watchlist.json": () => Promise.resolve(JSON.stringify(watchlist)),
        "technicals.json": () => Promise.resolve("{not valid json"),
        "news.json": () => Promise.resolve("[]"),
      });
      chartMock.mockResolvedValue({ quotes: makeChartBars() });

      const { main } = await import("./collect-watchlist-data.js");
      await main();

      expect(chartMock).toHaveBeenCalledTimes(1);
      expect(chartMock).toHaveBeenCalledWith("AAA", expect.anything());
    });
  });

  describe("main() - news branch", () => {
    it("news.json 読込成功の場合、全アクティブ銘柄のキーが newsMap に存在する (news, D-18)", async () => {
      const watchlist = {
        AAA: makeWatchlistEntry({ ticker: "AAA", name: "Company AAA" }),
        BBB: makeWatchlistEntry({ ticker: "BBB", name: "Company BBB" }),
      };
      mockReadFileByPath({
        "watchlist.json": () => Promise.resolve(JSON.stringify(watchlist)),
        "technicals.json": () =>
          Promise.resolve(JSON.stringify({ generatedAt: new Date().toISOString(), snapshots: [] })),
        "news.json": () =>
          Promise.resolve(
            JSON.stringify([
              {
                id: "n01",
                title: "Company AAA reports earnings",
                source: "test",
                url: "https://example.com/1",
                publishedAt: "2026-07-15T00:00:00.000Z",
                ticker: "AAA",
              },
            ]),
          ),
      });
      chartMock.mockResolvedValue({ quotes: [] });

      const { main } = await import("./collect-watchlist-data.js");
      await main();

      const writeCalls = writeFileMock.mock.calls;
      const newsCall = writeCalls.find((c) => String(c[0]).includes("watchlist-news.json"));
      const written = JSON.parse(String(newsCall![1]));
      expect(Object.keys(written).sort()).toEqual(["AAA", "BBB"]);
      expect(written.AAA.length).toBeGreaterThan(0);
      expect(written.BBB).toEqual([]);
    });

    it("news.json 欠損の場合、newsMap は全銘柄空配列だが watchlist-technicals.json は正常に snapshot を持つ（2ブランチ独立, D-20）", async () => {
      const watchlist = {
        AAA: makeWatchlistEntry({ ticker: "AAA" }),
      };
      mockReadFileByPath({
        "watchlist.json": () => Promise.resolve(JSON.stringify(watchlist)),
      });
      chartMock.mockResolvedValue({ quotes: makeChartBars() });

      const { main } = await import("./collect-watchlist-data.js");
      await main();

      const writeCalls = writeFileMock.mock.calls;
      const technicalsCall = writeCalls.find((c) => String(c[0]).includes("watchlist-technicals.json"));
      const newsCall = writeCalls.find((c) => String(c[0]).includes("watchlist-news.json"));

      const writtenTechnicals = JSON.parse(String(technicalsCall![1]));
      expect(writtenTechnicals.snapshots.length).toBe(1);
      expect(writtenTechnicals.snapshots[0].symbol).toBe("AAA");

      const writtenNews = JSON.parse(String(newsCall![1]));
      expect(writtenNews).toEqual({ AAA: [] });
    });
  });
});

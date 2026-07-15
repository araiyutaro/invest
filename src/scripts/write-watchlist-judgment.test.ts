import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { readFileMock, writeFileMock, mkdirMock, readdirMock } = vi.hoisted(() => ({
  readFileMock: vi.fn(),
  writeFileMock: vi.fn(),
  mkdirMock: vi.fn(),
  readdirMock: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  readFile: readFileMock,
  writeFile: writeFileMock,
  mkdir: mkdirMock,
  readdir: readdirMock,
}));

function makeMeetingResult(date = "2026-07-15") {
  return { date, generatedAt: `${date}T00:00:00.000Z` };
}

function makeTechnicalsFile(snapshots: ReadonlyArray<{ symbol: string; asOf: string }>) {
  return {
    generatedAt: "2026-07-15T00:00:00.000Z",
    snapshots: snapshots.map((s) => ({
      symbol: s.symbol,
      asOf: s.asOf,
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
    })),
  };
}

function makeRawJudgment(overrides: {
  ticker: string;
  todayAction?: "buy" | "wait";
  signals?: string[];
  market?: string;
  asOf?: string;
}) {
  return {
    ticker: overrides.ticker,
    todayAction: overrides.todayAction ?? "wait",
    rationale: "テスト理由",
    signals: overrides.signals ?? [],
    // market/asOf are LLM-hallucinated fields here to verify they are never echoed
    ...(overrides.market !== undefined ? { market: overrides.market } : {}),
    ...(overrides.asOf !== undefined ? { asOf: overrides.asOf } : {}),
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

describe("write-watchlist-judgment", () => {
  beforeEach(() => {
    readFileMock.mockReset();
    writeFileMock.mockReset().mockResolvedValue(undefined);
    mkdirMock.mockReset().mockResolvedValue(undefined);
    readdirMock.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("loadPrevJudgmentDefensive", () => {
    it("ENOENT（プレーンError、.codeなし）の場合、corrupted:falseでprev:nullを返す（Pitfall 1回帰防止）", async () => {
      readFileMock.mockRejectedValue(new Error("ENOENT"));

      const { loadPrevJudgmentDefensive } = await import("./write-watchlist-judgment.js");
      const result = await loadPrevJudgmentDefensive();

      expect(result).toEqual({ prev: null, corrupted: false });
    });

    it("破損したJSONの場合、corrupted:trueでprev:nullを返す", async () => {
      readFileMock.mockResolvedValue("{not valid json");

      const { loadPrevJudgmentDefensive } = await import("./write-watchlist-judgment.js");
      const result = await loadPrevJudgmentDefensive();

      expect(result).toEqual({ prev: null, corrupted: true });
    });

    it.each([
      ["null", "null"],
      ["配列", "[1,2]"],
      ["文字列", JSON.stringify("plain string")],
    ])("JSONとしてvalidだが形状が不正（%s）の場合、corrupted:trueでprev:nullを返す", async (_label, raw) => {
      readFileMock.mockResolvedValue(raw);

      const { loadPrevJudgmentDefensive } = await import("./write-watchlist-judgment.js");
      const result = await loadPrevJudgmentDefensive();

      expect(result).toEqual({ prev: null, corrupted: true });
    });

    it.each([
      ["judgmentsが非配列（文字列）", JSON.stringify({ date: "2026-07-14", judgments: "oops" })],
      ["judgments要素がnull", JSON.stringify({ date: "2026-07-14", judgments: [null] })],
      ["judgments要素のtickerが非文字列", JSON.stringify({ date: "2026-07-14", judgments: [{ ticker: 123 }] })],
    ])(
      "judgmentsフィールドの形状が不正（%s）の場合、corrupted:trueでprev:nullを返しthrowしない（CR-01回帰防止）",
      async (_label, raw) => {
        readFileMock.mockResolvedValue(raw);

        const { loadPrevJudgmentDefensive } = await import("./write-watchlist-judgment.js");
        const result = await loadPrevJudgmentDefensive();

        expect(result).toEqual({ prev: null, corrupted: true });
      },
    );

    it("prevが破損（judgments:[null]）でも当日判定は破棄されず出力される（CR-01: 全損経路の統合回帰防止）", async () => {
      mockReadFileByPath({
        "meeting-result.json": () => Promise.resolve(JSON.stringify(makeMeetingResult())),
        "watchlist-technicals.json": () =>
          Promise.resolve(JSON.stringify(makeTechnicalsFile([{ symbol: "MRNA", asOf: "2026-07-15" }]))),
        "prev-watchlist-judgment.json": () =>
          Promise.resolve(JSON.stringify({ date: "2026-07-14", judgments: [null] })),
        "MRNA.json": () =>
          Promise.resolve(
            JSON.stringify(makeRawJudgment({ ticker: "MRNA", todayAction: "wait", signals: [] })),
          ),
      });
      readdirMock.mockResolvedValue(["MRNA.json"]);

      const { main } = await import("./write-watchlist-judgment.js");
      await expect(main()).resolves.not.toThrow();

      const [, writtenContent] = writeFileMock.mock.calls[0];
      const written = JSON.parse(String(writtenContent));
      const mrna = written.judgments.find((j: { ticker: string }) => j.ticker === "MRNA");
      expect(mrna).toBeDefined();
      expect(mrna).not.toHaveProperty("previousAction");
    });

    it("正常なJSONの場合、パースされたprevをcorrupted:falseで返す", async () => {
      const prevFile = {
        date: "2026-07-14",
        generatedAt: "2026-07-14T00:00:00.000Z",
        judgments: [{ ticker: "MRNA", todayAction: "wait", rationale: "前日理由", signals: [] }],
      };
      readFileMock.mockResolvedValue(JSON.stringify(prevFile));

      const { loadPrevJudgmentDefensive } = await import("./write-watchlist-judgment.js");
      const result = await loadPrevJudgmentDefensive();

      expect(result).toEqual({ prev: prevFile, corrupted: false });
    });
  });

  describe("main()", () => {
    it("アクティブ0件（raw ディレクトリ空）の場合、空judgments + [STEP:watchlist-judgment:OK] を出力する（D-19）", async () => {
      mockReadFileByPath({
        "meeting-result.json": () => Promise.resolve(JSON.stringify(makeMeetingResult())),
      });
      readdirMock.mockResolvedValue([]);

      const { main } = await import("./write-watchlist-judgment.js");
      await main();

      expect(writeFileMock).toHaveBeenCalledTimes(1);
      const [writtenPath, writtenContent] = writeFileMock.mock.calls[0];
      expect(String(writtenPath)).toContain("watchlist-judgment.json");
      const written = JSON.parse(String(writtenContent));
      expect(written.judgments).toEqual([]);

      const errorCalls = (console.error as ReturnType<typeof vi.fn>).mock.calls.flat();
      expect(errorCalls.some((c) => String(c).includes("[STEP:watchlist-judgment:OK]"))).toBe(true);
    });

    it("meeting-result.json 読込に失敗した場合、空出力+FAILマーカーで throw せず終了する", async () => {
      readFileMock.mockRejectedValue(new Error("ENOENT"));
      readdirMock.mockResolvedValue([]);

      const { main } = await import("./write-watchlist-judgment.js");
      await expect(main()).resolves.not.toThrow();

      expect(writeFileMock).toHaveBeenCalledTimes(1);
      const [, writtenContent] = writeFileMock.mock.calls[0];
      const written = JSON.parse(String(writtenContent));
      expect(written.judgments).toEqual([]);

      const errorCalls = (console.error as ReturnType<typeof vi.fn>).mock.calls.flat();
      expect(
        errorCalls.some((c) => String(c).includes("[STEP:watchlist-judgment:FAIL:meeting-result読込失敗]")),
      ).toBe(true);
    });

    it("部分失敗: 3銘柄中1銘柄のrawが不正JSONでも残り2銘柄は判定されthrowしない（D-18）", async () => {
      mockReadFileByPath({
        "meeting-result.json": () => Promise.resolve(JSON.stringify(makeMeetingResult())),
        "watchlist-technicals.json": () =>
          Promise.resolve(
            JSON.stringify(
              makeTechnicalsFile([
                { symbol: "AAA", asOf: "2026-07-15" },
                { symbol: "BBB", asOf: "2026-07-15" },
                { symbol: "CCC", asOf: "2026-07-15" },
              ]),
            ),
          ),
        "AAA.json": () =>
          Promise.resolve(
            JSON.stringify(makeRawJudgment({ ticker: "AAA", todayAction: "wait", signals: [] })),
          ),
        "BBB.json": () => Promise.resolve("{not valid json"),
        "CCC.json": () =>
          Promise.resolve(
            JSON.stringify(makeRawJudgment({ ticker: "CCC", todayAction: "wait", signals: [] })),
          ),
      });
      readdirMock.mockResolvedValue(["AAA.json", "BBB.json", "CCC.json"]);

      const { main } = await import("./write-watchlist-judgment.js");
      await expect(main()).resolves.not.toThrow();

      expect(writeFileMock).toHaveBeenCalledTimes(1);
      const [, writtenContent] = writeFileMock.mock.calls[0];
      const written = JSON.parse(String(writtenContent));
      const tickers = written.judgments.map((j: { ticker: string }) => j.ticker);
      expect(tickers).toContain("AAA");
      expect(tickers).toContain("CCC");
      expect(tickers).not.toContain("BBB");

      const errorCalls = (console.error as ReturnType<typeof vi.fn>).mock.calls.flat();
      expect(
        errorCalls.some(
          (c) => String(c).includes("[STEP:watchlist-judgment:FAIL:") && String(c).includes("1/3銘柄失敗"),
        ),
      ).toBe(true);
    });

    it("confluence降格の統合: buy+signals1件のrawが最終出力でwaitに降格する（D-07のCLI経路統合）", async () => {
      mockReadFileByPath({
        "meeting-result.json": () => Promise.resolve(JSON.stringify(makeMeetingResult())),
        "watchlist-technicals.json": () =>
          Promise.resolve(JSON.stringify(makeTechnicalsFile([{ symbol: "MRNA", asOf: "2026-07-15" }]))),
        "MRNA.json": () =>
          Promise.resolve(
            JSON.stringify(
              makeRawJudgment({ ticker: "MRNA", todayAction: "buy", signals: ["RSI oversold"] }),
            ),
          ),
      });
      readdirMock.mockResolvedValue(["MRNA.json"]);

      const { main } = await import("./write-watchlist-judgment.js");
      await main();

      const [, writtenContent] = writeFileMock.mock.calls[0];
      const written = JSON.parse(String(writtenContent));
      const mrna = written.judgments.find((j: { ticker: string }) => j.ticker === "MRNA");
      expect(mrna.todayAction).toBe("wait");
    });

    it("skip記録: technicalsにスナップショットが無い銘柄はstatus:skippedとして最終judgmentsに含まれる（D-20）", async () => {
      mockReadFileByPath({
        "meeting-result.json": () => Promise.resolve(JSON.stringify(makeMeetingResult())),
        "watchlist-technicals.json": () => Promise.resolve(JSON.stringify(makeTechnicalsFile([]))),
      });
      // raw dir 内にファイルは無いが watchlist は NVDA を持つ想定のケースは
      // このCLIの入力契約上、technicals にスナップショットが無い銘柄は raw も生成されない
      // （オーケストレータがactive銘柄一覧をtechnicalsから導出するため）。
      // ここでは raw に存在するが technicals に無いケースとして直接検証する。
      readdirMock.mockResolvedValue(["NVDA.json"]);
      readFileMock.mockImplementation((path: string) => {
        const p = String(path);
        if (p.includes("meeting-result.json")) return Promise.resolve(JSON.stringify(makeMeetingResult()));
        if (p.includes("watchlist-technicals.json"))
          return Promise.resolve(JSON.stringify(makeTechnicalsFile([])));
        if (p.includes("NVDA.json"))
          return Promise.resolve(
            JSON.stringify(makeRawJudgment({ ticker: "NVDA", todayAction: "wait", signals: [] })),
          );
        return Promise.reject(new Error("ENOENT"));
      });

      const { main } = await import("./write-watchlist-judgment.js");
      await main();

      const [, writtenContent] = writeFileMock.mock.calls[0];
      const written = JSON.parse(String(writtenContent));
      const nvda = written.judgments.find((j: { ticker: string }) => j.ticker === "NVDA");
      expect(nvda.status).toBe("skipped");
    });

    it("market/asOf決定論付与: rawがmarket誤申告してもderiveMarket由来・technicals由来のasOfが採用される（D-08/D-15）", async () => {
      mockReadFileByPath({
        "meeting-result.json": () => Promise.resolve(JSON.stringify(makeMeetingResult())),
        "watchlist-technicals.json": () =>
          Promise.resolve(JSON.stringify(makeTechnicalsFile([{ symbol: "MRNA", asOf: "2026-07-14" }]))),
        "MRNA.json": () =>
          Promise.resolve(
            JSON.stringify(
              makeRawJudgment({
                ticker: "MRNA",
                todayAction: "wait",
                signals: [],
                market: "JP",
                asOf: "2099-01-01",
              }),
            ),
          ),
      });
      readdirMock.mockResolvedValue(["MRNA.json"]);

      const { main } = await import("./write-watchlist-judgment.js");
      await main();

      const [, writtenContent] = writeFileMock.mock.calls[0];
      const written = JSON.parse(String(writtenContent));
      const mrna = written.judgments.find((j: { ticker: string }) => j.ticker === "MRNA");
      expect(mrna.market).toBe("US");
      expect(mrna.asOf).toBe("2026-07-14");
    });

    it("同日再実行ガード: loadPrevJudgmentDefensiveが前日judgmentsを正しく読み込みattachActionChangesに反映される（TIME-03c）", async () => {
      const prevFile = {
        date: "2026-07-14",
        generatedAt: "2026-07-14T00:00:00.000Z",
        judgments: [{ ticker: "MRNA", todayAction: "buy", rationale: "前日理由", signals: ["a", "b"] }],
      };
      mockReadFileByPath({
        "meeting-result.json": () => Promise.resolve(JSON.stringify(makeMeetingResult())),
        "watchlist-technicals.json": () =>
          Promise.resolve(JSON.stringify(makeTechnicalsFile([{ symbol: "MRNA", asOf: "2026-07-15" }]))),
        "prev-watchlist-judgment.json": () => Promise.resolve(JSON.stringify(prevFile)),
        "MRNA.json": () =>
          Promise.resolve(
            JSON.stringify(makeRawJudgment({ ticker: "MRNA", todayAction: "wait", signals: [] })),
          ),
      });
      readdirMock.mockResolvedValue(["MRNA.json"]);

      const { main } = await import("./write-watchlist-judgment.js");
      await main();

      const [, writtenContent] = writeFileMock.mock.calls[0];
      const written = JSON.parse(String(writtenContent));
      const mrna = written.judgments.find((j: { ticker: string }) => j.ticker === "MRNA");
      expect(mrna.previousAction).toBe("buy");
      expect(mrna.actionChanged).toBe(true);
    });

    it("すべての分岐で [PIPELINE:FAIL] マーカーが一度も出力されない", async () => {
      readFileMock.mockRejectedValue(new Error("破損"));
      readdirMock.mockRejectedValue(new Error("ENOENT"));

      const { main } = await import("./write-watchlist-judgment.js");
      await expect(main()).resolves.not.toThrow();

      const errorCalls = (console.error as ReturnType<typeof vi.fn>).mock.calls.flat();
      expect(errorCalls.some((c) => String(c).includes("[PIPELINE:FAIL]"))).toBe(false);
    });
  });
});

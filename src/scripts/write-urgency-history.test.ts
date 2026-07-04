import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn().mockRejectedValue(new Error("ENOENT")),
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

const validMeetingResultJson = JSON.stringify({ date: "2026-07-04" });
const invalidDateMeetingResultJson = JSON.stringify({ date: "2026-7-4" });

const makeHolding = (index: number) => ({
  symbol: `SYM${index}`,
  nameJa: `テスト銘柄${index}`,
  decision: "保持",
  rationale: "デフォルト理由",
  urgent: index % 2 === 0,
});

const validPortfolioAnalysisJson = JSON.stringify({
  date: "2026-07-04",
  generatedAt: "2026-07-04T00:00:00.000Z",
  overallComment: "テスト",
  holdings: Array.from({ length: 12 }, (_, i) => makeHolding(i + 1)),
  rebalanceActions: [],
});

const emptyHoldingsPortfolioAnalysisJson = JSON.stringify({
  date: "2026-07-04",
  generatedAt: "2026-07-04T00:00:00.000Z",
  overallComment: "テスト",
  holdings: [],
  rebalanceActions: [],
});

const oldSnapshot = { symbol: "OLD", nameJa: "旧銘柄", urgent: true, decision: "全売却" };
const existingHistoryWithSameDateJson = JSON.stringify({ "2026-07-04": [oldSnapshot] });
const corruptedHistoryJson = "{not valid json";

describe("write-urgency-history main()", () => {
  beforeEach(async () => {
    const fsMock = await import("node:fs/promises");
    (fsMock.writeFile as ReturnType<typeof vi.fn>).mockClear();
    (fsMock.mkdir as ReturnType<typeof vi.fn>).mockClear();
    (fsMock.readFile as ReturnType<typeof vi.fn>).mockClear();
    vi.spyOn(process, "exit").mockImplementation((() => {}) as never);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("Test 1: 正常系 -- 有効な portfolio-analysis.json + meeting-result.json から data/urgency-history.json を書き出す", async () => {
    const fsMock = await import("node:fs/promises");
    (fsMock.readFile as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
      const p = String(path);
      if (p.includes("meeting-result.json")) return Promise.resolve(validMeetingResultJson);
      if (p.includes("portfolio-analysis.json")) return Promise.resolve(validPortfolioAnalysisJson);
      if (p.includes("urgency-history.json")) return Promise.reject(new Error("ENOENT"));
      return Promise.reject(new Error("ENOENT"));
    });

    const { main } = await import("./write-urgency-history.js");
    await main();

    const writeCalls = (fsMock.writeFile as ReturnType<typeof vi.fn>).mock.calls;
    const historyCall = writeCalls.find((call) => String(call[0]).includes("urgency-history.json"));
    expect(historyCall).toBeDefined();
    const written = JSON.parse(String(historyCall![1])) as Record<string, unknown[]>;
    expect(written["2026-07-04"]).toBeDefined();
    expect(written["2026-07-04"]).toHaveLength(12);
    expect(process.exit).not.toHaveBeenCalledWith(1);
  });

  it("Test 2: 同日上書き -- 既存 history に同じ dateKey がある場合、新しいスナップショットのみが残る（重複しない）", async () => {
    const fsMock = await import("node:fs/promises");
    (fsMock.readFile as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
      const p = String(path);
      if (p.includes("meeting-result.json")) return Promise.resolve(validMeetingResultJson);
      if (p.includes("portfolio-analysis.json")) return Promise.resolve(validPortfolioAnalysisJson);
      if (p.includes("urgency-history.json")) return Promise.resolve(existingHistoryWithSameDateJson);
      return Promise.reject(new Error("ENOENT"));
    });

    const { main } = await import("./write-urgency-history.js");
    await main();

    const writeCalls = (fsMock.writeFile as ReturnType<typeof vi.fn>).mock.calls;
    const historyCall = writeCalls.find((call) => String(call[0]).includes("urgency-history.json"));
    expect(historyCall).toBeDefined();
    const written = JSON.parse(String(historyCall![1])) as Record<string, unknown[]>;
    expect(Object.keys(written)).toEqual(["2026-07-04"]);
    expect(written["2026-07-04"]).toHaveLength(12);
    expect(written["2026-07-04"]).not.toContainEqual(oldSnapshot);
    expect(process.exit).not.toHaveBeenCalledWith(1);
  });

  it("Test 3: skip(D-13) -- portfolio-analysis.json が欠損(ENOENT)している場合、書き込みをスキップし exit 0", async () => {
    const fsMock = await import("node:fs/promises");
    (fsMock.readFile as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
      const p = String(path);
      if (p.includes("meeting-result.json")) return Promise.resolve(validMeetingResultJson);
      if (p.includes("portfolio-analysis.json")) return Promise.reject(new Error("ENOENT"));
      if (p.includes("urgency-history.json")) return Promise.reject(new Error("ENOENT"));
      return Promise.reject(new Error("ENOENT"));
    });

    const { main } = await import("./write-urgency-history.js");
    await main();

    const writeCalls = (fsMock.writeFile as ReturnType<typeof vi.fn>).mock.calls;
    const historyCall = writeCalls.find((call) => String(call[0]).includes("urgency-history.json"));
    expect(historyCall).toBeUndefined();
    expect(process.exit).not.toHaveBeenCalledWith(1);
  });

  it("Test 4: skip(D-13) -- holdings が0件の場合、書き込みをスキップし exit 0", async () => {
    const fsMock = await import("node:fs/promises");
    (fsMock.readFile as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
      const p = String(path);
      if (p.includes("meeting-result.json")) return Promise.resolve(validMeetingResultJson);
      if (p.includes("portfolio-analysis.json")) return Promise.resolve(emptyHoldingsPortfolioAnalysisJson);
      if (p.includes("urgency-history.json")) return Promise.reject(new Error("ENOENT"));
      return Promise.reject(new Error("ENOENT"));
    });

    const { main } = await import("./write-urgency-history.js");
    await main();

    const writeCalls = (fsMock.writeFile as ReturnType<typeof vi.fn>).mock.calls;
    const historyCall = writeCalls.find((call) => String(call[0]).includes("urgency-history.json"));
    expect(historyCall).toBeUndefined();
    expect(process.exit).not.toHaveBeenCalledWith(1);
  });

  it("Test 5: corrupted(D-14) -- 既存 data/urgency-history.json が破損している場合、上書きせず exit 1", async () => {
    const fsMock = await import("node:fs/promises");
    (fsMock.readFile as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
      const p = String(path);
      if (p.includes("meeting-result.json")) return Promise.resolve(validMeetingResultJson);
      if (p.includes("portfolio-analysis.json")) return Promise.resolve(validPortfolioAnalysisJson);
      if (p.includes("urgency-history.json")) return Promise.resolve(corruptedHistoryJson);
      return Promise.reject(new Error("ENOENT"));
    });

    const { main } = await import("./write-urgency-history.js");
    await main();

    const writeCalls = (fsMock.writeFile as ReturnType<typeof vi.fn>).mock.calls;
    const historyCall = writeCalls.find((call) => String(call[0]).includes("urgency-history.json"));
    expect(historyCall).toBeUndefined();
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it("Test 6: 不正なdate(D-06) -- meeting-result.json の date が不正な形式の場合、書き込みをせず exit 1", async () => {
    const fsMock = await import("node:fs/promises");
    (fsMock.readFile as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
      const p = String(path);
      if (p.includes("meeting-result.json")) return Promise.resolve(invalidDateMeetingResultJson);
      if (p.includes("portfolio-analysis.json")) return Promise.resolve(validPortfolioAnalysisJson);
      if (p.includes("urgency-history.json")) return Promise.reject(new Error("ENOENT"));
      return Promise.reject(new Error("ENOENT"));
    });

    const { main } = await import("./write-urgency-history.js");
    await main();

    const writeCalls = (fsMock.writeFile as ReturnType<typeof vi.fn>).mock.calls;
    const historyCall = writeCalls.find((call) => String(call[0]).includes("urgency-history.json"));
    expect(historyCall).toBeUndefined();
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it("Test 7: mkdir(DATA_DIR) は失敗/スキップ分岐より前に必ず呼ばれる", async () => {
    const fsMock = await import("node:fs/promises");
    (fsMock.readFile as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
      const p = String(path);
      if (p.includes("meeting-result.json")) return Promise.resolve(validMeetingResultJson);
      if (p.includes("portfolio-analysis.json")) return Promise.resolve(validPortfolioAnalysisJson);
      if (p.includes("urgency-history.json")) return Promise.resolve(corruptedHistoryJson);
      return Promise.reject(new Error("ENOENT"));
    });

    const { main } = await import("./write-urgency-history.js");
    await main();

    const mkdirCalls = (fsMock.mkdir as ReturnType<typeof vi.fn>).mock.calls;
    expect(mkdirCalls.length).toBeGreaterThan(0);
    expect(String(mkdirCalls[0][0])).toContain("data");
    expect(mkdirCalls[0][1]).toEqual({ recursive: true });
  });
});

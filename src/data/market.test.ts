import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { chartMock, quoteMock } = vi.hoisted(() => ({
  chartMock: vi.fn(),
  quoteMock: vi.fn(),
}));

vi.mock("yahoo-finance2", () => ({
  default: vi.fn().mockImplementation(function YahooFinanceMock() {
    return { chart: chartMock, quote: quoteMock };
  }),
}));

describe("fetchVixHistory (UI-02 / D-06/D-07/D-08)", () => {
  beforeEach(() => {
    chartMock.mockReset();
    quoteMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("chart()の結果を{date, close}にマッピングし、close=nullのエントリを除外する", async () => {
    chartMock.mockResolvedValue({
      meta: {},
      quotes: [
        { date: new Date("2026-06-01T13:30:00Z"), close: 18.2 },
        { date: new Date("2026-06-02T13:30:00Z"), close: null },
      ],
    });

    const { fetchVixHistory } = await import("./market.js");
    const result = await fetchVixHistory();

    expect(result).toEqual([{ date: "2026-06-01", close: 18.2 }]);
  });

  it("date は YYYY-MM-DD 形式（10文字、時刻部分なし）である", async () => {
    chartMock.mockResolvedValue({
      meta: {},
      quotes: [{ date: new Date("2026-06-15T09:00:00Z"), close: 20.5 }],
    });

    const { fetchVixHistory } = await import("./market.js");
    const [point] = await fetchVixHistory();

    expect(point.date).toHaveLength(10);
    expect(point.date).not.toContain("T");
  });

  it("chart()がrejectした場合はthrowせず[]を返す", async () => {
    chartMock.mockRejectedValue(new Error("Yahoo Finance API error"));

    const { fetchVixHistory } = await import("./market.js");

    await expect(fetchVixHistory()).resolves.toEqual([]);
  });
});

describe("fetchAllMarketData vixHistory (UI-02)", () => {
  beforeEach(() => {
    chartMock.mockReset();
    quoteMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("解決したオブジェクトが indices, sectors, vixHistory キーを持つ", async () => {
    quoteMock.mockResolvedValue({
      regularMarketPrice: 100,
      regularMarketChange: 1,
      regularMarketChangePercent: 1,
    });
    chartMock.mockResolvedValue({
      meta: {},
      quotes: [{ date: new Date("2026-06-01T00:00:00Z"), close: 18.2 }],
    });

    const { fetchAllMarketData } = await import("./market.js");
    const result = await fetchAllMarketData();

    expect(Object.keys(result)).toEqual(
      expect.arrayContaining(["indices", "sectors", "vixHistory"]),
    );
    expect(result.vixHistory).toEqual([{ date: "2026-06-01", close: 18.2 }]);
  });
});

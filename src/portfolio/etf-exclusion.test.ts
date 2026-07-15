import { describe, it, expect } from "vitest";
import { filterEtfStocks, type QuoteTypeLookup } from "./etf-exclusion.js";
import type { MeetingResult } from "../meeting/types.js";

const makeHighlightedStock = (
  overrides: Partial<MeetingResult["highlightedStocks"][number]>,
): MeetingResult["highlightedStocks"][number] => ({
  ticker: "TEST",
  averageScore: 50,
  verdict: "中立",
  summary: "デフォルト要約",
  agentScores: [],
  nominatedBy: [],
  ...overrides,
});

const makeQuoteLookup = (overrides: Partial<QuoteTypeLookup>): QuoteTypeLookup =>
  ({
    status: "ok",
    quoteType: "EQUITY",
    ...overrides,
  }) as QuoteTypeLookup;

describe("filterEtfStocks (D-01/D-04)", () => {
  it("米国ETF（SPY: quoteType=ETF）は excluded に入り reason='etf' quoteType='ETF' を持つ（D-04）", () => {
    const stocks = [makeHighlightedStock({ ticker: "SPY" })];
    const quoteTypeByTicker = new Map<string, QuoteTypeLookup>([
      ["SPY", makeQuoteLookup({ quoteType: "ETF" })],
    ]);
    const result = filterEtfStocks(stocks, quoteTypeByTicker);
    expect(result.kept).toEqual([]);
    expect(result.excluded).toEqual([
      { ticker: "SPY", reason: "etf", quoteType: "ETF" },
    ]);
  });

  it("日本ETF（1306.T: quoteType=ETF）は excluded に入り、日本個別株（7203.T: quoteType=EQUITY）は kept に残る（.T サフィックス非依存, D-04）", () => {
    const stocks = [
      makeHighlightedStock({ ticker: "1306.T" }),
      makeHighlightedStock({ ticker: "7203.T" }),
    ];
    const quoteTypeByTicker = new Map<string, QuoteTypeLookup>([
      ["1306.T", makeQuoteLookup({ quoteType: "ETF" })],
      ["7203.T", makeQuoteLookup({ quoteType: "EQUITY" })],
    ]);
    const result = filterEtfStocks(stocks, quoteTypeByTicker);
    expect(result.kept.map((s) => s.ticker)).toEqual(["7203.T"]);
    expect(result.excluded).toEqual([
      { ticker: "1306.T", reason: "etf", quoteType: "ETF" },
    ]);
  });

  it("米国個別株（AAPL: quoteType=EQUITY）は kept に残り excluded に入らない", () => {
    const stocks = [makeHighlightedStock({ ticker: "AAPL" })];
    const quoteTypeByTicker = new Map<string, QuoteTypeLookup>([
      ["AAPL", makeQuoteLookup({ quoteType: "EQUITY" })],
    ]);
    const result = filterEtfStocks(stocks, quoteTypeByTicker);
    expect(result.kept.map((s) => s.ticker)).toEqual(["AAPL"]);
    expect(result.excluded).toEqual([]);
  });

  it("日本個別株（7203.T: quoteType=EQUITY）は kept に残る", () => {
    const stocks = [makeHighlightedStock({ ticker: "7203.T" })];
    const quoteTypeByTicker = new Map<string, QuoteTypeLookup>([
      ["7203.T", makeQuoteLookup({ quoteType: "EQUITY" })],
    ]);
    const result = filterEtfStocks(stocks, quoteTypeByTicker);
    expect(result.kept.map((s) => s.ticker)).toEqual(["7203.T"]);
    expect(result.excluded).toEqual([]);
  });

  it("quoteTypeByTicker に該当エントリが無い銘柄は excluded に入り reason='lookup-failed' を持つ（fail-closed, D-01）", () => {
    const stocks = [makeHighlightedStock({ ticker: "XYZ" })];
    const quoteTypeByTicker = new Map<string, QuoteTypeLookup>();
    const result = filterEtfStocks(stocks, quoteTypeByTicker);
    expect(result.kept).toEqual([]);
    expect(result.excluded).toEqual([{ ticker: "XYZ", reason: "lookup-failed" }]);
  });

  it("status:'failed' の lookup を持つ銘柄も excluded reason='lookup-failed'（fail-closed, D-01）", () => {
    const stocks = [makeHighlightedStock({ ticker: "XYZ" })];
    const quoteTypeByTicker = new Map<string, QuoteTypeLookup>([
      ["XYZ", { status: "failed" }],
    ]);
    const result = filterEtfStocks(stocks, quoteTypeByTicker);
    expect(result.kept).toEqual([]);
    expect(result.excluded).toEqual([{ ticker: "XYZ", reason: "lookup-failed" }]);
  });

  it("quoteType が MUTUALFUND / INDEX の銘柄はすべて excluded reason='etf'（非EQUITY allowlist, D-04）", () => {
    const stocks = [
      makeHighlightedStock({ ticker: "FUND1" }),
      makeHighlightedStock({ ticker: "IDX1" }),
    ];
    const quoteTypeByTicker = new Map<string, QuoteTypeLookup>([
      ["FUND1", makeQuoteLookup({ quoteType: "MUTUALFUND" })],
      ["IDX1", makeQuoteLookup({ quoteType: "INDEX" })],
    ]);
    const result = filterEtfStocks(stocks, quoteTypeByTicker);
    expect(result.kept).toEqual([]);
    expect(result.excluded).toEqual([
      { ticker: "FUND1", reason: "etf", quoteType: "MUTUALFUND" },
      { ticker: "IDX1", reason: "etf", quoteType: "INDEX" },
    ]);
  });

  it("呼び出し後、入力 stocks 配列が不変（イミュータビリティ）", () => {
    const stocks = [
      makeHighlightedStock({ ticker: "SPY" }),
      makeHighlightedStock({ ticker: "AAPL" }),
    ];
    const originalStocks = [...stocks];
    const quoteTypeByTicker = new Map<string, QuoteTypeLookup>([
      ["SPY", makeQuoteLookup({ quoteType: "ETF" })],
      ["AAPL", makeQuoteLookup({ quoteType: "EQUITY" })],
    ]);
    filterEtfStocks(stocks, quoteTypeByTicker);
    expect(stocks).toEqual(originalStocks);
  });

  it("EQUITY + ETF + lookup失敗を混ぜた入力で kept が EQUITY のみ・excluded が正しい reason 分けになる（混在ケース）", () => {
    const stocks = [
      makeHighlightedStock({ ticker: "AAPL" }),
      makeHighlightedStock({ ticker: "SPY" }),
      makeHighlightedStock({ ticker: "UNKNOWN" }),
    ];
    const quoteTypeByTicker = new Map<string, QuoteTypeLookup>([
      ["AAPL", makeQuoteLookup({ quoteType: "EQUITY" })],
      ["SPY", makeQuoteLookup({ quoteType: "ETF" })],
    ]);
    const result = filterEtfStocks(stocks, quoteTypeByTicker);
    expect(result.kept.map((s) => s.ticker)).toEqual(["AAPL"]);
    expect(result.excluded).toEqual([
      { ticker: "SPY", reason: "etf", quoteType: "ETF" },
      { ticker: "UNKNOWN", reason: "lookup-failed" },
    ]);
  });
});

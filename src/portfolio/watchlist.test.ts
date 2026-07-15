import { describe, it, expect } from "vitest";
import {
  isActive,
  getActiveWatchlistEntries,
  admitBullishStocks,
  EXPIRY_CALENDAR_DAYS,
  type WatchlistEntry,
  type WatchlistFile,
} from "./watchlist.js";
import type { QuoteTypeLookup } from "./etf-exclusion.js";
import type { MeetingResult } from "../meeting/types.js";

const makeWatchlistEntry = (
  overrides: Partial<WatchlistEntry>,
): WatchlistEntry => ({
  ticker: "TEST",
  history: [],
  ...overrides,
});

const makeHighlightedStock = (
  overrides: Partial<MeetingResult["highlightedStocks"][number]>,
): MeetingResult["highlightedStocks"][number] => ({
  ticker: "TEST",
  averageScore: 50,
  verdict: "強気",
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

describe("isActive (D-06)", () => {
  it("addedDate が設定されているエントリは active と判定する", () => {
    const entry = makeWatchlistEntry({ addedDate: "2026-07-15", lastVerdictDate: "2026-07-15" });
    expect(isActive(entry)).toBe(true);
  });

  it("addedDate が undefined（除外済み・history のみ）のエントリは active ではないと判定する", () => {
    const entry = makeWatchlistEntry({
      addedDate: undefined,
      history: [
        {
          addedDate: "2026-06-01",
          lastVerdictDate: "2026-06-10",
          removedReason: "downgraded",
          removedDate: "2026-06-11",
        },
      ],
    });
    expect(isActive(entry)).toBe(false);
  });
});

describe("getActiveWatchlistEntries (D-06)", () => {
  it("active なエントリのみを配列で返す（除外済みエントリは含まない）", () => {
    const watchlist: WatchlistFile = {
      AAPL: makeWatchlistEntry({ ticker: "AAPL", addedDate: "2026-07-15", lastVerdictDate: "2026-07-15" }),
      MRNA: makeWatchlistEntry({
        ticker: "MRNA",
        addedDate: undefined,
        history: [
          {
            addedDate: "2026-06-01",
            lastVerdictDate: "2026-06-10",
            removedReason: "purchased",
            removedDate: "2026-06-11",
          },
        ],
      }),
    };
    const result = getActiveWatchlistEntries(watchlist);
    expect(result.map((e) => e.ticker)).toEqual(["AAPL"]);
  });

  it("watchlist が空オブジェクトなら空配列を返す", () => {
    expect(getActiveWatchlistEntries({})).toEqual([]);
  });
});

describe("EXPIRY_CALENDAR_DAYS (D-08/D-09)", () => {
  it("30 という named constant である", () => {
    expect(EXPIRY_CALENDAR_DAYS).toBe(30);
  });
});

describe("admitBullishStocks (WLST-01)", () => {
  it("新規の強気銘柄は addedDate=today, lastVerdictDate=today で active エントリとして登録される", () => {
    const watchlist: WatchlistFile = {};
    const bullish = [makeHighlightedStock({ ticker: "AAPL" })];
    const quoteTypeByTicker = new Map<string, QuoteTypeLookup>([
      ["AAPL", makeQuoteLookup({ quoteType: "EQUITY" })],
    ]);
    const nameByTicker = new Map([["AAPL", { name: "Apple Inc.", nameJa: "アップル" }]]);
    const result = admitBullishStocks(watchlist, bullish, quoteTypeByTicker, nameByTicker, "2026-07-15");
    expect(result.AAPL).toEqual({
      ticker: "AAPL",
      name: "Apple Inc.",
      nameJa: "アップル",
      addedDate: "2026-07-15",
      lastVerdictDate: "2026-07-15",
      history: [],
    });
  });

  it("既にアクティブな銘柄が当日再度強気なら lastVerdictDate が today に更新され addedDate は初回値を保持する（reconfirm）", () => {
    const watchlist: WatchlistFile = {
      AAPL: makeWatchlistEntry({ ticker: "AAPL", addedDate: "2026-07-01", lastVerdictDate: "2026-07-10" }),
    };
    const bullish = [makeHighlightedStock({ ticker: "AAPL" })];
    const quoteTypeByTicker = new Map<string, QuoteTypeLookup>([
      ["AAPL", makeQuoteLookup({ quoteType: "EQUITY" })],
    ]);
    const nameByTicker = new Map<string, { name?: string; nameJa?: string }>();
    const result = admitBullishStocks(watchlist, bullish, quoteTypeByTicker, nameByTicker, "2026-07-15");
    expect(result.AAPL.addedDate).toBe("2026-07-01");
    expect(result.AAPL.lastVerdictDate).toBe("2026-07-15");
  });

  it("同日2回 admit を呼んでも結果が同一である（冪等, D-17）", () => {
    const watchlist: WatchlistFile = {};
    const bullish = [makeHighlightedStock({ ticker: "AAPL" })];
    const quoteTypeByTicker = new Map<string, QuoteTypeLookup>([
      ["AAPL", makeQuoteLookup({ quoteType: "EQUITY" })],
    ]);
    const nameByTicker = new Map<string, { name?: string; nameJa?: string }>();
    const once = admitBullishStocks(watchlist, bullish, quoteTypeByTicker, nameByTicker, "2026-07-15");
    const twice = admitBullishStocks(once, bullish, quoteTypeByTicker, nameByTicker, "2026-07-15");
    expect(twice).toEqual(once);
  });

  it("ETF候補（quoteType!=='EQUITY'）は第2ゲートで拒否され active に登録されない（D-21）", () => {
    const watchlist: WatchlistFile = {};
    const bullish = [makeHighlightedStock({ ticker: "SPY" })];
    const quoteTypeByTicker = new Map<string, QuoteTypeLookup>([
      ["SPY", makeQuoteLookup({ quoteType: "ETF" })],
    ]);
    const nameByTicker = new Map<string, { name?: string; nameJa?: string }>();
    const result = admitBullishStocks(watchlist, bullish, quoteTypeByTicker, nameByTicker, "2026-07-15");
    expect(result.SPY).toBeUndefined();
  });

  it("lookup 失敗の候補は fail-closed で除外される（D-21/D-22）", () => {
    const watchlist: WatchlistFile = {};
    const bullish = [makeHighlightedStock({ ticker: "XYZ" })];
    const quoteTypeByTicker = new Map<string, QuoteTypeLookup>();
    const nameByTicker = new Map<string, { name?: string; nameJa?: string }>();
    const result = admitBullishStocks(watchlist, bullish, quoteTypeByTicker, nameByTicker, "2026-07-15");
    expect(result.XYZ).toBeUndefined();
  });

  it("除外済み（history あり・addedDate なし）の ticker が再度強気なら history を保持したまま新 active エピソードを作る（re-admission, D-05）", () => {
    const watchlist: WatchlistFile = {
      AAPL: makeWatchlistEntry({
        ticker: "AAPL",
        addedDate: undefined,
        lastVerdictDate: undefined,
        history: [
          {
            addedDate: "2026-05-01",
            lastVerdictDate: "2026-05-20",
            removedReason: "downgraded",
            removedDate: "2026-05-21",
          },
        ],
      }),
    };
    const bullish = [makeHighlightedStock({ ticker: "AAPL" })];
    const quoteTypeByTicker = new Map<string, QuoteTypeLookup>([
      ["AAPL", makeQuoteLookup({ quoteType: "EQUITY" })],
    ]);
    const nameByTicker = new Map<string, { name?: string; nameJa?: string }>();
    const result = admitBullishStocks(watchlist, bullish, quoteTypeByTicker, nameByTicker, "2026-07-15");
    expect(result.AAPL.addedDate).toBe("2026-07-15");
    expect(result.AAPL.lastVerdictDate).toBe("2026-07-15");
    expect(result.AAPL.history).toEqual([
      {
        addedDate: "2026-05-01",
        lastVerdictDate: "2026-05-20",
        removedReason: "downgraded",
        removedDate: "2026-05-21",
      },
    ]);
  });
});

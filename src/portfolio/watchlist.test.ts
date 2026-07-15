import { describe, it, expect } from "vitest";
import {
  isActive,
  getActiveWatchlistEntries,
  admitBullishStocks,
  pruneWatchlist,
  EXPIRY_CALENDAR_DAYS,
  type WatchlistEntry,
  type WatchlistFile,
} from "./watchlist.js";
import type { QuoteTypeLookup } from "./etf-exclusion.js";
import type { MeetingResult } from "../meeting/types.js";
import type { PortfolioHolding } from "./holdings.js";

const makeHolding = (overrides: Partial<PortfolioHolding>): PortfolioHolding => ({
  symbol: "TEST",
  name: "Test Co.",
  nameJa: "テスト社",
  sector: "Technology",
  ...overrides,
});

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
    const result = admitBullishStocks(watchlist, bullish, quoteTypeByTicker, nameByTicker, [], "2026-07-15");
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
    const result = admitBullishStocks(watchlist, bullish, quoteTypeByTicker, nameByTicker, [], "2026-07-15");
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
    const once = admitBullishStocks(watchlist, bullish, quoteTypeByTicker, nameByTicker, [], "2026-07-15");
    const twice = admitBullishStocks(once, bullish, quoteTypeByTicker, nameByTicker, [], "2026-07-15");
    expect(twice).toEqual(once);
  });

  it("ETF候補（quoteType!=='EQUITY'）は第2ゲートで拒否され active に登録されない（D-21）", () => {
    const watchlist: WatchlistFile = {};
    const bullish = [makeHighlightedStock({ ticker: "SPY" })];
    const quoteTypeByTicker = new Map<string, QuoteTypeLookup>([
      ["SPY", makeQuoteLookup({ quoteType: "ETF" })],
    ]);
    const nameByTicker = new Map<string, { name?: string; nameJa?: string }>();
    const result = admitBullishStocks(watchlist, bullish, quoteTypeByTicker, nameByTicker, [], "2026-07-15");
    expect(result.SPY).toBeUndefined();
  });

  it("lookup 失敗の候補は fail-closed で除外される（D-21/D-22）", () => {
    const watchlist: WatchlistFile = {};
    const bullish = [makeHighlightedStock({ ticker: "XYZ" })];
    const quoteTypeByTicker = new Map<string, QuoteTypeLookup>();
    const nameByTicker = new Map<string, { name?: string; nameJa?: string }>();
    const result = admitBullishStocks(watchlist, bullish, quoteTypeByTicker, nameByTicker, [], "2026-07-15");
    expect(result.XYZ).toBeUndefined();
  });

  it("既に active な銘柄は quoteType lookup が無くても reconfirm される（第2ゲートバイパス, D-22/WLST-01 回帰）", () => {
    // CLI は D-22 で active 銘柄を quote() 対象から除外するため、lookup 欠落状態で
    // reconfirm できなければ lastVerdictDate が凍結し 31 日目に誤 expired する（CR-01 回帰テスト）
    const watchlist: WatchlistFile = {
      AAPL: makeWatchlistEntry({ ticker: "AAPL", addedDate: "2026-07-01", lastVerdictDate: "2026-07-10" }),
    };
    const bullish = [makeHighlightedStock({ ticker: "AAPL" })];
    const quoteTypeByTicker = new Map<string, QuoteTypeLookup>(); // active 銘柄は quote 対象外
    const nameByTicker = new Map<string, { name?: string; nameJa?: string }>();
    const result = admitBullishStocks(watchlist, bullish, quoteTypeByTicker, nameByTicker, [], "2026-07-15");
    expect(result.AAPL.addedDate).toBe("2026-07-01");
    expect(result.AAPL.lastVerdictDate).toBe("2026-07-15");
  });

  it("PORTFOLIO_HOLDINGS に含まれる銘柄は強気でも admit されない（WLST-03 の holdings ゲート）", () => {
    const watchlist: WatchlistFile = {};
    const bullish = [makeHighlightedStock({ ticker: "MRNA" })];
    const quoteTypeByTicker = new Map<string, QuoteTypeLookup>([
      ["MRNA", makeQuoteLookup({ quoteType: "EQUITY" })],
    ]);
    const nameByTicker = new Map<string, { name?: string; nameJa?: string }>();
    const holdings = [makeHolding({ symbol: "MRNA" })];
    const result = admitBullishStocks(watchlist, bullish, quoteTypeByTicker, nameByTicker, holdings, "2026-07-15");
    expect(result.MRNA).toBeUndefined();
  });

  it("保有銘柄が active 状態でも reconfirm されない（prune の purchased 除外が admit で打ち消されない）", () => {
    const watchlist: WatchlistFile = {
      MRNA: makeWatchlistEntry({ ticker: "MRNA", addedDate: "2026-07-01", lastVerdictDate: "2026-07-10" }),
    };
    const bullish = [makeHighlightedStock({ ticker: "MRNA" })];
    const quoteTypeByTicker = new Map<string, QuoteTypeLookup>();
    const nameByTicker = new Map<string, { name?: string; nameJa?: string }>();
    const holdings = [makeHolding({ symbol: "MRNA" })];
    const result = admitBullishStocks(watchlist, bullish, quoteTypeByTicker, nameByTicker, holdings, "2026-07-15");
    // reconfirm パスに乗らず lastVerdictDate は据え置き（prune 側で purchased 除外される前提）
    expect(result.MRNA.lastVerdictDate).toBe("2026-07-10");
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
    const result = admitBullishStocks(watchlist, bullish, quoteTypeByTicker, nameByTicker, [], "2026-07-15");
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

describe("pruneWatchlist (WLST-02/03/04/05)", () => {
  it("active 銘柄が当日 verdict=中立 で登場したら removedReason=downgraded で除外される（WLST-02）", () => {
    const watchlist: WatchlistFile = {
      AAPL: makeWatchlistEntry({ ticker: "AAPL", addedDate: "2026-07-01", lastVerdictDate: "2026-07-10" }),
    };
    const todaysHighlighted = [makeHighlightedStock({ ticker: "AAPL", verdict: "中立" })];
    const result = pruneWatchlist(watchlist, todaysHighlighted, [], "2026-07-15");
    expect(result.AAPL.addedDate).toBeUndefined();
    expect(result.AAPL.lastVerdictDate).toBeUndefined();
    expect(result.AAPL.history).toEqual([
      {
        addedDate: "2026-07-01",
        lastVerdictDate: "2026-07-10",
        removedReason: "downgraded",
        removedDate: "2026-07-15",
      },
    ]);
  });

  it("active 銘柄が当日 verdict=弱気 で登場したら removedReason=downgraded で除外される（WLST-02）", () => {
    const watchlist: WatchlistFile = {
      AAPL: makeWatchlistEntry({ ticker: "AAPL", addedDate: "2026-07-01", lastVerdictDate: "2026-07-10" }),
    };
    const todaysHighlighted = [makeHighlightedStock({ ticker: "AAPL", verdict: "弱気" })];
    const result = pruneWatchlist(watchlist, todaysHighlighted, [], "2026-07-15");
    expect(result.AAPL.history[0]?.removedReason).toBe("downgraded");
  });

  it("当日 highlightedStocks に一切登場しない active 銘柄は現状維持（lastVerdictDate 不変, D-11）", () => {
    const watchlist: WatchlistFile = {
      AAPL: makeWatchlistEntry({ ticker: "AAPL", addedDate: "2026-07-01", lastVerdictDate: "2026-07-10" }),
    };
    const result = pruneWatchlist(watchlist, [], [], "2026-07-15");
    expect(result.AAPL.addedDate).toBe("2026-07-01");
    expect(result.AAPL.lastVerdictDate).toBe("2026-07-10");
    expect(result.AAPL.history).toEqual([]);
  });

  it("active 銘柄が PORTFOLIO_HOLDINGS の symbol に一致すれば removedReason=purchased で除外される（WLST-03/D-12）", () => {
    const watchlist: WatchlistFile = {
      AAPL: makeWatchlistEntry({ ticker: "AAPL", addedDate: "2026-07-01", lastVerdictDate: "2026-07-10" }),
    };
    const holdings = [makeHolding({ symbol: "AAPL" })];
    const result = pruneWatchlist(watchlist, [], holdings, "2026-07-15");
    expect(result.AAPL.addedDate).toBeUndefined();
    expect(result.AAPL.history[0]?.removedReason).toBe("purchased");
  });

  it("lastVerdictDate から経過日数がちょうど EXPIRY_CALENDAR_DAYS のときは失効しない（境界, D-08）", () => {
    const watchlist: WatchlistFile = {
      AAPL: makeWatchlistEntry({ ticker: "AAPL", addedDate: "2026-06-01", lastVerdictDate: "2026-06-15" }),
    };
    // 2026-06-15 + 30日 = 2026-07-15
    const result = pruneWatchlist(watchlist, [], [], "2026-07-15");
    expect(result.AAPL.addedDate).toBe("2026-06-01");
    expect(isActive(result.AAPL)).toBe(true);
  });

  it("lastVerdictDate から経過日数が EXPIRY_CALENDAR_DAYS+1 のときは removedReason=expired で失効する（境界, D-08）", () => {
    const watchlist: WatchlistFile = {
      AAPL: makeWatchlistEntry({ ticker: "AAPL", addedDate: "2026-06-01", lastVerdictDate: "2026-06-14" }),
    };
    // 2026-06-14 + 31日 = 2026-07-15
    const result = pruneWatchlist(watchlist, [], [], "2026-07-15");
    expect(result.AAPL.addedDate).toBeUndefined();
    expect(result.AAPL.history[0]?.removedReason).toBe("expired");
  });

  it("除外後も removedReason/removedDate が history に保持され、レコード自体は削除されない（WLST-05/D-05）", () => {
    const watchlist: WatchlistFile = {
      AAPL: makeWatchlistEntry({ ticker: "AAPL", addedDate: "2026-07-01", lastVerdictDate: "2026-07-10" }),
    };
    const holdings = [makeHolding({ symbol: "AAPL" })];
    const result = pruneWatchlist(watchlist, [], holdings, "2026-07-15");
    expect(result.AAPL).toBeDefined();
    expect(result.AAPL.ticker).toBe("AAPL");
    expect(result.AAPL.history).toHaveLength(1);
    expect(result.AAPL.history[0]?.removedDate).toBe("2026-07-15");
  });

  it("同一銘柄が purchased かつ downgraded に該当するとき purchased が優先される（precedence, Pitfall 3）", () => {
    const watchlist: WatchlistFile = {
      AAPL: makeWatchlistEntry({ ticker: "AAPL", addedDate: "2026-07-01", lastVerdictDate: "2026-07-10" }),
    };
    const todaysHighlighted = [makeHighlightedStock({ ticker: "AAPL", verdict: "弱気" })];
    const holdings = [makeHolding({ symbol: "AAPL" })];
    const result = pruneWatchlist(watchlist, todaysHighlighted, holdings, "2026-07-15");
    expect(result.AAPL.history[0]?.removedReason).toBe("purchased");
  });

  it("既に除外済み（非 active）のエントリはそのまま保持され、二重に history 追記されない", () => {
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
    const holdings = [makeHolding({ symbol: "AAPL" })];
    const result = pruneWatchlist(watchlist, [], holdings, "2026-07-15");
    expect(result.AAPL.history).toHaveLength(1);
  });
});

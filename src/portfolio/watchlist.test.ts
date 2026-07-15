import { describe, it, expect } from "vitest";
import {
  isActive,
  getActiveWatchlistEntries,
  EXPIRY_CALENDAR_DAYS,
  type WatchlistEntry,
  type WatchlistFile,
} from "./watchlist.js";

const makeWatchlistEntry = (
  overrides: Partial<WatchlistEntry>,
): WatchlistEntry => ({
  ticker: "TEST",
  history: [],
  ...overrides,
});

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

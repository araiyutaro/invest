import { describe, it, expect } from "vitest";
import { toPortfolioHoldingShape, mergeWithCache } from "./watchlist-data.js";
import type { WatchlistEntry } from "./watchlist.js";
import type { TechnicalSnapshot } from "../data/technicals.js";

function makeWatchlistEntry(overrides: Partial<WatchlistEntry> & { ticker: string }): WatchlistEntry {
  return {
    ticker: overrides.ticker,
    name: overrides.name,
    nameJa: overrides.nameJa,
    addedDate: overrides.addedDate ?? "2026-07-01",
    lastVerdictDate: overrides.lastVerdictDate ?? "2026-07-01",
    history: overrides.history ?? [],
  };
}

function makeTechnicalSnapshot(symbol: string): TechnicalSnapshot {
  return {
    symbol,
    asOf: "2026-07-15",
    price: 100,
    changePercent: 1.0,
    ma20: 99,
    ma50: 98,
    ma200: 95,
    pctFromMa50: 2.0,
    pctFromMa200: 5.0,
    rsi14: 55,
    fiftyTwoWeekHigh: 120,
    fiftyTwoWeekLow: 80,
    pctFrom52wHigh: -16.6,
    volumeRatio: 1.1,
    trendLabel: "上昇トレンド（50日線・200日線の上）",
  };
}

describe("toPortfolioHoldingShape", () => {
  it("name を持つエントリは name をそのまま採用する", () => {
    const entries = [makeWatchlistEntry({ ticker: "MRNA", name: "Moderna" })];

    const result = toPortfolioHoldingShape(entries);

    expect(result[0].name).toBe("Moderna");
  });

  it("name が undefined のエントリは ticker を name にフォールバックする", () => {
    const entries = [makeWatchlistEntry({ ticker: "MRNA" })];

    const result = toPortfolioHoldingShape(entries);

    expect(result[0].name).toBe("MRNA");
  });

  it("nameJa が undefined のエントリは nameJa=\"\" になる", () => {
    const entries = [makeWatchlistEntry({ ticker: "MRNA" })];

    const result = toPortfolioHoldingShape(entries);

    expect(result[0].nameJa).toBe("");
  });

  it("sector は常に \"\" 固定", () => {
    const entries = [makeWatchlistEntry({ ticker: "MRNA", name: "Moderna" })];

    const result = toPortfolioHoldingShape(entries);

    expect(result[0].sector).toBe("");
  });

  it("matchAliases はマップ結果に含めない（undefined のまま）", () => {
    const entries = [makeWatchlistEntry({ ticker: "MRNA" })];

    const result = toPortfolioHoldingShape(entries);

    expect(result[0].matchAliases).toBeUndefined();
  });

  it("空配列入力は空配列を返す（throw しない）", () => {
    expect(() => toPortfolioHoldingShape([])).not.toThrow();
    expect(toPortfolioHoldingShape([])).toEqual([]);
  });

  it("入力 entries を mutate しない", () => {
    const entries = [makeWatchlistEntry({ ticker: "MRNA", name: "Moderna" })];
    const snapshot = JSON.parse(JSON.stringify(entries));

    toPortfolioHoldingShape(entries);

    expect(entries).toEqual(snapshot);
  });
});

describe("mergeWithCache", () => {
  it("キャッシュに存在する ticker は missingTickers に含まれない", () => {
    const activeTickers = ["MRNA", "JOBY"];
    const cached = [makeTechnicalSnapshot("MRNA")];

    const result = mergeWithCache(activeTickers, cached);

    expect(result.missingTickers).not.toContain("MRNA");
  });

  it("キャッシュに存在しない ticker のみ missingTickers に含まれる", () => {
    const activeTickers = ["MRNA", "JOBY"];
    const cached = [makeTechnicalSnapshot("MRNA")];

    const result = mergeWithCache(activeTickers, cached);

    expect(result.missingTickers).toEqual(["JOBY"]);
  });

  it("全 ticker がキャッシュヒットなら missingTickers は空配列", () => {
    const activeTickers = ["MRNA", "JOBY"];
    const cached = [makeTechnicalSnapshot("MRNA"), makeTechnicalSnapshot("JOBY")];

    const result = mergeWithCache(activeTickers, cached);

    expect(result.missingTickers).toEqual([]);
  });

  it("キャッシュが空配列なら全 ticker が missingTickers になる", () => {
    const activeTickers = ["MRNA", "JOBY"];
    const cached: ReadonlyArray<TechnicalSnapshot> = [];

    const result = mergeWithCache(activeTickers, cached);

    expect(result.missingTickers).toEqual(["MRNA", "JOBY"]);
  });

  it("cachedTickers は cached snapshots の symbol 集合と一致する", () => {
    const activeTickers = ["MRNA", "JOBY"];
    const cached = [makeTechnicalSnapshot("MRNA")];

    const result = mergeWithCache(activeTickers, cached);

    expect(result.cachedTickers).toEqual(new Set(["MRNA"]));
  });
});

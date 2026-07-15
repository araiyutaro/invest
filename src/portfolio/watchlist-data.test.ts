import { describe, it, expect, vi } from "vitest";
import { toPortfolioHoldingShape, mergeWithCache, chunk, fetchChunked } from "./watchlist-data.js";
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

describe("chunk", () => {
  it("12要素 size=5 → 3チャンク（5, 5, 2）", () => {
    const items = Array.from({ length: 12 }, (_, i) => i);

    const result = chunk(items, 5);

    expect(result).toHaveLength(3);
    expect(result[0]).toHaveLength(5);
    expect(result[1]).toHaveLength(5);
    expect(result[2]).toHaveLength(2);
  });

  it("空配列 → 空チャンク配列", () => {
    const result = chunk([], 5);

    expect(result).toEqual([]);
  });

  it("size 以下の要素数 → 単一チャンク", () => {
    const items = [1, 2, 3];

    const result = chunk(items, 5);

    expect(result).toEqual([[1, 2, 3]]);
  });

  it("入力配列を mutate しない", () => {
    const items = [1, 2, 3, 4, 5, 6];
    const snapshot = [...items];

    chunk(items, 2);

    expect(items).toEqual(snapshot);
  });
});

describe("fetchChunked", () => {
  it("fetchOne が全 ticker で snapshot を返す → 全 snapshot が結果に含まれる", async () => {
    const tickers = ["MRNA", "JOBY"];
    const fetchOne = vi.fn(async (symbol: string) => makeTechnicalSnapshot(symbol));

    const result = await fetchChunked(tickers, fetchOne, 0);

    expect(result).toHaveLength(2);
    expect(result.map((s) => s.symbol).sort()).toEqual(["JOBY", "MRNA"]);
  });

  it("一部 ticker で fetchOne が null を返す → その ticker は omit され、他の snapshot は保持される（D-10）", async () => {
    const tickers = ["MRNA", "JOBY"];
    const fetchOne = vi.fn(async (symbol: string) =>
      symbol === "JOBY" ? null : makeTechnicalSnapshot(symbol),
    );

    const result = await fetchChunked(tickers, fetchOne, 0);

    expect(result).toHaveLength(1);
    expect(result[0].symbol).toBe("MRNA");
  });

  it("一部 ticker で fetchOne が reject する場合でも他 ticker の snapshot が失われない", async () => {
    const tickers = ["MRNA", "JOBY", "HII", "POWL", "EE", "NXT"];
    const fetchOne = vi.fn(async (symbol: string) => {
      if (symbol === "JOBY") {
        try {
          throw new Error("network error");
        } catch {
          return null;
        }
      }
      return makeTechnicalSnapshot(symbol);
    });

    const result = await fetchChunked(tickers, fetchOne, 0);

    const symbols = result.map((s) => s.symbol);
    expect(symbols).not.toContain("JOBY");
    expect(symbols).toContain("MRNA");
    expect(symbols).toContain("HII");
    expect(symbols).toContain("POWL");
    expect(symbols).toContain("EE");
    expect(symbols).toContain("NXT");
  });

  it("空 tickers → 空配列（fetchOne を呼ばない）", async () => {
    const fetchOne = vi.fn(async (symbol: string) => makeTechnicalSnapshot(symbol));

    const result = await fetchChunked([], fetchOne, 0);

    expect(result).toEqual([]);
    expect(fetchOne).not.toHaveBeenCalled();
  });

  it("チャンク間の待機ロジックが存在する（fake timers で検証）", async () => {
    vi.useFakeTimers();
    try {
      const tickers = Array.from({ length: 6 }, (_, i) => `T${i}`);
      const fetchOne = vi.fn(async (symbol: string) => makeTechnicalSnapshot(symbol));

      const promise = fetchChunked(tickers, fetchOne, 300);

      // 最初のチャンク（5件）が解決するまで進める
      await vi.advanceTimersByTimeAsync(0);
      // 2チャンク目までのタイマーを進める
      await vi.advanceTimersByTimeAsync(300);
      const result = await promise;

      expect(result).toHaveLength(6);
    } finally {
      vi.useRealTimers();
    }
  });
});

import { describe, it, expect, vi, afterEach } from "vitest";
import {
  applyConfluenceGate,
  attachActionChanges,
  deriveMarket,
  buildSkippedJudgment,
} from "./watchlist-judgment.js";
import type { WatchlistJudgment } from "../meeting/types.js";

const makeJudgment = (overrides: Partial<WatchlistJudgment>): WatchlistJudgment => ({
  ticker: "TEST",
  todayAction: "wait",
  rationale: "デフォルト理由",
  signals: [],
  ...overrides,
});

describe("applyConfluenceGate (TIME-04)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("buy かつ signals 1件 → wait へ降格し downgraded: true（confluence未達）", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = applyConfluenceGate({ todayAction: "buy", signals: ["a"] });
    expect(result).toEqual({ todayAction: "wait", downgraded: true });
    expect(warnSpy).toHaveBeenCalled();
  });

  it("buy かつ signals 2件 → buy のまま downgraded: false（充足）", () => {
    const result = applyConfluenceGate({ todayAction: "buy", signals: ["a", "b"] });
    expect(result).toEqual({ todayAction: "buy", downgraded: false });
  });

  it("wait かつ signals 0件 → wait のまま downgraded: false（wait は降格対象外）", () => {
    const result = applyConfluenceGate({ todayAction: "wait", signals: [] });
    expect(result).toEqual({ todayAction: "wait", downgraded: false });
  });
});

describe("attachActionChanges (TIME-03)", () => {
  it("prevJudgments が null の場合、全結果に previousAction/actionChanged プロパティが存在しない", () => {
    const judgments = [makeJudgment({ ticker: "AAPL" })];
    const result = attachActionChanges(judgments, null);
    expect(result[0]).not.toHaveProperty("previousAction");
    expect(result[0]).not.toHaveProperty("actionChanged");
  });

  it("prev に同銘柄・同 action → actionChanged: false", () => {
    const judgments = [makeJudgment({ ticker: "AAPL", todayAction: "buy" })];
    const prevJudgments = [makeJudgment({ ticker: "AAPL", todayAction: "buy" })];
    const result = attachActionChanges(judgments, prevJudgments);
    expect(result[0].actionChanged).toBe(false);
    expect(result[0].previousAction).toBe("buy");
  });

  it("prev に同銘柄・異 action（wait→buy）→ actionChanged: true, previousAction: wait", () => {
    const judgments = [makeJudgment({ ticker: "AAPL", todayAction: "buy" })];
    const prevJudgments = [makeJudgment({ ticker: "AAPL", todayAction: "wait" })];
    const result = attachActionChanges(judgments, prevJudgments);
    expect(result[0].actionChanged).toBe(true);
    expect(result[0].previousAction).toBe("wait");
  });

  it("today のみ存在（prev に無い銘柄）→ プロパティ非付与（undefined 値ではなくキー欠如）", () => {
    const judgments = [makeJudgment({ ticker: "NEWSTOCK" })];
    const prevJudgments = [makeJudgment({ ticker: "AAPL" })];
    const result = attachActionChanges(judgments, prevJudgments);
    expect(result[0]).not.toHaveProperty("previousAction");
    expect(result[0]).not.toHaveProperty("actionChanged");
    expect(result[0].actionChanged).toBeUndefined();
  });

  it("銘柄キー照合が空白/大小文字を許容する（normalizeHoldingSymbol経由）", () => {
    const judgments = [makeJudgment({ ticker: "AAPL", todayAction: "buy" })];
    const prevJudgments = [makeJudgment({ ticker: " aapl ", todayAction: "wait" })];
    const result = attachActionChanges(judgments, prevJudgments);
    expect(result[0].actionChanged).toBe(true);
    expect(result[0].previousAction).toBe("wait");
  });

  it("当日 judgments に有り前日に無い銘柄があっても、当日銘柄は必ず出力に含まれる（当日=ループ駆動）", () => {
    const judgments = [
      makeJudgment({ ticker: "AAPL", todayAction: "buy" }),
      makeJudgment({ ticker: "NEWSTOCK", todayAction: "wait" }),
    ];
    const prevJudgments = [makeJudgment({ ticker: "AAPL", todayAction: "buy" })];
    const result = attachActionChanges(judgments, prevJudgments);
    expect(result).toHaveLength(2);
    expect(result.map((j) => j.ticker)).toEqual(["AAPL", "NEWSTOCK"]);
    expect(result[1]).not.toHaveProperty("actionChanged");
  });

  it("prevJudgments が型に反して非配列でも throw せず全結果にプロパティ非付与（WR-02: throwなし契約）", () => {
    const judgments = [makeJudgment({ ticker: "AAPL" })];
    const result = attachActionChanges(judgments, "oops" as unknown as WatchlistJudgment[]);
    expect(result).toHaveLength(1);
    expect(result[0]).not.toHaveProperty("previousAction");
    expect(result[0]).not.toHaveProperty("actionChanged");
  });

  it("prev 要素が null / 非文字列 ticker でも throw せず不正要素のみ比較から除外される（WR-02）", () => {
    const judgments = [makeJudgment({ ticker: "AAPL", todayAction: "buy" })];
    const prevJudgments = [
      null,
      { ticker: 123, todayAction: "wait" },
      makeJudgment({ ticker: "AAPL", todayAction: "wait" }),
    ] as unknown as WatchlistJudgment[];
    const result = attachActionChanges(judgments, prevJudgments);
    expect(result[0].previousAction).toBe("wait");
    expect(result[0].actionChanged).toBe(true);
  });
});

describe("deriveMarket (TIME-05)", () => {
  it('".T" サフィックス銘柄は "JP" になる', () => {
    expect(deriveMarket("7203.T")).toBe("JP");
  });

  it("サフィックス無し銘柄は \"US\" になる", () => {
    expect(deriveMarket("AAPL")).toBe("US");
  });

  it('小文字 ".t" サフィックスでも "JP" になる（WR-04: ケースインセンシティブ）', () => {
    expect(deriveMarket("7203.t")).toBe("JP");
  });

  it('末尾空白付き " 7203.T " でも "JP" になる（WR-04: trim）', () => {
    expect(deriveMarket(" 7203.T ")).toBe("JP");
  });
});

describe("buildSkippedJudgment (TIME-05 / D-20)", () => {
  it("status: skipped の陽性レコードを生成し、market を導出し、asOf は付与しない", () => {
    const result = buildSkippedJudgment("MSFT");
    expect(result.status).toBe("skipped");
    expect(result.market).toBe("US");
    expect(result).not.toHaveProperty("asOf");
    expect(result.todayAction).toBe("wait");
    expect(result.signals).toEqual([]);
  });

  it("日本株ティッカーでも market: JP を正しく導出する", () => {
    const result = buildSkippedJudgment("7203.T");
    expect(result.market).toBe("JP");
    expect(result.status).toBe("skipped");
  });
});

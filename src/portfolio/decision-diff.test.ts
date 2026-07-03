import { describe, it, expect } from "vitest";
import { attachDecisionChanges } from "./decision-diff.js";
import type { HoldingEvaluation } from "../meeting/types.js";

const makeHolding = (overrides: Partial<HoldingEvaluation>): HoldingEvaluation => ({
  symbol: "TEST",
  nameJa: "テスト株式会社",
  decision: "保持",
  rationale: "デフォルト理由",
  urgent: false,
  ...overrides,
});

describe("attachDecisionChanges (PORT-05)", () => {
  it("prevHoldings が null の場合、全結果に previousDecision/decisionChanged プロパティが存在しない", () => {
    const holdings = [makeHolding({ symbol: "MRNA" })];
    const result = attachDecisionChanges(holdings, null);
    expect(result[0]).not.toHaveProperty("previousDecision");
    expect(result[0]).not.toHaveProperty("decisionChanged");
  });

  it("両方に存在し decision が同一なら decisionChanged === false、previousDecision === 前日 decision", () => {
    const holdings = [makeHolding({ symbol: "MRNA", decision: "保持" })];
    const prevHoldings = [makeHolding({ symbol: "MRNA", decision: "保持" })];
    const result = attachDecisionChanges(holdings, prevHoldings);
    expect(result[0].decisionChanged).toBe(false);
    expect(result[0].previousDecision).toBe("保持");
  });

  it("両方に存在し decision が相違するなら decisionChanged === true、previousDecision === 前日 decision", () => {
    const holdings = [makeHolding({ symbol: "MRNA", decision: "一部売却" })];
    const prevHoldings = [makeHolding({ symbol: "MRNA", decision: "保持" })];
    const result = attachDecisionChanges(holdings, prevHoldings);
    expect(result[0].decisionChanged).toBe(true);
    expect(result[0].previousDecision).toBe("保持");
  });

  it("当日銘柄が prevHoldings に無い場合、previousDecision/decisionChanged プロパティが存在しない（D-14: undefined と false を区別）", () => {
    const holdings = [makeHolding({ symbol: "NEWSTOCK" })];
    const prevHoldings = [makeHolding({ symbol: "MRNA" })];
    const result = attachDecisionChanges(holdings, prevHoldings);
    expect(result[0]).not.toHaveProperty("previousDecision");
    expect(result[0]).not.toHaveProperty("decisionChanged");
    expect(result[0].decisionChanged).toBeUndefined();
  });

  it("キー一致は normalizeHoldingSymbol 経由（前後空白・大小文字ズレでも一致する）", () => {
    const holdings = [makeHolding({ symbol: "MRNA", decision: "買増" })];
    const prevHoldings = [makeHolding({ symbol: " mrna ", decision: "保持" })];
    const result = attachDecisionChanges(holdings, prevHoldings);
    expect(result[0].decisionChanged).toBe(true);
    expect(result[0].previousDecision).toBe("保持");
  });

  it("当日 holdings に有り前日に無い銘柄があっても、その当日銘柄は必ず出力配列に含まれる（当日=ループ駆動）", () => {
    const holdings = [
      makeHolding({ symbol: "MRNA", decision: "保持" }),
      makeHolding({ symbol: "NEWSTOCK", decision: "買増" }),
    ];
    const prevHoldings = [makeHolding({ symbol: "MRNA", decision: "保持" })];
    const result = attachDecisionChanges(holdings, prevHoldings);
    expect(result).toHaveLength(2);
    expect(result.map((h) => h.symbol)).toEqual(["MRNA", "NEWSTOCK"]);
    expect(result[1]).not.toHaveProperty("decisionChanged");
  });
});

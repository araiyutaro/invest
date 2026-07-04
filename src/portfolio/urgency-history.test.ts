import { describe, it, expect } from "vitest";
import {
  extractUrgencySnapshots,
  appendUrgencySnapshot,
  isValidDateKey,
  type UrgencyHistoryFile,
  type HoldingUrgencySnapshot,
} from "./urgency-history.js";
import type { HoldingEvaluation, PortfolioAnalysis } from "../meeting/types.js";

const makeHoldingEvaluation = (
  overrides: Partial<HoldingEvaluation>,
): HoldingEvaluation => ({
  symbol: "TEST",
  nameJa: "テスト株式会社",
  decision: "保持",
  rationale: "デフォルト理由",
  urgent: false,
  ...overrides,
});

const makeAnalysis = (
  holdings: ReadonlyArray<HoldingEvaluation>,
): PortfolioAnalysis => ({
  date: "2026-07-04",
  generatedAt: "2026-07-04T00:00:00.000Z",
  overallComment: "デフォルトコメント",
  holdings,
  rebalanceActions: [],
});

const makeSnapshot = (
  overrides: Partial<HoldingUrgencySnapshot>,
): HoldingUrgencySnapshot => ({
  symbol: "TEST",
  nameJa: "テスト株式会社",
  urgent: false,
  decision: "保持",
  ...overrides,
});

describe("extractUrgencySnapshots (D-02, D-10)", () => {
  it("holdings 全件について symbol/nameJa/urgent/decision の4フィールドのみを返す", () => {
    const holdings = [
      makeHoldingEvaluation({
        symbol: "MRNA",
        nameJa: "モデルナ",
        decision: "一部売却",
        urgent: true,
        rationale: "決算ミス",
        riskNote: "訴訟リスク",
        previousDecision: "保持",
        decisionChanged: true,
      }),
    ];
    const result = extractUrgencySnapshots(makeAnalysis(holdings));
    expect(result).toEqual([
      { symbol: "MRNA", nameJa: "モデルナ", urgent: true, decision: "一部売却" },
    ]);
    expect(result[0]).not.toHaveProperty("rationale");
    expect(result[0]).not.toHaveProperty("riskNote");
    expect(result[0]).not.toHaveProperty("previousDecision");
    expect(result[0]).not.toHaveProperty("decisionChanged");
  });

  it("urgent: false の銘柄も含まれる（D-03: 全銘柄を毎日保存）", () => {
    const holdings = [
      makeHoldingEvaluation({ symbol: "HII", urgent: false, decision: "保持" }),
    ];
    const result = extractUrgencySnapshots(makeAnalysis(holdings));
    expect(result).toEqual([
      { symbol: "HII", nameJa: "テスト株式会社", urgent: false, decision: "保持" },
    ]);
  });

  it("複数保有銘柄すべてが結果に含まれる", () => {
    const holdings = [
      makeHoldingEvaluation({ symbol: "MRNA" }),
      makeHoldingEvaluation({ symbol: "HII" }),
      makeHoldingEvaluation({ symbol: "8522.T" }),
    ];
    const result = extractUrgencySnapshots(makeAnalysis(holdings));
    expect(result).toHaveLength(3);
    expect(result.map((s) => s.symbol)).toEqual(["MRNA", "HII", "8522.T"]);
  });

  it("symbol を normalizeHoldingSymbol で正規化する（前後空白除去+大文字化）", () => {
    const holdings = [makeHoldingEvaluation({ symbol: " 8522.t " })];
    const result = extractUrgencySnapshots(makeAnalysis(holdings));
    expect(result[0].symbol).toBe("8522.T");
  });

  it("小文字ティッカーを大文字化する", () => {
    const holdings = [makeHoldingEvaluation({ symbol: "mrna" })];
    const result = extractUrgencySnapshots(makeAnalysis(holdings));
    expect(result[0].symbol).toBe("MRNA");
  });

  it("呼び出し後、入力 analysis.holdings が不変", () => {
    const holdings = [makeHoldingEvaluation({ symbol: "MRNA" })];
    const analysis = makeAnalysis(holdings);
    const originalHoldings = [...analysis.holdings];
    extractUrgencySnapshots(analysis);
    expect(analysis.holdings).toEqual(originalHoldings);
  });
});

describe("appendUrgencySnapshot (D-04)", () => {
  it("空の history に dateKey を追加すると、そのキーにスナップショットが保存される", () => {
    const snapshotA = makeSnapshot({ symbol: "MRNA" });
    const result = appendUrgencySnapshot({}, "2026-07-04", [snapshotA]);
    expect(result).toEqual({ "2026-07-04": [snapshotA] });
  });

  it("同一 dateKey で2回呼ぶと2回目のスナップショットのみが残る（重複しない、HIST-02）", () => {
    const snapshotA = makeSnapshot({ symbol: "MRNA", decision: "保持" });
    const snapshotB = makeSnapshot({ symbol: "MRNA", decision: "一部売却" });
    const h1 = appendUrgencySnapshot({}, "2026-07-04", [snapshotA]);
    const h2 = appendUrgencySnapshot(h1, "2026-07-04", [snapshotB]);
    expect(h2["2026-07-04"]).toEqual([snapshotB]);
    expect(Object.keys(h2)).toEqual(["2026-07-04"]);
  });

  it("異なる dateKey で呼ぶと両方のキーが保持される", () => {
    const snapshotA = makeSnapshot({ symbol: "MRNA" });
    const snapshotB = makeSnapshot({ symbol: "MRNA" });
    const h1 = appendUrgencySnapshot({}, "2026-07-03", [snapshotA]);
    const h2 = appendUrgencySnapshot(h1, "2026-07-04", [snapshotB]);
    expect(Object.keys(h2).sort()).toEqual(["2026-07-03", "2026-07-04"]);
    expect(h2["2026-07-03"]).toEqual([snapshotA]);
    expect(h2["2026-07-04"]).toEqual([snapshotB]);
  });

  it("入力 history を mutate しない（イミュータブル）", () => {
    const snapshotA = makeSnapshot({ symbol: "MRNA" });
    const snapshotB = makeSnapshot({ symbol: "HII" });
    const history: UrgencyHistoryFile = { "2026-07-03": [snapshotA] };
    const originalHistory = { ...history, "2026-07-03": [...history["2026-07-03"]] };
    appendUrgencySnapshot(history, "2026-07-04", [snapshotB]);
    expect(history).toEqual(originalHistory);
  });
});

describe("isValidDateKey (D-06)", () => {
  it("YYYY-MM-DD 形式は true", () => {
    expect(isValidDateKey("2026-07-04")).toBe(true);
  });

  it("桁数不足の日付形式は false", () => {
    expect(isValidDateKey("2026-7-4")).toBe(false);
  });

  it("日付ではない文字列は false", () => {
    expect(isValidDateKey("not-a-date")).toBe(false);
  });

  it("__proto__ は false（prototype pollution 対策）", () => {
    expect(isValidDateKey("__proto__")).toBe(false);
  });

  it("空文字列は false", () => {
    expect(isValidDateKey("")).toBe(false);
  });
});

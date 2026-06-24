import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
}));

const validMeetingResult = {
  date: "2026-06-24",
  generatedAt: "2026-06-24T08:00:00.000Z",
  marketOverview: {
    summary: "市場は上昇基調",
    trend: "上昇" as const,
    keyIndices: [{ name: "S&P 500", changePercent: 0.5 }],
  },
  sectorRecommendations: [
    { rank: 1, sector: "テクノロジー", rationale: "AI需要拡大", outlook: "強気" as const },
  ],
  highlightedStocks: [
    {
      ticker: "PLTR",
      averageScore: 8.2,
      verdict: "強気" as const,
      summary: "AI関連で成長期待",
      agentScores: [{ agentRole: "テクニカル", score: 8, reason: "上昇トレンド" }],
      nominatedBy: ["tenbagger"],
    },
  ],
  riskWarnings: [{ severity: "中" as const, description: "金利上昇リスク" }],
  actionItems: ["ポートフォリオリバランス検討"],
  weeklyEvents: [{ date: "2026-06-26", event: "FOMC議事要旨", impact: "高" as const }],
  indexInvestorAdvice: "積立継続推奨",
  roundSummary: {
    round1Count: 5,
    round2Count: 5,
    round3Count: 5,
    scoredTickers: ["PLTR"],
  },
};

describe("validate-meeting schemas", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("Test 1: 全必須フィールドが揃った有効データが validateMeetingResult を通過する", async () => {
    const { validateMeetingResult } = await import("../meeting/schemas.js");
    expect(() => validateMeetingResult(validMeetingResult)).not.toThrow();
    const result = validateMeetingResult(validMeetingResult);
    expect(result.date).toBe("2026-06-24");
    expect(result.marketOverview.trend).toBe("上昇");
  });

  it("Test 2: 必須フィールド (date) が欠けたデータで ZodError を throw する", async () => {
    const { validateMeetingResult } = await import("../meeting/schemas.js");
    const invalidData = { ...validMeetingResult, date: undefined };
    expect(() => validateMeetingResult(invalidData)).toThrow();
  });

  it("Test 3: verdict に無効な値（\"超強気\"）を入れると ZodError を throw する", async () => {
    const { validateMeetingResult } = await import("../meeting/schemas.js");
    const invalidData = {
      ...validMeetingResult,
      highlightedStocks: [
        {
          ...validMeetingResult.highlightedStocks[0],
          verdict: "超強気",
        },
      ],
    };
    expect(() => validateMeetingResult(invalidData)).toThrow();
  });

  it("Test 4: score が範囲外 (score: 11) のデータで ZodError を throw する", async () => {
    const { validateMeetingResult } = await import("../meeting/schemas.js");
    const invalidData = {
      ...validMeetingResult,
      highlightedStocks: [
        {
          ...validMeetingResult.highlightedStocks[0],
          agentScores: [{ agentRole: "テクニカル", score: 11, reason: "上昇トレンド" }],
        },
      ],
    };
    expect(() => validateMeetingResult(invalidData)).toThrow();
  });

  it("Test 5: highlightedStocks が空配列の場合でも validateMeetingResult が正常に通過する", async () => {
    const { validateMeetingResult } = await import("../meeting/schemas.js");
    const dataWithEmptyStocks = { ...validMeetingResult, highlightedStocks: [] };
    expect(() => validateMeetingResult(dataWithEmptyStocks)).not.toThrow();
    const result = validateMeetingResult(dataWithEmptyStocks);
    expect(result.highlightedStocks).toEqual([]);
  });
});

describe("validate-meeting script", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("Test 6: validate-meeting スクリプトモジュールが validate 関数をエクスポートしている", async () => {
    const module = await import("./validate-meeting.js");
    expect(typeof module.validate).toBe("function");
  });
});

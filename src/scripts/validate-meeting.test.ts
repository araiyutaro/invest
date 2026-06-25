import { describe, it, expect, vi, afterEach } from "vitest";
import { analystRound1OutputSchema, analystRound2OutputSchema } from "../meeting/schemas.js";

const validMeetingResultJson = JSON.stringify({
  date: "2026-06-24",
  generatedAt: "2026-06-24T08:00:00.000Z",
  marketOverview: {
    summary: "市場は上昇基調",
    trend: "上昇",
    keyIndices: [{ name: "S&P 500", changePercent: 0.5 }],
  },
  sectorRecommendations: [
    { rank: 1, sector: "テクノロジー", rationale: "AI需要拡大", outlook: "強気" },
  ],
  highlightedStocks: [],
  riskWarnings: [],
  actionItems: [],
  weeklyEvents: [],
  indexInvestorAdvice: "積立継続推奨",
  roundSummary: { round1Count: 5, round2Count: 5, round3Count: 5, scoredTickers: [] },
});

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn().mockResolvedValue(validMeetingResultJson),
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

describe("analystRound1OutputSchema", () => {
  const validRound1 = {
    agentId: "fundamentals",
    agentRole: "ファンダメンタルズアナリスト",
    analysis:
      "## 市場認識\n市場は上昇基調...\n\n## 専門領域からの洞察\nPER水準は...\n\n## 注目銘柄の詳細分析\nXYZ社は...\n\n## リスクと懸念\n金利上昇リスクが...",
    summary: "全体サマリー",
    highlights: ["ポイント1", "ポイント2"],
    risks: ["リスク1"],
    picks: [{ ticker: "AAPL", direction: "強気", rationale: "割安で成長余地あり" }],
    sectorView: "テクノロジーセクターは強気",
  };

  it("valid Round 1 output passes validation", () => {
    expect(() => analystRound1OutputSchema.parse(validRound1)).not.toThrow();
  });

  it("analysis field is required", () => {
    const { analysis: _analysis, ...without } = validRound1;
    expect(() => analystRound1OutputSchema.parse(without)).toThrow();
  });

  it("picks direction must be 強気|中立|弱気", () => {
    const invalid = {
      ...validRound1,
      picks: [{ ticker: "AAPL", direction: "BUY", rationale: "理由" }],
    };
    expect(() => analystRound1OutputSchema.parse(invalid)).toThrow();
  });

  it("empty analysis string is allowed (fallback case)", () => {
    const fallback = { ...validRound1, analysis: "" };
    expect(() => analystRound1OutputSchema.parse(fallback)).not.toThrow();
  });
});

// --- analystRound2OutputSchema ---

describe("analystRound2OutputSchema", () => {
  const validRound2 = {
    agentId: "fundamentals",
    discussion: "[テンバガーハンター] のXYZ社推奨について、ファンダメンタルズ面では...\n\n[マクロエコノミスト] の金利上昇リスクについては...",
    comment: "各アナリストの主張を踏まえ、テクノロジーセクターは引き続き強気維持。ただし金利動向に注視が必要。",
    agreements: ["テクノロジーセクター強気の共通認識", "金利リスクへの警戒"],
    disagreements: ["中小型株への配分比率で見解が分かれる"]
  };

  it("valid Round 2 output passes validation", () => {
    expect(() => analystRound2OutputSchema.parse(validRound2)).not.toThrow();
  });

  it("discussion field is required", () => {
    const { discussion, ...without } = validRound2;
    expect(() => analystRound2OutputSchema.parse(without)).toThrow();
  });

  it("empty discussion string is allowed (fallback case)", () => {
    const fallback = { ...validRound2, discussion: "" };
    expect(() => analystRound2OutputSchema.parse(fallback)).not.toThrow();
  });

  it("empty comment string is allowed", () => {
    const fallback = { ...validRound2, comment: "" };
    expect(() => analystRound2OutputSchema.parse(fallback)).not.toThrow();
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

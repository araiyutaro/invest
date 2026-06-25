import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { MeetingResult, WebSearchResult, ReevaluationOutput, AnalystRound1Output, AnalystRound2Output, AnalystRound3Output } from "../meeting/types.js";

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn().mockRejectedValue(new Error("ENOENT")),
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
  readdir: vi.fn().mockResolvedValue([]),
}));

vi.spyOn(process, "exit").mockImplementation((() => {}) as never);

const validMeetingResult: MeetingResult = {
  date: "2026-06-24",
  generatedAt: "2026-06-24T08:00:00.000Z",
  marketOverview: {
    summary: "米国株式市場はAI需要主導で全面高。ナスダックが最高値を更新。",
    trend: "上昇",
    keyIndices: [
      { name: "S&P 500", changePercent: 0.8 },
      { name: "NASDAQ", changePercent: 1.2 },
    ],
  },
  sectorRecommendations: [
    { rank: 1, sector: "テクノロジー", rationale: "AI需要拡大で継続成長", outlook: "強気" },
    { rank: 2, sector: "ヘルスケア", rationale: "ディフェンシブ銘柄として安定", outlook: "中立" },
  ],
  highlightedStocks: [
    {
      ticker: "PLTR",
      averageScore: 8.2,
      verdict: "強気",
      summary: "AI関連で成長期待、政府・民間両方のデータ分析需要が拡大",
      agentScores: [
        { agentRole: "ファンダメンタルズ", score: 8, reason: "成長率高い" },
        { agentRole: "テンバガーハンター", score: 9, reason: "急成長中" },
      ],
      nominatedBy: ["fundamentals", "tenbagger"],
    },
  ],
  riskWarnings: [
    { severity: "中", description: "金利上昇によるバリュエーション圧縮リスク" },
  ],
  actionItems: ["PLTR のポジション追加を検討", "マクロリスクに注意"],
  weeklyEvents: [
    { date: "2026-06-26", event: "FOMC議事要旨公表", impact: "高" },
  ],
  indexInvestorAdvice: "インデックス投資家はS&P500積立継続を推奨。",
  roundSummary: {
    round1Count: 5,
    round2Count: 5,
    round3Count: 5,
    scoredTickers: ["PLTR"],
  },
};

const validWebSearchResults: ReadonlyArray<WebSearchResult> = [
  {
    ticker: "PLTR",
    researchSummary: "AI需要拡大で成長加速。政府・金融向け契約が急増しており売上が前年比40%増。",
    positiveFindings: [
      "Q1 2026 売上が前年比40%増",
      "政府向け契約が新規で5億ドル獲得",
    ],
    negativeFindings: [
      "バリュエーションが依然割高水準",
    ],
    keyArticles: [
      { title: "Palantir Q1 Earnings Beat", summary: "AI Platform部門が急成長" },
    ],
    researchedAt: "2026-06-24T07:00:00.000Z",
  },
];

const validReevalResults: ReadonlyArray<ReevaluationOutput> = [
  {
    agentId: "fundamentals",
    agentRole: "ファンダメンタルズアナリスト",
    reevaluations: [
      {
        ticker: "PLTR",
        originalScore: 8,
        revisedScore: 9,
        comment: "Web調査で成長確認。売上40%増は予想を大幅に上回る。",
        changed: true,
      },
    ],
  },
];

const validRound1Results: ReadonlyArray<AnalystRound1Output> = [
  {
    agentId: "fundamentals",
    agentRole: "ファンダメンタルズアナリスト",
    analysis: "## 市場認識\n米国株式市場はAI需要主導で上昇基調。\n\n## 専門領域からの洞察\nPER水準は適正範囲内。\n\n## 注目銘柄の詳細分析\nPLTR社は政府向け契約が拡大。\n\n## リスクと懸念\n金利上昇リスクに注意。",
    summary: "市場は堅調、AI関連に注目",
    highlights: ["AI需要拡大", "小型株に妙味"],
    risks: ["金利上昇リスク"],
    picks: [{ ticker: "PLTR", direction: "強気" as const, rationale: "政府契約拡大で成長期待" }],
    sectorView: "テクノロジーセクター強気継続",
  },
];

const validRound2Results: ReadonlyArray<AnalystRound2Output> = [
  {
    agentId: "fundamentals",
    discussion: "[テンバガーハンター] のPLTR推奨については、ファンダメンタルズ面からも支持できる。PER水準は...",
    comment: "PLTR推奨に同意、ただし金利リスクに注意",
    agreements: ["PLTR強気"],
    disagreements: ["中小型株配分"],
  },
];

const validRound3Results: ReadonlyArray<AnalystRound3Output> = [
  {
    agentId: "fundamentals",
    agentRole: "ファンダメンタルズアナリスト",
    scores: [{ ticker: "PLTR", score: 8, reason: "成長率高い" }],
  },
];

describe("report-utils", () => {
  it("Test 10: escapeHtml が HTML 特殊文字 (&, <, >) をエスケープする", async () => {
    const { escapeHtml } = await import("./report-utils.js");
    expect(escapeHtml("a & b")).toBe("a &amp; b");
    expect(escapeHtml("<script>")).toBe("&lt;script&gt;");
    expect(escapeHtml("x > y")).toBe("x &gt; y");
  });

  it("Test 15: escapeHtml が report-utils からインポートできる", async () => {
    const { escapeHtml } = await import("./report-utils.js");
    expect(escapeHtml("a & b")).toBe("a &amp; b");
  });

  it("Test 16: markdownToHtml が report-utils からインポートできる", async () => {
    const { markdownToHtml } = await import("./report-utils.js");
    const html = markdownToHtml("**bold**");
    expect(html).toContain("<strong>bold</strong>");
  });
});

describe("Daily Report", () => {
  it("Test 1: generateHtml が MeetingResult + WebSearchResult[] + ReevaluationOutput[] を受け取り HTML 文字列を返す", async () => {
    const { generateHtml } = await import("./generate-report.js");
    const html = generateHtml(validMeetingResult, validWebSearchResults, validReevalResults);
    expect(typeof html).toBe("string");
    expect(html.length).toBeGreaterThan(0);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("</html>");
  });

  it("Test 2: HTML 出力に Bloomberg 風ダークテーマの CSS class が含まれる（\"agent-card\" と \"0f0f1a\"）", async () => {
    const { generateHtml } = await import("./generate-report.js");
    const html = generateHtml(validMeetingResult, validWebSearchResults, validReevalResults);
    expect(html).toContain("agent-card");
    expect(html).toContain("0f0f1a");
  });

  it("Test 3: HTML 出力に marketOverview.summary の内容が含まれる", async () => {
    const { generateHtml } = await import("./generate-report.js");
    const html = generateHtml(validMeetingResult, validWebSearchResults, validReevalResults);
    expect(html).toContain("米国株式市場はAI需要主導で全面高");
  });

  it("Test 4: HTML 出力に highlightedStocks のティッカーとスコアが含まれる", async () => {
    const { generateHtml } = await import("./generate-report.js");
    const html = generateHtml(validMeetingResult, validWebSearchResults, validReevalResults);
    expect(html).toContain("PLTR");
    expect(html).toContain("8.2");
  });

  it("Test 5: HTML 出力に WebSearch リサーチ結果セクション（researchSummary）が含まれる", async () => {
    const { generateHtml } = await import("./generate-report.js");
    const html = generateHtml(validMeetingResult, validWebSearchResults, validReevalResults);
    expect(html).toContain("AI需要拡大で成長加速");
  });

  it("Test 6: HTML 出力に再評価ラウンド結果セクション（revisedScore）が含まれる", async () => {
    const { generateHtml } = await import("./generate-report.js");
    const html = generateHtml(validMeetingResult, validWebSearchResults, validReevalResults);
    expect(html).toContain("9");
    expect(html).toContain("Web調査で成長確認");
  });

  it("Test 7: WebSearchResult が空配列の場合でも HTML が正常に生成される", async () => {
    const { generateHtml } = await import("./generate-report.js");
    const html = generateHtml(validMeetingResult, [], validReevalResults);
    expect(typeof html).toBe("string");
    expect(html).toContain("<!DOCTYPE html>");
  });

  it("Test 8: ReevaluationOutput が空配列の場合でも HTML が正常に生成される", async () => {
    const { generateHtml } = await import("./generate-report.js");
    const html = generateHtml(validMeetingResult, validWebSearchResults, []);
    expect(typeof html).toBe("string");
    expect(html).toContain("<!DOCTYPE html>");
  });

  it("Test 24: Daily Report に青系アクセントカラー（#3b82f6）が含まれる", async () => {
    const { generateDailyReportHtml } = await import("./generate-daily-report.js");
    const html = generateDailyReportHtml(validMeetingResult, validWebSearchResults, validReevalResults);
    expect(html).toContain("#3b82f6");
  });
});

describe("Meeting Minutes HTML", () => {
  it("Test 17: generateMeetingMinutesHtml が有効な HTML を返す", async () => {
    const { generateMeetingMinutesHtml } = await import("./generate-meeting-minutes.js");
    const html = generateMeetingMinutesHtml(validMeetingResult, validRound1Results, validRound2Results, validRound3Results);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("</html>");
    expect(html).toContain("Meeting Minutes");
  });

  it("Test 18: Meeting Minutes に Round 1 の analysis 全文が含まれる", async () => {
    const { generateMeetingMinutesHtml } = await import("./generate-meeting-minutes.js");
    const html = generateMeetingMinutesHtml(validMeetingResult, validRound1Results, validRound2Results, validRound3Results);
    expect(html).toContain("米国株式市場はAI需要主導で上昇基調");
    expect(html).toContain("PER水準は適正範囲内");
  });

  it("Test 19: Meeting Minutes に Round 1 の全フィールド（summary, highlights, risks, picks, sectorView）が含まれる", async () => {
    const { generateMeetingMinutesHtml } = await import("./generate-meeting-minutes.js");
    const html = generateMeetingMinutesHtml(validMeetingResult, validRound1Results, validRound2Results, validRound3Results);
    expect(html).toContain("市場は堅調、AI関連に注目");
    expect(html).toContain("AI需要拡大");
    expect(html).toContain("金利上昇リスク");
    expect(html).toContain("PLTR");
    expect(html).toContain("テクノロジーセクター強気継続");
  });

  it("Test 20: Meeting Minutes に Round 2 の discussion 全文が含まれる", async () => {
    const { generateMeetingMinutesHtml } = await import("./generate-meeting-minutes.js");
    const html = generateMeetingMinutesHtml(validMeetingResult, validRound1Results, validRound2Results, validRound3Results);
    expect(html).toContain("テンバガーハンター");
    expect(html).toContain("ファンダメンタルズ面からも支持できる");
  });

  it("Test 21: Meeting Minutes に Round 2 の agreements/disagreements が含まれる", async () => {
    const { generateMeetingMinutesHtml } = await import("./generate-meeting-minutes.js");
    const html = generateMeetingMinutesHtml(validMeetingResult, validRound1Results, validRound2Results, validRound3Results);
    expect(html).toContain("PLTR強気");
    expect(html).toContain("中小型株配分");
  });

  it("Test 22: Meeting Minutes にオレンジ系アクセントカラー（#f59e0b）が含まれる", async () => {
    const { generateMeetingMinutesHtml } = await import("./generate-meeting-minutes.js");
    const html = generateMeetingMinutesHtml(validMeetingResult, validRound1Results, validRound2Results, validRound3Results);
    expect(html).toContain("#f59e0b");
  });

  it("Test 23: Meeting Minutes が Round データが空でも正常に生成される", async () => {
    const { generateMeetingMinutesHtml } = await import("./generate-meeting-minutes.js");
    const html = generateMeetingMinutesHtml(validMeetingResult, [], [], []);
    expect(html).toContain("<!DOCTYPE html>");
  });
});

describe("Portfolio Report", () => {
  it("Test 25: Portfolio Report に緑系アクセントカラー（#10b981）が含まれる", async () => {
    const { generatePortfolioReportHtml } = await import("./generate-portfolio-report.js");
    const html = generatePortfolioReportHtml(validMeetingResult);
    expect(html).toContain("#10b981");
  });
});

describe("3-report output", () => {
  beforeEach(async () => {
    const fsMock = await import("node:fs/promises");
    (fsMock.writeFile as ReturnType<typeof vi.fn>).mockClear();
    (fsMock.mkdir as ReturnType<typeof vi.fn>).mockClear();
    (fsMock.readFile as ReturnType<typeof vi.fn>).mockClear();
    (fsMock.readdir as ReturnType<typeof vi.fn>).mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("Test 9: main() が docs/YYYY-MM-DD/daily-report.html にファイルを書き出す（fs mock 経由で確認）", async () => {
    const fsMock = await import("node:fs/promises");

    const meetingResultJson = JSON.stringify(validMeetingResult);
    (fsMock.readFile as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
      if (String(path).includes("meeting-result.json")) {
        return Promise.resolve(meetingResultJson);
      }
      return Promise.reject(new Error("ENOENT"));
    });
    (fsMock.readdir as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const { main } = await import("./generate-report.js");
    await main();

    const writeCalls = (fsMock.writeFile as ReturnType<typeof vi.fn>).mock.calls;
    const reportCall = writeCalls.find((call) =>
      String(call[0]).includes("daily-report.html"),
    );
    expect(reportCall).toBeDefined();
    expect(String(reportCall![0])).toContain("2026-06-24");
    expect(String(reportCall![0])).toContain("docs");
  });

  it("Test 11: main() が docs/YYYY-MM-DD/ に daily-report.html を書き出す", async () => {
    const fsMock = await import("node:fs/promises");

    const meetingResultJson = JSON.stringify(validMeetingResult);
    (fsMock.readFile as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
      if (String(path).includes("meeting-result.json")) {
        return Promise.resolve(meetingResultJson);
      }
      return Promise.reject(new Error("ENOENT"));
    });
    (fsMock.readdir as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const { main } = await import("./generate-report.js");
    await main();

    const writeCalls = (fsMock.writeFile as ReturnType<typeof vi.fn>).mock.calls;
    const reportCall = writeCalls.find((call) =>
      String(call[0]).includes("daily-report.html"),
    );
    expect(reportCall).toBeDefined();
    expect(String(reportCall![0])).toContain("docs/2026-06-24");
  });

  it("Test 12: main() が docs/YYYY-MM-DD/ に meeting-minutes.html を書き出す", async () => {
    const fsMock = await import("node:fs/promises");

    const meetingResultJson = JSON.stringify(validMeetingResult);
    (fsMock.readFile as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
      if (String(path).includes("meeting-result.json")) {
        return Promise.resolve(meetingResultJson);
      }
      return Promise.reject(new Error("ENOENT"));
    });
    (fsMock.readdir as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const { main } = await import("./generate-report.js");
    await main();

    const writeCalls = (fsMock.writeFile as ReturnType<typeof vi.fn>).mock.calls;
    const minutesCall = writeCalls.find((call) =>
      String(call[0]).includes("meeting-minutes.html"),
    );
    expect(minutesCall).toBeDefined();
    expect(String(minutesCall![0])).toContain("docs/2026-06-24");
  });

  it("Test 13: main() が docs/YYYY-MM-DD/ に portfolio-report.html を書き出す", async () => {
    const fsMock = await import("node:fs/promises");

    const meetingResultJson = JSON.stringify(validMeetingResult);
    (fsMock.readFile as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
      if (String(path).includes("meeting-result.json")) {
        return Promise.resolve(meetingResultJson);
      }
      return Promise.reject(new Error("ENOENT"));
    });
    (fsMock.readdir as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const { main } = await import("./generate-report.js");
    await main();

    const writeCalls = (fsMock.writeFile as ReturnType<typeof vi.fn>).mock.calls;
    const portfolioCall = writeCalls.find((call) =>
      String(call[0]).includes("portfolio-report.html"),
    );
    expect(portfolioCall).toBeDefined();
    expect(String(portfolioCall![0])).toContain("docs/2026-06-24");
  });

  it("Test 14: main() が reports/ ではなく docs/ ディレクトリに出力する", async () => {
    const fsMock = await import("node:fs/promises");

    const meetingResultJson = JSON.stringify(validMeetingResult);
    (fsMock.readFile as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
      if (String(path).includes("meeting-result.json")) {
        return Promise.resolve(meetingResultJson);
      }
      return Promise.reject(new Error("ENOENT"));
    });
    (fsMock.readdir as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const { main } = await import("./generate-report.js");
    await main();

    const writeCalls = (fsMock.writeFile as ReturnType<typeof vi.fn>).mock.calls;
    for (const call of writeCalls) {
      expect(String(call[0])).not.toContain("/reports/");
      expect(String(call[0])).toContain("/docs/");
    }
  });
});

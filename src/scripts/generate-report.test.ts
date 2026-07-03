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

  it("Test 33 [chart]: marketData ありでセクターバーチャートと VIX ラインチャートの SVG セクションが生成される", async () => {
    const { generateDailyReportHtml } = await import("./generate-daily-report.js");
    const html = generateDailyReportHtml(validMeetingResult, [], [], {
      sectors: [{ sector: "Tech", changePercent: 2 }],
      vixHistory: [{ date: "2026-06-01", close: 18 }],
    });
    expect(html).toContain("セクターパフォーマンス");
    expect(html).toContain("VIX推移");
    expect(html).toContain("<svg");
  });

  it("Test 34 [chart]: marketData が空配列の場合はデータ取得エラー表示になる（両チャート分）", async () => {
    const { generateDailyReportHtml } = await import("./generate-daily-report.js");
    const html = generateDailyReportHtml(validMeetingResult, [], [], {
      sectors: [],
      vixHistory: [],
    });
    const matches = html.match(/データ取得エラー/g);
    expect(matches).not.toBeNull();
    expect(matches?.length).toBe(2);
  });

  it("Test 35 [chart]: marketData 省略時（3引数呼び出し）でも HTML が正常に生成される（後方互換）", async () => {
    const { generateDailyReportHtml } = await import("./generate-daily-report.js");
    const html = generateDailyReportHtml(validMeetingResult, [], []);
    expect(typeof html).toBe("string");
    expect(html).toContain("<!DOCTYPE html>");
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

const validPortfolioAnalysis = {
  date: "2026-06-24",
  generatedAt: "2026-06-24T09:30:00Z",
  overallComment: "ポートフォリオ全体は安定。防衛セクター偏重に注意。",
  holdings: [
    {
      symbol: "MRNA",
      nameJa: "モデルナ",
      decision: "保持" as const,
      rationale: "mRNAパイプライン評価待ち",
      riskNote: "競合リスク",
      urgent: false,
    },
    {
      symbol: "HII",
      nameJa: "ハンティントン・インガルス",
      decision: "買増" as const,
      rationale: "防衛予算増額で安定成長",
      urgent: false,
    },
    {
      symbol: "POWL",
      nameJa: "パウエル・インダストリーズ",
      decision: "一部売却" as const,
      rationale: "バリュエーション割高",
      riskNote: "PE56倍は持続不可能",
      urgent: false,
    },
  ],
  rebalanceActions: [
    "HIIを買増し。防衛予算増額と割安バリュエーション",
    "POWLを一部売却し利益確定",
  ],
};

describe("Portfolio Report", () => {
  it("Test 25: Portfolio Report に緑系アクセントカラー（#10b981）が含まれる", async () => {
    const { generatePortfolioReportHtml } = await import("./generate-portfolio-report.js");
    const html = generatePortfolioReportHtml(validMeetingResult, validPortfolioAnalysis);
    expect(html).toContain("#10b981");
  });

  it("Test 26: generatePortfolioReportHtml が portfolioAnalysis を受け取り保有銘柄の decision を含む HTML を返す", async () => {
    const { generatePortfolioReportHtml } = await import("./generate-portfolio-report.js");
    const html = generatePortfolioReportHtml(validMeetingResult, validPortfolioAnalysis);
    expect(html).toContain("保持");
    expect(html).toContain("買増");
    expect(html).toContain("一部売却");
  });

  it("Test 27: HTML に各 holding の symbol と nameJa が含まれる", async () => {
    const { generatePortfolioReportHtml } = await import("./generate-portfolio-report.js");
    const html = generatePortfolioReportHtml(validMeetingResult, validPortfolioAnalysis);
    expect(html).toContain("MRNA");
    expect(html).toContain("モデルナ");
    expect(html).toContain("HII");
    expect(html).toContain("ハンティントン・インガルス");
  });

  it("Test 28: HTML に overallComment が含まれる", async () => {
    const { generatePortfolioReportHtml } = await import("./generate-portfolio-report.js");
    const html = generatePortfolioReportHtml(validMeetingResult, validPortfolioAnalysis);
    expect(html).toContain("ポートフォリオ全体は安定");
  });

  it("Test 29: HTML に rebalanceActions が含まれる", async () => {
    const { generatePortfolioReportHtml } = await import("./generate-portfolio-report.js");
    const html = generatePortfolioReportHtml(validMeetingResult, validPortfolioAnalysis);
    expect(html).toContain("HIIを買増し");
    expect(html).toContain("POWLを一部売却し利益確定");
  });

  it("Test 30: HTML に highlightedStocks の新規組入候補セクションが含まれる (PORT-01)", async () => {
    const { generatePortfolioReportHtml } = await import("./generate-portfolio-report.js");
    const html = generatePortfolioReportHtml(validMeetingResult, validPortfolioAnalysis);
    expect(html).toContain("新規組入候補");
    expect(html).toContain("PLTR");
    expect(html).toContain("8.2");
  });

  it("Test 31: portfolioAnalysis が null の場合フォールバック HTML を返す", async () => {
    const { generatePortfolioReportHtml } = await import("./generate-portfolio-report.js");
    const html = generatePortfolioReportHtml(validMeetingResult, null);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("Portfolio Report");
    expect(html).not.toContain("保有銘柄 個別評価");
  });

  it("Test 32: decision バッジに正しい色が使われる", async () => {
    const { generatePortfolioReportHtml } = await import("./generate-portfolio-report.js");
    const html = generatePortfolioReportHtml(validMeetingResult, validPortfolioAnalysis);
    expect(html).toContain("#10b981"); // 保持 = green
    expect(html).toContain("#3b82f6"); // 買増 = blue
    expect(html).toContain("#f59e0b"); // 一部売却 = amber
  });

  it("Test 33: resolvedHoldingNews が空の場合も「関連ニュース」見出し + 「本日の関連ニュースなし」で正常描画される (UI-06/D-08)", async () => {
    const { generatePortfolioReportHtml } = await import("./generate-portfolio-report.js");
    const html = generatePortfolioReportHtml(validMeetingResult, validPortfolioAnalysis, {});
    expect(html).toContain("関連ニュース");
    expect(html).toContain("本日の関連ニュースなし");
  });

  it("Test 34: name一致の記事に「社名一致」バッジと記事タイトルが描画される (UI-05/D-07)", async () => {
    const { generatePortfolioReportHtml } = await import("./generate-portfolio-report.js");
    const html = generatePortfolioReportHtml(validMeetingResult, validPortfolioAnalysis, {
      MRNA: [
        {
          id: "n1",
          title: "モデルナ社が新工場建設を発表",
          source: "Reuters",
          url: "https://example.com/n1",
          publishedAt: "2026-06-24T00:00:00Z",
          matchType: "name",
        },
      ],
    });
    expect(html).toContain("社名一致");
    expect(html).toContain("モデルナ社が新工場建設を発表");
  });

  it("Test 35: ニュース見出しリンクが target=_blank rel=noopener noreferrer を持つ (D-03)", async () => {
    const { generatePortfolioReportHtml } = await import("./generate-portfolio-report.js");
    const html = generatePortfolioReportHtml(validMeetingResult, validPortfolioAnalysis, {
      MRNA: [
        {
          id: "n1",
          title: "モデルナ社が新工場建設を発表",
          source: "Reuters",
          url: "https://example.com/n1",
          publishedAt: "2026-06-24T00:00:00Z",
          matchType: "name",
        },
      ],
    });
    expect(html).toContain('target="_blank" rel="noopener noreferrer"');
  });

  it("Test 36: ticker一致の記事には「社名一致」バッジが付かない (D-07)", async () => {
    const { generatePortfolioReportHtml } = await import("./generate-portfolio-report.js");
    const html = generatePortfolioReportHtml(validMeetingResult, validPortfolioAnalysis, {
      MRNA: [
        {
          id: "n2",
          title: "MRNA株価が急伸",
          source: "Bloomberg",
          url: "https://example.com/n2",
          publishedAt: "2026-06-24T01:00:00Z",
          matchType: "ticker",
        },
      ],
    });
    expect(html).toContain("MRNA株価が急伸");
    expect(html).not.toContain("社名一致");
  });

  it("Test 37: resolvedHoldingNews のキーは正規化済みで、h.symbol の表記揺れがあっても該当ニュースが引き当たる（Q2 RESOLVED / Pitfall 2）", async () => {
    const { generatePortfolioReportHtml } = await import("./generate-portfolio-report.js");
    const portfolioAnalysisWithWhitespaceSymbol = {
      ...validPortfolioAnalysis,
      holdings: validPortfolioAnalysis.holdings.map((h) =>
        h.symbol === "MRNA" ? { ...h, symbol: " mrna " } : h,
      ),
    };
    const html = generatePortfolioReportHtml(validMeetingResult, portfolioAnalysisWithWhitespaceSymbol, {
      MRNA: [
        {
          id: "n3",
          title: "表記揺れでも引き当たるニュース",
          source: "TestSource",
          url: "https://example.com/n3",
          publishedAt: "2026-06-24T02:00:00Z",
          matchType: "ticker",
        },
      ],
    });
    expect(html).toContain("表記揺れでも引き当たるニュース");
  });

  it("Test 38: generatePortfolioReportHtml は第3引数省略の2引数呼び出しでも後方互換で動作する", async () => {
    const { generatePortfolioReportHtml } = await import("./generate-portfolio-report.js");
    const html = generatePortfolioReportHtml(validMeetingResult, validPortfolioAnalysis);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("関連ニュース");
    expect(html).toContain("本日の関連ニュースなし");
  });

  it("Test 40: urgent: true の銘柄カードに赤系「⚠ 緊急」バッジが表示される (D-16/UI-07)", async () => {
    const { generatePortfolioReportHtml } = await import("./generate-portfolio-report.js");
    const analysisWithUrgent = {
      ...validPortfolioAnalysis,
      holdings: validPortfolioAnalysis.holdings.map((h, i) => (i === 0 ? { ...h, urgent: true } : h)),
    };
    const html = generatePortfolioReportHtml(validMeetingResult, analysisWithUrgent);
    expect(html).toContain("⚠ 緊急");
    expect(html).toContain("#ef4444");
  });

  it("Test 41: decisionChanged === true の銘柄カードにアンバー系「判断変更」バッジが表示される (D-17/UI-07)", async () => {
    const { generatePortfolioReportHtml } = await import("./generate-portfolio-report.js");
    const analysisWithChange = {
      ...validPortfolioAnalysis,
      holdings: validPortfolioAnalysis.holdings.map((h, i) =>
        i === 0 ? { ...h, decisionChanged: true, previousDecision: "保持" as const } : h),
    };
    const html = generatePortfolioReportHtml(validMeetingResult, analysisWithChange);
    expect(html).toContain("判断変更: 保持 →");
  });

  it("Test 42: decisionChanged === undefined ではバッジが描画されない（false と区別、D-14）", async () => {
    const { generatePortfolioReportHtml } = await import("./generate-portfolio-report.js");
    const html = generatePortfolioReportHtml(validMeetingResult, validPortfolioAnalysis); // no decisionChanged field at all
    expect(html).not.toContain("判断変更:");
  });

  it("Test 43: urgent/変化バッジが表示されても border-left の decision 色は維持される (D-18)", async () => {
    const { generatePortfolioReportHtml } = await import("./generate-portfolio-report.js");
    const analysisWithBoth = {
      ...validPortfolioAnalysis,
      holdings: validPortfolioAnalysis.holdings.map((h, i) =>
        i === 0 ? { ...h, urgent: true, decisionChanged: true, previousDecision: "保持" as const } : h),
    };
    const html = generatePortfolioReportHtml(validMeetingResult, analysisWithBoth);
    expect(html).toContain("border-left-color:#10b981"); // 保持 = green, unchanged despite urgent/changed
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

  it("Test 39: Daily Report ローダー(loadWebSearchResults/loadReevalResults)はportfolio-research/を一切参照しない（Pitfall 1, PORT-02構造的隔離）", async () => {
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

    const readdirMock = fsMock.readdir as ReturnType<typeof vi.fn>;
    expect(readdirMock).toHaveBeenCalledWith(expect.stringContaining("websearch"));
    expect(readdirMock).toHaveBeenCalledWith(expect.stringContaining("reeval"));
    expect(readdirMock).not.toHaveBeenCalledWith(expect.stringContaining("portfolio-research"));

    // readdir経由だけでなくreadFile直読みの退行も検出する（WR-07: 構造的隔離の完全性）
    const readFileMock = fsMock.readFile as ReturnType<typeof vi.fn>;
    for (const call of readFileMock.mock.calls) {
      expect(String(call[0])).not.toContain("portfolio-research");
    }

    // prev-portfolio-analysis.json も並列ロードされる（PORT-05配線、既存の隔離アサーションは維持）
    expect(readFileMock).toHaveBeenCalledWith(
      expect.stringContaining("prev-portfolio-analysis.json"),
      expect.any(String),
    );
  });

  it("Test 44: loadWebSearchResults の per-file catch が失敗ファイルで console.warn を呼ぶ（Pitfall 7負債回収, D-15）", async () => {
    const fsMock = await import("node:fs/promises");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const meetingResultJson = JSON.stringify(validMeetingResult);
    (fsMock.readFile as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
      if (String(path).includes("meeting-result.json")) {
        return Promise.resolve(meetingResultJson);
      }
      if (String(path).includes("websearch")) {
        return Promise.resolve("not valid json{{{");
      }
      return Promise.reject(new Error("ENOENT"));
    });
    (fsMock.readdir as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
      if (String(path).includes("websearch")) {
        return Promise.resolve(["bad.json"]);
      }
      return Promise.resolve([]);
    });

    const { main } = await import("./generate-report.js");
    await main();

    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("Test 45: loadReevalResults の per-file catch が失敗ファイルで console.warn を呼ぶ（Pitfall 7負債回収, D-15）", async () => {
    const fsMock = await import("node:fs/promises");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const meetingResultJson = JSON.stringify(validMeetingResult);
    (fsMock.readFile as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
      if (String(path).includes("meeting-result.json")) {
        return Promise.resolve(meetingResultJson);
      }
      if (String(path).includes("reeval")) {
        return Promise.resolve("not valid json{{{");
      }
      return Promise.reject(new Error("ENOENT"));
    });
    (fsMock.readdir as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
      if (String(path).includes("reeval")) {
        return Promise.resolve(["bad.json"]);
      }
      return Promise.resolve([]);
    });

    const { main } = await import("./generate-report.js");
    await main();

    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

});

describe("resolvePrevHoldingsForDiff (WR-02 同日ガード)", () => {
  const prevAnalysis = { ...validPortfolioAnalysis, date: "2026-06-23" };

  it("prev.date !== current.date（通常の前日データ）の場合は prev.holdings を返す", async () => {
    const { resolvePrevHoldingsForDiff } = await import("./generate-report.js");
    const result = resolvePrevHoldingsForDiff(validPortfolioAnalysis, prevAnalysis);
    expect(result).toBe(prevAnalysis.holdings);
  });

  it("prev.date === current.date（同日再実行）の場合は null を返し console.warn する（WR-02）", async () => {
    const { resolvePrevHoldingsForDiff } = await import("./generate-report.js");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = resolvePrevHoldingsForDiff(validPortfolioAnalysis, { ...validPortfolioAnalysis });
    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("prev === null の場合は null を返す（D-14: 比較不能）", async () => {
    const { resolvePrevHoldingsForDiff } = await import("./generate-report.js");
    expect(resolvePrevHoldingsForDiff(validPortfolioAnalysis, null)).toBeNull();
  });

  it("current === null の場合は null を返す", async () => {
    const { resolvePrevHoldingsForDiff } = await import("./generate-report.js");
    expect(resolvePrevHoldingsForDiff(null, prevAnalysis)).toBeNull();
  });
});

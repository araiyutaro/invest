import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { MeetingResult, WebSearchResult, ReevaluationOutput, AnalystRound1Output, AnalystRound2Output, AnalystRound3Output } from "../meeting/types.js";
import type { UrgencyHistoryFile, HoldingUrgencySnapshot } from "../portfolio/urgency-history.js";

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

describe("Watchlist section (UI-09/UI-10)", () => {
  const marketDataDefault = { sectors: [], vixHistory: [] };

  it("Test 37: judgments 複数件（buy 1件 + wait 1件）で見出し・バッジ文言・ラベル文言・rationale・会社名が含まれる", async () => {
    const { generateDailyReportHtml } = await import("./generate-daily-report.js");
    const watchlistJudgmentFixture = {
      date: validMeetingResult.date,
      generatedAt: "2026-06-24T08:00:00.000Z",
      judgments: [
        {
          ticker: "PLTR",
          todayAction: "buy" as const,
          rationale: "MA上抜けと出来高急増を確認、押し目形成完了",
          signals: ["MA上抜け"],
        },
        {
          ticker: "SNOW",
          todayAction: "wait" as const,
          rationale: "まだ調整局面、押し目待ち",
          signals: [],
        },
      ],
    };
    const watchlistFixture = {
      PLTR: { ticker: "PLTR", nameJa: "パランティア", history: [] },
      SNOW: { ticker: "SNOW", nameJa: "スノーフレイク", history: [] },
    };
    const html = generateDailyReportHtml(
      validMeetingResult, [], [], marketDataDefault,
      watchlistJudgmentFixture, watchlistFixture,
    );
    expect(html).toContain("ウォッチリスト 買いタイミング判定");
    expect(html).toContain("今日買うべき");
    expect(html).toContain("待ち");
    expect(html).toContain("MA上抜けと出来高急増を確認、押し目形成完了");
    expect(html).toContain("まだ調整局面、押し目待ち");
    expect(html).toContain("パランティア");
    expect(html).toContain("スノーフレイク");
  });

  it("Test 38: 有効な WatchlistJudgmentFile で judgments が空配列のとき見出し＋空メッセージが含まれ、カード div は含まれない", async () => {
    const { generateDailyReportHtml } = await import("./generate-daily-report.js");
    const watchlistJudgmentFixture = {
      date: validMeetingResult.date,
      generatedAt: "2026-06-24T08:00:00.000Z",
      judgments: [],
    };
    const html = generateDailyReportHtml(
      validMeetingResult, [], [], marketDataDefault,
      watchlistJudgmentFixture, {},
    );
    expect(html).toContain("ウォッチリスト 買いタイミング判定");
    expect(html).toContain("現在ウォッチリスト銘柄はありません");
    // 他セクション（インデックス投資家へのアドバイス等）でも .agent-card が使われるため、
    // ウォッチリストセクションのみを切り出してカード div が無いことを検証する
    const sectionStart = html.indexOf("ウォッチリスト 買いタイミング判定");
    const sectionEnd = html.indexOf("<hr>", sectionStart);
    const sectionHtml = html.slice(sectionStart, sectionEnd === -1 ? undefined : sectionEnd);
    expect(sectionHtml).not.toContain('class="agent-card"');
  });

  it("Test 39: watchlistJudgment に null を渡すとセクション見出し・空メッセージのいずれも含まれない（完全非表示）", async () => {
    const { generateDailyReportHtml } = await import("./generate-daily-report.js");
    const html = generateDailyReportHtml(
      validMeetingResult, [], [], marketDataDefault,
      null, {},
    );
    expect(html).not.toContain("ウォッチリスト 買いタイミング判定");
    expect(html).not.toContain("現在ウォッチリスト銘柄はありません");
  });

  it("Test 40: buy 銘柄で背景色 #10b981 を含むピルが描画される", async () => {
    const { generateDailyReportHtml } = await import("./generate-daily-report.js");
    const watchlistJudgmentFixture = {
      date: validMeetingResult.date,
      generatedAt: "2026-06-24T08:00:00.000Z",
      judgments: [
        { ticker: "PLTR", todayAction: "buy" as const, rationale: "根拠", signals: [] },
      ],
    };
    const html = generateDailyReportHtml(
      validMeetingResult, [], [], marketDataDefault,
      watchlistJudgmentFixture, {},
    );
    expect(html).toContain("#10b981");
  });

  it("Test 41: wait 銘柄では #10b981 のピルではなく #9ca3af の控えめラベルが描画される", async () => {
    const { generateDailyReportHtml } = await import("./generate-daily-report.js");
    const watchlistJudgmentFixture = {
      date: validMeetingResult.date,
      generatedAt: "2026-06-24T08:00:00.000Z",
      judgments: [
        { ticker: "SNOW", todayAction: "wait" as const, rationale: "根拠", signals: [] },
      ],
    };
    const html = generateDailyReportHtml(
      validMeetingResult, [], [], marketDataDefault,
      watchlistJudgmentFixture, {},
    );
    // 他セクション（verdict/trend色等）で #10b981 が使われうるため、ウォッチリストセクションのみを切り出して検証する
    const sectionStart = html.indexOf("ウォッチリスト 買いタイミング判定");
    const sectionEnd = html.indexOf("<hr>", sectionStart);
    const sectionHtml = html.slice(sectionStart, sectionEnd === -1 ? undefined : sectionEnd);
    expect(sectionHtml).not.toContain("#10b981");
    expect(sectionHtml).toContain("#9ca3af");
  });

  it("Test 42: market: US の銘柄で「前日終値時点」が asOf 値とともに含まれる", async () => {
    const { generateDailyReportHtml } = await import("./generate-daily-report.js");
    const watchlistJudgmentFixture = {
      date: validMeetingResult.date,
      generatedAt: "2026-06-24T08:00:00.000Z",
      judgments: [
        {
          ticker: "PLTR", todayAction: "buy" as const, rationale: "根拠", signals: [],
          asOf: "2026-06-23T20:00:00.000Z", market: "US" as const,
        },
      ],
    };
    const html = generateDailyReportHtml(
      validMeetingResult, [], [], marketDataDefault,
      watchlistJudgmentFixture, {},
    );
    expect(html).toContain("前日終値時点");
    expect(html).toContain("2026-06-23T20:00:00.000Z");
  });

  it("Test 43: market: JP の銘柄で「寄付き前時点」が asOf 値とともに含まれる", async () => {
    const { generateDailyReportHtml } = await import("./generate-daily-report.js");
    const watchlistJudgmentFixture = {
      date: validMeetingResult.date,
      generatedAt: "2026-06-24T08:00:00.000Z",
      judgments: [
        {
          ticker: "7203.T", todayAction: "wait" as const, rationale: "根拠", signals: [],
          asOf: "2026-06-24T00:00:00.000Z", market: "JP" as const,
        },
      ],
    };
    const html = generateDailyReportHtml(
      validMeetingResult, [], [], marketDataDefault,
      watchlistJudgmentFixture, {},
    );
    expect(html).toContain("寄付き前時点");
    expect(html).toContain("2026-06-24T00:00:00.000Z");
  });

  it("Test 44: signals 配列の各要素が .ticker-pill クラスの span として描画される", async () => {
    const { generateDailyReportHtml } = await import("./generate-daily-report.js");
    const watchlistJudgmentFixture = {
      date: validMeetingResult.date,
      generatedAt: "2026-06-24T08:00:00.000Z",
      judgments: [
        { ticker: "PLTR", todayAction: "buy" as const, rationale: "根拠", signals: ["MA上抜け", "出来高急増"] },
      ],
    };
    const html = generateDailyReportHtml(
      validMeetingResult, [], [], marketDataDefault,
      watchlistJudgmentFixture, {},
    );
    expect(html).toContain('<span class="ticker-pill">MA上抜け</span>');
    expect(html).toContain('<span class="ticker-pill">出来高急増</span>');
  });

  it("Test 45: watchlist エントリに addedDate があるとき「登録日:」プレフィックス付きで含まれる", async () => {
    const { generateDailyReportHtml } = await import("./generate-daily-report.js");
    const watchlistJudgmentFixture = {
      date: validMeetingResult.date,
      generatedAt: "2026-06-24T08:00:00.000Z",
      judgments: [
        { ticker: "PLTR", todayAction: "buy" as const, rationale: "根拠", signals: [] },
      ],
    };
    const watchlistFixture = {
      PLTR: { ticker: "PLTR", nameJa: "パランティア", addedDate: "2026-06-10", history: [] },
    };
    const html = generateDailyReportHtml(
      validMeetingResult, [], [], marketDataDefault,
      watchlistJudgmentFixture, watchlistFixture,
    );
    expect(html).toContain("登録日:");
    expect(html).toContain("2026-06-10");
  });

  it("Test 46: status: skipped の銘柄は「判定不能（データ不足）」文言とグレー系スタイルで描画され buy/wait バッジは出さない", async () => {
    const { generateDailyReportHtml } = await import("./generate-daily-report.js");
    const watchlistJudgmentFixture = {
      date: validMeetingResult.date,
      generatedAt: "2026-06-24T08:00:00.000Z",
      judgments: [
        {
          ticker: "PLTR", todayAction: "wait" as const, rationale: "根拠", signals: [],
          status: "skipped" as const,
        },
      ],
    };
    const html = generateDailyReportHtml(
      validMeetingResult, [], [], marketDataDefault,
      watchlistJudgmentFixture, {},
    );
    expect(html).toContain("判定不能（データ不足）");
    expect(html).toContain("border-left-color:#4b5563");
    expect(html).toContain("opacity:0.7");
    expect(html).not.toContain("今日買うべき");
    expect(html).not.toContain('style="color:#9ca3af;font-size:0.8rem;margin-left:0.5rem;">待ち</span>');
  });

  it("Test 47: 変化バッジ 待ち→買い（actionChanged: true, previousAction: wait, todayAction: buy）で「シグナル点灯: 待ち → 買い」文言かつ緑系バッジ", async () => {
    const { generateDailyReportHtml } = await import("./generate-daily-report.js");
    const watchlistJudgmentFixture = {
      date: validMeetingResult.date,
      generatedAt: "2026-06-24T08:00:00.000Z",
      judgments: [
        {
          ticker: "PLTR", todayAction: "buy" as const, rationale: "根拠", signals: [],
          actionChanged: true, previousAction: "wait" as const,
        },
      ],
    };
    const html = generateDailyReportHtml(
      validMeetingResult, [], [], marketDataDefault,
      watchlistJudgmentFixture, {},
    );
    expect(html).toContain("シグナル点灯: 待ち → 買い");
  });

  it("Test 48: 変化バッジ 買い→待ち（actionChanged: true, previousAction: buy, todayAction: wait）で「買い → 待ち」文言かつアンバーバッジ", async () => {
    const { generateDailyReportHtml } = await import("./generate-daily-report.js");
    const watchlistJudgmentFixture = {
      date: validMeetingResult.date,
      generatedAt: "2026-06-24T08:00:00.000Z",
      judgments: [
        {
          ticker: "PLTR", todayAction: "wait" as const, rationale: "根拠", signals: [],
          actionChanged: true, previousAction: "buy" as const,
        },
      ],
    };
    const html = generateDailyReportHtml(
      validMeetingResult, [], [], marketDataDefault,
      watchlistJudgmentFixture, {},
    );
    expect(html).toContain("買い → 待ち");
    expect(html).toContain("#f59e0b");
  });

  it("Test 49: 変化バッジ非表示 undefined — actionChanged 未設定で変化バッジ文言が一切含まれない", async () => {
    const { generateDailyReportHtml } = await import("./generate-daily-report.js");
    const watchlistJudgmentFixture = {
      date: validMeetingResult.date,
      generatedAt: "2026-06-24T08:00:00.000Z",
      judgments: [
        { ticker: "PLTR", todayAction: "buy" as const, rationale: "根拠", signals: [] },
      ],
    };
    const html = generateDailyReportHtml(
      validMeetingResult, [], [], marketDataDefault,
      watchlistJudgmentFixture, {},
    );
    expect(html).not.toContain("シグナル点灯");
    expect(html).not.toContain("買い → 待ち");
  });

  it("Test 50: 変化バッジ非表示 false — actionChanged: false で変化バッジ文言が一切含まれない", async () => {
    const { generateDailyReportHtml } = await import("./generate-daily-report.js");
    const watchlistJudgmentFixture = {
      date: validMeetingResult.date,
      generatedAt: "2026-06-24T08:00:00.000Z",
      judgments: [
        {
          ticker: "PLTR", todayAction: "buy" as const, rationale: "根拠", signals: [],
          actionChanged: false, previousAction: "wait" as const,
        },
      ],
    };
    const html = generateDailyReportHtml(
      validMeetingResult, [], [], marketDataDefault,
      watchlistJudgmentFixture, {},
    );
    expect(html).not.toContain("シグナル点灯");
    expect(html).not.toContain("買い → 待ち");
  });

  it("Test 51: watchlist に該当 ticker のエントリが無い銘柄は見出しがティッカーのみ（会社名フォールバック）", async () => {
    const { generateDailyReportHtml } = await import("./generate-daily-report.js");
    const watchlistJudgmentFixture = {
      date: validMeetingResult.date,
      generatedAt: "2026-06-24T08:00:00.000Z",
      judgments: [
        { ticker: "UNKNOWNTICKER", todayAction: "buy" as const, rationale: "根拠", signals: [] },
      ],
    };
    const html = generateDailyReportHtml(
      validMeetingResult, [], [], marketDataDefault,
      watchlistJudgmentFixture, {},
    );
    expect(html).toContain("UNKNOWNTICKER");
    expect(html).not.toContain("UNKNOWNTICKER —");
  });

  it("Test 52: judgment.ticker が大文字小文字混在でも watchlist の正規化キーと join され会社名が解決される", async () => {
    const { generateDailyReportHtml } = await import("./generate-daily-report.js");
    const watchlistJudgmentFixture = {
      date: validMeetingResult.date,
      generatedAt: "2026-06-24T08:00:00.000Z",
      judgments: [
        { ticker: "pLtR", todayAction: "buy" as const, rationale: "根拠", signals: [] },
      ],
    };
    const watchlistFixture = {
      PLTR: { ticker: "PLTR", nameJa: "パランティア", history: [] },
    };
    const html = generateDailyReportHtml(
      validMeetingResult, [], [], marketDataDefault,
      watchlistJudgmentFixture, watchlistFixture,
    );
    expect(html).toContain("パランティア");
  });

  it("Test 53: generateDailyReportHtml を3引数で呼んでも throw せず HTML を返す（後方互換）", async () => {
    const { generateDailyReportHtml } = await import("./generate-daily-report.js");
    const html = generateDailyReportHtml(validMeetingResult, [], []);
    expect(typeof html).toBe("string");
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).not.toContain("ウォッチリスト 買いタイミング判定");
  });

  it("Test 54: generateDailyReportHtml を4引数で呼んでも throw せず HTML を返す（後方互換）", async () => {
    const { generateDailyReportHtml } = await import("./generate-daily-report.js");
    const html = generateDailyReportHtml(validMeetingResult, [], [], marketDataDefault);
    expect(typeof html).toBe("string");
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).not.toContain("ウォッチリスト 買いタイミング判定");
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

  it("Test 30: HTML に新規組入候補セクションが含まれない (UI-08、通常パス)", async () => {
    const { generatePortfolioReportHtml } = await import("./generate-portfolio-report.js");
    const html = generatePortfolioReportHtml(validMeetingResult, validPortfolioAnalysis);
    expect(html).not.toContain("新規組入候補");
    expect(html).not.toContain("Daily Reportのアナリストミーティングで推奨された銘柄です");
    // highlightedStocks 由来データの流出再発検出 (WR-01): validPortfolioAnalysis は PLTR を含まないため安全に非存在を検証できる
    expect(html).not.toContain("PLTR");
    expect(html).not.toContain("スコアリングマトリクス");
  });

  it("Test 31: portfolioAnalysis が null の場合フォールバック HTML を返す", async () => {
    const { generatePortfolioReportHtml } = await import("./generate-portfolio-report.js");
    const html = generatePortfolioReportHtml(validMeetingResult, null);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("Portfolio Report");
    expect(html).not.toContain("保有銘柄 個別評価");
    expect(html).not.toContain("新規組入候補");
    // フォールバックパスも Test 30 と対称に highlightedStocks 由来データの非存在を検証 (WR-01)
    expect(html).not.toContain("PLTR");
    expect(html).not.toContain("Daily Reportのアナリストミーティングで推奨された銘柄です");
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

// Weekly urgency rollup fixtures (HIST-03) — anchored on validMeetingResult.date ("2026-06-24"),
// window is [2026-06-18, 2026-06-24] inclusive (D-01).
const historyWithMovement: UrgencyHistoryFile = {
  "2026-06-22": [{ symbol: "MRNA", nameJa: "モデルナ", urgent: true, decision: "保持" }],
  "2026-06-23": [{ symbol: "MRNA", nameJa: "モデルナ", urgent: false, decision: "一部売却" }],
  "2026-06-24": [{ symbol: "MRNA", nameJa: "モデルナ", urgent: true, decision: "一部売却" }],
};

const historyFullWeekMovement: UrgencyHistoryFile = {
  "2026-06-18": [{ symbol: "MRNA", nameJa: "モデルナ", urgent: false, decision: "保持" }],
  "2026-06-19": [{ symbol: "MRNA", nameJa: "モデルナ", urgent: false, decision: "保持" }],
  "2026-06-20": [{ symbol: "MRNA", nameJa: "モデルナ", urgent: false, decision: "保持" }],
  "2026-06-21": [{ symbol: "MRNA", nameJa: "モデルナ", urgent: false, decision: "保持" }],
  ...historyWithMovement,
};

const historyZeroMovement: UrgencyHistoryFile = {
  "2026-06-24": [{ symbol: "MRNA", nameJa: "モデルナ", urgent: false, decision: "保持" }],
};

describe("Weekly urgency rollup (HIST-03)", () => {
  it("rollup: 2引数呼び出しでも 3引数呼び出しでも後方互換で HTML を返す（4th引数省略）", async () => {
    const { generatePortfolioReportHtml } = await import("./generate-portfolio-report.js");
    const html2 = generatePortfolioReportHtml(validMeetingResult, validPortfolioAnalysis);
    expect(html2).toContain("<!DOCTYPE html>");
    const html3 = generatePortfolioReportHtml(validMeetingResult, validPortfolioAnalysis, {});
    expect(html3).toContain("<!DOCTYPE html>");
  });

  it("rollup: Tier1 空状態 — 履歴が空の場合、見出しと定型の空メッセージが表示される", async () => {
    const { generatePortfolioReportHtml } = await import("./generate-portfolio-report.js");
    const html = generatePortfolioReportHtml(validMeetingResult, validPortfolioAnalysis);
    expect(html).toContain("今週の緊急・判断変更ロールアップ");
    expect(html).toContain("まだ緊急フラグ・判断変更の履歴がありません（履歴は日次で蓄積されます）");
  });

  it("WR-02/WR-05: 不正キーのみの history では Tier1（履歴なし）が正しく選択される", async () => {
    const { generatePortfolioReportHtml } = await import("./generate-portfolio-report.js");
    const historyOnlyInvalidKeys = {
      "__proto__": [{ symbol: "MRNA", nameJa: "モデルナ", urgent: true, decision: "保持" }],
      "not-a-date": [{ symbol: "MRNA", nameJa: "モデルナ", urgent: true, decision: "保持" }],
    } as unknown as UrgencyHistoryFile;
    const html = generatePortfolioReportHtml(validMeetingResult, validPortfolioAnalysis, {}, historyOnlyInvalidKeys);
    expect(html).toContain("まだ緊急フラグ・判断変更の履歴がありません（履歴は日次で蓄積されます）");
    expect(html).not.toContain("今週は緊急フラグ・判断変更はありませんでした");
  });

  it("rollup: Tier2 空状態 — 履歴はあるが窓内の動きがゼロの場合、定型メッセージが表示される", async () => {
    const { generatePortfolioReportHtml } = await import("./generate-portfolio-report.js");
    const html = generatePortfolioReportHtml(validMeetingResult, validPortfolioAnalysis, {}, historyZeroMovement);
    expect(html).toContain("今週の緊急・判断変更ロールアップ");
    expect(html).toContain("今週は緊急フラグ・判断変更はありませんでした");
  });

  it("rollup: Tier3 部分フッター — daysCovered<7 かつ動きありの場合、正しい日数の脚注が表示される", async () => {
    const { generatePortfolioReportHtml } = await import("./generate-portfolio-report.js");
    const html = generatePortfolioReportHtml(validMeetingResult, validPortfolioAnalysis, {}, historyWithMovement);
    expect(html).toContain("（過去3日分の履歴に基づく）");
  });

  it("rollup: daysCovered===7 の場合は部分フッターが表示されない", async () => {
    const { generatePortfolioReportHtml } = await import("./generate-portfolio-report.js");
    const html = generatePortfolioReportHtml(validMeetingResult, validPortfolioAnalysis, {}, historyFullWeekMovement);
    expect(html).not.toContain("履歴に基づく");
  });

  it("rollup: 銘柄カードに緊急フラグ日付・判断変更行・色が正しく描画される", async () => {
    const { generatePortfolioReportHtml } = await import("./generate-portfolio-report.js");
    const html = generatePortfolioReportHtml(validMeetingResult, validPortfolioAnalysis, {}, historyWithMovement);
    expect(html).toContain("⚠ 緊急フラグ: 06/22, 06/24");
    expect(html).toContain("判断変更: 06/23 保持 → 一部売却");
    expect(html).toContain("#ef4444");
    expect(html).toContain("#f59e0b");
  });

  it("rollup: symbol/nameJa に含まれる <script> がエスケープされる", async () => {
    const { generatePortfolioReportHtml } = await import("./generate-portfolio-report.js");
    const historyWithScript: UrgencyHistoryFile = {
      "2026-06-24": [{ symbol: "<script>evil</script>", nameJa: "<img src=x onerror=alert(1)>", urgent: true, decision: "保持" }],
    };
    const html = generatePortfolioReportHtml(validMeetingResult, validPortfolioAnalysis, {}, historyWithScript);
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>evil</script>");
  });

  it("CR-03/WR-05: nameJa が非文字列のスナップショットが混在しても throw せず正常な要素のみ描画される", async () => {
    const { generatePortfolioReportHtml } = await import("./generate-portfolio-report.js");
    const historyWithCorruptNameJa: UrgencyHistoryFile = {
      "2026-06-24": [
        { symbol: "CORRUPT", nameJa: 12345, urgent: true, decision: "保持" } as unknown as HoldingUrgencySnapshot,
        { symbol: "MRNA", nameJa: "モデルナ", urgent: true, decision: "保持" },
      ],
    };
    expect(() =>
      generatePortfolioReportHtml(validMeetingResult, validPortfolioAnalysis, {}, historyWithCorruptNameJa),
    ).not.toThrow();
    const html = generatePortfolioReportHtml(validMeetingResult, validPortfolioAnalysis, {}, historyWithCorruptNameJa);
    expect(html).toContain("モデルナ");
    expect(html).not.toContain("CORRUPT");
  });

  it("rollup: portfolioAnalysis === null でもフェイルソフトでロールアップが描画される", async () => {
    const { generatePortfolioReportHtml } = await import("./generate-portfolio-report.js");
    const html = generatePortfolioReportHtml(validMeetingResult, null, {}, historyWithMovement);
    expect(html).toContain("今週の緊急・判断変更ロールアップ");
    expect(html).toContain("⚠ 緊急フラグ: 06/22, 06/24");
    expect(html).toContain("判断変更: 06/23 保持 → 一部売却");
  });

  it("rollup: セクション順序 — 総括コメントの後、保有銘柄 個別評価の前に配置される", async () => {
    const { generatePortfolioReportHtml } = await import("./generate-portfolio-report.js");
    const html = generatePortfolioReportHtml(validMeetingResult, validPortfolioAnalysis, {}, historyWithMovement);
    const rollupIndex = html.indexOf("今週の緊急・判断変更ロールアップ");
    const overallCommentIndex = html.indexOf("総括コメント");
    const holdingsIndex = html.indexOf("保有銘柄 個別評価");
    expect(rollupIndex).toBeGreaterThan(-1);
    expect(overallCommentIndex).toBeGreaterThan(-1);
    expect(holdingsIndex).toBeGreaterThan(-1);
    expect(rollupIndex).toBeGreaterThan(overallCommentIndex);
    expect(rollupIndex).toBeLessThan(holdingsIndex);
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
    // WR-02: restoreAllMocks はモジュールトップレベルの process.exit スパイと
    // vi.mock ファクトリの fs モック実装まで破壊し順序依存を生むため、
    // 呼び出し履歴のみクリアする clearAllMocks を使う（実装とスパイは維持）
    vi.clearAllMocks();
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

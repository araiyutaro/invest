import { describe, it, expect, vi, afterEach } from "vitest";
import {
  validateRawNewsCuration,
  resolveNewsCuration,
  webSearchResultSchema,
  validateWebSearchResult,
  holdingEvaluationSchema,
  portfolioAnalysisSchema,
} from "./schemas.js";
import type { NewsArticlePoolEntry, RawNewsCuration } from "./schemas.js";

const validRawCuration = {
  leadIn: "今日の市場を動かすものはFOMC議事要旨と半導体決算。",
  articles: [
    {
      id: "n01",
      market: "us",
      importance: "high",
      commentary: "FOMC議事要旨は利下げペースの手掛かりとなる。",
      tickers: ["AAPL"],
    },
    {
      id: "n02",
      market: "japan",
      importance: "medium",
      commentary: "日銀の追加利上げ観測が円高圧力を強めている。",
      tickers: [],
    },
    {
      id: "n03",
      market: "global",
      importance: "low",
      commentary: "原油価格の緩やかな下落基調が続く。",
      tickers: [],
    },
  ],
};

describe("validateRawNewsCuration", () => {
  it("正常系: us/japan/global・high/medium/low を持つ有効なJSONがthrowせず通過する", () => {
    expect(() => validateRawNewsCuration(validRawCuration)).not.toThrow();
    const result = validateRawNewsCuration(validRawCuration);
    expect(result.articles).toHaveLength(3);
    expect(result.articles[0]?.market).toBe("us");
    expect(result.articles[0]?.importance).toBe("high");
  });

  it("欠落耐性: articles省略時に空配列が補完される", () => {
    const withoutArticles = { leadIn: "リード文のみ" };
    expect(() => validateRawNewsCuration(withoutArticles)).not.toThrow();
    const result = validateRawNewsCuration(withoutArticles);
    expect(result.articles).toEqual([]);
  });

  it("欠落耐性: commentary/tickers省略時にデフォルト補完される（''/[]）", () => {
    const withoutOptional = {
      leadIn: "",
      articles: [{ id: "n01", market: "us", importance: "high" }],
    };
    expect(() => validateRawNewsCuration(withoutOptional)).not.toThrow();
    const result = validateRawNewsCuration(withoutOptional);
    expect(result.articles[0]?.commentary).toBe("");
    expect(result.articles[0]?.tickers).toEqual([]);
  });

  it("未知フィールド許容: 追加の未知フィールドを含んでもthrowしない（passthrough）", () => {
    const withUnknown = {
      ...validRawCuration,
      unknownTopLevelField: "無視されるはず",
      articles: [
        { ...validRawCuration.articles[0], unknownArticleField: "無視されるはず" },
      ],
    };
    expect(() => validateRawNewsCuration(withUnknown)).not.toThrow();
  });
});

describe("market enum", () => {
  it.each(["US", "米国", "europe"])(
    "異常系: marketが不正値 \"%s\" のときthrowする",
    (invalidMarket) => {
      const invalidData = {
        ...validRawCuration,
        articles: [{ ...validRawCuration.articles[0], market: invalidMarket }],
      };
      expect(() => validateRawNewsCuration(invalidData)).toThrow();
    },
  );

  it("異常系: importanceが範囲外（\"critical\"）のときthrowする", () => {
    const invalidData = {
      ...validRawCuration,
      articles: [{ ...validRawCuration.articles[0], importance: "critical" }],
    };
    expect(() => validateRawNewsCuration(invalidData)).toThrow();
  });
});

// --- resolveNewsCuration ---

const makePoolEntry = (overrides: Partial<NewsArticlePoolEntry>): NewsArticlePoolEntry => ({
  id: "n01",
  title: "デフォルトタイトル",
  url: "https://example.com/article",
  source: "TestSource",
  publishedAt: "2026-07-02T09:00:00.000Z",
  ...overrides,
});

const makeRawArticle = (
  overrides: Partial<RawNewsCuration["articles"][number]>,
): RawNewsCuration["articles"][number] => ({
  id: "n01",
  market: "us",
  importance: "high",
  commentary: "重要な理由の説明。",
  tickers: [],
  tickerNames: {},
  ...overrides,
});

const DATE = "2026-07-02";
const GENERATED_AT = "2026-07-02T09:00:00.000Z";

describe("resolveNewsCuration", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("プール実在IDのtitle/url/source/publishedAtが正しく解決される（LLM出力のtitle/urlは使わない）", () => {
    const pool = [
      makePoolEntry({
        id: "n01",
        title: "実際のタイトル",
        url: "https://real.example.com/n01",
        source: "Nikkei",
        publishedAt: "2026-07-01T23:00:00.000Z",
      }),
    ];
    const raw: RawNewsCuration = {
      leadIn: "本日のリード文",
      articles: [makeRawArticle({ id: "n01" })],
    };
    const result = resolveNewsCuration(raw, pool, DATE, GENERATED_AT);
    expect(result.articles).toHaveLength(1);
    expect(result.articles[0]).toMatchObject({
      id: "n01",
      title: "実際のタイトル",
      url: "https://real.example.com/n01",
      source: "Nikkei",
      publishedAt: "2026-07-01T23:00:00.000Z",
    });
    expect(result.date).toBe(DATE);
    expect(result.generatedAt).toBe(GENERATED_AT);
    expect(result.leadIn).toBe("本日のリード文");
  });

  it("不明ID: pool に無い id は drop され console.warn が出る", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const pool = [makePoolEntry({ id: "n01" })];
    const raw: RawNewsCuration = {
      leadIn: "",
      articles: [makeRawArticle({ id: "n01" }), makeRawArticle({ id: "n99" })],
    };
    const result = resolveNewsCuration(raw, pool, DATE, GENERATED_AT);
    expect(result.articles).toHaveLength(1);
    expect(result.articles[0]?.id).toBe("n01");
    expect(warnSpy).toHaveBeenCalled();
  });

  it("重複ID: 同一idは初出のみ採用、2回目以降drop+warn", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const pool = [makePoolEntry({ id: "n01" })];
    const raw: RawNewsCuration = {
      leadIn: "",
      articles: [makeRawArticle({ id: "n01" }), makeRawArticle({ id: "n01" })],
    };
    const result = resolveNewsCuration(raw, pool, DATE, GENERATED_AT);
    expect(result.articles).toHaveLength(1);
    expect(warnSpy).toHaveBeenCalled();
  });

  it("空commentary: commentaryが空文字/空白のみの記事はdrop+warn（D-10）", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const pool = [makePoolEntry({ id: "n01" }), makePoolEntry({ id: "n02" })];
    const raw: RawNewsCuration = {
      leadIn: "",
      articles: [
        makeRawArticle({ id: "n01", commentary: "" }),
        makeRawArticle({ id: "n02", commentary: "   " }),
      ],
    };
    const result = resolveNewsCuration(raw, pool, DATE, GENERATED_AT);
    expect(result.articles).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalled();
  });

  it("16件→15件truncate: Agent自身の順序で上位15件にslice（再ソートなし、D-03）", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const ids = Array.from({ length: 16 }, (_, i) => `n${String(i + 1).padStart(2, "0")}`);
    const pool = ids.map((id) => makePoolEntry({ id }));
    const raw: RawNewsCuration = {
      leadIn: "",
      articles: ids.map((id) => makeRawArticle({ id })),
    };
    const result = resolveNewsCuration(raw, pool, DATE, GENERATED_AT);
    expect(result.articles).toHaveLength(15);
    expect(result.articles.map((a) => a.id)).toEqual(ids.slice(0, 15));
    expect(warnSpy).toHaveBeenCalled();
  });

  it("9件受理: 選定10件未満でもconsole.warnのみでそのまま受理される（D-04）", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const ids = Array.from({ length: 9 }, (_, i) => `n${String(i + 1).padStart(2, "0")}`);
    const pool = ids.map((id) => makePoolEntry({ id }));
    const raw: RawNewsCuration = {
      leadIn: "",
      articles: ids.map((id) => makeRawArticle({ id })),
    };
    const result = resolveNewsCuration(raw, pool, DATE, GENERATED_AT);
    expect(result.articles).toHaveLength(9);
    expect(warnSpy).toHaveBeenCalled();
  });

  it("0件受理: 選定0件も有効な契約として受理され、空articlesのNewsCurationが返る（D-05）", () => {
    const raw: RawNewsCuration = { leadIn: "本日は厳選記事なし", articles: [] };
    const result = resolveNewsCuration(raw, [], DATE, GENERATED_AT);
    expect(result.articles).toEqual([]);
    expect(result.leadIn).toBe("本日は厳選記事なし");
  });

  it("ticker マージ: プールのtickerとLLMのtickersを重複排除して結合する（CURA-08）", () => {
    const pool = [makePoolEntry({ id: "n01", ticker: "AAPL" })];
    const raw: RawNewsCuration = {
      leadIn: "",
      articles: [makeRawArticle({ id: "n01", tickers: ["AAPL", "MSFT"] })],
    };
    const result = resolveNewsCuration(raw, pool, DATE, GENERATED_AT);
    expect(result.articles[0]?.tickers).toEqual(["AAPL", "MSFT"]);
  });

  it("数値ticker除外: プールのtickerが数値（finnhub merger/business記事の実データ形状）の場合はマージせず、tickersは文字列のみになる", () => {
    // tmp/news.json の merger/business カテゴリは ticker に数値インデックス（0〜9）を持つ。
    // 型宣言（ticker?: string）と実データの不一致により、数値がtickersへ混入すると
    // レンダラーの escapeHtml が text.replace TypeError で落ちる（2026-07-03 ライブ検証で検出）。
    const pool = [
      makePoolEntry({ id: "n01", ticker: 4 as unknown as string }),
      makePoolEntry({ id: "n02", ticker: 0 as unknown as string }),
    ];
    const raw: RawNewsCuration = {
      leadIn: "",
      articles: [
        makeRawArticle({ id: "n01", tickers: ["LMT"] }),
        makeRawArticle({ id: "n02", tickers: [] }),
      ],
    };
    const result = resolveNewsCuration(raw, pool, DATE, GENERATED_AT);
    expect(result.articles[0]?.tickers).toEqual(["LMT"]);
    expect(result.articles[1]?.tickers).toEqual([]);
    for (const a of result.articles) {
      for (const t of a.tickers) {
        expect(typeof t).toBe("string");
      }
    }
  });

  it("tickerNames透過: raw articleのtickerNamesが解決後のCuratedArticleにそのまま透過される（D-04）", () => {
    const pool = [makePoolEntry({ id: "n01" })];
    const raw: RawNewsCuration = {
      leadIn: "",
      articles: [
        makeRawArticle({ id: "n01", tickers: ["NVDA"], tickerNames: { NVDA: "エヌビディア" } }),
      ],
    };
    const result = resolveNewsCuration(raw, pool, DATE, GENERATED_AT);
    expect(result.articles[0]?.tickerNames).toEqual({ NVDA: "エヌビディア" });
  });

  it("tickerNames省略時: デフォルトの空オブジェクト{}になる", () => {
    const pool = [makePoolEntry({ id: "n01" })];
    const rawJson = {
      leadIn: "",
      articles: [{ id: "n01", market: "us", importance: "high", commentary: "説明。" }],
    };
    const validated = validateRawNewsCuration(rawJson);
    const result = resolveNewsCuration(validated, pool, DATE, GENERATED_AT);
    expect(result.articles[0]?.tickerNames).toEqual({});
  });

  it("resolveNewsCurationはいかなる入力でもthrowしない（不明ID+空commentary+16件超が同時発生しても）", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const ids = Array.from({ length: 16 }, (_, i) => `n${String(i + 1).padStart(2, "0")}`);
    const pool = ids.slice(0, 15).map((id) => makePoolEntry({ id })); // n16はpool不在
    const raw: RawNewsCuration = {
      leadIn: "",
      articles: [
        ...ids.map((id) => makeRawArticle({ id })),
        makeRawArticle({ id: "n01", commentary: "" }), // 空commentary
      ],
    };
    expect(() => resolveNewsCuration(raw, pool, DATE, GENERATED_AT)).not.toThrow();
  });
});

// --- webSearchResultSchema (Phase 21: PORT-02 / D-12 alias-transform hardening) ---

describe("webSearchResultSchema", () => {
  it("正常系: 正準フィールドのみの入力がthrowせず通過し、6フィールドが正準形で返る", () => {
    const canonical = {
      ticker: "PLTR",
      researchSummary: "AI需要拡大で成長加速。",
      positiveFindings: ["売上前年比40%増"],
      negativeFindings: ["バリュエーション割高"],
      keyArticles: [{ title: "Palantir Q1 Earnings", summary: "AI Platform部門が急成長" }],
      researchedAt: "2026-07-03T07:00:00.000Z",
    };
    expect(() => webSearchResultSchema.parse(canonical)).not.toThrow();
    const result = webSearchResultSchema.parse(canonical);
    expect(result).toEqual(canonical);
  });

  it("エイリアス受理: summary→researchSummary が解決される", () => {
    const result = webSearchResultSchema.parse({
      ticker: "NVDA",
      summary: "エイリアス経由のサマリー",
    });
    expect(result.researchSummary).toBe("エイリアス経由のサマリー");
  });

  it("エイリアス受理: findings/positives→positiveFindings が解決される", () => {
    const viaFindings = webSearchResultSchema.parse({
      ticker: "NVDA",
      findings: ["ポジティブ材料A"],
    });
    expect(viaFindings.positiveFindings).toEqual(["ポジティブ材料A"]);

    const viaPositives = webSearchResultSchema.parse({
      ticker: "NVDA",
      positives: ["ポジティブ材料B"],
    });
    expect(viaPositives.positiveFindings).toEqual(["ポジティブ材料B"]);
  });

  it("エイリアス受理: negatives/concerns→negativeFindings が解決される", () => {
    const viaNegatives = webSearchResultSchema.parse({
      ticker: "NVDA",
      negatives: ["リスク材料A"],
    });
    expect(viaNegatives.negativeFindings).toEqual(["リスク材料A"]);

    const viaConcerns = webSearchResultSchema.parse({
      ticker: "NVDA",
      concerns: ["リスク材料B"],
    });
    expect(viaConcerns.negativeFindings).toEqual(["リスク材料B"]);
  });

  it("エイリアス受理: articles→keyArticles が解決される", () => {
    const result = webSearchResultSchema.parse({
      ticker: "NVDA",
      articles: [{ title: "記事タイトル", summary: "記事サマリー" }],
    });
    expect(result.keyArticles).toEqual([{ title: "記事タイトル", summary: "記事サマリー" }]);
  });

  it("keyArticlesフェイルソフト: summary欠落の記事は''補完され、銘柄全体のparseは失敗しない", () => {
    const result = webSearchResultSchema.parse({
      ticker: "EE",
      keyArticles: [{ title: "タイトルのみの記事", url: "https://example.com/article" }],
    });
    expect(result.keyArticles).toEqual([{ title: "タイトルのみの記事", summary: "" }]);
  });

  it("keyArticlesフェイルソフト: title/summary両方欠落（headline等の発明キー）でも空文字補完で受理される", () => {
    const result = webSearchResultSchema.parse({
      ticker: "EE",
      keyArticles: [{ headline: "発明されたキー" }, { title: "正常な記事", summary: "正常なサマリー" }],
    });
    expect(result.keyArticles).toEqual([
      { title: "", summary: "" },
      { title: "正常な記事", summary: "正常なサマリー" },
    ]);
  });

  it("keyArticlesフェイルソフト: オブジェクトでない不正要素はthrowせず除外される", () => {
    const result = webSearchResultSchema.parse({
      ticker: "EE",
      keyArticles: ["文字列要素", null, 42, ["配列要素"], { title: "残る記事", summary: "サマリー" }],
    });
    expect(result.keyArticles).toEqual([{ title: "残る記事", summary: "サマリー" }]);
  });

  it("keyArticlesフェイルソフト: 型不正のtitle/summary（数値等）は''に補完される", () => {
    const result = webSearchResultSchema.parse({
      ticker: "EE",
      keyArticles: [{ title: "タイトル", summary: 123 }],
    });
    expect(result.keyArticles).toEqual([{ title: "タイトル", summary: "" }]);
  });

  it("articlesエイリアスにも記事単位のフェイルソフトが同様に適用される", () => {
    const result = webSearchResultSchema.parse({
      ticker: "EE",
      articles: [{ title: "タイトルのみ" }, "不正要素"],
    });
    expect(result.keyArticles).toEqual([{ title: "タイトルのみ", summary: "" }]);
  });

  it("エイリアス受理: timestamp/date→researchedAt が解決される", () => {
    const viaTimestamp = webSearchResultSchema.parse({
      ticker: "NVDA",
      timestamp: "2026-07-03T08:00:00.000Z",
    });
    expect(viaTimestamp.researchedAt).toBe("2026-07-03T08:00:00.000Z");

    const viaDate = webSearchResultSchema.parse({
      ticker: "NVDA",
      date: "2026-07-03",
    });
    expect(viaDate.researchedAt).toBe("2026-07-03");
  });

  it("欠落耐性: ticker以外の必須フィールド省略時、文字列は''、配列は[]にデフォルト補完される", () => {
    const result = webSearchResultSchema.parse({ ticker: "EE" });
    expect(result).toEqual({
      ticker: "EE",
      researchSummary: "",
      positiveFindings: [],
      negativeFindings: [],
      keyArticles: [],
      researchedAt: "",
    });
  });

  it("未知フィールド許容: 追加の未知トップレベルフィールドを含んでもthrowしない（passthrough）", () => {
    const withUnknown = {
      ticker: "NVDA",
      researchSummary: "サマリー",
      unknownTopLevelField: "無視されるはず",
    };
    expect(() => webSearchResultSchema.parse(withUnknown)).not.toThrow();
  });

  it("フォールバックJSON: Step 3-Pのフォールバック形状がthrowせず通過する", () => {
    const fallback = {
      ticker: "EE",
      researchSummary: "リサーチ失敗",
      positiveFindings: [],
      negativeFindings: [],
      keyArticles: [],
      researchedAt: "2026-07-03T09:00:00.000Z",
    };
    expect(() => webSearchResultSchema.parse(fallback)).not.toThrow();
    const result = webSearchResultSchema.parse(fallback);
    expect(result.researchSummary).toBe("リサーチ失敗");
  });

  it("後方互換: validateWebSearchResultのシグネチャと戻り型（WebSearchResult）は不変", () => {
    const canonical = {
      ticker: "PLTR",
      researchSummary: "サマリー",
      positiveFindings: [],
      negativeFindings: [],
      keyArticles: [],
      researchedAt: "2026-07-03T07:00:00.000Z",
    };
    const result = validateWebSearchResult(canonical);
    expect(result.ticker).toBe("PLTR");
    expect(result.researchSummary).toBe("サマリー");
  });
});

describe("holdingEvaluationSchema", () => {
  const minimalInput = {
    symbol: "PLTR",
    nameJa: "パランティア",
    decision: "保持",
    rationale: "堅調な成長が続いている。",
  };

  it("urgent省略時: デフォルトでfalseになる（D-08）", () => {
    const result = holdingEvaluationSchema.parse(minimalInput);
    expect(result.urgent).toBe(false);
  });

  it("エイリアス受理: urgent がそのまま true として解決される（D-10）", () => {
    const result = holdingEvaluationSchema.parse({ ...minimalInput, urgent: true });
    expect(result.urgent).toBe(true);
  });

  it("エイリアス受理: urgency→urgent が解決される（D-10）", () => {
    const result = holdingEvaluationSchema.parse({ ...minimalInput, urgency: true });
    expect(result.urgent).toBe(true);
  });

  it("エイリアス受理: isUrgent→urgent が解決される（D-10）", () => {
    const result = holdingEvaluationSchema.parse({ ...minimalInput, isUrgent: true });
    expect(result.urgent).toBe(true);
  });

  it("エイリアス受理: urgentFlag→urgent が解決される（D-10）", () => {
    const result = holdingEvaluationSchema.parse({ ...minimalInput, urgentFlag: true });
    expect(result.urgent).toBe(true);
  });

  it("strip: LLMが誤ってdecisionChanged/previousDecisionを出力してもtransform後には存在しない（D-11、PORT-05）", () => {
    const result = holdingEvaluationSchema.parse({
      ...minimalInput,
      decisionChanged: true,
      previousDecision: "買増",
    });
    expect(result).not.toHaveProperty("decisionChanged");
    expect(result).not.toHaveProperty("previousDecision");
  });

  it("寛容boolean: urgent が文字列 \"true\" でも true に矯正される（WR-01）", () => {
    const result = holdingEvaluationSchema.parse({ ...minimalInput, urgent: "true" });
    expect(result.urgent).toBe(true);
  });

  it("寛容boolean: urgency が文字列 \"false\" でも false に矯正される（WR-01）", () => {
    const result = holdingEvaluationSchema.parse({ ...minimalInput, urgency: "false" });
    expect(result.urgent).toBe(false);
  });
});

describe("portfolioAnalysisSchema（per-holding fail-soft, WR-01）", () => {
  const validHolding = {
    symbol: "PLTR",
    nameJa: "パランティア",
    decision: "保持",
    rationale: "堅調な成長が続いている。",
  };

  const basePortfolio = {
    date: "2026-07-03",
    generatedAt: "2026-07-03T00:00:00.000Z",
    overallComment: "テスト",
    rebalanceActions: [],
  };

  it("enum外decisionの1銘柄のみdropされ、残りの銘柄は保持される + console.warn が呼ばれる", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = portfolioAnalysisSchema.parse({
      ...basePortfolio,
      holdings: [
        validHolding,
        { ...validHolding, symbol: "MRNA", decision: "売却" }, // enum外
        { ...validHolding, symbol: "JOBY" },
      ],
    });
    expect(result.holdings).toHaveLength(2);
    expect(result.holdings.map((h) => h.symbol)).toEqual(["PLTR", "JOBY"]);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("MRNA"),
      expect.anything(),
    );
    warnSpy.mockRestore();
  });

  it("非オブジェクト要素（文字列・null）はdropされ、parse全体はthrowしない", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = portfolioAnalysisSchema.parse({
      ...basePortfolio,
      holdings: [validHolding, "not-an-object", null],
    });
    expect(result.holdings).toHaveLength(1);
    expect(result.holdings[0]?.symbol).toBe("PLTR");
    expect(warnSpy).toHaveBeenCalledTimes(2);
    warnSpy.mockRestore();
  });

  it("urgent の文字列型ドリフト（\"true\"）はdropではなく矯正され、銘柄が残る（WR-01）", () => {
    const result = portfolioAnalysisSchema.parse({
      ...basePortfolio,
      holdings: [{ ...validHolding, urgent: "true" }],
    });
    expect(result.holdings).toHaveLength(1);
    expect(result.holdings[0]?.urgent).toBe(true);
  });

  it("strip保証: fail-soft経路でも decisionChanged/previousDecision はstripされる（D-11不変）", () => {
    const result = portfolioAnalysisSchema.parse({
      ...basePortfolio,
      holdings: [{ ...validHolding, decisionChanged: true, previousDecision: "買増" }],
    });
    expect(result.holdings[0]).not.toHaveProperty("decisionChanged");
    expect(result.holdings[0]).not.toHaveProperty("previousDecision");
  });
});

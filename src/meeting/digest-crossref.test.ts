import { describe, it, expect } from "vitest";
import { buildDigestCrossRefMap } from "./digest-crossref.js";
import type { CuratedArticle, MeetingResult, NewsCuration } from "./types.js";

const FIXED_ISO = "2026-07-04T00:00:00.000Z";

const makeCuratedArticle = (
  overrides: Partial<CuratedArticle> & { id: string },
): CuratedArticle => ({
  title: "デフォルトタイトル",
  url: "https://example.com/a",
  source: "TestSource",
  publishedAt: FIXED_ISO,
  market: "us",
  importance: "medium",
  commentary: "",
  tickers: [],
  ...overrides,
});

const makeCuration = (
  articles: ReadonlyArray<CuratedArticle>,
): NewsCuration => ({
  date: "2026-07-04",
  generatedAt: FIXED_ISO,
  leadIn: "今日の市場を動かすもの",
  articles,
});

const makeMeetingResult = (
  overrides: Partial<MeetingResult>,
): MeetingResult => ({
  date: "2026-07-04",
  generatedAt: FIXED_ISO,
  marketOverview: {
    summary: "デフォルト概況",
    trend: "混合",
    keyIndices: [],
  },
  sectorRecommendations: [],
  highlightedStocks: [],
  riskWarnings: [],
  actionItems: [],
  weeklyEvents: [],
  indexInvestorAdvice: "",
  roundSummary: {
    round1Count: 0,
    round2Count: 0,
    round3Count: 0,
    scoredTickers: [],
  },
  ...overrides,
});

describe("digest-crossref ticker match (D-01,D-02,D-05)", () => {
  it("highlightedStocks 一致は symbol + verdict を持つ注記になる", () => {
    const article = makeCuratedArticle({ id: "n01", tickers: ["XLV"] });
    const curation = makeCuration([article]);
    const meetingResult = makeMeetingResult({
      highlightedStocks: [
        {
          ticker: "XLV",
          averageScore: 6.4,
          verdict: "強気",
          summary: "",
          agentScores: [],
          nominatedBy: [],
        },
      ],
    });

    const result = buildDigestCrossRefMap(curation, meetingResult);

    expect(result["n01"].tickerMatches).toEqual([{ symbol: "XLV", verdict: "強気" }]);
    expect(result["n01"].themeMatches).toEqual([]);
  });

  it("scoredTickers のみ一致（highlightedStocks非該当）は verdict なしの注記になる (D-05)", () => {
    const article = makeCuratedArticle({ id: "n02", tickers: ["FXY"] });
    const curation = makeCuration([article]);
    const meetingResult = makeMeetingResult({
      highlightedStocks: [],
      roundSummary: {
        round1Count: 0,
        round2Count: 0,
        round3Count: 0,
        scoredTickers: ["FXY"],
      },
    });

    const result = buildDigestCrossRefMap(curation, meetingResult);

    expect(result["n02"].tickerMatches).toEqual([{ symbol: "FXY" }]);
    expect(result["n02"].tickerMatches[0]).not.toHaveProperty("verdict");
  });

  it("JPティッカー '6326.T' 形式でも normalizeHoldingSymbol により一致する (Pitfall 5)", () => {
    const article = makeCuratedArticle({ id: "n03", tickers: [" 6326.t "] });
    const curation = makeCuration([article]);
    const meetingResult = makeMeetingResult({
      highlightedStocks: [
        {
          ticker: "6326.T",
          averageScore: 6,
          verdict: "強気",
          summary: "",
          agentScores: [],
          nominatedBy: [],
        },
      ],
    });

    const result = buildDigestCrossRefMap(curation, meetingResult);

    expect(result["n03"].tickerMatches).toEqual([{ symbol: "6326.T", verdict: "強気" }]);
  });
});

describe("digest-crossref theme match (D-03,D-06)", () => {
  it("'Name (TICKER)' 形式の実データを括弧除去後にタイトル照合する (Pitfall 1)", () => {
    const article = makeCuratedArticle({
      id: "n04",
      title: "New Healthcare policy shakes markets",
      tickers: [],
    });
    const curation = makeCuration([article]);
    const meetingResult = makeMeetingResult({
      sectorRecommendations: [
        { rank: 1, sector: "Healthcare (XLV)", rationale: "", outlook: "強気" },
      ],
    });

    const result = buildDigestCrossRefMap(curation, meetingResult);

    expect(result["n04"].themeMatches).toEqual([{ keyword: "Healthcare" }]);
    expect(result["n04"].tickerMatches).toEqual([]);
  });

  it("大小文字を区別せずタイトル照合する (D-03)", () => {
    const article = makeCuratedArticle({
      id: "n05",
      title: "why healthcare stocks are rallying today",
      tickers: [],
    });
    const curation = makeCuration([article]);
    const meetingResult = makeMeetingResult({
      sectorRecommendations: [
        { rank: 1, sector: "Healthcare (XLV)", rationale: "", outlook: "強気" },
      ],
    });

    const result = buildDigestCrossRefMap(curation, meetingResult);

    expect(result["n05"].themeMatches).toEqual([{ keyword: "Healthcare" }]);
  });

  it("括弧除去後に空文字になるキーワードはどのタイトルにも一致しない", () => {
    const article = makeCuratedArticle({
      id: "n06",
      title: "This title contains nothing special at all",
      tickers: [],
    });
    const curation = makeCuration([article]);
    const meetingResult = makeMeetingResult({
      sectorRecommendations: [{ rank: 1, sector: "(XLV)", rationale: "", outlook: "強気" }],
    });

    const result = buildDigestCrossRefMap(curation, meetingResult);

    expect(result["n06"]).toBeUndefined();
  });
});

describe("digest-crossref priority (D-04)", () => {
  it("ティッカー一致がある記事はテーマ照合を評価しない（early-continue）", () => {
    const article = makeCuratedArticle({
      id: "n07",
      title: "Healthcare giant XLV reports earnings",
      tickers: ["XLV"],
    });
    const curation = makeCuration([article]);
    const meetingResult = makeMeetingResult({
      highlightedStocks: [
        {
          ticker: "XLV",
          averageScore: 6.4,
          verdict: "強気",
          summary: "",
          agentScores: [],
          nominatedBy: [],
        },
      ],
      sectorRecommendations: [
        { rank: 1, sector: "Healthcare (XLV)", rationale: "", outlook: "強気" },
      ],
    });

    const result = buildDigestCrossRefMap(curation, meetingResult);

    expect(result["n07"].tickerMatches).toEqual([{ symbol: "XLV", verdict: "強気" }]);
    expect(result["n07"].themeMatches).toEqual([]);
  });
});

describe("digest-crossref cap (D-10)", () => {
  it("ティッカー一致は最大2件、元の配列順を維持する", () => {
    const article = makeCuratedArticle({
      id: "n08",
      tickers: ["XLV", "XLF", "XLE"],
    });
    const curation = makeCuration([article]);
    const meetingResult = makeMeetingResult({
      highlightedStocks: [
        {
          ticker: "XLV",
          averageScore: 1,
          verdict: "強気",
          summary: "",
          agentScores: [],
          nominatedBy: [],
        },
        {
          ticker: "XLF",
          averageScore: 1,
          verdict: "中立",
          summary: "",
          agentScores: [],
          nominatedBy: [],
        },
        {
          ticker: "XLE",
          averageScore: 1,
          verdict: "弱気",
          summary: "",
          agentScores: [],
          nominatedBy: [],
        },
      ],
    });

    const result = buildDigestCrossRefMap(curation, meetingResult);

    expect(result["n08"].tickerMatches).toEqual([
      { symbol: "XLV", verdict: "強気" },
      { symbol: "XLF", verdict: "中立" },
    ]);
  });

  it("テーマ一致は最大1件（先頭のsectorRecommendations順）", () => {
    const article = makeCuratedArticle({
      id: "n09",
      title: "Healthcare and Financials both saw strong moves today",
      tickers: [],
    });
    const curation = makeCuration([article]);
    const meetingResult = makeMeetingResult({
      sectorRecommendations: [
        { rank: 1, sector: "Healthcare (XLV)", rationale: "", outlook: "強気" },
        { rank: 2, sector: "Financials (XLF)", rationale: "", outlook: "中立" },
      ],
    });

    const result = buildDigestCrossRefMap(curation, meetingResult);

    expect(result["n09"].themeMatches).toEqual([{ keyword: "Healthcare" }]);
  });
});

describe("digest-crossref fail-soft (D-11)", () => {
  it("空配列のみの meetingResult / curation でも throw せず空マップを返す", () => {
    const curation = makeCuration([]);
    const meetingResult = makeMeetingResult({});

    expect(() => buildDigestCrossRefMap(curation, meetingResult)).not.toThrow();
    expect(buildDigestCrossRefMap(curation, meetingResult)).toEqual({});
  });

  it("一致0件の記事はキーとしてマップに存在しない", () => {
    const article = makeCuratedArticle({
      id: "n10",
      title: "全く無関係な記事タイトル",
      tickers: [],
    });
    const curation = makeCuration([article]);
    const meetingResult = makeMeetingResult({});

    const result = buildDigestCrossRefMap(curation, meetingResult);

    expect(Object.keys(result)).not.toContain("n10");
  });
});

describe("digest-crossref prototype-key safety (CR-01)", () => {
  it("予約語IDの未一致記事は継承プロパティを返さず undefined になる", () => {
    // 記事IDは構造的に n01.. だが、null-prototypeマップにより将来のID源でも
    // Object.prototype 継承（toString等）がlookupで漏れないことを保証する。
    const article = makeCuratedArticle({ id: "toString", title: "無関係", tickers: [] });
    const curation = makeCuration([article]);
    const meetingResult = makeMeetingResult({});

    const result = buildDigestCrossRefMap(curation, meetingResult);

    expect(result["toString"]).toBeUndefined();
    expect((result as Record<string, unknown>)["constructor"]).toBeUndefined();
    expect((result as Record<string, unknown>)["hasOwnProperty"]).toBeUndefined();
  });

  it("予約語IDでも一致があれば正しく注記を返す", () => {
    const article = makeCuratedArticle({ id: "constructor", tickers: ["XLV"] });
    const curation = makeCuration([article]);
    const meetingResult = makeMeetingResult({
      highlightedStocks: [
        { ticker: "XLV", averageScore: 6, verdict: "強気", summary: "", agentScores: [], nominatedBy: [] },
      ],
    });

    const result = buildDigestCrossRefMap(curation, meetingResult);

    expect(result["constructor"].tickerMatches).toEqual([{ symbol: "XLV", verdict: "強気" }]);
  });
});

describe("digest-crossref ticker dedup (WR-01)", () => {
  it("同一シンボルの大小文字・空白ゆらぎは1件に重複排除しキャップ枠を浪費しない", () => {
    const article = makeCuratedArticle({ id: "n11", tickers: ["XLV", " xlv ", "XLF"] });
    const curation = makeCuration([article]);
    const meetingResult = makeMeetingResult({
      highlightedStocks: [
        { ticker: "XLV", averageScore: 6, verdict: "強気", summary: "", agentScores: [], nominatedBy: [] },
        { ticker: "XLF", averageScore: 5, verdict: "中立", summary: "", agentScores: [], nominatedBy: [] },
      ],
    });

    const result = buildDigestCrossRefMap(curation, meetingResult);

    // XLV(重複2件)は1件に集約され、XLFも残る（キャップ2件を "xlv" 重複で浪費しない）
    expect(result["n11"].tickerMatches).toEqual([
      { symbol: "XLV", verdict: "強気" },
      { symbol: "XLF", verdict: "中立" },
    ]);
  });
});

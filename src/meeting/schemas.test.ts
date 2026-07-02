import { describe, it, expect, vi, afterEach } from "vitest";
import { validateRawNewsCuration, resolveNewsCuration } from "./schemas.js";
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

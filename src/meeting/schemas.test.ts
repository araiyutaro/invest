import { describe, it, expect, vi, afterEach } from "vitest";
import { validateRawNewsCuration } from "./schemas.js";

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

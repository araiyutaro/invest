import { describe, it, expect } from "vitest";
import { parseTickerList } from "./collect-technicals.js";

describe("parseTickerList", () => {
  it("{tickers: [...]} 形式（moderator-tickers.json）を受け付ける", () => {
    expect(parseTickerList({ tickers: ["MP", "CCJ"] })).toEqual(["MP", "CCJ"]);
  });

  it("{highlightedStocks: [{ticker}]} 形式（meeting-result.json）を受け付ける", () => {
    const input = {
      highlightedStocks: [{ ticker: "TARS" }, { ticker: "MP" }],
    };
    expect(parseTickerList(input)).toEqual(["TARS", "MP"]);
  });

  it("文字列配列を受け付ける", () => {
    expect(parseTickerList(["MP", "5631.T"])).toEqual(["MP", "5631.T"]);
  });

  it("重複を排除し、空文字・非文字列を除外する", () => {
    expect(parseTickerList({ tickers: ["MP", "MP", "", 42] })).toEqual(["MP"]);
  });

  it("解釈できない入力には空配列を返す", () => {
    expect(parseTickerList(null)).toEqual([]);
    expect(parseTickerList({ foo: "bar" })).toEqual([]);
  });
});

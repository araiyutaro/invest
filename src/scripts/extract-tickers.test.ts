import { describe, it, expect } from "vitest";
import { extractCandidateTickers } from "./extract-tickers.js";

const portfolio = new Set(["MRNA", "JOBY", "YOU"]);

describe("extractCandidateTickers", () => {
  it("picksからティッカーを抽出する", () => {
    const outputs = [
      { picks: [{ ticker: "MP" }, { ticker: "CCJ" }] },
      { picks: [{ ticker: "TARS" }] },
    ];
    const result = extractCandidateTickers(outputs, portfolio);
    expect(result).toEqual(expect.arrayContaining(["MP", "CCJ", "TARS"]));
  });

  it("summary・highlights・sectorViewの本文からもティッカーパターンを抽出する", () => {
    const outputs = [
      {
        picks: [],
        summary: "XME のブレイクアウトに注目",
        highlights: ["7203.T の決算が好調"],
        sectorView: "素材セクター優位",
      },
    ];
    const result = extractCandidateTickers(outputs, portfolio);
    expect(result).toContain("XME");
    expect(result).toContain("7203.T");
  });

  it("一般的な英略語（AI・ETF等）は除外する", () => {
    const outputs = [
      { picks: [], summary: "AI と ETF と GDP が話題、CPI は高止まり" },
    ];
    const result = extractCandidateTickers(outputs, portfolio);
    expect(result).toEqual([]);
  });

  it("金融指標略語（FCF・MACD・RSI等）は除外する", () => {
    const outputs = [
      {
        picks: [],
        summary: "FCF が改善、MACD と RSI はニュートラル、EPS 成長は CAGR 20%",
      },
    ];
    const result = extractCandidateTickers(outputs, portfolio);
    expect(result).toEqual([]);
  });

  it("ポートフォリオ保有銘柄は除外する", () => {
    const outputs = [
      { picks: [{ ticker: "MRNA" }, { ticker: "YOU" }, { ticker: "MP" }] },
    ];
    const result = extractCandidateTickers(outputs, portfolio);
    expect(result).toEqual(["MP"]);
  });

  it("UNKNOWNや不正な値は除外し、重複は排除する", () => {
    const outputs = [
      { picks: [{ ticker: "UNKNOWN" }, { ticker: "MP" }, { ticker: "MP" }] },
      { picks: [{ ticker: "" }, { ticker: 123 }] },
    ];
    const result = extractCandidateTickers(outputs, portfolio);
    expect(result).toEqual(["MP"]);
  });

  it("不正な形のエージェント出力があっても他の出力は処理される", () => {
    const outputs = [null, "broken", { picks: [{ ticker: "CCJ" }] }];
    const result = extractCandidateTickers(outputs, portfolio);
    expect(result).toEqual(["CCJ"]);
  });
});

import { describe, it, expect } from "vitest";
import {
  computeSMA,
  computeRSI,
  classifyTrend,
  buildSnapshot,
  type DailyBar,
} from "./technicals.js";

describe("computeSMA", () => {
  it("直近period本の単純平均を返す", () => {
    expect(computeSMA([1, 2, 3, 4, 5], 3)).toBe(4);
  });

  it("データ数がperiod未満の場合はnullを返す", () => {
    expect(computeSMA([1, 2], 3)).toBeNull();
  });

  it("periodが0以下の場合はnullを返す", () => {
    expect(computeSMA([1, 2, 3], 0)).toBeNull();
  });
});

describe("computeRSI", () => {
  it("単調上昇ではRSI=100を返す", () => {
    const closes = Array.from({ length: 30 }, (_, i) => 100 + i);
    expect(computeRSI(closes, 14)).toBe(100);
  });

  it("単調下落ではRSI=0を返す", () => {
    const closes = Array.from({ length: 30 }, (_, i) => 100 - i);
    expect(computeRSI(closes, 14)).toBe(0);
  });

  it("上昇幅と下落幅が同一の交互推移ではRSI≈50を返す", () => {
    const closes = Array.from({ length: 31 }, (_, i) =>
      i % 2 === 0 ? 100 : 101,
    );
    const rsi = computeRSI(closes, 14);
    expect(rsi).not.toBeNull();
    expect(rsi as number).toBeGreaterThan(45);
    expect(rsi as number).toBeLessThan(55);
  });

  it("変化なし（全て同値）ではRSI=50を返す", () => {
    const closes = Array.from({ length: 20 }, () => 100);
    expect(computeRSI(closes, 14)).toBe(50);
  });

  it("データ数がperiod+1未満の場合はnullを返す", () => {
    expect(computeRSI([1, 2, 3], 14)).toBeNull();
  });
});

describe("classifyTrend", () => {
  it("50日線・200日線の上なら上昇トレンド", () => {
    const label = classifyTrend({ price: 110, ma50: 100, ma200: 90, rsi14: 55 });
    expect(label).toContain("上昇トレンド");
  });

  it("50日線・200日線割れなら下降トレンド", () => {
    const label = classifyTrend({ price: 80, ma50: 100, ma200: 90, rsi14: 45 });
    expect(label).toContain("下降トレンド");
    expect(label).toContain("割れ");
  });

  it("50日線と200日線の間ならレンジ/転換点", () => {
    const label = classifyTrend({ price: 95, ma50: 100, ma200: 90, rsi14: 50 });
    expect(label).toContain("レンジ/転換点");
  });

  it("RSI70以上で過熱圏の注記が付く", () => {
    const label = classifyTrend({ price: 110, ma50: 100, ma200: 90, rsi14: 75 });
    expect(label).toContain("RSI過熱圏");
  });

  it("RSI30以下で売られ過ぎ圏の注記が付く", () => {
    const label = classifyTrend({ price: 80, ma50: 100, ma200: 90, rsi14: 25 });
    expect(label).toContain("RSI売られ過ぎ圏");
  });

  it("移動平均がnullならトレンド判定不能", () => {
    const label = classifyTrend({ price: 100, ma50: null, ma200: null, rsi14: 50 });
    expect(label).toContain("判定不能");
  });
});

describe("buildSnapshot", () => {
  const makeBars = (closes: ReadonlyArray<number>): ReadonlyArray<DailyBar> =>
    closes.map((close, i) => ({
      date: new Date(Date.UTC(2025, 0, 1) + i * 86400000)
        .toISOString()
        .slice(0, 10),
      close,
      volume: 1000,
    }));

  it("直近終値・前日比・移動平均・52週高安を算出する", () => {
    const closes = Array.from({ length: 260 }, (_, i) => 100 + i * 0.5);
    const snap = buildSnapshot("TEST", makeBars(closes));
    expect(snap).not.toBeNull();
    const s = snap!;
    expect(s.symbol).toBe("TEST");
    expect(s.price).toBeCloseTo(100 + 259 * 0.5);
    expect(s.changePercent).toBeCloseTo(
      ((100 + 259 * 0.5) / (100 + 258 * 0.5) - 1) * 100,
    );
    expect(s.ma50).not.toBeNull();
    expect(s.ma200).not.toBeNull();
    expect(s.fiftyTwoWeekHigh).toBeCloseTo(100 + 259 * 0.5);
    expect(s.fiftyTwoWeekLow).toBeCloseTo(100 + 8 * 0.5); // 直近252本の最安値
    expect(s.trendLabel).toContain("上昇トレンド");
    expect(s.asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("下落局面では移動平均割れの判定になる", () => {
    const closes = Array.from({ length: 260 }, (_, i) => 300 - i);
    const snap = buildSnapshot("DOWN", makeBars(closes));
    expect(snap!.trendLabel).toContain("下降トレンド");
    expect(snap!.pctFromMa50).not.toBeNull();
    expect(snap!.pctFromMa50 as number).toBeLessThan(0);
    expect(snap!.pctFrom52wHigh as number).toBeLessThan(0);
  });

  it("データ不足（20本未満）の場合でも価格は返しRSI等はnull", () => {
    const closes = Array.from({ length: 5 }, () => 100);
    const snap = buildSnapshot("SHORT", makeBars(closes));
    expect(snap!.price).toBe(100);
    expect(snap!.rsi14).toBeNull();
    expect(snap!.ma200).toBeNull();
  });

  it("バーが空の場合はnullを返す", () => {
    expect(buildSnapshot("EMPTY", [])).toBeNull();
  });
});

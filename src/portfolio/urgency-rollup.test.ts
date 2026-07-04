import { describe, it, expect } from "vitest";
import {
  computeWeeklyUrgencyRollup,
  formatDateKeyShort,
} from "./urgency-rollup.js";
import type { HoldingUrgencySnapshot, UrgencyHistoryFile } from "./urgency-history.js";

const makeSnapshot = (
  overrides: Partial<HoldingUrgencySnapshot>,
): HoldingUrgencySnapshot => ({
  symbol: "TEST",
  nameJa: "テスト株式会社",
  urgent: false,
  decision: "保持",
  ...overrides,
});

const makeHistory = (
  entries: Record<string, ReadonlyArray<HoldingUrgencySnapshot>>,
): UrgencyHistoryFile => ({ ...entries });

describe("computeWeeklyUrgencyRollup - window filter (D-01)", () => {
  it("anchor から6日前までの範囲は含まれる（inclusive）", () => {
    const history = makeHistory({
      "2026-06-29": [makeSnapshot({ symbol: "MRNA", urgent: true })],
    });
    const result = computeWeeklyUrgencyRollup(history, "2026-07-05");
    expect(result.daysCovered).toBe(1);
    expect(result.symbols).toHaveLength(1);
  });

  it("anchor-7 (範囲外) のキーは除外される", () => {
    const history = makeHistory({
      "2026-06-28": [makeSnapshot({ symbol: "MRNA", urgent: true })],
    });
    const result = computeWeeklyUrgencyRollup(history, "2026-07-05");
    expect(result.daysCovered).toBe(0);
    expect(result.symbols).toEqual([]);
  });

  it("anchor 当日は含まれる（inclusive）", () => {
    const history = makeHistory({
      "2026-07-05": [makeSnapshot({ symbol: "MRNA", urgent: true })],
    });
    const result = computeWeeklyUrgencyRollup(history, "2026-07-05");
    expect(result.daysCovered).toBe(1);
  });

  it("windowStart/windowEnd は UTC 日付演算で TZ非依存に計算される", () => {
    const result = computeWeeklyUrgencyRollup({}, "2026-07-05");
    expect(result.windowStart).toBe("2026-06-29");
    expect(result.windowEnd).toBe("2026-07-05");
  });

  it("月境界をまたぐ場合も正しく windowStart を計算する", () => {
    const result = computeWeeklyUrgencyRollup({}, "2026-07-02");
    expect(result.windowStart).toBe("2026-06-26");
    expect(result.windowEnd).toBe("2026-07-02");
  });
});

describe("computeWeeklyUrgencyRollup - missing days (D-01)", () => {
  it("欠損日があっても存在する日のみを集計する", () => {
    const history = makeHistory({
      "2026-06-29": [makeSnapshot({ symbol: "MRNA", urgent: true })],
      "2026-07-01": [makeSnapshot({ symbol: "MRNA", urgent: false })],
      "2026-07-05": [makeSnapshot({ symbol: "MRNA", urgent: true })],
    });
    const result = computeWeeklyUrgencyRollup(history, "2026-07-05");
    expect(result.daysCovered).toBe(3);
    expect(result.symbols[0].urgentDates).toEqual(["2026-06-29", "2026-07-05"]);
  });
});

describe("computeWeeklyUrgencyRollup - decision changes (D-02)", () => {
  it("暦日が飛んでいても記録済み日同士の隣接比較で変化を検出する", () => {
    const history = makeHistory({
      "2026-07-01": [makeSnapshot({ symbol: "MRNA", decision: "保持" })],
      "2026-07-04": [makeSnapshot({ symbol: "MRNA", decision: "買増" })],
    });
    const result = computeWeeklyUrgencyRollup(history, "2026-07-04");
    expect(result.symbols).toHaveLength(1);
    expect(result.symbols[0].decisionChanges).toEqual([
      { date: "2026-07-04", from: "保持", to: "買増" },
    ]);
  });

  it("最初の記録日はベースラインであり、それ自体は変化とみなさない", () => {
    const history = makeHistory({
      "2026-07-04": [makeSnapshot({ symbol: "MRNA", decision: "保持", urgent: true })],
    });
    const result = computeWeeklyUrgencyRollup(history, "2026-07-04");
    expect(result.symbols[0].decisionChanges).toEqual([]);
  });

  it("窓内で複数回変化した場合、複数のイベントが昇順で返る", () => {
    const history = makeHistory({
      "2026-07-01": [makeSnapshot({ symbol: "MRNA", decision: "保持" })],
      "2026-07-03": [makeSnapshot({ symbol: "MRNA", decision: "買増" })],
      "2026-07-05": [makeSnapshot({ symbol: "MRNA", decision: "一部売却" })],
    });
    const result = computeWeeklyUrgencyRollup(history, "2026-07-05");
    expect(result.symbols[0].decisionChanges).toEqual([
      { date: "2026-07-03", from: "保持", to: "買増" },
      { date: "2026-07-05", from: "買増", to: "一部売却" },
    ]);
  });
});

describe("computeWeeklyUrgencyRollup - urgent dates (D-03/D-05)", () => {
  it("urgent===true の日付のみを昇順で収集する", () => {
    const history = makeHistory({
      "2026-07-01": [makeSnapshot({ symbol: "MRNA", urgent: true })],
      "2026-07-02": [makeSnapshot({ symbol: "MRNA", urgent: false })],
      "2026-07-03": [makeSnapshot({ symbol: "MRNA", urgent: true })],
    });
    const result = computeWeeklyUrgencyRollup(history, "2026-07-03");
    expect(result.symbols[0].urgentDates).toEqual(["2026-07-01", "2026-07-03"]);
  });

  it("urgent が全て false かつ判断変化もない銘柄は symbols から除外される", () => {
    const history = makeHistory({
      "2026-07-01": [makeSnapshot({ symbol: "MRNA", urgent: false, decision: "保持" })],
      "2026-07-02": [makeSnapshot({ symbol: "MRNA", urgent: false, decision: "保持" })],
    });
    const result = computeWeeklyUrgencyRollup(history, "2026-07-02");
    expect(result.symbols).toEqual([]);
  });

  it("urgent のみ（判断変化なし）でも symbols に含まれる", () => {
    const history = makeHistory({
      "2026-07-01": [makeSnapshot({ symbol: "MRNA", urgent: true, decision: "保持" })],
      "2026-07-02": [makeSnapshot({ symbol: "MRNA", urgent: false, decision: "保持" })],
    });
    const result = computeWeeklyUrgencyRollup(history, "2026-07-02");
    expect(result.symbols).toHaveLength(1);
    expect(result.symbols[0].decisionChanges).toEqual([]);
  });

  it("判断変化のみ（urgent なし）でも symbols に含まれる", () => {
    const history = makeHistory({
      "2026-07-01": [makeSnapshot({ symbol: "MRNA", urgent: false, decision: "保持" })],
      "2026-07-02": [makeSnapshot({ symbol: "MRNA", urgent: false, decision: "買増" })],
    });
    const result = computeWeeklyUrgencyRollup(history, "2026-07-02");
    expect(result.symbols).toHaveLength(1);
    expect(result.symbols[0].urgentDates).toEqual([]);
  });
});

describe("computeWeeklyUrgencyRollup - immutability", () => {
  it("呼び出し後、入力 history オブジェクト・配列が変化しない", () => {
    const snapshotA = makeSnapshot({ symbol: "MRNA", urgent: true });
    const history: UrgencyHistoryFile = { "2026-07-01": [snapshotA] };
    const originalHistory = {
      ...history,
      "2026-07-01": [...history["2026-07-01"]],
    };
    computeWeeklyUrgencyRollup(history, "2026-07-01");
    expect(history).toEqual(originalHistory);
  });
});

describe("computeWeeklyUrgencyRollup - partial history (<7 days)", () => {
  it("履歴が3日分しかなくても throw せず daysCovered=3 を返す", () => {
    const history = makeHistory({
      "2026-07-01": [makeSnapshot({ symbol: "MRNA", urgent: true })],
      "2026-07-02": [makeSnapshot({ symbol: "MRNA", urgent: true })],
      "2026-07-03": [makeSnapshot({ symbol: "MRNA", urgent: true })],
    });
    const result = computeWeeklyUrgencyRollup(history, "2026-07-03");
    expect(result.daysCovered).toBe(3);
    expect(result.symbols).toHaveLength(1);
  });
});

describe("computeWeeklyUrgencyRollup - zero movement", () => {
  it("履歴は存在するが窓内で動きがない場合 symbols は空配列（エラーにしない）", () => {
    const history = makeHistory({
      "2026-07-01": [makeSnapshot({ symbol: "MRNA", urgent: false, decision: "保持" })],
      "2026-07-02": [makeSnapshot({ symbol: "MRNA", urgent: false, decision: "保持" })],
    });
    const result = computeWeeklyUrgencyRollup(history, "2026-07-02");
    expect(result.symbols).toEqual([]);
    expect(result.daysCovered).toBe(2);
  });
});

describe("computeWeeklyUrgencyRollup - malformed keys", () => {
  it("__proto__ / not-a-date / 空文字キーは無視され、daysCovered は有効キーのみを数える", () => {
    const history = {
      "__proto__": [makeSnapshot({ symbol: "MRNA", urgent: true })],
      "not-a-date": [makeSnapshot({ symbol: "MRNA", urgent: true })],
      "": [makeSnapshot({ symbol: "MRNA", urgent: true })],
      "2026-07-01": [makeSnapshot({ symbol: "MRNA", urgent: true })],
    } as unknown as UrgencyHistoryFile;
    const result = computeWeeklyUrgencyRollup(history, "2026-07-01");
    expect(result.daysCovered).toBe(1);
    expect(result.symbols[0].urgentDates).toEqual(["2026-07-01"]);
  });
});

describe("computeWeeklyUrgencyRollup - garbage anchor", () => {
  it("不正な anchorDate を渡しても throw せず空ロールアップを返す", () => {
    const history = makeHistory({
      "2026-07-01": [makeSnapshot({ symbol: "MRNA", urgent: true })],
    });
    const result = computeWeeklyUrgencyRollup(history, "not-a-date");
    expect(result).toEqual({
      windowStart: "not-a-date",
      windowEnd: "not-a-date",
      daysCovered: 0,
      symbols: [],
    });
  });
});

describe("computeWeeklyUrgencyRollup - corrupt snapshot entry", () => {
  it("値が配列でない日付は throw せずスキップされる", () => {
    const history = {
      "2026-07-01": "not-an-array",
      "2026-07-02": [makeSnapshot({ symbol: "MRNA", urgent: true })],
    } as unknown as UrgencyHistoryFile;
    const result = computeWeeklyUrgencyRollup(history, "2026-07-02");
    expect(result.daysCovered).toBe(2);
    expect(result.symbols).toHaveLength(1);
    expect(result.symbols[0].urgentDates).toEqual(["2026-07-02"]);
  });

  it("symbol フィールドが欠損/非文字列のスナップショット要素は throw せずスキップされる", () => {
    const history = {
      "2026-07-01": [
        { nameJa: "壊れた要素", urgent: true, decision: "保持" },
        { symbol: 123, nameJa: "壊れた要素2", urgent: true, decision: "保持" },
        makeSnapshot({ symbol: "MRNA", urgent: true }),
      ],
    } as unknown as UrgencyHistoryFile;
    const result = computeWeeklyUrgencyRollup(history, "2026-07-01");
    expect(result.symbols).toHaveLength(1);
    expect(result.symbols[0].symbol).toBe("MRNA");
  });
});

describe("computeWeeklyUrgencyRollup - deterministic order", () => {
  it("symbols は symbol の localeCompare 昇順でソートされる", () => {
    const history = makeHistory({
      "2026-07-01": [
        makeSnapshot({ symbol: "ZETA", urgent: true }),
        makeSnapshot({ symbol: "ALPHA", urgent: true }),
        makeSnapshot({ symbol: "MRNA", urgent: true }),
      ],
    });
    const result = computeWeeklyUrgencyRollup(history, "2026-07-01");
    expect(result.symbols.map((s) => s.symbol)).toEqual(["ALPHA", "MRNA", "ZETA"]);
  });
});

describe("formatDateKeyShort (D-07)", () => {
  it("2026-07-02 を 07/02 に変換する（ゼロパディング維持）", () => {
    expect(formatDateKeyShort("2026-07-02")).toBe("07/02");
  });

  it("2026-12-25 を 12/25 に変換する", () => {
    expect(formatDateKeyShort("2026-12-25")).toBe("12/25");
  });
});

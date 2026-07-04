import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFile, readdir } from "node:fs/promises";
import {
  loadNewsPool,
  loadHoldingNews,
  loadPrevPortfolioAnalysis,
  loadRound1Results,
  loadRound2Results,
  loadRound3Results,
  loadUrgencyHistory,
} from "./report-data-loaders.js";

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
  readdir: vi.fn(),
}));

const mockReaddir = readdir as unknown as ReturnType<typeof vi.fn>;
const mockReadFile = readFile as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("loadNewsPool", () => {
  it("news.json を読めたら JSON.parse 結果を配列として返す", async () => {
    const raw = JSON.stringify([
      { id: "n01", title: "T", url: "https://example.com", source: "S", publishedAt: "2026-07-03T00:00:00.000Z" },
    ]);
    vi.mocked(readFile).mockResolvedValueOnce(raw);
    const result = await loadNewsPool();
    expect(result).toEqual([
      { id: "n01", title: "T", url: "https://example.com", source: "S", publishedAt: "2026-07-03T00:00:00.000Z" },
    ]);
  });

  it("欠損時（ENOENT）は throw せず [] を返し console.error が呼ばれる", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(readFile).mockRejectedValueOnce(new Error("ENOENT"));
    const result = await loadNewsPool();
    expect(result).toEqual([]);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("パース失敗時は throw せず [] を返し console.error が呼ばれる", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(readFile).mockResolvedValueOnce("not valid json{{{");
    const result = await loadNewsPool();
    expect(result).toEqual([]);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

describe("loadHoldingNews", () => {
  it("holding-news.json を読めたら JSON.parse 結果をオブジェクトとして返す", async () => {
    const raw = JSON.stringify({ MRNA: [{ id: "n01", matchType: "ticker", score: 9 }] });
    vi.mocked(readFile).mockResolvedValueOnce(raw);
    const result = await loadHoldingNews();
    expect(result).toEqual({ MRNA: [{ id: "n01", matchType: "ticker", score: 9 }] });
  });

  it("欠損時（ENOENT）は throw せず {} を返し console.error が呼ばれる（D-09）", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(readFile).mockRejectedValueOnce(new Error("ENOENT"));
    const result = await loadHoldingNews();
    expect(result).toEqual({});
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("パース失敗時は throw せず {} を返し console.error が呼ばれる", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(readFile).mockResolvedValueOnce("not valid json{{{");
    const result = await loadHoldingNews();
    expect(result).toEqual({});
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

describe("loadPrevPortfolioAnalysis", () => {
  it("prev-portfolio-analysis.json を読めたら portfolioAnalysisSchema でパースした結果を返す", async () => {
    const raw = JSON.stringify({
      date: "2026-07-02",
      generatedAt: "2026-07-02T00:00:00.000Z",
      overallComment: "テスト",
      holdings: [{ symbol: "MRNA", nameJa: "モデルナ", decision: "保持", rationale: "理由" }],
      rebalanceActions: [],
    });
    vi.mocked(readFile).mockResolvedValueOnce(raw);
    const result = await loadPrevPortfolioAnalysis();
    expect(result?.holdings[0]?.symbol).toBe("MRNA");
  });

  it("欠損時（ENOENT）は throw せず null を返し console.warn が呼ばれる（D-15/Pitfall 7）", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(readFile).mockRejectedValueOnce(new Error("ENOENT"));
    const result = await loadPrevPortfolioAnalysis();
    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("パース失敗時は throw せず null を返し console.warn が呼ばれる", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(readFile).mockResolvedValueOnce("not valid json{{{");
    const result = await loadPrevPortfolioAnalysis();
    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe("loadUrgencyHistory", () => {
  it("urgency-history.json を読めたら JSON.parse 結果をオブジェクトとして返す", async () => {
    const raw = JSON.stringify({
      "2026-07-02": [{ symbol: "MRNA", nameJa: "モデルナ", urgent: true, decision: "保持" }],
    });
    vi.mocked(readFile).mockResolvedValueOnce(raw);
    const result = await loadUrgencyHistory();
    expect(result).toEqual({
      "2026-07-02": [{ symbol: "MRNA", nameJa: "モデルナ", urgent: true, decision: "保持" }],
    });
  });

  it("欠損時（ENOENT）は throw せず {} を返し console.warn が呼ばれる（D-13）", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(readFile).mockRejectedValueOnce(new Error("ENOENT"));
    const result = await loadUrgencyHistory();
    expect(result).toEqual({});
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("パース失敗時は throw せず {} を返し console.warn が呼ばれる", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(readFile).mockResolvedValueOnce("not valid json{{{");
    const result = await loadUrgencyHistory();
    expect(result).toEqual({});
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("CR-02: root が null の構文的に正しい JSON でも throw せず {} を返し console.warn が呼ばれる", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(readFile).mockResolvedValueOnce("null");
    const result = await loadUrgencyHistory();
    expect(result).toEqual({});
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("CR-02: root が配列の構文的に正しい JSON でも throw せず {} を返し console.warn が呼ばれる", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(readFile).mockResolvedValueOnce("[1,2,3]");
    const result = await loadUrgencyHistory();
    expect(result).toEqual({});
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

// --- WR-03: loadRound1/2/3 の per-file catch はサイレントではなく console.warn を出す（D-15/Pitfall 7） ---

const validRound1 = {
  agentId: "fundamentals",
  agentRole: "ファンダメンタルズアナリスト",
  analysis: "分析本文",
  summary: "サマリー",
  highlights: ["AI需要拡大"],
  risks: ["金利上昇リスク"],
  picks: [{ ticker: "PLTR", direction: "強気", rationale: "政府契約拡大" }],
  sectorView: "テクノロジー強気",
};

const validRound2 = {
  agentId: "fundamentals",
  discussion: "議論本文",
  comment: "コメント",
  agreements: ["PLTR強気"],
  disagreements: ["配分比率"],
};

const validRound3 = {
  agentId: "fundamentals",
  agentRole: "ファンダメンタルズアナリスト",
  scores: [{ ticker: "PLTR", score: 8, reason: "成長率高い" }],
};

describe("loadRound1Results (WR-03)", () => {
  it("malformed ファイルは console.warn（ファイル名入り）付きで drop され、正常ファイルは残る", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockReaddir.mockResolvedValueOnce(["bad.json", "good.json"]);
    mockReadFile.mockImplementation((path: unknown) =>
      String(path).includes("bad.json")
        ? Promise.resolve("not valid json{{{")
        : Promise.resolve(JSON.stringify(validRound1)),
    );
    const result = await loadRound1Results();
    expect(result).toHaveLength(1);
    expect(result[0]?.agentId).toBe("fundamentals");
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("bad.json"), expect.anything());
    warnSpy.mockRestore();
  });
});

describe("loadRound2Results (WR-03)", () => {
  it("malformed ファイルは console.warn（ファイル名入り）付きで drop され、正常ファイルは残る", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockReaddir.mockResolvedValueOnce(["bad.json", "good.json"]);
    mockReadFile.mockImplementation((path: unknown) =>
      String(path).includes("bad.json")
        ? Promise.resolve("not valid json{{{")
        : Promise.resolve(JSON.stringify(validRound2)),
    );
    const result = await loadRound2Results();
    expect(result).toHaveLength(1);
    expect(result[0]?.agentId).toBe("fundamentals");
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("bad.json"), expect.anything());
    warnSpy.mockRestore();
  });
});

describe("loadRound3Results (WR-03)", () => {
  it("malformed ファイルは console.warn（ファイル名入り）付きで drop され、正常ファイルは残る", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockReaddir.mockResolvedValueOnce(["bad.json", "good.json"]);
    mockReadFile.mockImplementation((path: unknown) =>
      String(path).includes("bad.json")
        ? Promise.resolve("not valid json{{{")
        : Promise.resolve(JSON.stringify(validRound3)),
    );
    const result = await loadRound3Results();
    expect(result).toHaveLength(1);
    expect(result[0]?.agentId).toBe("fundamentals");
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("bad.json"), expect.anything());
    warnSpy.mockRestore();
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFile } from "node:fs/promises";
import { loadNewsPool, loadHoldingNews } from "./report-data-loaders.js";

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
}));

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

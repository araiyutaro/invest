import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn().mockRejectedValue(new Error("ENOENT")),
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

const validMeetingResultJson = JSON.stringify({ date: "2026-06-24" });

const validRawCurationJson = JSON.stringify({
  leadIn: "決算シーズンが本格化し、ハイテク企業の動向が焦点。",
  articles: [
    {
      id: "n01",
      market: "us",
      importance: "high",
      commentary: "AI需要の持続的拡大を示す強い決算内容。",
      tickers: ["NVDA"],
      tickerNames: { NVDA: "エヌビディア" },
    },
  ],
});

const invalidRawCurationJson = JSON.stringify({
  leadIn: "x",
  articles: [
    {
      id: "n01",
      market: "USA", // 不正enum(us/japan/globalのいずれでもない)
      importance: "high",
      commentary: "y",
    },
  ],
});

const validPoolJson = JSON.stringify([
  {
    id: "n01",
    title: "NVIDIA第2四半期決算、市場予想上回る",
    url: "https://example.com/news/nvda",
    source: "Reuters",
    publishedAt: "2026-06-24T06:30:00.000Z",
  },
]);

describe("write-news-digest main()", () => {
  beforeEach(async () => {
    const fsMock = await import("node:fs/promises");
    (fsMock.writeFile as ReturnType<typeof vi.fn>).mockClear();
    (fsMock.mkdir as ReturnType<typeof vi.fn>).mockClear();
    (fsMock.readFile as ReturnType<typeof vi.fn>).mockClear();
    vi.spyOn(process, "exit").mockImplementation((() => {}) as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("Test 1: 正常系 -- meeting-result.json + news-curation.json + news.json から news-digest.html を書き出す", async () => {
    const fsMock = await import("node:fs/promises");
    (fsMock.readFile as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
      const p = String(path);
      if (p.includes("meeting-result.json")) return Promise.resolve(validMeetingResultJson);
      if (p.includes("news-curation.json")) return Promise.resolve(validRawCurationJson);
      if (p.includes("news.json")) return Promise.resolve(validPoolJson);
      return Promise.reject(new Error("ENOENT"));
    });

    const { main } = await import("./write-news-digest.js");
    await main();

    const writeCalls = (fsMock.writeFile as ReturnType<typeof vi.fn>).mock.calls;
    const digestCall = writeCalls.find((call) => String(call[0]).includes("news-digest.html"));
    expect(digestCall).toBeDefined();
    expect(String(digestCall![0])).toContain("2026-06-24");
    expect(process.exit).not.toHaveBeenCalledWith(1);
  });

  it("Test 2: curation欠損(ENOENT) -- フォールバックHTMLを書き出し exit code 1", async () => {
    const fsMock = await import("node:fs/promises");
    (fsMock.readFile as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
      const p = String(path);
      if (p.includes("meeting-result.json")) return Promise.resolve(validMeetingResultJson);
      if (p.includes("news-curation.json")) return Promise.reject(new Error("ENOENT"));
      if (p.includes("news.json")) return Promise.resolve(validPoolJson);
      return Promise.reject(new Error("ENOENT"));
    });

    const { main } = await import("./write-news-digest.js");
    await main();

    const writeCalls = (fsMock.writeFile as ReturnType<typeof vi.fn>).mock.calls;
    const digestCall = writeCalls.find((call) => String(call[0]).includes("news-digest.html"));
    expect(digestCall).toBeDefined();
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it("Test 3: curation不正(enum違反) -- フォールバックHTMLを書き出し exit code 1", async () => {
    const fsMock = await import("node:fs/promises");
    (fsMock.readFile as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
      const p = String(path);
      if (p.includes("meeting-result.json")) return Promise.resolve(validMeetingResultJson);
      if (p.includes("news-curation.json")) return Promise.resolve(invalidRawCurationJson);
      if (p.includes("news.json")) return Promise.resolve(validPoolJson);
      return Promise.reject(new Error("ENOENT"));
    });

    const { main } = await import("./write-news-digest.js");
    await main();

    const writeCalls = (fsMock.writeFile as ReturnType<typeof vi.fn>).mock.calls;
    const digestCall = writeCalls.find((call) => String(call[0]).includes("news-digest.html"));
    expect(digestCall).toBeDefined();
    expect(process.exit).toHaveBeenCalledWith(1);
  });
});
